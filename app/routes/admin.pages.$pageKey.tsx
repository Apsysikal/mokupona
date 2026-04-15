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
import { derivePageBanners } from "~/features/cms/admin-page-banners";
import type { BlockRef } from "~/features/cms/blocks/block-ref";
import {
  parseBlockRef,
  refByDefinitionKey,
  refByPageBlockId,
} from "~/features/cms/blocks/block-ref";
import {
  applyHeroBlockEditorValue,
  createHeroBlockEditorFormSchema,
} from "~/features/cms/blocks/hero/editor-schema";
import {
  applyImageBlockEditorValue,
  createImageBlockEditorFormSchema,
} from "~/features/cms/blocks/image/editor-schema";
import {
  createDefaultImageBlockData,
  type ImageBlockType,
} from "~/features/cms/blocks/image/model";
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
import { UnknownBlockTypeError } from "~/features/cms/catalog";
import {
  deleteCmsImagesIfUnreferenced,
  getRemovedUploadedHeroImageIds,
} from "~/features/cms/cms-image-lifecycle.server";
import {
  cmsDiagnosticCodes,
  getCmsDiagnosticIdentity,
  isRecoverableBlockDiagnosticCode,
} from "~/features/cms/diagnostics";
import {
  createPageCommandBuilder,
  type MutableBlockRef,
} from "~/features/cms/page-commands";
import type {
  Diagnostic,
  PageCommand,
} from "~/features/cms/page-service.server";
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

function parseBlockRefInput(raw: FormDataEntryValue | null): BlockRef | null {
  if (typeof raw !== "string") return null;
  return parseBlockRef(raw);
}

function parseBaseRevision(raw: FormDataEntryValue | null): number | null {
  if (typeof raw !== "string" || raw === "") return null;
  const n = Number(raw);
  return Number.isInteger(n) && n >= 0 ? n : null;
}

