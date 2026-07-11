// player.js — 玩家控制器与第三人称相机
import * as THREE from 'three';
import { E } from './engine.js';
import { Input, moveVec, pressed, down } from './input.js';
import { Rig } from './rig.js';
import { S, emit } from './state.js';
import { activeZone, collide, floorAt, setZone, zones } from './castle.js';
import { HOUSES, HAIR_COLORS, SKINS } from './data.js';
import { castCircle } from './fx.js';

export const P = {
  rig: null, pos: new THREE.Vector3(0, 0, 24),
  yaw: 0, camYaw: 0, camPitch: 0.32, camDist: 5.2,
  vel: new THREE.Vector3(), speed: 0,
  state: 'normal', // normal | dodge | cast | sit | talk | duel | dead | decor
  dodgeT: 0, iframe: 0, castT: 0,
  nearInteract: null,
  shield: false, shieldT: 0,
  sneaking: false,
  moveLocked: false,
  onAction: null, // gameplay 注入的交互回调
};

export function createPlayerRig() {
  if (P.rig) { P.rig.dispose(); }
  const h = HOUSES[S.house];
  P.rig = new Rig(S.body, {
    tint: h.color,
    skin: SKINS[S.skin],
    hair: S.hair, hairColor: HAIR_COLORS[S.hairColor],
    hand: 'wand',
    shadow: true,
  });
  E.scene.add(P.rig.group);
  return P.rig;
}

export function teleport(zoneId, x, z, yaw = null) {
  setZone(zoneId);
  const zn = zones.get(zoneId);
  if (x == null) { x = zn.spawn.x; z = zn.spawn.z; }
  P.pos.set(x + zn.offset.x, 0, z + zn.offset.z);
  P.pos.y = floorAt(P.pos.x, P.pos.z);
  if (yaw == null) yaw = zn.spawnYaw ?? Math.atan2(-x, -z); // 默认面向区域中心
  P.yaw = yaw; P.camYaw = yaw;
  S.zone = zoneId;
  P.rig.group.position.copy(P.pos);
  P.rig.group.rotation.y = P.yaw;
  snapCamera();
  emit('zone', zoneId);
}

// 立即把相机放到玩家身后(避免穿墙/慢速过渡)
export function snapCamera() {
  const head = P.pos.clone(); head.y += 1.62;
  const cd = P.camDist;
  const target = new THREE.Vector3(
    head.x - Math.sin(P.camYaw) * Math.cos(P.camPitch) * cd,
    head.y + Math.sin(P.camPitch) * cd,
    head.z - Math.cos(P.camYaw) * Math.cos(P.camPitch) * cd);
  let free = target;
  for (let t = 0.2; t <= 1; t += 0.1) {
    const pt = head.clone().lerp(target, t);
    if (pointBlocked(pt)) { free = head.clone().lerp(target, Math.max(0.12, t - 0.12)); break; }
  }
  E.camera.position.copy(free);
  E.camera.lookAt(head);
}

// 进门:去目的区域中"回来的门"位置
export function throughDoor(door) {
  const dest = zones.get(door.to);
  if (!dest) return;
  let sx = dest.spawn.x, sz = dest.spawn.z, yaw = null;
  const back = dest.doors.find((d) => d.to === activeZone?.id);
  if (door.spawnOverride) { sx = door.spawnOverride.x; sz = door.spawnOverride.z; }
  else if (back) {
    // 从回门位置向区域中心推进 3m
    const cx2 = 0, cz2 = 0;
    const dx = cx2 - back.x, dz = cz2 - back.z;
    const m = Math.hypot(dx, dz) || 1;
    sx = back.x + (dx / m) * 3.2; sz = back.z + (dz / m) * 3.2;
    yaw = Math.atan2(dx, dz);
  }
  fadeTransition(() => {
    teleport(door.to, sx, sz, yaw);
  });
}

let _fading = false;
export function fadeTransition(mid, dur = 420) {
  if (_fading) return;
  _fading = true;
  const f = document.getElementById('fader');
  f.style.transition = `opacity ${dur}ms`;
  f.style.opacity = '1';
  setTimeout(() => {
    mid?.();
    setTimeout(() => { f.style.opacity = '0'; _fading = false; }, 60);
  }, dur);
}

const WALK = 2.3, RUN = 5.4, SNEAK = 1.4;
const _fwd = new THREE.Vector3(), _rt = new THREE.Vector3(), _mv = new THREE.Vector3();

