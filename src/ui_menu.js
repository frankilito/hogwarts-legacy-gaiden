// ui_menu.js — Tab 主面板:状态/背包/技能/任务/地图/日程
import { S, emit, xpNeed, AFF_NAMES, affTier, heal, restoreMp, removeItem, saveGame } from './state.js';
import { HOUSES, TALENTS, TRAITS, ITEMS, SPELLS, CLASSES, WEEK_SCHEDULE, WEEK_NAMES, EXAM_DAYS, NPCS, PHASES } from './data.js';
import { QUESTS } from './story.js';
import { Input } from './input.js';
import { teleport, fadeTransition, P } from './player.js';
import { toast } from './ui.js';
import { npcs } from './npc.js';

const $ = (id) => document.getElementById(id);
const TABS = [['status', '状态'], ['bag', '背包'], ['skills', '技能'], ['quests', '任务'], ['map', '地图'], ['sched', '日程']];
let curTab = 'status';
let open = false;

// ---------- 技能树 ----------
export const SKILL_NODES = [
  { id: 'root', name: '魔杖亲和', icon: '🪄', x: 50, y: 88, cost: 0, desc: '你与魔杖心意相通(初始已掌握)', free: true },
  // 元素
  { id: 'power1', name: '魔力增幅 I', icon: '✨', x: 26, y: 68, cost: 1, req: 'root', desc: '咒语伤害 +12%' },
  { id: 'burnPlus', name: '烈焰余烬', icon: '🔥', x: 18, y: 48, cost: 1, req: 'power1', desc: '灼烧持续时间翻倍' },
  { id: 'fulmen', name: '雷电咒', icon: '⚡', x: 26, y: 28, cost: 2, req: 'burnPlus', desc: '解锁咒语:雷电咒(链状电弧)' },
  { id: 'power2', name: '魔力增幅 II', icon: '💥', x: 14, y: 12, cost: 2, req: 'fulmen', desc: '咒语伤害再 +12%' },
  // 守护
  { id: 'hp1', name: '坚韧体魄', icon: '❤', x: 50, y: 62, cost: 1, req: 'root', desc: '生命上限 +24' },
  { id: 'shieldCheap', name: '盾术精研', icon: '🛡', x: 42, y: 42, cost: 1, req: 'hp1', desc: '护盾法力消耗减半' },
  { id: 'parryPlus', name: '格挡大师', icon: '⚜', x: 50, y: 22, cost: 2, req: 'shieldCheap', desc: '完美格挡窗口延长至 0.4 秒' },
  { id: 'cdr', name: '咒语回环', icon: '⏳', x: 60, y: 8, cost: 2, req: 'parryPlus', desc: '全部咒语冷却 -15%' },
  // 奥秘
  { id: 'mp1', name: '冥想', icon: '🔮', x: 74, y: 68, cost: 1, req: 'root', desc: '法力上限 +20' },
  { id: 'vertere', name: '变形术', icon: '🐑', x: 82, y: 48, cost: 2, req: 'mp1', desc: '解锁咒语:变形术(敌人变木桶)' },
  { id: 'mpRegen', name: '灵光涌动', icon: '💧', x: 74, y: 28, cost: 1, req: 'vertere', desc: '法力自然回复 +100%' },
  { id: 'starxp', name: '星尘亲和', icon: '🌟', x: 86, y: 12, cost: 2, req: 'mpRegen', desc: '所有经验获取 +10%' },
];
function canLearn(n) {
  if (S.learned[n.id]) return false;
  if (n.free) return true;
  if (S.skillPoints < n.cost) return false;
  return !n.req || S.learned[n.req];
}
function learnSkill(n) {
  if (!canLearn(n)) return;
  S.skillPoints -= n.cost;
  S.learned[n.id] = 1;
  if (n.id === 'hp1') { S.hpMax += 24; S.hp += 24; }
  if (n.id === 'mp1') { S.mpMax += 20; S.mp += 20; }
  if (n.id === 'power1' || n.id === 'power2') S.learned.power = (S.learned.power || 0) + 1;
  if (n.id === 'fulmen' && !S.spells.includes('fulmen')) { S.spells.push('fulmen'); toast('⚡ 解锁咒语:雷电咒!可在下方槽位装备', true); }
  if (n.id === 'vertere' && !S.spells.includes('vertere')) { S.spells.push('vertere'); toast('🐑 解锁咒语:变形术!', true); }
  emit('hud'); emit('sfx', 'chime');
  saveGame();
}

