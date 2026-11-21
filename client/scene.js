// Three.js world: a Hong Kong street block. No networking in here.
import * as THREE from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { ARENA, OBSTACLES, PLAYER, BOT, WEAPON, ZONE, pointBlocked } from "../shared/game.js";
import { CARDS } from "../shared/theme.js";

export const isTouch = matchMedia("(pointer: coarse)").matches || "ontouchstart" in window;

const FONT = '"Noto Sans HK", "PingFang HK", "Microsoft JhengHei", sans-serif';
const EMOJI = '"Noto Color Emoji", "Apple Color Emoji", "Segoe UI Emoji", sans-serif';
const SKY = "#cfe0ee";
const SHOP_SIGNS = ["茶餐廳", "涼茶", "電器", "冰室"];
const STREET_SIGNS = ["大押", "金舖", "藥房", "麻雀", "士多", "海鮮", "粥麵", "眼鏡", "酒家", "書局"];
const NEON = ["#ff3b6b", "#ffd23f", "#3ce0ff", "#7dff6b", "#ff8a3d"];
let sceneLang = "zh";

// ---------- canvas helpers ----------

function canvasTex(w, h, draw) {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  draw(c.getContext("2d"), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
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

// Fit text into maxW by shrinking the font.
function fitText(g, text, x, y, maxW, size, weight = 900, family = FONT) {
  let s = size;
  do {
    g.font = `${weight} ${s}px ${family}`;
    if (g.measureText(text).width <= maxW) break;
    s -= 2;
  } while (s > 10);
  g.fillText(text, x, y);
}

function rng(seed) {
  let a = seed | 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Neon sign: dark board, glowing characters (vertical or horizontal).
function neonTex(text, color, vertical) {
  const chars = [...text];
  const w = vertical ? 128 : 96 * chars.length + 48;
  const h = vertical ? 96 * chars.length + 48 : 128;
  return canvasTex(w, h, (g) => {
    g.fillStyle = "#1a1416";
    roundRect(g, 4, 4, w - 8, h - 8, 14);
    g.fill();
    g.strokeStyle = color;
    g.lineWidth = 5;
    g.shadowColor = color;
    g.shadowBlur = 14;
    roundRect(g, 12, 12, w - 24, h - 24, 10);
    g.stroke();
    g.fillStyle = "#fff";
    g.font = `900 78px ${FONT}`;
    g.textAlign = "center";
    g.textBaseline = "middle";
    chars.forEach((ch, i) => {
      const x = vertical ? w / 2 : 24 + 96 * i + 48;
      const y = vertical ? 24 + 96 * i + 50 : h / 2 + 4;
      g.shadowBlur = 18;
      g.fillStyle = color;
      g.fillText(ch, x, y);
      g.shadowBlur = 0;
      g.fillStyle = "rgba(255,255,255,0.85)";
      g.font = `900 70px ${FONT}`;
      g.fillText(ch, x, y);
      g.font = `900 78px ${FONT}`;
    });
  });
}

// Tong lau facade: pastel wall, rows of windows with AC boxes, shopfront.
function facadeTex(seed, wall, floors = 5) {
  const r = rng(seed);
  return canvasTex(256, 512, (g, w, h) => {
    g.fillStyle = wall;
    g.fillRect(0, 0, w, h);
    const shop = 90;
    const fh = (h - shop) / floors;
    for (let f = 0; f < floors; f++) {
      const y = f * fh;
      g.fillStyle = "rgba(0,0,0,0.08)";
      g.fillRect(0, y + fh - 6, w, 6);
      for (let c = 0; c < 3; c++) {
        const x = 16 + c * 80;
        g.fillStyle = r() < 0.35 ? "#f3e2b5" : "#3c4b57";
        g.fillRect(x, y + 14, 62, fh - 34);
        g.strokeStyle = "#e9e4da";
        g.lineWidth = 4;
        g.strokeRect(x, y + 14, 62, fh - 34);
        g.beginPath();
        g.moveTo(x + 31, y + 14);
        g.lineTo(x + 31, y + fh - 20);
        g.stroke();
        if (r() < 0.45) { // air-con box
          g.fillStyle = "#d9d6cf";
          g.fillRect(x + 8, y + fh - 30, 42, 20);
          g.fillStyle = "#9d9a93";
          for (let k = 0; k < 4; k++) g.fillRect(x + 12 + k * 9, y + fh - 26, 4, 12);
        }
        if (r() < 0.25) { // laundry pole
          g.strokeStyle = "#8a8a8a";
          g.lineWidth = 2;
          g.beginPath();
          g.moveTo(x - 4, y + fh - 12);
          g.lineTo(x + 66, y + fh - 12);
          g.stroke();
          g.fillStyle = ["#e85d75", "#5aa9e6", "#fff", "#ffd166"][Math.floor(r() * 4)];
          g.fillRect(x + 10 + r() * 30, y + fh - 12, 14, 18);
        }
      }
    }
    // shopfront: shutter + awning
    g.fillStyle = "#b8b4ab";
    g.fillRect(0, h - shop, w, shop);
    g.fillStyle = "#9e9a91";
    for (let y = h - shop + 30; y < h; y += 8) g.fillRect(10, y, w - 20, 3);
    for (let i = 0; i < 8; i++) {
      g.fillStyle = i % 2 ? "#ffffff" : ["#c8102e", "#1f6b47", "#2a6fdb"][seed % 3];
      g.fillRect(i * 32, h - shop, 32, 24);
    }
  });
}

function solid(color, opts = {}) {
  return new THREE.MeshStandardMaterial({ color, roughness: 0.7, ...opts });
}

// ---------- world ----------

export function createWorld(container) {
  const renderer = new THREE.WebGLRenderer({ antialias: !isTouch, powerPreference: "high-performance" });
  renderer.setPixelRatio(Math.min(devicePixelRatio, isTouch ? 1.5 : 2));
  renderer.toneMapping = THREE.NeutralToneMapping;
  container.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(SKY);
  scene.fog = new THREE.Fog(SKY, 55, 115);

  const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 250);
  camera.position.set(0, 30, 18);
  camera.lookAt(0, 0, 0);

  scene.add(new THREE.HemisphereLight("#eef4fb", "#8a7f70", 1.45));
  const sun = new THREE.DirectionalLight("#fff0d8", 1.9);
  sun.position.set(-10, 25, 14);
  scene.add(sun);

  buildGround(scene);
  buildEdge(scene);
  buildObstacles(scene);
  buildCity(scene);
  const loopTaxi = makeTaxi(4.4, 1.9);
  scene.add(loopTaxi);

  const resize = () => {
    const w = innerWidth, h = innerHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  };
  addEventListener("resize", resize);
  resize();

  // a taxi doing laps on the ring road outside the railings
  const R = ARENA + 1.9;
  const perim = 8 * R;
  function update(t) {
    let d = (t * 9) % perim;
    let x, z, rot;
    const side = Math.floor(d / (2 * R));
    const s = d % (2 * R) - R;
    if (side === 0) { x = s; z = R; rot = Math.PI / 2; }
    else if (side === 1) { x = R; z = -s; rot = Math.PI; }
    else if (side === 2) { x = -s; z = -R; rot = -Math.PI / 2; }
    else { x = -R; z = s; rot = 0; }
    loopTaxi.position.set(x, 0, z);
    loopTaxi.rotation.y = rot;
  }

  return { renderer, scene, camera, update };
}

function buildGround(scene) {
  const S = 1024;
  const u = (x) => ((x + ARENA) / (2 * ARENA)) * S;
  const px = S / (2 * ARENA);
  const tex = canvasTex(S, S, (g) => {
    // asphalt with speckle
    g.fillStyle = "#5f636a";
    g.fillRect(0, 0, S, S);
    const r = rng(3);
    for (let i = 0; i < 9000; i++) {
      g.fillStyle = r() < 0.5 ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.08)";
      g.fillRect(r() * S, r() * S, 2, 2);
    }
    // sidewalk band around the edge with tiles
    const sw = 2.6 * px;
    g.fillStyle = "#d9d2c3";
    g.fillRect(0, 0, S, sw); g.fillRect(0, S - sw, S, sw); g.fillRect(0, 0, sw, S); g.fillRect(S - sw, 0, sw, S);
    g.strokeStyle = "rgba(0,0,0,0.08)";
    g.lineWidth = 1;
    for (let p = 0; p < S; p += px * 0.9) {
      g.beginPath(); g.moveTo(p, 0); g.lineTo(p, sw); g.moveTo(p, S - sw); g.lineTo(p, S); g.moveTo(0, p); g.lineTo(sw, p); g.moveTo(S - sw, p); g.lineTo(S, p); g.stroke();
    }
    // kerb + double yellow lines (no stopping)
    g.strokeStyle = "#a7a49d"; g.lineWidth = 5; g.strokeRect(sw, sw, S - 2 * sw, S - 2 * sw);
    g.strokeStyle = "#f2c230"; g.lineWidth = 3;
    for (const o of [9, 15]) g.strokeRect(sw + o, sw + o, S - 2 * (sw + o), S - 2 * (sw + o));
    // centre lines (dashed white), skipping the roundabout
    g.strokeStyle = "#f4f4f0"; g.lineWidth = 4; g.setLineDash([26, 22]);
    const c = S / 2, rb = (ZONE.radius + 1.2) * px;
    g.beginPath();
    g.moveTo(sw + 20, c); g.lineTo(c - rb, c); g.moveTo(c + rb, c); g.lineTo(S - sw - 20, c);
    g.moveTo(c, sw + 20); g.lineTo(c, c - rb); g.moveTo(c, c + rb); g.lineTo(c, S - sw - 20);
    g.stroke();
    g.setLineDash([]);
    // zebra crossings
    g.fillStyle = "#f4f4f0";
    const zebra = (cx, cz, alongX) => {
      for (let i = -4; i <= 4; i++) {
        if (alongX) g.fillRect(u(cx) + i * 13 - 4, u(cz) - 2.2 * px, 8, 4.4 * px);
        else g.fillRect(u(cx) - 2.2 * px, u(cz) + i * 13 - 4, 4.4 * px, 8);
      }
    };
    zebra(0, -11.5, true); zebra(0, 11.5, true); zebra(-11.5, 0, false); zebra(11.5, 0, false);
    // painted road text
    g.textAlign = "center"; g.textBaseline = "middle";
    g.fillStyle = "#f4f4f0";
    g.font = `900 ${1.8 * px}px ${FONT}`;
    g.fillText("望右", u(-2.2), u(8.4));
    g.fillText("慢", u(6), u(20.5));
    g.fillText("慢", u(-6), u(-20.5));
    g.font = `900 ${0.9 * px}px ${FONT}`;
    g.fillText("LOOK RIGHT", u(-2.2), u(9.7));
    g.fillText("SLOW", u(6), u(22));
    // taxi stands: yellow boxes + 的士站
    g.strokeStyle = "#f2c230"; g.lineWidth = 4; g.fillStyle = "#f2c230";
    g.font = `900 ${1.1 * px}px ${FONT}`;
    for (const [x, z, horiz] of [[0, -15, 1], [0, 15, 1], [-15, 0, 0], [15, 0, 0]]) {
      const L = 12.5 * px, W = 3.2 * px;
      if (horiz) g.strokeRect(u(x) - L / 2, u(z) - W / 2, L, W); else g.strokeRect(u(x) - W / 2, u(z) - L / 2, W, L);
      if (horiz) g.fillText("的士站 TAXI", u(x), u(z) + (z < 0 ? 2.5 : -2.5) * px);
    }
    // roundabout island = LLM zone
    g.fillStyle = "#e7dcc2";
    g.beginPath(); g.arc(c, c, ZONE.radius * px, 0, Math.PI * 2); g.fill();
    g.strokeStyle = "rgba(0,0,0,0.06)"; g.lineWidth = 1;
    for (let p = c - ZONE.radius * px; p < c + ZONE.radius * px; p += px * 0.8) {
      g.beginPath(); g.moveTo(p, c - ZONE.radius * px); g.lineTo(p, c + ZONE.radius * px); g.stroke();
      g.beginPath(); g.moveTo(c - ZONE.radius * px, p); g.lineTo(c + ZONE.radius * px, p); g.stroke();
    }
    g.strokeStyle = "#ffcc00"; g.lineWidth = 7; g.setLineDash([18, 12]);
    g.beginPath(); g.arc(c, c, ZONE.radius * px - 4, 0, Math.PI * 2); g.stroke();
    g.setLineDash([]);
  });
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(ARENA * 2, ARENA * 2), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.95 }));
  floor.rotation.x = -Math.PI / 2;
  scene.add(floor);
  // ring road + beyond
  const outer = new THREE.Mesh(new THREE.PlaneGeometry(400, 400), new THREE.MeshStandardMaterial({ color: "#5a5e65", roughness: 1 }));
  outer.rotation.x = -Math.PI / 2;
  outer.position.y = -0.02;
  scene.add(outer);
}