export function updatePlayer(dt) {
  const rig = P.rig;
  if (!rig || !activeZone) return;

  // 相机输入
  if (Input.enabled && !P.moveLocked) {
    P.camYaw -= Input.mouseDX * 0.0026;
    P.camPitch = THREE.MathUtils.clamp(P.camPitch + Input.mouseDY * 0.002, -0.5, 1.15);
    P.camDist = THREE.MathUtils.clamp(P.camDist + Input.wheel * 0.55, 2.4, 9);
  }

  if (P.iframe > 0) P.iframe -= dt;
  // 法力自然回复
  if (S.mp < S.mpMax) { S.mp = Math.min(S.mpMax, S.mp + dt * (S.learned?.mpRegen ? 2.4 : 1.15)); if ((P._mpT = (P._mpT || 0) + dt) > 1) { P._mpT = 0; emit('hud'); } }

  const canMove = !P.moveLocked && (P.state === 'normal' || P.state === 'duel' || P.state === 'cast');
  const mv = canMove ? moveVec() : { x: 0, y: 0 };
  const hasMove = Math.hypot(mv.x, mv.y) > 0.08;

  // 翻滚
  if (canMove && P.state !== 'cast' && (pressed('Space') || pressed('V_dodge')) && P.dodgeCd <= 0) {
    P.state = 'dodge'; P.dodgeT = 0.42; P.iframe = 0.5; P.dodgeCd = 0.7;
    const dir = hasMove ? Math.atan2(mv.x, mv.y) + P.camYaw + Math.PI : P.yaw;
    P.dodgeDir = dir;
    const rel = hasMove ? 'F' : 'B';
    rig.play('dodge' + rel, { once: true, then: null, fade: 0.08 });
    emit('sfx', 'dodge');
  }
  P.dodgeCd = Math.max(0, (P.dodgeCd || 0) - dt);

  if (P.state === 'dodge') {
    P.dodgeT -= dt;
    const sp = 8.2 * Math.min(1, P.dodgeT / 0.42 + 0.35);
    P.pos.x += Math.sin(P.dodgeDir) * sp * dt;
    P.pos.z += Math.cos(P.dodgeDir) * sp * dt;
    P.yaw = P.dodgeDir;
    if (P.dodgeT <= 0) { P.state = 'normal'; rig.play('idle', { fade: 0.15 }); }
  } else if (canMove && hasMove) {
    P.sneaking = down('ShiftLeft') || down('ShiftRight');
    const spd = P.sneaking ? SNEAK : RUN;
    const dir = Math.atan2(mv.x, mv.y) + P.camYaw + Math.PI;
    let dyaw = ((dir - P.yaw + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
    P.yaw += dyaw * Math.min(1, dt * 11);
    P.speed = THREE.MathUtils.lerp(P.speed, spd * Math.min(1, Math.hypot(mv.x, mv.y) * 1.4), Math.min(1, dt * 8));
    P.pos.x += Math.sin(P.yaw) * P.speed * dt;
    P.pos.z += Math.cos(P.yaw) * P.speed * dt;
    if (P.state !== 'cast') rig.play(P.sneaking ? 'walk' : 'run', { fade: 0.18 });
    P._stepT = (P._stepT || 0) - dt;
    if (P._stepT <= 0) { P._stepT = P.sneaking ? 0.52 : 0.3; emit('sfx', 'step'); }
  } else {
    P.speed = THREE.MathUtils.lerp(P.speed, 0, Math.min(1, dt * 10));
    if (P.state === 'normal' && !rig._locked && rig.currentName !== 'idle' && rig.currentName !== 'idleB') {
      rig.play('idle', { fade: 0.22 });
    }
  }

  // 碰撞与地面
  collide(P.pos, 0.42);
  const fy = floorAt(P.pos.x, P.pos.z);
  P.pos.y += (fy - P.pos.y) * Math.min(1, dt * 12);

  rig.group.position.copy(P.pos);
  rig.group.rotation.y = P.yaw;

  // 相机(对话中交给对话运镜)
  if (!window.__dialogOpen) {
    const head = P.pos.clone(); head.y += 1.62;
  const cd = P.camDist;
  const cx = head.x - Math.sin(P.camYaw) * Math.cos(P.camPitch) * cd;
  const cz = head.z - Math.cos(P.camYaw) * Math.cos(P.camPitch) * cd;
  const cy = head.y + Math.sin(P.camPitch) * cd;
  const camTarget = new THREE.Vector3(cx, cy, cz);
  // 相机避墙:从头到相机步进检查
  let free = camTarget;
  for (let t = 0.25; t <= 1; t += 0.12) {
    const pt = head.clone().lerp(camTarget, t);
    if (pointBlocked(pt)) { free = head.clone().lerp(camTarget, Math.max(0.15, t - 0.14)); break; }
  }
  E.camera.position.lerp(free, Math.min(1, dt * 9));
  const look = head.clone();
  look.y += 0.1;
  E.camera.lookAt(look);
  }

  // 交互检测
  P.nearInteract = null;
  if (P.state === 'normal' || P.state === 'duel') {
    let best = null, bd = 1e9;
    for (const it of activeZone.interact) {
      if (it.needY != null && Math.abs(P.pos.y - it.needY) > 1.6) continue;
      const w = activeZone.W(it.x, it.z);
      const d = Math.hypot(P.pos.x - w.x, P.pos.z - w.z);
      if (d < (it.r || 2) && d < bd) { bd = d; best = it; }
    }
    P.nearInteract = best;
  }
}

function pointBlocked(pt) {
  if (!activeZone) return false;
  for (const c of activeZone.colliders) {
    if (pt.x > c.min.x && pt.x < c.max.x && pt.z > c.min.z && pt.z < c.max.z && pt.y > c.min.y && pt.y < c.max.y) return true;
  }
  return false;
}

// 施法动作(由 combat 调)
export function playCast(kind = 'castShoot', lockMove = 0.35) {
  const rig = P.rig;
  P.state = 'cast';
  P.castT = lockMove;
  rig.play(kind, { once: true, fade: 0.08, then: null, timeScale: 1.35 });
  castCircle(rig.group, { color: 0xc9a86a, r: 0.8 });
  setTimeout(() => { if (P.state === 'cast') { P.state = 'normal'; } }, lockMove * 1000);
}
