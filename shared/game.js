// Shared rules and physics used by both the server (authoritative) and the
// client (prediction + visuals). Units are meters, time in seconds.

export const ROUND_SECONDS = 150; // 2:30 rounds
export const INTERMISSION_SECONDS = 12;
export const MAX_PLAYERS = 8;
export const TICK_RATE = 30;

export const ARENA = 26; // half-size of the square arena

export const PLAYER = {
  radius: 0.6,
  speed: 7.5,
  maxHp: 100,
  respawn: 1.5,
};

export const WEAPON = {
  cooldown: 0.2,
  speed: 30,
  range: 24,
  damage: 20,
  radius: 0.18,
};

export const ABILITY = {
  cooldown: 6,
  dashDistance: 6,
  dashTime: 0.18,
  shield: 0.6,
  heal: 25,
};

export const BOT = {
  count: 4,
  radius: 0.8,
  hp: 30,
  speed: 3.0,
  chaseRange: 11,
  touchDps: 12,
  respawn: 6,
};

export const SCORE = {
  kill: 100,
  bot: 50,
  card: 10,
  master: 250, // all six cards learned in one round
};

// Token = taxi meter: every shot costs tokens, the meter refills over time.
// At 0 tokens you can still shoot, just slower (emptyCooldown x the normal rate).
export const TOKENS = { max: 20, refill: 4, cost: 1, emptyCooldown: 3 };
// Bots ramp up: `start` at the beginning, one more every `every` seconds.
export const BOT_RAMP = { start: 1, every: 30 };
// New players are ignored by bots for this long after joining or a new round.
export const GRACE_SECONDS = 15;
// Auto-shoot (phones): fires at the nearest enemy in range and in sight.
export const AUTO_AIM_RANGE = 13;
// Context window = schoolbag: holds this many cards, oldest falls out.
export const BAG_SIZE = 3;
export const CARD_COUNT = 6;
// Prompt injection = phone scam: some cards are fakes.
export const SCAM = { chance: 0.25, seconds: 3 };
// Standing near the LLM brain in the middle scores points.
export const ZONE = { radius: 5.6, pps: 4 };
// Card powers
export const POWERS = {
  llmDamage: 1.5,
  apiHeal: 5, // hp per second
  mcpRefill: 2, // token refill multiplier
  agentInterval: 0.7, // seconds between assistant shots
  agentRange: 11,
  ragCone: 0.55, // radians either side of your aim
  ragRange: 18,
  skillsCooldown: 0.5,
};

export const PICKUP_RADIUS = 1.8;
export const PICKUP_RESPAWN = 8;

// Map: a Hong Kong street block. Boxes are centered at (x, z) with
// half-extents (hx, hz) and height h. kind picks how the client draws them.
export const OBSTACLES = [
  // the LLM "brain" kiosk in the middle
  { x: 0, z: 0, hx: 2.2, hz: 2.2, h: 3.4, kind: "core" },
  // four tong lau shop buildings
  { x: -9, z: -9, hx: 1.5, hz: 1.5, h: 4.6, kind: "shop", sign: 0 },
  { x: 9, z: -9, hx: 1.5, hz: 1.5, h: 4.6, kind: "shop", sign: 1 },
  { x: -9, z: 9, hx: 1.5, hz: 1.5, h: 4.6, kind: "shop", sign: 2 },
  { x: 9, z: 9, hx: 1.5, hz: 1.5, h: 4.6, kind: "shop", sign: 3 },
  // parked taxis and minibuses
  { x: -2.9, z: -15, hx: 2.2, hz: 0.95, h: 1.5, kind: "taxi" },
  { x: 3.1, z: -15, hx: 2.6, hz: 1.1, h: 2.3, kind: "minibus" },
  { x: 2.9, z: 15, hx: 2.2, hz: 0.95, h: 1.5, kind: "taxi" },
  { x: -3.1, z: 15, hx: 2.6, hz: 1.1, h: 2.3, kind: "minibus" },
  { x: -15, z: 2.9, hx: 0.95, hz: 2.2, h: 1.5, kind: "taxi" },
  { x: -15, z: -3.1, hx: 1.1, hz: 2.6, h: 2.3, kind: "minibus" },
  { x: 15, z: -2.9, hx: 0.95, hz: 2.2, h: 1.5, kind: "taxi" },
  { x: 15, z: 3.1, hx: 1.1, hz: 2.6, h: 2.3, kind: "minibus" },
  // pedestrian railings in the corners
  { x: -19, z: -19, hx: 2.5, hz: 0.25, h: 1.1, kind: "rail" },
  { x: 19, z: 19, hx: 2.5, hz: 0.25, h: 1.1, kind: "rail" },
  { x: 19, z: -19, hx: 0.25, hz: 2.5, h: 1.1, kind: "rail" },
  { x: -19, z: 19, hx: 0.25, hz: 2.5, h: 1.1, kind: "rail" },
];

export const SPAWNS = [
  { x: -21, z: -21 }, { x: 21, z: 21 }, { x: 21, z: -21 }, { x: -21, z: 21 },
  { x: 0, z: -21 }, { x: 0, z: 21 }, { x: -21, z: 0 }, { x: 21, z: 0 },
];

// Where term cards appear. kind indexes into CARDS in theme.js.
export const PICKUP_SPOTS = [
  { x: -5, z: -5, kind: 0 }, { x: 5, z: 5, kind: 0 },
  { x: 5, z: -5, kind: 1 }, { x: -5, z: 5, kind: 1 },
  { x: 0, z: -9, kind: 2 }, { x: 0, z: 9, kind: 2 },
  { x: -9, z: 0, kind: 3 }, { x: 9, z: 0, kind: 3 },
  { x: -17, z: -10, kind: 4 }, { x: 17, z: 10, kind: 4 },
  { x: 10, z: -19, kind: 5 }, { x: -10, z: 19, kind: 5 },
];

export const COLORS = [
  "#e63946", "#2a6fdb", "#f4a261", "#8e44ad",
  "#16a085", "#ff70a6", "#ffbe0b", "#3ec1d3",
];

const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);

// Push a circle at (x, z) out of the arena edges and obstacles.
export function resolveCircle(x, z, r) {
  x = clamp(x, -ARENA + r, ARENA - r);
  z = clamp(z, -ARENA + r, ARENA - r);
  for (const o of OBSTACLES) {
    const cx = clamp(x, o.x - o.hx, o.x + o.hx);
    const cz = clamp(z, o.z - o.hz, o.z + o.hz);
    const dx = x - cx;
    const dz = z - cz;
    const d2 = dx * dx + dz * dz;
    if (d2 < r * r) {
      if (d2 > 1e-8) {
        const d = Math.sqrt(d2);
        x = cx + (dx / d) * r;
        z = cz + (dz / d) * r;
      } else {
        // center is inside the box: push out along the shallowest axis
        const px = o.hx - Math.abs(x - o.x);
        const pz = o.hz - Math.abs(z - o.z);
        if (px < pz) x = o.x + Math.sign(x - o.x || 1) * (o.hx + r);
        else z = o.z + Math.sign(z - o.z || 1) * (o.hz + r);
      }
    }
  }
  return { x, z };
}

// Does a point hit a wall or obstacle? Used for bullets.
export function pointBlocked(x, z) {
  if (x < -ARENA || x > ARENA || z < -ARENA || z > ARENA) return true;
  for (const o of OBSTACLES) {
    if (Math.abs(x - o.x) <= o.hx && Math.abs(z - o.z) <= o.hz) return true;
  }
  return false;
}
