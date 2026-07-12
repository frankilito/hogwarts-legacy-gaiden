// ui.js — HUD/菜单/面板(基础版,持续扩展)
import { S, on, emit, saveList, loadGame, saveGame, hasAnySave, xpNeed, phaseInfo, dateStr } from './state.js';
import { HOUSES, TALENTS, TRAITS, BODIES, HAIRS, HAIR_COLORS, SKINS, SPELLS, PHASES } from './data.js';
import { applyQuality, E } from './engine.js';
import { Input } from './input.js';
import { P, createPlayerRig, teleport } from './player.js';

const $ = (id) => document.getElementById(id);

export function initUI() {
  on('toast', ({ text, big }) => toast(text, big));
  addEventListener('hg-toast', (e) => toast(e.detail));
  on('hud', refreshHUD);
  on('zone', () => { $('hudZone').textContent = zoneName(); refreshHUD(); });
  on('phase', refreshHUD);
  on('quest', refreshObjective);
  on('companion', refreshObjective);
  wireMainMenu();
  buildSpellbar();
}

async function refreshObjective() {
  const { QUESTS } = await import('./story.js');
  const el = $('hudObjective');
  const st = S.quests[S.tracked];
  const q = QUESTS[S.tracked];
  let html = '';
  if (q && st && !st.done) {
    html = `<div class="qname">📜 ${q.name}</div><div class="qstep">${q.steps[st.step]?.text || ''}</div>`;
  }
  if (S.companion) {
    const { NPCS } = await import('./data.js');
    html += `<div class="qstep" style="color:#e8b8d0;margin-top:6px">💞 同伴:${NPCS[S.companion]?.name || ''}</div>`;
  }
  el.innerHTML = html;
}

function zoneName() {
  const names = { hall: '城堡大厅', stair: '大理石楼梯厅', library: '图书馆', greenhouse: '三号温室', astro: '天文塔顶', potions: '魔药教室', dorm: '学院宿舍', dungeon: '地下密室', forest: '禁林', courtyard: '回廊庭院' };
  return names[S.zone] || S.zone;
}

// ---------- toast ----------
export function toast(text, big = false) {
  const t = document.createElement('div');
  t.className = 'toast' + (big ? ' big' : '');
  t.textContent = text;
  $('toasts').appendChild(t);
  setTimeout(() => { t.style.transition = 'opacity .5s, transform .5s'; t.style.opacity = '0'; t.style.transform = 'translateY(-10px)'; }, big ? 2600 : 1900);
  setTimeout(() => t.remove(), big ? 3200 : 2500);
}

// ---------- HUD ----------
export function refreshHUD() {
  if (!S.started) return;
  $('hpFill').style.width = (S.hp / S.hpMax * 100) + '%';
  $('mpFill').style.width = (S.mp / S.mpMax * 100) + '%';
  $('hpTxt').textContent = `${Math.ceil(S.hp)} / ${S.hpMax}`;
  $('mpTxt').textContent = `${Math.ceil(S.mp)} / ${S.mpMax}`;
  $('xpFill').style.width = (S.xp / xpNeed(S.level) * 100) + '%';
  $('lvNum').textContent = 'Lv.' + S.level;
  $('hudName').textContent = S.name;
  const h = HOUSES[S.house];
  $('hudHouse').textContent = h ? h.emoji + ' ' + h.name : '';
  $('hudHouse').style.color = h?.uiColor || '#fff';
  $('hudGold').textContent = '🪙 ' + S.gold;
  $('hudDate').textContent = dateStr();
  const ph = phaseInfo();
  $('hudPhase').textContent = `${ph.icon} ${ph.name}` + (S.weather === 'rain' ? ' · 🌧 雨' : '');
  $('hudZone').textContent = zoneName();
  drawClock();
  buildSpellbar();
}

