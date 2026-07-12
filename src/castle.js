// castle.js — 模块化城堡建造:房间生成/实例化/碰撞/区域管理
import * as THREE from 'three';
import { A } from './assets.js';
import { E } from './engine.js';

export const TILE = 4;
export const zones = new Map();
export let activeZone = null;
let _doorTex = null;

export class Zone {
  constructor(id, name, opts = {}) {
    this.id = id; this.name = name;
    this.group = new THREE.Group();
    this.group.visible = false;
    this.offset = new THREE.Vector3(opts.ox || 0, 0, opts.oz || 0);
    this.group.position.copy(this.offset);
    this.colliders = [];   // {min:Vector3, max:Vector3} 世界坐标(含offset)
    this.ramps = [];       // {x0,z0,x1,z1,y0,y1} 世界坐标, 沿主轴插值
    this.interact = [];    // {x,z,r,label,icon,cb,cond,id} 区域内坐标(本地)
    this.doors = [];
    this.updaters = [];
    this.fog = opts.fog || { color: 0x0a0810, density: 0.028 };
    this.ambient = opts.ambient ?? 0x2a2438;
    this.ambientI = opts.ambientI ?? 0.75;
    this.hemi = opts.hemi ?? null;
    this.outdoor = !!opts.outdoor;
    this.spawn = new THREE.Vector3(0, 0, 0);
    this.bgm = opts.bgm || 'academy';
    // 环境光(半球:天光+地面反弹) + 柔和补光
    const hemiCol = new THREE.Color(this.ambient).lerp(new THREE.Color(0xffffff), 0.22);
    const hemi = new THREE.HemisphereLight(hemiCol, 0x2a211a, this.ambientI * 3.6);
    hemi.position.set(0, 20, 0);
    this.group.add(hemi);
    this.hemiLight = hemi;
    if (!this.outdoor) {
      const fill = new THREE.DirectionalLight(0xffe2b8, this.ambientI * 0.55);
      fill.position.set(8, 18, 6);
      this.group.add(fill);
      this.fillLight = fill;
    }
    zones.set(id, this);
    E.scene.add(this.group);
  }
  // 本地转世界
  W(x, z) { return { x: x + this.offset.x, z: z + this.offset.z }; }
  addCollider(x0, z0, x1, z1, y1 = 4, y0 = 0) {
    const w = this.offset;
    this.colliders.push({ min: new THREE.Vector3(Math.min(x0, x1) + w.x, y0, Math.min(z0, z1) + w.z), max: new THREE.Vector3(Math.max(x0, x1) + w.x, y1, Math.max(z0, z1) + w.z) });
  }
  addRamp(x0, z0, x1, z1, y0, y1) {
    const w = this.offset;
    this.ramps.push({ x0: x0 + w.x, z0: z0 + w.z, x1: x1 + w.x, z1: z1 + w.z, y0, y1 });
  }
  addInteract(o) { this.interact.push(o); return o; }
  addDoor(x, z, to, label, icon = '🚪', spawnOverride = null, cond = null) {
    const d = { x, z, r: 2.2, label, icon, to, spawnOverride, cond, isDoor: true };
    this.doors.push(d); this.interact.push(d);
    this._addDoorGlow(x, z);
    return d;
  }
  _addDoorGlow(x, z) {
    // 发光门帘:遮住门洞外的虚空
    if (!_doorTex) {
      const c = document.createElement('canvas'); c.width = 128; c.height = 128;
      const g = c.getContext('2d');
      g.fillStyle = '#0a0805'; g.fillRect(0, 0, 128, 128);
      const grd = g.createRadialGradient(64, 108, 8, 64, 100, 92);
      grd.addColorStop(0, 'rgba(255,196,110,0.95)');
      grd.addColorStop(0.45, 'rgba(160,110,50,0.55)');
      grd.addColorStop(1, 'rgba(20,14,8,0)');
      g.fillStyle = grd; g.fillRect(0, 0, 128, 128);
      _doorTex = new THREE.CanvasTexture(c);
      _doorTex.colorSpace = THREE.SRGBColorSpace;
    }
    const mat = new THREE.MeshBasicMaterial({ map: _doorTex, fog: false });
    const m = new THREE.Mesh(new THREE.PlaneGeometry(8.6, 4.4), mat);
    const ang = Math.atan2(-x, -z);
    m.position.set(x - Math.sin(ang) * 0.2, 2.2, z - Math.cos(ang) * 0.2);
    m.rotation.y = ang;
    this.group.add(m);
    const L = new THREE.PointLight(0xffc478, 14, 10, 2);
    L.position.set(x + Math.sin(ang) * 1.6, 2.6, z + Math.cos(ang) * 1.6);
    this.group.add(L);
  }
  onUpdate(fn) { this.updaters.push(fn); }
}

