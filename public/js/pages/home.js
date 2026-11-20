import { listEvents } from "../api.js";
import { el, formatPrice } from "../ui.js";

const app = document.querySelector("#app");

function formatDate(value) {
  return new Intl.DateTimeFormat("en-NG", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function labelControl(labelText, control) {
  const id = control.id;
  return el("div", { className: "field" }, [
    el("label", { for: id }, [labelText]),
    control,
  ]);
}

async function render() {
  app.replaceChildren();
  app.append(el("h1", { textContent: "Find your next event" }));

  const search = el("input", { id: "event-search", type: "search", placeholder: "Title, venue or city" });
  const city = el("select", { id: "city-filter" }, [
    el("option", { value: "" }, ["All cities"]),
  ]);
  const maxPrice = el("input", { id: "max-price", type: "number", min: "0", step: "100", placeholder: "Any price" });
  const sort = el("select", { id: "sort-events" }, [
    el("option", { value: "date" }, ["Date"]),
    el("option", { value: "price" }, ["Lowest price"]),
    el("option", { value: "availability" }, ["Most available"]),
  ]);

  const filters = el("form", { className: "filters", onsubmit: (event) => event.preventDefault() }, [
    labelControl("Search", search),
    labelControl("City", city),
    labelControl("Maximum price (₦)", maxPrice),
    labelControl("Sort by", sort),
  ]);
  app.append(filters);

  const results = el("section", { className: "event-grid", "aria-live": "polite" });
  app.append(results);

  try {
    const allEvents = await listEvents({ sortBy: "date" });
    const cities = [...new Set(allEvents.map((event) => event.city))].sort();
    for (const cityName of cities) {
      city.append(el("option", { value: cityName }, [cityName]));
    }
  } catch (error) {
    results.append(el("p", { className: "error", textContent: error.message }));
  }

  async function update() {
    results.replaceChildren();
    results.append(el("p", { className: "status", textContent: "Loading events…" }));
    try {
      const rawMax = maxPrice.value.trim();
      const events = await listEvents({
        q: search.value,
        city: city.value,
        maxPriceCents: rawMax === "" ? undefined : Math.round(Number(rawMax) * 100),
        sortBy: sort.value,
      });

      results.replaceChildren();
      if (events.length === 0) {
        results.append(el("p", { className: "empty", textContent: "No events match these filters." }));
        return;
      }

      for (const event of events) {
        const card = el("article", { className: "event-card" }, [
          el("div", { className: "event-card-body" }, [
            el("p", { className: "event-city", textContent: event.city }),
            el("h2", {}, [el("a", { href: `./event.html?id=${encodeURIComponent(event.id)}` }, [event.title])]),
            el("p", { className: "muted", textContent: event.venue }),
            el("p", { textContent: formatDate(event.startsAt) }),
          ]),
          el("footer", { className: "event-card-footer" }, [
            el("span", { textContent: event.minPriceCents === null ? "No tickets" : `From ${formatPrice(event.minPriceCents)}` }),
            el("a", { className: "button", href: `./event.html?id=${encodeURIComponent(event.id)}` }, ["View event"]),
          ]),
        ]);
        results.append(card);
      }
    } catch (error) {
      results.replaceChildren();
      results.append(el("p", { className: "error", textContent: error.message }));
    }
  }

  for (const control of [search, city, maxPrice, sort]) {
    control.addEventListener(control === search ? "input" : "change", update);
  }
  search.addEventListener("search", update);
  await update();
}

render();
