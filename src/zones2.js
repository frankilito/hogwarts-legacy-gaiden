// zones2.js — 区域建造 II:图书馆 / 温室 / 天文塔 / 魔药教室 / 宿舍
import * as THREE from 'three';
import { Zone, put, room, instBatch, TILE } from './castle.js';
import * as FXm from './fx.js';
import { T } from './assets.js';
import { S, flag } from './state.js';
import { HOUSES } from './data.js';
import { Z, woodMat, stoneMat, makeCauldron, makePlant } from './zones.js';

// ---------- 图书馆 ----------
export function buildLibrary() {
  const z = new Zone('library', '图书馆', { ox: 900, oz: 0, fog: { color: 0x0c0a08, density: 0.022 }, ambient: 0x5a4c3a, ambientI: 1.05, bgm: 'library' });
  Z.library = z;
  z.spawn.set(-21.5, 0, 0);
  room(z, {
    w: 6, d: 7, wallH: 2,
    doors: [{ side: 3, i: -1 }, { side: 3, i: 0 }],
    floor: 'floor_wood_large',
    wallPattern: (side, i, L) => L === 0 ? 'wall_shelves' : (i % 2 === 0 ? 'wall_window_closed' : 'wall'),
  });
  const ceil = new THREE.Mesh(new THREE.PlaneGeometry(49, 57), new THREE.MeshStandardMaterial({ map: T.wood(true), roughness: 1 }));
  ceil.rotation.x = Math.PI / 2; ceil.position.y = 8; z.group.add(ceil);

  // 高书架阵列(程序化:木框+书墙纹理)
  const bookMats = [0, 1, 2].map((i) => new THREE.MeshStandardMaterial({ map: T.books(i), roughness: 0.9 }));
  const frameMat = woodMat();
  function bookcase(x, zz, ry = 0, len = 8, h = 4.4) {
    const g = new THREE.Group(); g.position.set(x, 0, zz); g.rotation.y = ry;
    const core = new THREE.Mesh(new THREE.BoxGeometry(len, h, 1.0), frameMat);
    core.position.y = h / 2; core.castShadow = core.receiveShadow = true;
    g.add(core);
    for (const side of [-1, 1]) {
      const face = new THREE.Mesh(new THREE.PlaneGeometry(len - 0.2, h - 0.2), bookMats[(Math.abs(x + zz) | 0) % 3]);
      face.position.set(0, h / 2, side * 0.51);
      if (side < 0) face.rotation.y = Math.PI;
      g.add(face);
    }
    const top = new THREE.Mesh(new THREE.BoxGeometry(len + 0.3, 0.25, 1.2), frameMat);
    top.position.y = h + 0.12; g.add(top);
    z.group.add(g);
    // 碰撞
    if (Math.abs(Math.sin(ry)) > 0.5) z.addCollider(x - 0.7, zz - len / 2, x + 0.7, zz + len / 2, h);
    else z.addCollider(x - len / 2, zz - 0.7, x + len / 2, zz + 0.7, h);
  }
  // 书架行(中央留主通道)
  for (const zz of [-8, -3, 2, 7]) {
    bookcase(-13, zz, 0, 14);
    bookcase(13, zz, 0, 14);
  }
  bookcase(0, -14, Math.PI / 2, 10);
  // 漂浮书
  FXm.floatingBooks(z, { x0: -14, x1: 14, y0: 4.6, y1: 6.6, z0: -12, z1: 10, n: 16 });
  FXm.motes(z, { x0: -18, x1: 18, y0: 0.5, y1: 6, z0: -20, z1: 20, n: 46, color: 0xd8c8a0 });
  // 巷道烛光
  FXm.candles(z, [
    { x: -3.5, z: -5.5, tall: true }, { x: 3.5, z: -0.5, tall: true }, { x: -3.5, z: 4.5, tall: true },
    { x: -17, z: 12, tall: true }, { x: 17, z: 12, tall: true },
  ], { lightEvery: 1, intensity: 11, dist: 12 });
  // 高窗光柱
  FXm.lightShaft(z, -20, 3.2, -10, { h: 7, r: 2, tilt: -0.55, opacity: 0.13, color: 0xb8c8e8 });
  FXm.lightShaft(z, -20, 3.2, 6, { h: 7, r: 2, tilt: -0.55, opacity: 0.13, color: 0xb8c8e8 });

  // 阅读区
  instBatch(z, [
    { n: 'table_medium', x: -6, y: 0, z: 18 }, { n: 'chair', x: -6, y: 0, z: 16.6 }, { n: 'chair', x: -6, y: 0, z: 19.4, ry: Math.PI },
    { n: 'table_medium', x: 6, y: 0, z: 18 }, { n: 'chair', x: 6, y: 0, z: 16.6 }, { n: 'chair', x: 6, y: 0, z: 19.4, ry: Math.PI },
    { n: 'table_medium', x: 0, y: 0, z: 22 }, { n: 'chair', x: 0, y: 0, z: 20.6 },
    { n: 'candle_lit', x: -6, y: 1.02, z: 18 }, { n: 'candle_lit', x: 6, y: 1.02, z: 18 }, { n: 'candle_triple', x: 0, y: 1.02, z: 22 },
    { n: 'shelf_small_candles', x: 0, y: 2.4, z: -21.4 },
  ]);
  z.addCollider(-7, 17.2, -5, 18.8); z.addCollider(5, 17.2, 7, 18.8); z.addCollider(-1, 21.2, 1, 22.8);
  FXm.candles(z, [{ x: -6, y: 1.02, z: 18 }, { x: 6, y: 1.02, z: 18 }, { x: 0, y: 1.02, z: 22 }], { model: null, lightEvery: 1, intensity: 7, dist: 8 });

  // 禁书区(北端,栅栏+幽光)
  instBatch(z, [
    { n: 'barrier', x: -6, y: 0, z: -18 }, { n: 'barrier', x: 6, y: 0, z: -18 },
    { n: 'barrier_column', x: -2.2, y: 0, z: -18 }, { n: 'barrier_column', x: 2.2, y: 0, z: -18 },
  ]);
  z.addCollider(-8, -18.5, -2.1, -17.5, 1.4); z.addCollider(2.1, -18.5, 8, -17.5, 1.4);
  const gateGlow = new THREE.PointLight(0x66ff9a, 4, 10, 2); gateGlow.position.set(0, 2.4, -21);
  z.group.add(gateGlow);
  FXm.motes(z, { x0: -8, x1: 8, y0: 0.5, y1: 4, z0: -24, z1: -18, n: 22, color: 0x7ae0a8, size: 16, speed: 0.15 });
  z.addInteract({
    x: 0, z: -18, r: 2, label: '进入 禁书区', icon: '⛓',
    cond: () => flag('restrictedOpen') ? true : '禁书区被银链封着。艾拉的低语:「深夜……或者,带着许可来。」',
    cb: () => { flagSetLocal(); },
  });
  function flagSetLocal() { /* 由任务系统接管 */ }
  // 画像
  FXm.portrait(z, 23.4, 3, 12, -Math.PI / 2, 6);
  FXm.portrait(z, 23.4, 3, -6, -Math.PI / 2, 2);
  z.addDoor(-25, 0, 'stair', '回到 楼梯厅');
  return z;
}

