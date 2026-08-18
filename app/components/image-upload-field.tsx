import { Cross2Icon } from "@radix-ui/react-icons";
import React, { useEffect, useRef, useState } from "react";

import {
  ErrorList,
  FieldDescription,
  fileFieldClassName,
  useFieldIds,
  type FieldProps,
  type ListOfErrors,
} from "./forms";
import { Input } from "./ui/input";
import { Label } from "./ui/label";

import { cn } from "~/lib/utils";

// Errors for individual files, either positional (aligned with the order the
// files were submitted in) or keyed by file name. Positional errors go stale as
// soon as the selection is edited, name-keyed ones survive removals.
export type FileErrors = ListOfErrors[] | Record<string, ListOfErrors>;

type ErrorScope = "all" | "positional" | "none";

function readFiles(input: HTMLInputElement | null): File[] {
  return input?.files ? Array.from(input.files) : [];
}

function toFileList(files: File[]): FileList | null {
  if (typeof DataTransfer === "undefined") return null;

  const transfer = new DataTransfer();
  for (const file of files) transfer.items.add(file);

  return transfer.files;
}

function fileKey(file: File, index: number) {
  return `${index}-${file.name}-${file.size}-${file.lastModified}`;
}

function formatFileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;

  const kilobytes = bytes / 1024;
  if (kilobytes < 1024) return `${Math.round(kilobytes)} KB`;

  return `${(kilobytes / 1024).toFixed(1)} MB`;
}

function errorsForFile(
  fileErrors: FileErrors | undefined,
  scope: ErrorScope,
  file: File,
  index: number,
): ListOfErrors {
  if (!fileErrors || scope === "all") return undefined;
  if (!Array.isArray(fileErrors)) return fileErrors[file.name];

  return scope === "positional" ? undefined : fileErrors[index];
}

function errorSignature(
  fileErrors: FileErrors | undefined,
  errors: ListOfErrors,
) {
  return JSON.stringify([fileErrors ?? null, errors ?? null]);
}

