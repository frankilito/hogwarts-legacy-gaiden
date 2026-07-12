// zones.js — 区域建造 I:共享工具 / 大厅 / 旋转楼梯厅 / 庭院
import * as THREE from 'three';
import { Zone, put, putSolid, room, instBatch, TILE } from './castle.js';
import * as FXm from './fx.js';
import { T, A } from './assets.js';
import { S, flag } from './state.js';
import { HOUSES } from './data.js';

export const Z = {}; // id -> Zone

// ---------- 共享程序化道具 ----------
export function woodMat() { return _wood ??= new THREE.MeshStandardMaterial({ map: T.wood(), roughness: 0.85 }); }
let _wood = null;
export function stoneMat() { return _stone ??= new THREE.MeshStandardMaterial({ map: T.stone(), roughness: 0.95 }); }
let _stone = null;

export function makeCauldron(zone, x, y, z, { s = 1, liquid = 0x3fae6a, bubbling = true } = {}) {
  const g = new THREE.Group(); g.position.set(x, y, z); g.scale.setScalar(s);
  const metal = new THREE.MeshStandardMaterial({ color: 0x1c1c22, roughness: 0.55, metalness: 0.7 });
  const body = new THREE.Mesh(new THREE.SphereGeometry(0.55, 14, 10, 0, Math.PI * 2, Math.PI * 0.25, Math.PI * 0.62), metal);
  body.scale.y = 0.9; body.position.y = 0.42; body.castShadow = true;
  const rim = new THREE.Mesh(new THREE.TorusGeometry(0.42, 0.06, 8, 16), metal);
  rim.rotation.x = Math.PI / 2; rim.position.y = 0.72;
  const legs = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.56, 0.12, 12), metal);
  legs.position.y = 0.06;
  const liqMat = new THREE.MeshStandardMaterial({ color: liquid, emissive: liquid, emissiveIntensity: 0.9, roughness: 0.3 });
  const liq = new THREE.Mesh(new THREE.CircleGeometry(0.38, 14), liqMat);
  liq.rotation.x = -Math.PI / 2; liq.position.y = 0.66;
  g.add(body, rim, legs, liq);
  zone.group.add(g);
  if (bubbling) {
    FXm.motes(zone, { x0: x - 0.3, x1: x + 0.3, y0: y + 0.7, y1: y + 1.6, z0: z - 0.3, z1: z + 0.3, n: 6, color: liquid, size: 14, speed: 0.5 });
    zone.onUpdate(() => { liq.position.y = 0.66 + Math.sin(FXm.FX.time * 3 + x) * 0.015; liqMat.emissiveIntensity = 0.7 + Math.sin(FXm.FX.time * 5 + z) * 0.25; });
  }
  return g;
}

export function makePlant(zone, x, y, z, { s = 1, kind = 0 } = {}) {
  const g = new THREE.Group(); g.position.set(x, y, z); g.scale.setScalar(s);
  const pot = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.18, 0.28, 10), new THREE.MeshStandardMaterial({ color: 0x8a5a3a, roughness: 0.9 }));
  pot.position.y = 0.14; pot.castShadow = true;
  g.add(pot);
  const green = new THREE.MeshStandardMaterial({ color: kind === 2 ? 0x4a7a3a : 0x3a6b35, roughness: 0.9 });
  if (kind === 0) { // 灌木
    for (let i = 0; i < 4; i++) {
      const leaf = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.5, 6), green);
      leaf.position.set((Math.random() - 0.5) * 0.2, 0.45 + Math.random() * 0.15, (Math.random() - 0.5) * 0.2);
      leaf.rotation.z = (Math.random() - 0.5) * 0.6;
      g.add(leaf);
    }
  } else if (kind === 1) { // 垂蔓
    for (let i = 0; i < 5; i++) {
      const vine = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.04, 0.6, 5), green);
      const a = i / 5 * Math.PI * 2;
      vine.position.set(Math.cos(a) * 0.2, 0.2, Math.sin(a) * 0.2);
      vine.rotation.z = Math.cos(a) * 0.7; vine.rotation.x = Math.sin(a) * 0.7;
      g.add(vine);
    }
  } else { // 大叶
    for (let i = 0; i < 5; i++) {
      const a = i / 5 * Math.PI * 2;
      const leaf = new THREE.Mesh(new THREE.SphereGeometry(0.22, 8, 6), green);
      leaf.scale.set(1, 0.35, 0.5);
      leaf.position.set(Math.cos(a) * 0.22, 0.42, Math.sin(a) * 0.22);
      leaf.rotation.y = -a;
      leaf.rotation.z = 0.5;
      g.add(leaf);
    }
  }
  zone.group.add(g);
  return g;
}

