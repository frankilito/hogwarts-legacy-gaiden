// combat.js — 实时魔法战斗:咒语/敌人/决斗/首领/合击
import * as THREE from 'three';
import { E } from './engine.js';
import { S, emit, on, flag, setFlag, addXP, addGold, addItem, affTier, heal } from './state.js';
import { SPELLS, NPCS, HOUSES } from './data.js';
import { P, playCast, teleport, fadeTransition } from './player.js';
import { Rig, ANIM } from './rig.js';
import { zones, activeZone, collide, floorAt } from './castle.js';
import { Input, pressed, down } from './input.js';
import { T, A } from './assets.js';
import { spark, shieldBubble, castCircle, FX } from './fx.js';
import { damageNumber, setSlotCooldown, toast, subtitle } from './ui.js';
import { questStep, advanceQuest, questActive, completeQuest } from './story.js';
import { npcs } from './npc.js';
import { openGate } from './gameplay.js';

export const CB = {
  enemies: [], projectiles: [], cooldowns: {}, lock: null,
  duel: null, boss: null, combo: 0, shieldMesh: null, shielding: false,
  perfectT: 0,
};

const $ = (id) => document.getElementById(id);

// ============ 初始化 ============
export function initCombat() {
  addEventListener('hg-zone', () => {
    clearEnemies();
    const z = activeZone;
    if (!z) return;
    if ((z.id === 'dungeon' || z.id === 'forest') && !flag(`cleared_${z.id}_${S.day}`)) {
      spawnZoneEnemies(z);
    }
  });
  on('phase', () => {
    // 夜晚禁林更多敌人
  });
}

function clearEnemies() {
  for (const e of CB.enemies) e.rig.dispose();
  CB.enemies = [];
  CB.lock = null;
  for (const p of CB.projectiles) p.mesh.parent?.remove(p.mesh);
  CB.projectiles = [];
}

// ============ 敌人 ============
const ENEMY_TYPES = {
  minion: { base: 'Skeleton_Minion', hp: 45, dmg: 10, speed: 2.6, xp: 22, name: '骷髅小兵', melee: true, scale: 0.95 },
  warrior: { base: 'Skeleton_Warrior', hp: 80, dmg: 16, speed: 2.2, xp: 40, name: '骷髅武士', melee: true, hand: 'Skeleton_Blade', scale: 1.05 },
  rogue: { base: 'Skeleton_Rogue', hp: 55, dmg: 12, speed: 3.4, xp: 32, name: '骷髅游荡者', melee: true, scale: 1 },
  mage: { base: 'Skeleton_Mage', hp: 60, dmg: 14, speed: 1.8, xp: 45, name: '骷髅巫师', melee: false, hand: 'Skeleton_Staff', scale: 1.05 },
};

export function spawnEnemy(type, x, z, { sleeping = true, boss = false } = {}) {
  const t = ENEMY_TYPES[type];
  const zn = activeZone;
  const rig = new Rig(t.base, { scale: t.scale, glowColor: 0x9ae0ff, shadow: true });
  zn.group.add(rig.group);
  rig.group.position.set(x, 0, z);
  const e = {
    type, def: t, rig, hp: t.hp, hpMax: t.hp,
    state: sleeping ? 'sleep' : 'idle', // sleep/awaken/chase/attack/hit/dead + frozen/burn/sheep
    atkCd: 1 + Math.random(), frozenT: 0, burnT: 0, sheepT: 0, liftT: 0,
    pos: rig.group.position, boss,
    hpBar: makeHpBar(rig),
  };
  if (sleeping) { rig.play('inactive', { force: true }); }
  if (t.hand) rig.setHand(t.hand.includes('Staff') ? 'Skeleton_Staff' : 'Skeleton_Blade');
  CB.enemies.push(e);
  return e;
}

function makeHpBar(rig) {
  const c = document.createElement('canvas'); c.width = 64; c.height = 8;
  const tex = new THREE.CanvasTexture(c);
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false }));
  sp.scale.set(1.1, 0.14, 1);
  sp.position.y = rig.height + 0.28;
  sp.visible = false;
  rig.group.add(sp);
  return { sp, c, tex, draw(frac) {
    const g = c.getContext('2d');
    g.clearRect(0, 0, 64, 8);
    g.fillStyle = 'rgba(0,0,0,.6)'; g.fillRect(0, 0, 64, 8);
    g.fillStyle = frac > 0.5 ? '#b8412f' : '#e05a3a';
    g.fillRect(1, 1, 62 * Math.max(0, frac), 6);
    tex.needsUpdate = true;
    sp.visible = frac < 1 && frac > 0;
  } };
}

function spawnZoneEnemies(z) {
  const pts = z.spawnPoints || [];
  pts.forEach((p, i) => {
    const type = z.id === 'forest'
      ? (i % 3 === 0 ? 'rogue' : i % 3 === 1 ? 'minion' : 'warrior')
      : (i % 4 === 3 ? 'mage' : i % 4 === 2 ? 'warrior' : i % 2 ? 'minion' : 'rogue');
    spawnEnemy(type, p.x, p.z, { sleeping: z.id === 'dungeon' });
  });
}

// ============ 咒语释放 ============
export function castSpell(id, aimTarget = null) {
  const sp = SPELLS[id];
  if (!sp) return false;
  if ((CB.cooldowns[id] || 0) > 0) return false;
  if (S.mp < sp.mana) { toast('法力不足…'); emit('sfx', 'fail'); return false; }
  S.mp -= sp.mana;
  const talBonus = S.talent === 'arcane' ? 0.9 : 1;
  CB.cooldowns[id] = sp.cd * talBonus * (S.learned.cdr ? 0.85 : 1);
  emit('hud');
  emit('sfx', 'cast');
  playCast(id === 'leviosa' || id === 'vertere' ? 'castRaise' : 'castShoot', 0.32);

  const origin = P.pos.clone(); origin.y += 1.45;
  const dir = aimDir(aimTarget);
  if (id === 'protego') return true; // 由按住逻辑处理
  if (id === 'leviosa') { castLeviosa(); return true; }
  if (id === 'vertere') { castVertere(); return true; }
  if (id === 'portara') { castPortara(); return true; }
  if (id === 'duo') { castDuo(); return true; }
  // 投射物系
  fireProjectile(id, origin, dir, { friendly: true });
  window.__sys?.net?.broadcastCast?.(id, origin, dir);
  return true;
}

