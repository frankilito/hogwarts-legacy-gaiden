// dialogue.js — 对话引擎:打字机/分支/好感/运镜
import * as THREE from 'three';
import { S, addAff, affTier, AFF_NAMES, emit } from './state.js';
import { NPCS } from './data.js';
import { Input } from './input.js';
import { E } from './engine.js';
import { P } from './player.js';
import { npcs } from './npc.js';

const $ = (id) => document.getElementById(id);
let cur = null; // {nodes, list, idx, npcId, onEnd, typing, fullText}

export function isOpen() { return !!cur; }

// nodes: { start:[node...], other:[...] } ; node: {sp,t,emo,anim,choices,next,action,cond}
export function startDialogue(npcId, nodes, { onEnd = null, label = 'start' } = {}) {
  if (cur) return;
  const npc = npcs.get(npcId);
  cur = { nodes, list: nodes[label] || [], idx: -1, npcId, onEnd, typing: false };
  window.__dialogOpen = true;
  Input.enabled = false;
  document.exitPointerLock?.();
  $('dialogue').classList.remove('hidden');
  document.body.classList.add('letterbox');
  if (npc) {
    npc.state = 'talk';
    npc._prevAnim = npc.rig?.currentName;
    // 运镜:过肩景
    const wp = new THREE.Vector3();
    npc.rig.group.getWorldPosition(wp);
    const mid = wp.clone().lerp(P.pos, 0.55); mid.y += 1.45;
    const side = new THREE.Vector3(P.pos.z - wp.z, 0, wp.x - P.pos.x).normalize();
    const camP = mid.clone().add(side.multiplyScalar(2.5));
    camP.y = wp.y + 1.72;
    cur.camPos = camP; cur.camLook = mid;
    // 玩家面向 NPC
    P.yaw = Math.atan2(wp.x - P.pos.x, wp.z - P.pos.z);
    P.rig.group.rotation.y = P.yaw;
    P.rig.play('idle');
  }
  advance();
}

export function updateDialogueCam(dt) {
  if (!cur?.camPos) return;
  E.camera.position.lerp(cur.camPos, Math.min(1, dt * 5));
  const look = E.camera.userData._look || (E.camera.userData._look = cur.camLook.clone());
  look.lerp(cur.camLook, Math.min(1, dt * 5));
  E.camera.lookAt(look);
}

function nodeSpeakerName(node) {
  if (node.sp === 'me') return S.name;
  if (node.sp === 'narr') return '';
  return NPCS[node.sp]?.name || NPCS[cur.npcId]?.name || '';
}

function advance() {
  if (!cur) return;
  // 若正在打字 → 直接放完
  if (cur.typing) {
    cur.typing = false;
    clearInterval(cur.typeTimer);
    $('dlgText').textContent = cur.fullText;
    showChoices();
    return;
  }
  // 上一节点的跳转
  const prev = cur.list[cur.idx];
  if (prev) {
    if (prev.choices) return; // 等待选择
    if (prev.next === 'end') return endDialogue();
    if (prev.next && cur.nodes[prev.next]) { cur.list = cur.nodes[prev.next]; cur.idx = -1; }
  }
  cur.idx++;
  const node = cur.list[cur.idx];
  if (!node) return endDialogue();
  if (node.cond && !node.cond()) { advance(); return; }
  node.action?.();
  renderNode(node);
}

