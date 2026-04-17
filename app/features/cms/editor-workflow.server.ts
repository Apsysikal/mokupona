import type { SubmissionResult } from "@conform-to/react";
import { parseWithZod } from "@conform-to/zod/v4";
import { z } from "zod";

import {
  heroBlockEditor,
  imageBlockEditor,
  textSectionBlockEditor,
  type BlockEditor,
} from "./blocks/block-editor";
import type { BlockRef } from "./blocks/block-ref";
import { parseBlockRef, type PageBlockIdRef } from "./blocks/block-ref";
import {
  createDefaultImageBlockData,
  type ImageBlockType,
} from "./blocks/image/model";
import type { TextSectionBlockType } from "./blocks/text-section/model";
import type { BlockType } from "./blocks/types";
import type {
  BlockInstance,
  CmsCatalog,
  PageKey,
} from "./catalog";
import {
  type CmsImageLifecyclePrisma,
  discardOrphanedUploadedImage,
  reconcileCmsImageLifecycle,
} from "./cms-image-lifecycle.server";
import { cmsDiagnosticCodes } from "./diagnostics";
import type { LinkTargetRegistry } from "./link-targets";
import {
  createPageCommandBuilder,
  type MutableBlockRef,
  type PageCommand,
} from "./page-commands";
import type { EditorModel, CmsPageService, Diagnostic } from "./page-service.server";

const MAX_IMAGE_SIZE_BYTES = 1024 * 1024 * 3;

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

type BlockEditors = {
  hero: BlockEditor<unknown, unknown>;
  image: BlockEditor<unknown, unknown>;
  "text-section": BlockEditor<unknown, unknown>;
};

export type CmsEditorWorkflow = {
  loadEditor(pageKey: PageKey): Promise<{
    editorModel: EditorModel;
    linkTargets: LinkTargetRegistry;
    blockSchemas: Record<string, z.ZodType<unknown>>;
  }>;
  mutateFromForm(input: {
    pageKey: PageKey;
    baseRevision: number | null;
    formData: FormData;
    upload: {
      persistImage(file: File): Promise<string>;
    };
  }): Promise<
    | {
        status: "saved";
        editorModel: EditorModel;
        materialization: "created" | "updated" | "reset";
      }
    | {
        status: "validation-error";
        blockRef?: string;
        lastResult: SubmissionResult<string[]>;
        editorModel: EditorModel;
      }
    | { status: "conflict"; message: string; blockRef?: string; editorModel: EditorModel }
  >;
};

