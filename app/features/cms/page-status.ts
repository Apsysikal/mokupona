export type Revision = number;

export type PageStatus =
  | {
      kind: "default-backed";
      revision: null;
    }
  | {
      kind: "persisted";
      revision: Revision;
    };

export function formatPageStatus(status: PageStatus): string {
  if (status.kind === "default-backed") {
    return "Default-backed Page";
  }

  return `Persisted Page - Revision ${status.revision}`;
}
