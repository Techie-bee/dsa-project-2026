import { DomainError } from "../domain/errors.js";

function requireUserId(request) {
  const userId = request.headers["x-user-id"];
  if (typeof userId !== "string" || userId.trim() === "") {
    throw new DomainError("x-user-id header is required", "VALIDATION");
  }
  return userId.trim();
}

function parseIntegerQuery(value, field) {
  if (value === undefined) return undefined;
  if (!/^\d+$/.test(value)) {
    throw new DomainError(`${field} must be a whole number`, "VALIDATION");
  }
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed)) {
    throw new DomainError(`${field} must be a safe whole number`, "VALIDATION");
  }
  return parsed;
}

function parseBooleanQuery(value, field) {
  if (value === undefined) return undefined;
  if (value === "true") return true;
  if (value === "false") return false;
  throw new DomainError(`${field} must be true or false`, "VALIDATION");
}

function result(statusCode, body) {
  return { statusCode, body };
}

export function registerApiRoutes(router, { eventService, bookingService }) {
  router.add("POST", "/api/events", async ({ request, body }) =>
    result(201, await eventService.createEvent(requireUserId(request), body))
  );

  router.add("POST", "/api/events/:id/tiers", async ({ request, params, body }) =>
    result(201, await eventService.addTier(requireUserId(request), params.id, body))
  );

  router.add("POST", "/api/events/:id/publish", async ({ request, params }) =>
    result(200, await eventService.publishEvent(requireUserId(request), params.id))
  );

  router.add("GET", "/api/events", async ({ url }) => {
    const criteria = {
      q: url.searchParams.get("q") ?? undefined,
      city: url.searchParams.get("city") ?? undefined,
      from: url.searchParams.get("from") ?? undefined,
      to: url.searchParams.get("to") ?? undefined,
      maxPriceCents: parseIntegerQuery(
        url.searchParams.get("maxPriceCents") ?? undefined,
        "maxPriceCents"
      ),
      onlyAvailable: parseBooleanQuery(
        url.searchParams.get("onlyAvailable") ?? undefined,
        "onlyAvailable"
      ),
    };
    const sortBy = url.searchParams.get("sortBy") ?? "date";
    return result(200, await eventService.searchEvents(criteria, sortBy));
  });

  router.add("POST", "/api/bookings", async ({ request, body }) =>
    result(201, await bookingService.createBooking(requireUserId(request), body))
  );

  router.add(
    "POST",
    "/api/bookings/:reference/pay",
    async ({ request, params, body }) =>
      result(
        200,
        await bookingService.pay(
          requireUserId(request),
          params.reference,
          body ?? {}
        )
      )
  );

  router.add("POST", "/api/bookings/:reference/cancel", async ({ request, params }) =>
    result(
      200,
      await bookingService.cancel(requireUserId(request), params.reference)
    )
  );
}
