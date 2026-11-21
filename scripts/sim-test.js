// Headless test: two players join over WebSockets, walk, shoot, collect cards,
// overflow the bag, run out of tokens, and finish a round.
// Usage: BOTS=0 SCAM_CHANCE=0 ROUND_SECONDS=30 npm start   (in another shell)
//        node scripts/sim-test.js
import { Client } from "colyseus.js";
const URL = process.env.URL || "http://localhost:2567";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const tokenFor = async (name) => (await (await fetch(`${URL}/api/lead`, {
  method: "POST", headers: { "content-type": "application/json" },
  body: JSON.stringify({ name, email: `${name.toLowerCase()}@test.dev`, consent: true }),
})).json()).token;

let failures = 0;
const check = (label, ok, extra = "") => {
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}${extra ? `  (${extra})` : ""}`);
  if (!ok) failures++;
};

const client = new Client(URL);
try { await client.joinOrCreate("arena", { token: "forged.token" }); check("forged token rejected", false); }
catch { check("forged token rejected", true); }

const A = await client.joinOrCreate("arena", { token: await tokenFor("Alpha") });
const B = await client.joinById(A.roomId, { token: await tokenFor("Bravo") });
const log = [];
for (const [n, r] of [["A", A], ["B", B]]) {
  for (const t of ["lesson", "died", "roundEnd", "roundStart"]) r.onMessage(t, (m) => log.push({ n, t, m }));
  r.onMessage("*", () => {});
}
await sleep(300);
const me = (r) => r.state.players.get(r.sessionId);
check("both players in the same room", A.roomId === B.roomId && A.state.players.size === 2);

// Walk toward a point; if stuck on something, sidestep for a moment.
async function walk(r, tx, tz) {
  let last = null, stuck = 0, side = 0;
  for (let i = 0; i < 300; i++) {
    const p = me(r);
    let dx = tx - p.x, dz = tz - p.z;
    const d = Math.hypot(dx, dz);
    if (d < 0.4) return true;
    if (last && Math.hypot(p.x - last.x, p.z - last.z) < 0.05) stuck++; else stuck = 0;
    last = { x: p.x, z: p.z };
    if (stuck > 3) side = 12;
    let ux = dx / d, uz = dz / d;
    if (side > 0) { [ux, uz] = [-uz, ux]; side--; }
    const s = Math.min(0.35, d);
    r.send("move", { x: p.x + ux * s, z: p.z + uz * s, a: 0 });
    await sleep(50);
  }
  return false;
}

const before = { x: me(A).x, z: me(A).z };
A.send("move", { x: 20, z: 20, a: 0 });
await sleep(150);
const moved = Math.hypot(me(A).x - before.x, me(A).z - before.z);
check("teleport is clamped", moved < 4, `${moved.toFixed(2)} units`);

// Tag B: both walk to an open lane, A shoots
await Promise.all([walk(A, -4, -20), walk(B, 4, -20)]);
for (let i = 0; i < 8 && me(B).alive; i++) {
  A.send("shoot", { a: Math.atan2(me(B).x - me(A).x, me(B).z - me(A).z), cid: i });
  await sleep(230);
}
check("tag scores +100", !me(B).alive && me(A).kills === 1 && me(A).score === 100, `score ${me(A).score}`);

// Token meter: spam shots, meter should drain and block
const t0 = me(A).tokens;
for (let i = 0; i < 30; i++) { A.send("shoot", { a: 0, cid: 100 + i }); await sleep(180); }
check("tokens drain when shooting", me(A).tokens < t0 - 5, `${t0.toFixed(1)} -> ${me(A).tokens.toFixed(1)}`);

// Cards: LLM, API, MCP, then Agent overflows the 3-slot bag
await walk(A, -6, -20); await walk(A, -6, -12);
await walk(A, -5, -5);
await walk(A, 5, -5);
await walk(A, 0, -9);
check("bag holds 3 cards in pickup order", me(A).bag === "0,1,2", `bag "${me(A).bag}"`);
await walk(A, -9, 0);
check("4th card pushes the oldest out", me(A).bag === "1,2,3", `bag "${me(A).bag}"`);
const dropped = log.find((e) => e.n === "A" && e.t === "lesson" && e.m.type === "card" && e.m.dropped === 0);
check("client is told which card fell out", !!dropped);
check("learned bitmask tracks all 4 cards", me(A).learned === 0b1111, `learned ${me(A).learned.toString(2)}`);

// Agent card: assistant auto-fires when an enemy is in range
const shotsBefore = log.length;
let agentShots = 0;
A.onMessage("shot", (m) => { if (m.ag) agentShots++; });
await walk(B, -7, 3);
await sleep(1500);
check("Agent card auto-fires at nearby enemies", agentShots > 0, `${agentShots} assistant shots`);

A.send("ability");
await sleep(100);
check("Regenerate gives a shield", me(A).shield === true);

while (A.state.phase === "playing") await sleep(200);
check("round ends", A.state.phase === "ended");
await sleep(13000);
check("next round resets score and bag", A.state.phase === "playing" && me(A).score === 0 && me(A).bag === "");

await A.leave(); await B.leave();
console.log(failures ? `\n${failures} check(s) failed` : "\nAll checks passed");
process.exit(failures ? 1 : 0);
