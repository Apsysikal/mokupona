import { useFetcher } from "react-router";

import { Button } from "./ui/button";

export function AdminDeleteButton({
  action,
  disabled = false,
}: {
  action: string;
  disabled?: boolean;
}) {
  const fetcher = useFetcher();
  const isDeleting = fetcher.state !== "idle";

  return (
    <fetcher.Form method="POST" action={action}>
      <Button
        type="submit"
        size="sm"
        variant="destructive-outline"
        disabled={disabled || isDeleting}
      >
        {isDeleting ? "Deleting…" : "Delete"}
      </Button>
    </fetcher.Form>
  );
}
