import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createRouter } from "../src/http/router.js";

describe("Router", () => {
  it("matches the method and path and extracts decoded parameters", () => {
    const handler = () => {};
    const router = createRouter();
    router.add("GET", "/events/:eventId/bookings/:reference", handler);

    const match = router.match(
      "get",
      "/events/event-42/bookings/REF%20123?include=details"
    );
    assert.equal(match.handler, handler);
    assert.deepEqual(match.params, {
      eventId: "event-42",
      reference: "REF 123",
    });
  });

  it("does not match a different method or path shape", () => {
    const router = createRouter();
    router.add("GET", "/events/:eventId", () => {});

    assert.equal(router.match("POST", "/events/42"), undefined);
    assert.equal(router.match("GET", "/events/42/tickets"), undefined);
  });
});
