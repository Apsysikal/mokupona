/**
 * By default, Remix will handle generating the HTTP Response for you.
 * You are free to delete this file if you'd like to, but if you ever want it revealed again, you can run `npx remix reveal` ✨
 * For more information, see https://remix.run/docs/en/main/file-conventions/entry.server
 */

import { PassThrough } from "node:stream";

import { createReadableStreamFromReadable } from "@react-router/node";
import { isbot } from "isbot";
import type { Logger } from "pino";
import { renderToPipeableStream } from "react-dom/server";
import type {
  EntryContext,
  HandleErrorFunction,
  RouterContextProvider,
  ServerInstrumentation,
} from "react-router";
import { isRouteErrorResponse, ServerRouter } from "react-router";

import { requestLoggerContext } from "~/features/auth/middleware.server";
import { describeCompletedRequest } from "~/logger/request-log.server";
import { logger } from "~/logger.server";

export const streamTimeout = 5000;

export const handleError: HandleErrorFunction = (
  error,
  { request, context },
) => {
  // React Router aborts requests as a matter of course — superseded client
  // navigations, closed streams — and every one of those lands here.
  if (request.signal.aborted) return;

  const log = context?.get(requestLoggerContext) ?? logger;

  log.error(
    {
      error:
        isRouteErrorResponse(error) && "error" in error ? error.error : error,
      path: new URL(request.url).pathname,
    },
    "Unhandled error while handling a request",
  );
};

// Observational only: a throw in here is swallowed by the router, so nothing
// load-bearing may live in it.
export const instrumentations: ServerInstrumentation[] = [
  {
    handler(handler) {
      handler.instrument({
        async request(callHandler, info) {
          const startedAt = performance.now();
          const result = await callHandler();

          const entry = describeCompletedRequest({
            method: info.request.method,
            pathname: new URL(info.request.url).pathname,
            pattern: result.meta?.pattern,
            statusCode: result.statusCode,
            failed: result.status === "error",
            shellMs: Math.round(performance.now() - startedAt),
          });
          if (!entry) return;

          const log = info.context?.get(requestLoggerContext) ?? logger;
          log[entry.level](entry.bindings, "Request completed");
        },
      });
    },
  },
];

export default function handleRequest(
  request: Request,
  responseStatusCode: number,
  responseHeaders: Headers,
  reactRouterContext: EntryContext,
  loadContext: RouterContextProvider,
) {
  // bots wait for the full document so crawlers see complete markup;
  // browsers stream as soon as the shell is ready
  const readyEvent = isbot(request.headers.get("user-agent"))
    ? "onAllReady"
    : "onShellReady";

  return streamDocument(
    request,
    responseStatusCode,
    responseHeaders,
    reactRouterContext,
    readyEvent,
    loadContext.get(requestLoggerContext),
  );
}

function streamDocument(
  request: Request,
  responseStatusCode: number,
  responseHeaders: Headers,
  reactRouterContext: EntryContext,
  readyEvent: "onAllReady" | "onShellReady",
  log: Logger,
) {
  const path = new URL(request.url).pathname;

  return new Promise((resolve, reject) => {
    let timeout: NodeJS.Timeout | undefined;
    let rendered = false;
    // the abort below is a deadline for the whole render, not just the shell,
    // so it may only be dropped once the body is done
    const renderDone = () => {
      rendered = true;
      clearTimeout(timeout);
    };

    const { abort, pipe } = renderToPipeableStream(
      <ServerRouter context={reactRouterContext} url={request.url} />,
      {
        [readyEvent]() {
          const body = new PassThrough();
          body.on("close", renderDone);

          responseHeaders.set("Content-Type", "text/html");

          resolve(
            new Response(createReadableStreamFromReadable(body), {
              headers: responseHeaders,
              status: responseStatusCode,
            }),
          );

          pipe(body);
        },
        onShellError(error: unknown) {
          renderDone();
          // the rejection reaches handleError, which logs the throwable; only
          // the "nothing was sent yet" part of it is news here
          log.warn({ path }, "Document shell render failed");
          reject(error);
        },
        onError(error: unknown) {
          log.warn({ error, path }, "Error while rendering the document");
          responseStatusCode = 500;
        },
      },
    );

    if (!rendered) {
      timeout = setTimeout(() => {
        log.warn({ path }, "Document render exceeded the stream timeout");
        abort();
      }, streamTimeout + 1000);
    }
  });
}
