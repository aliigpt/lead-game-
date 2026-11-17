// Three.js world: arena, entities, effects. No networking in here.
// Look: bright pastel arena, rounded white blocks, Instagram-gradient accents.
import * as THREE from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { ARENA, OBSTACLES, PLAYER, BOT, WEAPON, pointBlocked } from "../shared/game.js";
import { PIECES } from "../shared/theme.js";

export const isTouch = matchMedia("(pointer: coarse)").matches || "ontouchstart" in window;

const IG = ["#feda75", "#fa7e1e", "#d62976", "#962fbf", "#4f5bd5"];
const SKY = "#f1e9f6";

export function createWorld(container) {
  const renderer = new THREE.WebGLRenderer({ antialias: !isTouch, powerPreference: "high-performance" });
  renderer.setPixelRatio(Math.min(devicePixelRatio, isTouch ? 1.5 : 2));
  renderer.toneMapping = THREE.NeutralToneMapping;
  container.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(SKY);
  scene.fog = new THREE.Fog(SKY, 38, 85);

  const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 200);
  camera.position.set(0, 30, 18);
  camera.lookAt(0, 0, 0);

  scene.add(new THREE.HemisphereLight("#ffffff", "#e6d6f2", 1.5));
  const sun = new THREE.DirectionalLight("#fff3ea", 1.7);
  sun.position.set(8, 22, 12);
  scene.add(sun);
  const coreLight = new THREE.PointLight("#d62976", 14, 16, 2);
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

// ---------- textures ----------