function aimDir(target) {
  if (target || CB.lock) {
    const t = target || CB.lock;
    const tp = t.pos ? t.pos.clone() : t.clone();
    const wp = new THREE.Vector3();
    (t.rig ? t.rig.group : null)?.getWorldPosition(wp);
    const dst = t.rig ? wp : tp;
    dst.y += 1.1;
    const o = P.pos.clone(); o.y += 1.45;
    // 面向目标
    P.yaw = Math.atan2(dst.x - P.pos.x, dst.z - P.pos.z);
    P.rig.group.rotation.y = P.yaw;
    return dst.sub(o).normalize();
  }
  // 相机朝向
  const d = new THREE.Vector3();
  E.camera.getWorldDirection(d);
  d.y *= 0.4;
  return d.normalize();
}

export function fireProjectile(id, origin, dir, { friendly = true, dmgMul = 1, speed = null } = {}) {
  const sp = SPELLS[id] || { color: 0xffffff, dmg: 10 };
  const grp = new THREE.Group();
  const core = new THREE.Sprite(new THREE.SpriteMaterial({ map: T.star(), color: sp.color, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
  core.scale.setScalar(id === 'incendio' ? 1.1 : 0.7);
  const L = new THREE.PointLight(sp.color, 9, 7, 2);
  grp.add(core, L);
  grp.position.copy(origin);
  E.scene.add(grp);
  const v = dir.clone().multiplyScalar(speed || (id === 'bolt' ? 26 : id === 'incendio' ? 18 : 22));
  CB.projectiles.push({ id, mesh: grp, vel: v, life: 2.2, friendly, dmgMul, color: sp.color });
  spark(origin, { color: sp.color, n: 6, speed: 1.5, size: 60, life: 0.3 });
}

function castLeviosa() {
  // 优先:举起锁定/近处敌人
  const t = CB.lock || nearestEnemy(8);
  if (t && !t.boss && t.state !== 'dead') {
    t.liftT = 2.4;
    t.state = 'lift';
    t.rig.play('hitA', { force: true });
    spark(t.pos.clone().setY(1), { color: 0xd0b8ff, n: 18, speed: 2, up: 3 });
    toast('🪶 敌人被举到了半空!');
    return;
  }
  toast('🪶 漂浮咒:附近没有可举起的目标(浮石谜题在密室中按 E 搬运)');
}
function castVertere() {
  const t = CB.lock || nearestEnemy(9);
  if (t && !t.boss && t.state !== 'dead') {
    t.sheepT = 5;
    t.state = 'sheep';
    t.rig.group.visible = false;
    if (!t.sheepMesh) {
      const src = A.dungeon['barrel_small'];
      t.sheepMesh = src ? src.clone(true) : new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.8, 0.8), new THREE.MeshStandardMaterial({ color: 0xa8e0a0 }));
      activeZone.group.add(t.sheepMesh);
    }
    t.sheepMesh.visible = true;
    t.sheepMesh.position.copy(t.pos);
    spark(t.pos.clone().setY(1), { color: 0xa8e0a0, n: 24, speed: 3 });
    toast('🐑 变形术!敌人变成了一只木桶');
  } else toast('没有可变形的目标');
}
let portalPair = [];
function castPortara() {
  // 放置成对传送门(简化:第一次放 A,第二次放 B,踩上互传)
  const pos = P.pos.clone();
  pos.x += Math.sin(P.yaw) * 2; pos.z += Math.cos(P.yaw) * 2;
  const idx = portalPair.length % 2;
  const g = new THREE.Group();
  const ring = new THREE.Mesh(new THREE.TorusGeometry(1, 0.12, 8, 20), new THREE.MeshBasicMaterial({ color: idx ? 0xd0862a : 0x2a86d0 }));
  ring.rotation.x = Math.PI / 2; ring.position.y = 0.12;
  const swirl = new THREE.Mesh(new THREE.CircleGeometry(0.85, 18), new THREE.MeshBasicMaterial({ color: idx ? 0xd0862a : 0x2a86d0, transparent: true, opacity: 0.4, blending: THREE.AdditiveBlending, depthWrite: false }));
  swirl.rotation.x = -Math.PI / 2; swirl.position.y = 0.14;
  g.add(ring, swirl);
  g.position.copy(pos);
  E.scene.add(g);
  if (portalPair.length >= 2) { const old = portalPair.shift(); old.parent?.remove(old); }
  portalPair.push(g);
  g._cd = 0;
  toast(idx ? '🌀 出口已放置' : '🌀 入口已放置(再放一个出口)');
}
function castDuo() {
  const comp = S.companion && npcs.get(S.companion);
  if (!comp || comp.zone !== activeZone?.id) { toast('需要同伴在身边!'); return; }
  if (CB.combo < 100) { toast('协力值不足(通过战斗积攒)'); return; }
  CB.combo = 0;
  comp.rig.play('castLong', { once: true });
  P.rig.play('castLong', { once: true });
  castCircle(P.rig.group, { color: 0xffb8e8, r: 1.4 });
  castCircle(comp.rig.group, { color: 0xffb8e8, r: 1.4 });
  subtitle(`你与${comp.def.name}齐声吟唱——「Duo Maxima!」`, 2500);
  setTimeout(() => {
    const beam = new THREE.PointLight(0xffb8e8, 80, 40, 1.4);
    beam.position.copy(P.pos).y += 3;
    E.scene.add(beam);
    setTimeout(() => beam.parent?.remove(beam), 900);
    for (const e of CB.enemies) {
      if (e.state === 'dead') continue;
      damageEnemy(e, 90, { color: 0xffb8e8, crit: true });
      spark(e.pos.clone().setY(1.2), { color: 0xffb8e8, n: 30, speed: 5 });
    }
    if (CB.boss) damageBoss(120);
    emit('sfx', 'bigcast');
  }, 900);
}

// ============ 敌人受击 ============
function nearestEnemy(maxD = 10) {
  let best = null, bd = maxD;
  for (const e of CB.enemies) {
    if (e.state === 'dead' || e.state === 'sleep') continue;
    const d = Math.hypot(e.pos.x + activeZone.offset.x - P.pos.x, e.pos.z + activeZone.offset.z - P.pos.z);
    if (d < bd) { bd = d; best = e; }
  }
  return best;
}
export function damageEnemy(e, dmg, { color = 0xffd080, crit = false, effect = null } = {}) {
  if (e.state === 'dead') return;
  if (e.state === 'sleep') awaken(e);
  const mul = S.talent === 'elemental' && effect ? 1.15 : 1;
  dmg = Math.round(dmg * mul * (1 + (S.learned.power || 0) * 0.12) * (crit ? 1.5 : 1));
  e.hp -= dmg;
  e.hpBar.draw(e.hp / e.hpMax);
  const wp = new THREE.Vector3();
  e.rig.group.getWorldPosition(wp); wp.y += e.rig.height;
  damageNumber(wp, String(dmg), crit ? 'crit' : '');
  CB.combo = Math.min(100, CB.combo + dmg * 0.35);
  emit('combo');
  if (effect === 'burn') { e.burnT = 3; }
  if (effect === 'freeze') { e.frozenT = 3; e.rig.play('idle', { force: true }); e.rig.mixer.timeScale = 0.05; }
  if (effect === 'chain') {
    // 电弧跳跃
    let last = e;
    for (let k = 0; k < 2; k++) {
      const next = CB.enemies.find((x) => x !== last && x.state !== 'dead' && x.state !== 'sleep' && x.pos.distanceTo(last.pos) < 7);
      if (!next) break;
      const a = last.pos.clone().setY(1.3), b = next.pos.clone().setY(1.3);
      for (let i2 = 0; i2 < 5; i2++) spark(a.clone().lerp(b, i2 / 5).add(new THREE.Vector3((Math.random() - .5) * .5, (Math.random() - .5) * .5, 0)), { color: 0xd8c8ff, n: 3, speed: 1, size: 60, life: 0.25 });
      damageEnemy(next, dmg * 0.6, { color: 0xd8c8ff });
      last = next;
    }
  }
  if (e.hp <= 0) killEnemy(e);
  else if (e.state !== 'lift' && e.state !== 'frozen' && !e.rig._locked) {
    e.rig.play(Math.random() < 0.5 ? 'hitA' : 'hitB', { once: true, then: null });
  }
  emit('sfx', 'hit');
}
function awaken(e) {
  e.state = 'awaken';
  e.rig.play('awaken', { once: true, lock: true, cb: () => { e.state = 'chase'; } });
  emit('sfx', 'bones');
}
function killEnemy(e) {
  e.state = 'dead';
  e.rig.play(Math.random() < 0.5 ? 'deathA' : 'deathB', { once: true, then: null, lock: true });
  e.hpBar.sp.visible = false;
  if (e.sheepMesh) e.sheepMesh.visible = false;
  S.stats.enemies++;
  addXP(e.def.xp);
  if (Math.random() < 0.5) addGold(4 + Math.floor(Math.random() * 8));
  if (Math.random() < 0.25) addItem(['mushroom', 'frogeye', 'gnarl'][Math.floor(Math.random() * 3)], 1);
  if (CB.lock === e) CB.lock = null;
  setTimeout(() => {
    spark(e.pos.clone().setY(0.6).add(activeZone?.offset || new THREE.Vector3()), { color: 0x9ae0ff, n: 20, speed: 2, up: 2 });
    e.rig.group.visible = false;
  }, 2600);
  // 全清检查
  if (CB.enemies.every((x) => x.state === 'dead') && activeZone && !CB.boss) {
    setFlag(`cleared_${activeZone.id}_${S.day}`);
    if (activeZone.id === 'dungeon' || activeZone.id === 'forest') toast('✨ 这一带的骸骨安静了(每日刷新)');
  }
}

// ============ 玩家受击 ============
export function damagePlayer(dmg, srcPos = null) {
  if (P.iframe > 0 || S.hp <= 0) return;
  if (CB.shielding) {
    // 完美格挡窗口
    if (CB.perfectT > 0) {
      toast('✨ 完美格挡!');
      emit('sfx', 'parry');
      spark(P.pos.clone().setY(1.3), { color: 0x8fd0ff, n: 26, speed: 4 });
      CB.combo = Math.min(100, CB.combo + 20);
      // 反弹:对最近敌人造成伤害
      const t = nearestEnemy(10);
      if (t) damageEnemy(t, dmg, { color: 0x8fd0ff });
      return;
    }
    dmg = Math.round(dmg * (S.talent === 'guardian' ? 0.25 : 0.4));
    S.mp = Math.max(0, S.mp - 6);
    emit('sfx', 'block');
    P.rig.play('blockHit', { once: true, then: 'block' });
  } else {
    if (S.trait === 'brave') dmg = Math.round(dmg * 0.9);
    P.rig.play(Math.random() < 0.5 ? 'hitA' : 'hitB', { once: true });
    emit('sfx', 'hurt');
  }
  S.hp = Math.max(0, S.hp - dmg);
  const wp = P.pos.clone(); wp.y += 1.9;
  damageNumber(wp, '-' + dmg, 'player');
  emit('hud');
  if (S.hp <= 0) onPlayerDown();
}
function onPlayerDown() {
  P.state = 'dead';
  P.rig.play('deathA', { once: true, then: null, lock: true });
  toast('💫 你昏了过去……', true);
  if (CB.duel) return endDuel(false);
  if (CB.boss) { /* boss 战失败:退出重来 */ }
  setTimeout(() => {
    fadeTransition(() => {
      S.hp = Math.round(S.hpMax * 0.4); S.mp = Math.round(S.mpMax * 0.5);
      addGold(-Math.min(15, S.gold));
      P.state = 'normal';
      P.rig.stopLock(); P.rig.play('idle', { force: true });
      if (CB.boss) cleanupBoss();
      teleport('dorm');
      toast('你在宿舍的床上醒来。波比说是同学把你抬回来的。');
      emit('hud');
    });
  }, 1800);
}

// ============ 决斗 ============
const DUELISTS = {
  leo: { npc: 'leo', hp: 90, spells: ['bolt', 'stupefy'], speed: 2.6, iq: 0.5 },
  cassian: { npc: 'cassian', hp: 130, spells: ['bolt', 'stupefy', 'protego'], speed: 3, iq: 0.8 },
  club1: { name: '决斗社学员·薇欧', base: 'Rogue', tint: 0x2f4d8e, hp: 80, spells: ['bolt'], speed: 2.4, iq: 0.4 },
  club2: { name: '决斗社学员·马库斯', base: 'Knight', tint: 0xa8842f, hp: 110, spells: ['bolt', 'stupefy'], speed: 2.6, iq: 0.6 },
};
export function openDuelMenu() {
  const list = [];
  if (flag('cassianBookDuel') && !flag('cassianBookDone')) list.push(['cassian', '卡西安(赌上那本书)']);
  if (questStep('leo_train') === 0) list.push(['leo', '里奥(特训之约)']);
  if (questActive('duel_club')) {
    const w = S.duelWins;
    if (w === 0) list.push(['club1', '正式赛①:薇欧']);
    else if (w === 1) list.push(['club2', '正式赛②:马库斯']);
    else if (w === 2) list.push(['cassian', '决赛:卡西安(社内第一)']);
  }
  list.push(['club1', '友谊练习赛']);
  const body = $('mpMenuBody');
  $('mpMenu').classList.remove('hidden');
  Input.enabled = false;
  body.innerHTML = `<h2 style="text-align:center;color:var(--gold-hi);letter-spacing:4px;margin-bottom:10px">⚔ 决斗场</h2>
    <div style="text-align:center;color:var(--ink-dim);font-size:13px;margin-bottom:10px">正式赛战绩:${S.duelWins} 胜 · 规则:先倒地者负,行礼开始</div>
    ${list.map(([id, label], i) => `<button class="dlg-choice" style="width:100%;margin-bottom:8px" data-d="${id}" data-i="${i}">${label}</button>`).join('')}
    <button class="btn" id="duelClose" style="width:100%">离开</button>`;
  body.querySelectorAll('[data-d]').forEach((el) => {
    el.onclick = () => { $('mpMenu').classList.add('hidden'); Input.enabled = true; startDuel(el.dataset.d, el.textContent.includes('正式') || el.textContent.includes('决赛')); };
  });
  $('duelClose').onclick = () => { $('mpMenu').classList.add('hidden'); Input.enabled = true; };
}
export function startDuel(duelistId, official = false) {
  const d = DUELISTS[duelistId];
  const zn = zones.get('courtyard');
  // 建立对手 rig
  let rig, name;
  if (d.npc) {
    const npc = npcs.get(d.npc);
    name = npc.def.name;
    rig = npc.rig || null;
    if (!rig) return;
    if (npc.rig.group.parent !== zn.group) zn.group.add(npc.rig.group);
    npc.state = 'duel';
  } else {
    name = d.name;
    rig = new Rig(d.base, { tint: d.tint, hair: 'short', hairColor: 0x4a3018, hand: 'wand', label: d.name });
    zn.group.add(rig.group);
  }
  rig.group.position.set(0, 0, 26);
  // 玩家站位
  P.pos.set(zn.offset.x, 0, zn.offset.z + 15);
  P.yaw = 0; P.camYaw = 0;
  CB.duel = {
    id: duelistId, d, rig, name, official,
    hp: d.hp, hpMax: d.hp, state: 'bow', t: 2.2, cd: 1.5, shielded: false, adhoc: !d.npc,
  };
  subtitle(`决斗开始!与 ${name} 互相行礼——`, 2400);
  P.rig.play('interact', { once: true });
  rig.play('interact', { once: true });
  emit('sfx', 'duelstart');
  $('bossbar').classList.remove('hidden');
  $('bossbar').querySelector('.nm').textContent = '⚔ ' + name;
  P.state = 'duel';
}
function endDuel(win) {
  const du = CB.duel;
  if (!du) return;
  $('bossbar').classList.add('hidden');
  if (win) {
    du.rig.play('deathA', { once: true, then: null });
    setTimeout(() => { du.rig.stopLock?.(); du.rig.play('idle', { force: true }); if (du.adhoc) { du.rig.dispose(); } }, 2500);
    toast(`🏆 决斗胜利!(${du.name})`, true);
    S.stats.duels++;
    addXP(40);
    CB.combo = Math.min(100, CB.combo + 30);
    if (du.official) {
      S.duelWins++;
      if (S.duelWins >= 3 && questStep('duel_club') === 1) { advanceQuest('duel_club', 2); toast('👑 你成为决斗社冠军!去找维克多教授', true); }
      else toast(`正式赛战绩:${S.duelWins} / 3`);
    }
    if (du.id === 'cassian' && flag('cassianBookDuel') && !flag('cassianBookDone')) {
      setFlag('cassianBookDone');
      addItem('gift_book', 1);
      advanceQuest('vera_book', 1);
      toast('📕 卡西安不情不愿地把书塞给了你');
    }
    if (du.id === 'leo' && questStep('leo_train') === 0) advanceQuest('leo_train', 1);
  } else {
    toast('你输了这场决斗……再接再厉');
    S.hp = Math.max(20, S.hp);
  }
  const npc = du.d.npc && npcs.get(du.d.npc);
  if (npc) npc.state = 'idle';
  CB.duel = null;
  P.state = 'normal';
  emit('hud');
}
function updateDuel(dt) {
  const du = CB.duel;
  if (!du) return;
  const rig = du.rig;
  const zn = zones.get('courtyard');
  const ep = rig.group.position;
  const pw = { x: P.pos.x - zn.offset.x, z: P.pos.z - zn.offset.z };
  const d2p = Math.hypot(ep.x - pw.x, ep.z - pw.z);
  // 面向玩家
  rig.group.rotation.y = Math.atan2(pw.x - ep.x, pw.z - ep.z);
  $('bossbar').querySelector('.fill').style.width = (du.hp / du.hpMax * 100) + '%';
  if (du.state === 'bow') { du.t -= dt; if (du.t <= 0) { du.state = 'fight'; toast('⚔ 开始!'); } return; }
  // AI
  du.cd -= dt;
  // 走位:保持 8-12m
  const want = d2p < 7 ? -1 : d2p > 13 ? 1 : 0;
  if (want !== 0) {
    const dir = Math.atan2(pw.x - ep.x, pw.z - ep.z);
    ep.x += Math.sin(dir) * want * du.d.speed * dt;
    ep.z += Math.cos(dir) * want * du.d.speed * dt;
    if (rig.currentName !== 'run' && !rig._locked) rig.play('run');
  } else if (!rig._locked && rig.currentName !== 'combat') rig.play('combat');
  // 侧移
  ep.x += Math.cos(FX.time * 0.7 + du.hp) * du.d.speed * 0.35 * dt;
  if (du.cd <= 0) {
    du.cd = 1.4 + Math.random() * 1.4 - du.d.iq * 0.5;
    const roll = Math.random();
    if (roll < du.d.iq * 0.3 && du.d.spells.includes('protego')) {
      du.shielded = true;
      rig.play('block', { once: true, then: 'combat' });
      setTimeout(() => { du.shielded = false; }, 1200);
    } else {
      const spId = du.d.spells[Math.floor(Math.random() * du.d.spells.length)];
      rig.play('castShoot', { once: true, then: 'combat', timeScale: 1.3 });
      const o = ep.clone().add(zn.offset).setY(1.5);
      const target = P.pos.clone().setY(1.4);
      setTimeout(() => {
        fireProjectile(spId, o, target.sub(o).normalize(), { friendly: false });
        emit('sfx', 'cast');
      }, 320);
    }
  }
}
export function hitDuelist(dmg, color) {
  const du = CB.duel;
  if (!du || du.state === 'bow') return;
  if (du.shielded) { spark(du.rig.group.position.clone().add(zones.get('courtyard').offset).setY(1.4), { color: 0x8fd0ff, n: 14, speed: 3 }); return; }
  du.hp -= dmg;
  const wp = new THREE.Vector3();
  du.rig.group.getWorldPosition(wp); wp.y += 2;
  damageNumber(wp, String(dmg));
  if (!du.rig._locked) du.rig.play('hitA', { once: true, then: 'combat' });
  if (du.hp <= 0) endDuel(true);
}

// ============ 首领:古代守卫 ============
export function startBoss() {
  if (CB.boss) return;
  const zn = zones.get('dungeon');
  const c = zn._mechCenter;
  // 石魔像:程序化拼装
  const g = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({ map: T.stone(2), roughness: 0.85 });
  const glowMat = new THREE.MeshStandardMaterial({ color: 0x30d8c0, emissive: 0x1a9a88, emissiveIntensity: 2 });
  const torso = new THREE.Mesh(new THREE.BoxGeometry(2.2, 2.4, 1.4), mat); torso.position.y = 2.6;
  const head = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), mat); head.position.y = 4.35;
  const eye = new THREE.Mesh(new THREE.BoxGeometry(0.66, 0.2, 0.1), glowMat); eye.position.set(0, 4.4, 0.52);
  const core = new THREE.Mesh(new THREE.IcosahedronGeometry(0.42, 1), glowMat); core.position.set(0, 2.7, 0.76);
  const armL = new THREE.Mesh(new THREE.BoxGeometry(0.8, 2.6, 0.8), mat); armL.position.set(-1.8, 2.6, 0);
  const armR = armL.clone(); armR.position.x = 1.8;
  const legL = new THREE.Mesh(new THREE.BoxGeometry(0.9, 1.6, 0.9), mat); legL.position.set(-0.7, 0.8, 0);
  const legR = legL.clone(); legR.position.x = 0.7;
  const shoulderL = new THREE.Mesh(new THREE.BoxGeometry(1.1, 1.1, 1.1), mat); shoulderL.position.set(-1.8, 3.9, 0);
  const shoulderR = shoulderL.clone(); shoulderR.position.x = 1.8;
  g.add(torso, head, eye, core, armL, armR, legL, legR, shoulderL, shoulderR);
  g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  g.position.set(c.x, 0, c.z + 6);
  zn.group.add(g);
  CB.boss = {
    group: g, armL, armR, core, eye,
    hp: 600, hpMax: 600, state: 'rise', t: 2.4, atkCd: 3,
    phase: 1, summoned66: false, summoned33: false, stagger: 0,
  };
  g.position.y = -4;
  $('bossbar').classList.remove('hidden');
  $('bossbar').querySelector('.nm').textContent = '⚙ 古代守卫 · 两百年的看门人';
  subtitle('地面轰隆震颤——巨大的石影从机关下站了起来!', 3000);
  emit('sfx', 'bossroar');
  if (zn._mech) zn._mech.speed = 2.2;
  window.__timeFrozen = true;
}
function cleanupBoss() {
  if (!CB.boss) return;
  CB.boss.group.parent?.remove(CB.boss.group);
  CB.boss = null;
  $('bossbar').classList.add('hidden');
  window.__timeFrozen = false;
}
export function damageBoss(dmg, effect = null) {
  const b = CB.boss;
  if (!b || b.state === 'rise' || b.state === 'dead') return;
  if (effect === 'freeze') { b.stagger = 2; toast('❄ 守卫的关节结霜,迟缓了!'); }
  dmg = Math.round(dmg * (1 + (S.learned.power || 0) * 0.12));
  b.hp -= dmg;
  const wp = b.group.position.clone().add(zones.get('dungeon').offset); wp.y = 4;
  damageNumber(wp, String(dmg), dmg > 40 ? 'crit' : '');
  $('bossbar').querySelector('.fill').style.width = (Math.max(0, b.hp) / b.hpMax * 100) + '%';
  CB.combo = Math.min(100, CB.combo + dmg * 0.25);
  if (b.hp <= b.hpMax * 0.66 && !b.summoned66) { b.summoned66 = true; bossSummon(); }
  if (b.hp <= b.hpMax * 0.33 && !b.summoned33) { b.summoned33 = true; bossSummon(); b.phase = 2; toast('⚙ 守卫的核心过热,动作更快了!'); }
  if (b.hp <= 0) bossDefeated();
}
function bossSummon() {
  const zn = zones.get('dungeon');
  const c = zn._mechCenter;
  subtitle('守卫敲击地面——沉睡的骸骨应声而起!');
  spawnEnemy('minion', c.x - 4, c.z + 4, { sleeping: false });
  spawnEnemy('rogue', c.x + 4, c.z + 4, { sleeping: false });
  emit('sfx', 'bones');
}
function bossDefeated() {
  const b = CB.boss;
  b.state = 'dead';
  subtitle('古代守卫单膝跪地——胸口的核心缓缓熄灭,像一声叹息。', 4000);
  emit('sfx', 'bossdead');
  const zn = zones.get('dungeon');
  if (zn._mech) zn._mech.speed = 0.1;
  let t = 0;
  const fall = () => {
    t += 0.016;
    b.group.rotation.x = Math.min(0.5, t * 0.4);
    b.group.position.y = -t * 0.8;
    if (t < 2) requestAnimationFrame(fall);
    else {
      spark(b.group.position.clone().add(zn.offset).setY(2), { color: 0x30d8c0, n: 60, speed: 6, up: 3 });
      cleanupBoss();
    }
  };
  fall();
  addXP(200); addGold(120);
  S.stats.duels++;
  advanceQuest('main', 10);
  toast('⚙ 守卫沉眠了。回去向凡斯校长复命吧!', true);
  setFlag('bossDown');
  window.__timeFrozen = false;
}
function updateBoss(dt) {
  const b = CB.boss;
  if (!b || b.state === 'dead') return;
  const zn = zones.get('dungeon');
  const bp = b.group.position;
  const pw = { x: P.pos.x - zn.offset.x, z: P.pos.z - zn.offset.z };
  if (b.state === 'rise') {
    bp.y = Math.min(0, bp.y + dt * 2);
    b.t -= dt;
    if (b.t <= 0 && bp.y >= 0) { b.state = 'fight'; }
    return;
  }
  if (b.stagger > 0) { b.stagger -= dt; return; }
  const d2p = Math.hypot(bp.x - pw.x, bp.z - pw.z);
  const dir = Math.atan2(pw.x - bp.x, pw.z - bp.z);
  b.group.rotation.y = dir;
  const spd = b.phase === 2 ? 2.4 : 1.6;
  if (d2p > 3.4) {
    bp.x += Math.sin(dir) * spd * dt;
    bp.z += Math.cos(dir) * spd * dt;
    // 步行摇摆
    b.group.rotation.z = Math.sin(FX.time * 4) * 0.04;
    b.armL.rotation.x = Math.sin(FX.time * 4) * 0.4;
    b.armR.rotation.x = -Math.sin(FX.time * 4) * 0.4;
  }
  b.atkCd -= dt;
  if (b.atkCd <= 0) {
    b.atkCd = b.phase === 2 ? 2.2 : 3.2;
    if (d2p < 5) bossSlam(b, zn);
    else bossThrow(b, zn, dir);
  }
  // 核心发光脉动
  b.core.material.emissiveIntensity = 1.6 + Math.sin(FX.time * 5) * 0.7;
}
function bossSlam(b, zn) {
  // 抬臂 → 砸地冲击波
  let t = 0;
  subtitle('守卫高举双臂——躲开!(空格翻滚)');
  const anim = () => {
    t += 0.016;
    b.armL.rotation.x = -Math.min(2.4, t * 4);
    b.armR.rotation.x = -Math.min(2.4, t * 4);
    if (t < 0.7) requestAnimationFrame(anim);
    else {
      b.armL.rotation.x = 0.5; b.armR.rotation.x = 0.5;
      const c = b.group.position.clone().add(zn.offset);
      spark(c.clone().setY(0.4), { color: 0xd0b070, n: 46, speed: 7, spread: 0.4, size: 130 });
      emit('sfx', 'slam');
      shakeCamera(0.5);
      const d = Math.hypot(c.x - P.pos.x, c.z - P.pos.z);
      if (d < 6.5) damagePlayer(26);
      setTimeout(() => { b.armL.rotation.x = 0; b.armR.rotation.x = 0; }, 500);
    }
  };
  anim();
}
function bossThrow(b, zn, dir) {
  const o = b.group.position.clone().add(zn.offset).setY(3.4);
  b.armR.rotation.x = -2;
  setTimeout(() => {
    b.armR.rotation.x = 0;
    const target = P.pos.clone().setY(1.2);
    fireProjectile('bolt', o, target.sub(o).normalize(), { friendly: false, dmgMul: 1.8, speed: 16 });
    emit('sfx', 'throw');
  }, 400);
}
let _shake = 0;
export function shakeCamera(n) { _shake = Math.max(_shake, n); }