// ---------- 面板 ----------
export function toggleMenu(tab = null) {
  open = !open || (tab && tab !== curTab);
  if (tab) curTab = tab;
  if (open) {
    $('menuPanel').classList.remove('hidden');
    Input.enabled = false;
    document.exitPointerLock?.();
    renderMenu();
  } else closeMenu();
}
export function closeMenu() {
  open = false;
  $('menuPanel').classList.add('hidden');
  if (!window.__dialogOpen) Input.enabled = true;
}
addEventListener('keydown', (e) => {
  if (!open) return;
  if (e.code === 'Escape' || e.code === 'Tab') { e.preventDefault(); closeMenu(); }
  const n = +e.key;
  if (n >= 1 && n <= TABS.length) { curTab = TABS[n - 1][0]; renderMenu(); }
});

function renderMenu() {
  const tabs = $('mpTabs');
  tabs.innerHTML = TABS.map(([id, name], i) => `<button class="mp-tab ${curTab === id ? 'sel' : ''}" data-t="${id}">${i + 1}·${name}</button>`).join('');
  tabs.querySelectorAll('.mp-tab').forEach((el) => { el.onclick = () => { curTab = el.dataset.t; renderMenu(); }; });
  const body = $('mpBody');
  if (curTab === 'status') { body.innerHTML = renderStatus(); wireSlotEditor(body); }
  if (curTab === 'bag') { body.innerHTML = renderBag(); wireBag(body); }
  if (curTab === 'skills') { body.innerHTML = renderSkills(); wireSkills(body); }
  if (curTab === 'quests') { body.innerHTML = renderQuests(); wireQuests(body); }
  if (curTab === 'map') { body.innerHTML = renderMap(); wireMap(body); }
  if (curTab === 'sched') body.innerHTML = renderSched();
}

function renderStatus() {
  const h = HOUSES[S.house];
  const affRows = Object.entries(S.aff).filter(([id]) => NPCS[id]).sort((a, b) => b[1] - a[1]).map(([id, v]) => {
    const t = affTier(id);
    return `<div class="sched-row"><span>${NPCS[id].icon}</span><span style="flex:1">${NPCS[id].name}<br><span style="font-size:11.5px;color:#8d8064">${NPCS[id].role}</span></span>
      <span style="color:#d88ea6">${'♥'.repeat(t)}${'♡'.repeat(4 - t)} ${AFF_NAMES[t]} (${v})</span></div>`;
  }).join('') || '<div style="color:#8d8064;padding:12px">还没有认识的人——去和大家聊聊吧!</div>';
  return `<div style="display:flex;gap:24px;flex-wrap:wrap">
    <div style="flex:1;min-width:280px">
      <h3 style="color:${h.uiColor};letter-spacing:3px;font-size:22px">${h.emoji} ${S.name}</h3>
      <div style="color:var(--ink-dim);margin:4px 0 12px">${h.name} · ${TALENTS[S.talent].name} · ${TRAITS[S.trait].name}之人</div>
      <div class="sched-row"><span>等级</span><span style="flex:1"></span><b>Lv.${S.level}</b> <span style="color:#8d8064;font-size:12px">(${S.xp}/${xpNeed(S.level)})</span></div>
      <div class="sched-row"><span>生命 / 法力</span><span style="flex:1"></span><b>${Math.ceil(S.hp)}/${S.hpMax} · ${Math.ceil(S.mp)}/${S.mpMax}</b></div>
      <div class="sched-row"><span>学分</span><span style="flex:1"></span><b>${S.credits}</b></div>
      <div class="sched-row"><span>金币</span><span style="flex:1"></span><b style="color:#e8c96a">🪙 ${S.gold}</b></div>
      <div class="sched-row"><span>决斗战绩 / 击退骸骨</span><span style="flex:1"></span><b>${S.stats.duels} 胜 · ${S.stats.enemies}</b></div>
      <div class="sched-row"><span>技能点</span><span style="flex:1"></span><b style="color:#8fb8ff">${S.skillPoints}</b></div>
      <div class="divider"></div>
      <h3 style="color:var(--gold);font-size:16px;letter-spacing:2px;margin-bottom:6px">咒语槽(点击更换)</h3>
      <div style="display:flex;gap:8px" id="slotEdit">${S.slots.map((sid, i) => `<button class="cc-opt" data-slot="${i}">${i + 1} ${SPELLS[sid]?.icon || ''} ${SPELLS[sid]?.name || '空'}</button>`).join('')}</div>
      <div id="slotPick" style="margin-top:8px"></div>
    </div>
    <div style="flex:1;min-width:280px">
      <h3 style="color:var(--gold);font-size:16px;letter-spacing:2px;margin-bottom:6px">人际关系</h3>
      <div style="max-height:380px;overflow:auto">${affRows}</div>
    </div>
  </div>`;
}

