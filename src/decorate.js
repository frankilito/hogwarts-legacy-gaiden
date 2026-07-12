// decorate.js — 场景丰富化:每个区域的密集装饰(实例化+程序化)
import * as THREE from 'three';
import { zones, instBatch, put, TILE } from './castle.js';
import * as FXm from './fx.js';
import { T, A } from './assets.js';
import { Rig } from './rig.js';
import { woodMat, stoneMat, makePlant } from './zones.js';

const R = (() => { let s = 20260712; return () => (s = (s * 16807) % 2147483647) / 2147483647; })();

// ============ 程序化装饰件 ============
// 吊灯:铁环+蜡烛+锁链
function chandelier(z, x, y, zz, { r = 1.6, candles = 8, chainTo = 12 } = {}) {
  const g = new THREE.Group(); g.position.set(x, y, zz);
  const iron = new THREE.MeshStandardMaterial({ color: 0x2a2a30, roughness: 0.55, metalness: 0.75 });
  const ring = new THREE.Mesh(new THREE.TorusGeometry(r, 0.07, 8, 22), iron);
  ring.rotation.x = Math.PI / 2; g.add(ring);
  const chain = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, chainTo - y, 5), iron);
  chain.position.y = (chainTo - y) / 2; g.add(chain);
  const spokes = new THREE.Mesh(new THREE.CylinderGeometry(r, r, 0.02, 4, 1, true), iron);
  spokes.material = iron; // 简化
  const candleGeo = new THREE.CylinderGeometry(0.05, 0.06, 0.34, 6);
  const candleMat = new THREE.MeshStandardMaterial({ color: 0xe8dcc0, roughness: 0.8 });
  const flames = [];
  for (let i = 0; i < candles; i++) {
    const a = i / candles * Math.PI * 2;
    const c = new THREE.Mesh(candleGeo, candleMat);
    c.position.set(Math.cos(a) * r, 0.18, Math.sin(a) * r);
    g.add(c);
    flames.push({ x: x + Math.cos(a) * r, y: y + 0.42, z: zz + Math.sin(a) * r });
  }
  z.group.add(g);
  FXm.flamePoints(z, flames, { size: 0.34 });
  const L = new THREE.PointLight(0xffb45e, 22, 18, 2);
  L.position.set(x, y - 0.4, zz);
  z.group.add(L);
  z.onUpdate((dt) => { g.rotation.y += dt * 0.05; });
  return g;
}
// 灯柱
function lampPost(z, x, zz, { h = 2.6 } = {}) {
  const g = new THREE.Group(); g.position.set(x, 0, zz);
  const iron = new THREE.MeshStandardMaterial({ color: 0x26262c, roughness: 0.6, metalness: 0.7 });
  const post = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.09, h, 7), iron);
  post.position.y = h / 2; post.castShadow = true;
  const cage = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.4, 0.34), new THREE.MeshStandardMaterial({ color: 0x2a2a30, roughness: 0.5, metalness: 0.7, transparent: true, opacity: 0.9 }));
  cage.position.y = h + 0.16;
  const glow = new THREE.Mesh(new THREE.SphereGeometry(0.1, 8, 6), new THREE.MeshStandardMaterial({ color: 0xffd9a0, emissive: 0xffb45e, emissiveIntensity: 2.4 }));
  glow.position.y = h + 0.14;
  g.add(post, cage, glow);
  z.group.add(g);
  z.addCollider(x - 0.14, zz - 0.14, x + 0.14, zz + 0.14, h);
  FXm.flamePoints(z, [{ x, y: h + 0.16, z: zz }], { size: 0.4 });
  const L = new THREE.PointLight(0xffb45e, 12, 12, 2);
  L.position.set(x, h + 0.2, zz);
  z.group.add(L);
}
// 长椅
function bench(z, x, zz, ry = 0, len = 2.2) {
  const g = new THREE.Group(); g.position.set(x, 0, zz); g.rotation.y = ry;
  const seat = new THREE.Mesh(new THREE.BoxGeometry(len, 0.1, 0.5), woodMat());
  seat.position.y = 0.48; seat.castShadow = seat.receiveShadow = true;
  const legL = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.48, 0.5), woodMat());
  legL.position.set(-len / 2 + 0.2, 0.24, 0);
  const legR = legL.clone(); legR.position.x = len / 2 - 0.2;
  g.add(seat, legL, legR);
  z.group.add(g);
  const hx = Math.abs(Math.sin(ry)) > 0.6 ? 0.3 : len / 2, hz = Math.abs(Math.sin(ry)) > 0.6 ? len / 2 : 0.3;
  z.addCollider(x - hx, zz - hz, x + hx, zz + hz, 0.7);
}
// 梯子(靠书架)
function ladder(z, x, zz, ry = 0, h = 3.6) {
  const g = new THREE.Group(); g.position.set(x, 0, zz); g.rotation.y = ry; g.rotation.z = 0.16;
  const rail = new THREE.BoxGeometry(0.07, h, 0.07);
  const l = new THREE.Mesh(rail, woodMat()); l.position.set(-0.25, h / 2, 0);
  const r2 = new THREE.Mesh(rail, woodMat()); r2.position.set(0.25, h / 2, 0);
  g.add(l, r2);
  for (let i = 1; i < h / 0.4; i++) {
    const rung = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.5, 5), woodMat());
    rung.rotation.z = Math.PI / 2; rung.position.y = i * 0.4;
    g.add(rung);
  }
  g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  z.group.add(g);
}
// 书堆
const BOOK_COLS = [0x7a3a2e, 0x2e5a7a, 0x5a7a2e, 0x7a682e, 0x5a2e7a, 0x8a5a3a, 0x3a7a6a];
function bookStack(z, x, y, zz, n = 4) {
  const g = new THREE.Group(); g.position.set(x, y, zz);
  let h = 0;
  for (let i = 0; i < n; i++) {
    const b = new THREE.Mesh(new THREE.BoxGeometry(0.42 - i * 0.02, 0.09, 0.3), new THREE.MeshStandardMaterial({ color: BOOK_COLS[(R() * 7) | 0], roughness: 0.85 }));
    b.position.set((R() - 0.5) * 0.08, h + 0.045, (R() - 0.5) * 0.08);
    b.rotation.y = (R() - 0.5) * 0.7;
    b.castShadow = true;
    g.add(b); h += 0.09;
  }
  z.group.add(g);
  return g;
}
// 地球仪/星球仪
function globe(z, x, zz, { r = 0.32, star = false } = {}) {
  const g = new THREE.Group(); g.position.set(x, 0, zz);
  const stand = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.34, 0.1, 10), woodMat());
  stand.position.y = 0.05;
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.9, 6), woodMat());
  pole.position.y = 0.5;
  const ballMat = new THREE.MeshStandardMaterial({ color: star ? 0x1a2440 : 0x3a6a8a, roughness: 0.4, emissive: star ? 0x223a66 : 0x000000, emissiveIntensity: star ? 0.6 : 0 });
  const ball = new THREE.Mesh(new THREE.SphereGeometry(r, 14, 10), ballMat);
  ball.position.y = 0.95; ball.castShadow = true;
  const arc = new THREE.Mesh(new THREE.TorusGeometry(r + 0.05, 0.02, 6, 20, Math.PI * 1.2), new THREE.MeshStandardMaterial({ color: 0x9a7a3a, metalness: 0.8, roughness: 0.35 }));
  arc.position.y = 0.95; arc.rotation.z = Math.PI * 0.35;
  g.add(stand, pole, ball, arc);
  z.group.add(g);
  z.addCollider(x - 0.3, zz - 0.3, x + 0.3, zz + 0.3, 1.2);
  z.onUpdate((dt) => { ball.rotation.y += dt * 0.3; });
}
// 盔甲雕像(缓慢"呼吸"的守卫甲)
function armorStatue(z, x, zz, ry = 0) {
  if (!A.chars.Knight) return;
  try {
    const rig = new Rig('Knight', { tint: 0x8a94a2, skin: 0x8a94a2, hat: true, hand: 'sword', shadow: true });
    rig.play('idle');
    rig.mixer.timeScale = 0.06;
    rig.group.position.set(x, 0, zz);
    rig.group.rotation.y = ry;
    z.group.add(rig.group);
    z.addCollider(x - 0.4, zz - 0.4, x + 0.4, zz + 0.4, 2);
    // 底座
    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.65, 0.75, 0.18, 10), stoneMat());
    base.position.set(x, 0.09, zz);
    z.group.add(base);
    rig.group.position.y = 0.18;
  } catch { /* 模型未就绪则跳过 */ }
}
// 蛛网(墙角)
let _webTex = null;
function cobweb(z, x, y, zz, ry = 0, s = 1) {
  if (!_webTex) {
    const c = document.createElement('canvas'); c.width = 128; c.height = 128;
    const g = c.getContext('2d');
    g.strokeStyle = 'rgba(255,255,255,.55)'; g.lineWidth = 1.2;
    for (let i = 0; i <= 6; i++) { g.beginPath(); g.moveTo(0, 0); g.lineTo(Math.cos(i / 6 * Math.PI / 2) * 128, Math.sin(i / 6 * Math.PI / 2) * 128); g.stroke(); }
    for (let r2 = 18; r2 < 130; r2 += 20) { g.beginPath(); g.arc(0, 0, r2, 0, Math.PI / 2); g.stroke(); }
    _webTex = new THREE.CanvasTexture(c);
  }
  const m = new THREE.Mesh(new THREE.PlaneGeometry(1.4 * s, 1.4 * s), new THREE.MeshBasicMaterial({ map: _webTex, transparent: true, opacity: 0.5, side: THREE.DoubleSide, depthWrite: false }));
  m.position.set(x, y, zz); m.rotation.y = ry;
  z.group.add(m);
}
// 挂旗横幅间的藤蔓/花环
function vineWrap(z, x, zz, h = 3.4, r = 0.85) {
  const g = new THREE.Group(); g.position.set(x, 0, zz);
  const green = new THREE.MeshStandardMaterial({ color: 0x3a6b35, roughness: 0.9 });
  for (let i = 0; i < 5; i++) {
    const arc = new THREE.Mesh(new THREE.TorusGeometry(r, 0.05, 5, 12, Math.PI * (0.7 + R() * 0.5)), green);
    arc.position.y = 0.5 + i * (h / 5);
    arc.rotation.x = Math.PI / 2;
    arc.rotation.z = R() * 6.28;
    g.add(arc);
    if (R() < 0.7) {
      const leaf = new THREE.Mesh(new THREE.SphereGeometry(0.09, 6, 5), green);
      leaf.scale.set(1, 0.4, 1.4);
      const a = R() * 6.28;
      leaf.position.set(Math.cos(a) * r, 0.5 + i * (h / 5), Math.sin(a) * r);
      g.add(leaf);
    }
  }
  z.group.add(g);
}
// 悬挂盆栽
function hangingPot(z, x, y, zz) {
  const g = new THREE.Group(); g.position.set(x, y, zz);
  const rope = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.8, 5), new THREE.MeshStandardMaterial({ color: 0x6a5638, roughness: 1 }));
  rope.position.y = 0.4;
  const pot = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.14, 0.22, 8), new THREE.MeshStandardMaterial({ color: 0x8a5a3a, roughness: 0.9 }));
  const green = new THREE.MeshStandardMaterial({ color: 0x4a7a3a, roughness: 0.9 });
  for (let i = 0; i < 4; i++) {
    const strand = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.03, 0.5, 4), green);
    const a = i / 4 * Math.PI * 2;
    strand.position.set(Math.cos(a) * 0.16, -0.24, Math.sin(a) * 0.16);
    strand.rotation.z = Math.cos(a) * 0.8; strand.rotation.x = Math.sin(a) * 0.8;
    g.add(strand);
  }
  g.add(rope, pot);
  z.group.add(g);
  z.onUpdate(() => { g.rotation.z = Math.sin(FXm.FX.time * 0.8 + x) * 0.05; });
}
// 地毯长条
function rugRunner(z, x, zz, w, len, color, ry = 0) {
  const c = document.createElement('canvas'); c.width = 128; c.height = 256;
  const g = c.getContext('2d');
  const col = '#' + color.toString(16).padStart(6, '0');
  g.fillStyle = col; g.fillRect(0, 0, 128, 256);
  g.strokeStyle = 'rgba(240,217,168,.65)'; g.lineWidth = 5; g.strokeRect(8, 8, 112, 240);
  g.strokeStyle = 'rgba(0,0,0,.25)'; g.lineWidth = 2; g.strokeRect(16, 16, 96, 224);
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, len), new THREE.MeshStandardMaterial({ map: tex, roughness: 1 }));
  m.rotation.x = -Math.PI / 2; m.rotation.z = ry;
  m.position.set(x, 0.06, zz);
  m.receiveShadow = true;
  z.group.add(m);
}
// 蘑菇圈
function mushrooms(z, x, zz, n = 5, glow = false) {
  const g = new THREE.Group(); g.position.set(x, 0, zz);
  for (let i = 0; i < n; i++) {
    const s = 0.1 + R() * 0.16;
    const stem = new THREE.Mesh(new THREE.CylinderGeometry(s * 0.3, s * 0.4, s * 1.4, 6), new THREE.MeshStandardMaterial({ color: 0xd8ccb0, roughness: 0.9 }));
    const cap = new THREE.Mesh(new THREE.SphereGeometry(s, 8, 5, 0, Math.PI * 2, 0, Math.PI * 0.55), new THREE.MeshStandardMaterial({ color: glow ? 0x7ae0a8 : [0xa84a3a, 0xc9a52a, 0x8a5a3a][(R() * 3) | 0], roughness: 0.7, emissive: glow ? 0x3a8a5a : 0, emissiveIntensity: glow ? 0.9 : 0 }));
    const a = R() * 6.28, d = R() * 0.8;
    stem.position.set(Math.cos(a) * d, s * 0.7, Math.sin(a) * d);
    cap.position.set(Math.cos(a) * d, s * 1.3, Math.sin(a) * d);
    g.add(stem, cap);
  }
  z.group.add(g);
}
// 倒木
function fallenLog(z, x, zz, ry, len = 3.4) {
  const log = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.38, len, 8), new THREE.MeshStandardMaterial({ color: 0x35291d, roughness: 1 }));
  log.rotation.z = Math.PI / 2; log.rotation.y = ry;
  log.position.set(x, 0.32, zz);
  log.castShadow = log.receiveShadow = true;
  z.group.add(log);
  const hx = Math.abs(Math.cos(ry)) * len / 2 + 0.4, hz = Math.abs(Math.sin(ry)) * len / 2 + 0.4;
  z.addCollider(x - hx, zz - hz, x + hx, zz + hz, 0.7);
}
// 桌面杂物(纸卷/墨水瓶/羽毛笔)
function deskClutter(z, x, y, zz) {
  const g = new THREE.Group(); g.position.set(x, y, zz);
  if (R() < 0.8) {
    const scroll = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.4, 7), new THREE.MeshStandardMaterial({ color: 0xd8c49a, roughness: 0.9 }));
    scroll.rotation.z = Math.PI / 2; scroll.rotation.y = R() * 3;
    scroll.position.set((R() - 0.5) * 0.5, 0.05, (R() - 0.5) * 0.4);
    g.add(scroll);
  }
  if (R() < 0.6) {
    const ink = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.07, 0.1, 7), new THREE.MeshStandardMaterial({ color: 0x22262c, roughness: 0.4 }));
    ink.position.set((R() - 0.5) * 0.5, 0.05, (R() - 0.5) * 0.4);
    const quill = new THREE.Mesh(new THREE.ConeGeometry(0.02, 0.36, 5), new THREE.MeshStandardMaterial({ color: 0xe8e0d0, roughness: 0.8 }));
    quill.rotation.z = 0.7; quill.position.set(ink.position.x + 0.06, 0.2, ink.position.z);
    g.add(ink, quill);
  }
  z.group.add(g);
}

