import { isRouteErrorResponse } from "react-router";

/**
 * Normalizes response/Error/unknown route errors into the shared inner
 * error markup. Routes keep their own surrounding layout (e.g. the admin
 * `<main>` wrapper) around this content.
 */
export function RouteErrorContent({ error }: { error: unknown }) {
  let heading = "Unknown Error";
  let message: string | null = null;

  if (isRouteErrorResponse(error)) {
    heading = `${error.status} ${error.statusText}`;
    message = error.data;
  } else if (error instanceof Error) {
    heading = "Error";
    message = error.message;
  }

  return (
    <div className="mx-auto mt-16 flex flex-col items-center gap-2 pt-4">
      <h1 className="font-semibold">{heading}</h1>
      {message != null ? <p>{message}</p> : null}
    </div>
  );
}
