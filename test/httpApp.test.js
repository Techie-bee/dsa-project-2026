import assert from "node:assert/strict";
import { get, request, createServer } from "node:http";
import { describe, it } from "node:test";
import { createApp } from "../src/http/app.js";

function listen(server) {
  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      server.removeListener("error", reject);
      resolve(server.address());
    });
  });
}

function close(server) {
  return new Promise((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
}

function getResponse(port, pathname) {
  return new Promise((resolve, reject) => {
    get({ host: "127.0.0.1", port, path: pathname }, (response) => {
      const chunks = [];
      response.on("data", (chunk) => chunks.push(chunk));
      response.on("end", () => {
        resolve({
          statusCode: response.statusCode,
          headers: response.headers,
          body: Buffer.concat(chunks).toString("utf8"),
        });
      });
    }).on("error", reject);
  });
}

function postJson(port, pathname, body) {
  return new Promise((resolve, reject) => {
    const outgoing = request(
      {
        host: "127.0.0.1",
        port,
        path: pathname,
        method: "POST",
        headers: { "content-type": "application/json" },
      },
      (response) => {
        const chunks = [];
        response.on("data", (chunk) => chunks.push(chunk));
        response.on("end", () => {
          resolve({
            statusCode: response.statusCode,
            body: Buffer.concat(chunks).toString("utf8"),
          });
        });
      }
    );
    outgoing.on("error", reject);
    outgoing.end(body);
  });
}

describe("HTTP app", () => {
  it("answers a real GET /health request with JSON", async () => {
    const server = createServer(createApp());
    const address = await listen(server);
    try {
      const response = await getResponse(address.port, "/health");
      assert.equal(response.statusCode, 200);
      assert.match(response.headers["content-type"], /application\/json/);
      assert.deepEqual(JSON.parse(response.body), { status: "ok" });
    } finally {
      await close(server);
    }
  });

  it("returns a JSON 404 for an unknown API route", async () => {
    const server = createServer(createApp());
    const address = await listen(server);
    try {
      const response = await getResponse(address.port, "/api/missing");
      assert.equal(response.statusCode, 404);
      assert.deepEqual(JSON.parse(response.body), {
        error: { code: "NOT_FOUND", message: "API route not found" },
      });
    } finally {
      await close(server);
    }
  });

  it("returns a JSON 400 for malformed JSON without exposing a stack", async () => {
    const server = createServer(createApp());
    const address = await listen(server);
    try {
      const response = await postJson(address.port, "/api/events", "{");
      assert.equal(response.statusCode, 400);
      const body = JSON.parse(response.body);
      assert.deepEqual(Object.keys(body), ["error"]);
      assert.deepEqual(Object.keys(body.error), ["code", "message"]);
      assert.equal(body.error.code, "BAD_JSON");
      assert.equal(response.body.includes(" at "), false);
    } finally {
      await close(server);
    }
  });

  it("serves files from public and rejects a traversal path", async () => {
    const server = createServer(createApp());
    const address = await listen(server);
    try {
      const page = await getResponse(address.port, "/");
      assert.equal(page.statusCode, 200);
      assert.match(page.headers["content-type"], /text\/html/);

      const traversal = await getResponse(address.port, "/..%2fREADME.md");
      assert.equal(traversal.statusCode, 404);
      assert.equal(traversal.body.includes("capstone"), false);
    } finally {
      await close(server);
    }
  });
});