// Green HK pedestrian railings around the block.
function buildEdge(scene) {
  const green = solid("#2f6f4f", { roughness: 0.5 });
  const E = ARENA + 0.15;
  const posts = [];
  for (let p = -E; p <= E + 0.01; p += 2) posts.push([p, -E], [p, E], [-E, p], [E, p]);
  const postMesh = new THREE.InstancedMesh(new THREE.BoxGeometry(0.12, 1.05, 0.12), green, posts.length);
  const m = new THREE.Matrix4();
  posts.forEach(([x, z], i) => { m.makeTranslation(x, 0.52, z); postMesh.setMatrixAt(i, m); });
  scene.add(postMesh);
  for (const y of [0.45, 1.0]) {
    for (const [x, z, w, d] of [[0, -E, 2 * E, 0.08], [0, E, 2 * E, 0.08], [-E, 0, 0.08, 2 * E], [E, 0, 0.08, 2 * E]]) {
      const bar = new THREE.Mesh(new THREE.BoxGeometry(w, 0.08, d), green);
      bar.position.set(x, y, z);
      scene.add(bar);
    }
  }
}

function shadow(w, d) {
  const m = new THREE.Mesh(shadowGeo, shadowMat);
  m.rotation.x = -Math.PI / 2;
  m.position.y = 0.012;
  m.scale.set(w, d, 1);
  return m;
}
const shadowTex = canvasTex(128, 128, (g) => {
  const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  gr.addColorStop(0, "rgba(10,10,20,0.4)");
  gr.addColorStop(1, "rgba(10,10,20,0)");
  g.fillStyle = gr;
  g.fillRect(0, 0, 128, 128);
});
const shadowGeo = new THREE.PlaneGeometry(1, 1);
const shadowMat = new THREE.MeshBasicMaterial({ map: shadowTex, transparent: true, depthWrite: false });

