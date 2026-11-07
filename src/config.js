function parsePort(value) {
  if (value === undefined) return 3000;
  if (typeof value !== "string" || !/^\d+$/.test(value)) {
    throw new RangeError("PORT must be an integer from 1 to 65535");
  }
  const port = Number(value);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new RangeError("PORT must be an integer from 1 to 65535");
  }
  return port;
}

export const config = Object.freeze({
  port: parsePort(process.env.PORT),
});
