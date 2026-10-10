import { http } from "msw/http";
import { setupServer } from "msw/node";
import { passthrough } from "msw/utils/passthrough";

const miscHandlers = [
  http.post(`${process.env.REMIX_DEV_HTTP_ORIGIN}/ping`, () => passthrough()),
];

const server = setupServer(...miscHandlers);

server.listen({ onUnhandledFrame: "bypass" });
console.info("🔶 Mock server running");

process.once("SIGINT", () => server.close());
process.once("SIGTERM", () => server.close());