// ============ 分区域丰富化 ============
function decoHall() {
  const z = zones.get('hall'); if (!z) return;
  const pl = [];
  // 墙面火把列 + 细旗(窗间)
  const thin = ['banner_thin_red', 'banner_thin_green', 'banner_thin_blue', 'banner_thin_yellow'];
  for (let i = -4; i <= 4; i += 2) {
    pl.push({ n: 'torch_mounted', x: -19.3, y: 2.3, z: i * TILE, ry: Math.PI / 2 });
    pl.push({ n: 'torch_mounted', x: 19.3, y: 2.3, z: i * TILE, ry: -Math.PI / 2 });
    pl.push({ n: thin[(i + 4) / 2 % 4], x: -19.5, y: 4.6, z: i * TILE + 2, ry: Math.PI / 2 });
    pl.push({ n: thin[(i + 6) / 2 % 4], x: 19.5, y: 4.6, z: i * TILE + 2, ry: -Math.PI / 2 });
  }
  // 火把火苗
  const tf = [];
  for (let i = -4; i <= 4; i += 2) {
    tf.push({ x: -18.9, y: 3.05, z: i * TILE }, { x: 18.9, y: 3.05, z: i * TILE });
  }
  FXm.flamePoints(z, tf, { size: 0.5, color: 0xff9a50 });
  // 三联旗(北墙高处)
  pl.push({ n: 'banner_triple_red', x: -16, y: 7.4, z: -31.4 }, { n: 'banner_triple_green', x: -5.5, y: 7.4, z: -31.4 },
    { n: 'banner_triple_blue', x: 5.5, y: 7.4, z: -31.4 }, { n: 'banner_triple_yellow', x: 16, y: 7.4, z: -31.4 });
  // 边桌:食物补给台
  for (const [sx, sz2] of [[-17, 14], [-17, 22], [17, 14], [17, 22]]) {
    pl.push({ n: 'table_medium_tablecloth', x: sx, y: 0, z: sz2, ry: Math.PI / 2 });
    pl.push({ n: R() < 0.5 ? 'plate_food_A' : 'plate_food_B', x: sx, y: 1.05, z: sz2 - 0.5 });
    pl.push({ n: 'plate_stack', x: sx, y: 1.05, z: sz2 + 0.6 });
    pl.push({ n: 'keg_decorated', x: sx + (sx < 0 ? 1.6 : -1.6), y: 0, z: sz2 + 1.4 });
  }
  // 大门侧堆物 & 角落
  pl.push({ n: 'barrel_large_decorated', x: -17.5, y: 0, z: 29 }, { n: 'box_stacked', x: 17.5, y: 0, z: 29 },
    { n: 'crates_stacked', x: -15.6, y: 0, z: 30 }, { n: 'barrel_small_stack', x: 15.4, y: 0, z: 30.2 });
  // 桌面加密:每张长桌补蜡烛/餐盘/杯子
  const houseX = [-14, -7, 7, 14];
  for (const hx of houseX) {
    for (let k = 0; k < 6; k++) {
      const tz = -14 + k * 5.2;
      if (R() < 0.8) pl.push({ n: 'plate_small', x: hx + (R() - 0.5) * 1.2, y: 1.02, z: tz + (R() - 0.5) * 3, noCollide: true });
      if (R() < 0.6) pl.push({ n: 'plate', x: hx + (R() - 0.5) * 1.2, y: 1.02, z: tz + (R() - 0.5) * 3.4, noCollide: true });
      if (R() < 0.5) pl.push({ n: 'candle_lit', x: hx + (R() - 0.5), y: 1.02, z: tz + (R() - 0.5) * 3.4, noCollide: true });
      if (R() < 0.45) pl.push({ n: 'stool', x: hx + (R() < 0.5 ? -1.5 : 1.5), y: 0, z: tz + (R() - 0.5) * 4 });
    }
  }
  // 讲台侧盔甲 + 盾饰
  pl.push({ n: 'sword_shield', x: -19.4, y: 3.4, z: -26, ry: Math.PI / 2 }, { n: 'sword_shield', x: 19.4, y: 3.4, z: -26, ry: -Math.PI / 2 });
  instBatch(z, pl);
  armorStatue(z, -17.6, -25, Math.PI / 3);
  armorStatue(z, 17.6, -25, -Math.PI / 3);
  // 吊灯×3 + 中央地毯长廊
  chandelier(z, 0, 8.6, -14, { r: 2.0, candles: 10 });
  chandelier(z, 0, 8.6, 2, { r: 2.0, candles: 10 });
  chandelier(z, 0, 8.6, 18, { r: 2.0, candles: 10 });
  rugRunner(z, 0, 4, 3.4, 52, 0x6b2020);
  // 柱边盆栽
  for (const [px, pz2] of [[-19, 8], [19, 8], [-19, -16], [19, -16]]) makePlant(z, px, 0, pz2, { kind: 2, s: 1.5 });
}