function drawClock() {
  const c = $('hudClock'); if (!c) return;
  const g = c.getContext('2d');
  const W = c.width;
  g.clearRect(0, 0, W, W);
  g.save(); g.translate(W / 2, W / 2);
  g.beginPath(); g.arc(0, 0, W / 2 - 4, 0, 7);
  g.fillStyle = 'rgba(12,10,6,.72)'; g.fill();
  g.strokeStyle = 'rgba(201,168,106,.7)'; g.lineWidth = 2.5; g.stroke();
  // 6 阶段刻度
  for (let i = 0; i < 6; i++) {
    const a = i / 6 * Math.PI * 2 - Math.PI / 2;
    g.fillStyle = i === S.phase ? '#f0d9a8' : 'rgba(201,168,106,.4)';
    g.beginPath(); g.arc(Math.cos(a) * (W / 2 - 13), Math.sin(a) * (W / 2 - 13), i === S.phase ? 5 : 3, 0, 7); g.fill();
  }
  // 指针
  const prog = (S.phase + S.minute / 100) / 6 * Math.PI * 2 - Math.PI / 2;
  g.strokeStyle = '#f0d9a8'; g.lineWidth = 3; g.lineCap = 'round';
  g.beginPath(); g.moveTo(0, 0); g.lineTo(Math.cos(prog) * (W / 2 - 20), Math.sin(prog) * (W / 2 - 20)); g.stroke();
  g.fillStyle = '#f0d9a8'; g.beginPath(); g.arc(0, 0, 4, 0, 7); g.fill();
  g.restore();
}

function buildSpellbar() {
  const bar = $('spellbar'); if (!bar) return;
  bar.innerHTML = '';
  S.slots.forEach((sid, i) => {
    const sp = SPELLS[sid];
    const el = document.createElement('div');
    el.className = 'spell-slot';
    el.innerHTML = `<span class="key">${i + 1}</span><span>${sp ? sp.icon : ''}</span><span class="nm">${sp ? sp.name : '—'}</span>`;
    el.dataset.slot = i;
    bar.appendChild(el);
  });
}
export function setSlotCooldown(i, remain, total) {
  const el = $('spellbar')?.children[i];
  if (!el) return;
  let cd = el.querySelector('.cd');
  if (remain > 0) {
    if (!cd) { cd = document.createElement('div'); cd.className = 'cd'; el.appendChild(cd); }
    cd.textContent = remain > 1 ? Math.ceil(remain) : remain.toFixed(1);
  } else cd?.remove();
}

// ---------- 提示 ----------
export function setPrompt(html) {
  const p = $('hudPrompt');
  if (!html) { p.classList.add('hidden'); return; }
  p.classList.remove('hidden');
  p.innerHTML = html;
}
export function subtitle(text, dur = 3000) {
  const el = $('subtitle');
  el.textContent = text;
  clearTimeout(el._t);
  el._t = setTimeout(() => { el.textContent = ''; }, dur);
}
export function damageNumber(worldPos, text, cls = '') {
  const v = worldPos.clone().project(E.camera);
  if (v.z > 1) return;
  const el = document.createElement('div');
  el.className = 'dmg ' + cls;
  el.textContent = text;
  el.style.left = ((v.x * 0.5 + 0.5) * innerWidth + (Math.random() * 30 - 15)) + 'px';
  el.style.top = ((-v.y * 0.5 + 0.5) * innerHeight - 20) + 'px';
  $('dmgLayer').appendChild(el);
  setTimeout(() => el.remove(), 800);
}

// ---------- 主菜单 ----------
function wireMainMenu() {
  $('btnContinue').onclick = () => {
    const list = saveList().filter((s) => !s.empty).sort((a, b) => b.savedAt - a.savedAt);
    if (!list.length) return;
    startFromSave(list[0].slot);
  };
  $('btnNew').onclick = () => { $('mainmenu').classList.add('hidden'); openCharCreate(); };
  $('btnLoad').onclick = () => openSaveList();
  $('btnMpMenu').onclick = () => window.__sys?.net?.openMpMenu?.();
  $('btnSettings').onclick = () => openSettings();
}
export function showMainMenu() {
  $('mainmenu').classList.remove('hidden');
  $('btnContinue').disabled = !hasAnySave();
  // 背景:让相机在大厅缓慢漂移
  S.started = false;
  import('./castle.js').then((m) => {
    m.setZone('hall');
    window.__menuCam = true;
  });
}
export function hideAllMenus() { ['mainmenu', 'charcreate', 'menuPanel', 'minigame', 'mpMenu'].forEach((id) => $(id)?.classList.add('hidden')); }

function startFromSave(slot) {
  if (!loadGame(slot)) return;
  hideAllMenus();
  window.__menuCam = false;
  createPlayerRig();
  teleport(S.zone || 'hall');
  $('hud').classList.remove('hidden');
  refreshHUD();
  emit('gamestart', { fresh: false });
  toast(`欢迎回来,${S.name}`, true);
}

