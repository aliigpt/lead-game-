import { Client } from "colyseus.js";
import {
  createWorld, createPlayerMesh, drawPlayerLabel, createBotMesh, createPickupMesh,
  Bullets, Effects, isTouch, setSceneLang,
} from "./scene.js";
import { createInput } from "./input.js";
import {
  PLAYER, WEAPON, ABILITY, ROUND_SECONDS, TOKENS, BAG_SIZE, CARD_COUNT, ZONE, POWERS, resolveCircle,
} from "../shared/game.js";
import { BRAND, CARDS, RULES, BOT_TIPS, ALL_TERMS, MASTER_LESSON, NAMES } from "../shared/theme.js";
import { t, L, getLang, setLang, applyStatic } from "./i18n.js";

const $ = (id) => document.getElementById(id);
const show = (el, on = true) => el.classList.toggle("hidden", !on);
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const CARD = { llm: 0, api: 1, mcp: 2, agent: 3, rag: 4, skills: 5 };
const bagOf = (p) => (p?.bag ? p.bag.split(",").map(Number) : []);
if (isTouch) document.body.classList.add("is-touch");
setLang(getLang());

// Wait (briefly) for the Chinese web font so 3D signs and cards draw with it.
const glyphs = "AI術語大亂鬥茶餐廳涼茶電器冰室大押金舖藥房麻雀士多海鮮粥麵眼鏡酒家書局望右慢的士站旺角嘅大腦作故仔" +
  CARDS.map((c) => c.analogy.zh).join("");
try {
  await Promise.race([
    Promise.all([
      document.fonts.load(`900 40px "Noto Sans HK"`, glyphs),
      document.fonts.load(`900 20px Orbitron`, "LLM0123456789:"),
    ]),
    new Promise((r) => setTimeout(r, 2500)),
  ]);
} catch {}

// ---------- copy ----------
const termLine = (term) =>
  `<span class="term">${esc(term.term)}</span><span class="eq">=</span><span>${esc(L(term.analogy))}</span><span class="emo">${term.emoji}</span>`;

function renderCopy() {
  applyStatic();
  document.title = `${L(BRAND.game)} · @aliigpt`;
  document.querySelectorAll("[data-handle]").forEach((e) => (e.textContent = BRAND.handle));
  $("gameTitle").textContent = L(BRAND.game);
  $("tagline").textContent = L(BRAND.tagline);
  $("consentText").textContent = L(BRAND.consent);
  $("abilityBtn").title = `${L(NAMES.ability)}: ${L(NAMES.abilityHelp)}`;
  $("followBtn").href = BRAND.igUrl;
  $("followBtn").textContent = t("follow", { handle: BRAND.handle });
  $("menuList").innerHTML = ALL_TERMS.map((x) => `<li>${termLine(x)}</li>`).join("");
  $("welcomeList").innerHTML = [RULES.token, RULES.context, RULES.hallucination].map((x) => `<li>${termLine(x)}</li>`).join("");
  $("learnedDots").innerHTML = CARDS.map((c, i) => `<i id="ld${i}" style="--c:${c.color}"></i>`).join("");
  const other = getLang() === "zh" ? "EN" : "中文";
  $("langBtn").textContent = other;
  $("langBtn2").textContent = other;
  if (menuMode) refreshMenuText();
  lastHud = "";
}
function toggleLang() {
  setLang(getLang() === "zh" ? "en" : "zh");
  renderCopy();
  setSceneLang(getLang(), [...views.pickups.values()]);
}
$("langBtn").addEventListener("click", toggleLang);
$("langBtn2").addEventListener("click", toggleLang);