function decoStair() {
  const z = zones.get('stair'); if (!z) return;
  const pl = [];
  // 门旁火把对
  for (const [dx, dz2, ry] of [[-3, -23, 0], [3, -23, 0], [-23, -3, Math.PI / 2], [-23, 3, Math.PI / 2], [23, -3, -Math.PI / 2], [23, 3, -Math.PI / 2], [-3, 23, Math.PI], [3, 23, Math.PI]]) {
    pl.push({ n: 'torch_mounted', x: dx * (Math.abs(dx) > 20 ? 0.994 : 1), y: 2.4, z: dz2 * (Math.abs(dz2) > 20 ? 0.994 : 1), ry });
  }
  FXm.flamePoints(z, [[-3, -22.6], [3, -22.6], [-22.6, -3], [-22.6, 3], [22.6, -3], [22.6, 3], [-3, 22.6], [3, 22.6]].map(([a, b]) => ({ x: a, y: 3.15, z: b })), { size: 0.48, color: 0xff9a50 });
  // 墙边长凳/书柜/杂物
  pl.push({ n: 'shelves', x: -21, y: 0, z: -12 }, { n: 'shelves', x: 21, y: 0, z: -12, ry: Math.PI },
    { n: 'shelf_large', x: -12, y: 1.5, z: -23.4 }, { n: 'shelf_large', x: 12, y: 1.5, z: -23.4 },
    { n: 'box_stacked', x: 21.4, y: 0, z: 21 }, { n: 'barrel_large', x: -21.2, y: 0, z: 21.4 },
    { n: 'trunk_large_A', x: 21.2, y: 0, z: -21, ry: -0.4 });
  // 学院四色旗(细)挂四角
  pl.push({ n: 'banner_thin_red', x: -12, y: 5.2, z: -23.5 }, { n: 'banner_thin_green', x: -4, y: 5.2, z: -23.5 },
    { n: 'banner_thin_blue', x: 4, y: 5.2, z: -23.5 }, { n: 'banner_thin_yellow', x: 12, y: 5.2, z: -23.5 });
  instBatch(z, pl);
  bench(z, -16, 22.6, 0); bench(z, 16, 22.6, 0);
  bench(z, -22.6, 10, Math.PI / 2); bench(z, 22.6, -10, Math.PI / 2);
  // 中央地毯 + 雕像 + 吊灯
  rugRunner(z, 0, 12, 4.2, 20, 0x24406b);
  armorStatue(z, -14, -20, Math.PI * 0.25);
  armorStatue(z, 14, -20, -Math.PI * 0.25);
  chandelier(z, 0, 9, 4, { r: 2.2, candles: 12, chainTo: 12 });
  // 高层画像补充
  FXm.portrait(z, -23.4, 6.4, -8, Math.PI / 2, 5);
  FXm.portrait(z, 23.4, 6.4, 2, -Math.PI / 2, 1);
  FXm.portrait(z, 8, 6.3, -23.4, 0, 3, { w: 1.3 });
  FXm.portrait(z, -8, 6.3, -23.4, 0, 6, { w: 1.3 });
  // 螺旋梯下蛛网与杂物
  cobweb(z, -11.4, 3.4, -11.2, Math.PI / 4);
  cobweb(z, 11.4, 3.6, -11.2, -Math.PI / 4);
  bookStack(z, -20.5, 0, 14.6, 5);
  makePlant(z, -21, 0, -6, { kind: 2, s: 1.6 });
  makePlant(z, 21, 0, 8, { kind: 2, s: 1.6 });
}

