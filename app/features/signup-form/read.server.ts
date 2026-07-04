import type { EventResponse } from "#prisma/generated/client";

import { DEFAULT_FORM } from "./default-form";

import { parseStoredFormSchema } from "~/features/forms/serialization";
import { logger } from "~/logger.server";
import { getEventResponsesForEvent } from "~/models/event-response.server";
import { getFormSubmissionsForEvent } from "~/models/form-submission.server";
import { getCurrentFormVersionForEvent } from "~/models/form.server";

// The one place that knows signup semantics on the read side (design §8).
// The admin signups table and the CSV export consume this — never the
// FormSubmission/EventResponse tables directly.

export interface Attendee {
  submissionId: string; // groups a party; legacy rows use the row id
  isSigner: boolean | null; // null = legacy row (signer-ness was never recorded)
  name: string;
  email: string; // party contact (submission-level) for new data
  phone: string;
  answers: Record<string, string | boolean>; // flattened per-person view
  createdAt: Date;
}

export interface RosterColumn {
  name: string; // field key — the answers key and CSV merge key
  label: string; // header text, from the latest version containing the name
}

const FRIENDS_LIST_NAME = "friends";

export async function getAttendeesForEvent(
  eventId: string,
): Promise<Attendee[]> {
  const { attendees } = await loadRoster(eventId);
  return attendees;
}

// The CSV export also needs the column union across versions; the table only
// needs the attendees.
export async function getAttendeeRosterForEvent(eventId: string): Promise<{
  attendees: Attendee[];
  columns: RosterColumn[];
}> {
  const { attendees, schemas, hasLegacyRows } = await loadRoster(eventId);

  // columns: union across versions with submissions (latest first, so the
  // newest order and labels win). An unsubmitted event falls back to its
  // current version; legacy defaults merge in when legacy rows exist. The
  // export must never come back header-less, so an empty union ends at
  // DEFAULT_FORM.
  const columnSchemas = [...schemas];
  if (columnSchemas.length === 0) {
    const currentVersion = await getCurrentFormVersionForEvent(eventId);
    const parsed = currentVersion
      ? parseStoredFormSchema(currentVersion.schema)
      : undefined;
    if (currentVersion && parsed) {
      if (parsed.success) {
        columnSchemas.push(parsed.data);
      } else {
        logger.error("Stored form schema failed to parse", {
          formVersion: currentVersion.id,
          error: parsed.error,
        });
      }
    }
  }
  if (hasLegacyRows || columnSchemas.length === 0) {
    columnSchemas.push(DEFAULT_FORM);
  }

  return { attendees, columns: deriveColumns(columnSchemas) };
}

type StoredFormSchema = NonNullable<
  ReturnType<typeof parseStoredFormSchema>["data"]
>;

async function loadRoster(eventId: string): Promise<{
  attendees: Attendee[];
  schemas: StoredFormSchema[]; // parsed, latest version first
  hasLegacyRows: boolean;
}> {
  const [legacyRows, submissions] = await Promise.all([
    getEventResponsesForEvent(eventId),
    getFormSubmissionsForEvent(eventId),
  ]);

  // parse every distinct version once — not once per submission
  const versions = [
    ...new Map(
      submissions.map(({ formVersion }) => [formVersion.id, formVersion]),
    ).values(),
  ].sort((a, b) => b.version - a.version);

  const descriptorsByVersion = new Map<string, StoredFormSchema>();
  for (const version of versions) {
    const parsed = parseStoredFormSchema(version.schema);
    if (parsed.success) {
      descriptorsByVersion.set(version.id, parsed.data);
    } else {
      // a bug — every writer validates; flag loudly rather than render wrong
      logger.error("Stored form schema failed to parse", {
        formVersion: version.id,
        error: parsed.error,
      });
    }
  }

  const attendees = [
    ...legacyRows.map(legacyRowToAttendee),
    ...submissions.flatMap((submission) => {
      const descriptors = descriptorsByVersion.get(submission.formVersionId);
      return descriptors ? flattenSubmission(submission, descriptors) : [];
    }),
  ].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());

  return {
    attendees,
    schemas: versions
      .map((version) => descriptorsByVersion.get(version.id))
      .filter((descriptors) => descriptors !== undefined),
    hasLegacyRows: legacyRows.length > 0,
  };
}

