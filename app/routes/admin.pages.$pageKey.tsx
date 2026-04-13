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
import { prisma } from "~/db.server";
import type { BlockRef } from "~/features/cms/blocks/block-ref";
import {
  refByDefinitionKey,
  refByPageBlockId,
} from "~/features/cms/blocks/block-ref";
import {
  applyHeroBlockEditorValue,
  createHeroBlockEditorFormSchema,
} from "~/features/cms/blocks/hero/editor-schema";
import {
  applyTextSectionBlockEditorValue,
  createTextSectionBlockEditorFormSchema,
} from "~/features/cms/blocks/text-section/editor-schema";
import type { TextSectionBlockType } from "~/features/cms/blocks/text-section/model";
import type { BlockType } from "~/features/cms/blocks/types";
import type {
  BlockEditorCapabilities,
  BlockEditorContext,
  BlockInstance,
} from "~/features/cms/catalog";
import {
  deleteCmsImagesIfUnreferenced,
  getRemovedUploadedHeroImageIds,
} from "~/features/cms/cms-image-lifecycle.server";
import {
  createPageCommandBuilder,
  type MutableBlockRef,
} from "~/features/cms/page-commands";
import type { PageCommand } from "~/features/cms/page-service.server";
import { formatPageStatus } from "~/features/cms/page-status";
import { siteCmsCatalog } from "~/features/cms/site-catalog";
import { siteLinkTargetRegistry } from "~/features/cms/site-link-targets";
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

const MAX_IMAGE_SIZE_BYTES = 1024 * 1024 * 3;

// ─── Shared helpers ───────────────────────────────────────────────────────────

function requireKnownPageKey(pageKey: string | undefined) {
  invariant(typeof pageKey === "string", "Parameter pageKey is missing");

  if (!siteCmsPageService.isKnownPageKey(pageKey)) {
    throw new Response("Not found", { status: 404 });
  }

  return pageKey;
}

function parseBlockRef(raw: FormDataEntryValue | null): BlockRef | null {
  if (typeof raw !== "string") return null;
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (
      parsed &&
      typeof parsed === "object" &&
      "kind" in parsed &&
      typeof (parsed as { kind: unknown }).kind === "string"
    ) {
      return parsed as BlockRef;
    }
    return null;
  } catch {
    return null;
  }
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

  return {
    editorModel: await siteCmsPageService.readEditorModel(pageKey),
    linkTargetRegistry: siteLinkTargetRegistry,
  };
}

// ─── Action ───────────────────────────────────────────────────────────────────

