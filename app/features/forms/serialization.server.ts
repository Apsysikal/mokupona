import { parseStoredFormSchema } from "./serialization";

import { requestLogger } from "~/logger/request-context.server";

export function parseStoredFormSchemaOrLog(version: {
  id: string;
  schema: unknown;
}) {
  const parsed = parseStoredFormSchema(version.schema);

  if (!parsed.success) {
    requestLogger.error(
      {
        formVersion: version.id,
        error: parsed.error,
      },
      "Stored form schema failed to parse",
    );
    return null;
  }

  return parsed.data;
}
