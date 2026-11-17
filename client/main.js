import { Client } from "colyseus.js";
import {
  createWorld, createPlayerMesh, drawPlayerLabel, createBotMesh, createPickupMesh,
  Bullets, Effects, isTouch,
} from "./scene.js";
import { createInput } from "./input.js";
import { PLAYER, WEAPON, ABILITY, resolveCircle } from "../shared/game.js";
import {
  BRAND, PIECES, COMPLETE_LESSON, HALLUCINATION_LESSONS, NAMES,
} from "../shared/theme.js";

const $ = (id) => document.getElementById(id);
const show = (el, on = true) => el.classList.toggle("hidden", !on);
if (isTouch) document.body.classList.add("is-touch");

// ---------- static copy from theme ----------
document.querySelectorAll("[data-game]").forEach((e) => (e.textContent = BRAND.game));
document.querySelectorAll("[data-handle]").forEach((e) => (e.textContent = BRAND.handle));
document.querySelectorAll("[data-tagline]").forEach((e) => (e.textContent = BRAND.tagline));
document.querySelectorAll("[data-consent]").forEach((e) => (e.textContent = BRAND.consent));
document.querySelectorAll("[data-ability]").forEach((e) => (e.textContent = NAMES.ability));
$("followBtn").href = BRAND.igUrl;
$("abilityBtn").title = `${NAMES.ability}: ${NAMES.abilityHelp}`;
$("piecesPreview").innerHTML = PIECES.map((p) => `<li style="--c:${p.color}"><b>${p.letter}</b>${p.label}</li>`).join("");
$("goalLetters").innerHTML = PIECES.map((p) => `<span class="l" style="color:${p.color}">${p.letter}</span>`).join(" ");
$("slots").innerHTML = PIECES.map((p, i) => `<div class="slot" id="slot${i}" style="--c:${p.color}"><b>${p.letter}</b><span>${p.label}</span></div>`).join("");

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

// ---------- gate / menu ----------
let token = store.get("pa_token");
let myName = store.get("pa_name") || "";

function openMenu(note) {
  show($("gate"), false);
  show($("hud"), false);
  $("menuName").textContent = myName;
  $("menuNote").textContent = note || (inviteRoom ? "A friend invited you to their match." : BRAND.tagline);
  $("playBtn").textContent = inviteRoom ? "Join friend's match" : "Play";
  $("playBtn").disabled = false;
  show($("menu"));
}
function openGate(msg) {
  show($("menu"), false);
  show($("gate"));
  $("gateError").textContent = msg || "";
}

$("gateForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const f = e.target;
  const body = {
    name: f.name.value.trim(),
    email: f.email.value.trim(),
    consent: f.consent.checked,
    ref: params.get("ref") || (inviteRoom ? "invite" : document.referrer.slice(0, 120)),
  };
  $("gateError").textContent = "";
  $("gateBtn").disabled = true;
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
    show($("gate"), false);
    join();
  } catch (err) {
    $("gateError").textContent = err.message;
  } finally {
    $("gateBtn").disabled = false;
  }
});

