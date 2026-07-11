// state.js — 全局游戏状态/时间系统/存档
import { PHASES, WEEK_SCHEDULE, EXAM_DAYS, SPELL_SLOTS_DEFAULT, ITEMS } from './data.js';

export const bus = new EventTarget();
export const emit = (name, detail) => bus.dispatchEvent(new CustomEvent(name, { detail }));
export const on = (name, fn) => bus.addEventListener(name, (e) => fn(e.detail));

export const S = {
  // 元
  slot: 0, started: false, playTime: 0,
  // 角色
  name: '', house: 'gryffindor', talent: 'elemental', trait: 'brave',
  body: 'Mage', hair: 'short', hairColor: 0, skin: 0,
  // 属性
  level: 1, xp: 0, hp: 100, hpMax: 100, mp: 80, mpMax: 80, gold: 30,
  skillPoints: 1, learned: {},           // 技能树
  spells: ['bolt', 'stupefy', 'protego', 'leviosa'], // 已解锁
  slots: [...SPELL_SLOTS_DEFAULT],       // 快捷栏 4 格
  // 时间: day 从 0 起, phase 0-5
  day: 0, phase: 0, minute: 0,           // minute 为阶段内进度(0-100)
  weather: 'clear',                      // clear | rain
  // 物品 {id:count}
  inv: { potion_heal: 2, gift_choco: 1 },
  // 好感 {npcId: pts}
  aff: {},
  // 任务 {id:{step, done, failed}}
  quests: {}, tracked: 'main',
  // 学业 {classId:{score, sessions}}
  grades: {}, credits: 0,
  // 决斗社
  duelRank: 0, duelWins: 0,
  // 宿舍装饰 [{id, x, z, rot}]
  decor: [{ id: 'bed_decorated', x: 3.0, z: -2.6, rot: Math.PI }, { id: 'trunk', x: 1.4, z: -3.2, rot: Math.PI }],
  // 剧情 flags
  flags: {},
  companion: null,       // 当前同伴 npcId
  zone: 'hall', pos: null,
  // 统计
  stats: { enemies: 0, duels: 0, potions: 0, classes: 0, stars: 0 },
};

export function setFlag(k, v = true) { S.flags[k] = v; emit('flag', { k, v }); }
export function flag(k) { return S.flags[k]; }

// ---------- 属性/资源 ----------
export function xpNeed(lv) { return 40 + lv * 45; }
export function addXP(n) {
  if (S.trait === 'curious') n = Math.round(n * 1.15);
  S.xp += n;
  while (S.xp >= xpNeed(S.level)) {
    S.xp -= xpNeed(S.level); S.level++;
    S.hpMax += 10; S.mpMax += 6; S.hp = S.hpMax; S.mp = S.mpMax;
    S.skillPoints++;
    emit('levelup', S.level); emit('toast', { text: `✨ 升到 ${S.level} 级!技能点 +1`, big: true });
  }
  emit('hud');
}
export function addGold(n) { S.gold = Math.max(0, S.gold + n); if (n > 0) emit('toast', { text: `🪙 +${n}` }); emit('hud'); }
export function heal(n) { S.hp = Math.min(S.hpMax, S.hp + n); emit('hud'); }
export function restoreMp(n) { S.mp = Math.min(S.mpMax, S.mp + n); emit('hud'); }

// ---------- 物品 ----------
export function addItem(id, n = 1, silent = false) {
  S.inv[id] = (S.inv[id] || 0) + n;
  if (S.inv[id] <= 0) delete S.inv[id];
  if (!silent && n > 0) emit('toast', { text: `获得 ${ITEMS[id]?.icon || ''} ${ITEMS[id]?.name || id} ×${n}` });
  emit('inv');
}
export function hasItem(id, n = 1) { return (S.inv[id] || 0) >= n; }
export function removeItem(id, n = 1) { addItem(id, -n, true); }

// ---------- 好感 ----------
export const AFF_TIERS = [0, 20, 50, 90, 140]; // 陌生/相识/朋友/挚友/形影不离
export const AFF_NAMES = ['陌生', '相识', '朋友', '挚友', '形影不离'];
export function affTier(npc) { const a = S.aff[npc] || 0; let t = 0; for (let i = 0; i < AFF_TIERS.length; i++) if (a >= AFF_TIERS[i]) t = i; return t; }
export function addAff(npc, n) {
  if (S.trait === 'gentle' && n > 0) n = Math.round(n * 1.2);
  const old = affTier(npc);
  S.aff[npc] = Math.max(0, (S.aff[npc] || 0) + n);
  const nw = affTier(npc);
  if (n !== 0) emit('aff', { npc, n });
  if (nw > old) emit('afftier', { npc, tier: nw });
}

// ---------- 时间 ----------
export const PHASE_MINUTES = 100;
export function phaseInfo() { return PHASES[S.phase]; }
export function todayClasses() { return WEEK_SCHEDULE[S.day % 7]; }
export function isExamDay() { return EXAM_DAYS.includes(S.day % 21); }
export function dateStr() {
  const month = 9 + Math.floor(S.day / 30);
  const d = (S.day % 30) + 1;
  return `${['九', '十', '十一', '十二'][month - 9] || month}月${d}日 · 第${S.day + 1}天`;
}
export function advancePhase(n = 1) {
  for (let i = 0; i < n; i++) {
    S.phase++;
    S.minute = 0;
    if (S.phase >= PHASES.length) { S.phase = 0; S.day++; onNewDay(); }
    emit('phase', { day: S.day, phase: S.phase });
  }
  emit('hud');
}
function onNewDay() {
  // 天气:20% 雨天
  S.weather = Math.random() < 0.22 ? 'rain' : 'clear';
  emit('newday', S.day);
}
export function tickTime(dt) {
  // 一个阶段现实中约 5 分钟;上课/睡觉会直接跳阶段
  S.minute += dt * (100 / 300);
  S.playTime += dt;
  if (S.minute >= PHASE_MINUTES) advancePhase();
}

// ---------- 学业 ----------
export function addGrade(cls, score) {
  const g = S.grades[cls] || (S.grades[cls] = { score: 0, sessions: 0 });
  g.score += score; g.sessions++;
  S.credits += Math.round(score / 10);
  S.stats.classes++;
  emit('hud');
}

// ---------- 存档 ----------
const SAVE_KEY = (i) => `hg_save_${i}`;
export function saveGame(slot = S.slot) {
  S.slot = slot;
  const data = JSON.stringify({ ...S, savedAt: Date.now(), ver: 1 });
  localStorage.setItem(SAVE_KEY(slot), data);
  emit('toast', { text: '📜 进度已记录' });
}
export function loadGame(slot) {
  const raw = localStorage.getItem(SAVE_KEY(slot));
  if (!raw) return false;
  try {
    const d = JSON.parse(raw);
    Object.assign(S, d); S.slot = slot; S.started = true;
    return true;
  } catch { return false; }
}
export function saveList() {
  return [0, 1, 2].map((i) => {
    const raw = localStorage.getItem(SAVE_KEY(i));
    if (!raw) return { slot: i, empty: true };
    try { const d = JSON.parse(raw); return { slot: i, empty: false, name: d.name, house: d.house, level: d.level, day: d.day, savedAt: d.savedAt }; }
    catch { return { slot: i, empty: true }; }
  });
}
export function hasAnySave() { return saveList().some((s) => !s.empty); }
export function deleteSave(i) { localStorage.removeItem(SAVE_KEY(i)); }

// 自动存档节流
let _autoT = 0;
export function autoSave(dt) { _autoT += dt; if (_autoT > 45) { _autoT = 0; if (S.started) saveGame(); } }