// ---------- 道具放置 ----------
// 家具自动碰撞表:半宽x/半深z/高(按 ry 自动换轴)
const PROP_COLLIDERS = {
  table_long: [1.05, 2.05, 1.1], table_long_tablecloth: [1.05, 2.05, 1.1], table_long_tablecloth_decorated_A: [1.05, 2.05, 1.1],
  table_long_decorated_A: [1.05, 2.05, 1.1], table_long_decorated_C: [1.05, 2.05, 1.1], table_long_tablecloth_decorated_C: [1.05, 2.05, 1.1],
  table_medium: [1.15, 0.75, 1.05], table_medium_tablecloth: [1.15, 0.75, 1.05], table_medium_decorated_A: [1.15, 0.75, 1.05], table_medium_tablecloth_decorated_B: [1.15, 0.75, 1.05],
  table_small: [0.62, 0.62, 1.0], table_small_decorated_A: [0.62, 0.62, 1.0], table_small_decorated_B: [0.62, 0.62, 1.0],
  chair: [0.36, 0.36, 1.1], stool: [0.3, 0.3, 0.6],
  shelf_large: [1.02, 0.32, 0.5], shelf_small: [0.52, 0.3, 0.4], shelves: [1.0, 0.5, 2.0], shelf_small_candles: [0.52, 0.3, 0.4],
  bed_decorated: [1.35, 1.58, 1.4], bed_frame: [1.15, 1.5, 0.9], bed_floor: [1.0, 1.4, 0.5],
  trunk_large_A: [0.85, 0.55, 0.9], trunk_medium_A: [0.68, 0.45, 0.75], trunk_small_A: [0.5, 0.36, 0.6],
  box_small: [0.52, 0.52, 0.9], box_large: [0.85, 0.85, 1.4], box_small_decorated: [0.52, 0.52, 0.9], box_stacked: [0.9, 0.9, 1.8], crates_stacked: [0.9, 0.9, 1.6],
  barrel_large: [0.58, 0.58, 1.3], barrel_small: [0.42, 0.42, 0.9], barrel_large_decorated: [0.58, 0.58, 1.3], barrel_small_stack: [0.85, 0.85, 1.5],
  keg: [0.5, 0.5, 0.9], keg_decorated: [0.5, 0.5, 0.9],
  column: [0.36, 0.36, 1.4], pillar: [0.76, 0.76, 4], pillar_decorated: [0.76, 0.76, 4],
  rubble_large: [0.8, 0.8, 0.7],
};
function autoCollide(zone, n, x, z, ry = 0) {
  const c = PROP_COLLIDERS[n];
  if (!c) return;
  let [hx, hz, h] = c;
  if (Math.abs(Math.sin(ry || 0)) > 0.6) { const t = hx; hx = hz; hz = t; }
  zone.addCollider(x - hx, z - hz, x + hx, z + hz, h);
}

export function put(zone, name, x, y, z, ry = 0, s = 1, opts = {}) {
  const src = A.dungeon[name] || A.props[name];
  if (!src) { console.warn('缺道具', name); return null; }
  const m = src.clone(true);
  m.position.set(x, y, z); m.rotation.y = ry;
  if (s !== 1) m.scale.setScalar(s);
  zone.group.add(m);
  if (!opts.noCollide && (y || 0) < 0.5 && s >= 0.8) autoCollide(zone, name, x, z, ry);
  return m;
}
// 放置并加碰撞(按包围盒)
export function putSolid(zone, name, x, y, z, ry = 0, s = 1, shrink = 0.1) {
  const m = put(zone, name, x, y, z, ry, s);
  if (!m) return null;
  const box = new THREE.Box3().setFromObject(m);
  zone.colliders.push({ min: box.min.clone().add(zone.offset).addScalar(shrink), max: box.max.clone().add(zone.offset).addScalar(-shrink) });
  return m;
}

