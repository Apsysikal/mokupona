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
import { derivePageBanners } from "~/features/cms/admin-page-banners";
import type { BlockRef } from "~/features/cms/blocks/block-ref";
import {
  refByDefinitionKey,
  refByPageBlockId,
} from "~/features/cms/blocks/block-ref";
import type { BlockType } from "~/features/cms/blocks/types";
import type {
  BlockEditorCapabilities,
  BlockEditorContext,
  BlockInstance,
} from "~/features/cms/catalog";
import { UnknownBlockTypeError } from "~/features/cms/catalog";
import {
  cmsDiagnosticCodes,
  getCmsDiagnosticIdentity,
  isAdminOnlyBlockDiagnosticCode,
} from "~/features/cms/diagnostics";
import { createPageCommandBuilder } from "~/features/cms/page-commands";
import type { Diagnostic } from "~/features/cms/page-service.server";
import { formatPageStatus } from "~/features/cms/page-status";
import { siteCmsCatalog } from "~/features/cms/site-catalog";
import { siteCmsEditorWorkflow } from "~/features/cms/site-editor-workflow.server";
import { siteCmsPageService } from "~/features/cms/site-page-service.server";
import { parseImageFormData } from "~/utils/image-upload.server";
import { requireUserWithRole } from "~/utils/session.server";

// ─── Schemas ──────────────────────────────────────────────────────────────────

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

// ─── Shared helpers ───────────────────────────────────────────────────────────

function requireKnownPageKey(pageKey: string | undefined) {
  invariant(typeof pageKey === "string", "Parameter pageKey is missing");

  if (!siteCmsPageService.isKnownPageKey(pageKey)) {
    throw new Response("Not found", { status: 404 });
  }

  return pageKey;
}

function parseBaseRevision(raw: FormDataEntryValue | null): number | null {
  if (typeof raw !== "string" || raw === "") return null;
  const n = Number(raw);
  return Number.isInteger(n) && n >= 0 ? n : null;
}

// ─── Loader ───────────────────────────────────────────────────────────────────

export async function loader({ request, params }: Route.LoaderArgs) {
  await requireUserWithRole(request, ["moderator", "admin"]);

  const pageKey = requireKnownPageKey(params.pageKey);

  return siteCmsEditorWorkflow.loadEditor(pageKey);
}

// ─── Action ───────────────────────────────────────────────────────────────────

export async function action({ request, params }: Route.ActionArgs) {
  await requireUserWithRole(request, ["moderator", "admin"]);

  const pageKey = requireKnownPageKey(params.pageKey);
  const uploadResult = await parseImageFormData(request, "imageFile");

  if (!uploadResult.success) {
    return {
      status: "conflict" as const,
      message: uploadResult.uploadError,
      editorModel: await siteCmsPageService.readEditorModel(pageKey),
    };
  }

  try {
    const result = await siteCmsEditorWorkflow.mutateFromForm({
      pageKey,
      baseRevision: parseBaseRevision(uploadResult.formData.get("baseRevision")),
      formData: uploadResult.formData,
      upload: {
        persistImage: uploadResult.persistImage,
      },
    });

    if (result.status === "saved") {
      return redirect(`/admin/pages/${pageKey}`);
    }

    return result;
  } finally {
    await uploadResult.discardImage();
  }
}

// ─── Meta ─────────────────────────────────────────────────────────────────────

export function meta({ data, params }: Route.MetaArgs) {
  if (!data) {
    return [{ title: `Admin - Pages - ${params.pageKey ?? "Page"}` }];
  }

  return [{ title: `Admin - Pages - ${data.editorModel.pageKey}` }];
}

// ─── Types ────────────────────────────────────────────────────────────────────

type PageEditorLoaderData = Awaited<ReturnType<typeof loader>>;
type PageEditorActionData = Awaited<ReturnType<typeof action>>;
type ConflictActionData = Extract<PageEditorActionData, { status: "conflict" }>;
type ValidationActionData = Extract<
  PageEditorActionData,
  { status: "validation-error" }
