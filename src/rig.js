// rig.js — 角色工厂:克隆/校服着色/发型/手持道具/动画控制/头部注视/表情气泡
import * as THREE from 'three';
import { clone as skClone } from 'three/addons/utils/SkeletonUtils.js';
import { A, T } from './assets.js';

export const STANDARD_H = 1.78;
export const allRigs = new Set();

// 动画别名
export const ANIM = {
  idle: 'Idle', idleB: 'Idle_B', combat: 'Idle_Combat', unarmed: 'Unarmed_Idle',
  walk: 'Walking_A', walkB: 'Walking_C', back: 'Walking_Backwards',
  run: 'Running_A', runB: 'Running_B', strafeL: 'Running_Strafe_Left', strafeR: 'Running_Strafe_Right',
  castShoot: 'Spellcast_Shoot', castRaise: 'Spellcast_Raise', castLong: 'Spellcast_Long', castSummon: 'Spellcast_Summon', casting: 'Spellcasting',
  hitA: 'Hit_A', hitB: 'Hit_B', deathA: 'Death_A', deathB: 'Death_B',
  dodgeF: 'Dodge_Forward', dodgeB: 'Dodge_Backward', dodgeL: 'Dodge_Left', dodgeR: 'Dodge_Right',
  blockStart: 'Block', block: 'Blocking', blockHit: 'Block_Hit',
  cheer: 'Cheer', interact: 'Interact', use: 'Use_Item', pickup: 'PickUp', throwIt: 'Throw',
  sitDown: 'Sit_Chair_Down', sit: 'Sit_Chair_Idle', sitUp: 'Sit_Chair_StandUp',
  sitFloorDown: 'Sit_Floor_Down', sitFloor: 'Sit_Floor_Idle',
  lieDown: 'Lie_Down', lie: 'Lie_Idle', lieUp: 'Lie_StandUp',
  jumpStart: 'Jump_Start', jumpIdle: 'Jump_Idle', jumpLand: 'Jump_Land',
  taunt: 'Taunt', tauntLong: 'Taunt_Longer',
  awaken: 'Skeletons_Awaken_Standing', awakenFloor: 'Skeletons_Awaken_Floor_Long', inactive: 'Skeleton_Inactive_Standing_Pose',
  spawn: 'Spawn_Ground',
  melee1: '1H_Melee_Attack_Slice_Diagonal', melee2: '1H_Melee_Attack_Chop', melee3: '1H_Melee_Attack_Stab',
  melee2H: '2H_Melee_Attack_Spin', kick: 'Unarmed_Melee_Attack_Kick',
};

// 各基础模型的可选部件(按节点名显示/隐藏)
const PROP_NODES = ['Spellbook', 'Spellbook_open', '1H_Wand', '2H_Staff', '1H_Sword', '1H_Sword_Offhand', '2H_Sword',
  'Badge_Shield', 'Rectangle_Shield', 'Round_Shield', 'Spike_Shield', 'Knife', 'Knife_Offhand', '1H_Crossbow', '2H_Crossbow',
  'Throwable', 'Mug', '1H_Axe', '1H_Axe_Offhand', '2H_Axe', 'Barbarian_Round_Shield'];
const HAT_NODES = ['Mage_Hat', 'Barbarian_Hat', 'Knight_Helmet'];
const HAND_MAP = { wand: '1H_Wand', staff: '2H_Staff', book: 'Spellbook_open', bookClosed: 'Spellbook', sword: '1H_Sword', shield: 'Round_Shield', mug: 'Mug', knife: 'Knife' };

