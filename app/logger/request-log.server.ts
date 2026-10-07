export interface CompletedRequest {
  method: string;
  pathname: string;
  pattern: string | undefined;
  statusCode: number;
  failed: boolean;
  shellMs: number;
}

export interface RequestLogEntry {
  level: "debug" | "info" | "warn" | "error";
  bindings: {
    pattern: string;
    statusCode: number;
    shellMs: number;
    isDataRequest?: true;
  };
}

const HEALTHCHECK_PATH = "/healthcheck";
const FILE_PATTERN = "file/:fileId";

function isExcluded({ method, pathname }: CompletedRequest) {
  return (
    pathname === HEALTHCHECK_PATH || (method === "HEAD" && pathname === "/")
  );
}

function levelFor(
  request: CompletedRequest,
  isDataRequest: boolean,
): RequestLogEntry["level"] {
  if (request.failed || request.statusCode >= 500) return "error";
  if (request.statusCode >= 400) return "warn";
  if (isDataRequest || request.pattern === FILE_PATTERN) return "debug";
  return "info";
}

export function describeCompletedRequest(
  request: CompletedRequest,
): RequestLogEntry | null {
  if (isExcluded(request)) return null;

  const isDataRequest = request.pathname.endsWith(".data");

  return {
    level: levelFor(request, isDataRequest),
    bindings: {
      pattern: request.pattern ?? "",
      statusCode: request.statusCode,
      shellMs: request.shellMs,
      ...(isDataRequest ? { isDataRequest: true as const } : {}),
    },
  };
}
