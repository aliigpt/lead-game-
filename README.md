# Prompt Arena by @aliigpt

A free 3D multiplayer browser game that teaches AI prompting. It runs on phone and desktop with no download. Players share a link and land in the same match. Rounds last 2:30.

## Design

1. **Theme.** You're a prompt engineer inside an AI data center. The map is a circuit-board floor with GPU towers, server racks and a glowing AI core in the middle.
2. **Learn by collecting.** Five prompt pieces float around the map: **R**ole, **C**ontext, **T**ask, **F**ormat, **E**xample. Each pickup shows a one-line lesson. Collect all five and you've built a full prompt worth +250. Die and you lose the pieces you're holding.
3. **Enemies teach too.** Red "Hallucination" bots chase players. Destroying one (+50) shows a tip on spotting made-up AI answers. Tagging another player is worth +100, and the respawn screen shows a prompting tip.
4. **Controls.** Move, aim, shoot, plus one ability, **Regenerate**: a dash that heals 25 and gives a short shield. On desktop it's WASD, the mouse and Space. On a phone it's twin thumb sticks and a ⚡ button.
5. **Growth loop.** An email gate comes before the first match. Inside the match there's an "Invite" link, and the end-of-round screen recaps "What you learned" next to a "Follow @aliigpt" button.

## Stack

- **Client:** Three.js and Vite (`client/`)
- **Server:** Colyseus 0.16 over WebSockets, server-authoritative for hits, scoring, pickups and bots (`server/`)
- **Shared rules and map:** `shared/game.js`
- **All teaching copy and branding:** `shared/theme.js`. Edit this one file to change the lessons or the niche.

## Run locally

```bash
npm install
npm run dev          # game server :2567 + Vite :5173, open http://localhost:5173
```

To run it production-style, use `npm run build && npm start` and open http://localhost:2567.

## Deploy (public URL)

**Render (free):** push this repo to GitHub, then go to Render → New → Blueprint and pick the repo. `render.yaml` does the rest. You get a URL like `https://prompt-arena.onrender.com`. Free instances sleep after 15 minutes idle, so the first visit takes about 30s to wake. Use the Starter plan to keep it awake.

**Anything that runs Docker** (Fly.io, Railway, a VPS) also works. The `Dockerfile` is included and serves the game page and the WebSocket server on one port (`PORT`, default 2567).

## Leads (name + email)

- Every signup is appended to `DATA_DIR/leads.jsonl` (default `./data`).
- Download them as CSV at `/api/leads.csv?key=ADMIN_KEY`. On Render, the `ADMIN_KEY` value is under Environment.
- **On Render free, the disk resets on every deploy.** Set `LEADS_WEBHOOK_URL` so each signup is also POSTed somewhere permanent. `scripts/google-sheet-webhook.gs` turns a Google Sheet into that webhook in about 2 minutes (instructions are at the top of the file). Zapier, Make or your email tool's webhook work too.
- The play token is HMAC-signed with `TOKEN_SECRET`, so the room rejects anyone who skipped the gate.

## Environment variables

| Var | Purpose |
| --- | --- |
| `PORT` | HTTP + WebSocket port (default 2567) |
| `TOKEN_SECRET` | Signs play tokens. If unset, one is generated and saved in `DATA_DIR` |
| `ADMIN_KEY` | Enables `/api/leads.csv` |
| `LEADS_WEBHOOK_URL` | Optional. Every signup is POSTed here as JSON |
| `DATA_DIR` | Where `leads.jsonl` lives |
| `ROUND_SECONDS`, `BOTS` | Testing overrides |

## Test

```bash
BOTS=0 ROUND_SECONDS=14 npm start    # in one shell
node scripts/sim-test.js             # two headless players: join, shoot, collect, finish a round
```