function decoLibrary() {
  const z = zones.get('library'); if (!z) return;
  const pl = [];
  // 阅读桌杂物 + 书堆
  for (const [tx, tz2] of [[-6, 18], [6, 18], [0, 22]]) {
    deskClutter(z, tx - 0.5, 1.02, tz2);
    bookStack(z, tx + 0.5, 1.02, tz2 + 0.3, 3);
  }
  // 巷道尽头书堆/木箱/蜡烛
  for (const zz2 of [-8, -3, 2, 7]) {
    if (R() < 0.8) bookStack(z, -4.6, 0, zz2 + 1.8, 4 + (R() * 3 | 0));
    if (R() < 0.8) bookStack(z, 4.6, 0, zz2 - 1.8, 4 + (R() * 3 | 0));
  }
  pl.push({ n: 'box_small_decorated', x: -19.5, y: 0, z: 18, ry: 0.4 }, { n: 'box_stacked', x: 19.8, y: 0, z: 20 },
    { n: 'trunk_medium_A', x: 20, y: 0, z: -14, ry: -0.6 },
    { n: 'shelf_small_candles', x: -10, y: 2.2, z: -21.4 }, { n: 'shelf_small_candles', x: 10, y: 2.2, z: -21.4 },
    { n: 'candle_triple', x: -4.6, y: 0, z: -0.5, noCollide: true }, { n: 'candle_triple', x: 4.6, y: 0, z: 4.5, noCollide: true });
  instBatch(z, pl);
  // 梯子×3 靠书架
  ladder(z, -9, -5.4, 0); ladder(z, 9, 0.6, Math.PI); ladder(z, -1.5, -13.2, 0);
  // 地球仪 + 讲台
  globe(z, -17, 20, {});
  globe(z, 17.5, 16.5, { star: true });
  // 禁书区加蛛网/幽光烛
  cobweb(z, -7.4, 3.2, -23, Math.PI / 5, 1.4);
  cobweb(z, 7.4, 3.4, -23, -Math.PI / 5, 1.2);
  // 悬浮蜡烛少量
  FXm.floatingCandles(z, 10, { x0: -12, x1: 12, z0: -14, z1: 12, y0: 5.4, y1: 6.8 });
  rugRunner(z, 0, 16, 3, 14, 0x274a33);
}