// ============ 主更新 ============
export function updateCombat(dt) {
  // 冷却
  for (const k of Object.keys(CB.cooldowns)) {
    CB.cooldowns[k] = Math.max(0, CB.cooldowns[k] - dt);
  }
  S.slots.forEach((sid, i) => setSlotCooldown(i, CB.cooldowns[sid] || 0, SPELLS[sid]?.cd || 1));
  // 相机抖动
  if (_shake > 0) {
    _shake = Math.max(0, _shake - dt * 2);
    E.camera.position.x += (Math.random() - 0.5) * _shake * 0.4;
    E.camera.position.y += (Math.random() - 0.5) * _shake * 0.3;
  }
  // 战斗输入
  if (Input.enabled && S.started && P.state !== 'dead' && P.state !== 'decor') {
    // 咒语槽
    ['Digit1', 'Digit2', 'Digit3', 'Digit4'].forEach((code, i) => {
      if (pressed(code)) castSpell(S.slots[i]);
    });
    // 左键:基础魔弹
    if ((Input.lmbJust || pressed('V_cast')) && !window.__dialogOpen) castSpell('bolt');
    // 右键:护盾
    const wantShield = Input.rmb || down('KeyC');
    if (wantShield && !CB.shielding && S.mp > 4) {
      CB.shielding = true;
      CB.perfectT = 0.25;
      P.rig.play('blockStart', { once: true, then: 'block' });
      if (!CB.shieldMesh) { CB.shieldMesh = shieldBubble(S.talent === 'guardian' ? 0xa0e8ff : 0x8fd0ff); }
      P.rig.group.add(CB.shieldMesh);
      CB.shieldMesh.position.y = 1.1;
      emit('sfx', 'shield');
    } else if (!wantShield && CB.shielding) {
      CB.shielding = false;
      CB.shieldMesh?.parent?.remove(CB.shieldMesh);
      P.rig.play('idle');
    }
    if (CB.shielding) {
      CB.perfectT = Math.max(0, CB.perfectT - dt);
      CB.shieldMesh.material.opacity = 0.16 + Math.sin(FX.time * 6) * 0.05 + (CB.perfectT > 0 ? 0.2 : 0);
      S.mp = Math.max(0, S.mp - dt * 2.5);
      if (S.mp <= 0) { CB.shielding = false; CB.shieldMesh?.parent?.remove(CB.shieldMesh); }
    }
    // 锁定
    if (pressed('KeyQ') && P.state !== 'decor') {
      const t = nearestEnemy(16);
      CB.lock = CB.lock && CB.lock !== t ? t : (CB.lock ? null : t);
    }
    // 合击
    if (pressed('KeyF')) castSpell('duo');
  }
  // 锁定光圈
  const lockEl = $('lockon');
  if (CB.lock && CB.lock.state !== 'dead') {
    const wp = new THREE.Vector3();
    CB.lock.rig.group.getWorldPosition(wp); wp.y += 1.2;
    const v = wp.project(E.camera);
    if (v.z < 1) {
      lockEl.style.display = 'flex';
      lockEl.style.left = ((v.x * 0.5 + 0.5) * innerWidth - 22) + 'px';
      lockEl.style.top = ((-v.y * 0.5 + 0.5) * innerHeight - 22) + 'px';
    } else lockEl.style.display = 'none';
  } else lockEl.style.display = 'none';
  // 协力值 UI
  const cg = $('comboGauge');
  if (S.companion) {
    cg.style.display = 'block';
    cg.innerHTML = `<div style="font-size:12px;color:#e8a8c8;text-align:right;letter-spacing:1px">协力 ${CB.combo | 0}%${CB.combo >= 100 ? ' · 按 F 合击!' : ''}</div><div class="bar" style="width:100%;height:7px"><div class="fill" style="width:${CB.combo}%;background:linear-gradient(90deg,#c86a9a,#ffb8e8)"></div></div>`;
  } else cg.style.display = 'none';

  updateProjectiles(dt);
  updateEnemies(dt);
  updateDuel(dt);
  updateBoss(dt);
  updatePortals(dt);
}