// ---------- 温室 ----------
export function buildGreenhouse() {
  const z = new Zone('greenhouse', '三号温室', { ox: 1200, oz: 300, fog: { color: 0x0e1410, density: 0.02 }, outdoor: true, ambient: 0x4a5a48, ambientI: 0.95, bgm: 'outdoor' });
  Z.greenhouse = z;
  z.spawn.set(10, 0, 0);
  // 石基座地面
  room(z, {
    w: 4, d: 5, wallH: 0,
    doors: [{ side: 1, i: -1 }, { side: 1, i: 0 }],
    floorPick: (i, j) => (Math.abs(i + 0.5) < 2 && Math.abs(j + 0.5) < 3.4 ? 'floor_dirt_large' : 'floor_tile_small'),
  });
  FXm.skyDome(z, 110);
  // 玻璃墙(半墙 + 玻璃)
  const glassMat = new THREE.MeshPhysicalMaterial({ color: 0xbfe8e0, transparent: true, opacity: 0.16, roughness: 0.08, metalness: 0.1, side: THREE.DoubleSide });
  const frame = new THREE.MeshStandardMaterial({ color: 0x3a4a42, roughness: 0.5, metalness: 0.6 });
  const W = 16, D = 20, H = 4.6;
  function glassWall(x, zz, ry, len) {
    const g = new THREE.Group(); g.position.set(x, 0, zz); g.rotation.y = ry;
    const low = new THREE.Mesh(new THREE.BoxGeometry(len, 1, 0.5), stoneMat()); low.position.y = 0.5;
    g.add(low);
    const glass = new THREE.Mesh(new THREE.PlaneGeometry(len, H - 1), glassMat);
    glass.position.y = 1 + (H - 1) / 2;
    g.add(glass);
    for (let i = 0; i <= len / 4; i++) {
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.18, H, 0.18), frame);
      post.position.set(-len / 2 + i * 4, H / 2, 0);
      g.add(post);
    }
    const beam = new THREE.Mesh(new THREE.BoxGeometry(len, 0.2, 0.2), frame);
    beam.position.y = H; g.add(beam);
    g.traverse((o) => { if (o.isMesh) { o.castShadow = o.receiveShadow = true; } });
    z.group.add(g);
  }
  glassWall(0, -D, 0, W * 2);
  glassWall(0, D, 0, W * 2);
  glassWall(-W, 0, Math.PI / 2, D * 2);
  glassWall(W, 0, Math.PI / 2, D * 2);
  z.addCollider(-W, -D - 0.4, W, -D + 0.4, H); z.addCollider(-W, D - 0.4, W, D + 0.4, H);
  z.addCollider(-W - 0.4, -D, -W + 0.4, D, H);
  z.addCollider(W - 0.4, -D, W + 0.4, -2.2, H); z.addCollider(W - 0.4, 2.2, W + 0.4, D, H);
  // 玻璃屋顶(两坡)
  for (const s of [-1, 1]) {
    const roof = new THREE.Mesh(new THREE.PlaneGeometry(W * 1.16, D * 2), glassMat);
    roof.rotation.x = Math.PI / 2; roof.rotation.y = s * 0.5;
    roof.position.set(s * W * 0.5, H + 2.2, 0);
    z.group.add(roof);
    const ridge = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.25, D * 2), frame);
    ridge.position.set(0, H + 4.4, 0); z.group.add(ridge);
  }

  // 苗床与植物
  const bedMat = new THREE.MeshStandardMaterial({ color: 0x3a2a1a, roughness: 1 });
  for (const bx of [-9, 0, 9]) {
    const bed = new THREE.Mesh(new THREE.BoxGeometry(5, 0.7, 26), bedMat);
    bed.position.set(bx, 0.35, 0); bed.receiveShadow = true;
    z.group.add(bed);
    z.addCollider(bx - 2.5, -13, bx + 2.5, 13, 1);
    for (let k = 0; k < 8; k++) makePlant(z, bx + (Math.random() - 0.5) * 3.4, 0.7, -11 + k * 3.1, { kind: k % 3, s: 0.9 + Math.random() * 0.5 });
  }
  // 月光花圃(夜里发光)
  const moonbed = new THREE.Group(); moonbed.position.set(-9, 0.72, 10);
  const flowers = [];
  for (let i = 0; i < 6; i++) {
    const f = new THREE.Mesh(new THREE.ConeGeometry(0.14, 0.3, 6), new THREE.MeshStandardMaterial({ color: 0xdfe8ff, emissive: 0x8fa8ff, emissiveIntensity: 0 }));
    f.position.set((Math.random() - 0.5) * 3, 0.3, (Math.random() - 0.5) * 2);
    f.rotation.x = Math.PI;
    moonbed.add(f); flowers.push(f);
  }
  z.group.add(moonbed);
  z.onUpdate(() => {
    const night = S.phase >= 4 ? 1 : 0;
    for (const f of flowers) f.material.emissiveIntensity += (night * 1.6 - f.material.emissiveIntensity) * 0.03;
  });
  // 曼德拉草盆(小游戏用)
  instBatch(z, [
    { n: 'table_medium', x: 9, y: 0, z: 16 }, { n: 'table_medium', x: 3, y: 0, z: 16 },
    { n: 'barrel_small', x: -3, y: 0, z: 16.5 }, { n: 'barrel_small', x: -6, y: 0, z: 16.5 },
    { n: 'bottle_B_green', x: 3.4, y: 1.02, z: 16 }, { n: 'bottle_A_brown', x: 8.6, y: 1.05, z: 15.6 },
  ]);
  z.addCollider(1, 15.2, 11, 16.8, 1.2);
  for (let i = 0; i < 3; i++) makePlant(z, 8.6 - i * 1.6, 1.05, 16.3, { kind: 0, s: 0.5 });
  // 雨与尘
  FXm.rainFall(z, { x0: -18, x1: 18, z0: -22, z1: 22, y: 12, n: 350 });
  FXm.motes(z, { x0: -14, x1: 14, y0: 0.6, y1: 4, z0: -18, z1: 18, n: 40, color: 0xa8d888, size: 13, speed: 0.2 });
  const sun = new THREE.DirectionalLight(0xfff2d8, 2.0);
  sun.position.set(20, 30, 10); sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  sun.shadow.camera.left = -30; sun.shadow.camera.right = 30; sun.shadow.camera.top = 30; sun.shadow.camera.bottom = -30;
  z.group.add(sun, sun.target); z._sun = sun;
  z.addDoor(17.5, 0, 'courtyard', '回到 庭院');
  return z;
}