function parseBlockRefInput(raw: FormDataEntryValue | null): BlockRef | null {
  if (typeof raw !== "string") return null;
  return parseBlockRef(raw);
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

function createBlockEditors(linkTargets: LinkTargetRegistry): BlockEditors {
  return {
    hero: heroBlockEditor({ linkTargetRegistry: linkTargets }),
    image: imageBlockEditor(),
    "text-section": textSectionBlockEditor(),
  };
}

async function persistUploadedImage(
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

export function createCmsEditorWorkflow({
  pageService,
  catalog,
  linkTargets,
  prisma,
}: {
  pageService: CmsPageService;
  catalog: CmsCatalog;
  linkTargets: LinkTargetRegistry;
  prisma: CmsImageLifecyclePrisma;
}): CmsEditorWorkflow {
  const blockEditors = createBlockEditors(linkTargets);

  return {
    async loadEditor(pageKey) {
      return {
        editorModel: await pageService.readEditorModel(pageKey),
        linkTargets,
        blockSchemas: Object.fromEntries(
          Object.entries(blockEditors).map(([type, editor]) => [type, editor.schema]),
        ),
      };
    },
    async mutateFromForm({ pageKey, baseRevision, formData, upload }) {
      const intent = formData.get("intent");

      if (!intent || intent === "set-page-meta") {
        const submission = parseWithZod(formData, { schema: PageMetaSchema });

        if (submission.status !== "success" || !submission.value) {
          return {
            status: "validation-error" as const,
            lastResult: submission.reply(),
            editorModel: await pageService.readEditorModel(pageKey),
          };
        }

        const command: PageCommand = {
          type: "set-page-meta",
          pageKey,
          baseRevision: submission.value.revision,
          title: submission.value.title,
          description: submission.value.description,
        };

        const result = await pageService.applyPageCommand(command);
        if (result.status === "conflict") {
          return {
            status: "conflict" as const,
            message: conflictMessageFromDiagnostics(
              result.diagnostics,
              "Page could not be saved — please refresh and try again.",
            ),
            editorModel: result.currentEditorModel,
          };
        }

        return {
          status: "saved" as const,
          materialization: result.materialization,
          editorModel: result.editorModel,
        };
      }

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

        const addResult = await pageService.applyPageCommand(addCommand);
        if (addResult.status === "conflict") {
          return {
            status: "conflict" as const,
            message: conflictMessageFromDiagnostics(
              addResult.diagnostics,
              "Block could not be added — the page may have changed.",
            ),
            editorModel: addResult.currentEditorModel,
          };
        }

        return {
          status: "saved" as const,
          materialization: addResult.materialization,
          editorModel: addResult.editorModel,
        };
      }

      if (intent === "reset-page") {
        const command = commandBuilder.resetPage();
        const result = await pageService.applyPageCommand(command);

        if (result.status === "conflict") {
          return {
            status: "conflict" as const,
            message: conflictMessageFromDiagnostics(
              result.diagnostics,
              "Reset could not be applied — the page may have changed.",
            ),
            editorModel: result.currentEditorModel,
          };
        }

        return {
          status: "saved" as const,
          materialization: result.materialization,
          editorModel: result.editorModel,
        };
      }

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
        const editor = blockEditors[blockType as keyof BlockEditors];

        if (!editor) {
          throw new Response("Unsupported block editor payload", { status: 400 });
        }

        const submission = parseWithZod(formData, { schema: editor.schema });
        if (submission.status !== "success" || !submission.value) {
          return {
            status: "validation-error" as const,
            blockRef: serializedBlockRef,
            editorModel: await pageService.readEditorModel(pageKey),
            lastResult: submission.reply(),
          };
        }

        const currentEditorModel = await pageService.readEditorModel(pageKey);
        const currentBlocks = currentEditorModel.pageSnapshot.blocks;
        const currentBlock = resolveBlock(currentBlocks, blockRef);
        if (!currentBlock || currentBlock.type !== blockType) {
          return {
            status: "conflict" as const,
            blockRef: serializedBlockRef,
            message:
              "Block could not be saved — the editor has been refreshed with the current block.",
            editorModel: currentEditorModel,
          };
        }

        const formValue = submission.value as { imageAction?: string };
        const imageFileEntry = formData.get("imageFile");

        if (
          formValue.imageAction === "replace" &&
          (!(imageFileEntry instanceof File) || imageFileEntry.size <= 0)
        ) {
          return {
            status: "conflict" as const,
            blockRef: serializedBlockRef,
            message: "Please choose an image file before replacing.",
            editorModel: currentEditorModel,
          };
        }

        if (
          imageFileEntry instanceof File &&
          imageFileEntry.size > MAX_IMAGE_SIZE_BYTES
        ) {
          return {
            status: "conflict" as const,
            blockRef: serializedBlockRef,
            message: "File cannot be greater than 3MB",
            editorModel: currentEditorModel,
          };
        }

        const uploadedImageId =
          formValue.imageAction === "replace"
            ? await persistUploadedImage(imageFileEntry, upload)
            : undefined;

        if (formValue.imageAction === "replace" && !uploadedImageId) {
          return {
            status: "conflict" as const,
            blockRef: serializedBlockRef,
            message: "Please choose an image file before replacing.",
            editorModel: currentEditorModel,
          };
        }

        const nextBlockData = editor.apply(currentBlock.data, submission.value, {
          uploadedImageId,
        });

        const command = commandBuilder.setBlockData(
          blockRef,
          blockType as BlockType,
          blockVersion,
          nextBlockData,
        );

        const result = await pageService.applyPageCommand(command);
        if (result.status === "conflict") {
          if (formValue.imageAction === "replace" && uploadedImageId) {
            await discardOrphanedUploadedImage({
              imageId: uploadedImageId,
              prisma,
            });
          }
          return {
            status: "conflict" as const,
            blockRef: serializedBlockRef,
            message: conflictMessageFromDiagnostics(
              result.diagnostics,
              "Block could not be saved — please refresh and retry.",
            ),
            editorModel: result.currentEditorModel,
          };
        }

        await reconcileCmsImageLifecycle({
          previousBlocks: currentBlocks,
          nextBlocks: result.editorModel.pageSnapshot.blocks,
          prisma,
          catalog,
        });

        return {
          status: "saved" as const,
          materialization: result.materialization,
          editorModel: result.editorModel,
        };
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

        const result = await pageService.applyPageCommand(command);
        if (result.status === "conflict") {
          return {
            status: "conflict" as const,
            message: conflictMessageFromDiagnostics(
              result.diagnostics,
              "Move could not be applied — the page may have changed.",
            ),
            editorModel: result.currentEditorModel,
          };
        }

        return {
          status: "saved" as const,
          materialization: result.materialization,
          editorModel: result.editorModel,
        };
      }

      if (intent === "delete-block") {
        if (blockRef.kind !== "page-block-id") {
          throw new Response("delete command requires a page-block-id ref", {
            status: 400,
          });
        }

        const currentEditorModel = await pageService.readEditorModel(pageKey);
        const mutableRef: PageBlockIdRef = blockRef;
        const command = commandBuilder.deleteBlock(mutableRef);
        const result = await pageService.applyPageCommand(command);

        if (result.status === "conflict") {
          return {
            status: "conflict" as const,
            message: conflictMessageFromDiagnostics(
              result.diagnostics,
              "Delete could not be applied — the block may be in a fixed slot.",
            ),
            editorModel: result.currentEditorModel,
          };
        }

        await reconcileCmsImageLifecycle({
          previousBlocks: currentEditorModel.pageSnapshot.blocks,
          nextBlocks: result.editorModel.pageSnapshot.blocks,
          prisma,
          catalog,
        });

        return {
          status: "saved" as const,
          materialization: result.materialization,
          editorModel: result.editorModel,
        };
      }

      throw new Response(`Unknown intent: ${String(intent)}`, { status: 400 });
    },
  };
}
