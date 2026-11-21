import { Room } from "@colyseus/core";
import { ArenaState, Player, Bot, Pickup } from "./state.js";
import { verifyToken, cleanName } from "./leads.js";
import {
  ROUND_SECONDS, INTERMISSION_SECONDS, MAX_PLAYERS, TICK_RATE, ARENA,
  PLAYER, WEAPON, ABILITY, BOT, SCORE, PICKUP_RADIUS, PICKUP_RESPAWN,
  TOKENS, BAG_SIZE, CARD_COUNT, SCAM, ZONE, POWERS, BOT_RAMP, GRACE_SECONDS,
  SPAWNS, PICKUP_SPOTS, COLORS, resolveCircle, pointBlocked,
} from "../shared/game.js";
import { BOT_TIPS, ALL_TERMS } from "../shared/theme.js";

const ALL_CARDS = (1 << CARD_COUNT) - 1;
const CARD = { llm: 0, api: 1, mcp: 2, agent: 3, rag: 4, skills: 5 };
// Overrides for testing: ROUND_SECONDS=20 BOTS=0 SCAM_CHANCE=0 npm start
const ROUND = Number(process.env.ROUND_SECONDS) || ROUND_SECONDS;
const BOT_COUNT = process.env.BOTS !== undefined ? Number(process.env.BOTS) : BOT.count;
const SCAM_CHANCE = process.env.SCAM_CHANCE !== undefined ? Number(process.env.SCAM_CHANCE) : SCAM.chance;
const num = (v) => (typeof v === "number" && Number.isFinite(v) ? v : null);
const rand = (lo, hi) => lo + Math.random() * (hi - lo);

