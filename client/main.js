import { Client } from "colyseus.js";
import {
  createWorld, createPlayerMesh, drawPlayerLabel, createBotMesh, createPickupMesh,
  Bullets, Effects, isTouch,
} from "./scene.js";
import { createInput } from "./input.js";
import { PLAYER, WEAPON, ABILITY, ROUND_SECONDS, resolveCircle } from "../shared/game.js";
import {
  BRAND, PIECES, COMPLETE_LESSON, BOT_TIPS, RESPAWN_TIPS, TOOLS, NAMES,
} from "../shared/theme.js";

const $ = (id) => document.getElementById(id);
const show = (el, on = true) => el.classList.toggle("hidden", !on);
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const initial = (name) => (String(name).trim()[0] || "?").toUpperCase();
if (isTouch) document.body.classList.add("is-touch");

// ---------- static copy from theme ----------
document.querySelectorAll("[data-handle]").forEach((e) => (e.textContent = BRAND.handle));
document.querySelectorAll("[data-consent]").forEach((e) => (e.textContent = BRAND.consent));
document.querySelectorAll(".story-head .ring b").forEach((e) => (e.textContent = initial(BRAND.handle.replace("@", ""))));
document.querySelectorAll(".story-head .handle").forEach((e) => (e.textContent = BRAND.handle.replace("@", "")));
$("followBtn").href = BRAND.igUrl;
$("abilityBtn").title = `${NAMES.ability}: ${NAMES.abilityHelp}`;
$("toolChips").innerHTML = ["chatgpt", "claude", "gemini"]
  .map((k) => `<span class="chip" style="--c:${TOOLS[k].color}"><i></i>${TOOLS[k].label}</span>`).join("");
const highlight = (p, i, id) =>
  `<div class="hl"${id ? ` id="${id}${i}"` : ""} style="--pc:${p.color}"><span class="ring"><b>${p.letter}</b></span><small>${p.label}</small></div>`;
$("slots").innerHTML = PIECES.map((p, i) => highlight(p, i, "slot")).join("");
$("howHighlights").innerHTML = $("welcomeHighlights").innerHTML = PIECES.map((p, i) => highlight(p, i)).join("");

// ---------- storage helpers (private mode safe) ----------
const store = {
  get(k) { try { return localStorage.getItem(k); } catch { return null; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch {} },
  del(k) { try { localStorage.removeItem(k); } catch {} },
};

// ---------- endpoints ----------
const endpoint = import.meta.env.DEV ? `${location.protocol}//${location.hostname}:2567` : location.origin;
const client = new Client(endpoint);
const params = new URLSearchParams(location.search);
const inviteRoom = params.get("room");

let token = store.get("pa_token");
let myName = store.get("pa_name") || "";

// ---------- Story onboarding ----------
const storyEl = document.querySelector("#story .story");
const AUTO_MS = { cover: 4500, how: 9000 };
let flow = [];
let slideIdx = 0;
let slideStart = 0;

function openStory(mode, note = "") {
  show($("hud"), false);
  flow = mode === "returning" ? ["welcome"] : mode === "reauth" ? ["gate"] : ["cover", "how", "gate"];
  $("coverKicker").textContent = inviteRoom ? "A friend invited you to play" : `A game by ${BRAND.handle}`;
  $("welcomeKicker").textContent = inviteRoom ? "You're invited" : "Welcome back";
  $("welcomeName").textContent = myName;
  $("welcomeNote").textContent = note || (inviteRoom ? "Your friend's match is waiting." : "New round, new tips. Ready?");
  $("playBtn").textContent = inviteRoom ? "Join the match" : "Play";
  $("playBtn").disabled = false;
  $("gateBtn").textContent = "Play now";
  $("gateBtn").disabled = false;
  $("gateError").textContent = mode === "reauth" || mode === "new" ? note : "";
  $("storyBars").innerHTML = flow.map(() => "<i><s></s></i>").join("");
  show($("story"));
  goSlide(0);
}

function goSlide(i) {
  slideIdx = Math.max(0, Math.min(flow.length - 1, i));
  slideStart = performance.now();
  const name = flow[slideIdx];
  storyEl.dataset.slide = name;
  storyEl.querySelectorAll(".slide").forEach((s) => s.classList.toggle("on", s.dataset.slide === name));
}

function tickStory(now) {
  if ($("story").classList.contains("hidden")) return;
  const name = flow[slideIdx];
  const dur = AUTO_MS[name];
  const k = dur ? Math.min(1, (now - slideStart) / dur) : 1;
  $("storyBars").querySelectorAll("s").forEach((s, i) => {
    s.style.width = i < slideIdx ? "100%" : i === slideIdx ? `${k * 100}%` : "0%";
  });
  if (dur && k >= 1 && slideIdx < flow.length - 1) goSlide(slideIdx + 1);
}
storyEl.querySelector(".tapzone.next").addEventListener("click", () => goSlide(slideIdx + 1));
storyEl.querySelector(".tapzone.prev").addEventListener("click", () => goSlide(slideIdx - 1));

$("gateForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const f = e.target;
  const body = {
    name: f.elements.name.value.trim(),
    email: f.elements.email.value.trim(),
    consent: f.elements.consent.checked,
    ref: params.get("ref") || (inviteRoom ? "invite" : document.referrer.slice(0, 120)),
  };
  $("gateError").textContent = "";
  $("gateBtn").disabled = true;
  $("gateBtn").textContent = "Unlocking…";
  try {
    const res = await fetch("/api/lead", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || "Something went wrong. Try again.");
    token = data.token;
    myName = data.name;
    store.set("pa_token", token);
    store.set("pa_name", myName);
    await join();
  } catch (err) {
    $("gateError").textContent = err.message;
    $("gateBtn").disabled = false;
    $("gateBtn").textContent = "Play now";
  }
});

