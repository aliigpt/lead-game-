import { Room } from "@colyseus/core";
import { ArenaState, Player, Bot, Pickup } from "./state.js";
import { verifyToken, cleanName } from "./leads.js";
import {
  ROUND_SECONDS, INTERMISSION_SECONDS, MAX_PLAYERS, TICK_RATE, ARENA,
  PLAYER, WEAPON, ABILITY, BOT, SCORE, PICKUP_RADIUS, PICKUP_RESPAWN,
  SPAWNS, PICKUP_SPOTS, COLORS, resolveCircle, pointBlocked,
} from "../shared/game.js";
import { HALLUCINATION_LESSONS, RESPAWN_TIPS, NAMES } from "../shared/theme.js";

const FULL_PROMPT = 0b11111;
// Override for testing: ROUND_SECONDS=20 npm start
const ROUND = Number(process.env.ROUND_SECONDS) || ROUND_SECONDS;
const BOT_COUNT = process.env.BOTS !== undefined ? Number(process.env.BOTS) : BOT.count;
const num = (v) => (typeof v === "number" && Number.isFinite(v) ? v : null);
const rand = (lo, hi) => lo + Math.random() * (hi - lo);

export class ArenaRoom extends Room {
  maxClients = MAX_PLAYERS;

  onCreate() {
    this.setState(new ArenaState());
    this.meta = new Map(); // per-player server-only data
    this.bullets = new Map();
    this.botMeta = new Map();
    this.pickupMeta = new Map();
    this.bulletSeq = 0;
    this.endsAt = 0;

    PICKUP_SPOTS.forEach((s, i) => {
      const p = new Pickup();
      p.x = s.x;
      p.z = s.z;
      p.kind = s.kind;
      this.state.pickups.set(`p${i}`, p);
      this.pickupMeta.set(`p${i}`, { respawnAt: 0 });
    });
    for (let i = 0; i < BOT_COUNT; i++) {
      const b = new Bot();
      this.state.bots.set(`b${i}`, b);
      this.botMeta.set(`b${i}`, { respawnAt: 0, wx: 0, wz: 0, nextWander: 0 });
      this.spawnBot(b);
    }
    this.state.timeLeft = ROUND;

    this.onMessage("move", (client, m) => this.handleMove(client, m));
    this.onMessage("shoot", (client, m) => this.handleShoot(client, m));
    this.onMessage("ability", (client) => this.handleAbility(client));

    this.setPatchRate(50);
    this.setSimulationInterval((dt) => this.update(Math.min(dt, 100) / 1000), 1000 / TICK_RATE);
  }

  onAuth(client, options) {
    const auth = verifyToken(options?.token);
    if (!auth) throw new Error("gate");
    return auth;
  }

  onJoin(client, options, auth) {
    const p = new Player();
    p.name = cleanName(auth?.n) || "Player";
    const used = new Set([...this.state.players.values()].map((x) => x.color));
    p.color = COLORS.find((c) => !used.has(c)) || COLORS[this.clients.length % COLORS.length];
    this.state.players.set(client.sessionId, p);
    this.meta.set(client.sessionId, {
      budget: 0,
      lastMoveAt: Date.now(),
      lastShot: 0,
      abilityAt: 0,
      shieldUntil: 0,
      respawnAt: 0,
      lessonIdx: Math.floor(Math.random() * HALLUCINATION_LESSONS.length),
    });
    this.spawnPlayer(client.sessionId, p);
    this.broadcast("feed", { text: `${p.name} joined` }, { except: client });
  }

  onLeave(client) {
    const p = this.state.players.get(client.sessionId);
    if (p) this.broadcast("feed", { text: `${p.name} left` });
    this.state.players.delete(client.sessionId);
    this.meta.delete(client.sessionId);
  }

  // ---------- spawning ----------