function wheels(group, L, W) {
  const geo = new THREE.CylinderGeometry(0.32, 0.32, 0.22, 14);
  const mat = solid("#1d1d1d");
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    const w = new THREE.Mesh(geo, mat);
    w.rotation.x = Math.PI / 2;
    w.position.set(sx * L * 0.32, 0.32, sz * (W / 2 - 0.04));
    group.add(w);
  }
}

// HK urban taxi: red body, silver roof, TAXI light. Built along +x.
function makeTaxi(L, W) {
  const g = new THREE.Group();
  g.add(shadow(L + 1, W + 0.8));
  const body = new THREE.Mesh(new RoundedBoxGeometry(L, 0.75, W, 2, 0.18), solid("#c8102e", { roughness: 0.35, metalness: 0.2 }));
  body.position.y = 0.62;
  g.add(body);
  const cabin = new THREE.Mesh(new RoundedBoxGeometry(L * 0.52, 0.55, W * 0.88, 2, 0.15), solid("#2d3b46", { roughness: 0.2, metalness: 0.4 }));
  cabin.position.set(-L * 0.04, 1.24, 0);
  g.add(cabin);
  const roof = new THREE.Mesh(new RoundedBoxGeometry(L * 0.5, 0.08, W * 0.86, 1, 0.03), solid("#d9d9d6", { roughness: 0.4 }));
  roof.position.set(-L * 0.04, 1.53, 0);
  g.add(roof);
  const sign = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.2, 0.7), new THREE.MeshBasicMaterial({
    map: canvasTex(128, 48, (c) => { c.fillStyle = "#fff6c8"; c.fillRect(0, 0, 128, 48); c.fillStyle = "#c8102e"; c.font = "900 34px sans-serif"; c.textAlign = "center"; c.textBaseline = "middle"; c.fillText("TAXI", 64, 26); }),
  }));
  sign.position.set(-L * 0.04, 1.66, 0);
  g.add(sign);
  wheels(g, L, W);
  return g;
}

