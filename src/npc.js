// npc.js — NPC:作息调度/行为/对话入口
import * as THREE from 'three';
import { NPCS, CLASSES, WEEK_SCHEDULE } from './data.js';
import { Rig } from './rig.js';
import { S, on, affTier } from './state.js';
import { zones, activeZone } from './castle.js';
import { P } from './player.js';
import { HAIR_COLORS } from './data.js';
import { FX } from './fx.js';

export const npcs = new Map(); // id -> npc obj

function currentClass() {
  const [am, pm] = WEEK_SCHEDULE[S.day % 7];
  if (S.phase === 1) return am;
  if (S.phase === 2) return pm;
  return null;
}

// 计算 NPC 此刻应该在哪
function targetFor(def, id) {
  const phase = ['dawn', 'morning', 'noon', 'dusk', 'night', 'late'][S.phase];
  let loc = def.sched[phase];
  if (loc === 'class') {
    const cls = currentClass();
    if (cls) {
      const c = CLASSES[cls];
      // 学生坐在教室后排随机位
      const seed = (id.charCodeAt(0) * 7 + id.length * 13) % 10;
      const seatX = (seed % 5 - 2) * 2.2, seatZ = 2 + Math.floor(seed / 5) * 3;
      if (c.zone === 'hall') return { zone: 'hall', x: seatX * 2, z: -6 + seatZ };
      if (c.zone === 'stair') return { zone: 'stair', x: seatX, z: -2 + seatZ };
      if (c.zone === 'greenhouse') return { zone: 'greenhouse', x: seatX, z: seatZ };
      if (c.zone === 'astro') return { zone: 'astro', x: seatX * 0.8, z: 2 + seatZ * 0.6 };
      return { zone: c.zone, x: seatX, z: 2 + seatZ };
    }
    // 没课 → 大厅闲逛
    return { zone: 'hall', x: (id.length % 5 - 2) * 4, z: 4 + (id.charCodeAt(1) % 4) * 3 };
  }
  if (!loc) return null; // 回房休息(隐藏)
  const [zone, x, z] = loc;
  if (zone === 'dungeonDoor') return { zone: 'stair', x: -20, z: 16 };
  return { zone, x, z };
}

export function initNPCs() {
  for (const [id, def] of Object.entries(NPCS)) {
    const npc = { id, def, rig: null, zone: null, pos: new THREE.Vector3(), target: null, walkT: 0, state: 'idle', chatCd: 0 };
    npcs.set(id, npc);
  }
  on('phase', () => relocateAll(false));
  on('gamestart', () => relocateAll(true));
  addEventListener('hg-zone', () => relocateAll(true));
  relocateAll(true);
}

function ensureRig(npc) {
  if (npc.rig) return npc.rig;
  const m = npc.def.model;
  npc.rig = new Rig(m.base, {
    tint: m.tint, skin: m.skin, hair: m.hair, hairColor: m.hairColor,
    hat: m.hat, hand: m.hand === 'staff' ? 'staff' : m.hand === 'spellbook_open' ? null : m.hand,
    ghost: m.ghost, scale: m.scale || (npc.def.role?.includes('二年级') ? 0.92 : 1),
    label: npc.def.name, labelColor: npc.def.house ? undefined : '#cfe0f0',
  });
  if (m.hand === 'spellbook_open') npc.rig.setHand('book');
  return npc.rig;
}

// 把所有 NPC 放到它们该在的位置(即时)
export function relocateAll(instant = true) {
  for (const npc of npcs.values()) {
    // 同伴:跟随玩家所在区域
    if (S.companion === npc.id) {
      const zn = zones.get(S.zone);
      if (zn) {
        ensureRig(npc);
        npc.rig.group.visible = true;
        if (npc.rig.group.parent !== zn.group) zn.group.add(npc.rig.group);
        if (npc.zone !== S.zone) {
          npc.rig.group.position.set(P.pos.x - zn.offset.x + 1.2, 0, P.pos.z - zn.offset.z + 1.2);
        }
        npc.zone = S.zone;
        npc.target = null;
      }
      continue;
    }
    const t = targetFor(npc.def, npc.id);
    if (!t) { // 隐退
      if (npc.rig) { npc.rig.group.visible = false; }
      npc.zone = null;
      continue;
    }
    const zn = zones.get(t.zone);
    if (!zn) continue;
    ensureRig(npc);
    npc.rig.group.visible = true;
    if (npc.zone !== t.zone || instant) {
      // 直接换区域
      if (npc.rig.group.parent !== zn.group) zn.group.add(npc.rig.group);
      npc.rig.group.position.set(t.x, 0, t.z);
      npc.zone = t.zone;
      npc.target = null;
      npc.rig.play(npc.def.ghost ? 'idleB' : 'idle');
    } else {
      // 同区域 → 走过去
      npc.target = t;
    }
  }
}

export function npcsInActiveZone() {
  const out = [];
  if (!activeZone) return out;
  for (const npc of npcs.values()) if (npc.zone === activeZone.id && npc.rig?.group.visible) out.push(npc);
  return out;
}

