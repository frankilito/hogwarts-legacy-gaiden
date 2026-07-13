// net.js — 联机:参观宿舍/决斗/共同探索
import * as THREE from 'three';
import { S, emit, on } from './state.js';
import { Rig } from './rig.js';
import { zones, activeZone } from './castle.js';
import { P } from './player.js';
import { HOUSES, SPELLS, HAIR_COLORS, SKINS } from './data.js';
import { Input } from './input.js';
import { toast } from './ui.js';

const $ = (id) => document.getElementById(id);
export const NET = { conn: null, kind: null, room: null, id: null, peers: new Map(), hostId: null, isHost: false, hostDecor: null };

// ---------------- 传输层 ----------------
class WSTransport {
  constructor(url, onMsg, onOpen, onClose) {
    this.ws = new WebSocket(url);
    this.ws.onmessage = (e) => { try { onMsg(JSON.parse(e.data)); } catch { /* */ } };
    this.ws.onopen = onOpen;
    this.ws.onclose = onClose;
    this.ws.onerror = onClose;
  }
  send(obj) { if (this.ws.readyState === 1) this.ws.send(JSON.stringify(obj)); }
  close() { try { this.ws.close(); } catch { /* */ } }
}
class BCTransport {
  // 同设备多标签:模拟服务器行为
  constructor(room, onMsg, onOpen) {
    this.room = room;
    this.id = Math.floor(Math.random() * 1e9);
    this.bc = new BroadcastChannel('hg_room_' + room);
    this.onMsg = onMsg;
    this.bc.onmessage = (e) => {
      const m = e.data;
      if (m.__to != null && m.__to !== this.id) return;
      if (m.t === '__hello') { // 新人来了,回应存在
        this.bc.postMessage({ t: '__here', id: this.id, name: S.name, ava: avatar(), __to: m.id });
        onMsg({ t: 'peer', id: m.id, name: m.name, ava: m.ava });
      } else if (m.t === '__here') {
        onMsg({ t: 'peer', id: m.id, name: m.name, ava: m.ava });
      } else if (m.id !== this.id) onMsg(m);
    };
    setTimeout(() => {
      onMsg({ t: 'hello', id: this.id });
      onMsg({ t: 'joined', room, id: this.id, members: [], host: true });
      this.bc.postMessage({ t: '__hello', id: this.id, name: S.name, ava: avatar() });
      onOpen?.();
    }, 50);
  }
  send(obj) { obj.id = this.id; this.bc.postMessage(obj); }
  close() { this.bc.postMessage({ t: 'leave', id: this.id }); this.bc.close(); }
}

function avatar() {
  return { house: S.house, body: S.body, hair: S.hair, hairColor: S.hairColor, skin: S.skin, level: S.level };
}

// ---------------- 房间 ----------------
function wsUrl() {
  const saved = localStorage.getItem('hg_ws');
  if (saved) return saved;
  if (location.protocol === 'http:') return `ws://${location.host}`;
  return null;
}
export function hostRoom() { joinRoom(genCode()); }
function genCode() { const A = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; return [...Array(4)].map(() => A[Math.floor(Math.random() * A.length)]).join(''); }

export function joinRoom(code) {
  leaveRoom();
  code = code.toUpperCase();
  const url = wsUrl();
  const onMsg = handleMsg;
  if (url) {
    NET.kind = 'ws';
    NET.conn = new WSTransport(url, onMsg,
      () => { NET.conn.send({ t: 'join', room: code, name: S.name || '学生', ava: avatar() }); },
      () => { if (NET.room) { toast('联机连接断开'); leaveRoom(); } else { tryBC(code); } });
  } else tryBC(code);
  NET.room = code;
  renderMpMenu();
}
function tryBC(code) {
  NET.kind = 'bc';
  NET.conn = new BCTransport(code, handleMsg);
  toast('已用「同设备频道」联机(多开标签页即可相互看见)');
}
export function leaveRoom() {
  if (NET.conn) { try { NET.conn.send({ t: 'leave' }); } catch { /**/ } NET.conn.close(); }
  NET.conn = null; NET.room = null; NET.peers.forEach((p) => p.rig?.dispose());
  NET.peers.clear();
  NET.isHost = false; NET.hostDecor = null;
}