// ---------- 天文塔顶 ----------
export function buildAstro() {
  const z = new Zone('astro', '天文塔顶', { ox: 1500, oz: 0, fog: { color: 0x05070f, density: 0.012 }, outdoor: true, ambient: 0x3a4468, ambientI: 1.0, bgm: 'night' });
  Z.astro = z;
  z.spawn.set(0, 0, 10);
  FXm.skyDome(z, 100);
  // 圆形平台
  const R = 13;
  const plat = new THREE.Mesh(new THREE.CylinderGeometry(R, R + 0.6, 1.2, 28), stoneMat());
  plat.position.y = -0.6; plat.receiveShadow = true;
  z.group.add(plat);
  // 齿形护墙
  const cren = [];
  for (let i = 0; i < 30; i++) {
    const a = i / 30 * Math.PI * 2;
    cren.push({ n: 'barrier_half', x: Math.cos(a) * (R - 0.6), y: 0, z: Math.sin(a) * (R - 0.6), ry: -a + Math.PI / 2 });
  }
  instBatch(z, cren);
  // 环形碰撞(8段近似)
  for (let i = 0; i < 16; i++) {
    const a0 = i / 16 * Math.PI * 2;
    const x = Math.cos(a0) * (R - 0.4), zz = Math.sin(a0) * (R - 0.4);
    z.addCollider(x - 1.4, zz - 1.4, x + 1.4, zz + 1.4, 1.4);
  }
  // 望远镜(程序化)
  const tg = new THREE.Group(); tg.position.set(0, 0, -4);
  const brass = new THREE.MeshStandardMaterial({ color: 0x9a7a3a, roughness: 0.35, metalness: 0.85 });
  const tripod = new THREE.Mesh(new THREE.ConeGeometry(1.0, 1.6, 3, 1, true), new THREE.MeshStandardMaterial({ color: 0x2c2620, roughness: 0.8 }));
  tripod.position.y = 0.8;
  const tube = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.3, 2.6, 12), brass);
  tube.position.y = 1.9; tube.rotation.x = -Math.PI / 3.2;
  tube.position.z = -0.5;
  const eye = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.14, 0.4, 10), brass);
  eye.position.set(0, 1.35, 0.45); eye.rotation.x = -Math.PI / 3.2;
  tg.add(tripod, tube, eye);
  tg.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  z.group.add(tg);
  z.addCollider(-1, -5, 1, -3, 1.6);
  z._telescope = tg;
  // 星图桌
  instBatch(z, [
    { n: 'table_medium_tablecloth', x: 5, y: 0, z: -2 },
    { n: 'candle_triple', x: 5, y: 1.05, z: -2 },
    { n: 'trunk_small_A', x: -6, y: 0, z: 2 },
  ]);
  z.addCollider(4, -3, 6, -1, 1.2);
  FXm.candles(z, [{ x: 5, y: 1.05, z: -2 }], { model: null, lightEvery: 1, intensity: 8 });
  // 星尘粒子
  FXm.motes(z, { x0: -10, x1: 10, y0: 1, y1: 6, z0: -10, z1: 10, n: 36, color: 0x9ab8ff, size: 14, speed: 0.1, tex: T.star() });
  // 月光
  const moon = new THREE.DirectionalLight(0x9ab8e8, 1.2);
  moon.position.set(-20, 30, -10); moon.castShadow = true;
  moon.shadow.mapSize.set(1024, 1024);
  moon.shadow.camera.left = -20; moon.shadow.camera.right = 20; moon.shadow.camera.top = 20; moon.shadow.camera.bottom = -20;
  z.group.add(moon, moon.target); z._sun = moon;
  const moonSp = new THREE.Sprite(new THREE.SpriteMaterial({ map: T.moon(), transparent: true, depthWrite: false }));
  moonSp.scale.setScalar(14); moonSp.position.set(-45, 55, -30);
  z.group.add(moonSp);
  z._moonSp = moonSp;
  z.addDoor(0, 12, 'stair', '下楼 回楼梯厅', '⬇');
  return z;
}

