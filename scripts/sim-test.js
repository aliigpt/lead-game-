// Headless test: two bots join over WebSockets, walk, shoot, collect, finish a round.
// Usage: ROUND_SECONDS=14 npm start  (in another shell), then: node scripts/sim-test.js
import { Client } from "colyseus.js";
const URL = process.env.URL || "http://localhost:2567";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const tokenFor = async (name) => (await (await fetch(`${URL}/api/lead`, {
  method: "POST", headers: { "content-type": "application/json" },
  body: JSON.stringify({ name, email: `${name.toLowerCase()}@test.dev`, consent: true }),
})).json()).token;

const client = new Client(URL);
try { await client.joinOrCreate("arena", { token: "forged.token" }); console.log("FAIL forged token joined"); }
catch (e) { console.log("forged token rejected:", e.message); }

const A = await client.joinOrCreate("arena", { token: await tokenFor("Alpha") });
const B = await client.joinById(A.roomId, { token: await tokenFor("Bravo") });
const log = [];
for (const [n, r] of [["A", A], ["B", B]]) {
  for (const t of ["lesson", "died", "roundEnd", "roundStart"]) r.onMessage(t, (m) => log.push(`${n}:${t}:${JSON.stringify(m)}`));
  r.onMessage("*", () => {});
}
await sleep(300);
const me = (r) => r.state.players.get(r.sessionId);
console.log("same room:", A.roomId === B.roomId, "players:", A.state.players.size);

async function walk(r, tx, tz) {
  for (let i = 0; i < 200; i++) {
    const p = me(r);
    const dx = tx - p.x, dz = tz - p.z, d = Math.hypot(dx, dz);
    if (d < 0.4) return true;
    const s = Math.min(0.35, d);
    r.send("move", { x: p.x + (dx / d) * s, z: p.z + (dz / d) * s, a: 0 });
    await sleep(50);
  }
  return false;
}
// teleport attempt should be clamped
const before = { ...me(A).toJSON() };
A.send("move", { x: 20, z: 20, a: 0 });
await sleep(150);
console.log("teleport clamped:", Math.hypot(me(A).x - before.x, me(A).z - before.z).toFixed(2), "units moved");

await Promise.all([walk(A, -4, -20), walk(B, 4, -20)]);
console.log("A at", me(A).x.toFixed(1), me(A).z.toFixed(1), "B at", me(B).x.toFixed(1), me(B).z.toFixed(1));
for (let i = 0; i < 6 && me(B).alive; i++) {
  const a = Math.atan2(me(B).x - me(A).x, me(B).z - me(A).z);
  A.send("shoot", { a, cid: i });
  await sleep(250);
}
console.log("B alive:", me(B).alive, "A score:", me(A).score, "A kills:", me(A).kills);
await walk(A, -6, -20); await walk(A, -6, -12); await walk(A, -5, -5);
console.log("A pieces bitmask:", me(A).pieces, "score:", me(A).score);
A.send("ability");
await sleep(100);
console.log("A shield after ability:", me(A).shield);
while (A.state.phase === "playing") await sleep(200);
console.log("phase:", A.state.phase);
await sleep(13000);
console.log("phase after intermission:", A.state.phase, "round:", A.state.round, "A score reset:", me(A).score);
console.log(log.join("\n"));
await A.leave(); await B.leave();
process.exit(0);