function renderBag() {
  const entries = Object.entries(S.inv).filter(([id]) => ITEMS[id] || id.startsWith('furn_'));
  return `<div style="display:flex;gap:20px;flex-wrap:wrap">
    <div style="flex:1.4;min-width:300px"><div class="inv-grid">
      ${entries.map(([id, n]) => {
        const it = ITEMS[id] || { icon: '🪑', name: id.replace('furn_', '家具:') };
        return `<div class="inv-slot" data-item="${id}" title="${it.name}"><span>${it.icon}</span><span class="cnt">${n}</span></div>`;
      }).join('') || '<div style="color:#8d8064">空空如也</div>'}
    </div></div>
    <div style="flex:1;min-width:240px"><div class="item-detail" id="itemDetail">点击物品查看详情</div></div>
  </div>`;
}
function wireBag(body) {
  body.querySelectorAll('.inv-slot').forEach((el) => {
    el.onclick = () => {
      const id = el.dataset.item;
      const it = ITEMS[id];
      const d = $('itemDetail');
      if (!it) { d.innerHTML = '一件家具,可在寝室布置模式中摆放。'; return; }
      d.innerHTML = `<h3 style="color:var(--gold-hi)">${it.icon} ${it.name}</h3><p style="color:var(--ink-dim);margin:8px 0;line-height:1.6">${it.desc}</p>
        ${it.type === 'potion' ? `<button class="btn small" id="useItem">使用</button>` : it.type === 'gift' ? '<span style="font-size:12.5px;color:#d88ea6">可以在对话中赠送给朋友</span>' : ''}`;
      const ub = $('useItem');
      if (ub) ub.onclick = () => {
        if (it.effect?.hp) heal(it.effect.hp);
        if (it.effect?.mp) restoreMp(it.effect.mp);
        if (it.effect?.luck) toast('🍀 你感到幸运环绕(好感与掉落提升)');
        removeItem(id, 1);
        emit('sfx', 'potion');
        renderMenu();
      };
    };
  });
  // 咒语槽编辑(状态页)
  body.querySelectorAll('#slotEdit .cc-opt').forEach((el) => {});
}