function conflictMessageFromDiagnostics(
  diagnostics: readonly Diagnostic[],
  fallback: string,
): string {
  const staleWrite = diagnostics.find(
    (d) => d.code === cmsDiagnosticCodes.mutationStaleWrite,
  );
  return staleWrite ? staleWrite.message : fallback;
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
          conflictMessage: conflictMessageFromDiagnostics(
            result.diagnostics,
            "Page could not be saved — please refresh and try again.",
          ),
          editorModel: result.currentEditorModel,
        };
      }

      return redirect(`/admin/pages/${pageKey}`);
    }

    const baseRevision = parseBaseRevision(formData.get("baseRevision"));
    const commandBuilder = createPageCommandBuilder(pageKey, baseRevision);

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
      } else if (rawBlockType === "image" && addBlockVersion === 1) {
        initialData = {
          ...createDefaultImageBlockData(),
        } satisfies ImageBlockType["data"];
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
          conflictMessage: conflictMessageFromDiagnostics(
            addResult.diagnostics,
            "Block could not be added — the page may have changed.",
          ),
          editorModel: addResult.currentEditorModel,
        };
      }

      return redirect(`/admin/pages/${pageKey}`);
    }

    if (intent === "reset-page") {
      const command = commandBuilder.resetPage();
      const result = await siteCmsPageService.applyPageCommand(command);

      if (result.status === "conflict") {
        return {
          status: "conflict" as const,
          conflictMessage: conflictMessageFromDiagnostics(
            result.diagnostics,
            "Reset could not be applied — the page may have changed.",
          ),
          editorModel: result.currentEditorModel,
        };
      }

      return redirect(`/admin/pages/${pageKey}`);
    }

    // Remaining block commands (set-block-data, move, delete) all require blockRef
    const blockRef = parseBlockRefInput(formData.get("blockRef"));

    if (!blockRef) {
      throw new Response("Missing or invalid blockRef", { status: 400 });
    }

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
          typeof getUploadedCmsImageId
        >[0];
        const previousImageId = getUploadedCmsImageId(currentBlock.data);
        const nextImageId = getUploadedCmsImageId(nextData);

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
            conflictMessage: conflictMessageFromDiagnostics(
              heroResult.diagnostics,
              "Block could not be saved — please refresh and retry.",
            ),
            editorModel: heroResult.currentEditorModel,
          };
        }

        if (previousImageId && previousImageId !== nextImageId) {
          await cleanupRemovedCmsImages({
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
            conflictMessage: conflictMessageFromDiagnostics(
              textSectionResult.diagnostics,
              "Block could not be saved — please refresh and retry.",
            ),
            editorModel: textSectionResult.currentEditorModel,
          };
        }

        return redirect(`/admin/pages/${pageKey}`);
      }

      if (blockType === "image" && blockVersion === 1) {
        const imageSchema = createImageBlockEditorFormSchema();
        const imageSubmission = parseWithZod(formData, {
          schema: imageSchema,
        });

        if (imageSubmission.status !== "success" || !imageSubmission.value) {
          return {
            status: "block-validation-error" as const,
            blockRef: serializedBlockRef,
            editorModel: await siteCmsPageService.readEditorModel(pageKey),
            lastResult: imageSubmission.reply(),
          };
        }

        const currentEditorModel =
          await siteCmsPageService.readEditorModel(pageKey);
        const currentBlocks = currentEditorModel.pageSnapshot.blocks;
        const currentBlock = resolveBlock(currentBlocks, blockRef);
        if (!currentBlock || currentBlock.type !== "image") {
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
          imageSubmission.value.imageAction === "replace" &&
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
          imageSubmission.value.imageAction === "replace"
            ? await persistHeroUploadedImage(imageFileEntry, {
                persistImage: uploadResult.persistImage,
              })
            : undefined;
        if (
          imageSubmission.value.imageAction === "replace" &&
          !uploadedImageId
        ) {
          return {
            status: "block-conflict" as const,
            blockRef: serializedBlockRef,
            conflictMessage: "Please choose an image file before replacing.",
            editorModel: currentEditorModel,
          };
        }

        const imageCommand = commandBuilder.setBlockData(
          blockRef,
          "image",
          1,
          applyImageBlockEditorValue(
            currentBlock.data as ImageBlockType["data"],
            imageSubmission.value,
            { uploadedImageId },
          ),
        );
        const nextData = imageCommand.data as ImageBlockType["data"];
        const previousImageId = getUploadedCmsImageId(currentBlock.data);
        const nextImageId = getUploadedCmsImageId(nextData);

        const imageResult =
          await siteCmsPageService.applyPageCommand(imageCommand);

        if (imageResult.status === "conflict") {
          if (
            imageSubmission.value.imageAction === "replace" &&
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
            conflictMessage: conflictMessageFromDiagnostics(
              imageResult.diagnostics,
              "Block could not be saved — please refresh and retry.",
            ),
            editorModel: imageResult.currentEditorModel,
          };
        }

        if (previousImageId && previousImageId !== nextImageId) {
          await cleanupRemovedCmsImages({
            previousBlocks: currentBlocks,
            nextBlocks: imageResult.editorModel.pageSnapshot.blocks,
          });
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
          conflictMessage: conflictMessageFromDiagnostics(
            result.diagnostics,
            "Move could not be applied — the page may have changed.",
          ),
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
          conflictMessage: conflictMessageFromDiagnostics(
            result.diagnostics,
            "Delete could not be applied — the block may be in a fixed slot.",
          ),
          editorModel: result.currentEditorModel,
        };
      }

      await cleanupRemovedCmsImages({
        previousBlocks: currentEditorModel.pageSnapshot.blocks,
        nextBlocks: result.editorModel.pageSnapshot.blocks,
      });

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

async function cleanupRemovedCmsImages({
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

function getUploadedCmsImageId(blockData: unknown): string | null {
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
          const blockDiagnostic = displayEditorModel.diagnostics.find(
            (diagnostic) =>
              diagnostic.blockIndex === index &&
              isRecoverableBlockDiagnosticCode(diagnostic.code),
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
            linkTargetRegistry,
            capabilities,
            formState:
              (definition.type === "hero" ||
                definition.type === "text-section" ||
                definition.type === "image") &&
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