// Green minibus: cream body, dark window band, green roof, red LED destination.
function makeMinibus(L, W) {
  const g = new THREE.Group();
  g.add(shadow(L + 1, W + 0.8));
  const body = new THREE.Mesh(new RoundedBoxGeometry(L, 1.6, W, 2, 0.22), solid("#f1ead6", { roughness: 0.45 }));
  body.position.y = 1.1;
  g.add(body);
  const glass = new THREE.Mesh(new RoundedBoxGeometry(L + 0.04, 0.5, W + 0.04, 1, 0.12), solid("#2d3b46", { roughness: 0.2, metalness: 0.4 }));
  glass.position.y = 1.45;
  g.add(glass);
  const roof = new THREE.Mesh(new RoundedBoxGeometry(L - 0.1, 0.16, W - 0.06, 1, 0.07), solid("#1f6b47", { roughness: 0.4 }));
  roof.position.y = 1.95;
  g.add(roof);
  const stripe = new THREE.Mesh(new THREE.BoxGeometry(L + 0.02, 0.12, W + 0.02), solid("#1f6b47"));
  stripe.position.y = 0.72;
  g.add(stripe);
  const led = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.3), new THREE.MeshBasicMaterial({
    map: canvasTex(192, 64, (c) => { c.fillStyle = "#111"; c.fillRect(0, 0, 192, 64); c.fillStyle = "#ff3b2f"; c.font = `900 40px ${FONT}`; c.textAlign = "center"; c.textBaseline = "middle"; c.fillText("旺角", 96, 34); }),
  }));
  led.position.set(L / 2 + 0.02, 1.75, 0);
  led.rotation.y = Math.PI / 2;
  g.add(led);
  wheels(g, L, W);
  return g;
}