// ---------- 实例化批量放置 ----------
// placements: [{n:'wall', x,y,z, ry, s, noCollide}]
export function instBatch(zone, placements) {
  const byName = new Map();
  for (const p of placements) {
    if (!byName.has(p.n)) byName.set(p.n, []);
    byName.get(p.n).push(p);
    if (!p.noCollide && (p.y || 0) < 0.5 && (p.s || 1) >= 0.8) autoCollide(zone, p.n, p.x, p.z, p.ry);
  }
  for (const [name, list] of byName) {
    const src = A.dungeon[name];
    if (!src) { console.warn('缺模型', name); continue; }
    // 展平该 prop 的所有 mesh(带本地变换)
    const parts = [];
    src.updateMatrixWorld(true);
    src.traverse((o) => { if (o.isMesh) parts.push({ geo: o.geometry, mat: o.material, mtx: o.matrixWorld.clone() }); });
    for (const part of parts) {
      const im = new THREE.InstancedMesh(part.geo, part.mat, list.length);
      im.castShadow = true; im.receiveShadow = true;
      const M = new THREE.Matrix4(), T = new THREE.Matrix4();
      list.forEach((p, i) => {
        T.makeRotationY(p.ry || 0);
        T.setPosition(p.x, p.y || 0, p.z);
        if (p.s && p.s !== 1) T.multiply(new THREE.Matrix4().makeScale(p.s, p.s, p.s));
        M.copy(T).multiply(part.mtx);
        im.setMatrixAt(i, M);
      });
      im.instanceMatrix.needsUpdate = true;
      zone.group.add(im);
    }
  }
}

// ---------- 房间生成器 ----------
// 2×2 的小地砖在 4 格网格中需要铺 4 块
const SMALL_FLOORS = new Set(['floor_tile_small', 'floor_tile_small_decorated', 'floor_tile_small_broken_A', 'floor_tile_small_weeds_A', 'floor_tile_small_corner', 'floor_dirt_small_weeds', 'floor_dirt_small_A', 'floor_wood_small', 'floor_wood_small_dark']);
export function pushFloor(pl, name, x, z) {
  if (SMALL_FLOORS.has(name)) {
    pl.push({ n: name, x: x - 1, y: 0, z: z - 1 }, { n: name, x: x + 1, y: 0, z: z - 1 }, { n: name, x: x - 1, y: 0, z: z + 1 }, { n: name, x: x + 1, y: 0, z: z + 1 });
  } else pl.push({ n: name, x, y: 0, z });
}
// opts: {x,z 中心, w,d 半宽半深(格数), floor:'floor_tile_large', wallPattern:(side,i)=>name|null, wallH:层数, doors:[{side:0N/1E/2S/3W, i}], corners:true}
export function room(zone, o) {
  const pl = [];
  const W = o.w, D = o.d;
  const cx = o.x || 0, cz = o.z || 0;
  const floorName = o.floor || 'floor_tile_large';
  for (let i = -W; i < W; i++) for (let j = -D; j < D; j++) {
    pushFloor(pl, o.floorPick ? o.floorPick(i, j) : floorName, cx + i * TILE + TILE / 2, cz + j * TILE + TILE / 2);
  }
  const layers = o.wallH || 1;
  const doorSet = new Set((o.doors || []).map((d) => d.side + ':' + d.i));
  // side: 0=北(z-), 1=东(x+), 2=南(z+), 3=西(x-)
  for (let L = 0; L < layers; L++) {
    const y = L * 4;
    for (let i = -W; i < W; i++) {
      // 北墙
      if (!(L === 0 && doorSet.has('0:' + i))) {
        const n = o.wallPattern ? o.wallPattern(0, i, L) : 'wall';
        if (n) pl.push({ n, x: cx + i * TILE + TILE / 2, y, z: cz - D * TILE + 0.5, ry: 0 });
      }
      // 南墙
      if (!(L === 0 && doorSet.has('2:' + i))) {
        const n = o.wallPattern ? o.wallPattern(2, i, L) : 'wall';
        if (n) pl.push({ n, x: cx + i * TILE + TILE / 2, y, z: cz + D * TILE - 0.5, ry: Math.PI });
      }
    }
    for (let j = -D; j < D; j++) {
      // 西墙
      if (!(L === 0 && doorSet.has('3:' + j))) {
        const n = o.wallPattern ? o.wallPattern(3, j, L) : 'wall';
        if (n) pl.push({ n, x: cx - W * TILE + 0.5, y, z: cz + j * TILE + TILE / 2, ry: Math.PI / 2 });
      }
      // 东墙
      if (!(L === 0 && doorSet.has('1:' + j))) {
        const n = o.wallPattern ? o.wallPattern(1, j, L) : 'wall';
        if (n) pl.push({ n, x: cx + W * TILE - 0.5, y, z: cz + j * TILE + TILE / 2, ry: -Math.PI / 2 });
      }
    }
  }
  instBatch(zone, pl);
  // 碰撞:四边整墙,门洞留缝
  const w2 = W * TILE, d2 = D * TILE, t = 1.2;
  const gaps = { 0: [], 1: [], 2: [], 3: [] };
  for (const d of o.doors || []) gaps[d.side].push(d.i);
  const strip = (side) => {
    const g = gaps[side].sort((a, b) => a - b);
    const lim = side === 0 || side === 2 ? W : D;
    let start = -lim;
    const segs = [];
    for (const gi of g) { if (gi > start) segs.push([start, gi]); start = gi + 1; }
    if (start < lim) segs.push([start, lim]);
    for (const [a, b] of segs) {
      const p0 = a * TILE, p1 = b * TILE;
      if (side === 0) zone.addCollider(cx + p0, cz - d2 - t, cx + p1, cz - d2 + t);
      if (side === 2) zone.addCollider(cx + p0, cz + d2 - t, cx + p1, cz + d2 + t);
      if (side === 3) zone.addCollider(cx - w2 - t, cz + p0, cx - w2 + t, cz + p1);
      if (side === 1) zone.addCollider(cx + w2 - t, cz + p0, cx + w2 + t, cz + p1);
    }
  };
  strip(0); strip(1); strip(2); strip(3);
  return { cx, cz, w: w2, d: d2 };
}

