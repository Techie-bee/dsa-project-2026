import { createServer } from "node:http";
import { pathToFileURL } from "node:url";
import path from "node:path";
import { config } from "./config.js";
import { createApp } from "./http/app.js";
import { createSqliteRepository } from "./repositories/sqlite.js";

export function startServer(port = config.port) {
  const repository = createSqliteRepository();
  const server = createServer(createApp({ repository }));
  server.once("close", () => repository.close());
  server.listen(port, () => {
    console.log(`Event ticketing server listening on port ${port}`);
  });
  return server;
}

const invokedPath = process.argv[1] ? pathToFileURL(path.resolve(process.argv[1])).href : null;
if (invokedPath === import.meta.url) {
  startServer();
}
