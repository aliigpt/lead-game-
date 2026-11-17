// Three.js world: arena, entities, effects. No networking in here.
import * as THREE from "three";
import { ARENA, OBSTACLES, PLAYER, BOT, WEAPON, pointBlocked } from "../shared/game.js";
import { PIECES } from "../shared/theme.js";

export const isTouch = matchMedia("(pointer: coarse)").matches || "ontouchstart" in window;

export function createWorld(container) {
  const renderer = new THREE.WebGLRenderer({ antialias: !isTouch, powerPreference: "high-performance" });
  renderer.setPixelRatio(Math.min(devicePixelRatio, isTouch ? 1.5 : 2));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  container.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color("#070b18");
  scene.fog = new THREE.Fog("#070b18", 35, 80);

  const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 200);
  camera.position.set(0, 30, 18);
  camera.lookAt(0, 0, 0);

  scene.add(new THREE.HemisphereLight(0x99aaff, 0x141433, 1.6));
  const sun = new THREE.DirectionalLight(0xffffff, 1.4);
  sun.position.set(10, 25, 8);
  scene.add(sun);
  const coreLight = new THREE.PointLight(0xffd23f, 30, 18, 2);
  coreLight.position.set(0, 5, 0);
  scene.add(coreLight);

  buildArena(scene);

  const resize = () => {
    const w = innerWidth, h = innerHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  };
  addEventListener("resize", resize);
  resize();

  return { renderer, scene, camera, coreLight };
}

