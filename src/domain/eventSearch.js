import { DomainError } from "./errors.js";
import { mergeSort } from "./sorting.js";

export function summarizeEvent(event, tiers) {
  return {
    id: event.id,
    title: event.title,
    city: event.city,
    venue: event.venue,
    startsAt: event.startsAt,
    status: event.status,
    tierCount: tiers.length,
    minPriceCents: tiers.length ? Math.min(...tiers.map((tier) => tier.priceCents)) : null,
    seatsLeft: tiers.reduce((total, tier) => total + tier.available, 0),
  };
}

function requireSummaries(summaries) {
  if (!Array.isArray(summaries)) {
    throw new DomainError("summaries must be an array", "VALIDATION");
  }
}

function optionalText(value, field) {
  if (value === undefined) return undefined;
  if (typeof value !== 'string') {
    throw new DomainError(`${field} must be a string`, "VALIDATION");
  }
  return value.trim().toLowerCase();
}

function parseDate(value, field, includeEndOfDay = false) {
  if (typeof value !== 'string') {
    throw new DomainError(`${field} must be an ISO date`, "VALIDATION");
  }

  const dateOnly = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (dateOnly) {
    const [, year, month, day] = dateOnly.map(Number);
    const date = new Date(Date.UTC(year, month - 1, day));
    if (
      date.getUTCFullYear() !== year ||
      date.getUTCMonth() !== month - 1 ||
      date.getUTCDate() !== day
    ) {
      throw new DomainError(`${field} must be a valid ISO date`, "VALIDATION");
    }
    return date.getTime() + (includeEndOfDay ? 24 * 60 * 60 * 1000 - 1 : 0);
  }

  const isoTimestamp =
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/;
  const timestamp = Date.parse(value);
  if (!isoTimestamp.test(value) || Number.isNaN(timestamp)) {
    throw new DomainError(`${field} must be a valid ISO date`, "VALIDATION");
  }
  return timestamp;
}

export function filterEvents(summaries, criteria = {}) {
  requireSummaries(summaries);
  if (!criteria || typeof criteria !== 'object' || Array.isArray(criteria)) {
    throw new DomainError("criteria must be an object", "VALIDATION");
  }
  const { q, city, from, to, maxPriceCents, onlyAvailable } = criteria;
  const text = optionalText(q, "q");
  const wantedCity = optionalText(city, "city");
  const fromTime = from === undefined ? undefined : parseDate(from, "from");
  const toTime = to === undefined ? undefined : parseDate(to, "to", true);

  if (
    maxPriceCents !== undefined &&
    (!Number.isSafeInteger(maxPriceCents) || maxPriceCents < 0)
  ) {
    throw new DomainError(
      "maxPriceCents must be a non-negative whole number",
      "VALIDATION"
    );
  }
  if (onlyAvailable !== undefined && typeof onlyAvailable !== 'boolean') {
    throw new DomainError("onlyAvailable must be a boolean", "VALIDATION");
  }

  return summaries.filter((event) => {
    if (
      text &&
      !`${event.title} ${event.venue}`.toLowerCase().includes(text)
    ) {
      return false;
    }
    if (wantedCity && event.city.toLowerCase() !== wantedCity) return false;

    const startsAt = Date.parse(event.startsAt);
    if (fromTime !== undefined && startsAt < fromTime) return false;
    if (toTime !== undefined && startsAt > toTime) return false;

    if (
      maxPriceCents !== undefined &&
      (event.minPriceCents === null || event.minPriceCents > maxPriceCents)
    ) {
      return false;
    }
    if (onlyAvailable && event.seatsLeft <= 0) return false;
    return true;
  });
}

const compareText = (a, b) => (a < b ? -1 : a > b ? 1 : 0);
const byTitleThenId = (a, b) =>
  compareText(a.title, b.title) || compareText(a.id, b.id);

const sorters = {
  date: (a, b) =>
    Date.parse(a.startsAt) - Date.parse(b.startsAt) || byTitleThenId(a, b),
  price: (a, b) =>
    (a.minPriceCents ?? Infinity) - (b.minPriceCents ?? Infinity) ||
    byTitleThenId(a, b),
  availability: (a, b) =>
    b.seatsLeft - a.seatsLeft || byTitleThenId(a, b),
};

export function sortEvents(summaries, sortBy = "date") {
  requireSummaries(summaries);
  if (!Object.hasOwn(sorters, sortBy)) {
    throw new DomainError(`Unknown sort option: ${sortBy}`, "VALIDATION");
  }
  return mergeSort(summaries, sorters[sortBy]);
}

export function searchEvents(summaries, criteria = {}, sortBy = "date") {
  return sortEvents(filterEvents(summaries, criteria), sortBy);
}
