# AI 術語大亂鬥 · AI Jargon Brawl by @aliigpt

A free 3D multiplayer browser game that teaches AI jargon through @aliigpt's Hong Kong analogies. It runs on phone and desktop with no download, in Cantonese with an English toggle. Players share a link and land in the same match. Rounds last 2:30.

## Design

1. **Map.** A Hong Kong street block: tong lau shops with neon signs (茶餐廳, 涼茶, 電器, 冰室), parked red taxis and green minibuses at 的士站, zebra crossings, and a kiosk holding the 🧠 LLM brain in the middle of a roundabout.
2. **Terms are the rules.**
   - Token = 的士咪錶: every shot costs tokens; a taxi meter shows how many you have left. At zero you still shoot, just slower.
   - Context window = 書包: your bag holds 3 cards; a 4th pushes the oldest out.
   - Hallucination = 作故仔同事: the enemy bots.
   - Prompt injection = 電話騙案: fake cards (📞 in the corner, and they shake) that steal your newest card.
   - LLM = AI 嘅大腦: standing in the zone around the brain scores points.
3. **Cards give powers while they're in your bag:** LLM +50% damage, API 伙記 heals you, MCP recharges tokens 2x, Agent 私人助理 auto-fires, RAG 開書考試 auto-aims, Skills SOP halves your ability cooldown. Learn all six in a round to become 「AI 術語大師」 (+250).
4. **Controls.** Move, aim, shoot, plus one ability, 重新生成 Regenerate (dash, heal, short shield). Desktop: WASD, mouse, Space. Phone: left thumb moves and shooting is automatic (right thumb to aim yourself), plus a 🔄 button.
5. **Beginner-friendly.** One bot at the start and one more every 30s, bots ignore you for your first 15s, a yellow arrow points to the nearest card for 20s, dying costs only your newest card, 1.5s respawn, one-line lessons in the fight (full explanations on the receipt).
6. **Lead loop.** Email gate before the first match, an invite button in the match, and a cha chaan teng receipt at the end of each round listing what you learned next to a Follow @aliigpt button.

## Stack

- **Client:** Three.js and Vite (`client/`)
- **Server:** Colyseus 0.16 over WebSockets, server-authoritative for hits, scoring, pickups and bots (`server/`)
- **Shared rules and map:** `shared/game.js`
- **All teaching copy and branding (Cantonese + English):** `shared/theme.js`. Interface text: `client/i18n.js`.

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
| `ROUND_SECONDS`, `BOTS`, `SCAM_CHANCE` | Testing overrides |

## Test

```bash
BOTS=0 SCAM_CHANCE=0 ROUND_SECONDS=50 npm start   # in one shell
node scripts/sim-test.js   # two headless players: tag, token meter, bag overflow, Agent, round reset
```
