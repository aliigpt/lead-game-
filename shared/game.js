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
  respawn: 2.5,
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
  hp: 40,
  speed: 3.6,
  chaseRange: 14,
  touchDps: 22,
  respawn: 6,
};

export const SCORE = {
  kill: 100,
  bot: 50,
  piece: 10,
  complete: 250,
};

export const PICKUP_RADIUS = 1.3;
export const PICKUP_RESPAWN = 8;

// Map: GPU towers (tall) and server racks (long, low walls).
// Each box is centered at (x, z) with half-extents (hx, hz) and a height h.
export const OBSTACLES = [
  // center core
  { x: 0, z: 0, hx: 2.2, hz: 2.2, h: 3.5, kind: "core" },
  // four GPU towers around the core
  { x: -9, z: -9, hx: 1.4, hz: 1.4, h: 4, kind: "gpu" },
  { x: 9, z: -9, hx: 1.4, hz: 1.4, h: 4, kind: "gpu" },
  { x: -9, z: 9, hx: 1.4, hz: 1.4, h: 4, kind: "gpu" },
  { x: 9, z: 9, hx: 1.4, hz: 1.4, h: 4, kind: "gpu" },
  // server racks
  { x: 0, z: -15, hx: 5, hz: 0.6, h: 1.6, kind: "rack" },
  { x: 0, z: 15, hx: 5, hz: 0.6, h: 1.6, kind: "rack" },
  { x: -15, z: 0, hx: 0.6, hz: 5, h: 1.6, kind: "rack" },
  { x: 15, z: 0, hx: 0.6, hz: 5, h: 1.6, kind: "rack" },
  // corner cover
  { x: -19, z: -19, hx: 2.5, hz: 0.6, h: 1.6, kind: "rack" },
  { x: 19, z: 19, hx: 2.5, hz: 0.6, h: 1.6, kind: "rack" },
  { x: 19, z: -19, hx: 0.6, hz: 2.5, h: 1.6, kind: "rack" },
  { x: -19, z: 19, hx: 0.6, hz: 2.5, h: 1.6, kind: "rack" },
];

export const SPAWNS = [
  { x: -21, z: -21 }, { x: 21, z: 21 }, { x: 21, z: -21 }, { x: -21, z: 21 },
  { x: 0, z: -21 }, { x: 0, z: 21 }, { x: -21, z: 0 }, { x: 21, z: 0 },
];

// Where prompt pieces appear. kind indexes into PIECES in theme.js.
export const PICKUP_SPOTS = [
  { x: -5, z: -5, kind: 0 }, { x: 5, z: 5, kind: 0 },
  { x: 5, z: -5, kind: 1 }, { x: -5, z: 5, kind: 1 },
  { x: 0, z: -9, kind: 2 }, { x: 0, z: 9, kind: 2 },
  { x: -9, z: 0, kind: 3 }, { x: 9, z: 0, kind: 3 },
  { x: -17, z: -10, kind: 4 }, { x: 17, z: 10, kind: 4 },
  { x: 10, z: -18, kind: 2 }, { x: -10, z: 18, kind: 1 },
];

export const COLORS = [
  "#ff4fd8", "#3fd0ff", "#ffd23f", "#6bff8a",
  "#ff8a3f", "#b18cff", "#ff5a6e", "#4ff0c8",
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