function canvasTex(w, h, draw) {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  draw(c.getContext("2d"), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function igGradient(g, x0, y0, x1, y1) {
  const gr = g.createLinearGradient(x0, y0, x1, y1);
  IG.forEach((c, i) => gr.addColorStop(i / (IG.length - 1), c));
  return gr;
}

function roundRect(g, x, y, w, h, r) {
  g.beginPath();
  g.moveTo(x + r, y);
  g.arcTo(x + w, y, x + w, y + h, r);
  g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r);
  g.arcTo(x, y, x + w, y, r);
  g.closePath();
}

function floorTexture() {
  const t = canvasTex(256, 256, (g) => {
    g.fillStyle = "#fbf8fc";
    g.fillRect(0, 0, 256, 256);
    g.strokeStyle = "#ece3f1";
    g.lineWidth = 3;
    g.strokeRect(0, 0, 256, 256);
    g.lineWidth = 1.5;
    g.beginPath();
    g.moveTo(128, 0); g.lineTo(128, 256);
    g.moveTo(0, 128); g.lineTo(256, 128);
    g.stroke();
    g.fillStyle = "#e2d3ec";
    g.beginPath();
    g.arc(128, 128, 5, 0, Math.PI * 2);
    g.fill();
  });
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(ARENA / 4, ARENA / 4);
  t.anisotropy = 4;
  return t;
}

const shadowTex = canvasTex(128, 128, (g) => {
  const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  gr.addColorStop(0, "rgba(70,30,90,0.32)");
  gr.addColorStop(1, "rgba(70,30,90,0)");
  g.fillStyle = gr;
  g.fillRect(0, 0, 128, 128);
});
const shadowGeo = new THREE.PlaneGeometry(1, 1);
const shadowMat = new THREE.MeshBasicMaterial({ map: shadowTex, transparent: true, depthWrite: false });
function blobShadow(size) {
  const m = new THREE.Mesh(shadowGeo, shadowMat);
  m.rotation.x = -Math.PI / 2;
  m.position.y = 0.015;
  m.scale.set(size, size, 1);
  m.renderOrder = -1;
  return m;
}

function labelTexture(text, bg, fg, size = 128) {
  return canvasTex(size, size, (g) => {
    g.fillStyle = bg;
    g.fillRect(0, 0, size, size);
    g.fillStyle = fg;
    g.font = `900 ${size * 0.5}px "Inter Tight", Inter, sans-serif`;
    g.textAlign = "center";
    g.textBaseline = "middle";
    g.fillText(text, size / 2, size / 2 + size * 0.03);
  });
}

// ---------- arena ----------

function buildArena(scene) {
  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(ARENA * 2, ARENA * 2),
    new THREE.MeshStandardMaterial({ map: floorTexture(), roughness: 0.95 })
  );
  floor.rotation.x = -Math.PI / 2;
  scene.add(floor);

  const outer = new THREE.Mesh(new THREE.PlaneGeometry(400, 400), new THREE.MeshBasicMaterial({ color: "#eadff1" }));
  outer.rotation.x = -Math.PI / 2;
  outer.position.y = -0.02;
  scene.add(outer);

  // low rounded border with an Instagram-gradient top
  const wallMat = new THREE.MeshStandardMaterial({ color: "#ffffff", roughness: 0.7 });
  const stripMat = new THREE.MeshBasicMaterial({
    map: canvasTex(512, 4, (g, w, h) => { g.fillStyle = igGradient(g, 0, 0, w, 0); g.fillRect(0, 0, w, h); }),
  });
  const L = ARENA * 2 + 1.2;
  for (const [x, z, rot] of [[0, -ARENA - 0.3, 0], [0, ARENA + 0.3, Math.PI], [-ARENA - 0.3, 0, Math.PI / 2], [ARENA + 0.3, 0, -Math.PI / 2]]) {
    const wall = new THREE.Mesh(new RoundedBoxGeometry(L, 1, 0.6, 2, 0.25), wallMat);
    wall.position.set(x, 0.5, z);
    wall.rotation.y = rot;
    scene.add(wall);
    const strip = new THREE.Mesh(new THREE.BoxGeometry(L - 0.4, 0.06, 0.3), stripMat);
    strip.position.set(x, 1.02, z);
    strip.rotation.y = rot;
    scene.add(strip);
  }

  const capColor = { gpu: "#962fbf", rack: "#d62976" };
  const bodyMat = new THREE.MeshStandardMaterial({ color: "#ffffff", roughness: 0.55 });
  const coreTex = canvasTex(256, 256, (g, w, h) => {
    g.fillStyle = igGradient(g, 0, h, w, 0);
    g.fillRect(0, 0, w, h);
  });
  for (const o of OBSTACLES) {
    const isCore = o.kind === "core";
    const box = new THREE.Mesh(
      new RoundedBoxGeometry(o.hx * 2, o.h, o.hz * 2, 3, Math.min(o.hx, o.hz, 0.5)),
      isCore
        ? new THREE.MeshStandardMaterial({ map: coreTex, roughness: 0.4, emissive: "#ffffff", emissiveMap: coreTex, emissiveIntensity: 0.25 })
        : bodyMat
    );
    box.position.set(o.x, o.h / 2, o.z);
    scene.add(box);
    const sh = blobShadow(1);
    sh.scale.set(o.hx * 2 + 1.6, o.hz * 2 + 1.6, 1);
    sh.position.set(o.x, 0.012, o.z);
    scene.add(sh);
    if (isCore) {
      const chip = new THREE.Mesh(
        new RoundedBoxGeometry(o.hx * 1.3, 0.3, o.hz * 1.3, 2, 0.12),
        new THREE.MeshBasicMaterial({ map: labelTexture("AI", "#ffffff", "#962fbf") })
      );
      chip.position.set(o.x, o.h + 0.12, o.z);
      scene.add(chip);
    } else {
      const cap = new THREE.Mesh(
        new RoundedBoxGeometry(o.hx * 2 - 0.3, 0.12, o.hz * 2 - 0.3, 2, 0.05),
        new THREE.MeshStandardMaterial({ color: capColor[o.kind], roughness: 0.4 })
      );
      cap.position.set(o.x, o.h + 0.02, o.z);
      scene.add(cap);
    }
  }
}

// ---------- players ----------