  spawnPlayer(id, p) {
    const others = [...this.state.players.entries()].filter(([k, o]) => k !== id && o.alive);
    let best = SPAWNS[0];
    let bestD = -1;
    for (const s of SPAWNS) {
      let d = Infinity;
      for (const [, o] of others) d = Math.min(d, Math.hypot(o.x - s.x, o.z - s.z));
      d += Math.random() * 4; // a little variety
      if (d > bestD) { bestD = d; best = s; }
    }
    p.x = best.x;
    p.z = best.z;
    p.a = Math.atan2(-best.x, -best.z);
    p.hp = PLAYER.maxHp;
    p.alive = true;
    p.spawnSeq = (p.spawnSeq + 1) % 65535;
    const m = this.meta.get(id);
    if (m) {
      m.shieldUntil = Date.now() + 1500;
      m.budget = 0;
      m.lastMoveAt = Date.now();
    }
  }

  spawnBot(b) {
    for (let tries = 0; tries < 30; tries++) {
      const x = rand(-ARENA + 3, ARENA - 3);
      const z = rand(-ARENA + 3, ARENA - 3);
      if (pointBlocked(x, z)) continue;
      let near = false;
      this.state.players.forEach((p) => {
        if (p.alive && Math.hypot(p.x - x, p.z - z) < 10) near = true;
      });
      if (near && tries < 25) continue;
      const r = resolveCircle(x, z, BOT.radius);
      b.x = r.x;
      b.z = r.z;
      break;
    }
    b.hp = BOT.hp;
    b.alive = true;
  }

  // ---------- input ----------

  handleMove(client, m) {
    const p = this.state.players.get(client.sessionId);
    const meta = this.meta.get(client.sessionId);
    if (!p || !meta || !p.alive || this.state.phase !== "playing") return;
    const x = num(m?.x), z = num(m?.z), a = num(m?.a);
    if (x === null || z === null || a === null) return;

    // Movement budget: client moves itself, server caps distance per time.
    const now = Date.now();
    const dt = Math.min((now - meta.lastMoveAt) / 1000, 0.5);
    meta.lastMoveAt = now;
    meta.budget = Math.min(meta.budget + PLAYER.speed * dt * 1.3, PLAYER.speed * 0.4 + (meta.dashBonus || 0));

    let dx = x - p.x, dz = z - p.z;
    let d = Math.hypot(dx, dz);
    if (d > meta.budget) {
      const s = meta.budget / d;
      dx *= s; dz *= s; d = meta.budget;
    }
    meta.budget -= d;
    if (meta.dashBonus) meta.dashBonus = Math.max(0, meta.dashBonus - d);
    const r = resolveCircle(p.x + dx, p.z + dz, PLAYER.radius);
    p.x = r.x;
    p.z = r.z;
    p.a = a;
  }

  handleShoot(client, m) {
    const p = this.state.players.get(client.sessionId);
    const meta = this.meta.get(client.sessionId);
    if (!p || !meta || !p.alive || this.state.phase !== "playing") return;
    const a = num(m?.a);
    if (a === null) return;
    const now = Date.now();
    if (now - meta.lastShot < WEAPON.cooldown * 1000 * 0.85) return;
    meta.lastShot = now;
    const dirX = Math.sin(a), dirZ = Math.cos(a);
    const id = ++this.bulletSeq;
    const b = {
      id,
      owner: client.sessionId,
      x: p.x + dirX * (PLAYER.radius + 0.25),
      z: p.z + dirZ * (PLAYER.radius + 0.25),
      vx: dirX * WEAPON.speed,
      vz: dirZ * WEAPON.speed,
      left: WEAPON.range,
    };
    this.bullets.set(id, b);
    this.broadcast("shot", { id, o: client.sessionId, cid: m?.cid | 0, x: b.x, z: b.z, a });
  }