// 学院旗帜组
export function houseBanners(zone, y, positions) {
  const keys = ['gryffindor', 'slytherin', 'ravenclaw', 'hufflepuff'];
  const pl = [];
  positions.forEach((p, i) => pl.push({ n: HOUSES[keys[i % 4]].banner, x: p.x, y, z: p.z, ry: p.ry || 0 }));
  instBatch(zone, pl);
}

// ---------- 大厅 ----------
export function buildHall() {
  const z = new Zone('hall', '城堡大厅', { ox: 0, oz: 0, fog: { color: 0x0d0a12, density: 0.016 }, ambient: 0x40364a, ambientI: 0.85, bgm: 'academy' });
  Z.hall = z;
  z.spawn.set(0, 0, 24);

  room(z, {
    w: 5, d: 8, wallH: 3,
    doors: [{ side: 2, i: -1 }, { side: 2, i: 0 }],
    floor: 'floor_tile_large',
    wallPattern: (side, i, L) => {
      if (L === 0) return (side === 0 || side === 2) ? 'wall_arched' : (i % 2 === 0 ? 'wall_arched' : 'wall');
      if (L === 1) return (side === 1 || side === 3) && i % 2 === 0 ? 'wall_archedwindow_open' : 'wall';
      return 'wall';
    },
  });
  // 高层彩窗(在 archedwindow 洞口内侧)
  for (let i = -5; i < 5; i += 2) {
    FXm.stainedWindow(z, -19.4, 5.6, i * TILE + TILE / 2, Math.PI / 2, { seed: i + 6 });
    FXm.stainedWindow(z, 19.4, 5.6, i * TILE + TILE / 2, -Math.PI / 2, { seed: i + 9 });
    if (FXm.FX.quality !== 'low') {
      FXm.lightShaft(z, -16, 3.4, i * TILE + 2, { h: 8, r: 2.2, tilt: -0.5, opacity: 0.1 });
      FXm.lightShaft(z, 16, 3.4, i * TILE + 2, { h: 8, r: 2.2, tilt: 0.5, opacity: 0.1 });
    }
  }
  // 魔法天花板
  FXm.enchantedCeiling(z, 0, 11.8, 0, 41, 65);
  // 悬浮蜡烛
  FXm.floatingCandles(z, 70, { x0: -16, x1: 16, z0: -26, z1: 26, y0: 6.2, y1: 9.5 });
  // 大厅主暖光(烛海光晕)
  for (const lz of [-22, -8, 8, 22]) {
    const L = new THREE.PointLight(0xffb45e, 55, 34, 1.9);
    L.position.set(0, 7.5, lz);
    z.group.add(L);
  }
  const warmFill = new THREE.DirectionalLight(0xffd9a0, 0.5);
  warmFill.position.set(6, 14, 8); z.group.add(warmFill);
  // 尘埃
  FXm.motes(z, { x0: -18, x1: 18, y0: 1, y1: 8, z0: -30, z1: 30, n: 50 });

  // 四条学院长桌
  const pl = [];
  const houseX = [-14, -7, 7, 14];
  for (const hx of houseX) {
    for (let k = 0; k < 6; k++) {
      pl.push({ n: k % 2 ? 'table_long_tablecloth' : 'table_long_tablecloth_decorated_A', x: hx, y: 0, z: -14 + k * 5.2 });
      pl.push({ n: 'stool', x: hx - 1.5, y: 0, z: -14 + k * 5.2 + (k % 2 ? 1 : -1) });
      pl.push({ n: 'stool', x: hx + 1.5, y: 0, z: -14 + k * 5.2 - 1 });
      if (k % 2 === 0) { pl.push({ n: 'plate_food_A', x: hx + 0.4, y: 1.02, z: -14 + k * 5.2 + 1 }); pl.push({ n: 'candle_lit', x: hx - 0.3, y: 1.02, z: -14 + k * 5.2 }); }
      else { pl.push({ n: 'plate_food_B', x: hx - 0.4, y: 1.02, z: -14 + k * 5.2 }); pl.push({ n: 'plate_stack', x: hx + 0.5, y: 1.02, z: -14 + k * 5.2 + 1.4 }); }
    }
    z.addCollider(hx - 1.1, -16.5, hx + 1.1, 15);
  }
  instBatch(z, pl);
  // 学院旗帜
  houseBanners(z, 8.2, [
    { x: -14, z: -31.4 }, { x: -7, z: -31.4 }, { x: 7, z: -31.4 }, { x: 14, z: -31.4 },
  ]);
  houseBanners(z, 8.2, [
    { x: -19.4, z: -12, ry: Math.PI / 2 }, { x: -19.4, z: 0, ry: Math.PI / 2 }, { x: 19.4, z: -12, ry: -Math.PI / 2 }, { x: 19.4, z: 0, ry: -Math.PI / 2 },
  ]);

  // 主席台(高台+教师桌)
  const daisMat = woodMat();
  const dais = new THREE.Mesh(new THREE.BoxGeometry(24, 0.8, 8), daisMat);
  dais.position.set(0, 0.4, -26); dais.receiveShadow = true; dais.castShadow = true;
  z.group.add(dais);
  z.addRamp(0, -21.6, 0, -22.6, 0, 0.8); // 正面台阶坡
  const stepRamp = new THREE.Mesh(new THREE.BoxGeometry(6, 0.8, 1.2), daisMat);
  stepRamp.position.set(0, 0.28, -22); stepRamp.rotation.x = 0.5; z.group.add(stepRamp);
  z.addCollider(-12, -30, -3.2, -22, 2); z.addCollider(3.2, -30, 12, -22, 2); // 台侧挡(中间留上台口)
  z.addRamp(0, -22.6, 0, -30, 0.8, 0.8);
  instBatch(z, [
    { n: 'table_long_tablecloth_decorated_A', x: -5, y: 0.8, z: -27, ry: Math.PI / 2 },
    { n: 'table_long_tablecloth_decorated_A', x: 0, y: 0.8, z: -27, ry: Math.PI / 2 },
    { n: 'table_long_tablecloth', x: 5, y: 0.8, z: -27, ry: Math.PI / 2 },
    { n: 'chair', x: -6, y: 0.8, z: -28.4 }, { n: 'chair', x: -3, y: 0.8, z: -28.4 }, { n: 'chair', x: 0, y: 0.8, z: -28.4 },
    { n: 'chair', x: 3, y: 0.8, z: -28.4 }, { n: 'chair', x: 6, y: 0.8, z: -28.4 },
    { n: 'candle_triple', x: -4, y: 1.82, z: -27 }, { n: 'candle_triple', x: 4, y: 1.82, z: -27 },
    { n: 'sword_shield_gold', x: 0, y: 3, z: -31.4 },
  ]);
  // 讲台烛光
  FXm.candles(z, [{ x: -4, y: 1.0, z: -27 }, { x: 4, y: 1.0, z: -27 }], { model: null, lightEvery: 1, intensity: 10 });

  // 两侧壁炉
  buildFireNook(z, -19.4, -6, Math.PI / 2);
  buildFireNook(z, 19.4, 6, -Math.PI / 2);

  // 画像
  FXm.portrait(z, -19.4, 3.1, 20, Math.PI / 2, 0);
  FXm.portrait(z, 19.4, 3.1, -20, -Math.PI / 2, 4);
  FXm.portrait(z, -8, 3.4, -31.4, 0, 5, { w: 1.6 });
  FXm.portrait(z, 8, 3.4, -31.4, 0, 1, { w: 1.6 });

  // 门:南→楼梯厅
  z.addDoor(0, 31, 'stair', '前往 大理石楼梯厅');
  return z;
}