function buildObstacles(scene) {
  const wallColors = ["#a8d5c2", "#f2b5b0", "#f4dc9c", "#b7c9e8"];
  for (const o of OBSTACLES) {
    const alongX = o.hx >= o.hz;
    const L = (alongX ? o.hx : o.hz) * 2, W = (alongX ? o.hz : o.hx) * 2;
    if (o.kind === "taxi" || o.kind === "minibus") {
      const v = o.kind === "taxi" ? makeTaxi(L, W) : makeMinibus(L, W);
      v.position.set(o.x, 0, o.z);
      v.rotation.y = alongX ? (o.x > 0 ? Math.PI : 0) : (o.z > 0 ? Math.PI / 2 : -Math.PI / 2);
      scene.add(v);
    } else if (o.kind === "rail") {
      const g = new THREE.Group();
      const green = solid("#2f6f4f", { roughness: 0.5 });
      for (const y of [0.45, 1.0]) {
        const bar = new THREE.Mesh(new THREE.BoxGeometry(L, 0.09, 0.09), green);
        bar.position.y = y;
        g.add(bar);
      }
      for (let p = -L / 2; p <= L / 2 + 0.01; p += L / 4) {
        const post = new THREE.Mesh(new THREE.BoxGeometry(0.12, 1.05, 0.12), green);
        post.position.set(p, 0.52, 0);
        g.add(post);
      }
      // white panels like HK railings
      const panel = new THREE.Mesh(new THREE.BoxGeometry(L, 0.4, 0.04), solid("#f0f0ea"));
      panel.position.y = 0.72;
      g.add(panel);
      g.position.set(o.x, 0, o.z);
      if (!alongX) g.rotation.y = Math.PI / 2;
      scene.add(g);
    } else if (o.kind === "shop") {
      const tex = facadeTex(o.sign + 11, wallColors[o.sign % 4], 4);
      const roofMat = solid("#a9a49a");
      const side = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.8 });
      const box = new THREE.Mesh(new THREE.BoxGeometry(o.hx * 2, o.h, o.hz * 2), [side, side, roofMat, roofMat, side, side]);
      box.position.set(o.x, o.h / 2, o.z);
      scene.add(box);
      const sh = shadow(o.hx * 2 + 2, o.hz * 2 + 2);
      sh.position.set(o.x, 0.012, o.z);
      scene.add(sh);
      const tank = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.45, 0.8, 12), solid("#6f8fa8"));
      tank.position.set(o.x + 0.6, o.h + 0.4, o.z - 0.5);
      scene.add(tank);
      // neon signboard on the street-facing (south) side, plus a vertical one
      const text = SHOP_SIGNS[o.sign % SHOP_SIGNS.length];
      const color = NEON[o.sign % NEON.length];
      const tx = neonTex(text, color, false);
      const board = new THREE.Mesh(new THREE.PlaneGeometry(0.75 * [...text].length + 0.4, 0.95), new THREE.MeshBasicMaterial({ map: tx, transparent: true }));
      board.position.set(o.x, 2.2, o.z + o.hz + 0.06);
      scene.add(board);
      const vt = neonTex(text, NEON[(o.sign + 2) % NEON.length], true);
      const vboard = new THREE.Mesh(new THREE.PlaneGeometry(0.7, 0.55 * [...text].length + 0.25), new THREE.MeshBasicMaterial({ map: vt, transparent: true, side: THREE.DoubleSide }));
      vboard.position.set(o.x + o.hx + 0.5, 3.6, o.z + o.hz - 0.3);
      vboard.rotation.y = Math.PI / 2;
      scene.add(vboard);
    } else if (o.kind === "core") {
      // newspaper-kiosk style booth holding the LLM brain
      const body = new THREE.Mesh(new RoundedBoxGeometry(o.hx * 2, 2.6, o.hz * 2, 2, 0.2), solid("#1f6b47", { roughness: 0.5 }));
      body.position.set(o.x, 1.3, o.z);
      scene.add(body);
      const trim = new THREE.Mesh(new THREE.BoxGeometry(o.hx * 2 + 0.06, 0.25, o.hz * 2 + 0.06), solid("#ffcc00"));
      trim.position.set(o.x, 1.9, o.z);
      scene.add(trim);
      const roof = new THREE.Mesh(new RoundedBoxGeometry(o.hx * 2 + 0.6, 0.35, o.hz * 2 + 0.6, 2, 0.12), solid("#c8102e", { roughness: 0.45 }));
      roof.position.set(o.x, 2.78, o.z);
      scene.add(roof);
      const brain = new THREE.Sprite(new THREE.SpriteMaterial({
        map: canvasTex(320, 160, (c, w, h) => {
          c.fillStyle = "#141414"; roundRect(c, 6, 6, w - 12, h - 12, 18); c.fill();
          c.strokeStyle = "#ffcc00"; c.lineWidth = 5; roundRect(c, 14, 14, w - 28, h - 28, 12); c.stroke();
          c.textAlign = "center"; c.textBaseline = "middle";
          c.font = `90px ${EMOJI}`; c.fillText("🧠", 86, 84);
          c.fillStyle = "#ff3b2f"; c.font = `900 54px Orbitron, ${FONT}`; c.fillText("LLM", 214, 64);
          c.fillStyle = "#ffcc00"; c.font = `900 32px ${FONT}`; c.fillText("AI 嘅大腦", 214, 112);
        }),
      }));
      brain.position.set(o.x, 4.3, o.z);
      brain.scale.set(3.4, 1.7, 1);
      scene.add(brain);
    }
  }
}