$("notYou").addEventListener("click", (e) => {
  e.preventDefault();
  store.del("pa_token");
  token = null;
  openStory("new");
});
$("playBtn").addEventListener("click", () => join());

// ---------- world ----------
const world = createWorld($("stage"));
const { scene, camera, renderer } = world;
const bullets = new Bullets(scene);
const effects = new Effects(scene);
const input = createInput({
  canvas: renderer.domElement, camera,
  abilityBtn: $("abilityBtn"), joyL: $("joyL"), joyR: $("joyR"),
});

let room = null;
let me = null; // local predicted player { x, z, a }
const views = { players: new Map(), bots: new Map(), pickups: new Map() };
const serverBullets = new Map(); // server bullet id -> visual
const myShots = new Map(); // client shot id -> visual
let shotSeq = 0;
let lastShotAt = 0;
let abilityReadyAt = 0;
let dash = null;
let lastSend = 0;
let driftFor = 0;
let learned = new Map();
let deathTimer = null;
let roundMax = ROUND_SECONDS;

// ---------- joining ----------
async function join() {
  if (!token) return openStory("new");
  $("playBtn").disabled = true;
  $("playBtn").textContent = "Connecting…";
  try {
    const opts = { token };
    if (inviteRoom) {
      try { room = await client.joinById(inviteRoom, opts); }
      catch (err) {
        if (isGateError(err)) throw err;
        room = await client.joinOrCreate("arena", opts);
      }
    } else {
      room = await client.joinOrCreate("arena", opts);
    }
  } catch (err) {
    room = null;
    if (isGateError(err)) {
      store.del("pa_token");
      token = null;
      return openStory("reauth", "Please unlock again to play.");
    }
    console.error(err);
    return openStory(token ? "returning" : "new", "Couldn't connect. Check your connection and try again.");
  }
  onJoined();
}
const isGateError = (err) => /gate/i.test(String(err?.message || err));

