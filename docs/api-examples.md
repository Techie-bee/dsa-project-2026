# Build 4 API examples

Start the server with `npm start`. The examples assume it is listening on
`http://localhost:3000`. Replace the `EVENT_ID`, `TIER_ID`, and `REFERENCE`
placeholders with the IDs and reference returned by the preceding calls.

## 1. Create an event

```sh
curl -X POST http://localhost:3000/api/events \
  -H 'content-type: application/json' \
  -H 'x-user-id: organizer-1' \
  -d '{
    "title": "Lagos Tech Meetup",
    "city": "Lagos",
    "venue": "Yaba Hub",
    "startsAt": "2026-12-05T17:00:00Z"
  }'
```

## 2. Add a ticket tier

```sh
curl -X POST http://localhost:3000/api/events/EVENT_ID/tiers \
  -H 'content-type: application/json' \
  -H 'x-user-id: organizer-1' \
  -d '{
    "name": "General",
    "priceCents": 500000,
    "capacity": 100
  }'
```

## 3. Publish the event

```sh
curl -X POST http://localhost:3000/api/events/EVENT_ID/publish \
  -H 'x-user-id: organizer-1'
```

## 4. Search published events

```sh
curl 'http://localhost:3000/api/events?q=meetup&city=lagos&sortBy=date'
```

Supported query parameters are `q`, `city`, `from`, `to`, `maxPriceCents`,
`onlyAvailable` (`true` or `false`), and `sortBy` (`date`, `price`, or
`availability`).

## 5. Book tickets

```sh
curl -X POST http://localhost:3000/api/bookings \
  -H 'content-type: application/json' \
  -H 'x-user-id: attendee-1' \
  -d '{
    "tierId": "TIER_ID",
    "quantity": 2
  }'
```

## 6. Pay for a booking

The mock payment succeeds by default. To exercise a decline, include
`"decline": true`; the booking stays pending and can be retried.

```sh
curl -X POST http://localhost:3000/api/bookings/REFERENCE/pay \
  -H 'content-type: application/json' \
  -H 'x-user-id: attendee-1' \
  -d '{}'
```

## 7. Cancel an unpaid booking

```sh
curl -X POST http://localhost:3000/api/bookings/REFERENCE/cancel \
  -H 'x-user-id: attendee-1'
```
