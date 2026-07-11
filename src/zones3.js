// zones3.js — 区域建造 III:地下密室(迷宫/机关/首领厅) / 禁林
import * as THREE from 'three';
import { Zone, put, room, instBatch, TILE, pushFloor } from './castle.js';
import * as FXm from './fx.js';
import { T } from './assets.js';
import { S, flag, setFlag } from './state.js';
import { Z, stoneMat, woodMat } from './zones.js';

// ---------- 地下密室 ----------
// 图例: #墙 .地 E入口 S骷髅 C宝箱 P压力板 B浮石 F火盆 G门 O金币 R瓦砾 M机关核心 ~深渊 1/2传送门
const DMAP = [
  '######################',
  '#....##########....###',
  '#.MM.....G2.....C..###',
  '#.MM.#####.########.##',
  '#....#...#.#......#.##',
  '##.###.F.#.#.~~~~.#.##',
  '##.#...#.#.#.~~~~.#.##',
  '##.#.F...#.#1~~~~2#.##',
  '##.#######.#......#.##',
  '##.S....#..#...S..#.##',
  '##.###..G1.########.##',
  '#..#.#..#..........#.#',
  '#.C#.#####.#######.#.#',
  '#..#.....#.#.....#...#',
  '##.#####.#.#.###.###.#',
  '#..S...#...#.#B#...#.#',
  '#.####.#####.#.#.#.#.#',
  '#.#..O.......#.P.#.S.#',
  '#.#.#########.###.##.#',
  '#.#.....S....#.....#.#',
  '#.#####.#.#####.####.#',
  '#.......#....#....#..#',
  '######.###.#####.###.#',
  '#....#...#.....#...#.#',
  '#.O..###.#####.###...#',
  '#..S.....#...E....####',
  '######################',
];