function updatePortals(dt) {
  for (const g of portalPair) {
    g._cd = Math.max(0, (g._cd || 0) - dt);
    g.children[1].rotation.z += dt * 3;
  }
  if (portalPair.length === 2) {
    for (let i = 0; i < 2; i++) {
      const g = portalPair[i];
      if (g._cd > 0) continue;
      if (Math.hypot(P.pos.x - g.position.x, P.pos.z - g.position.z) < 1.1) {
        const o = portalPair[1 - i];
        P.pos.x = o.position.x; P.pos.z = o.position.z;
        o._cd = 1.5; g._cd = 1.5;
        spark(P.pos.clone().setY(1.2), { color: 0x70e0d8, n: 26, speed: 3 });
        emit('sfx', 'portal');
      }
    }
  }
}

function updateProjectiles(dt) {
  const zn = activeZone;
  for (let i = CB.projectiles.length - 1; i >= 0; i--) {
    const p = CB.projectiles[i];
    p.life -= dt;
    p.mesh.position.addScaledVector(p.vel, dt);
    // 拖尾
    if (Math.random() < 0.6) spark(p.mesh.position, { color: p.color, n: 1, speed: 0.3, size: 40, life: 0.3 });
    let hit = false;
    if (p.friendly) {
      // 命中敌人
      for (const e of CB.enemies) {
        if (e.state === 'dead' || e.state === 'sleep' && activeZone?.id === 'forest') continue;
        const wp = new THREE.Vector3();
        e.rig.group.getWorldPosition(wp); wp.y += 1;
        if (p.mesh.position.distanceTo(wp) < 1.1) {
          const sp = SPELLS[p.id];
          const effect = p.id === 'incendio' ? 'burn' : p.id === 'glacius' ? 'freeze' : p.id === 'fulmen' ? 'chain' : null;
          damageEnemy(e, (sp?.dmg || 10) * p.dmgMul, { color: p.color, effect, crit: p.id === 'stupefy' && Math.random() < 0.3 });
          window.__sys?.net?.broadcastEnemyHit?.(CB.enemies.indexOf(e), Math.round((sp?.dmg || 10) * p.dmgMul));
          if (p.id === 'stupefy') { e.stunT = 2; }
          hit = true; break;
        }
      }
      // 命中决斗对手
      if (!hit && CB.duel) {
        const wp = new THREE.Vector3();
        CB.duel.rig.group.getWorldPosition(wp); wp.y += 1.1;
        if (p.mesh.position.distanceTo(wp) < 1.1) {
          hitDuelist(SPELLS[p.id]?.dmg || 10, p.color);
          hit = true;
        }
      }
      // 命中首领
      if (!hit && CB.boss) {
        const wp = CB.boss.group.position.clone().add(zones.get('dungeon').offset);
        wp.y += 2.4;
        if (p.mesh.position.distanceTo(wp) < 2.4) {
          const sp = SPELLS[p.id];
          damageBoss((sp?.dmg || 10) * p.dmgMul, p.id === 'glacius' ? 'freeze' : null);
          hit = true;
        }
      }
      // 火盆点燃(密室机关)
      if (!hit && zn?.id === 'dungeon' && (p.id === 'incendio' || p.id === 'bolt')) {
        for (const b of zn._braziers || []) {
          const w = zn.W(b.x, b.z);
          if (Math.hypot(p.mesh.position.x - w.x, p.mesh.position.z - w.z) < 1.3 && p.mesh.position.y < 2.6) {
            if (p.id === 'incendio' && !b.lit) {
              b.lit = true;
              b.fireSp.scale.setScalar(1.4);
              b.L.intensity = 14;
              toast('🔥 火盆燃起!');
              if ((zn._braziers || []).every((x) => x.lit)) openGate(zn, '2');
            }
            hit = true;
          }
        }
      }
    } else {
      // 敌方投射物命中玩家
      const pp = P.pos.clone(); pp.y += 1.1;
      if (p.mesh.position.distanceTo(pp) < 0.9) {
        damagePlayer(Math.round((SPELLS[p.id]?.dmg || 12) * p.dmgMul * 0.7), p.mesh.position);
        hit = true;
      }
    }
    if (hit || p.life <= 0) {
      spark(p.mesh.position, { color: p.color, n: hit ? 16 : 6, speed: 3 });
      p.mesh.parent?.remove(p.mesh);
      CB.projectiles.splice(i, 1);
      if (hit) emit('sfx', 'impact');
    }
  }
}