  handleAbility(client) {
    const p = this.state.players.get(client.sessionId);
    const meta = this.meta.get(client.sessionId);
    if (!p || !meta || !p.alive || this.state.phase !== "playing") return;
    const now = Date.now();
    if (now < meta.abilityAt) return;
    meta.abilityAt = now + ABILITY.cooldown * 1000 * 0.9;
    meta.dashBonus = ABILITY.dashDistance + 0.5;
    meta.budget += ABILITY.dashDistance + 0.5;
    meta.shieldUntil = Math.max(meta.shieldUntil, now + ABILITY.shield * 1000);
    p.hp = Math.min(PLAYER.maxHp, p.hp + ABILITY.heal);
    this.broadcast("ability", { o: client.sessionId });
  }

  // ---------- simulation ----------

  update(dt) {
    const now = Date.now();
    if (this.state.phase === "ended") {
      if (now >= this.endsAt) this.resetRound();
      return;
    }
    this.state.timeLeft = Math.max(0, this.state.timeLeft - dt);
    if (this.state.timeLeft <= 0) return this.endRound();

    // players: respawn + shield flag
    this.state.players.forEach((p, id) => {
      const m = this.meta.get(id);
      if (!m) return;
      if (!p.alive && now >= m.respawnAt) this.spawnPlayer(id, p);
      const sh = now < m.shieldUntil;
      if (p.shield !== sh) p.shield = sh;
    });

    this.updateBullets(dt);
    this.updateBots(dt, now);
    this.updatePickups(now);
  }

  updateBullets(dt) {
    for (const b of this.bullets.values()) {
      const step = WEAPON.speed * dt;
      const n = Math.max(1, Math.ceil(step / 0.4));
      let dead = false;
      for (let i = 0; i < n && !dead; i++) {
        b.x += (b.vx * dt) / n;
        b.z += (b.vz * dt) / n;
        b.left -= step / n;
        if (b.left <= 0 || pointBlocked(b.x, b.z)) { dead = true; break; }
        // bots
        for (const [, bot] of this.state.bots) {
          if (!bot.alive) continue;
          if (Math.hypot(bot.x - b.x, bot.z - b.z) < BOT.radius + WEAPON.radius) {
            dead = true;
            bot.hp -= WEAPON.damage;
            if (bot.hp <= 0) this.killBot(bot, b.owner);
            break;
          }
        }
        if (dead) break;
        // players
        for (const [id, p] of this.state.players) {
          if (id === b.owner || !p.alive) continue;
          if (Math.hypot(p.x - b.x, p.z - b.z) < PLAYER.radius + WEAPON.radius) {
            dead = true;
            if (!p.shield) this.damagePlayer(id, p, WEAPON.damage, b.owner);
            break;
          }
        }
      }
      if (dead) {
        this.bullets.delete(b.id);
        this.broadcast("bx", { id: b.id, x: b.x, z: b.z });
      }
    }
  }

  updateBots(dt, now) {
    for (const [key, bot] of this.state.bots) {
      const m = this.botMeta.get(key);
      if (!bot.alive) {
        if (now >= m.respawnAt) this.spawnBot(bot);
        continue;
      }
      let target = null;
      let best = BOT.chaseRange;
      this.state.players.forEach((p) => {
        if (!p.alive) return;
        const d = Math.hypot(p.x - bot.x, p.z - bot.z);
        if (d < best) { best = d; target = p; }
      });
      let tx, tz;
      if (target) { tx = target.x; tz = target.z; }
      else {
        if (now > m.nextWander || Math.hypot(m.wx - bot.x, m.wz - bot.z) < 1) {
          m.wx = rand(-ARENA + 3, ARENA - 3);
          m.wz = rand(-ARENA + 3, ARENA - 3);
          m.nextWander = now + 5000;
        }
        tx = m.wx; tz = m.wz;
      }
      const dx = tx - bot.x, dz = tz - bot.z;
      const d = Math.hypot(dx, dz);
      if (d > 0.01) {
        const sp = BOT.speed * (target ? 1 : 0.6) * dt;
        const r = resolveCircle(bot.x + (dx / d) * sp, bot.z + (dz / d) * sp, BOT.radius);
        bot.x = r.x;
        bot.z = r.z;
      }
      // contact damage
      this.state.players.forEach((p, id) => {
        if (!p.alive || p.shield) return;
        if (Math.hypot(p.x - bot.x, p.z - bot.z) < BOT.radius + PLAYER.radius + 0.1) {
          this.damagePlayer(id, p, BOT.touchDps * dt, null);
        }
      });
    }
  }

