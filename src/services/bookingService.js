import { DomainError } from "../domain/errors.js";
import { assertTransition } from "../domain/bookingStateMachine.js";
import { newId, newReference } from "../domain/ids.js";

function requireText(value, field) {
  if (typeof value !== "string" || value.trim() === "") {
    throw new DomainError(`${field} is required`, "VALIDATION");
  }
  return value.trim();
}

function requireObject(value, label) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new DomainError(`${label} must be an object`, "VALIDATION");
  }
}

export function createBookingService(repository, paymentGateway) {
  if (!repository) throw new TypeError("repository is required");
  if (!paymentGateway || typeof paymentGateway.charge !== "function") {
    throw new TypeError("paymentGateway.charge is required");
  }

  return {
    async createBooking(userId, input) {
      const ownerId = requireText(userId, "x-user-id");
      requireObject(input, "Booking details");
      const tierId = requireText(input.tierId, "tierId");
      const { quantity } = input;
      if (!Number.isSafeInteger(quantity) || quantity < 1 || quantity > 10) {
        throw new DomainError(
          "quantity must be a whole number between 1 and 10",
          "VALIDATION"
        );
      }

      const tier = await repository.getTier(tierId);
      if (!tier) throw new DomainError("Ticket tier not found", "NOT_FOUND");
      const event = await repository.getEvent(tier.eventId);
      if (!event) throw new DomainError("Event not found", "NOT_FOUND");
      if (event.status !== "published") {
        throw new DomainError("Event is not available for booking", "INVALID_STATE");
      }
      if (tier.available < quantity) {
        throw new DomainError("Not enough tickets available", "SOLD_OUT");
      }
      const amountCents = tier.priceCents * quantity;
      if (!Number.isSafeInteger(amountCents)) {
        throw new DomainError("Booking total exceeds the supported range", "VALIDATION");
      }

      let reference;
      do {
        reference = newReference();
      } while (await repository.getBookingByReference(reference));

      const booking = {
        id: newId(),
        reference,
        userId: ownerId,
        eventId: event.id,
        tierId: tier.id,
        quantity,
        amountCents,
        status: "pending",
        createdAt: new Date().toISOString(),
      };

      tier.available -= quantity;
      tier.sold += quantity;
      await repository.updateTier(tier);
      return repository.createBooking(booking);
    },

    async pay(userId, reference, input = {}) {
      const ownerId = requireText(userId, "x-user-id");
      const bookingReference = requireText(reference, "Booking reference");
      requireObject(input, "Payment details");
      const decline = input.decline ?? false;
      if (typeof decline !== "boolean") {
        throw new DomainError("decline must be a boolean", "VALIDATION");
      }

      const booking = await repository.getBookingByReference(bookingReference);
      if (!booking) throw new DomainError("Booking not found", "NOT_FOUND");
      if (booking.userId !== ownerId) {
        throw new DomainError("You do not own this booking", "FORBIDDEN");
      }
      assertTransition(booking.status, "paid");

      const result = await paymentGateway.charge({ decline });
      if (!result.success) {
        throw new DomainError("Payment was declined", "PAYMENT_DECLINED");
      }

      booking.status = "paid";
      await repository.updateBooking(booking);
      return booking;
    },

    async cancel(userId, reference) {
      const ownerId = requireText(userId, "x-user-id");
      const bookingReference = requireText(reference, "Booking reference");
      const booking = await repository.getBookingByReference(bookingReference);
      if (!booking) throw new DomainError("Booking not found", "NOT_FOUND");
      if (booking.userId !== ownerId) {
        throw new DomainError("You do not own this booking", "FORBIDDEN");
      }
      if (booking.status !== "pending") {
        throw new DomainError(
          "Only pending bookings can be cancelled at this time",
          "INVALID_TRANSITION"
        );
      }
      assertTransition(booking.status, "cancelled");

      const tier = await repository.getTier(booking.tierId);
      if (!tier) throw new DomainError("Ticket tier not found", "NOT_FOUND");
      tier.available += booking.quantity;
      tier.sold -= booking.quantity;
      booking.status = "cancelled";
      await repository.updateTier(tier);
      await repository.updateBooking(booking);
      return booking;
    },
  };
}