function buildFireNook(z, x, zz, ry) {
  const g = new THREE.Group(); g.position.set(x, 0, zz); g.rotation.y = ry;
  const dark = new THREE.MeshStandardMaterial({ color: 0x2c2830, roughness: 0.9 });
  const back = new THREE.Mesh(new THREE.BoxGeometry(3.2, 3, 0.4), stoneMat()); back.position.set(0, 1.5, -0.1);
  const lside = new THREE.Mesh(new THREE.BoxGeometry(0.5, 3, 1), stoneMat()); lside.position.set(-1.6, 1.5, 0.4);
  const rside = lside.clone(); rside.position.x = 1.6;
  const top = new THREE.Mesh(new THREE.BoxGeometry(3.7, 0.5, 1.2), stoneMat()); top.position.set(0, 3.1, 0.4);
  const hearth = new THREE.Mesh(new THREE.BoxGeometry(3.2, 0.5, 1), dark); hearth.position.set(0, 0.25, 0.4);
  g.add(back, lside, rside, top, hearth);
  g.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  z.group.add(g);
  const fx = x + (ry > 0 ? 0.9 : -0.9);
  FXm.fireplace(z, fx, 0.5, zz);
  z.addCollider(x - (ry ? 1 : 1.8), zz - 1.8, x + (ry ? 1 : 1.8), zz + 1.8, 3);
}