function decoPotions() {
  const z = zones.get('potions'); if (!z) return;
  const pl = [];
  // 全墙药瓶阵列(架子层)
  const bottles = ['bottle_A_green', 'bottle_A_brown', 'bottle_B_green', 'bottle_B_brown', 'bottle_C_green', 'bottle_C_brown', 'bottle_A_labeled_green', 'bottle_A_labeled_brown'];
  for (let i = -3; i <= 3; i++) {
    for (const y of [1.15, 2.15]) {
      if (R() < 0.85) pl.push({ n: bottles[(R() * bottles.length) | 0], x: i * 4 + (R() - 0.5), y, z: -15.6, noCollide: true });
    }
  }
  for (let j = -2; j <= 2; j++) {
    for (const y of [1.15, 2.15]) {
      if (R() < 0.7) pl.push({ n: bottles[(R() * bottles.length) | 0], x: -15.6, y, z: j * 4 + (R() - 0.5), noCollide: true });
      if (R() < 0.7) pl.push({ n: bottles[(R() * bottles.length) | 0], x: 15.6, y, z: j * 4 + (R() - 0.5), noCollide: true });
    }
  }
  // 学生桌上杂物
  for (let r2 = 0; r2 < 2; r2++) for (let c2 = 0; c2 < 3; c2++) {
    const x = -8 + c2 * 8, zz2 = -2 + r2 * 7;
    if (R() < 0.8) pl.push({ n: bottles[(R() * bottles.length) | 0], x: x - 0.9, y: 1.05, z: zz2 + 0.5, noCollide: true });
    deskClutter(z, x + 0.8, 1.05, zz2 + 0.4);
  }
  // 角落大锅/柴堆/箱子
  pl.push({ n: 'barrel_large_decorated', x: -13.6, y: 0, z: 12.6 }, { n: 'box_stacked', x: 13.6, y: 0, z: 12.8 },
    { n: 'crates_stacked', x: 13.4, y: 0, z: -13.4 }, { n: 'keg', x: -13.8, y: 0, z: -13 },
    { n: 'shelves', x: -9, y: 0, z: -15 }, { n: 'shelves', x: 9, y: 0, z: -15 });
  instBatch(z, pl);
  // 吊挂药草(梁下)
  for (let i = 0; i < 8; i++) hangingPot(z, -10 + i * 2.8, 3.4, -8 + (i % 2) * 3);
  // 蛛网
  cobweb(z, -14.6, 3.2, -14.6, Math.PI / 4);
  cobweb(z, 14.6, 3.4, -14.6, -Math.PI / 4, 1.3);
  bookStack(z, 2, 0.82, -11.5, 4); // 讲台上的参考书
}

