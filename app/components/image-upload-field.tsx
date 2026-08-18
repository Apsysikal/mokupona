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
  // tracks the message under the input, stale or not, rather than contradicting
  // it.
  const selectionInvalid =
    !inputProps.multiple &&
    files.length === 1 &&
    Boolean(errors?.filter(Boolean).length);

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <Label htmlFor={id} {...labelProps} />
      <FieldDescription id={descriptionId}>{description}</FieldDescription>

      {files.length ? (
        <ul
          ref={listRef}
          aria-label="Selected images"
          className="grid grid-cols-2 gap-3 sm:grid-cols-3"
        >
          {files.map((file, index) => {
            const url = previewUrls.get(file);
            const currentErrors = errorsForFile(
              fileErrors,
              errorScope,
              file,
              index,
            );
            const invalid =
              Boolean(currentErrors?.filter(Boolean).length) ||
              selectionInvalid;

            return (
              <li
                key={fileKey(file, index)}
                data-invalid={invalid ? "" : undefined}
                className={cn(
                  "bg-foreground/5 relative flex flex-col overflow-hidden rounded-lg border",
                  invalid ? "border-destructive-light" : "border-foreground/15",
                )}
              >
                {url ? (
                  <img
                    src={url}
                    alt=""
                    className="aspect-3/2 w-full object-cover"
                  />
                ) : (
                  <div className="text-foreground/50 flex aspect-3/2 w-full items-center justify-center px-2 text-center text-xs">
                    No preview available
                  </div>
                )}

                <button
                  type="button"
                  data-remove-file=""
                  onClick={() => handleRemove(index)}
                  aria-label={`Remove ${file.name}`}
                  className="bg-background/80 text-foreground hover:bg-destructive hover:text-destructive-foreground focus-visible:ring-ring absolute top-1.5 right-1.5 flex size-7 items-center justify-center rounded-full transition-colors focus-visible:ring-2 focus-visible:outline-hidden"
                >
                  <Cross2Icon aria-hidden className="size-4" />
                </button>

                <div className="flex flex-col gap-1 px-2 py-2">
                  <p
                    className="truncate text-xs font-semibold"
                    title={file.name}
                  >
                    {file.name}
                  </p>
                  <p className="text-foreground/65 text-xs">
                    {formatFileSize(file.size)}
                  </p>
                  <ErrorList errors={currentErrors} />
                </div>
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
        aria-invalid={errorId ? true : undefined}
        aria-describedby={describedBy}
        className={cn(fileFieldClassName, inputProps.className)}
      />

      {errorId ? <ErrorList id={errorId} errors={errors} /> : null}
    </div>
  );
}
