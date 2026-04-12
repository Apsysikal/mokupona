import {
  getFormProps,
  getInputProps,
  getTextareaProps,
  type SubmissionResult,
  useForm,
} from "@conform-to/react";
import { getZodConstraint, parseWithZod } from "@conform-to/zod/v4";
import { Form, redirect, useActionData, useLoaderData } from "react-router";
import invariant from "tiny-invariant";
import { z } from "zod";

import type { Route } from "./+types/admin.pages.$pageKey";

import { Field, TextareaField } from "~/components/forms";
import { Button } from "~/components/ui/button";
import type { PageCommand } from "~/features/cms/page-service.server";
import { formatPageStatus } from "~/features/cms/page-status";
import { siteCmsPageService } from "~/features/cms/site-page-service.server";
import { requireUserWithRole } from "~/utils/session.server";

const PageMetaSchema = z.object({
  title: z
    .string({ error: "Title is required" })
    .trim()
    .min(1, "Title is required"),
  description: z
    .string({ error: "Description is required" })
    .trim()
    .min(1, "Description is required"),
  revision: z
    .string()
    .trim()
    .optional()
    .transform((v) => (v === undefined || v === "" ? null : Number(v)))
    .pipe(z.number().int().nonnegative().nullable()),
});

type PageEditorLoaderData = Awaited<ReturnType<typeof loader>>;
type PageEditorActionData = Awaited<ReturnType<typeof action>>;
type ConflictActionData = Extract<PageEditorActionData, { status: "conflict" }>;
type PageMetaFormShape = {
  title: string;
  description: string;
  revision: string;
};
type PageMetaFormValue = {
  title: string;
  description: string;
  revision: number | null;
};

export async function loader({ request, params }: Route.LoaderArgs) {
  await requireUserWithRole(request, ["moderator", "admin"]);

  const pageKey = requireKnownPageKey(params.pageKey);

  return {
    editorModel: await siteCmsPageService.readEditorModel(pageKey),
  };
}

export async function action({ request, params }: Route.ActionArgs) {
  await requireUserWithRole(request, ["moderator", "admin"]);

  const pageKey = requireKnownPageKey(params.pageKey);
  const formData = await request.formData();
  const submission = parseWithZod(formData, { schema: PageMetaSchema });

  if (submission.status !== "success" || !submission.value) {
    return submission.reply();
  }

  const baseRevision = submission.value.revision;
  const setPageMetaCommand: PageCommand = {
    type: "set-page-meta",
    pageKey,
    baseRevision,
    title: submission.value.title,
    description: submission.value.description,
  };

  const result = await siteCmsPageService.applyPageCommand(setPageMetaCommand);

  if (result.status === "conflict") {
    return {
      status: "conflict" as const,
      conflictMessage:
        "This page was changed by someone else. The editor has been refreshed with the current values - please review and save again.",
      editorModel: result.currentEditorModel,
    };
  }

  return redirect(`/admin/pages/${pageKey}`);
}

export function meta({ data, params }: Route.MetaArgs) {
  if (!data) {
    return [{ title: `Admin - Pages - ${params.pageKey ?? "Page"}` }];
  }

  return [{ title: `Admin - Pages - ${data.editorModel.pageKey}` }];
}

export default function AdminPageEditorRoute() {
  const { editorModel } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const conflictAction =
    actionData &&
    typeof actionData === "object" &&
    "status" in actionData &&
    actionData.status === "conflict"
      ? actionData
      : null;
  const displayEditorModel = conflictAction?.editorModel ?? editorModel;
  const lastResult = conflictAction
    ? null
    : ((actionData as SubmissionResult<string[]> | undefined) ?? null);
  const conflictMessage = conflictAction?.conflictMessage ?? null;

  return (
    <PageEditorForm
      key={`${displayEditorModel.pageKey}-${displayEditorModel.status.revision ?? "default"}`}
      editorModel={displayEditorModel}
      lastResult={lastResult}
      conflictMessage={conflictMessage}
    />
  );
}

function PageEditorForm({
  editorModel,
  lastResult,
  conflictMessage,
}: {
  editorModel: PageEditorLoaderData["editorModel"];
  lastResult: SubmissionResult<string[]> | null;
  conflictMessage: string | null;
}) {
  const formVersionKey = `${editorModel.pageKey}-${editorModel.status.revision ?? "default"}`;

  const [form, fields] = useForm<PageMetaFormShape, PageMetaFormValue>({
    id: `page-editor-${formVersionKey}`,
    lastResult,
    shouldValidate: "onBlur",
    constraint: getZodConstraint(PageMetaSchema),
    defaultValue: {
      title: editorModel.pageSnapshot.title,
      description: editorModel.pageSnapshot.description,
      revision:
        editorModel.status.revision === null
          ? ""
          : String(editorModel.status.revision),
    },
    onValidate({ formData }) {
      return parseWithZod(formData, { schema: PageMetaSchema });
    },
  });

  return (
    <main className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-4xl">Edit {editorModel.pageKey}</h1>
        <p>{formatPageStatus(editorModel.status)}</p>
        {editorModel.diagnostics.map((diagnostic) => (
          <p
            key={`${diagnostic.code}-${diagnostic.message}`}
            className="text-destructive text-sm"
          >
            {diagnostic.message}
          </p>
        ))}
      </div>

      <Form
        key={formVersionKey}
        method="POST"
        className="flex flex-col gap-6"
        {...getFormProps(form)}
      >
        <input {...getInputProps(fields.revision, { type: "hidden" })} />

        {conflictMessage ? (
          <p className="text-destructive text-sm">{conflictMessage}</p>
        ) : null}

        {form.errors?.length ? (
          <p className="text-destructive text-sm">{form.errors.join(" ")}</p>
        ) : null}

        <Field
          key={`${formVersionKey}-title`}
          labelProps={{ children: "Title" }}
          inputProps={{ ...getInputProps(fields.title, { type: "text" }) }}
          errors={fields.title.errors}
          className="flex flex-col gap-2"
        />

        <TextareaField
          key={`${formVersionKey}-description`}
          labelProps={{ children: "Description" }}
          textareaProps={{
            ...getTextareaProps(fields.description),
            rows: 2,
          }}
          errors={fields.description.errors}
          className="flex flex-col gap-2"
        />

        <Button type="submit">Save Page</Button>
      </Form>
    </main>
  );
}

function requireKnownPageKey(pageKey: string | undefined) {
  invariant(typeof pageKey === "string", "Parameter pageKey is missing");

  if (!siteCmsPageService.isKnownPageKey(pageKey)) {
    throw new Response("Not found", { status: 404 });
  }

  return pageKey;
}