>;
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

function hasActionStatus<TStatus extends string>(
  data: unknown,
  status: TStatus,
): data is { status: TStatus } {
  return (
    typeof data === "object" &&
    data !== null &&
    "status" in data &&
    (data as { status: unknown }).status === status
  );
}

// ─── Route component ──────────────────────────────────────────────────────────

export default function AdminPageEditorRoute() {
  const { editorModel, linkTargets } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const conflictAction = hasActionStatus(actionData, "conflict")
    ? (actionData as ConflictActionData)
    : null;
  const validationAction = hasActionStatus(actionData, "validation-error")
    ? (actionData as ValidationActionData)
    : null;
  const blockValidationAction = validationAction?.blockRef
    ? validationAction
    : null;
  const displayEditorModel =
    conflictAction?.editorModel ??
    validationAction?.editorModel ??
    editorModel;
  const hasCustomActionData = Boolean(conflictAction || blockValidationAction);
  const lastResult =
    validationAction && !validationAction.blockRef
      ? validationAction.lastResult
      : hasCustomActionData
        ? null
        : ((actionData as SubmissionResult<string[]> | undefined) ?? null);
  const topLevelConflictMessage =
    conflictAction && !("blockRef" in conflictAction)
      ? conflictAction.message
      : null;

  const revision = displayEditorModel.status.revision;
  const commandBuilder = createPageCommandBuilder(
    displayEditorModel.pageKey,
    revision,
  );
  const pageRule = siteCmsCatalog.getPageRule(displayEditorModel.pageKey);
  const requiredLeadingCount = pageRule.requiredLeadingBlockTypes?.length ?? 0;
  const blocks = displayEditorModel.pageSnapshot.blocks;
  const defaultSnapshot = siteCmsCatalog.readPageSnapshot(
    displayEditorModel.pageKey,
  );
  const defaultBlockDataByType = new Map<BlockType, unknown[]>();
  for (const defaultBlock of defaultSnapshot.blocks) {
    const candidates = defaultBlockDataByType.get(defaultBlock.type);
    if (candidates) {
      candidates.push(defaultBlock.data);
      continue;
    }

    defaultBlockDataByType.set(defaultBlock.type, [defaultBlock.data]);
  }
  const pageBanners = derivePageBanners({
    status: displayEditorModel.status,
    diagnostics: displayEditorModel.diagnostics,
  });

  return (
    <main className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-4xl">Edit {displayEditorModel.pageKey}</h1>
        <p>{formatPageStatus(displayEditorModel.status)}</p>
        {pageBanners.map((banner) => (
          <p
            key={banner}
            className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900"
          >
            {banner}
          </p>
        ))}
        {displayEditorModel.diagnostics.map((diagnostic, diagnosticIndex) => (
          <p
            key={`${getCmsDiagnosticIdentity(diagnostic)}-${diagnosticIndex}`}
            className="text-destructive text-sm"
          >
            {diagnostic.message}
          </p>
        ))}
      </div>

      {topLevelConflictMessage ? (
        <p className="text-destructive text-sm">{topLevelConflictMessage}</p>
      ) : null}

      <PageMetaForm
        key={`${displayEditorModel.pageKey}-${displayEditorModel.status.revision ?? "default"}`}
        editorModel={displayEditorModel}
        lastResult={lastResult}
      />

      <section className="flex flex-col gap-4">
        <h2 className="text-2xl">Blocks</h2>
        {blocks.map((block, index) => {
          const blockDiagnostic = displayEditorModel.diagnostics.find(
            (diagnostic) =>
              diagnostic.blockIndex === index &&
              isAdminOnlyBlockDiagnosticCode(diagnostic.code),
          );
          let definition = null;
          try {
            definition = siteCmsCatalog.getBlockDefinition(block.type);
          } catch (error) {
            if (!(error instanceof UnknownBlockTypeError)) {
              throw error;
            }

            definition = null;
          }
          const hasRenderableEditor = Boolean(definition?.editor);
          const isBrokenDataDiagnostic =
            blockDiagnostic?.code === cmsDiagnosticCodes.blockBrokenData;

          const blockRef: BlockRef = block.pageBlockId
            ? refByPageBlockId(block.pageBlockId, index)
            : refByDefinitionKey(block.definitionKey ?? `block-${index}`);
          const serializedBlockRef = JSON.stringify(blockRef);

          const capabilities: BlockEditorCapabilities = {
            canMoveUp: index > requiredLeadingCount && index > 0,
            canMoveDown:
              index >= requiredLeadingCount && index < blocks.length - 1,
            canDelete: index >= requiredLeadingCount,
          };

          if (
            !hasRenderableEditor ||
            !definition?.editor ||
            (blockDiagnostic && !isBrokenDataDiagnostic)
          ) {
            return (
              <BrokenBlockCard
                key={block.pageBlockId ?? `${block.type}-${index}`}
                block={block}
                blockRef={serializedBlockRef}
                baseRevision={revision}
                capabilities={capabilities}
                diagnostic={blockDiagnostic}
              />
            );
          }
          const renderEditor = definition.editor;
          let editorData = block.data;
          if (isBrokenDataDiagnostic) {
            const parsedCurrent = definition.schema.safeParse(block.data);
            if (parsedCurrent.success) {
              editorData = parsedCurrent.data;
            } else {
              let recovered = false;
              const fallbackDataCandidates = defaultBlockDataByType.get(
                block.type,
              );
              for (const candidate of fallbackDataCandidates ?? []) {
                const parsedCandidate = definition.schema.safeParse(candidate);
                if (parsedCandidate.success) {
                  editorData = parsedCandidate.data;
                  recovered = true;
                  break;
                }
              }

              if (!recovered) {
                return (
                  <BrokenBlockCard
                    key={block.pageBlockId ?? `${block.type}-${index}`}
                    block={block}
                    blockRef={serializedBlockRef}
                    baseRevision={revision}
                    capabilities={capabilities}
                    diagnostic={blockDiagnostic}
                  />
                );
              }
            }
          }

          const ctx: BlockEditorContext = {
            data: editorData,
            blockRef,
            commandBuilder,
            linkTargetRegistry: linkTargets,
            capabilities,
            formState:
              (definition.type === "hero" ||
                definition.type === "text-section" ||
                definition.type === "image") &&
              (blockValidationAction?.blockRef === serializedBlockRef ||
                conflictAction?.blockRef === serializedBlockRef)
                ? {
                    lastResult: blockValidationAction?.lastResult ?? null,
                    errorMessage:
                      conflictAction?.blockRef === serializedBlockRef
                        ? conflictAction.message
                        : null,
                  }
                : undefined,
          };

          return (
            <div key={block.pageBlockId ?? `${block.type}-${index}`}>
              {isBrokenDataDiagnostic ? (
                <details className="border-destructive/40 rounded-md border border-dashed p-3 text-sm">
                  <summary className="text-destructive cursor-pointer font-medium">
                    Recovered editor defaults from invalid persisted data
                  </summary>
                  <pre className="bg-muted mt-2 overflow-x-auto rounded p-2 text-xs">
                    {JSON.stringify(block.data, null, 2)}
                  </pre>
                </details>
              ) : null}
              {renderEditor(ctx)}
            </div>
          );
        })}

        {pageRule.allowedBlockTypes
          .filter(
            (t) => !(pageRule.requiredLeadingBlockTypes ?? []).includes(t),
          )
          .filter((t) => t === "text-section" || t === "image")
          .map((blockType) => (
            <form key={blockType} method="post">
              <input type="hidden" name="intent" value="add-block" />
              <input type="hidden" name="blockType" value={blockType} />
              <input type="hidden" name="blockVersion" value="1" />
              <input
                type="hidden"
                name="baseRevision"
                value={revision === null ? "" : String(revision)}
              />
              <Button type="submit" variant="outline">
                {blockType === "image"
                  ? "+ Add image block"
                  : "+ Add text section"}
              </Button>
            </form>
          ))}
      </section>

      {displayEditorModel.status.kind === "persisted" ? (
        <ResetToDefaultsSection revision={revision} />
      ) : null}
    </main>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function PageMetaForm({
  editorModel,
  lastResult,
}: {
  editorModel: PageEditorLoaderData["editorModel"];
  lastResult: SubmissionResult<string[]> | null;
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
    <Form
      key={formVersionKey}
      method="POST"
      className="flex flex-col gap-6"
      {...getFormProps(form)}
    >
      <input {...getInputProps(fields.revision, { type: "hidden" })} />

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
  );
}

function BrokenBlockCard({
  block,
  blockRef,
  baseRevision,
  capabilities,
  diagnostic,
}: {
  block: BlockInstance;
  blockRef: string;
  baseRevision: number | null;
  capabilities: BlockEditorCapabilities;
  diagnostic?: Diagnostic;
}) {
  const baseRevisionValue = baseRevision === null ? "" : String(baseRevision);
  return (
    <div className="border-destructive/40 flex flex-col gap-4 rounded-md border p-4">
      <div className="flex flex-col gap-1">
        <p className="font-medium">
          Unsupported/Broken block: {block.type} (v{block.version})
        </p>
        {diagnostic ? (
          <p className="text-destructive text-sm">{diagnostic.message}</p>
        ) : null}
        <pre className="bg-muted overflow-x-auto rounded p-2 text-xs">
          {JSON.stringify(block.data, null, 2)}
        </pre>
      </div>

      <div className="flex gap-2">
        {capabilities.canMoveUp ? (
          <form method="post">
            <input type="hidden" name="intent" value="move-block-up" />
            <input type="hidden" name="blockRef" value={blockRef} />
            <input
              type="hidden"
              name="baseRevision"
              value={baseRevisionValue}
            />
            <Button type="submit" variant="outline">
              Move up
            </Button>
          </form>
        ) : null}

        {capabilities.canMoveDown ? (
          <form method="post">
            <input type="hidden" name="intent" value="move-block-down" />
            <input type="hidden" name="blockRef" value={blockRef} />
            <input
              type="hidden"
              name="baseRevision"
              value={baseRevisionValue}
            />
            <Button type="submit" variant="outline">
              Move down
            </Button>
          </form>
        ) : null}

        {capabilities.canDelete ? (
          <form method="post">
            <input type="hidden" name="intent" value="delete-block" />
            <input type="hidden" name="blockRef" value={blockRef} />
            <input
              type="hidden"
              name="baseRevision"
              value={baseRevisionValue}
            />
            <Button
              type="submit"
              variant="outline"
              className="text-destructive"
            >
              Delete block
            </Button>
          </form>
        ) : null}
      </div>
    </div>
  );
}

function ResetToDefaultsSection({ revision }: { revision: number | null }) {
  return (
    <section className="flex flex-col gap-3 border-t pt-6">
      <h2 className="text-lg font-semibold">Reset to defaults</h2>
      <p className="text-muted-foreground text-sm">
        Discard all persisted CMS content for this page. The page will return to
        code-defined defaults until the next successful save.
      </p>
      <details className="rounded-md border border-dashed p-4">
        <summary className="text-destructive cursor-pointer font-medium">
          Confirm reset to defaults
        </summary>
        <div className="mt-4 flex flex-col gap-3">
          <p className="text-sm">
            This action cannot be undone. All customized content will be
            removed.
          </p>
          <form method="post">
            <input type="hidden" name="intent" value="reset-page" />
            <input
              type="hidden"
              name="baseRevision"
              value={revision === null ? "" : String(revision)}
            />
            <Button
              type="submit"
              variant="outline"
              className="text-destructive"
            >
              Reset to defaults
            </Button>
          </form>
        </div>
      </details>
    </section>
  );
}