// ---------- 大理石楼梯厅(中枢) ----------
export function buildStair() {
  const z = new Zone('stair', '大理石楼梯厅', { ox: 300, oz: 0, fog: { color: 0x0b0912, density: 0.02 }, ambient: 0x3a3448, ambientI: 0.8, bgm: 'academy' });
  Z.stair = z;
  z.spawn.set(0, 0, 18);

  room(z, {
    w: 6, d: 6, wallH: 3,
    doors: [
      { side: 0, i: -1 }, { side: 0, i: 0 },   // 北→大厅
      { side: 1, i: -1 }, { side: 1, i: 0 },   // 东→图书馆
      { side: 3, i: -1 }, { side: 3, i: 0 },   // 西→庭院
      { side: 2, i: -1 }, { side: 2, i: 0 },   // 南→宿舍
      { side: 1, i: 4 },                        // 东南→魔药教室
    ],
    wallPattern: (side, i, L) => {
      if (L === 1) return i % 2 !== 0 ? 'wall_archedwindow_open' : 'wall_pillar';
      if (L === 2) return 'wall';
      return i % 3 === 0 ? 'wall_pillar' : 'wall';
    },
  });
  // 顶
  const ceil = new THREE.Mesh(new THREE.PlaneGeometry(49, 49), new THREE.MeshStandardMaterial({ map: T.stone(1), roughness: 1 }));
  ceil.rotation.x = Math.PI / 2; ceil.position.y = 12;
  z.group.add(ceil);

  // 中央双旋转楼梯 → 顶部平台(去天文塔)
  FXm.spiralStair(z, -8, -8, { r: 3.6, h: 8, steps: 30, turns: 1.2, dir: 1 });
  FXm.spiralStair(z, 8, -8, { r: 3.6, h: 8, steps: 30, turns: 1.2, dir: -1 });
  // 主厅吊灯光
  for (const [lx, lz] of [[-10, -8], [10, -8], [0, 8], [0, -18]]) {
    const L = new THREE.PointLight(0xffc178, 42, 30, 1.9);
    L.position.set(lx, 8.5, lz);
    z.group.add(L);
  }
  // 高窗彩玻璃
  FXm.stainedWindow(z, -10, 6.2, -23.4, 0, { seed: 3, w: 2.2, h: 3.6 });
  FXm.stainedWindow(z, 10, 6.2, -23.4, 0, { seed: 5, w: 2.2, h: 3.6 });
  FXm.stainedWindow(z, 23.4, 6.2, -10, -Math.PI / 2, { seed: 7, w: 2.2, h: 3.6 });
  // 顶部连桥平台
  const bridge = new THREE.Mesh(new THREE.BoxGeometry(20, 0.4, 4), stoneMat());
  bridge.position.set(0, 8, -8); bridge.castShadow = true; bridge.receiveShadow = true;
  z.group.add(bridge);
  z.addRamp(-10, -8, 10, -8, 8, 8);
  // 平台围栏
  instBatch(z, [
    { n: 'barrier', x: -8, y: 8.2, z: -10 }, { n: 'barrier', x: -4, y: 8.2, z: -10 }, { n: 'barrier', x: 0, y: 8.2, z: -10 }, { n: 'barrier', x: 4, y: 8.2, z: -10 }, { n: 'barrier', x: 8, y: 8.2, z: -10 },
    { n: 'barrier', x: -8, y: 8.2, z: -6, ry: Math.PI }, { n: 'barrier', x: -4, y: 8.2, z: -6, ry: Math.PI }, { n: 'barrier', x: 4, y: 8.2, z: -6, ry: Math.PI }, { n: 'barrier', x: 8, y: 8.2, z: -6, ry: Math.PI },
  ]);
  z.addCollider(-10, -10.4, 10, -9.6, 10); z.addCollider(-10, -6.4, -2, -5.6, 10); z.addCollider(2, -6.4, 10, -5.6, 10);

  // 画像墙(走廊画像 — 会动)
  FXm.portrait(z, -23.4, 3, -16, Math.PI / 2, 1);
  FXm.portrait(z, -23.4, 3, 6, Math.PI / 2, 2);
  FXm.portrait(z, 23.4, 3.2, -16, -Math.PI / 2, 3);
  FXm.portrait(z, 23.4, 2.8, 10, -Math.PI / 2, 6);
  FXm.portrait(z, -14, 3.1, -23.4, 0, 7, { w: 1.5 });
  FXm.portrait(z, 14, 3.1, -23.4, 0, 0, { w: 1.5 });
  FXm.portrait(z, 0, 6.2, -23.4, 0, 4, { w: 2.2 }); // 大幅

  // 火把与烛台
  FXm.candles(z, [
    { x: -12, z: -20, tall: true }, { x: 12, z: -20, tall: true },
    { x: -20, z: 0, tall: true }, { x: 20, z: 0, tall: true },
    { x: -12, z: 16, tall: true }, { x: 12, z: 16, tall: true },
  ], { model: 'candle_thin_lit', lightEvery: 2, intensity: 12, dist: 12 });
  FXm.motes(z, { x0: -20, x1: 20, y0: 1, y1: 10, z0: -20, z1: 20, n: 40 });

  // 提基的小摊
  instBatch(z, [
    { n: 'table_medium_tablecloth', x: -17, y: 0, z: 14, ry: Math.PI / 4 },
    { n: 'crates_stacked', x: -19.5, y: 0, z: 16.5 },
    { n: 'keg_decorated', x: -14.5, y: 0, z: 16.8 },
    { n: 'bottle_A_labeled_green', x: -17.3, y: 1.05, z: 13.6 },
    { n: 'plate_food_A', x: -16.4, y: 1.05, z: 14.6 },
    { n: 'coin_stack_small', x: -17.8, y: 1.05, z: 14.8 },
    { n: 'banner_thin_yellow' in A.dungeon ? 'banner_thin_yellow' : 'banner_yellow', x: -19, y: 2.4, z: 12, ry: Math.PI / 4 },
  ]);
  z.addCollider(-18.4, 12.6, -15.6, 15.4);

  // 门
  z.addDoor(0, -23, 'hall', '前往 城堡大厅');
  z.addDoor(23, 0, 'library', '前往 图书馆', '📚');
  z.addDoor(-23, 0, 'courtyard', '前往 回廊庭院', '⛲');
  z.addDoor(0, 23, 'dorm', '回到 学院宿舍', '🛏');
  z.addDoor(23, 18, 'potions', '下行 魔药教室', '⚗');
  z.addInteract({ x: 0, z: -8, r: 2.5, y: 8, label: '登上 天文塔', icon: '🔭', isDoor: true, to: 'astro', needY: 7 });
  // 密道(主线解锁)
  z.addInteract({
    x: -23, z: 18, r: 2.4, label: '裂缝后的密道', icon: '🕳', isDoor: true, to: 'dungeon',
    cond: () => flag('dungeonOpen') ? true : '石墙上有一道细细的裂缝……似乎藏着什么。(继续主线以解锁)',
  });
  put(z, 'wall_cracked', -23.5, 0, 18, Math.PI / 2);
  return z;
}

