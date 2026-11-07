import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { createAppServer } from "../src/http/app.js";

let server;
let baseUrl;
const charges = [];

before(async () => {
  server = createAppServer({
    paymentGateway: {
      async charge(request) {
        charges.push(request);
        return request.decline
          ? { success: false, code: "PAYMENT_DECLINED" }
          : { success: true };
      },
    },
  });
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  if (server?.listening) {
    await new Promise((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  }
});

async function api(path, { method = "GET", userId, body } = {}) {
  const headers = {};
  if (userId) headers["x-user-id"] = userId;
  if (body !== undefined) headers["content-type"] = "application/json";
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await response.text();
  return {
    status: response.status,
    body: text ? JSON.parse(text) : undefined,
  };
}

describe("Build 4 REST API", () => {
  it("creates, publishes, searches, books, pays, and cancels through HTTP", async () => {
    charges.length = 0;
    const created = await api("/api/events", {
      method: "POST",
      userId: "organizer-1",
      body: {
        title: "Lagos Tech Meetup",
        city: "Lagos",
        venue: "Yaba Hub",
        startsAt: "2026-12-05T17:00:00Z",
      },
    });
    assert.equal(created.status, 201);
    assert.equal(created.body.status, "draft");

    const tierResult = await api(`/api/events/${created.body.id}/tiers`, {
      method: "POST",
      userId: "organizer-1",
      body: { name: "General", priceCents: 500000, capacity: 3 },
    });
    assert.equal(tierResult.status, 201);
    assert.equal(tierResult.body.available, 3);

    const published = await api(`/api/events/${created.body.id}/publish`, {
      method: "POST",
      userId: "organizer-1",
    });
    assert.equal(published.status, 200);
    assert.equal(published.body.status, "published");

    const search = await api("/api/events?q=MEETUP&city=lagos&sortBy=price");
    assert.equal(search.status, 200);
    assert.equal(search.body.length, 1);
    assert.equal(search.body[0].id, created.body.id);

    const booked = await api("/api/bookings", {
      method: "POST",
      userId: "attendee-1",
      body: { tierId: tierResult.body.id, quantity: 2 },
    });
    assert.equal(booked.status, 201);
    assert.equal(booked.body.status, "pending");
    assert.equal(booked.body.amountCents, 1000000);

    const unauthorizedPay = await api(
      `/api/bookings/${booked.body.reference}/pay`,
      { method: "POST", userId: "attendee-2", body: {} },
    );
    assert.equal(unauthorizedPay.status, 403);
    assert.deepEqual(Object.keys(unauthorizedPay.body), ["error"]);
    assert.deepEqual(Object.keys(unauthorizedPay.body.error), ["code", "message"]);
    assert.equal(charges.length, 0);

    const declined = await api(`/api/bookings/${booked.body.reference}/pay`, {
      method: "POST",
      userId: "attendee-1",
      body: { decline: true, cardNumber: "must-not-reach-gateway" },
    });
    assert.equal(declined.status, 402);
    assert.equal(declined.body.error.code, "PAYMENT_DECLINED");
    assert.deepEqual(charges[0], { decline: true });

    const paid = await api(`/api/bookings/${booked.body.reference}/pay`, {
      method: "POST",
      userId: "attendee-1",
      body: {},
    });
    assert.equal(paid.status, 200);
    assert.equal(paid.body.status, "paid");

    const paidAgain = await api(`/api/bookings/${booked.body.reference}/pay`, {
      method: "POST",
      userId: "attendee-1",
      body: {},
    });
    assert.equal(paidAgain.status, 409);
    assert.equal(paidAgain.body.error.code, "INVALID_TRANSITION");
    assert.equal(charges.length, 2);

    const cancelPaid = await api(
      `/api/bookings/${booked.body.reference}/cancel`,
      { method: "POST", userId: "attendee-1" },
    );
    assert.equal(cancelPaid.status, 409);

    const secondBooking = await api("/api/bookings", {
      method: "POST",
      userId: "attendee-1",
      body: { tierId: tierResult.body.id, quantity: 1 },
    });
    assert.equal(secondBooking.status, 201);
    const cancelled = await api(
      `/api/bookings/${secondBooking.body.reference}/cancel`,
      { method: "POST", userId: "attendee-1" },
    );
    assert.equal(cancelled.status, 200);
    assert.equal(cancelled.body.status, "cancelled");
  });

  it("returns consistent errors for missing identity and unknown API routes", async () => {
    const missingIdentity = await api("/api/events", {
      method: "POST",
      body: {
        title: "Meetup",
        city: "Lagos",
        venue: "Hall",
        startsAt: "2026-12-05T17:00:00Z",
      },
    });
    assert.equal(missingIdentity.status, 400);
    assert.deepEqual(Object.keys(missingIdentity.body), ["error"]);
    assert.deepEqual(Object.keys(missingIdentity.body.error), ["code", "message"]);

    const missingRoute = await api("/api/unknown");
    assert.equal(missingRoute.status, 404);
    assert.deepEqual(Object.keys(missingRoute.body), ["error"]);
    assert.deepEqual(Object.keys(missingRoute.body.error), ["code", "message"]);
  });
});
