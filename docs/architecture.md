# Architecture

## Layers

```mermaid
flowchart TD
  Routes --> Services
  Services --> DomainRules
  Services --> Repositories
  Repositories --> DataStore
```

- **Routes** may interpret HTTP requests and call services; they may not contain business rules or access storage directly.
- **Services** may coordinate domain rules and repositories; they may not handle HTTP details or depend on route handlers.
- **Domain rules** may enforce business invariants; they may not perform HTTP or persistence I/O.
- **Repositories** may read and write data; they may not make business decisions or call services/routes.
- **Data store** holds persisted data; it does not call application layers.

## Data model

```mermaid
erDiagram
  USERS ||--o{ EVENTS : organizes
  USERS ||--o{ BOOKINGS : makes
  EVENTS ||--|{ TICKET_TIERS : offers
  TICKET_TIERS ||--o{ BOOKINGS : fulfills

  USERS {
    string id PK
    string email
    string role
  }
  EVENTS {
    string id PK
    string organizer_id FK
    string title
    string city
    string venue
    datetime starts_at
    string status
  }
  TICKET_TIERS {
    string id PK
    string event_id FK
    string name
    integer price_cents
    integer capacity
  }
  BOOKINGS {
    string id PK
    string user_id FK
    string tier_id FK
    integer quantity
    integer amount_cents
    string status
    string reference
  }
```

## Booking life cycle

```mermaid
stateDiagram-v2
  [*] --> pending
  pending --> paid
  pending --> cancelled
  paid --> checked_in
  paid --> refunded
  paid --> cancelled
  cancelled --> [*]
  refunded --> [*]
  checked_in --> [*]
```
