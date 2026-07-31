import { parseStoredFormSchema } from "./serialization";

import { requestLogger } from "~/logger/request-context.server";

// The degraded path every reader of FormVersion.schema shares: a parse
// failure is a bug (all writers validate), so it is flagged loudly and the
// caller renders/derives nothing rather than something wrong.
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