function updateEnemies(dt) {
  const zn = activeZone;
  if (!zn) return;
  for (const e of CB.enemies) {
    if (e.state === 'dead') { continue; }
    const wp = new THREE.Vector3();
    e.rig.group.getWorldPosition(wp);
    const d2p = Math.hypot(wp.x - P.pos.x, wp.z - P.pos.z);
    // 变形/冰冻/漂浮计时
    if (e.sheepT > 0) {
      e.sheepT -= dt;
      if (e.sheepMesh) { e.sheepMesh.position.copy(e.pos); e.sheepMesh.rotation.y += dt * 2; }
      if (e.sheepT <= 0) { e.state = 'chase'; e.rig.group.visible = true; if (e.sheepMesh) e.sheepMesh.visible = false; }
      else continue;
    }
    if (e.frozenT > 0) {
      e.frozenT -= dt;
      if (e.frozenT <= 0) { e.rig.mixer.timeScale = 1; e.state = 'chase'; }
      else continue;
    }
    if (e.liftT > 0) {
      e.liftT -= dt;
      e.rig.group.position.y = Math.min(2.2, e.rig.group.position.y + dt * 3);
      if (e.liftT <= 0) {
        e.rig.group.position.y = 0;
        damageEnemy(e, 18, { color: 0xd0b8ff });
        e.state = 'chase';
      } else continue;
    }
    if (e.stunT > 0) { e.stunT -= dt; continue; }
    if (e.burnT > 0) {
      e.burnT -= dt;
      e._burnTick = (e._burnTick || 0) - dt;
      if (e._burnTick <= 0) { e._burnTick = 0.5; damageEnemy(e, 4, { color: 0xff8a30 }); spark(wp.clone().setY(1.2), { color: 0xff8a30, n: 4, speed: 1.5, up: 1 }); }
    }
    if (e.state === 'sleep') {
      if (d2p < 7) awaken(e);
      continue;
    }
    if (e.state === 'awaken') continue;
    if (e.rig._locked) continue;

    // 追击
    const dir = Math.atan2(P.pos.x - wp.x, P.pos.z - wp.z);
    e.rig.group.rotation.y += (((dir - e.rig.group.rotation.y + Math.PI * 3) % (Math.PI * 2)) - Math.PI) * Math.min(1, dt * 5);
    e.atkCd -= dt;
    const range = e.def.melee ? 1.8 : 11;
    if (d2p > range) {
      e.rig.group.position.x += Math.sin(dir) * e.def.speed * dt;
      e.rig.group.position.z += Math.cos(dir) * e.def.speed * dt;
      // 敌人间距
      for (const o of CB.enemies) {
        if (o === e || o.state === 'dead') continue;
        const dd = e.pos.distanceTo(o.pos);
        if (dd < 1.2 && dd > 0.01) {
          const push = e.pos.clone().sub(o.pos).normalize().multiplyScalar((1.2 - dd) * 0.5);
          e.pos.x += push.x; e.pos.z += push.z;
        }
      }
      if (e.rig.currentName !== 'run') e.rig.play('run');
    } else {
      if (e.atkCd <= 0) {
        e.atkCd = e.def.melee ? 1.6 + Math.random() * 0.8 : 2.6 + Math.random();
        if (e.def.melee) {
          e.rig.play(['melee1', 'melee2', 'melee3'][Math.floor(Math.random() * 3)], { once: true, then: 'combat' });
          setTimeout(() => {
            const wp2 = new THREE.Vector3();
            e.rig.group.getWorldPosition(wp2);
            if (e.state !== 'dead' && Math.hypot(wp2.x - P.pos.x, wp2.z - P.pos.z) < 2.4) damagePlayer(e.def.dmg);
          }, 420);
        } else {
          e.rig.play('castShoot', { once: true, then: 'combat', timeScale: 1.2 });
          const o = wp.clone().setY(1.5);
          setTimeout(() => {
            if (e.state === 'dead') return;
            const t = P.pos.clone().setY(1.2);
            fireProjectile('bolt', o, t.sub(o).normalize(), { friendly: false, dmgMul: 1.2, speed: 14 });
          }, 400);
        }
      } else if (e.rig.currentName !== 'combat') e.rig.play('combat');
    }
  }
}
