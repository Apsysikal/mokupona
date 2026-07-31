import "@testing-library/jest-dom/vitest";

import { beforeEach, vi } from "vitest";

import { loggerStub, resetLoggerStub } from "./logger-stub";

vi.mock("~/logger.server", () => ({ logger: loggerStub }));

beforeEach(resetLoggerStub);