// ---------- 角色创建 ----------
const cc = { name: '', house: 'gryffindor', talent: 'elemental', trait: 'brave', body: 'Mage', hair: 'short', hairColor: 0, skin: 0 };
function openCharCreate() {
  $('charcreate').classList.remove('hidden');
  const houses = $('ccHouses'); houses.innerHTML = '';
  Object.entries(HOUSES).forEach(([id, h]) => {
    const el = document.createElement('button');
    el.className = 'cc-opt house-card' + (cc.house === id ? ' sel' : '');
    el.innerHTML = `<b style="color:${h.uiColor}">${h.emoji} ${h.name}</b><span class="en">${h.en}</span><p>${h.trait}</p>`;
    el.onclick = () => { cc.house = id; openCharCreate(); previewRig(); };
    houses.appendChild(el);
  });
  const mk = (rootId, obj, key, entries, renderer) => {
    const root = $(rootId); root.innerHTML = '';
    entries.forEach(([id, v]) => {
      const el = document.createElement('button');
      el.className = 'cc-opt' + (obj[key] === id ? ' sel' : '');
      el.innerHTML = renderer(v);
      el.onclick = () => { obj[key] = id; openCharCreate(); previewRig(); };
      root.appendChild(el);
    });
  };
  mk('ccTalents', cc, 'talent', Object.entries(TALENTS), (v) => `${v.icon} ${v.name}<span class="tag">${v.desc}</span>`);
  mk('ccTraits', cc, 'trait', Object.entries(TRAITS), (v) => `${v.icon} ${v.name}<span class="tag">${v.desc}</span>`);
  mk('ccBodies', cc, 'body', BODIES.map((b) => [b.id, b]), (v) => `${v.name}<span class="tag">${v.tag}</span>`);
  mk('ccHairs', cc, 'hair', HAIRS.map((h) => [h.id, h]), (v) => v.name);
  const swat = (rootId, colors, key) => {
    const root = $(rootId); root.innerHTML = '';
    colors.forEach((c, i) => {
      const el = document.createElement('div');
      el.className = 'swatch' + (cc[key] === i ? ' sel' : '');
      el.style.background = '#' + c.toString(16).padStart(6, '0');
      el.onclick = () => { cc[key] = i; openCharCreate(); previewRig(); };
      root.appendChild(el);
    });
  };
  swat('ccHairColors', HAIR_COLORS, 'hairColor');
  swat('ccSkins', SKINS, 'skin');
  $('ccBack').onclick = () => { $('charcreate').classList.add('hidden'); showMainMenu(); };
  $('ccDone').onclick = confirmCreate;
  previewRig();
}
let _previewTimer = null;
function previewRig() {
  clearTimeout(_previewTimer);
  _previewTimer = setTimeout(() => {
    Object.assign(S, { house: cc.house, body: cc.body, hair: cc.hair, hairColor: cc.hairColor, skin: cc.skin });
    createPlayerRig();
    import('./castle.js').then(async (m) => {
      m.setZone('dorm');
      const zn = m.zones.get('dorm');
      // 站在休息室西侧空地(避开中央圆桌),身后是壁炉光
      P.pos.set(zn.offset.x - 7, 0, zn.offset.z + 10);
      P.rig.group.position.copy(P.pos);
      P.rig.group.rotation.y = 0.15; // 面向镜头(+z 侧)
      P.rig.play('idle');
      // 预览补光:让五官发色看得清
      const THREE = await import('three');
      const key = new THREE.PointLight(0xffe8cc, 26, 9, 2);
      key.position.set(1.2, 2.2, 2.4);
      const fill = new THREE.PointLight(0xcad8ff, 10, 8, 2);
      fill.position.set(-1.6, 1.6, 1.8);
      const rim = new THREE.PointLight(0x8fb8ff, 9, 7, 2);
      rim.position.set(0.4, 2.0, -1.6);
      P.rig.group.add(key, fill, rim);
      window.__ccCam = true;
      window.__ccWaveT = performance.now() + 1200;
    });
  }, 60);
}
function confirmCreate() {
  const name = $('ccName').value.trim() || '新来的学生';
  Object.assign(S, cc, { name, started: true });
  S.slot = saveList().find((s) => s.empty)?.slot ?? 0;
  hideAllMenus();
  window.__ccCam = false; window.__menuCam = false;
  $('hud').classList.remove('hidden');
  createPlayerRig();
  emit('gamestart', { fresh: true });
  refreshHUD();
  saveGame(S.slot);
}