function renderNode(node) {
  const name = nodeSpeakerName(node);
  $('dlgName').textContent = name;
  $('dlgName').style.display = name ? '' : 'none';
  // 好感显示
  const npcId = node.sp && node.sp !== 'me' && node.sp !== 'narr' ? node.sp : cur.npcId;
  const def = NPCS[npcId];
  if (def && node.sp !== 'me' && node.sp !== 'narr') {
    const tier = affTier(npcId);
    $('dlgAffinity').textContent = `${'♥'.repeat(Math.max(0, tier))}${'♡'.repeat(4 - Math.max(0, tier))} ${AFF_NAMES[tier]}`;
  } else $('dlgAffinity').textContent = '';
  $('dlgChoices').innerHTML = '';
  $('dlgNext').style.visibility = 'hidden';
  // 说话人动画/表情
  const npc = npcs.get(npcId);
  if (npc?.rig && node.sp !== 'me' && node.sp !== 'narr') {
    if (node.emo) npc.rig.emote(node.emo, 2.4);
    if (node.anim) npc.rig.play(node.anim, { once: true, then: 'idle' });
    cur._talkingRig = npc.rig;
  }
  if (node.sp === 'me' && P.rig) {
    if (node.emo) P.rig.emote(node.emo, 2.4);
    if (node.anim) P.rig.play(node.anim, { once: true, then: 'idle' });
  }
  // 打字机
  const text = typeof node.t === 'function' ? node.t() : node.t;
  cur.fullText = text;
  cur.typing = true;
  let i = 0;
  $('dlgText').textContent = '';
  clearInterval(cur.typeTimer);
  cur.typeTimer = setInterval(() => {
    i += 1;
    $('dlgText').textContent = text.slice(0, i);
    emit('sfx-quiet', 'type');
    if (i >= text.length) {
      clearInterval(cur.typeTimer);
      cur.typing = false;
      showChoices();
    }
  }, 26);
}

function showChoices() {
  const node = cur.list[cur.idx];
  if (!node) return;
  if (!node.choices) { $('dlgNext').style.visibility = 'visible'; return; }
  const box = $('dlgChoices');
  box.innerHTML = '';
  node.choices.filter((c) => !c.cond || c.cond()).forEach((c, i) => {
    const el = document.createElement('button');
    el.className = 'dlg-choice';
    el.innerHTML = `${i + 1}. ${typeof c.t === 'function' ? c.t() : c.t}${c.aff ? `<span class="aff">♥</span>` : ''}`;
    el.onclick = () => pickChoice(c);
    box.appendChild(el);
  });
}

function pickChoice(c) {
  if (!cur) return;
  c.action?.();
  if (c.aff) {
    for (const [npcId, n] of Object.entries(c.aff)) {
      addAff(npcId, n);
      const npc = npcs.get(npcId);
      if (npc?.rig && n > 0) npc.rig.emote(n >= 6 ? '💖' : '♥', 2);
      if (npc?.rig && n < 0) npc.rig.emote('💢', 2);
    }
  }
  if (c.next === 'end') return endDialogue();
  if (c.next && cur.nodes[c.next]) { cur.list = cur.nodes[c.next]; cur.idx = -1; advance(); }
  else { cur.list[cur.idx].choices = null; advance(); }
}

export function endDialogue() {
  if (!cur) return;
  clearInterval(cur.typeTimer);
  const npc = npcs.get(cur.npcId);
  if (npc) { npc.state = 'idle'; npc.rig?.play('idle'); }
  const onEnd = cur.onEnd;
  cur = null;
  window.__dialogOpen = false;
  Input.enabled = true;
  E.camera.userData._look = null;
  $('dialogue').classList.add('hidden');
  document.body.classList.remove('letterbox');
  onEnd?.();
}

// 输入:空格/点击推进,数字选择
addEventListener('keydown', (e) => {
  if (!cur) return;
  if (e.code === 'Space' || e.code === 'Enter') { e.preventDefault(); advance(); }
  const n = +e.key;
  if (n >= 1 && n <= 9) {
    const node = cur.list[cur.idx];
    if (node?.choices && !cur.typing) {
      const vis = node.choices.filter((c) => !c.cond || c.cond());
      if (vis[n - 1]) pickChoice(vis[n - 1]);
    }
  }
});
$('dlgBox')?.addEventListener('click', (e) => { if (!e.target.closest('.dlg-choice')) advance(); });
document.getElementById('dialogue')?.addEventListener('touchend', (e) => { if (!e.target.closest('.dlg-choice')) { e.preventDefault(); advance(); } });
