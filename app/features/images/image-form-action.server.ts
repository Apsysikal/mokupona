import type { SubmissionResult } from "@conform-to/react";
import { parseWithZod } from "@conform-to/zod/v4";
import type { $ZodType, output } from "zod/v4/core";

import { parseImageFormData } from "./image-upload.server";

type ParsedImageFormOptions<Schema extends $ZodType, Result> = {
  fieldName: string;
  schema: Schema;
  /** raised by the gallery admin pages, which accept a multi-file selection */
  maxFiles?: number;
  onSuccess(args: {
    value: output<Schema>;
    formData: FormData;
  }): Result | Promise<Result>;
};

/**
 * Run the common multipart image-action lifecycle: parse the upload, report
 * upload and schema errors as a Conform result, and invoke the route-specific
 * write.
 *
 * The callback also receives the original FormData because update actions may
 * need to distinguish an omitted field from an explicitly submitted blank.
 */
export async function withParsedImageForm<Schema extends $ZodType, Result>(
  request: Request,
  {
    fieldName,
    schema,
    maxFiles,
    onSuccess,
  }: ParsedImageFormOptions<Schema, Result>,
): Promise<Result | SubmissionResult> {
  const uploadResult = await parseImageFormData(request, fieldName, maxFiles);

  if (!uploadResult.success) {
    return {
      status: "error",
      error: { [fieldName]: [uploadResult.uploadError] },
    } satisfies SubmissionResult;
  }

  const submission = parseWithZod(uploadResult.formData, { schema });

  if (submission.status !== "success") {
    return submission.reply();
  }

  return onSuccess({
    value: submission.value,
    formData: uploadResult.formData,
  });
}