function decoGreenhouse() {
  const z = zones.get('greenhouse'); if (!z) return;
  const pl = [];
  // 苗床再翻倍植物 + 沿墙花盆
  for (const bx of [-9, 0, 9]) {
    for (let k = 0; k < 9; k++) {
      if (R() < 0.85) makePlant(z, bx + (R() - 0.5) * 3.6, 0.7, -12 + k * 2.8, { kind: (R() * 3) | 0, s: 0.7 + R() * 0.7 });
    }
  }
  for (let i = 0; i < 10; i++) {
    makePlant(z, -14.6, 0, -17 + i * 3.4, { kind: (i % 3), s: 0.9 + R() * 0.5 });
    if (i % 2 === 0) makePlant(z, 14.6, 0, -15 + i * 3.4, { kind: ((i + 1) % 3), s: 0.9 + R() * 0.4 });
  }
  // 工具区:桶/箱/水壶架
  pl.push({ n: 'barrel_small_stack', x: -13.6, y: 0, z: -17.6 }, { n: 'box_small', x: -11.8, y: 0, z: -18 },
    { n: 'crates_stacked', x: 13.4, y: 0, z: -17.4 }, { n: 'barrel_large', x: 11.2, y: 0, z: -18 },
    { n: 'keg', x: -6, y: 0, z: 18 }, { n: 'box_small_decorated', x: 0, y: 0, z: 18.4, ry: 0.5 });
  instBatch(z, pl);
  // 吊盆一整排(沿中梁)
  for (let i = 0; i < 9; i++) hangingPot(z, -13 + i * 3.2, 4.1, (i % 2 ? -2 : 2));
  // 蝴蝶(白日粒子)
  FXm.motes(z, { x0: -12, x1: 12, y0: 0.8, y1: 2.6, z0: -14, z1: 14, n: 14, color: 0xf0e28a, size: 13, speed: 0.5 });
  // 蘑菇角落
  mushrooms(z, -13, 16, 6);
  mushrooms(z, 12.4, 8, 4);
}