function onJoined() {
  show($("story"), false);
  show($("hud"));
  history.replaceState(null, "", `?room=${room.roomId}`);
  learned = new Map();
  me = null;
  roundMax = Math.max(1, room.state.timeLeft || ROUND_SECONDS);
  $("meName").textContent = myName;
  $("meInitial").textContent = initial(myName);
  toast({ c: "#962fbf", badge: "▶", title: "You're in!", text: `Grab all 5 prompt pieces, bust ${NAMES.bot}s, tag friends. Tap ✈ to invite people to this match.` }, 6000);

  room.onMessage("shot", (m) => {
    if (m.o === room.sessionId) {
      const b = myShots.get(m.cid);
      if (b) { serverBullets.set(m.id, b); myShots.delete(m.cid); }
      return;
    }
    const p = room.state.players.get(m.o);
    serverBullets.set(m.id, bullets.spawn(m.x, m.z, m.a, p?.color || "#fff"));
  });
  room.onMessage("bx", (m) => {
    const b = serverBullets.get(m.id);
    serverBullets.delete(m.id);
    if (b && !b.dead) bullets.remove(b);
    effects.burst(m.x, m.z, b?.mesh.material.color.getStyle() || "#fff", 0.6);
  });
  room.onMessage("botdown", (m) => effects.burst(m.x, m.z, "#ff3040", 2.5, 1.1));
  room.onMessage("ability", (m) => {
    const p = room.state.players.get(m.o);
    if (p) effects.burst(p.x, p.z, "#0095f6", 1.8, 0.9);
  });
  room.onMessage("lesson", onLesson);
  room.onMessage("feed", (m) => feed(m.text));
  room.onMessage("died", onDied);
  room.onMessage("roundEnd", onRoundEnd);
  room.onMessage("roundStart", () => {
    show($("results"), false);
    learned = new Map();
    bullets.clear();
    roundMax = Math.max(1, room.state.timeLeft || ROUND_SECONDS);
    feed("New round started");
  });
  room.onLeave(() => {
    cleanupRoom();
    openStory(token ? "returning" : "new", "You left the match. Jump back in?");
  });
}

function cleanupRoom() {
  room = null;
  me = null;
  for (const kind of ["players", "bots", "pickups"]) {
    for (const v of views[kind].values()) {
      scene.remove(v.group);
      if (v.label) scene.remove(v.label);
    }
    views[kind].clear();
  }
  bullets.clear();
  show($("hud"), false);
  show($("death"), false);
  show($("results"), false);
  input.reset();
}

// ---------- messages ----------
const learnTip = (tip) => learned.set(tip.text, { label: TOOLS[tip.tool].label, color: TOOLS[tip.tool].color, text: tip.text });

function onLesson(m) {
  if (m.type === "piece" || m.type === "complete") {
    const p = PIECES[m.kind];
    toast({ c: p.color, badge: p.letter, title: `${p.label} +10`, text: p.tip });
    learned.set(p.tip, { label: p.label, color: p.color, text: p.tip });
    if (me) effects.hearts(me.x, me.z, 4);
    if (m.type === "complete") {
      setTimeout(() => toast({ c: "#d62976", badge: "★", title: COMPLETE_LESSON.title, text: COMPLETE_LESSON.tip }, 5000), 400);
      learned.set(COMPLETE_LESSON.tip, { label: "Full prompt", color: "#d62976", text: COMPLETE_LESSON.tip });
      if (me) effects.hearts(me.x, me.z, 12);
    }
  } else if (m.type === "bot") {
    const tip = BOT_TIPS[m.idx % BOT_TIPS.length];
    const tool = TOOLS[tip.tool];
    toast({ c: tool.color, badge: tool.short, title: `${NAMES.bot} busted +50`, tag: tool, text: tip.text });
    learnTip(tip);
  }
}

// Animate a Story progress bar from 0 to 100% over `seconds`.
function runBar(el, seconds) {
  el.style.transition = "none";
  el.style.width = "0%";
  void el.offsetWidth;
  el.style.transition = `width ${seconds}s linear`;
  el.style.width = "100%";
}

function onDied(m) {
  $("deathBy").textContent = m.by;
  const tip = RESPAWN_TIPS[m.tip % RESPAWN_TIPS.length];
  const tool = TOOLS[tip.tool];
  $("deathTip").innerHTML = `<span class="tool" style="--c:${tool.color}">${tool.label} tip</span><p>${esc(tip.text)}</p>`;
  learnTip(tip);
  show($("death"));
  runBar($("deathBar"), m.respawn);
  flash();
  let left = Math.ceil(m.respawn);
  $("deathCount").textContent = left;
  clearInterval(deathTimer);
  deathTimer = setInterval(() => {
    left -= 1;
    $("deathCount").textContent = Math.max(0, left);
    if (left <= 0) { clearInterval(deathTimer); show($("death"), false); }
  }, 1000);
}