function renderSkills() {
  return `<div style="display:flex;gap:14px;height:100%">
    <div style="flex:1;position:relative;min-height:420px" id="skillCanvas">
      <svg style="position:absolute;inset:0;width:100%;height:100%;pointer-events:none" id="skillLines"></svg>
      ${SKILL_NODES.map((n) => {
        const state = S.learned[n.id] || n.free ? 'learned' : canLearn(n) ? 'avail' : 'locked';
        return `<div class="sk-node ${state}" style="left:${n.x}%;top:${n.y}%" data-sk="${n.id}">${n.icon}</div>`;
      }).join('')}
      <div style="position:absolute;left:12px;top:8px;color:#8fb8ff;font-size:15px">技能点:${S.skillPoints}</div>
      <div style="position:absolute;left:16%;top:2%;color:#c96a4a;font-size:13px;letter-spacing:2px">🔥 元素</div>
      <div style="position:absolute;left:48%;top:2%;color:#8fd0ff;font-size:13px;letter-spacing:2px">🛡 守护</div>
      <div style="position:absolute;left:78%;top:2%;color:#b89aff;font-size:13px;letter-spacing:2px">🔮 奥秘</div>
    </div>
    <div style="width:250px"><div class="item-detail" id="skillDetail" style="min-height:180px">点击节点查看 · 双击学习</div></div>
  </div>`;
}
function wireSkills(body) {
  // 连线
  const svg = $('skillLines');
  const box = $('skillCanvas');
  setTimeout(() => {
    const w = box.clientWidth, h = box.clientHeight;
    svg.innerHTML = SKILL_NODES.filter((n) => n.req).map((n) => {
      const r = SKILL_NODES.find((x) => x.id === n.req);
      const col = S.learned[n.id] ? '#e9d9a8' : S.learned[n.req] || r.free ? '#6a7a9a' : '#3a3a44';
      return `<line x1="${r.x / 100 * w}" y1="${r.y / 100 * h}" x2="${n.x / 100 * w}" y2="${n.y / 100 * h}" stroke="${col}" stroke-width="2"/>`;
    }).join('');
  }, 30);
  body.querySelectorAll('.sk-node').forEach((el) => {
    const n = SKILL_NODES.find((x) => x.id === el.dataset.sk);
    el.onclick = () => {
      $('skillDetail').innerHTML = `<h3 style="color:var(--gold-hi)">${n.icon} ${n.name}</h3>
        <p style="color:var(--ink-dim);margin:8px 0;line-height:1.65">${n.desc}</p>
        <div style="color:#8fb8ff;font-size:13px">消耗:${n.cost} 技能点${n.req ? ` · 前置:${SKILL_NODES.find((x) => x.id === n.req).name}` : ''}</div>
        ${S.learned[n.id] || n.free ? '<div style="color:#8ae09a;margin-top:8px">✓ 已掌握</div>' : canLearn(n) ? `<button class="btn small primary" id="learnBtn" style="margin-top:10px">学习</button>` : '<div style="color:#8d8064;margin-top:8px">尚未解锁</div>'}`;
      const lb = $('learnBtn');
      if (lb) lb.onclick = () => { learnSkill(n); renderMenu(); };
    };
  });
  // 咒语槽编辑挂在状态页,但也放这里以防
  wireSlotEditor(body);
}
function wireSlotEditor(body) {
  body.querySelectorAll('#slotEdit .cc-opt').forEach((el) => {
    el.onclick = () => {
      const idx = +el.dataset.slot;
      const pick = $('slotPick');
      pick.innerHTML = S.spells.map((sid) => `<button class="cc-opt" data-sp="${sid}" style="margin:3px">${SPELLS[sid].icon} ${SPELLS[sid].name}</button>`).join('');
      pick.querySelectorAll('[data-sp]').forEach((b) => {
        b.onclick = () => { S.slots[idx] = b.dataset.sp; emit('hud'); renderMenu(); };
      });
    };
  });
}

function renderQuests() {
  const rows = Object.entries(S.quests).map(([id, st]) => {
    const q = QUESTS[id];
    if (!q) return '';
    const stepTxt = st.done ? '<span class="done">✓ 已完成</span>' : (q.steps[st.step]?.text || '');
    return `<div class="q-item ${S.tracked === id ? 'tracked' : ''}" data-q="${id}">
      <h4>${q.name}<span class="tag">${q.type}</span></h4>
      <p>${stepTxt}</p>
      ${!st.done ? `<p style="color:#6d84ab;font-size:12px">${st.step + 1} / ${q.steps.length} 阶段 · 点击追踪</p>` : ''}
    </div>`;
  }).join('');
  return `<div style="max-width:640px;margin:0 auto">${rows || '<div style="color:#8d8064;padding:16px">任务簿是空的。和城堡里的人聊聊吧!</div>'}</div>`;
}
function wireQuests(body) {
  body.querySelectorAll('.q-item').forEach((el) => {
    el.onclick = () => { S.tracked = el.dataset.q; emit('quest'); renderMenu(); };
  });
}

