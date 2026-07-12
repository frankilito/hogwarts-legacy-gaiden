// main.js — 引导与主循环
import * as THREE from 'three';
import { initEngine, renderFrame, E } from './engine.js';
import { initInput, endFrame, Input, pressed } from './input.js';
import { loadFonts, loadModels, loadRestChars } from './assets.js';
import { buildHall, buildStair, buildCourtyard } from './zones.js';
import { buildLibrary, buildGreenhouse, buildAstro, buildPotions, buildDorm } from './zones2.js';
import { buildDungeon, buildForest } from './zones3.js';
import { initBursts, updateBursts, updateFxTicks, updatePortraits, FX } from './fx.js';
import { createPlayerRig, teleport, updatePlayer, P, throughDoor } from './player.js';
import { allRigs } from './rig.js';
import { S, tickTime, autoSave, emit, on, loadGame, hasAnySave } from './state.js';
import { TIPS } from './data.js';

const Q = new URLSearchParams(location.search);
window.__game = { started: false };

const $ = (id) => document.getElementById(id);

async function boot() {
  initEngine($('c'));
  initInput($('c'));
  const tipEl = $('loadtip');
  tipEl.textContent = TIPS[Math.floor(Math.random() * TIPS.length)];
  const tipTimer = setInterval(() => { tipEl.textContent = TIPS[Math.floor(Math.random() * TIPS.length)]; }, 4200);

  await loadFonts();
  await loadModels((p) => {
    $('loadfill').style.width = (p * 88).toFixed(1) + '%';
    $('loadtext').textContent = `正在召集城堡精灵… ${(p * 100 | 0)}%(首次约 25MB,之后有魔法缓存)`;
  });
  loadRestChars(); // 其余角色后台流式加载,不阻塞进场
  $('loadtext').textContent = '正在砌起高塔与回廊…';
  await new Promise((r) => setTimeout(r, 30));
  buildHall(); buildStair(); buildCourtyard();
  await new Promise((r) => setTimeout(r, 10));
  buildLibrary(); buildGreenhouse(); buildAstro(); buildPotions(); buildDorm();
  await new Promise((r) => setTimeout(r, 10));
  buildDungeon(); buildForest();
  const { decorateAll } = await import('./decorate.js');
  decorateAll();
  initBursts();
  $('loadfill').style.width = '100%';
  clearInterval(tipTimer);

  // 各系统(按需初始化,失败不阻塞渲染测试)
  try {
    const [ui, uiMenu, npc, combat, gameplay, dialogue, audio, net] = await Promise.all([
      import('./ui.js'), import('./ui_menu.js'), import('./npc.js'), import('./combat.js'),
      import('./gameplay.js'), import('./dialogue.js'), import('./audio.js'), import('./net.js'),
    ]);
    window.__sys = { ui: { ...ui, ...uiMenu }, npc, combat, gameplay, dialogue, audio, net };
    ui.initUI();
    npc.initNPCs();
    combat.initCombat();
    gameplay.initGameplay();
    net.initNet();
    audio.initAudio?.();
  } catch (e) {
    console.warn('系统初始化(部分)失败:', e);
    window.__sysErr = String(e && e.stack || e);
  }

  $('loading').classList.add('hidden');
  const fader = $('fader');
  fader.style.transition = 'opacity 1.2s';
  requestAnimationFrame(() => { fader.style.opacity = '0'; });

  // 测试直入
  if (Q.has('shot') || Q.has('test') || Q.has('autotest')) {
    S.name = Q.get('name') || '测试员';
    S.house = Q.get('house') || 'gryffindor';
    S.started = true;
    createPlayerRig();
    teleport(Q.get('zone') || 'hall');
    if (Q.get('phase')) { S.phase = +Q.get('phase'); }
    if (Q.get('rain')) S.weather = 'rain';
    $('hud')?.classList.remove('hidden');
    window.__sys?.ui?.refreshHUD?.();
    startLoop();
    if (Q.has('cam')) {
      const [x, y, z, tx, ty, tz] = Q.get('cam').split(',').map(Number);
      window.__freeCam = { x, y, z, tx, ty, tz };
    }
    window.__game.started = true;
    return;
  }

  // 正常流程 → 主菜单
  window.__sys?.ui?.showMainMenu?.();
  startLoop();
  window.__game.started = true;
}

// ---------------- 主循环 ----------------
const clock = new THREE.Clock();
let _acc = 0;
function startLoop() {
  E.renderer.setAnimationLoop(loop);
}
function loop() {
  const dt = Math.min(clock.getDelta(), 0.05);
  FX.time += dt;
  const sys = window.__sys || {};

  if (S.started && !window.__paused) {
    if (!window.__timeFrozen) { tickTime(dt); autoSave(dt); }
    updatePlayer(dt);
    sys.npc?.updateNPCs?.(dt);
    sys.combat?.updateCombat?.(dt);
    sys.gameplay?.updateGameplay?.(dt);
    sys.net?.updateNet?.(dt);
  }
  // 区域内更新器
  const az = window.__activeZoneObj?.();
  if (az) for (const f of az.updaters) f(dt);
  for (const r of allRigs) r.update(dt, FX.time);
  updateBursts(dt);
  updateFxTicks(dt);
  if (S.started && P.pos) updatePortraits(dt, P.pos, S.zone);
  sys.ui?.updateUI?.(dt);
  sys.audio?.updateAudio?.(dt);

  // 自由相机(截图用)
  if (window.__freeCam) {
    const c = window.__freeCam;
    E.camera.position.set(c.x, c.y, c.z);
    E.camera.lookAt(c.tx, c.ty, c.tz);
  }
  renderFrame(dt);
  endFrame();
}

// activeZone 访问桥(避免循环依赖)
import('./castle.js').then((m) => { window.__activeZoneObj = () => m.activeZone; });

boot().catch((e) => {
  console.error('BOOT FAIL', e, e && e.stack);
  $('loadtext').textContent = '启动失败:' + e.message;
});