function onRoundEnd(m) {
  show($("death"), false);
  clearInterval(deathTimer);
  const list = [...room.state.players.entries()].sort((a, b) => b[1].score - a[1].score);
  const [topId, top] = list[0] || [];
  $("winnerLine").textContent = !top ? "Round over" : topId === room.sessionId ? "You won the round!" : `${top.name} wins`;
  $("ranking").innerHTML = list.map(([id, p], i) => `
    <li class="${id === room.sessionId ? "me" : ""}">
      <span class="pos">${i + 1}</span>
      <span class="ring" style="--c:${p.color}"><b>${esc(initial(p.name))}</b></span>
      <span class="who"><b>${esc(p.name)}</b><small>${p.kills} tags · ${p.bots} busts · ${p.prompts} prompts</small></span>
      <span class="pts">${p.score}</span>
    </li>`).join("");
  const items = [...learned.values()].slice(-6);
  $("learned").innerHTML = items.length
    ? items.map((l) => `<li><b style="--c:${l.color}">${esc(l.label)}</b>${esc(l.text)}</li>`).join("")
    : "<li>Grab prompt pieces next round to learn the 5 parts of a great prompt.</li>";
  show($("results"));
  runBar($("nextBar"), m.next);
  let left = m.next;
  $("nextIn").textContent = left;
  const t = setInterval(() => {
    left -= 1;
    $("nextIn").textContent = Math.max(0, left);
    if (left <= 0 || !room) clearInterval(t);
  }, 1000);
}

// ---------- UI helpers ----------
// Notification card. c = accent color, badge = short text in the avatar ring,
// tag = optional { label, color } pill after the title.
function toast({ c, badge, title, text, tag }, ms = 4200) {
  const box = $("toasts");
  while (box.children.length >= 2) box.firstChild.remove();
  const el = document.createElement("div");
  el.className = "note";
  const tagHtml = tag ? `<span class="tag" style="--c2:${tag.color}">${esc(tag.label)}</span>` : "";
  el.innerHTML = `<span class="ring"><b style="background:${c};color:#fff">${esc(badge)}</b></span>
    <div><b class="t">${esc(title)}${tagHtml}</b><p>${esc(text)}</p></div>`;
  box.appendChild(el);
  setTimeout(() => { el.classList.add("out"); setTimeout(() => el.remove(), 300); }, ms);
}
// Live-style comment stream for joins, tags and big moments.
function feed(text) {
  const el = document.createElement("div");
  el.textContent = text;
  $("feed").appendChild(el);
  while ($("feed").children.length > 4) $("feed").firstChild.remove();
  setTimeout(() => el.remove(), 4000);
}
function flash() {
  $("flash").classList.add("on");
  setTimeout(() => $("flash").classList.remove("on"), 60);
}

async function invite() {
  if (!room) return;
  const url = `${location.origin}${location.pathname}?room=${room.roomId}`;
  const text = `Play ${BRAND.game} with me. Learn ChatGPT, Claude and Gemini tricks while we play.`;
  if (navigator.share && isTouch) {
    try { await navigator.share({ title: BRAND.game, text, url }); return; } catch {}
  }
  try {
    await navigator.clipboard.writeText(url);
    toast({ c: "#1fbf6a", badge: "✓", title: "Invite link copied", text: "Send it to friends. They'll land in this exact match." }, 3000);
  } catch {
    prompt("Copy this link and send it to friends:", url);
  }
}
$("inviteBtn").addEventListener("click", invite);
$("inviteBtn2").addEventListener("click", invite);

// ---------- sync views with server state ----------
const lerp = (a, b, k) => a + (b - a) * k;
function lerpAngle(a, b, k) {
  let d = b - a;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return a + d * k;
}

function syncPlayers(dt, t) {
  const seen = new Set();
  const k = 1 - Math.exp(-dt * 14);
  room.state.players.forEach((p, id) => {
    seen.add(id);
    let v = views.players.get(id);
    const isMe = id === room.sessionId;
    if (!v) {
      v = createPlayerMesh(p.color, isMe);
      v.x = p.x; v.z = p.z; v.a = p.a; v.seq = p.spawnSeq;
      scene.add(v.group);
      scene.add(v.label);
      views.players.set(id, v);
    }
    if (isMe) {
      updateMe(p, v, dt);
      v.x = me.x; v.z = me.z; v.a = me.a;
    } else {
      if (v.seq !== p.spawnSeq) { v.x = p.x; v.z = p.z; v.seq = p.spawnSeq; }
      v.x = lerp(v.x, p.x, k);
      v.z = lerp(v.z, p.z, k);
      v.a = lerpAngle(v.a, p.a, k);
    }
    v.group.visible = p.alive;
    v.label.visible = p.alive;
    v.group.position.set(v.x, 0, v.z);
    v.group.rotation.y = v.a;
    v.body.position.y = 0.9 + Math.sin(t * 6 + v.x) * 0.04;
    v.shield.visible = p.shield;
    v.label.position.set(v.x, 2.7, v.z);
    if (v.hp !== undefined && p.hp < v.hp - 0.5 && p.alive) {
      effects.burst(v.x, v.z, p.color, 0.5, 1.2);
      if (isMe) flash();
    }
    v.hp = p.hp;
    drawPlayerLabel(v, p.name, p.hp, p.color);
  });
  for (const [id, v] of views.players) {
    if (!seen.has(id)) {
      scene.remove(v.group);
      scene.remove(v.label);
      views.players.delete(id);
    }
  }
}