// ---------- storage ----------
const store = {
  get(k) { try { return localStorage.getItem(k); } catch { return null; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch {} },
  del(k) { try { localStorage.removeItem(k); } catch {} },
};

const endpoint = import.meta.env.DEV ? `${location.protocol}//${location.hostname}:2567` : location.origin;
const client = new Client(endpoint);
const params = new URLSearchParams(location.search);
const inviteRoom = params.get("room");
let token = store.get("pa_token");
let myName = store.get("pa_name") || "";

// ---------- menu ----------
let menuMode = null;
let menuNote = "";
function openMenu(mode, note = "") {
  menuMode = mode;
  menuNote = note;
  show($("hud"), false);
  goStep(mode === "returning" ? "welcome" : mode === "reauth" ? "gate" : "start");
  refreshMenuText();
  $("gateError").textContent = mode === "reauth" || mode === "new" ? note : "";
  show($("menu"));
}
function refreshMenuText() {
  $("welcomeKicker").textContent = inviteRoom ? t("invited") : t("welcome");
  $("welcomeName").textContent = myName;
  $("welcomeNote").textContent = menuNote || (inviteRoom ? t("invitedNote") : t("welcomeNote"));
  $("playBtn").textContent = inviteRoom ? t("joinMatch") : t("play");
  $("playBtn").disabled = false;
  $("gateBtn").textContent = t("playNow");
  $("gateBtn").disabled = false;
}
function goStep(name) {
  document.querySelectorAll("#menu .step").forEach((s) => s.classList.toggle("on", s.dataset.step === name));
  $("menu").scrollTop = 0;
}
$("startBtn").addEventListener("click", () => goStep("gate"));
$("backBtn").addEventListener("click", (e) => { e.preventDefault(); goStep("start"); });
$("notYou").addEventListener("click", (e) => {
  e.preventDefault();
  store.del("pa_token");
  token = null;
  openMenu("new");
});
$("playBtn").addEventListener("click", () => join());

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
  $("gateBtn").textContent = t("unlocking");
  try {
    const res = await fetch("/api/lead", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(t(`err_${data.code || "generic"}`));
    token = data.token;
    myName = data.name;
    store.set("pa_token", token);
    store.set("pa_name", myName);
    await join();
  } catch (err) {
    $("gateError").textContent = err.message;
    $("gateBtn").disabled = false;
    $("gateBtn").textContent = t("playNow");
  }
});

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
const serverBullets = new Map();
const myShots = new Map();
let shotSeq = 0;
let lastShotAt = 0;
let abilityReadyAt = 0;
let abilityCdMs = ABILITY.cooldown * 1000;
let dash = null;
let lastSend = 0;
let driftFor = 0;
let learned = new Map();
let deathTimer = null;
let roundMax = ROUND_SECONDS;
let scamUntil = 0;
let tokensLocal = TOKENS.max;
let tokenLessonShown = false;
let lastHud = "";

// ---------- joining ----------
async function join() {
  if (!token) return openMenu("new");
  $("playBtn").disabled = true;
  $("playBtn").textContent = t("connecting");
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
      return openMenu("reauth", t("reauth"));
    }
    console.error(err);
    return openMenu(token ? "returning" : "new", t("cantConnect"));
  }
  onJoined();
}
const isGateError = (err) => /gate/i.test(String(err?.message || err));