export function buildDungeon() {
  const z = new Zone('dungeon', '地下密室', { ox: 2400, oz: 0, fog: { color: 0x060608, density: 0.05 }, ambient: 0x2a2635, ambientI: 0.55, bgm: 'dungeon' });
  Z.dungeon = z;
  const rows = DMAP.length, cols = DMAP[0].length;
  const cx = (i) => (i - cols / 2) * TILE + TILE / 2;
  const cz = (j) => (j - rows / 2) * TILE + TILE / 2;
  const at = (i, j) => (DMAP[j] && DMAP[j][i]) || '#';
  const isFloor = (ch) => ch !== '#';
  const pl = [];
  const torchPts = [];
  z.spawnPoints = []; z.chests = []; z.coins = [];
  let plate = null, block = null, braziers = [], portals = [];

  for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) {
    const ch = at(i, j);
    if (ch === '#') {
      // 邻接地板才放墙面
      const nb = [[0, -1, 0], [1, 0, Math.PI / 2], [0, 1, Math.PI], [-1, 0, -Math.PI / 2]];
      let solid = false;
      for (const [dx, dz] of nb) if (isFloor(at(i + dx, j + dz))) { solid = true; break; }
      if (solid) {
        for (const [dx, dz, ry] of nb) {
          if (isFloor(at(i + dx, j + dz))) {
            pl.push({ n: Math.random() < 0.12 ? 'wall_cracked' : 'wall', x: cx(i) + dx * (TILE / 2 - 0.5), y: 0, z: cz(j) + dz * (TILE / 2 - 0.5), ry: ry + Math.PI });
            if (Math.random() < 0.12) torchPts.push({ x: cx(i) + dx * (TILE / 2 - 1.0), z: cz(j) + dz * (TILE / 2 - 1.0) });
          }
        }
        z.addCollider(cx(i) - 2, cz(j) - 2, cx(i) + 2, cz(j) + 2);
      }
      continue;
    }
    if (ch === '~') {
      // 深渊:无地板 + 碰撞禁行 + 底部微光
      z.addCollider(cx(i) - 2, cz(j) - 2, cx(i) + 2, cz(j) + 2, 20);
      continue;
    }
    // 地板
    const fl = ch === 'M' ? 'floor_tile_big_grate' : (i * 7 + j * 13) % 11 === 0 ? 'floor_tile_small_broken_A' : (i + j) % 7 === 0 ? 'floor_tile_small_weeds_A' : 'floor_tile_large';
    pushFloor(pl, fl, cx(i), cz(j));
    if (ch === 'E') { z.spawn.set(cx(i), 0, cz(j)); z.spawnYaw = -Math.PI / 2; z._exitPos = { x: cx(i) + 8, z: cz(j) }; }
    if (ch === 'S') z.spawnPoints.push({ x: cx(i), z: cz(j) });
    if (ch === 'C') z.chests.push({ x: cx(i), z: cz(j), id: `chest_${i}_${j}` });
    if (ch === 'O') z.coins.push({ x: cx(i), z: cz(j), id: `coin_${i}_${j}` });
    if (ch === 'R') pl.push({ n: 'rubble_large', x: cx(i), y: 0, z: cz(j) });
    if (ch === 'P') plate = { x: cx(i), z: cz(j) };
    if (ch === 'B') block = { x: cx(i), z: cz(j) };
    if (ch === 'F') braziers.push({ x: cx(i), z: cz(j) });
    if (ch === '1') portals[0] = { x: cx(i), z: cz(j) };
    if (ch === '2') portals[1] = { x: cx(i), z: cz(j) };
    if (ch === 'G') {
      const id = at(i + 1, j); // G1/G2 的数字在右侧
      z['gate' + id] = { x: cx(i) + TILE / 2, z: cz(j), i, j };
      pl.push({ n: 'floor_tile_large', x: cx(i) + TILE, y: 0, z: cz(j) });
    }
    if (ch === 'M') z._mechCenter = { x: cx(i) + 2, z: cz(j) + 2 };
  }
  instBatch(z, pl);
  // 天花板
  const ceil = new THREE.Mesh(new THREE.PlaneGeometry(cols * TILE, rows * TILE), new THREE.MeshStandardMaterial({ map: T.stone(1), roughness: 1, color: 0x777 }));
  ceil.rotation.x = Math.PI / 2; ceil.position.y = 4;
  z.group.add(ceil);
  // 火把
  const tp = torchPts.slice(0, 26);
  instBatch(z, tp.map((p) => ({ n: 'torch_mounted', x: p.x, y: 2, z: p.z })));
  FXm.flamePoints(z, tp.map((p) => ({ x: p.x, y: 2.75, z: p.z })), { size: 0.55, color: 0xff9a50 });
  tp.forEach((p, i) => { if (i % 3 === 0) { const L = new THREE.PointLight(0xff8a40, 10, 11, 2); L.position.set(p.x, 2.8, p.z); z.group.add(L); } });
  FXm.motes(z, { x0: -40, x1: 40, y0: 0.3, y1: 3, z0: -48, z1: 48, n: 60, color: 0x88a0c8, size: 12, speed: 0.1 });

  // ---- 机关 1:压力板与浮石 ----
  if (plate && block) {
    const pm = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 1.2, 0.16, 12), new THREE.MeshStandardMaterial({ color: 0x6a5a2f, emissive: 0x4a3a10, emissiveIntensity: 0.4, roughness: 0.6 }));
    pm.position.set(plate.x, 0.14, plate.z);
    z.group.add(pm);
    const bm = new THREE.Mesh(new THREE.BoxGeometry(1.5, 1.5, 1.5), new THREE.MeshStandardMaterial({ map: T.stone(2), roughness: 0.9 }));
    bm.position.set(block.x, 0.75, block.z);
    bm.castShadow = true;
    z.group.add(bm);
    z._plate = { mesh: pm, pos: plate };
    z._block = { mesh: bm, held: false };
    z._blockCol = { min: new THREE.Vector3(block.x - 0.85 + z.offset.x, 0, block.z - 0.85 + z.offset.z), max: new THREE.Vector3(block.x + 0.85 + z.offset.x, 1.6, block.z + 0.85 + z.offset.z) };
    z.colliders.push(z._blockCol);
  }
  // ---- 机关 2:双火盆 ----
  z._braziers = braziers.map((b) => {
    const stand = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.4, 1.0, 10), new THREE.MeshStandardMaterial({ color: 0x2c2c33, metalness: 0.7, roughness: 0.5 }));
    stand.position.set(b.x, 0.5, b.z); stand.castShadow = true;
    z.group.add(stand);
    z.addCollider(b.x - 0.6, b.z - 0.6, b.x + 0.6, b.z + 0.6, 1.2);
    const bowl = new THREE.Mesh(new THREE.SphereGeometry(0.6, 12, 6, 0, Math.PI * 2, 0, Math.PI * 0.5), stand.material);
    bowl.rotation.x = Math.PI; bowl.position.set(b.x, 1.15, b.z);
    z.group.add(bowl);
    const fireSp = new THREE.Sprite(new THREE.SpriteMaterial({ map: T.flame(), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, color: 0xffa050 }));
    fireSp.position.set(b.x, 1.6, b.z); fireSp.scale.setScalar(0.001);
    z.group.add(fireSp);
    const L = new THREE.PointLight(0xff8a40, 0, 10, 2); L.position.set(b.x, 1.8, b.z);
    z.group.add(L);
    return { ...b, lit: false, fireSp, L };
  });
  // ---- 传送门(古代成对石门) ----
  z._portals = portals.map((p, idx) => {
    const g = new THREE.Group(); g.position.set(p.x, 0, p.z);
    const arch = new THREE.Mesh(new THREE.TorusGeometry(1.3, 0.18, 8, 18, Math.PI), new THREE.MeshStandardMaterial({ map: T.stone(2), roughness: 0.8 }));
    arch.position.y = 1.3;
    const swirlMat = new THREE.MeshBasicMaterial({ color: idx ? 0xd0862a : 0x2a86d0, transparent: true, opacity: 0.55, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, depthWrite: false });
    const swirl = new THREE.Mesh(new THREE.CircleGeometry(1.1, 20), swirlMat);
    swirl.position.y = 1.25;
    g.add(arch, swirl);
    z.group.add(g);
    FXm.motes(z, { x0: p.x - 1, x1: p.x + 1, y0: 0.4, y1: 2.4, z0: p.z - 1, z1: p.z + 1, n: 10, color: idx ? 0xd0a62a : 0x5aa6ff, size: 15, speed: 0.5 });
    z.onUpdate((dt) => { swirl.rotation.z += dt * (idx ? -2 : 2); });
    return { ...p, idx };
  });
  // ---- 机关门 G1/G2 ----
  for (const gid of ['1', '2']) {
    const G = z['gate' + gid];
    if (!G) continue;
    const gm = put(z, 'wall_gated', G.x, 0, G.z, 0);
    const col = { min: new THREE.Vector3(G.x - 2 + z.offset.x, 0, G.z - 0.8 + z.offset.z), max: new THREE.Vector3(G.x + 2 + z.offset.x, 4, G.z + 0.8 + z.offset.z) };
    z.colliders.push(col);
    z['gateObj' + gid] = { mesh: gm, col, open: false };
  }
  // ---- 首领机关厅核心 ----
  if (z._mechCenter) {
    const c = z._mechCenter;
    const mg = new THREE.Group(); mg.position.set(c.x, 0, c.z);
    const ringMat = new THREE.MeshStandardMaterial({ map: T.stone(2), roughness: 0.7, metalness: 0.2 });
    const rings = [];
    for (let i = 0; i < 3; i++) {
      const r = new THREE.Mesh(new THREE.TorusGeometry(2.2 + i * 1.1, 0.22, 8, 26), ringMat);
      r.rotation.x = Math.PI / 2;
      r.position.y = 2.2 + i * 0.3;
      mg.add(r); rings.push(r);
    }
    const core = new THREE.Mesh(new THREE.IcosahedronGeometry(0.85, 1), new THREE.MeshStandardMaterial({ color: 0x30d8c0, emissive: 0x1a8a78, emissiveIntensity: 1.6, roughness: 0.2 }));
    core.position.y = 2.2;
    mg.add(core);
    const L = new THREE.PointLight(0x30d8c0, 16, 20, 2); L.position.y = 3; mg.add(L);
    z.group.add(mg);
    z._mech = { group: mg, rings, core, L, speed: 0.3 };
    z.onUpdate((dt) => {
      const sp = z._mech.speed;
      rings[0].rotation.z += dt * sp; rings[1].rotation.z -= dt * sp * 1.4; rings[2].rotation.z += dt * sp * 0.8;
      core.rotation.y += dt * 0.8;
      core.position.y = 2.2 + Math.sin(FXm.FX.time * 1.1) * 0.12;
    });
    FXm.motes(z, { x0: c.x - 3, x1: c.x + 3, y0: 0.5, y1: 4, z0: c.z - 3, z1: c.z + 3, n: 26, color: 0x40e8d0, size: 16, speed: 0.3, tex: T.star() });
  }
  // 出口
  z.addDoor(z._exitPos?.x ?? z.spawn.x + 8, z._exitPos?.z ?? z.spawn.z, 'stair', '离开密室 → 楼梯厅', '⬆');
  return z;
}