function handleMsg(m) {
  switch (m.t) {
    case 'hello': NET.id = m.id; break;
    case 'joined':
      NET.isHost = !!m.host;
      for (const mem of m.members || []) addPeer(mem.id, mem.name, mem.ava, mem.host);
      toast(`🔮 已进入房间 ${NET.room}${NET.isHost ? '(你是房主)' : ''}`, true);
      if (!NET.isHost) NET.conn.send({ t: 'askdecor' });
      renderMpMenu();
      break;
    case 'full': toast('房间已满'); leaveRoom(); break;
    case 'peer':
      addPeer(m.id, m.name, m.ava, false);
      toast(`✨ ${m.name} 来了`);
      if (NET.isHost) NET.conn.send({ t: 'decor', decor: S.decor, house: S.house, to: m.id });
      renderMpMenu();
      break;
    case 'leave': {
      const p = NET.peers.get(m.id);
      if (p) { toast(`${p.name} 离开了`); p.rig?.dispose(); NET.peers.delete(m.id); }
      renderMpMenu();
      break;
    }
    case 'askdecor': if (NET.isHost) NET.conn.send({ t: 'decor', decor: S.decor, house: S.house, to: m.id }); break;
    case 'decor':
      NET.hostDecor = { decor: m.decor, house: m.house };
      if (S.zone === 'dorm') applyHostDecor();
      toast('🛏 房主的房间布置已同步(去宿舍参观吧)');
      break;
    case 'state': {
      const p = NET.peers.get(m.id);
      if (p) { p.last = m; p.fresh = true; }
      break;
    }
    case 'cast': onPeerCast(m); break;
    case 'emote': { const p = NET.peers.get(m.id); if (p?.rig) p.rig.emote(m.icon, 2.5); break; }
    case 'ehit': { // 敌人同步伤害
      const cb = window.__sys?.combat;
      const e = cb?.CB.enemies[m.i];
      if (e && e.state !== 'dead') cb.damageEnemy(e, m.dmg, { color: 0xa0c8ff });
      break;
    }
    case 'bhit': window.__sys?.combat?.damageBoss?.(m.dmg); break;
  }
}

function addPeer(id, name, ava, isHost) {
  if (NET.peers.has(id)) return;
  ava = ava || {};
  const rig = new Rig(ava.body || 'Mage', {
    tint: HOUSES[ava.house || 'gryffindor'].color,
    skin: SKINS[ava.skin || 0], hair: ava.hair || 'short', hairColor: HAIR_COLORS[ava.hairColor || 0],
    hand: 'wand', label: `${name} Lv.${ava.level || 1}`, labelColor: '#9ad0ff',
  });
  rig.group.visible = false;
  NET.peers.set(id, { id, name, ava, rig, last: null, fresh: false, zone: null, hp: 100 });
  if (isHost) NET.hostId = id;
}

// 房主装饰应用(参观)
function applyHostDecor() {
  if (!NET.hostDecor) return;
  const backup = S.decor;
  const backupHouse = S.house;
  S.decor = NET.hostDecor.decor || [];
  window.__sys?.gameplay?.rebuildDecor?.();
  S.decor = backup;
  toast('👀 你正在参观房主的房间(离开房间恢复自己的布置)');
}
addEventListener('hg-zone', () => {
  if (S.zone === 'dorm' && NET.room && !NET.isHost && NET.hostDecor) setTimeout(applyHostDecor, 200);
  else if (S.zone !== 'dorm') window.__sys?.gameplay?.rebuildDecor?.();
});

// ---------------- 对等施法(决斗/协同视觉) ----------------
function onPeerCast(m) {
  const cb = window.__sys?.combat;
  if (!cb) return;
  const o = new THREE.Vector3(m.o[0], m.o[1], m.o[2]);
  const d = new THREE.Vector3(m.d[0], m.d[1], m.d[2]);
  cb.fireProjectile(m.spell, o, d, { friendly: m.zone === 'dungeon' || m.zone === 'forest' });
  // 庭院决斗圈:对等咒语可伤害我
  if (m.zone === S.zone && S.zone === 'courtyard') {
    const zn = zones.get('courtyard');
    const inRing = Math.hypot(P.pos.x - zn.offset.x, P.pos.z - zn.offset.z - 20.5) < 6;
    if (inRing) {
      // 简易判定:朝我方向 → 延迟命中判断由投射物系统处理(friendly=false)
      cb.fireProjectile(m.spell, o, d, { friendly: false, dmgMul: 0.8 });
    }
  }
}