function onJoined() {
  menuMode = null;
  show($("menu"), false);
  show($("hud"));
  history.replaceState(null, "", `?room=${room.roomId}`);
  learned = new Map();
  me = null;
  tokenLessonShown = false;
  roundMax = Math.max(1, room.state.timeLeft || ROUND_SECONDS);
  $("meName").textContent = myName;
  toast({ c: "#c8102e", emo: "🥊", title: t("youreIn"), text: t("youreInText") }, 6000);

  room.onMessage("shot", (m) => {
    if (m.o === room.sessionId && !m.ag) {
      const b = myShots.get(m.cid);
      if (b) { serverBullets.set(m.id, b); myShots.delete(m.cid); }
      return;
    }
    const p = room.state.players.get(m.o);
    serverBullets.set(m.id, bullets.spawn(m.x, m.z, m.a, m.ag ? "#ffcc00" : p?.color || "#fff", m.ag ? 0.75 : 1));
  });
  room.onMessage("bx", (m) => {
    const b = serverBullets.get(m.id);
    serverBullets.delete(m.id);
    if (b && !b.dead) bullets.remove(b);
    effects.burst(m.x, m.z, b?.mesh.material.color.getStyle() || "#fff", 0.6);
  });
  room.onMessage("botdown", (m) => { effects.burst(m.x, m.z, "#a64dff", 2.5, 1.1); effects.pop(m.x, m.z, "🤥"); });
  room.onMessage("ability", (m) => {
    const p = room.state.players.get(m.o);
    if (p) effects.burst(p.x, p.z, "#3ce0ff", 1.8, 0.9);
  });
  room.onMessage("lesson", onLesson);
  room.onMessage("feed", onFeed);
  room.onMessage("died", onDied);
  room.onMessage("roundEnd", onRoundEnd);
  room.onMessage("roundStart", () => {
    show($("results"), false);
    learned = new Map();
    tokenLessonShown = false;
    bullets.clear();
    roundMax = Math.max(1, room.state.timeLeft || ROUND_SECONDS);
    feed(t("newRound"));
  });
  room.onLeave(() => {
    cleanupRoom();
    openMenu(token ? "returning" : "new", t("leftMatch"));
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

// ---------- lessons ----------
const learn = (term) => learned.set(term.term, term);
const termTitle = (term) => `${term.term} = ${L(term.analogy)}`;

function onLesson(m) {
  if (m.type === "card") {
    const c = CARDS[m.kind];
    toast({ c: c.color, emo: c.emoji, title: `${termTitle(c)} +10`, text: L(c.explain), power: `${t("cardPower")}${L(c.power)}` });
    learn(c);
    if (me) effects.pop(me.x, me.z, c.emoji);
    if (m.dropped >= 0) {
      const d = CARDS[m.dropped];
      setTimeout(() => toast({
        c: RULES.context.color, emo: "🎒", title: t("bagFull", { card: d.term }),
        text: `${termTitle(RULES.context)}. ${L(RULES.context.explain)}`,
      }, 5000), 500);
      learn(RULES.context);
    }
  } else if (m.type === "master") {
    setTimeout(() => toast({ c: "#ffcc00", emo: "🎓", title: L(MASTER_LESSON.title), text: L(MASTER_LESSON.text) }, 5000), 300);
    if (me) effects.pop(me.x, me.z, "🎓", 8);
  } else if (m.type === "scam") {
    scamUntil = performance.now() + m.seconds * 1000;
    $("scamFx").classList.add("on");
    setTimeout(() => $("scamFx").classList.remove("on"), m.seconds * 1000);
    const lostText = m.lost >= 0 ? t("scamLost", { card: CARDS[m.lost].term, s: m.seconds }) : t("scamNoLoss", { s: m.seconds });
    toast({
      c: RULES.injection.color, emo: "📞", title: `${t("scamTitle")} ${termTitle(RULES.injection)}`,
      text: `${lostText} ${L(RULES.injection.explain)}`, power: t("scamTell"),
    }, 6000);
    learn(RULES.injection);
    if (me) effects.pop(me.x, me.z, "📞", 3);
    flash();
  } else if (m.type === "bot") {
    const tip = BOT_TIPS[m.idx % BOT_TIPS.length];
    toast({ c: RULES.hallucination.color, emo: "🤥", title: t("botBusted"), text: L(tip), power: termTitle(RULES.hallucination) });
    learn(RULES.hallucination);
  }
}

function onFeed(m) {
  if (m.k === "join") feed(t("joined", { n: m.n }));
  else if (m.k === "left") feed(t("left", { n: m.n }));
  else if (m.k === "kill") feed(m.a ? t("killFeed", { a: m.a, v: m.v }) : t("botKillFeed", { v: m.v }));
  else if (m.k === "master") feed(t("masterFeed", { n: m.n }));
}

function termCardHtml(term) {
  return `<div class="line">${termLine(term)}</div><p>${esc(L(term.explain))}</p>`;
}

function onDied(m) {
  $("deathBy").textContent = m.by ? t("deletedBy", { name: m.by }) : t("deletedByBot");
  const term = ALL_TERMS[m.tip % ALL_TERMS.length];
  $("deathTerm").innerHTML = termCardHtml(term);
  learn(term);
  show($("death"));
  flash();
  let left = Math.ceil(m.respawn);
  $("deathCount").textContent = t("lostBag", { n: left });
  clearInterval(deathTimer);
  deathTimer = setInterval(() => {
    left -= 1;
    $("deathCount").textContent = t("lostBag", { n: Math.max(0, left) });
    if (left <= 0) { clearInterval(deathTimer); show($("death"), false); }
  }, 1000);
}

function onRoundEnd(m) {
  show($("death"), false);
  clearInterval(deathTimer);
  const list = [...room.state.players.entries()].sort((a, b) => b[1].score - a[1].score);
  const [topId, top] = list[0] || [];
  $("roundNo").textContent = String(room.state.round).padStart(3, "0");
  $("winnerLine").textContent = !top ? "" : topId === room.sessionId ? t("youWon") : t("wins", { name: top.name });
  $("ranking").innerHTML = list.map(([id, p], i) => `
    <li class="${id === room.sessionId ? "me" : ""}">
      <span class="pos">${i + 1}</span>
      <span class="who"><b>${esc(p.name)}</b><small>${esc(t("statLine", { k: p.kills, b: p.bots, m: p.masters }))}</small></span>
      <span class="pts">${p.score}</span>
    </li>`).join("");
  const items = [...learned.values()];
  $("learned").innerHTML = items.length
    ? items.map((x) => `<li>${termLine(x)}</li>`).join("")
    : `<li>${esc(t("nothingLearned"))}</li>`;
  show($("results"));
  let left = m.next;
  $("nextIn").textContent = t("nextIn", { n: left });
  const timer = setInterval(() => {
    left -= 1;
    $("nextIn").textContent = t("nextIn", { n: Math.max(0, left) });
    if (left <= 0 || !room) clearInterval(timer);
  }, 1000);
}

// ---------- UI helpers ----------
function toast({ c, emo, title, text, power }, ms = 4500) {
  const box = $("toasts");
  while (box.children.length >= 2) box.firstChild.remove();
  const el = document.createElement("div");
  el.className = "toast";
  el.style.setProperty("--c", c);
  el.innerHTML = `<div class="emo">${emo}</div><div><b class="t">${esc(title)}</b><p>${esc(text)}</p>${power ? `<div class="pw">${esc(power)}</div>` : ""}</div>`;
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
  if (navigator.share && isTouch) {
    try { await navigator.share({ title: L(BRAND.game), text: t("shareText"), url }); return; } catch {}
  }
  try {
    await navigator.clipboard.writeText(url);
    toast({ c: "#1f6b47", emo: "✅", title: t("linkCopied"), text: t("linkCopiedText") }, 3000);
  } catch {
    prompt(t("copyPrompt"), url);
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

function syncPlayers(dt, time) {
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
    v.body.position.y = 0.9 + Math.sin(time * 6 + v.x) * 0.04;
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

// RAG card: snap aim to the nearest enemy inside a cone around your aim.
function ragAim(a) {
  let best = null, bestD = POWERS.ragRange;
  const consider = (x, z) => {
    const d = Math.hypot(x - me.x, z - me.z);
    if (d >= bestD) return;
    let diff = Math.atan2(x - me.x, z - me.z) - a;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    if (Math.abs(diff) <= POWERS.ragCone) { bestD = d; best = a + diff; }
  };
  room.state.bots.forEach((b) => b.alive && consider(b.x, b.z));
  room.state.players.forEach((p, id) => id !== room.sessionId && p.alive && consider(p.x, p.z));
  return best ?? a;
}

function updateMe(p, v, dt) {
  if (!me || v.seq !== p.spawnSeq) {
    me = { x: p.x, z: p.z, a: p.a };
    v.seq = p.spawnSeq;
    dash = null;
    tokensLocal = p.tokens;
  }
  const bag = bagOf(p);
  const playing = room.state.phase === "playing" && p.alive;
  const inp = input.update(me.x, me.z);
  if (inp.aim !== null) me.a = inp.aim;
  const now = performance.now();

  // token meter prediction (server is the authority; snap back if we drift)
  const rate = TOKENS.refill * (bag.includes(CARD.mcp) ? POWERS.mcpRefill : 1);
  tokensLocal = Math.min(TOKENS.max, tokensLocal + rate * dt);
  if (Math.abs(tokensLocal - p.tokens) > 3) tokensLocal = p.tokens;
  abilityCdMs = ABILITY.cooldown * 1000 * (bag.includes(CARD.skills) ? POWERS.skillsCooldown : 1);

  if (playing) {
    let mx = inp.moveX, mz = inp.moveZ;
    if (now < scamUntil) { mx = -mx; mz = -mz; } // phone scam: controls flipped
    if (inp.abilityPressed && now >= abilityReadyAt) {
      abilityReadyAt = now + abilityCdMs;
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

    if (inp.firing && now - lastShotAt >= WEAPON.cooldown * 1000) {
      if (tokensLocal >= TOKENS.cost) {
        lastShotAt = now;
        tokensLocal -= TOKENS.cost;
        if (bag.includes(CARD.rag)) me.a = ragAim(me.a);
        const cid = (shotSeq = (shotSeq + 1) % 1e6);
        const ox = me.x + Math.sin(me.a) * (PLAYER.radius + 0.25);
        const oz = me.z + Math.cos(me.a) * (PLAYER.radius + 0.25);
        myShots.set(cid, bullets.spawn(ox, oz, me.a, p.color));
        if (myShots.size > 40) myShots.delete(myShots.keys().next().value);
        room.send("shoot", { a: me.a, cid });
      } else if (!tokenLessonShown) {
        tokenLessonShown = true;
        toast({ c: RULES.token.color, emo: "🚕", title: `${t("noTokens")} ${termTitle(RULES.token)}`, text: L(RULES.token.explain) }, 5000);
        learn(RULES.token);
      }
    }

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

function syncBots(dt, time) {
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
    v.core.rotation.set(time * 1.7, time * 2.3, 0);
    v.shell.rotation.set(-time, time * 0.8, time * 0.5);
    v.core.scale.setScalar(0.7 + (b.hp / 40) * 0.3);
  });
}

function syncPickups(time) {
  const bag = bagOf(room.state.players.get(room.sessionId));
  room.state.pickups.forEach((pk, id) => {
    let v = views.pickups.get(id);
    if (!v) {
      v = createPickupMesh(pk.kind);
      v.group.position.set(pk.x, 0, pk.z);
      scene.add(v.group);
      views.pickups.set(id, v);
    }
    if (v.scam !== pk.scam) v.refresh(pk.scam);
    v.group.visible = pk.active;
    v.tile.position.y = 1.6 + Math.sin(time * 2 + pk.z) * 0.12;
    // the scam tell: fake cards shake like a ringing phone
    v.mat.rotation = pk.scam ? Math.sin(time * 28) * 0.09 : 0;
    v.mat.opacity = !pk.scam && bag.includes(pk.kind) ? 0.35 : 1; // already in your bag
  });
}

// ---------- HUD ----------
function updateHud() {
  const p = room.state.players.get(room.sessionId);
  if (!p) return;
  const tl = Math.ceil(room.state.timeLeft);
  const timeStr = `${Math.floor(tl / 60)}:${String(tl % 60).padStart(2, "0")}`;
  const ab = Math.max(0, abilityReadyAt - performance.now()) / abilityCdMs;
  const list = [...room.state.players.entries()].sort((a, b) => b[1].score - a[1].score);
  const rank = list.findIndex(([id]) => id === room.sessionId) + 1;
  const tok = Math.floor(tokensLocal);
  const inZone = p.alive && me && Math.hypot(me.x, me.z) <= ZONE.radius;
  const key = [timeStr, Math.ceil(p.hp), p.score, p.bag, p.learned, tok, ab.toFixed(2), inZone, p.color, list.map(([, q]) => q.score + q.name).join()].join("|");
  if (key === lastHud) return;
  lastHud = key;

  $("timer").textContent = timeStr;
  $("timer").parentElement.classList.toggle("low", tl <= 15);
  $("meDot").style.background = p.color;
  $("hpFill").style.width = `${Math.max(0, p.hp)}%`;
  $("hpFill").parentElement.classList.toggle("low", p.hp <= 35);
  $("meRank").textContent = list.length > 1 ? `#${rank} · ${p.score} ${t("pts")}` : `${p.score} ${t("pts")}`;

  $("tokenNum").textContent = tok;
  $("tokenFill").style.width = `${(tokensLocal / TOKENS.max) * 100}%`;
  $("meter").classList.toggle("empty", tok < TOKENS.cost);

  const bag = bagOf(p);
  $("bagCount").textContent = `${bag.length}/${BAG_SIZE}`;
  $("bagSlots").innerHTML = Array.from({ length: BAG_SIZE }, (_, i) => {
    const k = bag[i];
    if (k === undefined) return `<div class="slot"></div>`;
    const c = CARDS[k];
    const old = bag.length === BAG_SIZE && i === 0 ? " old" : "";
    return `<div class="slot full${old}" style="--c:${c.color}" title="${esc(L(c.power))}"><span class="e">${c.emoji}</span><span class="t">${esc(c.term)}</span></div>`;
  }).join("");
  for (let i = 0; i < CARD_COUNT; i++) $(`ld${i}`)?.classList.toggle("on", !!((p.learned >> i) & 1));
  show($("zoneBadge"), inZone);

  $("abilityBtn").style.setProperty("--cd", ab.toFixed(3));
  $("abilityBtn").classList.toggle("ready", ab === 0);
  $("board").innerHTML = list.length < 2 ? "" : list.slice(0, 5).map(([id, q]) =>
    `<li class="${id === room.sessionId ? "me" : ""}"><i style="background:${q.color}"></i><span>${esc(q.name)}</span>${q.score}</li>`
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
  const time = now / 1000;
  if (room?.state?.players) {
    syncPlayers(dt, time);
    syncBots(dt, time);
    syncPickups(time);
    updateHud();
  } else {
    idleSpin += dt * 0.12; // slow drift behind the menu
    camTarget.x = Math.sin(idleSpin) * 10;
    camTarget.z = Math.cos(idleSpin) * 6 - 4;
  }
  bullets.update(dt, (x, z) => effects.burst(x, z, "#d8d2c3", 0.4));
  effects.update(dt);
  world.update(time);
  updateCamera(dt);
  renderer.render(scene, camera);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

// ---------- boot ----------
// Test hook: ?debug exposes read-only state for automated screenshots.
if (params.has("debug")) window.__pa = { me: () => me, state: () => room?.state };
renderCopy();
openMenu(token ? "returning" : "new");
