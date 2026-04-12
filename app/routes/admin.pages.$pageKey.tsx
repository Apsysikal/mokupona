import {
  getFormProps,
  getInputProps,
  getTextareaProps,
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
  title: z.string({ error: "Title is required" }).trim(),
  description: z.string({ error: "Description is required" }).trim(),
  revision: z
    .string()
    .trim()
    .optional()
    .transform((v) => (v === undefined || v === "" ? null : Number(v)))
    .pipe(z.number().int().nonnegative().nullable()),
});

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
    return { submission: submission.reply() };
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
      submission: submission.reply({
        formErrors: [
          "This page was changed by someone else. The editor has been refreshed with the current values — please review and save again.",
        ],
      }),
      conflictEditorModel: result.currentEditorModel,
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

  return (
    <PageEditorForm
      key={`${editorModel.pageKey}-${editorModel.status.revision ?? "default"}`}
      editorModel={editorModel}
    />
  );
}

function PageEditorForm({
  editorModel,
}: {
  editorModel: Awaited<ReturnType<typeof loader>>["editorModel"];
}) {
  const actionData = useActionData<typeof action>();

  const displayEditorModel = actionData?.conflictEditorModel ?? editorModel;

  const lastResult = actionData?.submission ?? null;

  const [form, fields] = useForm({
    id: `page-editor-${editorModel.pageKey}-${editorModel.status.revision ?? "default"}`,
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
        <h1 className="text-4xl">Edit {displayEditorModel.pageKey}</h1>
        <p>{formatPageStatus(displayEditorModel.status)}</p>
      </div>

      <Form
        method="POST"
        className="flex flex-col gap-6"
        {...getFormProps(form)}
      >
        <input {...getInputProps(fields.revision, { type: "hidden" })} />

        {form.errors?.length ? (
          <p className="text-destructive text-sm">{form.errors.join(" ")}</p>
        ) : null}

        <Field
          labelProps={{ children: "Title" }}
          inputProps={{ ...getInputProps(fields.title, { type: "text" }) }}
          errors={fields.title.errors}
          className="flex flex-col gap-2"
        />

        <TextareaField
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