export function nearestTalkable(maxD = 2.4) {
  let best = null, bd = maxD;
  for (const npc of npcsInActiveZone()) {
    const wp = new THREE.Vector3();
    npc.rig.group.getWorldPosition(wp);
    const d = Math.hypot(wp.x - P.pos.x, wp.z - P.pos.z);
    if (d < bd) { bd = d; best = npc; }
  }
  return best;
}

const _wp = new THREE.Vector3();
export function updateNPCs(dt) {
  if (!activeZone) return;
  const t = FX.time;
  for (const npc of npcs.values()) {
    if (npc.zone !== activeZone.id || !npc.rig) continue;
    const rig = npc.rig;
    rig.group.getWorldPosition(_wp);
    const dToPlayer = Math.hypot(_wp.x - P.pos.x, _wp.z - P.pos.z);

    // 对话中:面向玩家
    if (npc.state === 'talk') {
      const dir = Math.atan2(P.pos.x - _wp.x, P.pos.z - _wp.z);
      rig.group.rotation.y += (((dir - rig.group.rotation.y + Math.PI * 3) % (Math.PI * 2)) - Math.PI) * Math.min(1, dt * 8);
      rig.setLookTarget(P.pos.clone().setY(P.pos.y + 1.55));
      continue;
    }

    // 同伴跟随
    if (S.companion === npc.id && npc.state !== 'duel') {
      const zn = zones.get(npc.zone);
      const tx = P.pos.x - zn.offset.x - Math.sin(P.yaw) * 1.6 - Math.cos(P.yaw) * 0.9;
      const tz = P.pos.z - zn.offset.z - Math.cos(P.yaw) * 1.6 + Math.sin(P.yaw) * 0.9;
      const dx = tx - rig.group.position.x, dz = tz - rig.group.position.z;
      const d = Math.hypot(dx, dz);
      if (d > 0.6) {
        const dir = Math.atan2(dx, dz);
        rig.group.rotation.y += (((dir - rig.group.rotation.y + Math.PI * 3) % (Math.PI * 2)) - Math.PI) * Math.min(1, dt * 7);
        const sp = d > 5 ? 5.2 : 2.4;
        rig.group.position.x += Math.sin(dir) * sp * dt;
        rig.group.position.z += Math.cos(dir) * sp * dt;
        if (rig.currentName !== (sp > 3 ? 'run' : 'walk') && !rig._locked) rig.play(sp > 3 ? 'run' : 'walk');
      } else if (!rig._locked && rig.currentName !== 'idle') rig.play('idle');
      rig.setLookTarget(dToPlayer < 6 ? P.pos.clone().setY(P.pos.y + 1.55) : null);
      continue;
    }

    // 走向目标
    if (npc.target) {
      const dx = npc.target.x - rig.group.position.x, dz = npc.target.z - rig.group.position.z;
      const d = Math.hypot(dx, dz);
      if (d > 0.4) {
        const dir = Math.atan2(dx, dz);
        rig.group.rotation.y += (((dir - rig.group.rotation.y + Math.PI * 3) % (Math.PI * 2)) - Math.PI) * Math.min(1, dt * 6);
        rig.group.position.x += Math.sin(dir) * 1.9 * dt;
        rig.group.position.z += Math.cos(dir) * 1.9 * dt;
        if (rig.currentName !== 'walk') rig.play('walk');
        continue;
      } else { npc.target = null; rig.play('idle'); }
    }

    // 行为:教师授课姿态 / 学生看书 / 幽灵飘 / 商贩打招呼
    npc.behaveT = (npc.behaveT || 0) - dt;
    if (npc.behaveT <= 0) {
      npc.behaveT = 4 + Math.random() * 6;
      const roll = Math.random();
      if (npc.def.ghost) {
        if (roll < 0.4) rig.play('idleB'); else rig.play('idle');
      } else if (npc.id === 'vera' && npc.zone === 'library') {
        rig.play(roll < 0.6 ? 'sitFloor' : 'idle');
        if (roll < 0.6) rig.setHand('book');
      } else if (S.phase === 1 || S.phase === 2) {
        const cls = currentClass();
        if (cls && CLASSES[cls].teacher === npc.id) {
          rig.play(roll < 0.5 ? 'castRaise' : 'interact', { once: true, then: 'idle' });
        } else if (npc.def.companion) {
          rig.play('sitFloor');
        }
      } else if (roll < 0.18) {
        rig.play('idleB', { once: true, then: 'idle' });
      } else if (roll < 0.28 && npc.def.shop) {
        rig.play('cheer', { once: true, then: 'idle' });
        rig.emote('🧦');
      }
    }
    // 注视玩家
    if (dToPlayer < 5 && !rig.currentName?.startsWith('sit')) {
      rig.setLookTarget(P.pos.clone().setY(P.pos.y + 1.55));
      // 转身面向玩家(近距离)
      if (dToPlayer < 2.6) {
        const dir = Math.atan2(P.pos.x - _wp.x, P.pos.z - _wp.z);
        rig.group.rotation.y += (((dir - rig.group.rotation.y + Math.PI * 3) % (Math.PI * 2)) - Math.PI) * Math.min(1, dt * 3);
      }
    } else rig.setLookTarget(null);
  }
}