export async function action({ request, params }: Route.ActionArgs) {
  await requireUserWithRole(request, ["moderator", "admin"]);

  const pageKey = requireKnownPageKey(params.pageKey);
  const uploadResult = await parseImageFormData(request, "imageFile");

  if (!uploadResult.success) {
    return {
      status: "conflict" as const,
      conflictMessage: uploadResult.uploadError,
      editorModel: await siteCmsPageService.readEditorModel(pageKey),
    };
  }

  const formData = uploadResult.formData;
  const intent = formData.get("intent");

  try {
    // Default (no intent field) → set-page-meta via Conform
    if (!intent || intent === "set-page-meta") {
      const submission = parseWithZod(formData, { schema: PageMetaSchema });

      if (submission.status !== "success" || !submission.value) {
        return submission.reply();
      }

      const command: PageCommand = {
        type: "set-page-meta",
        pageKey,
        baseRevision: submission.value.revision,
        title: submission.value.title,
        description: submission.value.description,
      };

      const result = await siteCmsPageService.applyPageCommand(command);

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

    // Block commands — all share blockRef + baseRevision
    const blockRef = parseBlockRef(formData.get("blockRef"));
    const baseRevision = parseBaseRevision(formData.get("baseRevision"));

    if (!blockRef) {
      throw new Response("Missing or invalid blockRef", { status: 400 });
    }

    const commandBuilder = createPageCommandBuilder(pageKey, baseRevision);

    if (intent === "set-block-data") {
      const blockType = formData.get("blockType");
      const blockVersionRaw = formData.get("blockVersion");

      if (
        typeof blockType !== "string" ||
        typeof blockVersionRaw !== "string"
      ) {
        throw new Response("Missing blockType or blockVersion", {
          status: 400,
        });
      }

      const blockVersion = Number(blockVersionRaw);
      const serializedBlockRef = JSON.stringify(blockRef);

      if (blockType === "hero" && blockVersion === 1) {
        const heroSchema = createHeroBlockEditorFormSchema(
          siteLinkTargetRegistry,
        );
        const heroSubmission = parseWithZod(formData, {
          schema: heroSchema,
        });

        if (heroSubmission.status !== "success" || !heroSubmission.value) {
          return {
            status: "block-validation-error" as const,
            blockRef: serializedBlockRef,
            editorModel: await siteCmsPageService.readEditorModel(pageKey),
            lastResult: heroSubmission.reply(),
          };
        }

        const currentEditorModel =
          await siteCmsPageService.readEditorModel(pageKey);
        const currentBlocks = currentEditorModel.pageSnapshot.blocks;
        const currentBlock = resolveBlock(currentBlocks, blockRef);
        if (!currentBlock || currentBlock.type !== "hero") {
          return {
            status: "block-conflict" as const,
            blockRef: serializedBlockRef,
            conflictMessage:
              "Block could not be saved — the editor has been refreshed with the current block.",
            editorModel: currentEditorModel,
          };
        }

        const imageFileEntry = formData.get("imageFile");
        if (
          heroSubmission.value.imageAction === "replace" &&
          (!(imageFileEntry instanceof File) || imageFileEntry.size <= 0)
        ) {
          return {
            status: "block-conflict" as const,
            blockRef: serializedBlockRef,
            conflictMessage: "Please choose an image file before replacing.",
            editorModel: currentEditorModel,
          };
        }

        if (
          imageFileEntry instanceof File &&
          imageFileEntry.size > MAX_IMAGE_SIZE_BYTES
        ) {
          return {
            status: "block-conflict" as const,
            blockRef: serializedBlockRef,
            conflictMessage: "File cannot be greater than 3MB",
            editorModel: currentEditorModel,
          };
        }

        const uploadedImageId =
          heroSubmission.value.imageAction === "replace"
            ? await persistHeroUploadedImage(imageFileEntry, {
                persistImage: uploadResult.persistImage,
              })
            : undefined;
        if (
          heroSubmission.value.imageAction === "replace" &&
          !uploadedImageId
        ) {
          return {
            status: "block-conflict" as const,
            blockRef: serializedBlockRef,
            conflictMessage: "Please choose an image file before replacing.",
            editorModel: currentEditorModel,
          };
        }

        const heroCommand = commandBuilder.setBlockData(
          blockRef,
          blockType as BlockType,
          blockVersion,
          applyHeroBlockEditorValue(
            currentBlock.data as Parameters<
              typeof applyHeroBlockEditorValue
            >[0],
            heroSubmission.value,
            { uploadedImageId },
          ),
        );
        const nextData = heroCommand.data as Parameters<
          typeof getUploadedHeroImageId
        >[0];
        const previousImageId = getUploadedHeroImageId(currentBlock.data);
        const nextImageId = getUploadedHeroImageId(nextData);

        const heroResult =
          await siteCmsPageService.applyPageCommand(heroCommand);

        if (heroResult.status === "conflict") {
          if (
            heroSubmission.value.imageAction === "replace" &&
            nextImageId &&
            nextImageId !== previousImageId
          ) {
            await deleteCmsImagesIfUnreferenced({
              imageIds: [nextImageId],
              prisma,
            });
          }
          return {
            status: "block-conflict" as const,
            blockRef: serializedBlockRef,
            conflictMessage:
              "Block could not be saved — please refresh and retry.",
            editorModel: heroResult.currentEditorModel,
          };
        }

        if (previousImageId && previousImageId !== nextImageId) {
          await cleanupRemovedHeroImages({
            previousBlocks: currentBlocks,
            nextBlocks: heroResult.editorModel.pageSnapshot.blocks,
          });
        }

        return redirect(`/admin/pages/${pageKey}`);
      }

      if (blockType === "text-section" && blockVersion === 1) {
        const textSectionSchema = createTextSectionBlockEditorFormSchema();
        const textSectionSubmission = parseWithZod(formData, {
          schema: textSectionSchema,
        });

        if (
          textSectionSubmission.status !== "success" ||
          !textSectionSubmission.value
        ) {
          return {
            status: "block-validation-error" as const,
            blockRef: serializedBlockRef,
            editorModel: await siteCmsPageService.readEditorModel(pageKey),
            lastResult: textSectionSubmission.reply(),
          };
        }

        const currentEditorModel =
          await siteCmsPageService.readEditorModel(pageKey);
        const currentBlocks = currentEditorModel.pageSnapshot.blocks;
        const currentBlock = resolveBlock(currentBlocks, blockRef);
        if (!currentBlock || currentBlock.type !== "text-section") {
          return {
            status: "block-conflict" as const,
            blockRef: serializedBlockRef,
            conflictMessage:
              "Block could not be saved — the editor has been refreshed with the current block.",
            editorModel: currentEditorModel,
          };
        }

        const textSectionCommand = commandBuilder.setBlockData(
          blockRef,
          "text-section",
          1,
          applyTextSectionBlockEditorValue(
            currentBlock.data as TextSectionBlockType["data"],
            textSectionSubmission.value,
          ),
        );

        const textSectionResult =
          await siteCmsPageService.applyPageCommand(textSectionCommand);

        if (textSectionResult.status === "conflict") {
          return {
            status: "block-conflict" as const,
            blockRef: serializedBlockRef,
            conflictMessage:
              "Block could not be saved — please refresh and retry.",
            editorModel: textSectionResult.currentEditorModel,
          };
        }

        return redirect(`/admin/pages/${pageKey}`);
      }

      throw new Response("Unsupported block editor payload", { status: 400 });
    }

    if (intent === "move-block-up" || intent === "move-block-down") {
      if (blockRef.kind !== "page-block-id") {
        throw new Response("move commands require a page-block-id ref", {
          status: 400,
        });
      }

      const mutableRef: MutableBlockRef = blockRef;
      const command =
        intent === "move-block-up"
          ? commandBuilder.moveBlockUp(mutableRef)
          : commandBuilder.moveBlockDown(mutableRef);

      const result = await siteCmsPageService.applyPageCommand(command);

      if (result.status === "conflict") {
        return {
          status: "conflict" as const,
          conflictMessage:
            "Move could not be applied — the page may have changed.",
          editorModel: result.currentEditorModel,
        };
      }

      return redirect(`/admin/pages/${pageKey}`);
    }

    if (intent === "delete-block") {
      if (blockRef.kind !== "page-block-id") {
        throw new Response("delete command requires a page-block-id ref", {
          status: 400,
        });
      }

      const currentEditorModel =
        await siteCmsPageService.readEditorModel(pageKey);
      const mutableRef: MutableBlockRef = blockRef;
      const command = commandBuilder.deleteBlock(mutableRef);
      const result = await siteCmsPageService.applyPageCommand(command);

      if (result.status === "conflict") {
        return {
          status: "conflict" as const,
          conflictMessage:
            "Delete could not be applied — the block may be in a fixed slot.",
          editorModel: result.currentEditorModel,
        };
      }

      await cleanupRemovedHeroImages({
        previousBlocks: currentEditorModel.pageSnapshot.blocks,
        nextBlocks: result.editorModel.pageSnapshot.blocks,
      });

      return redirect(`/admin/pages/${pageKey}`);
    }

    if (intent === "add-block") {
      const rawBlockType = formData.get("blockType");
      const rawBlockVersion = formData.get("blockVersion");

      if (
        typeof rawBlockType !== "string" ||
        typeof rawBlockVersion !== "string"
      ) {
        throw new Response("Missing blockType or blockVersion", {
          status: 400,
        });
      }

      const addBlockVersion = Number(rawBlockVersion);
      let initialData: unknown;

      if (rawBlockType === "text-section" && addBlockVersion === 1) {
        initialData = {
          headline: "",
          body: "",
          variant: "plain",
        } satisfies TextSectionBlockType["data"];
      } else {
        throw new Response("Unsupported block type for add", { status: 400 });
      }

      const addCommand = commandBuilder.addBlock(
        rawBlockType as BlockType,
        addBlockVersion,
        initialData,
      );

      const addResult = await siteCmsPageService.applyPageCommand(addCommand);

      if (addResult.status === "conflict") {
        return {
          status: "conflict" as const,
          conflictMessage:
            "Block could not be added — the page may have changed.",
          editorModel: addResult.currentEditorModel,
        };
      }

      return redirect(`/admin/pages/${pageKey}`);
    }

    throw new Response(`Unknown intent: ${String(intent)}`, { status: 400 });
  } finally {
    await uploadResult.discardImage();
  }
}

async function persistHeroUploadedImage(
  fileEntry: FormDataEntryValue | null,
  upload: {
    persistImage(file: File): Promise<string>;
  },
): Promise<string | undefined> {
  if (!(fileEntry instanceof File) || fileEntry.size <= 0) {
    return undefined;
  }

  return upload.persistImage(fileEntry);
}

async function cleanupRemovedHeroImages({
  previousBlocks,
  nextBlocks,
}: {
  previousBlocks: readonly BlockInstance[];
  nextBlocks: readonly BlockInstance[];
}) {
  const removedImageIds = getRemovedUploadedHeroImageIds(
    previousBlocks,
    nextBlocks,
  );

  if (removedImageIds.length === 0) {
    return;
  }

  await deleteCmsImagesIfUnreferenced({
    imageIds: removedImageIds,
    prisma,
  });
}

function getUploadedHeroImageId(blockData: unknown): string | null {
  const data = blockData as {
    image?: {
      kind?: string;
      imageId?: string;
    };
  };

  if (data.image?.kind !== "uploaded" || !data.image.imageId) {
    return null;
  }

  return data.image.imageId;
}

function resolveBlock(
  blocks: BlockInstance[],
  ref: BlockRef,
): BlockInstance | undefined {
  switch (ref.kind) {
    case "definition-key":
      return blocks.find((b) => b.definitionKey === ref.definitionKey);
    case "page-block-id":
      return blocks.find((b) => b.pageBlockId === ref.pageBlockId);
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
type BlockConflictActionData = Extract<
  PageEditorActionData,
  { status: "block-conflict" }
>;
type BlockValidationActionData = Extract<
  PageEditorActionData,
  { status: "block-validation-error" }
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
  const { editorModel, linkTargetRegistry } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const conflictAction = hasActionStatus(actionData, "conflict")
    ? (actionData as ConflictActionData)
    : null;
  const blockConflictAction = hasActionStatus(actionData, "block-conflict")
    ? (actionData as BlockConflictActionData)
    : null;
  const blockValidationAction = hasActionStatus(
    actionData,
    "block-validation-error",
  )
    ? (actionData as BlockValidationActionData)
    : null;
  const displayEditorModel =
    conflictAction?.editorModel ??
    blockConflictAction?.editorModel ??
    blockValidationAction?.editorModel ??
    editorModel;
  const hasCustomActionData =
    conflictAction || blockConflictAction || blockValidationAction;
  const lastResult = hasCustomActionData
    ? null
    : ((actionData as SubmissionResult<string[]> | undefined) ?? null);
  const conflictMessage = conflictAction?.conflictMessage ?? null;

  const revision = displayEditorModel.status.revision;
  const commandBuilder = createPageCommandBuilder(
    displayEditorModel.pageKey,
    revision,
  );
  const pageRule = siteCmsCatalog.getPageRule(displayEditorModel.pageKey);
  const requiredLeadingCount = pageRule.requiredLeadingBlockTypes?.length ?? 0;
  const blocks = displayEditorModel.pageSnapshot.blocks;

  return (
    <main className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-4xl">Edit {displayEditorModel.pageKey}</h1>
        <p>{formatPageStatus(displayEditorModel.status)}</p>
        {displayEditorModel.diagnostics.map((diagnostic) => (
          <p
            key={`${diagnostic.code}-${diagnostic.message}`}
            className="text-destructive text-sm"
          >
            {diagnostic.message}
          </p>
        ))}
      </div>

      {conflictMessage ? (
        <p className="text-destructive text-sm">{conflictMessage}</p>
      ) : null}

      <PageMetaForm
        key={`${displayEditorModel.pageKey}-${displayEditorModel.status.revision ?? "default"}`}
        editorModel={displayEditorModel}
        lastResult={lastResult}
      />

      <section className="flex flex-col gap-4">
        <h2 className="text-2xl">Blocks</h2>
        {blocks.map((block, index) => {
          const definition = siteCmsCatalog.getBlockDefinition(block.type);

          if (!definition.editor) return null;

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

          const ctx: BlockEditorContext = {
            data: block.data,
            blockRef,
            commandBuilder,
            linkTargetRegistry,
            capabilities,
            formState:
              (definition.type === "hero" ||
                definition.type === "text-section") &&
              (blockValidationAction?.blockRef === serializedBlockRef ||
                blockConflictAction?.blockRef === serializedBlockRef)
                ? {
                    lastResult: blockValidationAction?.lastResult ?? null,
                    errorMessage: blockConflictAction?.conflictMessage ?? null,
                  }
                : undefined,
          };

          return (
            <div key={block.pageBlockId ?? `${block.type}-${index}`}>
              {definition.editor(ctx)}
            </div>
          );
        })}

        {pageRule.allowedBlockTypes
          .filter(
            (t) => !(pageRule.requiredLeadingBlockTypes ?? []).includes(t),
          )
          .filter((t) => t === "text-section")
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
                + Add text section
              </Button>
            </form>
          ))}
      </section>
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