export function ImageUploadField({
  labelProps,
  inputProps,
  description,
  errors,
  fileErrors,
  className,
}: FieldProps & {
  inputProps: React.InputHTMLAttributes<HTMLInputElement>;
  fileErrors?: FileErrors;
}) {
  const { id, errorId, descriptionId, describedBy } = useFieldIds(
    inputProps.id,
    errors,
    description,
    inputProps["aria-describedby"],
  );

  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const focusAfterRemoval = useRef<number | null>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [previewUrls, setPreviewUrls] = useState<Map<File, string>>(new Map());

  // Errors describe the selection as it was submitted, so editing the selection
  // retires them rather than letting a red border drift onto another image.
  const signature = errorSignature(fileErrors, errors);
  const [lastSignature, setLastSignature] = useState(signature);
  const [errorScope, setErrorScope] = useState<ErrorScope>("none");

  if (signature !== lastSignature) {
    setLastSignature(signature);
    setErrorScope("none");
  }

  useEffect(() => {
    const restored = readFiles(inputRef.current);
    if (restored.length) setFiles(restored);
  }, []);

  // Keying the object URLs by file keeps a preview tied to its own image while
  // the effect catches up with a selection that just changed.
  useEffect(() => {
    const created = new Map<File, string>();

    for (const file of files) {
      if (file.type.startsWith("image/")) {
        created.set(file, URL.createObjectURL(file));
      }
    }

    setPreviewUrls(created);

    return () => {
      for (const url of created.values()) URL.revokeObjectURL(url);
    };
  }, [files]);

  useEffect(() => {
    const form = inputRef.current?.form;
    if (!form) return;

    const handleReset = () => setFiles([]);
    form.addEventListener("reset", handleReset);

    return () => form.removeEventListener("reset", handleReset);
  }, []);

  useEffect(() => {
    const removedIndex = focusAfterRemoval.current;
    if (removedIndex === null) return;

    focusAfterRemoval.current = null;

    const removeButtons = listRef.current?.querySelectorAll<HTMLButtonElement>(
      "button[data-remove-file]",
    );
    const nextButton = removeButtons?.length
      ? removeButtons[Math.min(removedIndex, removeButtons.length - 1)]
      : undefined;

    (nextButton ?? inputRef.current)?.focus();
  }, [files]);

  function handleChange(event: React.ChangeEvent<HTMLInputElement>) {
    setErrorScope("all");
    setFiles(readFiles(event.currentTarget));
    inputProps.onChange?.(event);
  }

  function handleRemove(index: number) {
    const input = inputRef.current;
    const remaining = files.filter((_, fileIndex) => fileIndex !== index);

    if (input) {
      const fileList = toFileList(remaining);
      if (fileList) {
        input.files = fileList;
      } else {
        input.value = "";
      }
    }

    focusAfterRemoval.current = index;
    setErrorScope((scope) => (scope === "all" ? scope : "positional"));
    setFiles(input ? readFiles(input) : remaining);
  }

  // A file field's own error is about the file it holds, so a lone selection
  // gets the same treatment as an explicitly reported per-file failure. It
  // tracks the message under the input, stale or not, rather than
  // contradicting it.
  const selectionInvalid =
    !inputProps.multiple &&
    files.length === 1 &&
    Boolean(errors?.filter(Boolean).length);

  // Per-file messages live with the field's own errors rather than on the
  // thumbnail, which only carries the red frame. They name their file, since
  // the tile is too small to.
  const fileErrorEntries = files.flatMap((file, index) => {
    const messages =
      errorsForFile(fileErrors, errorScope, file, index)?.filter(Boolean) ?? [];

    return messages.map((message, messageIndex) => ({
      key: `${index}-${messageIndex}`,
      elementId: `${id}-file-error-${index}-${messageIndex}`,
      index,
      file,
      message: message as string,
    }));
  });

  const fileErrorsId = fileErrorEntries.length
    ? `${id}-file-errors`
    : undefined;
  const inputDescribedBy =
    [describedBy, fileErrorsId].filter(Boolean).join(" ") || undefined;

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <Label htmlFor={id} {...labelProps} />
      <FieldDescription id={descriptionId}>{description}</FieldDescription>

      {files.length ? (
        <ul
          ref={listRef}
          aria-label="Selected images"
          className="flex gap-3 overflow-x-auto p-0.5"
        >
          {files.map((file, index) => {
            const url = previewUrls.get(file);
            const entries = fileErrorEntries.filter(
              (entry) => entry.index === index,
            );
            const invalid = entries.length > 0 || selectionInvalid;

            return (
              <li
                key={fileKey(file, index)}
                title={file.name}
                data-invalid={invalid ? "" : undefined}
                className="relative shrink-0"
              >
                {url ? (
                  <img
                    src={url}
                    alt=""
                    className={cn(
                      "size-24 rounded-lg border object-cover",
                      invalid
                        ? "border-destructive-light ring-destructive-light ring-2"
                        : "border-foreground/15",
                    )}
                  />
                ) : (
                  <div
                    className={cn(
                      "bg-foreground/5 text-foreground/50 flex size-24 items-center justify-center rounded-lg border px-2 text-center text-xs",
                      invalid
                        ? "border-destructive-light ring-destructive-light ring-2"
                        : "border-foreground/15",
                    )}
                  >
                    {formatFileSize(file.size)}
                  </div>
                )}

                <button
                  type="button"
                  data-remove-file=""
                  onClick={() => handleRemove(index)}
                  aria-label={`Remove ${file.name}`}
                  aria-describedby={
                    entries.map((entry) => entry.elementId).join(" ") ||
                    undefined
                  }
                  className="bg-background/80 text-foreground hover:bg-destructive hover:text-destructive-foreground focus-visible:ring-ring absolute top-1 right-1 flex size-6 items-center justify-center rounded-full transition-colors focus-visible:ring-2 focus-visible:outline-hidden"
                >
                  <Cross2Icon aria-hidden className="size-3.5" />
                </button>
              </li>
            );
          })}
        </ul>
      ) : null}

      <Input
        {...inputProps}
        ref={inputRef}
        id={id}
        type="file"
        onChange={handleChange}
        aria-invalid={errorId || fileErrorsId ? true : undefined}
        aria-describedby={inputDescribedBy}
        className={cn(fileFieldClassName, inputProps.className)}
      />

      {errorId ? <ErrorList id={errorId} errors={errors} /> : null}

      {fileErrorsId ? (
        <ul id={fileErrorsId} className="flex flex-col gap-1">
          {fileErrorEntries.map((entry) => (
            <li
              key={entry.key}
              id={entry.elementId}
              className="text-destructive-light text-sm"
            >
              {entry.file.name}: {entry.message}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