// Tong lau buildings around the block, with neon signs. South side stays low
// so it never hides the action from the camera.
function buildCity(scene) {
  const walls = ["#a8d5c2", "#f2b5b0", "#f4dc9c", "#b7c9e8", "#e7c6a1", "#cfd8c4"];
  const textures = walls.map((w, i) => facadeTex(100 + i, w, 6));
  const roofMat = solid("#9d988e");
  const r = rng(42);
  let signIdx = 0;
  const place = (x, z, w, d, h, face) => {
    const tex = textures[Math.floor(r() * textures.length)];
    const side = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.85 });
    const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), [side, side, roofMat, roofMat, side, side]);
    b.position.set(x, h / 2, z);
    scene.add(b);
    if (h > 4.4 && r() < 0.85) {
      const text = STREET_SIGNS[signIdx++ % STREET_SIGNS.length];
      const vertical = r() < 0.6;
      const tx = neonTex(text, NEON[signIdx % NEON.length], vertical);
      const n = [...text].length;
      const sw = vertical ? 1.2 : 1.1 * n + 0.6, sh = vertical ? 1.0 * n + 0.6 : 1.3;
      const sign = new THREE.Mesh(new THREE.PlaneGeometry(sw, sh), new THREE.MeshBasicMaterial({ map: tx, transparent: true }));
      const y = Math.min(h - sh / 2 - 0.3, 2.6 + sh / 2 + r() * Math.max(0, h - sh - 3));
      if (face === "s") sign.position.set(x + (r() - 0.5) * (w - sw), y, z + d / 2 + 0.25);
      if (face === "e") { sign.position.set(x + w / 2 + 0.25, y, z + (r() - 0.5) * (d - sw)); sign.rotation.y = Math.PI / 2; }
      if (face === "w") { sign.position.set(x - w / 2 - 0.25, y, z + (r() - 0.5) * (d - sw)); sign.rotation.y = -Math.PI / 2; }
      scene.add(sign);
    }
  };
  const B = ARENA + 4.2;
  for (let x = -B - 2; x < B + 2;) { const w = 5 + r() * 4; place(x + w / 2, -B - 3, w, 6, 9 + r() * 7, "s"); x += w + 0.15; }
  for (let z = -B + 3; z < B;) { const d = 5 + r() * 4; place(-B - 3, z + d / 2, 6, d, 4.5 + r() * 3, "e"); place(B + 3, z + d / 2, 6, d, 4.5 + r() * 3, "w"); z += d + 0.15; }
  for (let x = -B - 2; x < B + 2;) { const w = 5 + r() * 4; place(x + w / 2, B + 3, w, 6, 2.6 + r() * 0.8, "n"); x += w + 0.15; }
}

// ---------- players ----------