// ---------- 存档列表 ----------
function openSaveList() {
  const body = $('mpMenuBody');
  $('mpMenu').classList.remove('hidden');
  const list = saveList();
  body.innerHTML = `<h2 style="text-align:center;color:var(--gold-hi);letter-spacing:4px;margin-bottom:14px">存 档</h2>` +
    list.map((s) => s.empty
      ? `<div class="q-item" style="opacity:.5">空存档位 ${s.slot + 1}</div>`
      : `<div class="q-item" data-slot="${s.slot}"><h4>${s.name} <span class="tag">${HOUSES[s.house]?.name || ''} Lv.${s.level}</span></h4><p>第 ${s.day + 1} 天 · ${new Date(s.savedAt).toLocaleString()}</p></div>`).join('') +
    `<div style="display:flex;gap:10px;margin-top:14px"><button class="btn" id="svClose" style="flex:1">关闭</button></div>`;
  body.querySelectorAll('.q-item[data-slot]').forEach((el) => {
    el.onclick = () => { $('mpMenu').classList.add('hidden'); startFromSave(+el.dataset.slot); };
  });
  $('svClose').onclick = () => $('mpMenu').classList.add('hidden');
}

// ---------- 设置 ----------
function openSettings() {
  const body = $('mpMenuBody');
  $('mpMenu').classList.remove('hidden');
  body.innerHTML = `<h2 style="text-align:center;color:var(--gold-hi);letter-spacing:4px;margin-bottom:14px">设 置</h2>
    <div class="cc-section"><h3>画质</h3><div class="cc-grid" id="setQ">
      <button class="cc-opt" data-q="low">流畅</button>
      <button class="cc-opt" data-q="med">均衡</button>
      <button class="cc-opt" data-q="high">绚丽</button>
    </div></div>
    <div class="cc-section" style="margin-top:10px"><h3>音量</h3>
      <input type="range" id="setVol" min="0" max="100" value="${Math.round((window.__sys?.audio?.getVolume?.() ?? 0.7) * 100)}" style="width:100%">
    </div>
    <div style="display:flex;gap:10px;margin-top:14px"><button class="btn" id="setClose" style="flex:1">关闭</button></div>`;
  body.querySelectorAll('#setQ .cc-opt').forEach((el) => {
    if (el.dataset.q === (localStorage.getItem('hg_quality') || 'high')) el.classList.add('sel');
    el.onclick = () => { applyQuality(el.dataset.q); body.querySelectorAll('#setQ .cc-opt').forEach((x) => x.classList.remove('sel')); el.classList.add('sel'); };
  });
  $('setVol').oninput = (e) => window.__sys?.audio?.setVolume?.(e.target.value / 100);
  $('setClose').onclick = () => $('mpMenu').classList.add('hidden');
}

// ---------- 每帧 ----------
export function updateUI() {
  // 交互提示
  if (S.started && P.nearInteract && !window.__dialogOpen) {
    const it = P.nearInteract;
    setPrompt(`<span class="k">E</span>${it.icon || '✋'} ${it.label}`);
  } else setPrompt(null);
  // 菜单相机漂移
  if (window.__menuCam) {
    const t = performance.now() / 1000;
    E.camera.position.set(Math.sin(t * 0.1) * 14, 5 + Math.sin(t * 0.07) * 2, 24 + Math.cos(t * 0.08) * 6);
    E.camera.lookAt(0, 3, -10);
  }
  if (window.__ccCam) {
    const zn = window.__activeZoneObj?.();
    if (zn && P.rig) {
      const t = performance.now() / 1000;
      const px = P.rig.group.position;
      // 人物面向镜头,缓慢左右摇摆展示发型与侧脸
      P.rig.group.rotation.y = 0.12 + Math.sin(t * 0.45) * 0.42;
      // 构图:人物在屏幕右侧约 70%(左侧是创建面板)
      E.camera.position.set(px.x + 1.35 + Math.sin(t * 0.18) * 0.15, px.y + 1.5, px.z + 2.75);
      E.camera.lookAt(px.x - 0.85, px.y + 0.92, px.z - 0.1);
      // 偶尔挥手打招呼
      if (performance.now() > (window.__ccWaveT || 0)) {
        window.__ccWaveT = performance.now() + 7000 + Math.random() * 4000;
        P.rig.play('Waving', { once: true, then: 'idle' });
      }
    }
  }
  if (S.started) drawClock();
}