// 拦截本地施法进行广播(由 combat 调用不便,改为轮询状态)
let stateT = 0, lastCastCount = 0;
export function updateNet(dt) {
  NET.ticksAll = (NET.ticksAll || 0) + 1;
  if (!NET.conn || !NET.room) return;
  NET.ticksIn = (NET.ticksIn || 0) + 1;
  stateT -= dt;
  if (stateT <= 0) {
    stateT = 0.12;
    NET.conn.send({
      t: 'state', zone: S.zone,
      x: +(P.pos.x - (activeZone?.offset.x || 0)).toFixed(2),
      z: +(P.pos.z - (activeZone?.offset.z || 0)).toFixed(2),
      y: +P.pos.y.toFixed(2),
      yaw: +P.yaw.toFixed(2),
      anim: P.rig?.currentName || 'idle',
      hp: Math.round(S.hp),
    });
  }
  // 更新 peers 显示
  for (const p of NET.peers.values()) {
    if (!p.last) continue;
    const sameZone = p.last.zone === S.zone;
    p.rig.group.visible = sameZone;
    if (!sameZone) continue;
    const zn = zones.get(S.zone);
    if (p.rig.group.parent !== zn.group) zn.group.add(p.rig.group);
    // 插值
    const tgt = new THREE.Vector3(p.last.x, p.last.y || 0, p.last.z);
    p.rig.group.position.lerp(tgt, Math.min(1, dt * 10));
    const dy = ((p.last.yaw - p.rig.group.rotation.y + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
    p.rig.group.rotation.y += dy * Math.min(1, dt * 10);
    if (p.fresh) {
      p.fresh = false;
      if (p.rig.currentName !== p.last.anim) p.rig.play(p.last.anim, { fade: 0.15 });
    }
  }
}
// 广播施法(combat 直接调用)
export function broadcastCast(spell, origin, dir) {
  if (!NET.conn || !NET.room) return;
  NET.conn.send({ t: 'cast', spell, zone: S.zone, o: [origin.x, origin.y, origin.z], d: [dir.x, dir.y, dir.z] });
}
export function broadcastEnemyHit(i, dmg) { NET.conn?.send({ t: 'ehit', i, dmg }); }
export function broadcastBossHit(dmg) { NET.conn?.send({ t: 'bhit', dmg }); }
export function broadcastEmote(icon) { NET.conn?.send({ t: 'emote', icon }); }

// ---------------- UI ----------------
export function initNet() {
  addEventListener('beforeunload', () => leaveRoom());
}
export function openMpMenu() {
  $('mpMenu').classList.remove('hidden');
  Input.enabled = false;
  document.exitPointerLock?.();
  renderMpMenu();
}
function renderMpMenu() {
  const body = $('mpMenuBody');
  if (!body || $('mpMenu').classList.contains('hidden')) return;
  const peers = [...NET.peers.values()];
  body.innerHTML = `<h2 style="text-align:center;color:var(--gold-hi);letter-spacing:4px;margin-bottom:8px">🔮 联机大厅</h2>
    ${NET.room ? `
      <div style="text-align:center;color:var(--ink-dim);font-size:13px">把房间码告诉朋友(同一局域网服务器 / 同设备多标签)</div>
      <div class="room-code">${NET.room}</div>
      <div class="mp-status">${NET.kind === 'ws' ? '🌐 服务器联机' : '📡 同设备频道'} · ${NET.isHost ? '房主' : '访客'} · ${peers.length + 1} 人在线</div>
      <div style="margin:10px 0">${peers.map((p) => `<div class="sched-row"><span>🧙</span><span style="flex:1">${p.name}</span><span style="font-size:12px;color:#8d8064">${p.last ? zoneCN(p.last.zone) : '连接中…'}</span></div>`).join('') || '<div style="color:#8d8064;text-align:center;padding:8px">等待朋友加入…</div>'}</div>
      <div style="display:flex;gap:8px">
        <button class="btn small" id="mpEmote">👋 打招呼</button>
        <button class="btn small" id="mpLeave" style="margin-left:auto">离开房间</button>
      </div>
      <div class="divider"></div>
      <div style="font-size:12.5px;color:#847758;line-height:1.7">· 参观宿舍:进入房主房间的「宿舍」即可看到 TA 的布置<br>· 决斗:双方都站进庭院的金色决斗圈,互相施法!<br>· 共同探索:一起进入地下密室/禁林,伤害共享</div>
    ` : `
      <div style="display:flex;flex-direction:column;gap:12px;margin-top:6px">
        <button class="btn primary" id="mpHost">创建房间</button>
        <div style="display:flex;gap:8px">
          <input id="mpJoinInput" maxlength="4" placeholder="房间码">
          <button class="btn" id="mpJoin">加入</button>
        </div>
        <div style="font-size:12.5px;color:#847758;line-height:1.7">本地启动(启动.command)自动使用内置服务器;纯网页版可同设备多标签互联,或在下方填自定义 ws 服务器。</div>
        <input id="mpWsUrl" placeholder="自定义服务器 ws://..." value="${localStorage.getItem('hg_ws') || ''}" style="background:rgba(0,0,0,.4);border:1px solid var(--line);border-radius:6px;padding:8px;color:var(--ink);font-size:13px;outline:none">
      </div>`}
    <button class="btn" id="mpClose" style="width:100%;margin-top:12px">关闭</button>`;
  $('mpClose').onclick = () => { $('mpMenu').classList.add('hidden'); if (!window.__dialogOpen) Input.enabled = true; };
  $('mpHost') && ($('mpHost').onclick = () => { saveWs(); hostRoom(); });
  $('mpJoin') && ($('mpJoin').onclick = () => { saveWs(); const c = $('mpJoinInput').value.trim(); if (c.length >= 3) joinRoom(c); });
  $('mpLeave') && ($('mpLeave').onclick = () => { leaveRoom(); renderMpMenu(); });
  $('mpEmote') && ($('mpEmote').onclick = () => { broadcastEmote('👋'); P.rig?.emote('👋', 2); toast('你挥了挥手'); });
  function saveWs() { const v = $('mpWsUrl')?.value.trim(); if (v != null) localStorage.setItem('hg_ws', v); }
}
function zoneCN(z) { return { hall: '大厅', stair: '楼梯厅', library: '图书馆', greenhouse: '温室', astro: '天文塔', potions: '魔药教室', dorm: '宿舍', dungeon: '密室', forest: '禁林', courtyard: '庭院' }[z] || z; }
