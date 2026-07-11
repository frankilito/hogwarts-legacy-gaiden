// input.js — 键鼠/触屏统一输入
export const Input = {
  keys: {}, just: new Set(),
  mouseDX: 0, mouseDY: 0, wheel: 0,
  pointerLocked: false,
  lmb: false, rmb: false, lmbJust: false,
  joy: { x: 0, y: 0, active: false },
  touch: matchMedia('(pointer:coarse)').matches,
  enabled: true, // 对话/面板打开时禁用游戏输入
  virtual: {}, // 触屏按钮
};

const KEYMAP = { KeyW: 'up', KeyS: 'down', KeyA: 'left', KeyD: 'right', ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right' };

export function initInput(canvas) {
  addEventListener('keydown', (e) => {
    if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) return;
    if (!Input.keys[e.code]) Input.just.add(e.code);
    Input.keys[e.code] = true;
    if (['Space', 'Tab', 'ArrowUp', 'ArrowDown'].includes(e.code)) e.preventDefault();
  });
  addEventListener('keyup', (e) => { Input.keys[e.code] = false; });
  addEventListener('blur', () => { Input.keys = {}; Input.lmb = Input.rmb = false; });

  canvas.addEventListener('mousedown', (e) => {
    if (e.button === 0) { Input.lmb = true; Input.lmbJust = true; }
    if (e.button === 2) Input.rmb = true;
    if (!Input.touch && !Input.pointerLocked && Input.enabled) canvas.requestPointerLock?.();
  });
  addEventListener('mouseup', (e) => { if (e.button === 0) Input.lmb = false; if (e.button === 2) Input.rmb = false; });
  addEventListener('contextmenu', (e) => e.preventDefault());
  document.addEventListener('pointerlockchange', () => { Input.pointerLocked = document.pointerLockElement === canvas; });
  addEventListener('mousemove', (e) => {
    if (Input.pointerLocked) { Input.mouseDX += e.movementX; Input.mouseDY += e.movementY; }
  });
  addEventListener('wheel', (e) => { Input.wheel += Math.sign(e.deltaY); }, { passive: true });

  initTouch();
}

export function exitPointerLock() { if (Input.pointerLocked) document.exitPointerLock?.(); }

function initTouch() {
  const base = document.getElementById('joyBase');
  const knob = document.getElementById('joyKnob');
  if (!base) return;
  let jid = null, cx = 0, cy = 0;
  base.addEventListener('touchstart', (e) => {
    const t = e.changedTouches[0]; jid = t.identifier;
    const r = base.getBoundingClientRect(); cx = r.left + r.width / 2; cy = r.top + r.height / 2;
    Input.joy.active = true; e.preventDefault();
  }, { passive: false });
  addEventListener('touchmove', (e) => {
    for (const t of e.changedTouches) if (t.identifier === jid) {
      const dx = t.clientX - cx, dy = t.clientY - cy;
      const m = Math.min(1, Math.hypot(dx, dy) / 46);
      const a = Math.atan2(dy, dx);
      Input.joy.x = Math.cos(a) * m; Input.joy.y = Math.sin(a) * m;
      knob.style.transform = `translate(calc(-50% + ${Math.cos(a) * m * 34}px), calc(-50% + ${Math.sin(a) * m * 34}px))`;
    }
  }, { passive: true });
  const end = (e) => {
    for (const t of e.changedTouches) if (t.identifier === jid) {
      jid = null; Input.joy.x = Input.joy.y = 0; Input.joy.active = false;
      knob.style.transform = 'translate(-50%,-50%)';
    }
  };
  addEventListener('touchend', end); addEventListener('touchcancel', end);

  // 触屏视角:右半屏拖动
  let lookId = null, lx = 0, ly = 0;
  addEventListener('touchstart', (e) => {
    for (const t of e.changedTouches) {
      if (t.clientX > innerWidth * 0.45 && lookId === null && !t.target.closest('.tbtn,button,.panel,#decorBar')) {
        lookId = t.identifier; lx = t.clientX; ly = t.clientY;
      }
    }
  }, { passive: true });
  addEventListener('touchmove', (e) => {
    for (const t of e.changedTouches) if (t.identifier === lookId) {
      Input.mouseDX += (t.clientX - lx) * 2.4; Input.mouseDY += (t.clientY - ly) * 2.4;
      lx = t.clientX; ly = t.clientY;
    }
  }, { passive: true });
  const lend = (e) => { for (const t of e.changedTouches) if (t.identifier === lookId) lookId = null; };
  addEventListener('touchend', lend); addEventListener('touchcancel', lend);

  const bindBtn = (id, name) => {
    const el = document.getElementById(id); if (!el) return;
    el.addEventListener('touchstart', (e) => { Input.virtual[name] = true; Input.just.add('V_' + name); e.preventDefault(); }, { passive: false });
    el.addEventListener('touchend', () => { Input.virtual[name] = false; });
  };
  bindBtn('tbA', 'cast'); bindBtn('tbB', 'dodge'); bindBtn('tbE', 'interact'); bindBtn('tbMenu', 'menu');
}

export function moveVec() {
  if (!Input.enabled) return { x: 0, y: 0 };
  let x = 0, y = 0;
  for (const [code, dir] of Object.entries(KEYMAP)) {
    if (!Input.keys[code]) continue;
    if (dir === 'up') y -= 1; if (dir === 'down') y += 1;
    if (dir === 'left') x -= 1; if (dir === 'right') x += 1;
  }
  if (Input.joy.active) { x += Input.joy.x; y += Input.joy.y; }
  const m = Math.hypot(x, y);
  if (m > 1) { x /= m; y /= m; }
  return { x, y };
}

export function pressed(code) { return Input.enabled && Input.just.has(code); }
export function down(code) { return Input.enabled && !!Input.keys[code]; }
export function anyPressed(...codes) { return codes.some((c) => pressed(c)); }
export function endFrame() { Input.just.clear(); Input.mouseDX = 0; Input.mouseDY = 0; Input.wheel = 0; Input.lmbJust = false; }