function updateMe(p, v, dt) {
  if (!me || v.seq !== p.spawnSeq) {
    me = { x: p.x, z: p.z, a: p.a };
    v.seq = p.spawnSeq;
    dash = null;
  }
  const playing = room.state.phase === "playing" && p.alive;
  const inp = input.update(me.x, me.z);
  if (inp.aim !== null) me.a = inp.aim;

  if (playing) {
    const mx = inp.moveX, mz = inp.moveZ;
    if (inp.abilityPressed && performance.now() >= abilityReadyAt) {
      abilityReadyAt = performance.now() + ABILITY.cooldown * 1000;
      const dir = Math.hypot(mx, mz) > 0.1 ? Math.atan2(mx, mz) : me.a;
      dash = { dir, left: ABILITY.dashTime };
      room.send("ability");
    }
    if (dash) {
      const step = Math.min(dt, dash.left);
      dash.left -= step;
      const sp = ABILITY.dashDistance / ABILITY.dashTime;
      const r = resolveCircle(me.x + Math.sin(dash.dir) * sp * step, me.z + Math.cos(dash.dir) * sp * step, PLAYER.radius);
      me.x = r.x; me.z = r.z;
      if (dash.left <= 0) dash = null;
    } else {
      const r = resolveCircle(me.x + mx * PLAYER.speed * dt, me.z + mz * PLAYER.speed * dt, PLAYER.radius);
      me.x = r.x; me.z = r.z;
    }

    // shooting
    const now = performance.now();
    if (inp.firing && now - lastShotAt >= WEAPON.cooldown * 1000) {
      lastShotAt = now;
      const cid = (shotSeq = (shotSeq + 1) % 1e6);
      const ox = me.x + Math.sin(me.a) * (PLAYER.radius + 0.25);
      const oz = me.z + Math.cos(me.a) * (PLAYER.radius + 0.25);
      myShots.set(cid, bullets.spawn(ox, oz, me.a, p.color));
      if (myShots.size > 40) myShots.delete(myShots.keys().next().value);
      room.send("shoot", { a: me.a, cid });
    }

    // reconcile: if the server disagrees for a while, trust the server
    const err = Math.hypot(p.x - me.x, p.z - me.z);
    driftFor = err > 2.5 && !dash ? driftFor + dt : 0;
    if (driftFor > 0.5) { me.x = p.x; me.z = p.z; driftFor = 0; }

    if (now - lastSend > 50) {
      lastSend = now;
      room.send("move", { x: +me.x.toFixed(3), z: +me.z.toFixed(3), a: +me.a.toFixed(3) });
    }
  } else {
    me.x = p.x;
    me.z = p.z;
  }
  inp.abilityPressed = false;
}

function syncBots(dt, t) {
  room.state.bots.forEach((b, id) => {
    let v = views.bots.get(id);
    if (!v) {
      v = createBotMesh();
      v.x = b.x; v.z = b.z;
      scene.add(v.group);
      views.bots.set(id, v);
    }
    const k = 1 - Math.exp(-dt * 10);
    if (!v.group.visible && b.alive) { v.x = b.x; v.z = b.z; }
    v.x = lerp(v.x, b.x, k);
    v.z = lerp(v.z, b.z, k);
    v.group.visible = b.alive;
    v.group.position.set(v.x + (Math.random() - 0.5) * 0.06, 0, v.z);
    v.core.rotation.set(t * 1.7, t * 2.3, 0);
    v.shell.rotation.set(-t, t * 0.8, t * 0.5);
    v.core.scale.setScalar(0.7 + (b.hp / 40) * 0.3);
  });
}