const MAP_ROOMS = [
  { id: 'astro', x: 40, y: 2, w: 20, h: 13, ic: '🔭', tip: '经楼梯厅连桥上塔 · 夜晚观星/钥匙星座' },
  { id: 'hall', x: 30, y: 20, w: 28, h: 24, ic: '🏰', tip: '开学宴会 · 黑魔法防御课 · 教师们常在此' },
  { id: 'library', x: 66, y: 22, w: 26, h: 17, ic: '📚', tip: '薇拉在这读书 · 深夜禁书区有秘密' },
  { id: 'greenhouse', x: 2, y: 44, w: 20, h: 16, ic: '🌿', tip: '草药课 · 夜晚月光花开 · 波比常来' },
  { id: 'courtyard', x: 25, y: 49, w: 18, h: 17, ic: '⛲', tip: '黄昏决斗社 · 通往温室与禁林' },
  { id: 'stair', x: 46, y: 49, w: 24, h: 18, ic: '🌀', tip: '城堡中枢 · 提基小摊 · 双旋梯上天文塔' },
  { id: 'potions', x: 74, y: 44, w: 22, h: 15, ic: '⚗', tip: '魔药课 · 格雷的坩埚(调制药剂)' },
  { id: 'forest', x: 2, y: 66, w: 20, h: 17, ic: '🌲', tip: '黄昏后开放 · 采集材料 · 小心骸骨', cond: () => S.phase >= 3 || !!S.flags.forestFree },
  { id: 'dorm', x: 40, y: 74, w: 21, h: 17, ic: '🛏', tip: '睡觉过夜 · 布置房间 · 猫头鹰邮购' },
  { id: 'dungeon', x: 70, y: 74, w: 22, h: 17, ic: '🕳', tip: '主线解锁的地下迷宫 · 机关与守卫', cond: () => !!S.flags.dungeonOpen },
];
const MAP_LINKS = [
  ['astro', 'stair'], ['hall', 'stair'], ['library', 'stair'], ['stair', 'potions'],
  ['stair', 'dorm'], ['stair', 'dungeon'], ['stair', 'courtyard'], ['courtyard', 'greenhouse'], ['courtyard', 'forest'],
];
const ZONE_NAMES = { hall: '城堡大厅', stair: '楼梯厅', library: '图书馆', greenhouse: '温室', astro: '天文塔', potions: '魔药教室', dorm: '宿舍', dungeon: '地下密室', forest: '禁林', courtyard: '庭院' };

function renderMap() {
  // 实时信息:当前课程地点 / 追踪任务目标 / NPC 分布
  const [am, pm] = WEEK_SCHEDULE[S.day % 7];
  const curClass = S.phase === 1 ? am : S.phase === 2 ? pm : null;
  const classZone = curClass ? CLASSES[curClass].zone : null;
  const tq = S.quests[S.tracked];
  const targetZone = tq && !tq.done ? (QUESTS[S.tracked]?.steps[tq.step]?.zone || null) : null;
  // NPC 分布
  let npcByZone = {};
  try {
    for (const [id, n] of npcs) {
      if (!n.zone) continue;
      (npcByZone[n.zone] = npcByZone[n.zone] || []).push(n.def);
    }
  } catch { /* npc 模块未就绪 */ }

  const roomHtml = MAP_ROOMS.map((r) => {
    const locked = r.cond && !r.cond();
    const isCur = S.zone === r.id;
    const isTarget = targetZone === r.id;
    const isClass = classZone === r.id;
    const residents = (npcByZone[r.id] || []).slice(0, 7).map((d) => `<span title="${d.name}">${d.icon}</span>`).join('');
    return `<div class="map-room ${isCur ? 'cur' : ''} ${isTarget ? 'target' : ''}" data-z="${r.id}" title="${r.tip}"
      style="left:${r.x}%;top:${r.y}%;width:${r.w}%;height:${r.h}%;${locked ? 'opacity:.4;filter:grayscale(.6)' : ''}">
      <div style="font-size:13px;letter-spacing:1px">${r.ic} ${ZONE_NAMES[r.id]}
        ${isCur ? '<span class="map-me">●你</span>' : ''}${isTarget ? ' <span style="color:#ffd75a">★</span>' : ''}${isClass ? ' <span title="正在上课">🔔</span>' : ''}${locked ? ' 🔒' : ''}</div>
      <div class="map-npcs">${residents}</div>
    </div>`;
  }).join('');
  // 连线
  const C = (id) => { const r = MAP_ROOMS.find((x) => x.id === id); return [r.x + r.w / 2, r.y + r.h / 2]; };
  const lines = MAP_LINKS.map(([a, b]) => {
    const [x1, y1] = C(a), [x2, y2] = C(b);
    return `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="rgba(201,168,106,.4)" stroke-width="0.7" stroke-dasharray="2 1.4"/>`;
  }).join('');
  return `<div style="position:relative;height:470px;max-width:820px;margin:0 auto;border:1px solid rgba(201,168,106,.35);border-radius:12px;overflow:hidden;
      background:radial-gradient(ellipse at 50% 30%, rgba(74,58,32,.55), rgba(26,20,12,.9)),repeating-linear-gradient(45deg, rgba(201,168,106,.03) 0 8px, transparent 8px 16px)">
    <div style="position:absolute;top:6px;left:0;right:0;text-align:center;color:#c9a86a;font-size:15px;letter-spacing:6px;font-family:'MaShan',serif">— 活 点 地 图 —</div>
    <svg viewBox="0 0 100 100" preserveAspectRatio="none" style="position:absolute;inset:0;width:100%;height:100%;pointer-events:none">${lines}</svg>
    ${roomHtml}
    <div style="position:absolute;bottom:6px;left:12px;right:12px;display:flex;justify-content:space-between;color:#847758;font-size:12px">
      <span>● 你的位置 · ★ 任务目标 · 🔔 正在上课 · 小图标=此刻在场的人</span>
      <span>点击房间即可快速移动</span>
    </div>
  </div>
  <div style="max-width:820px;margin:8px auto 0;color:#9c8f74;font-size:12.5px;line-height:1.7">
    ${targetZone ? `📜 <b style="color:#ffd75a">${QUESTS[S.tracked].name}</b>:前往 <b>${ZONE_NAMES[targetZone]}</b> —— 世界里跟着门上的<b style="color:#ffd75a">金色箭头</b>走就不会迷路` : '当前没有带地点的追踪任务。在「任务」页点击任务可切换追踪。'}
    ${curClass ? ` · 🔔 现在是<b>${CLASSES[curClass].name}</b>时间(${ZONE_NAMES[classZone]})` : ''}
  </div>`;
}
function wireMap(body) {
  body.querySelectorAll('.map-room').forEach((el) => {
    el.onclick = () => {
      const id = el.dataset.z;
      const r = MAP_ROOMS.find((x) => x.id === id);
      if (r.cond && !r.cond()) { toast('还没有发现那里的入口。'); return; }
      if (id === 'forest' && S.phase < 3 && !S.flags.forestFree) { toast('禁林黄昏后才开放。'); return; }
      if (id === S.zone) { closeMenu(); return; }
      closeMenu();
      fadeTransition(() => teleport(id));
    };
  });
}