$("notYou").addEventListener("click", (e) => {
  e.preventDefault();
  store.del("pa_token");
  token = null;
  openGate();
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
let me = null; // local predicted player { x, z, a, ... }
const views = { players: new Map(), bots: new Map(), pickups: new Map() };
const serverBullets = new Map(); // server bullet id -> visual
const myShots = new Map(); // client shot id -> visual
let shotSeq = 0;
let lastShotAt = 0;
let abilityReadyAt = 0;
let dash = null;
let lastSend = 0;
let driftFor = 0;
let learned = new Set();
let deathTimer = null;

// ---------- joining ----------
async function join() {
  if (!token) return openGate();
  $("playBtn").disabled = true;
  $("menuNote").textContent = "Connecting…";
  try {
    const opts = { token };
    const target = inviteRoom || params.get("room");
    if (target) {
      try { room = await client.joinById(target, opts); }
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
      return openGate("Please sign in again to play.");
    }
    console.error(err);
    return openMenu("Couldn't connect. Check your connection and try again.");
  }
  onJoined();
}
const isGateError = (err) => /gate/i.test(String(err?.message || err));

function onJoined() {
  show($("menu"), false);
  show($("gate"), false);
  show($("hud"));
  history.replaceState(null, "", `?room=${room.roomId}`);
  learned = new Set();
  me = null;
  toast({ color: "#3fd0ff", badge: "?", title: "How to win", text: `Grab all 5 prompt pieces, shoot red ${NAMES.bot}s, tag other players. Share the invite link so friends land in this match.` }, 6000);

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
  room.onMessage("botdown", (m) => effects.burst(m.x, m.z, "#ff3355", 2.5, 1.1));
  room.onMessage("ability", (m) => {
    const p = room.state.players.get(m.o);
    if (p) effects.burst(p.x, p.z, "#3fd0ff", 1.8, 0.9);
  });
  room.onMessage("lesson", onLesson);
  room.onMessage("feed", (m) => feed(m.text));
  room.onMessage("died", onDied);
  room.onMessage("roundEnd", onRoundEnd);
  room.onMessage("roundStart", () => {
    show($("results"), false);
    learned = new Set();
    bullets.clear();
    feed("New round!");
  });
  room.onLeave(() => {
    cleanupRoom();
    openMenu("You left the match.");
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
function onLesson(m) {
  if (m.type === "piece" || m.type === "complete") {
    const p = PIECES[m.kind];
    toast({ color: p.color, badge: p.letter, title: `${p.label} +10`, text: p.tip });
    learned.add(`<b style="color:${p.color}">${p.label}:</b> ${p.tip}`);
    if (m.type === "complete") {
      setTimeout(() => toast({ color: "#ffd23f", badge: "★", title: COMPLETE_LESSON.title, text: COMPLETE_LESSON.tip }, 5000), 400);
      learned.add(`<b style="color:#ffd23f">Full prompt:</b> ${COMPLETE_LESSON.tip}`);
      if (me) effects.burst(me.x, me.z, "#ffd23f", 3, 1);
    }
  } else if (m.type === "bot") {
    const text = HALLUCINATION_LESSONS[m.idx % HALLUCINATION_LESSONS.length];
    toast({ color: "#ff5a6e", badge: "!", title: `${NAMES.bot} busted +50`, text });
    learned.add(`<b style="color:#ff5a6e">Hallucinations:</b> ${text}`);
  }
}

function onDied(m) {
  $("deathBy").textContent = m.by;
  $("deathTip").textContent = m.tip;
  learned.add(`<b style="color:#3fd0ff">Tip:</b> ${m.tip}`);
  show($("death"));
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
  const list = [...room.state.players.entries()].sort((a, b) => b[1].score - a[1].score);
  $("ranking").innerHTML = list.map(([id, p]) =>
    `<li class="${id === room.sessionId ? "me" : ""}" style="--c:${p.color}"><i></i><span>${esc(p.name)} <small>${p.kills} tags · ${p.bots} busts · ${p.prompts} prompts</small></span><b>${p.score}</b></li>`
  ).join("");
  $("learned").innerHTML = learned.size
    ? [...learned].slice(-8).map((l) => `<li>${l}</li>`).join("")
    : "<li>Grab prompt pieces next round to learn the 5 parts of a great prompt.</li>";
  show($("results"));
  let left = m.next;
  $("nextIn").textContent = left;
  const t = setInterval(() => {
    left -= 1;
    $("nextIn").textContent = Math.max(0, left);
    if (left <= 0 || !room) clearInterval(t);
  }, 1000);
}

// ---------- UI helpers ----------
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

function toast({ color, badge, title, text }, ms = 4200) {
  const box = $("toasts");
  while (box.children.length >= 2) box.firstChild.remove();
  const el = document.createElement("div");
  el.className = "toast";
  el.style.setProperty("--c", color);
  el.innerHTML = `<div class="badge">${esc(badge)}</div><div><b>${esc(title)}</b><p>${esc(text)}</p></div>`;
  box.appendChild(el);
  setTimeout(() => { el.classList.add("out"); setTimeout(() => el.remove(), 300); }, ms);
}
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
  const text = `Play ${BRAND.game} with me. It teaches you AI prompting while you play.`;
  if (navigator.share && isTouch) {
    try { await navigator.share({ title: BRAND.game, text, url }); return; } catch {}
  }
  try {
    await navigator.clipboard.writeText(url);
    toast({ color: "#6bff8a", badge: "✓", title: "Invite link copied", text: "Send it to friends. They'll join this exact match." }, 3000);
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
    v.label.position.set(v.x, 2.6, v.z);
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
    let mx = inp.moveX, mz = inp.moveZ;
    let speed = PLAYER.speed;
    if (inp.abilityPressed && performance.now() >= abilityReadyAt) {
      abilityReadyAt = performance.now() + ABILITY.cooldown * 1000;
      const len = Math.hypot(mx, mz);
      const dir = len > 0.1 ? Math.atan2(mx, mz) : me.a;
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
      const r = resolveCircle(me.x + mx * speed * dt, me.z + mz * speed * dt, PLAYER.radius);
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
    v.tile.rotation.y = t * 1.5 + pk.x;
    v.tile.position.y = 1.1 + Math.sin(t * 2 + pk.z) * 0.15;
    const have = (myPieces >> pk.kind) & 1;
    v.mat.opacity = have ? 0.3 : 1;
    v.ring.material.opacity = have ? 0.15 : 0.6;
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
  const key = [timeStr, Math.ceil(p.hp), p.score, p.pieces, ab.toFixed(2), list.map(([i, q]) => q.score + q.name).join()].join("|");
  if (key === lastHud) return;
  lastHud = key;
  $("timer").textContent = timeStr;
  $("timer").classList.toggle("low", tl <= 15);
  $("hpFill").style.width = `${Math.max(0, p.hp)}%`;
  $("score").textContent = p.score;
  PIECES.forEach((_, i) => $(`slot${i}`).classList.toggle("on", !!((p.pieces >> i) & 1)));
  $("abilityCd").style.height = `${ab * 100}%`;
  $("abilityBtn").classList.toggle("ready", ab === 0);
  $("board").innerHTML = list.slice(0, 6).map(([id, q]) =>
    `<li class="${id === room.sessionId ? "me" : ""}" style="--c:${q.color}"><i></i><span>${esc(q.name)}</span><b>${q.score}</b></li>`
  ).join("");
}

// ---------- camera ----------
const camTarget = { x: 0, z: 0 };
function updateCamera(dt) {
  const portrait = innerHeight > innerWidth;
  const h = portrait ? 30 : 21;
  const back = portrait ? 12 : 13;
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
    idleSpin += dt * 0.15; // slow orbit behind the menu
    camTarget.x = Math.sin(idleSpin) * 8;
    camTarget.z = Math.cos(idleSpin) * 8;
  }
  bullets.update(dt, (x, z) => effects.burst(x, z, "#9aa5d1", 0.4));
  effects.update(dt);
  updateCamera(dt);
  world.coreLight.intensity = 26 + Math.sin(t * 3) * 6;
  renderer.render(scene, camera);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

// ---------- boot ----------
if (token) openMenu();
else openGate();