// ---------- 禁林 ----------
export function buildForest() {
  const z = new Zone('forest', '禁林', { ox: 2700, oz: 300, fog: { color: 0x050a06, density: 0.045 }, outdoor: true, ambient: 0x2a3a30, ambientI: 0.5, bgm: 'forest' });
  Z.forest = z;
  z.spawn.set(0, 0, 26);
  FXm.skyDome(z, 130, { minPhase: 0.78 }); // 禁林永远像深夜
  // 兜底暗色地面(挡住砖缝天空)
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(140, 140), new THREE.MeshStandardMaterial({ color: 0x17130d, roughness: 1 }));
  ground.rotation.x = -Math.PI / 2; ground.position.y = -0.07;
  ground.receiveShadow = true;
  z.group.add(ground);
  // 树冠微光,避免纯黑剪影
  const canopyFill = new THREE.DirectionalLight(0x3a5a4a, 0.5);
  canopyFill.position.set(10, 20, 10);
  z.group.add(canopyFill);
  // 地面
  const pl = [];
  for (let i = -8; i < 8; i++) for (let j = -8; j < 8; j++) {
    pl.push({ n: (i * 5 + j * 3) % 4 === 0 ? 'floor_dirt_small_weeds' : 'floor_dirt_large', x: i * TILE + 2, y: 0, z: j * TILE + 2 });
  }
  instBatch(z, pl);
  // 边界(树墙碰撞)
  z.addCollider(-34, -34, 34, -30, 8); z.addCollider(-34, 30, -2.5, 34, 8); z.addCollider(2.5, 30, 34, 34, 8);
  z.addCollider(-34, -34, -30, 34, 8); z.addCollider(30, -34, 34, 34, 8);

  // 扭曲树木(程序化,实例化两部分)
  const trunkGeo = new THREE.CylinderGeometry(0.28, 0.6, 6, 7);
  trunkGeo.translate(0, 3, 0);
  const pos = trunkGeo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const y = pos.getY(i);
    pos.setX(i, pos.getX(i) + Math.sin(y * 0.9) * 0.35 * (y / 6));
  }
  trunkGeo.computeVertexNormals();
  const trunkMat = new THREE.MeshStandardMaterial({ color: 0x2c241c, roughness: 1 });
  const canGeo = new THREE.ConeGeometry(2.2, 3.4, 7);
  const canMat = new THREE.MeshStandardMaterial({ color: 0x14251a, roughness: 1 });
  const N = 64;
  const trunks = new THREE.InstancedMesh(trunkGeo, trunkMat, N);
  const cans = new THREE.InstancedMesh(canGeo, canMat, N * 2);
  trunks.castShadow = cans.castShadow = true;
  const M = new THREE.Matrix4(), Q = new THREE.Quaternion(), V = new THREE.Vector3(), SC = new THREE.Vector3();
  let ci = 0;
  let rs = 7;
  const rr = () => (rs = (rs * 16807) % 2147483647) / 2147483647;
  const treePos = [];
  for (let i = 0; i < N; i++) {
    let x, zz, tries = 0;
    do { x = (rr() - 0.5) * 58; zz = (rr() - 0.5) * 58; tries++; } while (tries < 20 && (Math.hypot(x, zz) < 6 || (Math.abs(x) < 4 && zz > 8) || treePos.some((t) => Math.hypot(t[0] - x, t[1] - zz) < 5.5)));
    treePos.push([x, zz]);
    const s = 0.8 + rr() * 0.9;
    V.set(x, 0, zz); Q.setFromEuler(new THREE.Euler(0, rr() * 6.28, (rr() - 0.5) * 0.14)); SC.set(s, s * (0.9 + rr() * 0.5), s);
    M.compose(V, Q, SC); trunks.setMatrixAt(i, M);
    for (let k = 0; k < 2; k++) {
      V.set(x + (rr() - 0.5) * 1.2, 4.6 * s + k * 1.7 * s, zz + (rr() - 0.5) * 1.2);
      Q.setFromEuler(new THREE.Euler(0, rr() * 6.28, 0)); SC.setScalar(s * (1.15 - k * 0.3));
      M.compose(V, Q, SC); cans.setMatrixAt(ci++, M);
    }
    z.addCollider(x - 0.55, zz - 0.55, x + 0.55, zz + 0.55, 6);
  }
  cans.count = ci;
  z.group.add(trunks, cans);
  z._treePos = treePos;

  // 萤火虫
  FXm.motes(z, { x0: -28, x1: 28, y0: 0.4, y1: 3, z0: -28, z1: 28, n: 90, color: 0x9af06a, size: 16, speed: 0.16 });
  // 蘑菇圈祭坛
  const shrine = new THREE.Group(); shrine.position.set(-16, 0, -14);
  for (let i = 0; i < 7; i++) {
    const a = i / 7 * Math.PI * 2;
    const st = new THREE.Mesh(new THREE.BoxGeometry(0.7, 1.4 + (i % 3) * 0.5, 0.7), stoneMat());
    st.position.set(Math.cos(a) * 3, 0.7, Math.sin(a) * 3);
    st.rotation.y = a; st.castShadow = true;
    shrine.add(st);
  }
  const altar = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 1.1, 0.9, 8), stoneMat());
  altar.position.y = 0.45; shrine.add(altar);
  z.group.add(shrine);
  z.addCollider(-17, -15, -15, -13, 1.4);
  const shrineGlow = new THREE.PointLight(0x6ae0ff, 0, 12, 2);
  shrineGlow.position.set(-16, 2, -14);
  z.group.add(shrineGlow);
  z._shrineGlow = shrineGlow;

  // 月光 & 光柱
  const moon = new THREE.DirectionalLight(0x7a9ac8, 0.9);
  moon.position.set(-20, 36, -14); moon.castShadow = true;
  moon.shadow.mapSize.set(2048, 2048);
  moon.shadow.camera.left = -40; moon.shadow.camera.right = 40; moon.shadow.camera.top = 40; moon.shadow.camera.bottom = -40;
  z.group.add(moon, moon.target); z._sun = moon;
  FXm.lightShaft(z, 8, 4, -6, { h: 10, r: 3, color: 0x6a8ac8, tilt: 0.2, opacity: 0.08 });
  FXm.lightShaft(z, -10, 4, 8, { h: 9, r: 2.4, color: 0x6a8ac8, tilt: -0.25, opacity: 0.07 });
  FXm.rainFall(z, { x0: -30, x1: 30, z0: -30, z1: 30, n: 400 });

  // 采集点(状态由 gameplay 控制重生)
  z.gatherSpots = [
    { x: 12, z: -10, item: 'moonpetal', night: true, label: '月光花' },
    { x: -8, z: 14, item: 'moonpetal', night: true, label: '月光花' },
    { x: 20, z: 12, item: 'gnarl', label: '扭曲树根' },
    { x: -22, z: 6, item: 'gnarl', label: '扭曲树根' },
    { x: 6, z: -20, item: 'mushroom', label: '荧光菌' },
    { x: -6, z: -24, item: 'mushroom', label: '荧光菌' },
    { x: 16, z: 22, item: 'firefly', label: '捕捉萤火' },
    { x: -18, z: 20, item: 'firefly', label: '捕捉萤火' },
  ];
  z.spawnPoints = [
    { x: 14, z: -16 }, { x: -14, z: -8 }, { x: 22, z: 4 }, { x: -24, z: -18 }, { x: 0, z: -26 },
  ];
  z.addDoor(0, 30, 'courtyard', '返回 庭院', '🏰');
  return z;
}