let _hairGeos = null;
// 灰度化身体贴图缓存(保留明暗,去除底色,便于学院色染色)
const _grayMaps = new Map();
function grayMap(tex) {
  if (!tex || !tex.image) return null;
  if (_grayMaps.has(tex.uuid)) return _grayMaps.get(tex.uuid);
  try {
    const img = tex.image;
    const c = document.createElement('canvas');
    c.width = img.width; c.height = img.height;
    const g = c.getContext('2d');
    g.drawImage(img, 0, 0);
    const d = g.getImageData(0, 0, c.width, c.height);
    const a = d.data;
    for (let i = 0; i < a.length; i += 4) {
      const l = a[i] * 0.299 + a[i + 1] * 0.587 + a[i + 2] * 0.114;
      const v = Math.min(255, l * 1.25 + 30);
      a[i] = v; a[i + 1] = v; a[i + 2] = v;
    }
    g.putImageData(d, 0, 0);
    const t2 = new THREE.CanvasTexture(c);
    t2.colorSpace = THREE.SRGBColorSpace;
    t2.flipY = tex.flipY;
    t2.wrapS = tex.wrapS; t2.wrapT = tex.wrapT;
    _grayMaps.set(tex.uuid, t2);
    return t2;
  } catch { return null; }
}
function hairGeos() {
  if (_hairGeos) return _hairGeos;
  const g = {};
  // 短发:半球壳(加深包裹)
  g.short = new THREE.SphereGeometry(0.34, 14, 9, 0, Math.PI * 2, 0, Math.PI * 0.64);
  g.short.scale(1, 0.92, 1.05);
  // 马尾:半球 + 后垂锥
  { const dome = new THREE.SphereGeometry(0.34, 14, 9, 0, Math.PI * 2, 0, Math.PI * 0.6); dome.scale(1, 0.9, 1.03);
    const tail = new THREE.ConeGeometry(0.13, 0.62, 8); tail.rotateX(Math.PI * 0.92); tail.translate(0, -0.16, -0.44);
    g.ponytail = mergeGeos([dome, tail]); }
  // 双辫
  { const dome = new THREE.SphereGeometry(0.34, 14, 9, 0, Math.PI * 2, 0, Math.PI * 0.6); dome.scale(1, 0.9, 1.02);
    const l = new THREE.CapsuleGeometry(0.09, 0.4, 3, 8); l.rotateZ(0.5); l.translate(-0.35, -0.3, -0.05);
    const r = new THREE.CapsuleGeometry(0.09, 0.4, 3, 8); r.rotateZ(-0.5); r.translate(0.35, -0.3, -0.05);
    g.twin = mergeGeos([dome, l, r]); }
  // 长发
  { const dome = new THREE.SphereGeometry(0.35, 14, 10, 0, Math.PI * 2, 0, Math.PI * 0.66);
    dome.scale(1, 0.98, 1.06);
    const back = new THREE.CylinderGeometry(0.3, 0.22, 0.55, 10, 1, true, Math.PI * 0.7, Math.PI * 1.6);
    back.translate(0, -0.34, -0.02);
    g.long = mergeGeos([dome, back]); }
  _hairGeos = g;
  return g;
}
function mergeGeos(list) {
  // 简易合并(仅 position/normal/uv) — 先统一为非索引
  const flat = list.map((ge) => (ge.index ? ge.toNonIndexed() : ge));
  let total = 0;
  for (const ge of flat) total += ge.attributes.position.count;
  const pos = new Float32Array(total * 3), nor = new Float32Array(total * 3), uv = new Float32Array(total * 2);
  let vo = 0;
  for (const g2 of flat) {
    const p = g2.attributes.position, n = g2.attributes.normal, u = g2.attributes.uv;
    pos.set(p.array, vo * 3); nor.set(n.array, vo * 3); if (u) uv.set(u.array, vo * 2);
    vo += p.count;
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  out.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  out.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  return out;
}

export class Rig {
  // opts: {tint, skin, hair, hairColor, hat, hand, ghost, scale, label, labelColor, capeTint, shadow}
  constructor(base, opts = {}) {
    const src = A.chars[base];
    if (!src) throw new Error('缺少角色模型 ' + base);
    this.base = base;
    this.group = new THREE.Group();
    this.model = skClone(src.scene);
    this.group.add(this.model);
    this.opts = opts;
    this.dead = false;
    this.bones = {};
    this.nodes = {};
    this._lookTarget = null;
    this._emoteT = 0;
    this.velY = 0;

    // 归一化身高
    const box = new THREE.Box3().setFromObject(this.model);
    const h = box.max.y - box.min.y || 1;
    const s = (STANDARD_H / h) * (opts.scale || 1);
    this.model.scale.setScalar(s);
    this.height = STANDARD_H * (opts.scale || 1);

    // 节点收集/部件显隐/材质克隆着色
    const tintCol = opts.tint != null ? new THREE.Color(opts.tint) : null;
    const skinCol = opts.skin != null ? new THREE.Color(opts.skin) : null;
    const matCache = new Map();
    const cloneMat = (m, col, mode) => {
      const key = m.uuid + '|' + (col ? col.getHexString() : '') + (mode || '');
      if (!matCache.has(key)) {
        const c = m.clone();
        if (col && mode === 'body') {
          // 学院袍:灰度底图 × 学院色
          const gm = grayMap(m.map);
          if (gm) c.map = gm;
          c.color.copy(col);
        } else if (col) {
          c.color.copy(col).lerp(new THREE.Color(1, 1, 1), 0.22);
        }
        if (opts.ghost) { c.transparent = true; c.opacity = 0.5; c.emissive = new THREE.Color(0x6a9ac8); c.emissiveIntensity = 0.55; c.depthWrite = false; }
        if (c.map) c.map.colorSpace = THREE.SRGBColorSpace;
        c.metalness = 0; c.roughness = 0.85;
        matCache.set(key, c);
      }
      return matCache.get(key);
    };
    this.model.traverse((o) => {
      if (o.isBone) this.bones[o.name] = o;
      if (o.name) this.nodes[o.name] = o;
      if (o.isMesh || o.isSkinnedMesh) {
        o.castShadow = opts.shadow !== false && !opts.ghost;
        o.receiveShadow = false;
        o.frustumCulled = false;
        const n = o.name, pn = o.parent?.name || '';
        const isBody = /_Body|_LegLeft|_LegRight|_Cape/.test(n) || /_Body|_LegLeft|_LegRight|_Cape/.test(pn);
        const isSkin = /_Head|_ArmLeft|_ArmRight/.test(n) || /_Head|_ArmLeft|_ArmRight/.test(pn);
        const isHat = HAT_NODES.some((x) => n.includes(x) || pn.includes(x));
        if (Array.isArray(o.material)) o.material = o.material.map((m) => cloneMat(m, isBody || isHat ? tintCol : isSkin ? skinCol : null, isBody || isHat ? 'body' : 'skin'));
        else if (o.material?.name === 'Glow') { const g = o.material.clone(); g.emissive = new THREE.Color(opts.glowColor ?? 0x9ae0ff); g.emissiveIntensity = 2.2; o.material = g; }
        else o.material = cloneMat(o.material, isBody || isHat ? tintCol : isSkin ? skinCol : null, isBody || isHat ? 'body' : 'skin');
      }
    });
    // 隐藏所有内置道具
    for (const p of PROP_NODES) { const nd = this.findNode(p); if (nd) nd.visible = false; }
    // 帽子
    for (const hn of HAT_NODES) { const nd = this.findNode(hn); if (nd) nd.visible = !!opts.hat; }
    this.setHand(opts.hand || null);

    // 发型
    if (opts.hair && opts.hair !== 'none' && !opts.hat) this.addHair(opts.hair, opts.hairColor ?? 0x4a3018);

    // 动画
    this.mixer = new THREE.AnimationMixer(this.model);
    this.actions = {};
    for (const clip of src.animations) this.actions[clip.name] = this.mixer.clipAction(clip);
    this.current = null;
    this.play('idle');

    // 名牌
    if (opts.label) this.addLabel(opts.label, opts.labelColor || '#efe6d0');

    // 幽灵浮动
    this.ghost = !!opts.ghost;
    allRigs.add(this);
  }

  findNode(name) {
    if (this.nodes[name]) return this.nodes[name];
    let found = null;
    this.model.traverse((o) => { if (!found && o.name === name) found = o; });
    return found;
  }
  get headBone() { return this.bones['head']; }
  get handR() { return this.bones['handslot.r'] || this.bones['hand.r']; }

  addHair(style, color) {
    const geo = hairGeos()[style];
    if (!geo || !this.headBone) return;
    const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.6, metalness: 0.05 });
    const m = new THREE.Mesh(geo, mat);
    m.castShadow = true;
    // head 骨骼空间:发壳要足够大,罩住贴图上画的头发
    const headWorldScale = new THREE.Vector3();
    this.headBone.getWorldScale(headWorldScale);
    const invS = 1 / (headWorldScale.y || 1) * this.model.scale.y;
    // 按 KayKit 大头身实测:头宽~0.64,发壳需半径~0.37 包住头皮
    m.scale.setScalar(invS * 1.8);
    m.position.set(0, 0.5 * invS, -0.09 * invS);
    m.rotation.x = -0.24; // 前沿上抬,露出脸
    this.hairMesh = m;
    this.headBone.add(m);
  }

  setHand(kind) {
    // 先藏
    for (const p of PROP_NODES) { const nd = this.findNode(p); if (nd) nd.visible = false; }
    this.handKind = kind;
    if (!kind) return;
    const nodeName = HAND_MAP[kind] || kind;
    let nd = this.findNode(nodeName);
    if (nd) { nd.visible = true; return; }
    // 本体没有 → 从其他角色借(挂到手骨)
    const donorMap = { wand: 'Mage', staff: 'Mage', book: 'Mage', bookClosed: 'Mage', sword: 'Knight', shield: 'Knight', mug: 'Barbarian' };
    const donor = A.chars[donorMap[kind] || 'Mage'];
    if (!donor || !this.handR) return;
    let dn = null;
    donor.scene.traverse((o) => { if (!dn && o.name === nodeName) dn = o; });
    if (!dn) return;
    const cl = dn.clone(true);
    cl.visible = true;
    cl.traverse((o) => { if (o.isMesh) { o.visible = true; o.castShadow = true; } });
    cl.position.set(0, 0, 0); cl.rotation.set(0, 0, 0);
    this.handR.add(cl);
    this._borrowed = cl;
  }

  addLabel(text, color) {
    const c = document.createElement('canvas'); c.width = 256; c.height = 64;
    const g = c.getContext('2d');
    g.font = '30px XiaoWei, Songti SC, serif';
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.shadowColor = 'rgba(0,0,0,.9)'; g.shadowBlur = 6;
    g.fillStyle = color; g.fillText(text, 128, 34);
    const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false }));
    sp.scale.set(1.5, 0.375, 1);
    sp.position.y = this.height + 0.42;
    this.label = sp;
    this.group.add(sp);
  }

  emote(icon, dur = 2.2) {
    if (this._emoteSp) { this.group.remove(this._emoteSp); this._emoteSp.material.map.dispose(); this._emoteSp.material.dispose(); }
    const c = document.createElement('canvas'); c.width = 96; c.height = 96;
    const g = c.getContext('2d');
    g.font = '64px serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.beginPath(); g.arc(48, 48, 44, 0, 7); g.fillStyle = 'rgba(20,16,10,.78)'; g.fill();
    g.strokeStyle = 'rgba(240,217,168,.8)'; g.lineWidth = 3; g.stroke();
    g.fillText(icon, 48, 54);
    const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false }));
    sp.scale.set(0.55, 0.55, 1);
    sp.position.y = this.height + (this.label ? 0.85 : 0.5);
    this.group.add(sp);
    this._emoteSp = sp; this._emoteT = dur;
  }

  // 播放动画
  play(name, o = {}) {
    const clipName = ANIM[name] || name;
    const act = this.actions[clipName];
    if (!act || this._locked) return null;
    if (this.currentName === name && !o.force) return act;
    const prev = this.current;
    act.reset();
    act.timeScale = o.timeScale || 1;
    if (o.once) {
      act.setLoop(THREE.LoopOnce, 1); act.clampWhenFinished = true;
      if (o.lock) this._locked = true;
      const dur = act.getClip().duration / act.timeScale;
      clearTimeout(this._onceT);
      this._onceT = setTimeout(() => {
        this._locked = false;
        if (o.cb) o.cb();
        if (o.then !== null) this.play(o.then || 'idle', { fade: 0.25 });
      }, Math.max(50, dur * 1000 - 60));
    } else act.setLoop(THREE.LoopRepeat, Infinity);
    act.play();
    if (prev && prev !== act) prev.crossFadeTo(act, o.fade ?? 0.22, false);
    else if (!prev) act.fadeIn(o.fade ?? 0.12);
    this.current = act; this.currentName = name;
    return act;
  }
  stopLock() { this._locked = false; clearTimeout(this._onceT); }

  setLookTarget(v) { this._lookTarget = v; }

  update(dt, time = 0) {
    if (this.dead) { this.mixer.update(dt); return; }
    this.mixer.update(dt);
    // 头部注视
    if (this._lookTarget && this.headBone) {
      const hb = this.headBone;
      const wp = new THREE.Vector3(); hb.getWorldPosition(wp);
      const dir = this._lookTarget.clone().sub(wp);
      const yawTo = Math.atan2(dir.x, dir.z) - this.group.rotation.y;
      let d = ((yawTo + Math.PI) % (Math.PI * 2)) - Math.PI;
      if (Math.abs(d) < Math.PI * 0.5) {
        this._lookYaw = THREE.MathUtils.lerp(this._lookYaw || 0, THREE.MathUtils.clamp(d, -0.8, 0.8), Math.min(1, dt * 6));
      } else this._lookYaw = THREE.MathUtils.lerp(this._lookYaw || 0, 0, Math.min(1, dt * 6));
      hb.rotation.y += this._lookYaw;
    } else if (this._lookYaw && this.headBone) {
      this._lookYaw = THREE.MathUtils.lerp(this._lookYaw, 0, Math.min(1, dt * 6));
      this.headBone.rotation.y += this._lookYaw;
    }
    // 幽灵浮动
    if (this.ghost) this.model.position.y = 0.25 + Math.sin(time * 1.4 + (this._ghostSeed ??= Math.random() * 9)) * 0.09;
    // 头发动态(随移动/时间轻摆)
    if (this.hairMesh) {
      const wp = this.group.position;
      const v = this._lastPos ? Math.hypot(wp.x - this._lastPos.x, wp.z - this._lastPos.z) / Math.max(dt, 0.001) : 0;
      this._lastPos = this._lastPos || wp.clone();
      this._lastPos.copy(wp);
      this._hairSway = THREE.MathUtils.lerp(this._hairSway || 0, Math.min(0.3, v * 0.05), Math.min(1, dt * 5));
      this.hairMesh.rotation.x = this._hairSway + Math.sin(time * 2.2 + (this._ghostSeed ??= Math.random() * 9)) * 0.035;
      this.hairMesh.rotation.z = Math.sin(time * 1.7) * 0.028;
    }
    // 表情气泡
    if (this._emoteSp) {
      this._emoteT -= dt;
      this._emoteSp.position.y = this.height + (this.label ? 0.85 : 0.5) + Math.sin(time * 3) * 0.03;
      if (this._emoteT <= 0) { this.group.remove(this._emoteSp); this._emoteSp = null; }
    }
  }

  dispose() {
    allRigs.delete(this);
    clearTimeout(this._onceT);
    this.group.parent?.remove(this.group);
  }
}