export function createPlayerMesh(color, isMe) {
  const g = new THREE.Group();
  const col = new THREE.Color(color);
  g.add(blobShadow(1.9));
  const body = new THREE.Mesh(
    new THREE.CapsuleGeometry(PLAYER.radius * 0.85, 0.55, 6, 16),
    new THREE.MeshStandardMaterial({ color: col, roughness: 0.45 })
  );
  body.position.y = 0.9;
  g.add(body);
  // face: dark rounded visor with two white eyes (children of the body so they bob with it)
  const visor = new THREE.Mesh(new RoundedBoxGeometry(0.66, 0.3, 0.2, 2, 0.1), new THREE.MeshStandardMaterial({ color: "#1b1528", roughness: 0.3 }));
  visor.position.set(0, 0.25, 0.42);
  body.add(visor);
  const eyeMat = new THREE.MeshBasicMaterial({ color: "#ffffff" });
  for (const ex of [-0.14, 0.14]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 6), eyeMat);
    eye.position.set(ex, 0.26, 0.52);
    body.add(eye);
  }
  const gun = new THREE.Mesh(new RoundedBoxGeometry(0.2, 0.2, 0.6, 2, 0.06), new THREE.MeshStandardMaterial({ color: "#ffffff", roughness: 0.4 }));
  gun.position.set(0, 0.85, 0.62);
  g.add(gun);
  if (isMe) {
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(PLAYER.radius + 0.25, PLAYER.radius + 0.4, 40),
      new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.85, side: THREE.DoubleSide })
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.03;
    g.add(ring);
  }
  const shield = new THREE.Mesh(
    new THREE.SphereGeometry(1.15, 24, 16),
    new THREE.MeshBasicMaterial({ color: "#0095f6", transparent: true, opacity: 0.18, depthWrite: false })
  );
  shield.position.y = 0.9;
  shield.visible = false;
  g.add(shield);

  // name pill + hp bar (kept upright, not parented to the rotating group)
  const labelCanvas = document.createElement("canvas");
  labelCanvas.width = 256;
  labelCanvas.height = 80;
  const labelTex = new THREE.CanvasTexture(labelCanvas);
  labelTex.colorSpace = THREE.SRGBColorSpace;
  const label = new THREE.Sprite(new THREE.SpriteMaterial({ map: labelTex, depthTest: false, transparent: true }));
  label.scale.set(3.2, 1, 1);
  label.renderOrder = 10;

  return { group: g, body, shield, label, labelCanvas, labelTex, lastLabel: "" };
}

