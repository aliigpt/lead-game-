// Desktop (WASD + mouse) and touch (twin virtual sticks + ability button) input.
import * as THREE from "three";
import { isTouch } from "./scene.js";

export function createInput({ canvas, camera, abilityBtn, joyL, joyR }) {
  const state = {
    moveX: 0, moveZ: 0, // world-space move vector, length <= 1
    aim: null, // world-space aim angle, or null = keep last
    firing: false,
    abilityPressed: false, // edge-triggered, consumed by the game loop
    usingTouch: isTouch,
  };

  // ---------- keyboard ----------
  const keys = new Set();
  addEventListener("keydown", (e) => {
    if (e.target instanceof HTMLInputElement) return;
    keys.add(e.code);
    if (e.code === "Space" || e.code === "ShiftLeft" || e.code === "ShiftRight") {
      state.abilityPressed = true;
      e.preventDefault();
    }
  });
  addEventListener("keyup", (e) => keys.delete(e.code));
  addEventListener("blur", () => { keys.clear(); state.firing = false; });

  // ---------- mouse ----------
  const mouse = new THREE.Vector2();
  let mouseActive = false;
  canvas.addEventListener("mousemove", (e) => {
    mouse.set((e.clientX / innerWidth) * 2 - 1, -(e.clientY / innerHeight) * 2 + 1);
    mouseActive = true;
  });
  canvas.addEventListener("mousedown", (e) => { if (e.button === 0) state.firing = true; });
  addEventListener("mouseup", (e) => { if (e.button === 0 && !state.usingTouch) state.firing = false; });
  canvas.addEventListener("contextmenu", (e) => e.preventDefault());

  const ray = new THREE.Raycaster();
  const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -1.0);
  const hit = new THREE.Vector3();

  // ---------- touch sticks ----------
  const sticks = { L: null, R: null };
  const RADIUS = 50;
  const knob = (el) => el.querySelector(".knob");

  function startStick(side, t) {
    const el = side === "L" ? joyL : joyR;
    sticks[side] = { id: t.identifier, ox: t.clientX, oy: t.clientY, dx: 0, dy: 0, el };
    el.style.left = `${t.clientX}px`;
    el.style.top = `${t.clientY}px`;
    knob(el).style.transform = "translate(0,0)";
    el.classList.remove("hidden");
  }
  function moveStick(s, t) {
    let dx = t.clientX - s.ox, dy = t.clientY - s.oy;
    const d = Math.hypot(dx, dy);
    if (d > RADIUS) { dx = (dx / d) * RADIUS; dy = (dy / d) * RADIUS; }
    s.dx = dx; s.dy = dy;
    knob(s.el).style.transform = `translate(${dx}px, ${dy}px)`;
  }
  function endStick(side) {
    const s = sticks[side];
    if (!s) return;
    s.el.classList.add("hidden");
    sticks[side] = null;
  }

  canvas.addEventListener("touchstart", (e) => {
    state.usingTouch = true;
    document.body.classList.add("is-touch");
    for (const t of e.changedTouches) {
      const side = t.clientX < innerWidth / 2 ? "L" : "R";
      if (!sticks[side]) startStick(side, t);
    }
    e.preventDefault();
  }, { passive: false });
  canvas.addEventListener("touchmove", (e) => {
    for (const t of e.changedTouches) {
      for (const side of ["L", "R"]) if (sticks[side]?.id === t.identifier) moveStick(sticks[side], t);
    }
    e.preventDefault();
  }, { passive: false });
  const onEnd = (e) => {
    for (const t of e.changedTouches) {
      for (const side of ["L", "R"]) if (sticks[side]?.id === t.identifier) endStick(side);
    }
  };
  canvas.addEventListener("touchend", onEnd);
  canvas.addEventListener("touchcancel", onEnd);

  const pressAbility = (e) => { state.abilityPressed = true; e.preventDefault(); e.stopPropagation(); };
  abilityBtn.addEventListener("touchstart", pressAbility, { passive: false });
  abilityBtn.addEventListener("mousedown", pressAbility);

  // Screen up = world -z, screen right = world +x (camera sits on +z looking down).
  function update(myX, myZ) {
    let mx = 0, mz = 0;
    if (keys.has("KeyW") || keys.has("ArrowUp")) mz -= 1;
    if (keys.has("KeyS") || keys.has("ArrowDown")) mz += 1;
    if (keys.has("KeyA") || keys.has("ArrowLeft")) mx -= 1;
    if (keys.has("KeyD") || keys.has("ArrowRight")) mx += 1;

    if (sticks.L) {
      const k = Math.hypot(sticks.L.dx, sticks.L.dy) / RADIUS;
      if (k > 0.15) { mx = sticks.L.dx / RADIUS; mz = sticks.L.dy / RADIUS; }
    }
    const len = Math.hypot(mx, mz);
    if (len > 1) { mx /= len; mz /= len; }
    state.moveX = mx;
    state.moveZ = mz;

    if (state.usingTouch) {
      const s = sticks.R;
      if (s && Math.hypot(s.dx, s.dy) > 12) {
        state.aim = Math.atan2(s.dx, s.dy);
        state.firing = true;
      } else {
        state.firing = false;
        // no right stick: face where you're walking
        state.aim = len > 0.2 ? Math.atan2(mx, mz) : null;
      }
    } else if (mouseActive) {
      ray.setFromCamera(mouse, camera);
      if (ray.ray.intersectPlane(plane, hit)) state.aim = Math.atan2(hit.x - myX, hit.z - myZ);
    }
    return state;
  }

  function reset() {
    keys.clear();
    state.firing = false;
    state.abilityPressed = false;
    endStick("L");
    endStick("R");
  }

  return { state, update, reset };
}