  updatePickups(now) {
    for (const [key, pk] of this.state.pickups) {
      const m = this.pickupMeta.get(key);
      if (!pk.active) {
        if (now >= m.respawnAt) pk.active = true;
        continue;
      }
      const bit = 1 << pk.kind;
      for (const [id, p] of this.state.players) {
        if (!p.alive || p.pieces & bit) continue;
        if (Math.hypot(p.x - pk.x, p.z - pk.z) > PICKUP_RADIUS) continue;
        pk.active = false;
        m.respawnAt = now + PICKUP_RESPAWN * 1000;
        p.pieces |= bit;
        p.score += SCORE.piece;
        const client = this.clients.getById(id);
        if (p.pieces === FULL_PROMPT) {
          p.pieces = 0;
          p.prompts += 1;
          p.score += SCORE.complete;
          client?.send("lesson", { type: "complete", kind: pk.kind });
          this.broadcast("feed", { text: `${p.name} built a full prompt!` }, { except: client });
        } else {
          client?.send("lesson", { type: "piece", kind: pk.kind });
        }
        break;
      }
    }
  }

  damagePlayer(id, p, amount, attackerId) {
    p.hp = Math.max(0, p.hp - amount);
    const m = this.meta.get(id);
    if (m) m.lastAttacker = attackerId;
    if (p.hp > 0) return;

    p.alive = false;
    p.pieces = 0;
    if (m) m.respawnAt = Date.now() + PLAYER.respawn * 1000;
    const killer = attackerId ? this.state.players.get(attackerId) : null;
    if (killer) {
      killer.kills += 1;
      killer.score += SCORE.kill;
    }
    const by = killer ? killer.name : `a ${NAMES.bot}`;
    this.broadcast("feed", { text: `${by} ⟶ ${p.name}` });
    this.clients.getById(id)?.send("died", {
      by,
      tip: RESPAWN_TIPS[Math.floor(Math.random() * RESPAWN_TIPS.length)],
      respawn: PLAYER.respawn,
    });
  }

  killBot(bot, ownerId) {
    bot.alive = false;
    const key = [...this.state.bots.entries()].find(([, b]) => b === bot)?.[0];
    if (key) this.botMeta.get(key).respawnAt = Date.now() + BOT.respawn * 1000;
    this.broadcast("botdown", { x: bot.x, z: bot.z });
    const p = this.state.players.get(ownerId);
    const m = this.meta.get(ownerId);
    if (!p || !m) return;
    p.bots += 1;
    p.score += SCORE.bot;
    m.lessonIdx = (m.lessonIdx + 1) % HALLUCINATION_LESSONS.length;
    this.clients.getById(ownerId)?.send("lesson", { type: "bot", idx: m.lessonIdx });
  }

  // ---------- rounds ----------

  endRound() {
    this.state.phase = "ended";
    this.endsAt = Date.now() + INTERMISSION_SECONDS * 1000;
    this.bullets.clear();
    this.broadcast("roundEnd", { next: INTERMISSION_SECONDS });
  }

  resetRound() {
    this.state.round += 1;
    this.state.timeLeft = ROUND;
    this.state.phase = "playing";
    this.state.players.forEach((p, id) => {
      p.score = 0;
      p.kills = 0;
      p.bots = 0;
      p.prompts = 0;
      p.pieces = 0;
      this.spawnPlayer(id, p);
    });
    this.state.pickups.forEach((pk) => (pk.active = true));
    this.state.bots.forEach((b) => this.spawnBot(b));
    this.broadcast("roundStart", { round: this.state.round });
  }
}