export function drawPlayerLabel(m, name, hp, color) {
  const key = `${name}|${Math.ceil(hp)}`;
  if (m.lastLabel === key) return;
  m.lastLabel = key;
  const g = m.labelCanvas.getContext("2d");
  g.clearRect(0, 0, 256, 80);
  g.font = "700 24px Inter, sans-serif";
  const tw = Math.min(170, g.measureText(name).width);
  const w = tw + 48, x = 128 - w / 2;
  g.fillStyle = "rgba(255,255,255,0.95)";
  roundRect(g, x, 6, w, 38, 19);
  g.fill();
  g.fillStyle = color;
  g.beginPath();
  g.arc(x + 19, 25, 7, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = "#0f0f14";
  g.textBaseline = "middle";
  g.fillText(name, x + 33, 26, 170);
  g.fillStyle = "rgba(255,255,255,0.9)";
  roundRect(g, 78, 52, 100, 10, 5);
  g.fill();
  g.fillStyle = hp > 35 ? "#1fbf6a" : "#ff3040";
  roundRect(g, 80, 54, Math.max(6, 96 * Math.max(0, hp / 100)), 6, 3);
  g.fill();
  m.labelTex.needsUpdate = true;
}

// ---------- bots (Hallucinations: dark glitches) ----------

export function createBotMesh() {
  const g = new THREE.Group();
  g.add(blobShadow(2.2));
  const core = new THREE.Mesh(
    new THREE.IcosahedronGeometry(BOT.radius, 0),
    new THREE.MeshStandardMaterial({ color: "#241733", emissive: "#ff3040", emissiveIntensity: 0.18, roughness: 0.3, flatShading: true })
  );
  core.position.y = 1.1;
  g.add(core);
  const shell = new THREE.Mesh(
    new THREE.IcosahedronGeometry(BOT.radius * 1.4, 0),
    new THREE.MeshBasicMaterial({ color: "#ff3040", wireframe: true, transparent: true, opacity: 0.55 })
  );
  shell.position.y = 1.1;
  g.add(shell);
  const tag = new THREE.Sprite(new THREE.SpriteMaterial({
    map: canvasTex(128, 64, (c) => {
      c.fillStyle = "#ff3040";
      roundRect(c, 14, 6, 100, 52, 26);
      c.fill();
      c.fillStyle = "#fff";
      c.font = '900 30px "Inter Tight", sans-serif';
      c.textAlign = "center";
      c.textBaseline = "middle";
      c.fillText("FAKE", 64, 34);
    }),
    transparent: true, depthTest: false,
  }));
  tag.position.y = 2.55;
  tag.scale.set(1.3, 0.65, 1);
  g.add(tag);
  return { group: g, core, shell };
}

// ---------- pickups: Story-ring bubbles ----------

const pieceTextures = PIECES.map((p) => canvasTex(256, 256, (g) => {
  const cx = 128, cy = 128;
  let ring;
  if (g.createConicGradient) {
    ring = g.createConicGradient(-Math.PI / 2, cx, cy);
    [...IG, IG[0]].forEach((c, i) => ring.addColorStop(i / IG.length, c));
  } else {
    ring = igGradient(g, 0, 256, 256, 0);
  }
  g.fillStyle = ring;
  g.beginPath(); g.arc(cx, cy, 120, 0, Math.PI * 2); g.fill();
  g.fillStyle = "#fff";
  g.beginPath(); g.arc(cx, cy, 104, 0, Math.PI * 2); g.fill();
  g.fillStyle = p.color;
  g.beginPath(); g.arc(cx, cy, 94, 0, Math.PI * 2); g.fill();
  g.fillStyle = "#fff";
  g.font = '900 112px "Inter Tight", Inter, sans-serif';
  g.textAlign = "center";
  g.textBaseline = "middle";
  g.fillText(p.letter, cx, cy + 6);
}));

export function createPickupMesh(kind) {
  const g = new THREE.Group();
  const shadow = blobShadow(1.6);
  g.add(shadow);
  const mat = new THREE.SpriteMaterial({ map: pieceTextures[kind], transparent: true });
  const tile = new THREE.Sprite(mat);
  tile.scale.set(1.5, 1.5, 1);
  tile.position.y = 1.3;
  g.add(tile);
  return { group: g, tile, mat, shadow };
}

// ---------- bullets + effects ----------

const bulletGeo = new THREE.SphereGeometry(WEAPON.radius * 1.5, 10, 8);
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
    mesh.position.set(x, 0.9, z);
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
      b.mesh.position.set(b.x, 0.9, b.z);
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

const sparkGeo = new THREE.SphereGeometry(0.4, 10, 8);
const heartTex = canvasTex(128, 128, (g) => {
  g.fillStyle = "#ff3040";
  g.beginPath();
  g.moveTo(64, 112);
  g.bezierCurveTo(10, 76, 6, 40, 30, 24);
  g.bezierCurveTo(48, 12, 62, 24, 64, 36);
  g.bezierCurveTo(66, 24, 80, 12, 98, 24);
  g.bezierCurveTo(122, 40, 118, 76, 64, 112);
  g.fill();
});

export class Effects {
  constructor(scene) {
    this.scene = scene;
    this.list = [];
  }
  burst(x, z, color, size = 1, y = 1) {
    const mesh = new THREE.Mesh(sparkGeo, new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.8, depthWrite: false }));
    mesh.position.set(x, y, z);
    this.scene.add(mesh);
    this.list.push({ mesh, t: 0, life: 0.3 + size * 0.1, kind: "burst", size });
  }
  // Instagram-style floating hearts
  hearts(x, z, n = 5) {
    for (let i = 0; i < n; i++) {
      const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: heartTex, transparent: true, depthTest: false }));
      s.position.set(x + (Math.random() - 0.5) * 1.2, 1.6, z + (Math.random() - 0.5) * 0.6);
      s.renderOrder = 11;
      s.visible = false;
      this.scene.add(s);
      this.list.push({ mesh: s, t: -i * 0.07, life: 0.9, kind: "heart", vx: (Math.random() - 0.5) * 1.5 });
    }
  }
  update(dt) {
    for (const e of this.list) {
      e.t += dt;
      if (e.t < 0) continue;
      e.mesh.visible = true;
      const k = e.t / e.life;
      if (e.kind === "heart") {
        e.mesh.position.y += dt * 3;
        e.mesh.position.x += e.vx * dt;
        const s = k < 0.2 ? k * 4 : 0.8;
        e.mesh.scale.set(s, s, 1);
        e.mesh.material.opacity = k > 0.6 ? (1 - k) / 0.4 : 1;
      } else {
        e.mesh.scale.setScalar(0.4 + k * e.size * 2);
        e.mesh.material.opacity = Math.max(0, 0.8 * (1 - k));
      }
      if (k >= 1) {
        this.scene.remove(e.mesh);
        e.mesh.material.dispose();
        e.done = true;
      }
    }
    this.list = this.list.filter((e) => !e.done);
  }
}