function circuitTexture() {
  const c = document.createElement("canvas");
  c.width = c.height = 256;
  const g = c.getContext("2d");
  g.fillStyle = "#0b1126";
  g.fillRect(0, 0, 256, 256);
  g.strokeStyle = "rgba(90,120,255,0.35)";
  g.lineWidth = 2;
  g.strokeRect(0, 0, 256, 256);
  g.strokeStyle = "rgba(63,208,255,0.25)";
  g.lineWidth = 3;
  const rnd = mulberry(7);
  for (let i = 0; i < 9; i++) {
    let x = Math.floor(rnd() * 8) * 32, y = Math.floor(rnd() * 8) * 32;
    g.beginPath();
    g.moveTo(x, y);
    for (let s = 0; s < 3; s++) {
      if (rnd() > 0.5) x += (rnd() > 0.5 ? 1 : -1) * 32 * (1 + Math.floor(rnd() * 2));
      else y += (rnd() > 0.5 ? 1 : -1) * 32 * (1 + Math.floor(rnd() * 2));
      g.lineTo(x, y);
    }
    g.stroke();
    g.fillStyle = "rgba(63,208,255,0.5)";
    g.beginPath();
    g.arc(x, y, 4, 0, Math.PI * 2);
    g.fill();
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(ARENA / 4, ARENA / 4);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

function mulberry(a) {
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function buildArena(scene) {
  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(ARENA * 2, ARENA * 2),
    new THREE.MeshStandardMaterial({ map: circuitTexture(), roughness: 0.85, metalness: 0.1 })
  );
  floor.rotation.x = -Math.PI / 2;
  scene.add(floor);

  // outside ground so the edges don't float in the void
  const outer = new THREE.Mesh(
    new THREE.PlaneGeometry(400, 400),
    new THREE.MeshBasicMaterial({ color: "#05081a" })
  );
  outer.rotation.x = -Math.PI / 2;
  outer.position.y = -0.02;
  scene.add(outer);

  const wallMat = new THREE.MeshStandardMaterial({ color: "#121a3a", roughness: 0.6 });
  const edgeMat = new THREE.MeshBasicMaterial({ color: "#3fd0ff" });
  for (const [x, z, w, d] of [
    [0, -ARENA - 0.3, ARENA * 2 + 1.2, 0.6], [0, ARENA + 0.3, ARENA * 2 + 1.2, 0.6],
    [-ARENA - 0.3, 0, 0.6, ARENA * 2], [ARENA + 0.3, 0, 0.6, ARENA * 2],
  ]) {
    const wall = new THREE.Mesh(new THREE.BoxGeometry(w, 1.2, d), wallMat);
    wall.position.set(x, 0.6, z);
    scene.add(wall);
    const strip = new THREE.Mesh(new THREE.BoxGeometry(w, 0.08, d + 0.02), edgeMat);
    strip.position.set(x, 1.22, z);
    scene.add(strip);
  }

  const kindColor = { core: "#ffd23f", gpu: "#ff4fd8", rack: "#3fd0ff" };
  const bodyMat = new THREE.MeshStandardMaterial({ color: "#2a3570", emissive: "#111842", roughness: 0.5, metalness: 0.3 });
  for (const o of OBSTACLES) {
    const geo = new THREE.BoxGeometry(o.hx * 2, o.h, o.hz * 2);
    const box = new THREE.Mesh(geo, bodyMat);
    box.position.set(o.x, o.h / 2, o.z);
    scene.add(box);
    const edges = new THREE.LineSegments(
      new THREE.EdgesGeometry(geo),
      new THREE.LineBasicMaterial({ color: kindColor[o.kind] })
    );
    edges.position.copy(box.position);
    scene.add(edges);
    // glowing "LED" strips
    const ledMat = new THREE.MeshBasicMaterial({ color: kindColor[o.kind] });
    const rows = o.kind === "rack" ? 2 : 4;
    for (let i = 1; i <= rows; i++) {
      const led = new THREE.Mesh(new THREE.BoxGeometry(o.hx * 2 + 0.04, 0.05, o.hz * 2 + 0.04), ledMat);
      led.position.set(o.x, (o.h * i) / (rows + 1), o.z);
      scene.add(led);
    }
    if (o.kind === "core") {
      const chip = new THREE.Mesh(
        new THREE.BoxGeometry(o.hx * 1.4, 0.2, o.hz * 1.4),
        new THREE.MeshBasicMaterial({ map: labelTexture("AI", "#ffd23f", "#070b18") })
      );
      chip.position.set(o.x, o.h + 0.1, o.z);
      scene.add(chip);
    }
  }
}

function labelTexture(text, bg, fg, size = 128) {
  const c = document.createElement("canvas");
  c.width = c.height = size;
  const g = c.getContext("2d");
  g.fillStyle = bg;
  g.fillRect(0, 0, size, size);
  g.fillStyle = fg;
  g.font = `700 ${size * 0.55}px "Space Grotesk", sans-serif`;
  g.textAlign = "center";
  g.textBaseline = "middle";
  g.fillText(text, size / 2, size / 2 + size * 0.04);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// ---------- players ----------

export function createPlayerMesh(color, isMe) {
  const g = new THREE.Group();
  const col = new THREE.Color(color);
  const bodyMat = new THREE.MeshStandardMaterial({ color: col, emissive: col, emissiveIntensity: 0.25, roughness: 0.4 });
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(PLAYER.radius * 0.8, 0.6, 4, 10), bodyMat);
  body.position.y = 0.9;
  g.add(body);
  const visor = new THREE.Mesh(
    new THREE.BoxGeometry(0.62, 0.2, 0.3),
    new THREE.MeshBasicMaterial({ color: "#eaf6ff" })
  );
  visor.position.set(0, 1.25, 0.35);
  g.add(visor);
  const gun = new THREE.Mesh(
    new THREE.BoxGeometry(0.16, 0.16, 0.7),
    new THREE.MeshStandardMaterial({ color: "#222a55", emissive: col, emissiveIntensity: 0.6 })
  );
  gun.position.set(0, 0.95, 0.55);
  g.add(gun);
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(PLAYER.radius + 0.1, PLAYER.radius + (isMe ? 0.35 : 0.2), 32),
    new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: isMe ? 0.9 : 0.5, side: THREE.DoubleSide })
  );
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.03;
  g.add(ring);
  const shield = new THREE.Mesh(
    new THREE.SphereGeometry(1.15, 20, 14),
    new THREE.MeshBasicMaterial({ color: "#3fd0ff", transparent: true, opacity: 0.22, depthWrite: false })
  );
  shield.position.y = 0.9;
  shield.visible = false;
  g.add(shield);

  // name + hp label (separate so it doesn't rotate with the body)
  const labelCanvas = document.createElement("canvas");
  labelCanvas.width = 256;
  labelCanvas.height = 64;
  const labelTex = new THREE.CanvasTexture(labelCanvas);
  labelTex.colorSpace = THREE.SRGBColorSpace;
  const label = new THREE.Sprite(new THREE.SpriteMaterial({ map: labelTex, depthTest: false, transparent: true }));
  label.scale.set(3.2, 0.8, 1);
  label.renderOrder = 10;

  return { group: g, body, shield, label, labelCanvas, labelTex, lastLabel: "" };
}

export function drawPlayerLabel(m, name, hp, color) {
  const key = `${name}|${Math.ceil(hp)}`;
  if (m.lastLabel === key) return;
  m.lastLabel = key;
  const g = m.labelCanvas.getContext("2d");
  g.clearRect(0, 0, 256, 64);
  g.font = '700 26px "Space Grotesk", sans-serif';
  g.textAlign = "center";
  g.lineWidth = 5;
  g.strokeStyle = "rgba(7,11,24,0.9)";
  g.strokeText(name, 128, 28);
  g.fillStyle = "#fff";
  g.fillText(name, 128, 28);
  g.fillStyle = "rgba(7,11,24,0.85)";
  g.fillRect(48, 40, 160, 12);
  g.fillStyle = hp > 35 ? color : "#ff5a6e";
  g.fillRect(50, 42, 156 * Math.max(0, hp / 100), 8);
  m.labelTex.needsUpdate = true;
}