// ---------- 回廊庭院 ----------
export function buildCourtyard() {
  const z = new Zone('courtyard', '回廊庭院', { ox: 600, oz: 300, fog: { color: 0x10141f, density: 0.014 }, outdoor: true, ambient: 0x4a5468, ambientI: 0.9, bgm: 'outdoor' });
  Z.courtyard = z;
  z.spawn.set(18, 0, 0);

  // 地面:石板 + 中央草地
  room(z, {
    w: 7, d: 7, wallH: 2,
    doors: [{ side: 1, i: -1 }, { side: 1, i: 0 }, { side: 3, i: -1 }, { side: 3, i: 0 }, { side: 0, i: 0 }],
    floorPick: (i, j) => {
      if (Math.abs(i + 0.5) < 3.4 && Math.abs(j + 0.5) < 3.4) {
        return ((i * 31 + j * 17 + 7) % 5 === 0) ? 'floor_dirt_small_weeds' : 'floor_dirt_large';
      }
      return 'floor_tile_large';
    },
    wallPattern: (side, i, L) => L === 0 ? (i % 2 === 0 ? 'wall_arched' : 'wall_archedwindow_open') : 'wall_sloped',
  });
  FXm.skyDome(z, 130);
  // 内圈柱廊
  const pl = [];
  for (let i = -2; i <= 2; i++) {
    pl.push({ n: 'pillar', x: i * 8, y: 0, z: -14 }); pl.push({ n: 'pillar', x: i * 8, y: 0, z: 14 });
    if (Math.abs(i) === 2) continue;
    pl.push({ n: 'pillar', x: -14, y: 0, z: i * 8 }); pl.push({ n: 'pillar', x: 14, y: 0, z: i * 8 });
  }
  instBatch(z, pl);
  for (let i = -2; i <= 2; i++) {
    z.addCollider(i * 8 - 0.7, -14.7, i * 8 + 0.7, -13.3, 4);
    z.addCollider(i * 8 - 0.7, 13.3, i * 8 + 0.7, 14.7, 4);
    if (Math.abs(i) === 2) continue;
    z.addCollider(-14.7, i * 8 - 0.7, -13.3, i * 8 + 0.7, 4);
    z.addCollider(13.3, i * 8 - 0.7, 14.7, i * 8 + 0.7, 4);
  }

  // 中央喷泉
  const fg = new THREE.Group(); fg.position.set(0, 0, 0);
  const basin = new THREE.Mesh(new THREE.CylinderGeometry(3.2, 3.5, 0.9, 18), stoneMat());
  basin.position.y = 0.45; basin.castShadow = basin.receiveShadow = true;
  const waterMat = new THREE.MeshStandardMaterial({ color: 0x3a6a9a, emissive: 0x1a3a5a, emissiveIntensity: 0.4, roughness: 0.15, metalness: 0.3, transparent: true, opacity: 0.85 });
  const water = new THREE.Mesh(new THREE.CircleGeometry(2.9, 18), waterMat);
  water.rotation.x = -Math.PI / 2; water.position.y = 0.82;
  const spire = new THREE.Mesh(new THREE.ConeGeometry(0.5, 2.2, 8), stoneMat());
  spire.position.y = 1.8;
  const orb = new THREE.Mesh(new THREE.SphereGeometry(0.34, 12, 8), new THREE.MeshStandardMaterial({ color: 0x8fd0ff, emissive: 0x5a9ad0, emissiveIntensity: 1.4 }));
  orb.position.y = 3.1;
  fg.add(basin, water, spire, orb);
  z.group.add(fg);
  z.addCollider(-3.4, -3.4, 3.4, 3.4, 2);
  FXm.motes(z, { x0: -2.5, x1: 2.5, y0: 1, y1: 3.4, z0: -2.5, z1: 2.5, n: 24, color: 0x9ad0ff, size: 12, speed: 0.6 });
  z.onUpdate(() => { orb.position.y = 3.1 + Math.sin(FXm.FX.time * 1.2) * 0.15; orb.rotation.y = FXm.FX.time; });

  // 决斗场地(石圈)
  const ring = new THREE.Mesh(new THREE.RingGeometry(4.6, 5.0, 28), new THREE.MeshBasicMaterial({ color: 0xc9a86a, transparent: true, opacity: 0.5 }));
  ring.rotation.x = -Math.PI / 2; ring.position.set(0, 0.1, 20.5);
  z.group.add(ring);
  z._duelRing = ring;

  // 长椅 & 灯
  instBatch(z, [
    { n: 'table_small', x: -10, y: 0, z: 10 }, { n: 'stool', x: -10, y: 0, z: 8.6 }, { n: 'stool', x: -10, y: 0, z: 11.4 },
    { n: 'barrel_small', x: 12, y: 0, z: -12 },
  ]);
  FXm.candles(z, [{ x: -14, z: -14, tall: true }, { x: 14, z: 14, tall: true }, { x: -14, z: 14, tall: true }, { x: 14, z: -14, tall: true }], { lightEvery: 1, intensity: 9, dist: 11 });
  FXm.rainFall(z, { x0: -26, x1: 26, z0: -26, z1: 26, n: 500 });
  // 萤火(夜)
  FXm.motes(z, { x0: -12, x1: 12, y0: 0.5, y1: 2.5, z0: -12, z1: 12, n: 16, color: 0xaef29a, size: 12, speed: 0.12 });

  // 门
  z.addDoor(27, 0, 'stair', '回到 楼梯厅');
  z.addDoor(-27, 0, 'greenhouse', '进入 温室', '🌿');
  z.addDoor(2, -27, 'forest', '出发 禁林', '🌲', null, () => {
    if (S.phase >= 3 || flag('forestFree')) return true;
    return '禁林只在黄昏后开放——而且最好结伴同行。';
  });
  // 太阳/月亮方向光
  const sun = new THREE.DirectionalLight(0xffe8c0, 2.2);
  sun.position.set(30, 40, 20); sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -40; sun.shadow.camera.right = 40; sun.shadow.camera.top = 40; sun.shadow.camera.bottom = -40;
  sun.target.position.set(0, 0, 0);
  z.group.add(sun, sun.target);
  z._sun = sun;
  return z;
}