function renderSched() {
  const today = S.day % 7;
  const rows = WEEK_NAMES.map((wn, d) => {
    const [am, pm] = WEEK_SCHEDULE[d];
    const isExam = EXAM_DAYS.includes((S.day - today + d) % 21) && d >= today;
    return `<div class="sched-row ${d === today ? 'now' : ''}">
      <span class="time">${wn}${d === today ? ' ·今天' : ''}</span>
      <span style="flex:1">上午:${am ? CLASSES[am].icon + CLASSES[am].name : '—'} / 午后:${pm ? CLASSES[pm].icon + CLASSES[pm].name : isExam ? '🖋 学期考试' : '—'}</span>
      <span style="color:#8d8064;font-size:12px">${d === 5 ? '决斗社(黄昏)' : d === 6 ? '天文课(夜)' : ''}</span>
    </div>`;
  }).join('');
  const gradeRows = Object.entries(S.grades).map(([cid, g]) => `<div class="sched-row"><span>${CLASSES[cid].icon} ${CLASSES[cid].name}</span><span style="flex:1"></span><b>${(g.score / Math.max(1, g.sessions)).toFixed(0)} 均分 · ${g.sessions} 次课</b></div>`).join('') || '<div style="color:#8d8064;padding:10px">还没上过课</div>';
  return `<div style="display:flex;gap:22px;flex-wrap:wrap">
    <div style="flex:1;min-width:300px"><h3 style="color:var(--gold);letter-spacing:2px;margin-bottom:8px">一周课表</h3>${rows}
      <div style="color:#847758;font-size:12.5px;margin-top:8px">六阶段作息:清晨 → 上午(课) → 午后(课) → 黄昏(社团) → 夜晚 → 深夜(宵禁)</div></div>
    <div style="flex:1;min-width:260px"><h3 style="color:var(--gold);letter-spacing:2px;margin-bottom:8px">学业成绩</h3>${gradeRows}
      <div class="divider"></div><div class="sched-row"><span>累计学分</span><span style="flex:1"></span><b>${S.credits}</b></div>
      <div class="sched-row"><span>下次考试</span><span style="flex:1"></span><b>第 ${Math.ceil((S.day % 21 < 20 ? 20 : 41) )}天前后</b></div></div>
  </div>`;
}