// ---------- bots ----------

export function createBotMesh() {
  const g = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({ color: "#ff3355", emissive: "#ff1133", emissiveIntensity: 0.7, flatShading: true });
  const core = new THREE.Mesh(new THREE.IcosahedronGeometry(BOT.radius, 0), mat);
  core.position.y = 1.1;
  g.add(core);
  const shell = new THREE.Mesh(
    new THREE.IcosahedronGeometry(BOT.radius * 1.35, 0),
    new THREE.MeshBasicMaterial({ color: "#ff5a6e", wireframe: true, transparent: true, opacity: 0.5 })
  );
  shell.position.y = 1.1;
  g.add(shell);
  const tag = new THREE.Sprite(new THREE.SpriteMaterial({ map: labelTexture("?!", "rgba(0,0,0,0)", "#ff5a6e"), transparent: true, depthTest: false }));
  tag.position.y = 2.5;
  tag.scale.set(1.1, 1.1, 1);
  g.add(tag);
  return { group: g, core, shell };
}

// ---------- pickups ----------

const pieceTextures = PIECES.map((p) => labelTexture(p.letter, p.color, "#070b18"));

export function createPickupMesh(kind) {
  const p = PIECES[kind];
  const g = new THREE.Group();
  const mat = new THREE.MeshBasicMaterial({ map: pieceTextures[kind], transparent: true });
  const tile = new THREE.Mesh(new THREE.BoxGeometry(1.1, 1.1, 0.16), mat);
  tile.position.y = 1.1;
  g.add(tile);
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(0.8, 1.0, 28),
    new THREE.MeshBasicMaterial({ color: p.color, transparent: true, opacity: 0.6, side: THREE.DoubleSide })
  );
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.04;
  g.add(ring);
  return { group: g, tile, mat, ring };
}

// ---------- bullets + effects ----------

const bulletGeo = new THREE.SphereGeometry(WEAPON.radius * 1.4, 8, 6);
const bulletMats = new Map();
function bulletMat(color) {
  if (!bulletMats.has(color)) bulletMats.set(color, new THREE.MeshBasicMaterial({ color }));
  return bulletMats.get(color);
}

export class Bullets {
  constructor(scene) {
    this.scene = scene;
    this.list = [];
  }
  spawn(x, z, a, color, meta = {}) {
    const mesh = new THREE.Mesh(bulletGeo, bulletMat(color));
    mesh.position.set(x, 1.0, z);
    this.scene.add(mesh);
    const b = { mesh, x, z, vx: Math.sin(a) * WEAPON.speed, vz: Math.cos(a) * WEAPON.speed, left: WEAPON.range, ...meta };
    this.list.push(b);
    return b;
  }
  remove(b) {
    this.scene.remove(b.mesh);
    b.dead = true;
  }
  update(dt, onWall) {
    for (const b of this.list) {
      if (b.dead) continue;
      b.x += b.vx * dt;
      b.z += b.vz * dt;
      b.left -= WEAPON.speed * dt;
      b.mesh.position.set(b.x, 1.0, b.z);
      if (b.left <= 0 || pointBlocked(b.x, b.z)) {
        if (b.left > 0) onWall?.(b.x, b.z);
        this.remove(b);
      }
    }
    if (this.list.length > 64 || this.list.some((b) => b.dead)) this.list = this.list.filter((b) => !b.dead);
  }
  clear() {
    for (const b of this.list) this.scene.remove(b.mesh);
    this.list = [];
  }
}

const sparkGeo = new THREE.IcosahedronGeometry(0.5, 0);
export class Effects {
  constructor(scene) {
    this.scene = scene;
    this.list = [];
  }
  burst(x, z, color, size = 1, y = 1) {
    const mesh = new THREE.Mesh(
      sparkGeo,
      new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.9, wireframe: size > 1.5, depthWrite: false })
    );
    mesh.position.set(x, y, z);
    this.scene.add(mesh);
    this.list.push({ mesh, t: 0, life: 0.35 + size * 0.1, size });
  }
  update(dt) {
    for (const e of this.list) {
      e.t += dt;
      const k = e.t / e.life;
      e.mesh.scale.setScalar(0.3 + k * e.size * 2);
      e.mesh.material.opacity = Math.max(0, 0.9 * (1 - k));
      e.mesh.rotation.y += dt * 4;
      if (k >= 1) {
        this.scene.remove(e.mesh);
        e.mesh.material.dispose();
        e.done = true;
      }
    }
    this.list = this.list.filter((e) => !e.done);
  }
}
