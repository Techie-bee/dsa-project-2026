import { createServer } from "node:http";
import { readFile, realpath, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { DomainError } from "../domain/errors.js";
import { createRouter } from "./router.js";
import { registerApiRoutes } from "./apiRoutes.js";
import { createMemoryRepository } from "../repositories/memory.js";
import { createEventService } from "../services/eventService.js";
import { createBookingService } from "../services/bookingService.js";
import { createMockPaymentGateway } from "../lib/mockPaymentGateway.js";

const DEFAULT_PUBLIC_DIR = fileURLToPath(new URL("../../public/", import.meta.url));
const MIME_TYPES = new Map([
  [".css", "text/css; charset=utf-8"],
  [".gif", "image/gif"],
  [".html", "text/html; charset=utf-8"],
  [".ico", "image/x-icon"],
  [".jpeg", "image/jpeg"],
  [".jpg", "image/jpeg"],
  [".js", "text/javascript; charset=utf-8"],
  [".json", "application/json; charset=utf-8"],
  [".png", "image/png"],
  [".svg", "image/svg+xml"],
  [".txt", "text/plain; charset=utf-8"],
]);

function sendJson(response, statusCode, body, headOnly = false) {
  const serialized = JSON.stringify(body);
  response.writeHead(statusCode, {
    "content-type": "application/json; charset=utf-8",
    "content-length": Buffer.byteLength(serialized),
  });
  response.end(headOnly ? undefined : serialized);
}

function statusFor(error) {
  if (!(error instanceof DomainError)) return 500;
  if (
    error.code === "BAD_JSON" ||
    error.code === "BAD_REQUEST" ||
    error.code === "VALIDATION"
  ) {
    return 400;
  }
  if (error.code === "NOT_FOUND") return 404;
  if (error.code === "FORBIDDEN") return 403;
  if (error.code === "INVALID_TRANSITION") return 409;
  if (error.code === "PAYMENT_DECLINED") return 402;
  return 500;
}

function sendError(response, error, headOnly = false) {
  const knownError = error instanceof DomainError;
  const statusCode = statusFor(error);
  const code = knownError ? error.code : "INTERNAL_ERROR";
  const message = knownError ? error.message : "Internal server error";
  sendJson(response, statusCode, { error: { code, message } }, headOnly);
}

async function readJsonBody(request) {
  const chunks = [];
  for await (const chunk of request) chunks.push(chunk);
  const body = Buffer.concat(chunks).toString("utf8");
  if (body.length === 0) return undefined;

  try {
    return JSON.parse(body);
  } catch {
    throw new DomainError("Request body must contain valid JSON", "BAD_JSON");
  }
}

function isWithinDirectory(directory, file) {
  const relative = path.relative(directory, file);
  return relative === "" || (!relative.startsWith(`..${path.sep}`) && relative !== ".." && !path.isAbsolute(relative));
}

async function serveStatic(request, response, pathname, publicDir) {
  const headOnly = request.method === "HEAD";
  let decodedPath;
  try {
    decodedPath = decodeURIComponent(pathname);
  } catch {
    throw new DomainError("Invalid file path", "BAD_REQUEST");
  }
  if (decodedPath.includes("\0") || decodedPath.includes("\\")) {
    throw new DomainError("Invalid file path", "BAD_REQUEST");
  }

  const root = path.resolve(publicDir);
  let candidate = path.resolve(root, decodedPath === "/" ? "index.html" : `.${decodedPath}`);
  if (!isWithinDirectory(root, candidate)) {
    throw new DomainError("File not found", "NOT_FOUND");
  }

  try {
    const realRoot = await realpath(root);
    let realFile = await realpath(candidate);
    if (!isWithinDirectory(realRoot, realFile)) {
      throw new DomainError("File not found", "NOT_FOUND");
    }

    if ((await stat(realFile)).isDirectory()) {
      candidate = path.join(realFile, "index.html");
      realFile = await realpath(candidate);
      if (!isWithinDirectory(realRoot, realFile)) {
        throw new DomainError("File not found", "NOT_FOUND");
      }
    }

    const fileStats = await stat(realFile);
    if (!fileStats.isFile()) {
      throw new DomainError("File not found", "NOT_FOUND");
    }
    const contents = await readFile(realFile);
    response.writeHead(200, {
      "content-type":
        MIME_TYPES.get(path.extname(realFile).toLowerCase()) ?? "application/octet-stream",
      "content-length": contents.length,
    });
    response.end(headOnly ? undefined : contents);
  } catch (error) {
    if (error instanceof DomainError) throw error;
    if (error.code === "ENOENT" || error.code === "ENOTDIR") {
      throw new DomainError("File not found", "NOT_FOUND");
    }
    throw error;
  }
}

export function createApp({
  publicDir = DEFAULT_PUBLIC_DIR,
  repository = createMemoryRepository(),
  paymentGateway = createMockPaymentGateway(),
} = {}) {
  const router = createRouter();
  router.add("GET", "/health", ({ response }) => {
    sendJson(response, 200, { status: "ok" });
  });
  registerApiRoutes(router, {
    eventService: createEventService(repository),
    bookingService: createBookingService(repository, paymentGateway),
  });

  return async function app(request, response) {
    const headOnly = request.method === "HEAD";
    try {
      const url = new URL(request.url, "http://localhost");
      const hasJsonBody =
        request.method !== "GET" &&
        request.method !== "HEAD" &&
        request.headers["content-type"]?.split(";")[0].trim().toLowerCase() ===
          "application/json";
      const body = hasJsonBody ? await readJsonBody(request) : undefined;

      const route = router.match(request.method, url.pathname);
      if (route) {
        const routeResult = await route.handler({
          request,
          response,
          params: route.params,
          url,
        body,
        });
        if (routeResult && !response.headersSent) {
        sendJson(
          response,
          routeResult.statusCode ?? 200,
          routeResult.body,
          headOnly
        );
        }
        return;
      }

      if (url.pathname === "/api" || url.pathname.startsWith("/api/")) {
        throw new DomainError("API route not found", "NOT_FOUND");
      }
      if (request.method !== "GET" && request.method !== "HEAD") {
        throw new DomainError("Route not found", "NOT_FOUND");
      }
      await serveStatic(request, response, url.pathname, publicDir);
    } catch (error) {
      if (response.headersSent) {
        response.destroy();
        return;
      }
      sendError(response, error, headOnly);
    }
  };
}

export function createAppServer(options) {
  return createServer(createApp(options));
}