// The bag (context window) is stored as "2,0,5": card indices, oldest first.
const bagOf = (p) => (p.bag ? p.bag.split(",").map(Number) : []);
const hasCard = (p, card) => bagOf(p).includes(card);

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
      p.scam = Math.random() < SCAM_CHANCE;
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
      agentAt: 0,
      zoneAcc: 0,
      graceUntil: Date.now() + GRACE_SECONDS * 1000, // bots leave new players alone
      lessonIdx: Math.floor(Math.random() * BOT_TIPS.length),
      tipIdx: Math.floor(Math.random() * ALL_TERMS.length),
    });
    this.spawnPlayer(client.sessionId, p);
    this.broadcast("feed", { k: "join", n: p.name }, { except: client });
  }

  onLeave(client) {
    const p = this.state.players.get(client.sessionId);
    if (p) this.broadcast("feed", { k: "left", n: p.name });
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
    p.tokens = TOKENS.max;
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
    // Taxi meter empty: you can still shoot, just slower and for free.
    const empty = p.tokens < TOKENS.cost;
    if (now - meta.lastShot < WEAPON.cooldown * (empty ? TOKENS.emptyCooldown : 1) * 1000 * 0.85) return;
    meta.lastShot = now;
    if (!empty) p.tokens -= TOKENS.cost;
    this.fire(client.sessionId, p, a, m?.cid | 0, false);
  }

  fire(ownerId, p, a, cid, agent) {
    const dirX = Math.sin(a), dirZ = Math.cos(a);
    const id = ++this.bulletSeq;
    const b = {
      id,
      owner: ownerId,
      x: p.x + dirX * (PLAYER.radius + 0.25),
      z: p.z + dirZ * (PLAYER.radius + 0.25),
      vx: dirX * WEAPON.speed,
      vz: dirZ * WEAPON.speed,
      left: WEAPON.range,
      dmg: WEAPON.damage * (hasCard(p, CARD.llm) ? POWERS.llmDamage : 1) * (agent ? 0.6 : 1),
    };
    this.bullets.set(id, b);
    this.broadcast("shot", { id, o: ownerId, cid, x: b.x, z: b.z, a, ag: agent ? 1 : 0 });
  }

  handleAbility(client) {
    const p = this.state.players.get(client.sessionId);
    const meta = this.meta.get(client.sessionId);
    if (!p || !meta || !p.alive || this.state.phase !== "playing") return;
    const now = Date.now();
    if (now < meta.abilityAt) return;
    const cd = ABILITY.cooldown * (hasCard(p, CARD.skills) ? POWERS.skillsCooldown : 1);
    meta.abilityAt = now + cd * 1000 * 0.9;
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

    this.state.players.forEach((p, id) => {
      const m = this.meta.get(id);
      if (!m) return;
      if (!p.alive) {
        if (now >= m.respawnAt) this.spawnPlayer(id, p);
        return;
      }
      const sh = now < m.shieldUntil;
      if (p.shield !== sh) p.shield = sh;

      // Token meter refills (MCP card plugs you in: faster)
      if (p.tokens < TOKENS.max) {
        const rate = TOKENS.refill * (hasCard(p, CARD.mcp) ? POWERS.mcpRefill : 1);
        p.tokens = Math.min(TOKENS.max, Math.round((p.tokens + rate * dt) * 100) / 100);
      }
      // API card: the waiter brings food
      if (hasCard(p, CARD.api) && p.hp < PLAYER.maxHp) p.hp = Math.min(PLAYER.maxHp, p.hp + POWERS.apiHeal * dt);
      // Agent card: your assistant fires at the nearest enemy
      if (hasCard(p, CARD.agent) && now >= m.agentAt) {
        const t = this.nearestEnemy(id, p, POWERS.agentRange);
        if (t) {
          this.fire(id, p, Math.atan2(t.x - p.x, t.z - p.z), 0, true);
          m.agentAt = now + POWERS.agentInterval * 1000;
        }
      }
      // LLM zone: standing near the brain scores points
      if (Math.hypot(p.x, p.z) <= ZONE.radius) {
        m.zoneAcc += ZONE.pps * dt;
        if (m.zoneAcc >= 1) {
          const whole = Math.floor(m.zoneAcc);
          p.score += whole;
          m.zoneAcc -= whole;
        }
      }
    });

    this.updateBullets(dt);
    this.updateBots(dt, now);
    this.updatePickups(now);
  }

  nearestEnemy(id, p, range) {
    let best = null;
    let bestD = range;
    for (const [, bot] of this.state.bots) {
      if (!bot.alive) continue;
      const d = Math.hypot(bot.x - p.x, bot.z - p.z);
      if (d < bestD) { bestD = d; best = bot; }
    }
    for (const [oid, o] of this.state.players) {
      if (oid === id || !o.alive) continue;
      const d = Math.hypot(o.x - p.x, o.z - p.z);
      if (d < bestD) { bestD = d; best = o; }
    }
    return best;
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
        for (const [, bot] of this.state.bots) {
          if (!bot.alive) continue;
          if (Math.hypot(bot.x - b.x, bot.z - b.z) < BOT.radius + WEAPON.radius) {
            dead = true;
            bot.hp -= b.dmg;
            if (bot.hp <= 0) this.killBot(bot, b.owner);
            break;
          }
        }
        if (dead) break;
        for (const [id, p] of this.state.players) {
          if (id === b.owner || !p.alive) continue;
          if (Math.hypot(p.x - b.x, p.z - b.z) < PLAYER.radius + WEAPON.radius) {
            dead = true;
            if (!p.shield) this.damagePlayer(id, p, b.dmg, b.owner);
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
    // Ramp up: one bot at the start, one more every BOT_RAMP.every seconds.
    const elapsed = ROUND - this.state.timeLeft;
    const active = Math.min(BOT_COUNT, BOT_RAMP.start + Math.floor(elapsed / BOT_RAMP.every));
    let i = -1;
    for (const [key, bot] of this.state.bots) {
      i++;
      const m = this.botMeta.get(key);
      if (i >= active) {
        if (bot.alive) bot.alive = false;
        continue;
      }
      if (!bot.alive) {
        if (now >= m.respawnAt) this.spawnBot(bot);
        continue;
      }
      let target = null;
      let best = BOT.chaseRange;
      this.state.players.forEach((p, pid) => {
        if (!p.alive || now < (this.meta.get(pid)?.graceUntil || 0)) return;
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
      this.state.players.forEach((p, id) => {
        if (!p.alive || p.shield || now < (this.meta.get(id)?.graceUntil || 0)) return;
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
        if (now >= m.respawnAt) {
          pk.scam = Math.random() < SCAM_CHANCE;
          pk.active = true;
        }
        continue;
      }
      for (const [id, p] of this.state.players) {
        if (!p.alive || Math.hypot(p.x - pk.x, p.z - pk.z) > PICKUP_RADIUS) continue;
        const client = this.clients.getById(id);
        const bag = bagOf(p);

        if (pk.scam) {
          // Prompt injection: the "card" was a scam call. It steals your newest card.
          const lost = bag.length ? bag.pop() : -1;
          p.bag = bag.join(",");
          pk.active = false;
          m.respawnAt = now + PICKUP_RESPAWN * 1000;
          client?.send("lesson", { type: "scam", lost, seconds: SCAM.seconds });
          break;
        }
        if (bag.includes(pk.kind)) continue; // already holding it: leave it for others

        bag.push(pk.kind);
        const dropped = bag.length > BAG_SIZE ? bag.shift() : -1; // context window overflow
        p.bag = bag.join(",");
        p.score += SCORE.card;
        p.learned |= 1 << pk.kind;
        pk.active = false;
        m.respawnAt = now + PICKUP_RESPAWN * 1000;
        client?.send("lesson", { type: "card", kind: pk.kind, dropped });
        if (p.learned === ALL_CARDS) {
          p.learned = 0;
          p.masters += 1;
          p.score += SCORE.master;
          client?.send("lesson", { type: "master" });
          this.broadcast("feed", { k: "master", n: p.name }, { except: client });
        }
        break;
      }
    }
  }

  damagePlayer(id, p, amount, attackerId) {
    p.hp = Math.max(0, p.hp - amount);
    if (p.hp > 0) return;

    const m = this.meta.get(id);
    p.alive = false;
    const bag = bagOf(p);
    const lostCard = bag.length ? bag.pop() : -1; // dying costs only your newest card
    p.bag = bag.join(",");
    if (m) m.respawnAt = Date.now() + PLAYER.respawn * 1000;
    const killer = attackerId ? this.state.players.get(attackerId) : null;
    if (killer) {
      killer.kills += 1;
      killer.score += SCORE.kill;
    }
    this.broadcast("feed", { k: "kill", a: killer ? killer.name : "", v: p.name });
    if (m) m.tipIdx = (m.tipIdx + 1) % ALL_TERMS.length; // cycle so terms don't repeat
    this.clients.getById(id)?.send("died", {
      by: killer ? killer.name : "",
      lost: lostCard,
      tip: m ? m.tipIdx : 0,
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
    m.lessonIdx = (m.lessonIdx + 1) % BOT_TIPS.length;
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
      p.masters = 0;
      p.learned = 0;
      p.bag = "";
      const m = this.meta.get(id);
      if (m) {
        m.zoneAcc = 0;
        m.graceUntil = Date.now() + GRACE_SECONDS * 1000;
      }
      this.spawnPlayer(id, p);
    });
    this.state.pickups.forEach((pk) => {
      pk.scam = Math.random() < SCAM_CHANCE;
      pk.active = true;
    });
    this.state.bots.forEach((b) => this.spawnBot(b));
    this.broadcast("roundStart", { round: this.state.round });
  }
}
