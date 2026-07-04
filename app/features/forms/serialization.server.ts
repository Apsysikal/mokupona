import { parseStoredFormSchema } from "./serialization";

import { logger } from "~/logger.server";

// The degraded path every reader of FormVersion.schema shares: a parse
// failure is a bug (all writers validate), so it is flagged loudly and the
// caller renders/derives nothing rather than something wrong.
export function parseStoredFormSchemaOrLog(version: {
  id: string;
  schema: unknown;
}) {
  const parsed = parseStoredFormSchema(version.schema);

  if (!parsed.success) {
    logger.error("Stored form schema failed to parse", {
      formVersion: version.id,
      error: parsed.error,
    });
    return null;
  }

  return parsed.data;
}