function syncPickups(t) {
  const myPieces = room.state.players.get(room.sessionId)?.pieces || 0;
  room.state.pickups.forEach((pk, id) => {
    let v = views.pickups.get(id);
    if (!v) {
      v = createPickupMesh(pk.kind);
      v.group.position.set(pk.x, 0, pk.z);
      scene.add(v.group);
      views.pickups.set(id, v);
    }
    v.group.visible = pk.active;
    const have = (myPieces >> pk.kind) & 1;
    const pulse = have ? 1 : 1 + Math.sin(t * 4 + pk.x) * 0.06;
    v.tile.position.y = 1.3 + Math.sin(t * 2 + pk.z) * 0.15;
    v.tile.scale.set(1.5 * pulse, 1.5 * pulse, 1);
    v.mat.opacity = have ? 0.35 : 1; // already collected: fade it out
  });
}

// ---------- HUD ----------
let lastHud = "";
function updateHud() {
  const p = room.state.players.get(room.sessionId);
  if (!p) return;
  const tl = Math.ceil(room.state.timeLeft);
  const timeStr = `${Math.floor(tl / 60)}:${String(tl % 60).padStart(2, "0")}`;
  const ab = Math.max(0, abilityReadyAt - performance.now()) / (ABILITY.cooldown * 1000);
  const list = [...room.state.players.entries()].sort((a, b) => b[1].score - a[1].score);
  const rank = list.findIndex(([id]) => id === room.sessionId) + 1;
  const key = [timeStr, Math.ceil(p.hp), p.score, p.pieces, ab.toFixed(2), p.color, list.map(([, q]) => q.score + q.name).join()].join("|");
  if (key === lastHud) return;
  lastHud = key;
  $("timer").textContent = timeStr;
  $("timer").classList.toggle("low", tl <= 15);
  $("timeFill").style.transform = `scaleX(${Math.min(1, room.state.timeLeft / roundMax)})`;
  $("meRing").style.setProperty("--c", p.color);
  $("hpFill").style.width = `${Math.max(0, p.hp)}%`;
  $("hpFill").parentElement.classList.toggle("low", p.hp <= 35);
  $("meRank").textContent = list.length > 1 ? `#${rank} · ${p.score} pts` : `${p.score} pts`;
  PIECES.forEach((_, i) => $(`slot${i}`).classList.toggle("on", !!((p.pieces >> i) & 1)));
  $("abilityBtn").style.setProperty("--cd", ab.toFixed(3));
  $("abilityBtn").classList.toggle("ready", ab === 0);
  $("board").innerHTML = list.length < 2 ? "" : list.slice(0, 5).map(([id, q]) =>
    `<li class="${id === room.sessionId ? "me" : ""}"><span class="ring" style="--c:${q.color}"><b>${esc(initial(q.name))}</b></span>${q.score}</li>`
  ).join("");
}

// ---------- camera ----------
const camTarget = { x: 0, z: 0 };
function updateCamera(dt) {
  const portrait = innerHeight > innerWidth;
  const h = portrait ? 21 : 17;
  const back = portrait ? 8 : 10;
  if (me) {
    const k = 1 - Math.exp(-dt * 8);
    camTarget.x = lerp(camTarget.x, me.x, k);
    camTarget.z = lerp(camTarget.z, me.z, k);
  }
  camera.position.set(camTarget.x, h, camTarget.z + back);
  camera.lookAt(camTarget.x, 0, camTarget.z - (portrait ? 1 : 0));
}

// ---------- main loop ----------
let last = performance.now();
let idleSpin = 0;
function frame(now) {
  const dt = Math.min((now - last) / 1000, 0.05);
  last = now;
  const t = now / 1000;
  if (room?.state?.players) {
    syncPlayers(dt, t);
    syncBots(dt, t);
    syncPickups(t);
    updateHud();
  } else {
    idleSpin += dt * 0.15; // slow drift behind the Story screens
    camTarget.x = Math.sin(idleSpin) * 8;
    camTarget.z = Math.cos(idleSpin) * 8;
  }
  tickStory(now);
  bullets.update(dt, (x, z) => effects.burst(x, z, "#d8c8e6", 0.4));
  effects.update(dt);
  updateCamera(dt);
  world.coreLight.intensity = 12 + Math.sin(t * 3) * 4;
  renderer.render(scene, camera);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

// ---------- boot ----------
openStory(token ? "returning" : "new");