export function createPlayerMesh(color, isMe) {
  const g = new THREE.Group();
  g.add(shadow(1.9, 1.9));
  const col = new THREE.Color(color);
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(PLAYER.radius * 0.85, 0.55, 6, 16), solid(col, { roughness: 0.45 }));
  body.position.y = 0.9;
  g.add(body);
  const visor = new THREE.Mesh(new RoundedBoxGeometry(0.66, 0.3, 0.2, 2, 0.1), solid("#1b1b1b", { roughness: 0.3 }));
  visor.position.set(0, 0.25, 0.42);
  body.add(visor);
  const eyeMat = new THREE.MeshBasicMaterial({ color: "#ffffff" });
  for (const ex of [-0.14, 0.14]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 6), eyeMat);
    eye.position.set(ex, 0.26, 0.52);
    body.add(eye);
  }
  const gun = new THREE.Mesh(new RoundedBoxGeometry(0.2, 0.2, 0.6, 2, 0.06), solid("#f7f1e3", { roughness: 0.4 }));
  gun.position.set(0, 0.85, 0.62);
  g.add(gun);
  if (isMe) {
    const ring = new THREE.Mesh(new THREE.RingGeometry(PLAYER.radius + 0.25, PLAYER.radius + 0.42, 40), new THREE.MeshBasicMaterial({ color: "#ffcc00", side: THREE.DoubleSide }));
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.03;
    g.add(ring);
  }
  const shield = new THREE.Mesh(new THREE.SphereGeometry(1.15, 24, 16), new THREE.MeshBasicMaterial({ color: "#3ce0ff", transparent: true, opacity: 0.2, depthWrite: false }));
  shield.position.y = 0.9;
  shield.visible = false;
  g.add(shield);

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
  g.font = `900 24px ${FONT}`;
  const tw = Math.min(170, g.measureText(name).width);
  const w = tw + 46, x = 128 - w / 2;
  g.fillStyle = "#f7f1e3";
  roundRect(g, x, 6, w, 38, 8);
  g.fill();
  g.strokeStyle = "#1b1b1b";
  g.lineWidth = 3;
  g.stroke();
  g.fillStyle = color;
  g.beginPath(); g.arc(x + 18, 25, 7, 0, Math.PI * 2); g.fill();
  g.stroke();
  g.fillStyle = "#1b1b1b";
  g.textBaseline = "middle";
  g.fillText(name, x + 32, 26, 170);
  g.fillStyle = "#1b1b1b";
  roundRect(g, 76, 50, 104, 12, 4);
  g.fill();
  g.fillStyle = hp > 35 ? "#3cc46e" : "#ff3b2f";
  roundRect(g, 78, 52, Math.max(6, 100 * Math.max(0, hp / 100)), 8, 3);
  g.fill();
  m.labelTex.needsUpdate = true;
}

// ---------- bots: 作故仔 (Hallucinations) ----------

// created lazily so the web font has loaded before we draw text
const botTags = {};
const botTag = (lang) => (botTags[lang] ||= canvasTex(200, 72, (c) => tagDraw(c, lang === "zh" ? "🤥 作故仔" : "🤥 FAKE")));
function tagDraw(c, text) {
  c.fillStyle = "#5b3a70";
  roundRect(c, 6, 6, 188, 60, 12);
  c.fill();
  c.strokeStyle = "#1b1b1b";
  c.lineWidth = 4;
  c.stroke();
  c.fillStyle = "#fff";
  c.textAlign = "center";
  c.textBaseline = "middle";
  c.font = `900 32px ${FONT}, ${EMOJI}`;
  c.fillText(text, 100, 38);
}
const botTagMats = [];

export function createBotMesh() {
  const g = new THREE.Group();
  g.add(shadow(2.2, 2.2));
  const core = new THREE.Mesh(
    new THREE.IcosahedronGeometry(BOT.radius, 0),
    new THREE.MeshStandardMaterial({ color: "#2b1838", emissive: "#a64dff", emissiveIntensity: 0.25, roughness: 0.3, flatShading: true })
  );
  core.position.y = 1.1;
  g.add(core);
  const shell = new THREE.Mesh(
    new THREE.IcosahedronGeometry(BOT.radius * 1.4, 0),
    new THREE.MeshBasicMaterial({ color: "#c77dff", wireframe: true, transparent: true, opacity: 0.6 })
  );
  shell.position.y = 1.1;
  g.add(shell);
  const mat = new THREE.SpriteMaterial({ map: botTag(sceneLang), transparent: true, depthTest: false });
  botTagMats.push(mat);
  const tag = new THREE.Sprite(mat);
  tag.position.y = 2.55;
  tag.scale.set(2, 0.72, 1);
  tag.renderOrder = 9;
  g.add(tag);
  return { group: g, core, shell };
}

// ---------- pickups: term cards ----------

const cardTexCache = new Map();
function cardTex(kind, scam, lang) {
  const key = `${kind}|${scam ? 1 : 0}|${lang}`;
  if (cardTexCache.has(key)) return cardTexCache.get(key);
  const card = CARDS[kind];
  const tex = canvasTex(256, 340, (g, w, h) => {
    g.fillStyle = "#fffdf6";
    roundRect(g, 8, 8, w - 16, h - 16, 22);
    g.fill();
    g.lineWidth = 8;
    g.strokeStyle = "#1b1b1b";
    g.stroke();
    g.save();
    roundRect(g, 8, 8, w - 16, h - 16, 22);
    g.clip();
    g.fillStyle = card.color;
    g.fillRect(8, 8, w - 16, 78);
    g.restore();
    g.strokeStyle = "#1b1b1b";
    g.lineWidth = 6;
    g.beginPath(); g.moveTo(8, 86); g.lineTo(w - 8, 86); g.stroke();
    g.fillStyle = "#fff";
    g.textAlign = "center";
    g.textBaseline = "middle";
    fitText(g, card.term, w / 2, 50, w - 50, 46);
    g.font = `112px ${EMOJI}`;
    g.fillText(card.emoji, w / 2, 178);
    g.fillStyle = "#1b1b1b";
    fitText(g, card.analogy[lang], w / 2, 284, w - 40, lang === "zh" ? 40 : 30);
    if (scam) { // the tell: a phone badge in the corner
      g.fillStyle = "#c8102e";
      g.beginPath(); g.arc(w - 42, 118, 30, 0, Math.PI * 2); g.fill();
      g.lineWidth = 5; g.strokeStyle = "#1b1b1b"; g.stroke();
      g.font = `34px ${EMOJI}`;
      g.fillText("📞", w - 42, 120);
    }
  });
  cardTexCache.set(key, tex);
  return tex;
}

