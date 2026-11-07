export class Router {
  #routes = [];

  add(method, path, handler) {
    if (typeof method !== "string" || method.trim() === "") {
      throw new TypeError("Route method must be a non-empty string");
    }
    if (typeof path !== "string" || !path.startsWith("/")) {
      throw new TypeError("Route path must start with /");
    }
    if (typeof handler !== "function") {
      throw new TypeError("Route handler must be a function");
    }

    this.#routes.push({
      method: method.toUpperCase(),
      segments: path.split("/").filter(Boolean),
      handler,
    });
    return this;
  }

  match(method, path) {
    let pathname;
    try {
      pathname = new URL(path, "http://localhost").pathname;
    } catch {
      return undefined;
    }

    const segments = pathname.split("/").filter(Boolean);
    for (const route of this.#routes) {
      if (route.method !== method.toUpperCase() || route.segments.length !== segments.length) {
        continue;
      }

      const params = {};
      let matches = true;
      for (let index = 0; index < segments.length; index += 1) {
        const expected = route.segments[index];
        let actual;
        try {
          actual = decodeURIComponent(segments[index]);
        } catch {
          matches = false;
          break;
        }

        if (expected.startsWith(":")) {
          params[expected.slice(1)] = actual;
        } else if (expected !== actual) {
          matches = false;
          break;
        }
      }

      if (matches) return { handler: route.handler, params };
    }
    return undefined;
  }
}

export function createRouter() {
  return new Router();
}