type StoredSubmission = Awaited<
  ReturnType<typeof getFormSubmissionsForEvent>
>[number];

// Design §8: the signer is one Attendee built from the top-level answers;
// each friends[i] item is one Attendee. A top-level field whose name also
// exists in the friends itemFields is the signer's personal answer; one with
// no counterpart is submission-level and is replicated onto every attendee.
//
// Extraction is structural (typeof-filtered against the pinned version's
// descriptors), NOT a strict re-validation: answers were validated when
// written, and a reader stricter than any writer would silently drop whole
// parties from the roster.
function flattenSubmission(
  submission: StoredSubmission,
  descriptors: StoredFormSchema,
): Attendee[] {
  const answers = asRecord(submission.answers);
  if (!answers) {
    logger.error("Stored submission answers are not an object", {
      submission: submission.id,
      formVersion: submission.formVersionId,
    });
    return [];
  }

  const friendsList = descriptors.find(
    (field) => field.type === "list" && field.data.name === FRIENDS_LIST_NAME,
  );
  const perAttendeeNames = new Set(
    friendsList?.type === "list"
      ? friendsList.data.itemFields.map((item) => item.data.name)
      : [],
  );

  const topLevel: Record<string, string | boolean> = {};
  const submissionLevel: Record<string, string | boolean> = {};
  for (const field of descriptors) {
    if (field.type === "list") continue;
    const value = answers[field.data.name];
    if (typeof value !== "string" && typeof value !== "boolean") continue;
    topLevel[field.data.name] = value;
    if (!perAttendeeNames.has(field.data.name)) {
      submissionLevel[field.data.name] = value;
    }
  }

  const shared = {
    submissionId: submission.id,
    email: asString(topLevel["email"]),
    phone: asString(topLevel["phone"]),
    createdAt: submission.createdAt,
  };

  const signer: Attendee = {
    ...shared,
    isSigner: true,
    name: asString(topLevel["name"]),
    answers: topLevel,
  };

  const friendItems = Array.isArray(answers[FRIENDS_LIST_NAME])
    ? (answers[FRIENDS_LIST_NAME] as unknown[])
    : [];

  const friends = friendItems.flatMap((item): Attendee[] => {
    const record = asRecord(item);
    if (!record) return [];

    const personal: Record<string, string | boolean> = {};
    for (const [name, value] of Object.entries(record)) {
      if (typeof value === "string" || typeof value === "boolean") {
        personal[name] = value;
      }
    }

    return [
      {
        ...shared,
        isSigner: false,
        name: asString(personal["name"]),
        answers: { ...submissionLevel, ...personal },
      },
    ];
  });

  return [signer, ...friends];
}

// One legacy row is one attendee. DEFAULT_FORM's field names equal the
// EventResponse column names, so this is an identity mapping; nulls take the
// values today's CSV export prints for them.
function legacyRowToAttendee(row: EventResponse): Attendee {
  return {
    submissionId: row.id,
    isSigner: null,
    name: row.name,
    email: row.email,
    phone: row.phone,
    createdAt: row.createdAt,
    answers: {
      name: row.name,
      email: row.email,
      phone: row.phone,
      vegetarian: row.vegetarian ?? false,
      student: row.student ?? false,
      restrictions: row.restrictions ?? "",
      comment: row.comment ?? "",
    },
  };
}

// Schemas arrive latest-first: the newest schema fixes the column order and
// labels, older versions' extra names are appended where first seen.
function deriveColumns(schemas: StoredFormSchema[]): RosterColumn[] {
  const columns: RosterColumn[] = [];
  const seen = new Set<string>();

  const push = (name: string, label: string) => {
    if (seen.has(name)) return;
    seen.add(name);
    columns.push({ name, label });
  };

  for (const fields of schemas) {
    for (const field of fields) {
      if (field.type === "list") {
        for (const item of field.data.itemFields) {
          push(item.data.name, item.data.label);
        }
      } else {
        push(field.data.name, field.data.label);
      }
    }
  }

  return columns;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return null;
  }
  return value as Record<string, unknown>;
}

function asString(value: unknown): string {
  return typeof value === "string" ? value : "";
}