// ---------- 区域切换 ----------
let _fogCache = {};
export function setZone(id) {
  const z = zones.get(id);
  if (!z) return;
  if (activeZone) activeZone.group.visible = false;
  activeZone = z;
  z.group.visible = true;
  if (!_fogCache[id]) _fogCache[id] = new THREE.FogExp2(z.fog.color, z.fog.density);
  E.scene.fog = _fogCache[id];
  E.scene.background = new THREE.Color(z.fog.color);
  dispatchEvent(new CustomEvent('hg-zone', { detail: id }));
}

// ---------- 物理 ----------
const _v = new THREE.Vector3();
export function collide(pos, radius) {
  if (!activeZone) return;
  for (const c of activeZone.colliders) {
    // 圆 vs AABB (XZ 平面), 仅当高度重叠
    if (pos.y > c.max.y || pos.y + 1.6 < c.min.y) continue;
    const nx = Math.max(c.min.x, Math.min(pos.x, c.max.x));
    const nz = Math.max(c.min.z, Math.min(pos.z, c.max.z));
    const dx = pos.x - nx, dz = pos.z - nz;
    const d2 = dx * dx + dz * dz;
    if (d2 < radius * radius) {
      if (d2 < 1e-8) {
        // 在盒内:推向最近边
        const l = pos.x - c.min.x, r = c.max.x - pos.x, u = pos.z - c.min.z, dn = c.max.z - pos.z;
        const m = Math.min(l, r, u, dn);
        if (m === l) pos.x = c.min.x - radius; else if (m === r) pos.x = c.max.x + radius;
        else if (m === u) pos.z = c.min.z - radius; else pos.z = c.max.z + radius;
      } else {
        const d = Math.sqrt(d2);
        pos.x = nx + (dx / d) * radius;
        pos.z = nz + (dz / d) * radius;
      }
    }
  }
}
export function floorAt(x, z, refY = Infinity) {
  if (!activeZone) return 0;
  // 收集所有覆盖此点的坡道高度;优先选不超过"当前高度+台阶容差"的最高层(螺旋楼梯上下圈不串层)
  let best = 0, bestBelow = -1, minY = Infinity, any = false;
  for (const r of activeZone.ramps) {
    if (x >= Math.min(r.x0, r.x1) - 0.4 && x <= Math.max(r.x0, r.x1) + 0.4 && z >= Math.min(r.z0, r.z1) - 0.4 && z <= Math.max(r.z0, r.z1) + 0.4) {
      const dx = r.x1 - r.x0, dz = r.z1 - r.z0;
      const len2 = dx * dx + dz * dz;
      let t = len2 > 0 ? ((x - r.x0) * dx + (z - r.z0) * dz) / len2 : 0;
      t = Math.max(0, Math.min(1, t));
      const y = r.y0 + (r.y1 - r.y0) * t;
      any = true;
      minY = Math.min(minY, y);
      if (y <= refY + 0.62 && y > bestBelow) bestBelow = y;
    }
  }
  if (!any) return 0;
  if (bestBelow >= 0) return bestBelow;
  return Math.max(0, minY === Infinity ? 0 : Math.min(minY, refY)); // 全在上方:落回地面/最低层
}