export function createPickupMesh(kind) {
  const g = new THREE.Group();
  g.add(shadow(1.6, 1.6));
  const mat = new THREE.SpriteMaterial({ map: cardTex(kind, false, sceneLang), transparent: true });
  const tile = new THREE.Sprite(mat);
  tile.scale.set(1.6, 2.13, 1);
  tile.position.y = 1.6;
  g.add(tile);
  const view = { group: g, tile, mat, kind, scam: false };
  view.refresh = (scam) => {
    view.scam = scam;
    mat.map = cardTex(kind, scam, sceneLang);
    mat.needsUpdate = true;
  };
  return view;
}

export function setSceneLang(lang, pickupViews = []) {
  sceneLang = lang;
  for (const m of botTagMats) { m.map = botTag(lang); m.needsUpdate = true; }
  for (const v of pickupViews) v.refresh(v.scam);
}

// ---------- guide arrow (first seconds of a round) ----------

export function createGuideArrow() {
  const shape = new THREE.Shape();
  shape.moveTo(0, 0.75);
  shape.lineTo(0.55, 0);
  shape.lineTo(0.2, 0);
  shape.lineTo(0.2, -0.5);
  shape.lineTo(-0.2, -0.5);
  shape.lineTo(-0.2, 0);
  shape.lineTo(-0.55, 0);
  shape.closePath();
  const g = new THREE.Group();
  const outline = new THREE.Mesh(new THREE.ShapeGeometry(shape), new THREE.MeshBasicMaterial({ color: "#1b1b1b", depthTest: false }));
  outline.scale.setScalar(1.25);
  const fill = new THREE.Mesh(new THREE.ShapeGeometry(shape), new THREE.MeshBasicMaterial({ color: "#ffcc00", depthTest: false }));
  fill.position.z = 0.001;
  for (const m of [outline, fill]) {
    m.rotation.x = -Math.PI / 2; // lie flat, tip pointing along +z after the group turns
    m.renderOrder = 5;
  }
  outline.position.y = -0.01;
  // shape points along +y; after lying flat that's -z, so flip to face +z
  const holder = new THREE.Group();
  holder.add(outline, fill);
  holder.rotation.y = Math.PI;
  g.add(holder);
  g.visible = false;
  return g;
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
  spawn(x, z, a, color, scale = 1) {
    const mesh = new THREE.Mesh(bulletGeo, bulletMat(color));
    mesh.scale.setScalar(scale);
    mesh.position.set(x, 0.9, z);
    this.scene.add(mesh);
    const b = { mesh, x, z, vx: Math.sin(a) * WEAPON.speed, vz: Math.cos(a) * WEAPON.speed, left: WEAPON.range };
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
const emojiCache = new Map();
function emojiTex(e) {
  if (!emojiCache.has(e)) {
    emojiCache.set(e, canvasTex(128, 128, (g) => {
      g.textAlign = "center";
      g.textBaseline = "middle";
      g.font = `100px ${EMOJI}`;
      g.fillText(e, 64, 70);
    }));
  }
  return emojiCache.get(e);
}

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
  // emoji that floats up and fades (card pickups, scams, busts)
  pop(x, z, emoji, n = 1) {
    for (let i = 0; i < n; i++) {
      const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: emojiTex(emoji), transparent: true, depthTest: false }));
      s.position.set(x + (Math.random() - 0.5) * (n > 1 ? 1.4 : 0), 1.8, z + (Math.random() - 0.5) * 0.4);
      s.renderOrder = 11;
      s.visible = false;
      this.scene.add(s);
      this.list.push({ mesh: s, t: -i * 0.08, life: 1, kind: "pop", vx: (Math.random() - 0.5) * (n > 1 ? 1.5 : 0) });
    }
  }
  update(dt) {
    for (const e of this.list) {
      e.t += dt;
      if (e.t < 0) continue;
      e.mesh.visible = true;
      const k = e.t / e.life;
      if (e.kind === "pop") {
        e.mesh.position.y += dt * 2.5;
        e.mesh.position.x += e.vx * dt;
        const s = k < 0.2 ? k * 6 : 1.2;
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