function decoDorm() {
  const z = zones.get('dorm'); if (!z) return;
  const pl = [];
  // 公共休息室:满墙书柜/桌上热饮/毯子椅
  pl.push({ n: 'shelves', x: -4, y: 0, z: -15 }, { n: 'shelves', x: 0, y: 0, z: -15 },
    { n: 'shelf_large', x: -10, y: 1.4, z: -15.4 }, { n: 'shelf_small_candles', x: 3, y: 1.6, z: -15.4 },
    { n: 'table_small_decorated_A', x: -6, y: 0, z: 6, ry: 0.4 },
    { n: 'trunk_medium_A', x: -14.4, y: 0, z: -4, ry: 0.5 }, { n: 'trunk_small_A', x: 14.4, y: 0, z: 12, ry: -0.4 },
    { n: 'barrel_small', x: 14.6, y: 0, z: -8 },
    { n: 'plate_food_B', x: 0, y: 1.0, z: 2, noCollide: true },
    { n: 'candle_lit', x: -6, y: 1.0, z: 6, noCollide: true });
  // 寝室固定装饰(不占玩家格)
  pl.push({ n: 'shelf_small', x: 26, y: 1.4, z: -11.4 }, { n: 'trunk_small_A', x: 33, y: 0, z: 6, ry: 0.8 });
  instBatch(z, pl);
  rugRunner(z, 0, 10, 2.6, 9, 0x3a2a55);
  bookStack(z, 0.6, 1.0, 1.6, 3);
  bookStack(z, -10, 0, -13.6, 6);
  makePlant(z, 14.4, 0, 2, { kind: 1, s: 1.3 });
  makePlant(z, -14.4, 0, 12, { kind: 2, s: 1.4 });
  cobweb(z, -15, 3.3, -15, Math.PI / 4, 0.9);
  // 炉边慵懒猫(程序化:一坨会呼吸的猫)
  const cat = new THREE.Group();
  const fur = new THREE.MeshStandardMaterial({ color: 0x3a3430, roughness: 0.95 });
  const body = new THREE.Mesh(new THREE.SphereGeometry(0.32, 10, 8), fur); body.scale.set(1.3, 0.72, 0.9);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.17, 8, 7), fur); head.position.set(0.34, 0.14, 0.06);
  const earL = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.09, 4), fur); earL.position.set(0.4, 0.3, 0.0);
  const earR = earL.clone(); earR.position.z = 0.12;
  const tail = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.05, 0.6, 6), fur);
  tail.rotation.z = 1.1; tail.position.set(-0.42, 0.12, -0.05);
  cat.add(body, head, earL, earR, tail);
  cat.position.set(-12.6, 0.26, 4.2);
  cat.rotation.y = 0.8;
  z.group.add(cat);
  z.onUpdate(() => { cat.scale.y = 1 + Math.sin(FXm.FX.time * 1.8) * 0.04; });
}

function decoAstro() {
  const z = zones.get('astro'); if (!z) return;
  const pl = [];
  pl.push({ n: 'trunk_medium_A', x: 8, y: 0, z: 6, ry: 0.7 }, { n: 'box_small_decorated', x: -8.5, y: 0, z: -4, ry: -0.5 },
    { n: 'barrel_small', x: -7, y: 0, z: 6.5 }, { n: 'shelf_small', x: 9.6, y: 0, z: -3 });
  instBatch(z, pl);
  globe(z, -4.5, -6.5, { star: true });
  globe(z, 7.5, 1.5, { star: true });
  bookStack(z, 5.4, 1.05, -1.6, 4);
  deskClutter(z, 4.6, 1.05, -2.4);
  // 环形烛群
  const ring = [];
  for (let i = 0; i < 10; i++) {
    const a = i / 10 * Math.PI * 2;
    ring.push({ x: Math.cos(a) * 10.6, z: Math.sin(a) * 10.6 });
  }
  FXm.candles(z, ring, { model: 'candle_lit', lightEvery: 3, intensity: 6, dist: 8 });
  // 星图挂板
  const c = document.createElement('canvas'); c.width = 256; c.height = 192;
  const g2 = c.getContext('2d');
  g2.fillStyle = '#0c1226'; g2.fillRect(0, 0, 256, 192);
  g2.strokeStyle = 'rgba(240,217,168,.8)'; g2.lineWidth = 1.5;
  let lx = 30, ly = 150;
  g2.beginPath(); g2.moveTo(lx, ly);
  for (let i = 0; i < 7; i++) { const nx = 30 + i * 33, ny = 150 - Math.abs(Math.sin(i * 1.7)) * 110; g2.lineTo(nx, ny); g2.fillStyle = '#fff'; g2.fillRect(nx - 2, ny - 2, 4, 4); }
  g2.stroke();
  g2.fillStyle = '#8a94b8'; g2.font = '16px serif'; g2.fillText('✦ 钥匙星座 · 观测记录', 16, 26);
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
  const board = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 1.6), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.9 }));
  const stand = new THREE.Group();
  const legs = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.05, 2.0, 6), woodMat());
  legs.position.y = 1.0;
  board.position.y = 1.9;
  stand.add(legs, board);
  stand.position.set(-8, 0, 1.5);
  stand.rotation.y = Math.PI / 3;
  z.group.add(stand);
  z.addCollider(-8.4, 1.1, -7.6, 1.9, 2);
}