// ---------- 魔药教室 ----------
export function buildPotions() {
  const z = new Zone('potions', '魔药教室', { ox: 1800, oz: 0, fog: { color: 0x081008, density: 0.03 }, ambient: 0x2a3a2e, ambientI: 0.9, bgm: 'dungeon' });
  Z.potions = z;
  z.spawn.set(0, 0, 9);
  room(z, {
    w: 4, d: 4, wallH: 1,
    doors: [{ side: 2, i: 0 }],
    floor: 'floor_tile_small',
    wallPattern: (side, i, L) => (i % 2 === 0 ? 'wall_shelves' : 'wall'),
  });
  const ceil = new THREE.Mesh(new THREE.PlaneGeometry(33, 33), new THREE.MeshStandardMaterial({ map: T.stone(1), roughness: 1 }));
  ceil.rotation.x = Math.PI / 2; ceil.position.y = 4; z.group.add(ceil);

  // 讲台+格雷的大坩埚
  instBatch(z, [
    { n: 'table_long_tablecloth', x: 0, y: 0, z: -12, ry: Math.PI / 2 },
    { n: 'shelf_large', x: -6, y: 1.6, z: -15.4 }, { n: 'shelf_large', x: 6, y: 1.6, z: -15.4 },
    { n: 'bottle_A_labeled_green', x: -6, y: 1.85, z: -15.4 }, { n: 'bottle_B_brown', x: -5.2, y: 1.85, z: -15.4 },
    { n: 'bottle_C_green', x: 6, y: 1.85, z: -15.4 }, { n: 'bottle_A_brown', x: 6.8, y: 1.85, z: -15.4 },
    { n: 'bottle_B_green', x: -6.6, y: 1.85, z: -15.4 }, { n: 'bottle_C_brown', x: 5.4, y: 1.85, z: -15.4 },
  ]);
  z.addCollider(-1.2, -13.8, 1.2, -10.2, 1.2);
  makeCauldron(z, 2.4, 0, -11, { s: 1.3, liquid: 0x3fae6a });
  // 黑板
  const bb = new THREE.Group(); bb.position.set(0, 2.2, -15.3);
  const board = new THREE.Mesh(new THREE.PlaneGeometry(6, 3), new THREE.MeshStandardMaterial({ color: 0x14211a, roughness: 0.9 }));
  const bfr = new THREE.Mesh(new THREE.BoxGeometry(6.3, 3.3, 0.1), woodMat()); bfr.position.z = -0.06;
  const bc = document.createElement('canvas'); bc.width = 512; bc.height = 256;
  const bg2 = bc.getContext('2d');
  bg2.fillStyle = '#16241c'; bg2.fillRect(0, 0, 512, 256);
  bg2.font = '30px MagicSerif, Songti SC, serif'; bg2.fillStyle = '#cfe0cf';
  bg2.fillText('今日配方 · 愈伤药剂', 24, 48);
  bg2.font = '22px MagicSerif, Songti SC, serif'; bg2.fillStyle = '#a8c0a8';
  bg2.fillText('① 月光花瓣 两片', 40, 96);
  bg2.fillText('② 扭曲树根 一段', 40, 132);
  bg2.fillText('③ 文火 · 顺时针搅拌三圈', 40, 168);
  bg2.fillText('—— 手别抖。 格雷', 250, 224);
  const btex = new THREE.CanvasTexture(bc); btex.colorSpace = THREE.SRGBColorSpace;
  const btm = new THREE.Mesh(new THREE.PlaneGeometry(5.6, 2.8), new THREE.MeshBasicMaterial({ map: btex, transparent: true }));
  btm.position.z = 0.01;
  bb.add(bfr, board, btm);
  z.group.add(bb);

  // 学生课桌(6 组,每桌一小坩埚)
  const pl = [];
  for (let r = 0; r < 2; r++) for (let c = 0; c < 3; c++) {
    const x = -8 + c * 8, zz = -2 + r * 7;
    pl.push({ n: 'table_medium', x, y: 0, z: zz });
    pl.push({ n: 'stool', x: x - 1, y: 0, z: zz + 1.6 });
    pl.push({ n: 'stool', x: x + 1, y: 0, z: zz + 1.6 });
    z.addCollider(x - 1.6, zz - 1.1, x + 1.6, zz + 1.1, 1.1);
    makeCauldron(z, x, 1.0, zz - 0.2, { s: 0.5, liquid: [0x3fae6a, 0xae5a3f, 0x3f6aae][c], bubbling: r === 0 });
  }
  instBatch(z, pl);
  // 幽绿吊灯
  FXm.candles(z, [{ x: -8, y: 0, z: -2, tall: true }, { x: 8, y: 0, z: 5, tall: true }], { lightEvery: 1, intensity: 8, dist: 10 });
  const gl = new THREE.PointLight(0x50c878, 7, 14, 2); gl.position.set(0, 3, -11);
  z.group.add(gl);
  FXm.motes(z, { x0: -12, x1: 12, y0: 0.5, y1: 3.4, z0: -14, z1: 12, n: 30, color: 0x6ac888, size: 13, speed: 0.25 });
  z.addDoor(0, 15, 'stair', '上行 回楼梯厅', '⬆');
  return z;
}

