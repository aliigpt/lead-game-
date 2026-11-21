import { Schema, MapSchema, defineTypes } from "@colyseus/schema";

export class Player extends Schema {
  constructor() {
    super();
    this.name = "";
    this.color = "";
    this.x = 0;
    this.z = 0;
    this.a = 0; // aim angle (radians)
    this.hp = 100;
    this.alive = true;
    this.score = 0;
    this.kills = 0;
    this.bots = 0;
    this.masters = 0; // times all six cards were learned this round
    this.learned = 0; // bitmask of cards learned toward the next "master"
    this.bag = ""; // comma-separated card indices, oldest first (the context window)
    this.tokens = 20; // taxi meter: ammo
    this.shield = false; // spawn protection / Regenerate shield
    this.spawnSeq = 0; // bumps on every (re)spawn so clients can snap
  }
}
defineTypes(Player, {
  name: "string",
  color: "string",
  x: "number",
  z: "number",
  a: "number",
  hp: "number",
  alive: "boolean",
  score: "number",
  kills: "number",
  bots: "number",
  masters: "number",
  learned: "uint8",
  bag: "string",
  tokens: "number",
  shield: "boolean",
  spawnSeq: "uint16",
});

export class Bot extends Schema {
  constructor() {
    super();
    this.x = 0;
    this.z = 0;
    this.hp = 0;
    this.alive = true;
  }
}
defineTypes(Bot, { x: "number", z: "number", hp: "number", alive: "boolean" });

export class Pickup extends Schema {
  constructor() {
    super();
    this.x = 0;
    this.z = 0;
    this.kind = 0;
    this.active = true;
    this.scam = false; // prompt injection: looks like a card, isn't
  }
}
defineTypes(Pickup, { x: "number", z: "number", kind: "uint8", active: "boolean", scam: "boolean" });

export class ArenaState extends Schema {
  constructor() {
    super();
    this.phase = "playing"; // "playing" | "ended"
    this.timeLeft = 0;
    this.round = 1;
    this.players = new MapSchema();
    this.bots = new MapSchema();
    this.pickups = new MapSchema();
  }
}
defineTypes(ArenaState, {
  phase: "string",
  timeLeft: "number",
  round: "uint16",
  players: { map: Player },
  bots: { map: Bot },
  pickups: { map: Pickup },
});
