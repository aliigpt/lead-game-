import http from "node:http";
import path from "node:path";
import fs from "node:fs";
import express from "express";
import { Server } from "@colyseus/core";
import { WebSocketTransport } from "@colyseus/ws-transport";
import { ArenaRoom } from "./ArenaRoom.js";
import { registerLeadRoutes } from "./leads.js";

const PORT = Number(process.env.PORT) || 2567;
const app = express();
app.set("trust proxy", true);
app.disable("x-powered-by");

app.get("/healthz", (_req, res) => res.send("ok"));
registerLeadRoutes(app, express);

// Serve the built client (vite build -> dist/) from the same origin, so one
// URL hosts both the game page and the WebSocket server.
const dist = path.resolve("dist");
if (fs.existsSync(dist)) {
  app.use(express.static(dist, { maxAge: "1h", index: false }));
  app.get("*", (_req, res) => res.sendFile(path.join(dist, "index.html")));
}

const server = http.createServer(app);
const gameServer = new Server({ transport: new WebSocketTransport({ server }) });
gameServer.define("arena", ArenaRoom);

gameServer.listen(PORT).then(() => {
  console.log(`AI Jargon Brawl listening on http://localhost:${PORT}`);
});
