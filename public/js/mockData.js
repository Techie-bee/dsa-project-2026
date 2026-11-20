export const mockEvents = [
  {
    id: "evt-lagos-tech",
    title: "Lagos Tech Meetup",
    city: "Lagos",
    venue: "Yaba Hub",
    startsAt: "2026-12-05T17:00:00Z",
    status: "published",
    tiers: [
      { id: "tier-lagos-general", eventId: "evt-lagos-tech", name: "General", priceCents: 500000, capacity: 100, sold: 68, available: 32 },
      { id: "tier-lagos-vip", eventId: "evt-lagos-tech", name: "VIP", priceCents: 900000, capacity: 30, sold: 30, available: 0 },
    ],
  },
  {
    id: "evt-abuja-music",
    title: "Abuja Live Sessions",
    city: "Abuja",
    venue: "The Harbour",
    startsAt: "2026-12-12T19:30:00Z",
    status: "published",
    tiers: [
      { id: "tier-abuja-standard", eventId: "evt-abuja-music", name: "Standard", priceCents: 250000, capacity: 80, sold: 20, available: 60 },
      { id: "tier-abuja-front", eventId: "evt-abuja-music", name: "Front row", priceCents: 450000, capacity: 25, sold: 23, available: 2 },
    ],
  },
  {
    id: "evt-portharcourt-food",
    title: "Port Harcourt Food Festival",
    city: "Port Harcourt",
    venue: "City Pavilion",
    startsAt: "2027-01-09T13:00:00Z",
    status: "published",
    tiers: [
      { id: "tier-ph-regular", eventId: "evt-portharcourt-food", name: "Regular", priceCents: 150000, capacity: 200, sold: 200, available: 0 },
      { id: "tier-ph-family", eventId: "evt-portharcourt-food", name: "Family pass", priceCents: 600000, capacity: 40, sold: 10, available: 30 },
    ],
  },
];