// ---------- 学院宿舍(休息室+寝室) ----------
export function buildDorm() {
  const z = new Zone('dorm', '学院宿舍', { ox: 2100, oz: 0, fog: { color: 0x0e0a08, density: 0.02 }, ambient: 0x5a4a3a, ambientI: 1.15, bgm: 'dorm' });
  Z.dorm = z;
  z.spawn.set(0, 0, 10);
  // 休息室
  room(z, {
    w: 4, d: 4, wallH: 1,
    doors: [{ side: 2, i: 0 }, { side: 1, i: 0 }],
    floor: 'floor_wood_large_dark',
    wallPattern: () => 'wall',
  });
  // 寝室
  room(z, {
    x: 24, z: 0, w: 3, d: 3, wallH: 1,
    doors: [{ side: 3, i: 0 }],
    floor: 'floor_wood_large',
    wallPattern: (side, i) => (side === 0 && i === 0 ? 'wall_window_open' : 'wall'),
  });
  // 连廊
  instBatch(z, [
    { n: 'floor_wood_large', x: 14, y: 0, z: 2 }, { n: 'floor_wood_large', x: 18, y: 0, z: 2 },
    { n: 'wall', x: 14, y: 0, z: -0.5 }, { n: 'wall', x: 18, y: 0, z: -0.5 },
    { n: 'wall', x: 14, y: 0, z: 4.5, ry: Math.PI }, { n: 'wall', x: 18, y: 0, z: 4.5, ry: Math.PI },
  ]);
  z.addCollider(12, -1.2, 20, 0.2, 4); z.addCollider(12, 3.8, 20, 5.2, 4);
  const ceil = new THREE.Mesh(new THREE.PlaneGeometry(60, 34), new THREE.MeshStandardMaterial({ map: T.wood(true), roughness: 1 }));
  ceil.rotation.x = Math.PI / 2; ceil.position.set(10, 4, 0); z.group.add(ceil);

  // 休息室:壁炉/地毯/沙发椅/公告板
  const rug = new THREE.Mesh(new THREE.CircleGeometry(4, 20), new THREE.MeshStandardMaterial({ color: 0x6b2f2a, roughness: 1 }));
  rug.rotation.x = -Math.PI / 2; rug.position.set(0, 0.06, 2);
  z.group.add(rug);
  z._rugMat = rug.material;
  instBatch(z, [
    { n: 'chair', x: -2.4, y: 0, z: 2, ry: Math.PI / 2 + 0.3 },
    { n: 'chair', x: 2.4, y: 0, z: 2, ry: -Math.PI / 2 - 0.3 },
    { n: 'chair', x: 0, y: 0, z: 5, ry: Math.PI + 0.1 },
    { n: 'table_small_decorated_A', x: 0, y: 0, z: 2 },
    { n: 'shelf_large', x: 6, y: 1.4, z: -15.4 },
    { n: 'shelves', x: -10, y: 0, z: -15 },
    { n: 'trunk_large_A', x: -14.5, y: 0, z: 8 },
    { n: 'box_small', x: 13, y: 0, z: -13.5 },
  ]);
  z.addCollider(-0.9, 1.1, 0.9, 2.9, 1);
  // 壁炉(西墙)
  const fireG = new THREE.Group(); fireG.position.set(-15.4, 0, 2); fireG.rotation.y = Math.PI / 2;
  z.group.add(fireG);
  const fpBack = new THREE.Mesh(new THREE.BoxGeometry(3, 2.6, 0.5), stoneMat()); fpBack.position.set(0, 1.3, -0.2);
  const fpTop = new THREE.Mesh(new THREE.BoxGeometry(3.5, 0.4, 1), stoneMat()); fpTop.position.set(0, 2.7, 0.2);
  fireG.add(fpBack, fpTop);
  FXm.fireplace(z, -14.6, 0.4, 2);
  z.addCollider(-16, 0.4, -14.6, 3.6, 3);
  // 公告板
  const noteC = document.createElement('canvas'); noteC.width = 256; noteC.height = 192;
  const ng = noteC.getContext('2d');
  ng.fillStyle = '#7a5a34'; ng.fillRect(0, 0, 256, 192);
  ng.fillStyle = '#d8c49a'; ng.fillRect(14, 14, 100, 70); ng.fillRect(130, 30, 100, 60);
  ng.fillRect(30, 100, 110, 70);
  ng.fillStyle = '#4a3620'; ng.font = '15px MagicSerif, serif';
  ng.fillText('决斗社招新!', 22, 40); ng.fillText('黄昏·庭院', 22, 60);
  ng.fillText('失物招领', 140, 55); ng.fillText('宿舍装饰大赛', 38, 130); ng.fillText('欢迎参观交流', 38, 150);
  const noteT = new THREE.CanvasTexture(noteC); noteT.colorSpace = THREE.SRGBColorSpace;
  const note = new THREE.Mesh(new THREE.PlaneGeometry(3, 2.2), new THREE.MeshStandardMaterial({ map: noteT, roughness: 0.95 }));
  note.position.set(8, 2, -15.35);
  z.group.add(note);
  // 学院旗帜+暖光
  FXm.candles(z, [{ x: -8, z: -8, tall: true }, { x: 8, z: 8, tall: true }, { x: -8, z: 12, tall: true }], { lightEvery: 1, intensity: 9, dist: 11 });
  FXm.motes(z, { x0: -12, x1: 12, y0: 0.5, y1: 3, z0: -12, z1: 12, n: 20 });

  // 寝室:床+装饰区(由 decor 系统动态摆)
  z._decorRoot = new THREE.Group();
  z.group.add(z._decorRoot);
  z._decorBounds = { x0: 13.5, x1: 34.5, z0: -10.5, z1: 10.5 };
  // 室友床(固定)
  instBatch(z, [
    { n: 'bed_frame', x: 32, y: 0, z: 8, ry: -Math.PI / 2 },
  ]);
  z.addCollider(29.8, 6.8, 34.2, 9.2, 1.2);
  // 窗月光
  FXm.lightShaft(z, 24, 1.8, -13, { h: 6, r: 1.8, tilt: 0.5, color: 0x8fa8d8, opacity: 0.12 });
  z.addDoor(0, 15, 'stair', '离开宿舍 → 楼梯厅');
  z.addInteract({ x: -10, z: -14.6, r: 2.2, label: '猫头鹰邮购(商店)', icon: '🦉', shop: true });
  z.addInteract({ x: 13, z: -13.5, r: 2, label: '布置我的房间', icon: '🪑', decor: true });
  // 学院色调整(进入时按玩家学院染色)
  z.applyHouse = () => {
    const h = HOUSES[S.house];
    if (h) { rug.material.color.set(h.color).multiplyScalar(0.8); }
  };
  return z;
}
