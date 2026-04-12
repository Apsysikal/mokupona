import { parseWithZod } from "@conform-to/zod/v4";
import { Form, redirect, useLoaderData } from "react-router";
import invariant from "tiny-invariant";
import { z } from "zod";

import type { Route } from "./+types/admin.pages.$pageKey";

import { Field, TextareaField } from "~/components/forms";
import { Button } from "~/components/ui/button";
import { siteCmsCatalog } from "~/features/cms/site-catalog";
import { siteCmsPageService } from "~/features/cms/site-page-service.server";
import { requireUserWithRole } from "~/utils/session.server";

const PageMetaSchema = z.object({
  title: z.string().trim().min(1, "Title is required"),
  description: z.string().trim().min(1, "Description is required"),
  revision: z.string().regex(/^\d*$/, "Invalid revision").optional(),
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
  const submission = parseWithZod(formData, {
    schema: PageMetaSchema,
  });

  if (submission.status !== "success" || !submission.value) {
    return submission.reply();
  }

  const baseRevision = submission.value.revision
    ? Number(submission.value.revision)
    : null;

  const result = await siteCmsPageService.applyPageCommand({
    type: "set-page-meta",
    pageKey,
    baseRevision,
    title: submission.value.title,
    description: submission.value.description,
  });

  return redirect(
    `/admin/pages/${pageKey}?revision=${result.editorModel.status.revision}`,
  );
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
    <main className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-4xl">Edit {editorModel.pageKey}</h1>
        <p>{formatPageStatus(editorModel.status)}</p>
      </div>

      <Form
        method="post"
        action={`/admin/pages/${editorModel.pageKey}`}
        className="flex flex-col gap-6"
      >
        <input
          type="hidden"
          name="revision"
          value={
            editorModel.status.revision === null
              ? ""
              : String(editorModel.status.revision)
          }
        />

        <Field
          labelProps={{ children: "Title" }}
          inputProps={{
            type: "text",
            name: "title",
            defaultValue: editorModel.pageSnapshot.title,
          }}
          className="flex flex-col gap-2"
        />

        <TextareaField
          labelProps={{ children: "Description" }}
          textareaProps={{
            name: "description",
            defaultValue: editorModel.pageSnapshot.description,
            rows: 8,
          }}
          className="flex flex-col gap-2"
        />

        <Button type="submit">Save Page</Button>
      </Form>
    </main>
  );
}

function requireKnownPageKey(pageKey: string | undefined) {
  invariant(typeof pageKey === "string", "Parameter pageKey is missing");

  if (!siteCmsCatalog.listPageKeys().includes(pageKey)) {
    throw new Response("Not found", { status: 404 });
  }

  return pageKey;
}

function formatPageStatus(status: {
  kind: "default-backed" | "persisted";
  revision: number | null;
}) {
  if (status.kind === "default-backed") {
    return "Default-backed Page";
  }

  return `Persisted Page - Revision ${status.revision}`;
}