function decoCourtyard() {
  const z = zones.get('courtyard'); if (!z) return;
  const pl = [];
  // 柱间旗帜 + 藤蔓
  const shields = ['banner_shield_red', 'banner_shield_green', 'banner_shield_blue', 'banner_shield_yellow'];
  let si = 0;
  for (const [px, pz2] of [[-8, -14], [0, -14], [8, -14], [-8, 14], [0, 14], [8, 14]]) {
    pl.push({ n: shields[si++ % 4], x: px, y: 2.4, z: pz2 + (pz2 < 0 ? 0.55 : -0.55), ry: pz2 < 0 ? 0 : Math.PI });
  }
  for (const [px, pz2] of [[-14, -8], [-14, 8], [14, -8], [14, 8]]) vineWrap(z, px, pz2, 3.6, 0.95);
  // 长椅环绕 + 灯柱四角
  instBatch(z, pl);
  bench(z, -6, -12.6, 0); bench(z, 6, -12.6, 0);
  bench(z, -12.6, -4, Math.PI / 2); bench(z, -12.6, 4, Math.PI / 2);
  bench(z, 12.6, 0, Math.PI / 2);
  lampPost(z, -12, -12); lampPost(z, 12, 12); lampPost(z, -12, 12); lampPost(z, 12, -12);
  // 花圃(墙根)
  for (let i = 0; i < 12; i++) {
    makePlant(z, -25 + i * 4.4, 0, -24.6, { kind: i % 3, s: 0.9 + R() * 0.5 });
    if (i % 2) makePlant(z, -25 + i * 4.4, 0, 24.6, { kind: (i + 1) % 3, s: 0.9 + R() * 0.4 });
  }
  mushrooms(z, -10, 9, 4);
  // 决斗场旁武器架
  const rack = new THREE.Group();
  const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 2.4, 6), woodMat());
  bar.rotation.z = Math.PI / 2; bar.position.y = 1.5;
  const pA = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.07, 1.5, 6), woodMat()); pA.position.set(-1.1, 0.75, 0);
  const pB = pA.clone(); pB.position.x = 1.1;
  rack.add(bar, pA, pB);
  rack.position.set(7.5, 0, 24.5);
  z.group.add(rack);
  z.addCollider(6.3, 24.2, 8.7, 24.8, 1.6);
  put(z, 'sword_shield', 6.9, 1.15, 24.5, 0, 1, { noCollide: true });
  put(z, 'sword_shield_gold', 8.1, 1.15, 24.5, 0, 1, { noCollide: true });
}

function decoDungeon() {
  const z = zones.get('dungeon'); if (!z) return;
  const pl = [];
  // 走廊随机杂物(骸骨氛围)
  const junk = ['rubble_half', 'barrel_small', 'box_small', 'keg', 'trunk_small_A', 'coin_stack_small', 'candle_melted', 'bottle_B_brown'];
  let placed = 0;
  for (let tries = 0; tries < 220 && placed < 46; tries++) {
    const x = (R() - 0.5) * 80, zz2 = (R() - 0.5) * 96;
    // 用碰撞列表粗测是否在墙里:距任意墙碰撞盒中心太近则跳过
    let inWall = false;
    for (const c of z.colliders) {
      const cx2 = (c.min.x + c.max.x) / 2 - z.offset.x, cz2 = (c.min.z + c.max.z) / 2 - z.offset.z;
      if (Math.abs(x - cx2) < 2.2 && Math.abs(zz2 - cz2) < 2.2) { inWall = true; break; }
    }
    if (inWall) continue;
    const n = junk[(R() * junk.length) | 0];
    pl.push({ n, x, y: 0, z: zz2, ry: R() * 6.28, noCollide: n === 'coin_stack_small' || n === 'candle_melted' || n === 'bottle_B_brown' });
    placed++;
  }
  // 破损旗帜(褪色白)
  for (let i = 0; i < 8; i++) {
    pl.push({ n: 'banner_thin_white', x: (R() - 0.5) * 70, y: 2.6, z: (R() - 0.5) * 88, ry: R() * 6.28, noCollide: true });
  }
  instBatch(z, pl);
  // 蛛网大量
  for (let i = 0; i < 14; i++) {
    cobweb(z, (R() - 0.5) * 76, 2.6 + R() * 1.1, (R() - 0.5) * 90, R() * 6.28, 0.8 + R() * 0.9);
  }
  // 蘑菇发光簇
  for (let i = 0; i < 8; i++) mushrooms(z, (R() - 0.5) * 70, (R() - 0.5) * 85, 3 + (R() * 4 | 0), true);
}

function decoForest() {
  const z = zones.get('forest'); if (!z) return;
  // 蘑菇圈/倒木/石堆/树桩
  for (let i = 0; i < 14; i++) mushrooms(z, (R() - 0.5) * 52, (R() - 0.5) * 52, 4 + (R() * 4 | 0), R() < 0.5);
  fallenLog(z, 8, 8, 0.6); fallenLog(z, -20, 14, -0.9); fallenLog(z, 22, -14, 1.8);
  const pl = [];
  for (let i = 0; i < 12; i++) {
    pl.push({ n: R() < 0.6 ? 'rubble_half' : 'rubble_large', x: (R() - 0.5) * 56, y: 0, z: (R() - 0.5) * 56, ry: R() * 6.28 });
  }
  // 树桩(圆柱)
  instBatch(z, pl);
  const stumpGeo = new THREE.CylinderGeometry(0.45, 0.55, 0.5, 9);
  const stumpMat = new THREE.MeshStandardMaterial({ color: 0x3a2c1e, roughness: 1 });
  for (let i = 0; i < 8; i++) {
    const st = new THREE.Mesh(stumpGeo, stumpMat);
    const x = (R() - 0.5) * 54, zz2 = (R() - 0.5) * 54;
    st.position.set(x, 0.25, zz2);
    st.castShadow = true;
    z.group.add(st);
    z.addCollider(x - 0.5, zz2 - 0.5, x + 0.5, zz2 + 0.5, 0.7);
  }
  // 石阵烛火(仪式感)
  FXm.candles(z, [{ x: -16, z: -11.4 }, { x: -18.5, z: -13 }, { x: -13.6, z: -13.2 }], { model: 'candle_lit', lightEvery: 2, intensity: 6, dist: 7 });
}

export function decorateAll() {
  decoHall(); decoStair(); decoLibrary(); decoPotions(); decoGreenhouse();
  decoDorm(); decoAstro(); decoCourtyard(); decoDungeon(); decoForest();
}
