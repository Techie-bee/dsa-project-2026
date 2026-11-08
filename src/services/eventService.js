import { DomainError } from "../domain/errors.js";
import { newId } from "../domain/ids.js";
import { searchEvents, summarizeEvent } from "../domain/eventSearch.js";

function requireText(value, field) {
  if (typeof value !== "string" || value.trim() === "") {
    throw new DomainError(`${field} is required`, "VALIDATION");
  }
  return value.trim();
}

function isValidIsoDate(value) {
  if (typeof value !== "string") return false;
  const datePart = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  if (!datePart) return false;
  const [, year, month, day] = datePart.map(Number);
  const calendarDate = new Date(Date.UTC(year, month - 1, day));
  if (
    calendarDate.getUTCFullYear() !== year ||
    calendarDate.getUTCMonth() !== month - 1 ||
    calendarDate.getUTCDate() !== day
  ) {
    return false;
  }

  const dateOnly = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (dateOnly) {
    return true;
  }
  return (
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(
      value
    ) && !Number.isNaN(Date.parse(value))
  );
}

function requireObject(value, label) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new DomainError(`${label} must be an object`, "VALIDATION");
  }
}

function requireUserId(userId) {
  return requireText(userId, "x-user-id");
}

async function getOwnedEvent(repository, eventId, organizerId) {
  const event = await repository.getEvent(eventId);
  if (!event) throw new DomainError("Event not found", "NOT_FOUND");
  if (event.organizerId !== organizerId) {
    throw new DomainError("You do not own this event", "FORBIDDEN");
  }
  return event;
}

export function createEventService(repository) {
  if (!repository) throw new TypeError("repository is required");

  return {
    async createEvent(organizerId, input) {
      requireUserId(organizerId);
      requireObject(input, "Event details");
      const title = requireText(input.title, "Title");
      const city = requireText(input.city, "City");
      const venue = requireText(input.venue, "Venue");
      if (!isValidIsoDate(input.startsAt)) {
        throw new DomainError("startsAt must be a valid ISO date", "VALIDATION");
      }

      const event = {
        id: newId(),
        organizerId,
        title,
        city,
        venue,
        startsAt: new Date(input.startsAt).toISOString(),
        status: "draft",
      };
      return repository.createEvent(event);
    },

    async addTier(organizerId, eventId, input) {
      requireUserId(organizerId);
      requireObject(input, "Tier details");
      const event = await getOwnedEvent(repository, eventId, organizerId);
      const name = requireText(input.name, "Tier name");
      const { capacity, priceCents } = input;
      if (!Number.isSafeInteger(capacity) || capacity < 1) {
        throw new DomainError("Capacity must be a positive whole number", "VALIDATION");
      }
      if (!Number.isSafeInteger(priceCents) || priceCents < 0) {
        throw new DomainError("priceCents must be a non-negative whole number", "VALIDATION");
      }

      return repository.createTier({
        id: newId(),
        eventId: event.id,
        name,
        capacity,
        available: capacity,
        sold: 0,
        priceCents,
      });
    },

    async publishEvent(organizerId, eventId) {
      requireUserId(organizerId);
      const event = await getOwnedEvent(repository, eventId, organizerId);
      const tiers = await repository.listTiersForEvent(eventId);
      if (tiers.length === 0) {
        throw new DomainError(
          "Add at least one ticket tier before publishing",
          "INVALID_STATE"
        );
      }
      event.status = "published";
      return repository.updateEvent(event);
    },

    async searchEvents(criteria = {}, sortBy = "date") {
      const events = await repository.listEvents();
      const published = events.filter((event) => event.status === "published");
      const summaries = await Promise.all(
        published.map(async (event) =>
          summarizeEvent(event, await repository.listTiersForEvent(event.id))
        )
      );
      return searchEvents(summaries, criteria, sortBy);
    },
  };
}
