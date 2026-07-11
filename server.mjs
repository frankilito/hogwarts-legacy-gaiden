#!/usr/bin/env node
// 《霍格沃茨之遗·番外篇》本地服务器 — 静态文件 + WebSocket 联机(参观宿舍/决斗/副本)
// 零依赖:原生 http + 手写 RFC6455 WebSocket。端口 8996。
import http from 'http';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT ? +process.env.PORT : 8996;

const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg',
  '.webp': 'image/webp', '.svg': 'image/svg+xml', '.glb': 'model/gltf-binary',
  '.gltf': 'model/gltf+json', '.bin': 'application/octet-stream',
  '.ttf': 'font/ttf', '.woff2': 'font/woff2', '.mp3': 'audio/mpeg', '.txt': 'text/plain; charset=utf-8',
};

const server = http.createServer((req, res) => {
  let urlPath = decodeURIComponent((req.url || '/').split('?')[0]);
  if (urlPath === '/') urlPath = '/index.html';
  const file = path.normalize(path.join(ROOT, urlPath));
  if (!file.startsWith(ROOT)) { res.writeHead(403); res.end(); return; }
  fs.readFile(file, (err, data) => {
    if (err) { res.writeHead(404); res.end('404'); return; }
    res.writeHead(200, {
      'Content-Type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream',
      'Cache-Control': 'no-cache',
      'Cross-Origin-Opener-Policy': 'same-origin',
    });
    res.end(data);
  });
});

// ---------------- WebSocket (原生实现) ----------------
const GUID = '258EAFA5-E914-47DA-95CA-C5AB0DC85B11';
let nextId = 1;
const clients = new Map(); // id -> {sock, room, name, alive}
const rooms = new Map();   // roomCode -> Set<id>

function wsSend(sock, obj) {
  try {
    const payload = Buffer.from(JSON.stringify(obj));
    const len = payload.length;
    let header;
    if (len < 126) { header = Buffer.from([0x81, len]); }
    else if (len < 65536) { header = Buffer.alloc(4); header[0] = 0x81; header[1] = 126; header.writeUInt16BE(len, 2); }
    else { header = Buffer.alloc(10); header[0] = 0x81; header[1] = 127; header.writeBigUInt64BE(BigInt(len), 2); }
    sock.write(Buffer.concat([header, payload]));
  } catch { /* ignore */ }
}
function roomBroadcast(room, obj, exceptId = -1) {
  const set = rooms.get(room); if (!set) return;
  for (const id of set) if (id !== exceptId) { const c = clients.get(id); if (c) wsSend(c.sock, obj); }
}
function leaveRoom(id) {
  const c = clients.get(id); if (!c || !c.room) return;
  const set = rooms.get(c.room);
  if (set) { set.delete(id); roomBroadcast(c.room, { t: 'leave', id }); if (!set.size) rooms.delete(c.room); }
  c.room = null;
}

server.on('upgrade', (req, sock) => {
  const key = req.headers['sec-websocket-key'];
  if (!key) { sock.destroy(); return; }
  const accept = crypto.createHash('sha1').update(key + GUID).digest('base64');
  sock.write('HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\n' +
    `Sec-WebSocket-Accept: ${accept}\r\n\r\n`);
  sock.setNoDelay(true);
  const id = nextId++;
  const client = { sock, room: null, name: '学生' + id, alive: true };
  clients.set(id, client);
  wsSend(sock, { t: 'hello', id });

  let buf = Buffer.alloc(0);
  sock.on('data', (chunk) => {
    buf = Buffer.concat([buf, chunk]);
    while (true) {
      if (buf.length < 2) return;
      const fin = buf[0] & 0x80, op = buf[0] & 0x0f;
      const masked = buf[1] & 0x80; let len = buf[1] & 0x7f; let off = 2;
      if (len === 126) { if (buf.length < 4) return; len = buf.readUInt16BE(2); off = 4; }
      else if (len === 127) { if (buf.length < 10) return; len = Number(buf.readBigUInt64BE(2)); off = 10; }
      const maskOff = off; if (masked) off += 4;
      if (buf.length < off + len) return;
      let payload = buf.subarray(off, off + len);
      if (masked) { const m = buf.subarray(maskOff, maskOff + 4); payload = Buffer.from(payload); for (let i = 0; i < payload.length; i++) payload[i] ^= m[i & 3]; }
      buf = buf.subarray(off + len);
      if (op === 8) { sock.end(); return; }
      if (op === 9) { const pong = Buffer.from([0x8a, 0]); sock.write(pong); continue; }
      if (op !== 1 || !fin) continue;
      let msg; try { msg = JSON.parse(payload.toString('utf8')); } catch { continue; }
      handleMsg(id, msg);
    }
  });
  const bye = () => { leaveRoom(id); clients.delete(id); };
  sock.on('close', bye); sock.on('error', bye);
});

function handleMsg(id, m) {
  const c = clients.get(id); if (!c) return;
  switch (m.t) {
    case 'join': { // {t,room,name,ava}
      leaveRoom(id);
      const room = String(m.room || '').slice(0, 24).toUpperCase();
      if (!room) return;
      if (!rooms.has(room)) rooms.set(room, new Set());
      const set = rooms.get(room);
      if (set.size >= 8) { wsSend(c.sock, { t: 'full' }); return; }
      c.name = String(m.name || c.name).slice(0, 16);
      c.ava = m.ava;
      // 告知新人现有成员
      const members = [...set].map((mid) => { const mc = clients.get(mid); return { id: mid, name: mc.name, ava: mc.ava, host: mid === [...set][0] }; });
      set.add(id); c.room = room;
      wsSend(c.sock, { t: 'joined', room, id, members, host: members.length === 0 });
      roomBroadcast(room, { t: 'peer', id, name: c.name, ava: c.ava }, id);
      break;
    }
    case 'leave': leaveRoom(id); break;
    default: { // 其余消息带上来源 id 在房间内转发(state/cast/hit/chat/decor/emote/enemy...)
      if (!c.room) return;
      m.id = id;
      if (m.to != null) { const tc = clients.get(m.to); if (tc && tc.room === c.room) wsSend(tc.sock, m); }
      else roomBroadcast(c.room, m, id);
    }
  }
}

setInterval(() => { // 心跳清理
  for (const [, c] of clients) { try { c.sock.write(Buffer.from([0x89, 0])); } catch { /* noop */ } }
}, 30000);

server.listen(PORT, () => {
  console.log(`《霍格沃茨之遗·番外篇》 http://localhost:${PORT}`);
});
