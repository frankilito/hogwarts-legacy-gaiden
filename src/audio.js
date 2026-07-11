// audio.js — WebAudio 程序化音乐与音效
import { S, on } from './state.js';

let ctx = null, master = null, musicGain = null, sfxGain = null;
let volume = +(localStorage.getItem('hg_vol') ?? 0.7);
let curTheme = null, themeTimer = null, playing = false;

export function getVolume() { return volume; }
export function setVolume(v) {
  volume = v;
  localStorage.setItem('hg_vol', String(v));
  if (master) master.gain.value = v;
}

export function initAudio() {
  const start = () => {
    if (ctx) return;
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    master = ctx.createGain(); master.gain.value = volume; master.connect(ctx.destination);
    musicGain = ctx.createGain(); musicGain.gain.value = 0.5; musicGain.connect(master);
    sfxGain = ctx.createGain(); sfxGain.gain.value = 0.9; sfxGain.connect(master);
    playing = true;
    playTheme(currentThemeId());
  };
  addEventListener('pointerdown', start, { once: true });
  addEventListener('keydown', start, { once: true });
  on('sfx', (name) => sfx(name));
  on('sfx-quiet', (name) => sfx(name, 0.25));
  addEventListener('hg-zone', () => { if (playing) playTheme(currentThemeId()); });
}

function currentThemeId() {
  const zoneThemes = { dungeon: 'dungeon', forest: 'forest', astro: 'night', dorm: 'dorm', library: 'library' };
  if (S.phase >= 4) return zoneThemes[S.zone] || 'night';
  return zoneThemes[S.zone] || 'academy';
}

// ---------------- 音乐:程序化编曲 ----------------
// 主题定义:调式音级(半音)/根音/速度/音色
const THEMES = {
  academy: { root: 57, scale: [0, 2, 4, 7, 9, 12, 14, 16], bpm: 92, pad: [0, 4, 7], bell: true, waves: ['triangle', 'sine'] },
  library: { root: 55, scale: [0, 3, 5, 7, 10, 12, 15], bpm: 72, pad: [0, 3, 7], bell: true, waves: ['sine', 'sine'] },
  dorm: { root: 60, scale: [0, 2, 4, 7, 9, 12], bpm: 80, pad: [0, 4, 9], bell: false, waves: ['triangle', 'sine'] },
  night: { root: 50, scale: [0, 2, 3, 7, 8, 12, 14], bpm: 60, pad: [0, 3, 8], bell: true, waves: ['sine', 'sine'] },
  dungeon: { root: 45, scale: [0, 1, 5, 6, 10, 12], bpm: 66, pad: [0, 6, 10], bell: false, waves: ['sawtooth', 'triangle'] },
  forest: { root: 48, scale: [0, 3, 5, 8, 10, 12, 15], bpm: 64, pad: [0, 3, 10], bell: true, waves: ['sine', 'triangle'] },
  outdoor: { root: 55, scale: [0, 2, 4, 7, 9, 12, 14], bpm: 86, pad: [0, 4, 7], bell: true, waves: ['triangle', 'sine'] },
  battle: { root: 45, scale: [0, 2, 3, 5, 7, 8, 11, 12], bpm: 128, pad: [0, 3, 7], bell: false, waves: ['sawtooth', 'square'] },
};
const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);

function playTheme(id) {
  if (curTheme === id || !ctx) return;
  curTheme = id;
  clearTimeout(themeTimer);
  scheduleBar(THEMES[id] || THEMES.academy, 0);
}
let barCount = 0;
function scheduleBar(t, delay) {
  const beat = 60 / t.bpm;
  const barDur = beat * 4;
  const now = ctx.currentTime + delay;
  barCount++;
  // Pad 和弦(每小节)
  const padRoot = t.root + [0, 0, -3, 5][barCount % 4];
  for (const iv of t.pad) {
    padNote(mtof(padRoot + iv), now, barDur * 1.05, 0.05);
  }
  // 琶音
  for (let i = 0; i < 8; i++) {
    if (Math.random() < 0.72) {
      const deg = t.scale[Math.floor(Math.random() * t.scale.length)];
      pluck(mtof(t.root + 12 + deg), now + i * beat / 2, beat * 0.9, 0.035, t.waves[0]);
    }
  }
  // 铃铛旋律(偶尔)
  if (t.bell && barCount % 2 === 0) {
    const deg = t.scale[Math.floor(Math.random() * t.scale.length)];
    bell(mtof(t.root + 24 + deg), now + beat * (Math.floor(Math.random() * 3)), 0.05);
  }
  // 低音
  pluck(mtof(padRoot - 12), now, barDur * 0.9, 0.07, 'sine');
  themeTimer = setTimeout(() => scheduleBar(THEMES[curTheme] || THEMES.academy, 0.02), barDur * 1000 - 30);
}
function padNote(freq, t0, dur, vol) {
  const o = ctx.createOscillator(), g = ctx.createGain(), f = ctx.createBiquadFilter();
  o.type = 'sawtooth'; o.frequency.value = freq;
  f.type = 'lowpass'; f.frequency.value = 700; f.Q.value = 0.6;
  g.gain.setValueAtTime(0, t0);
  g.gain.linearRampToValueAtTime(vol, t0 + dur * 0.3);
  g.gain.linearRampToValueAtTime(0, t0 + dur);
  o.connect(f); f.connect(g); g.connect(musicGain);
  o.start(t0); o.stop(t0 + dur + 0.1);
}
function pluck(freq, t0, dur, vol, wave = 'triangle') {
  const o = ctx.createOscillator(), g = ctx.createGain();
  o.type = wave; o.frequency.value = freq;
  g.gain.setValueAtTime(vol, t0);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  o.connect(g); g.connect(musicGain);
  o.start(t0); o.stop(t0 + dur + 0.05);
}
function bell(freq, t0, vol) {
  [1, 2.76, 5.4].forEach((h, i) => {
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = 'sine'; o.frequency.value = freq * h;
    g.gain.setValueAtTime(vol / (i + 1), t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + 1.8 - i * 0.4);
    o.connect(g); g.connect(musicGain);
    o.start(t0); o.stop(t0 + 2);
  });
}

// ---------------- 音效 ----------------
function blip(freq, dur, { wave = 'sine', vol = 0.2, slide = 0, delay = 0, noise = false } = {}) {
  if (!ctx) return;
  const t0 = ctx.currentTime + delay;
  if (noise) {
    const len = ctx.sampleRate * dur;
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = ctx.createBufferSource(); src.buffer = buf;
    const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = freq;
    const g = ctx.createGain(); g.gain.value = vol;
    src.connect(f); f.connect(g); g.connect(sfxGain);
    src.start(t0);
    return;
  }
  const o = ctx.createOscillator(), g = ctx.createGain();
  o.type = wave; o.frequency.setValueAtTime(freq, t0);
  if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, freq + slide), t0 + dur);
  g.gain.setValueAtTime(vol, t0);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  o.connect(g); g.connect(sfxGain);
  o.start(t0); o.stop(t0 + dur + 0.02);
}
const SFX = {
  step: () => blip(90 + Math.random() * 30, 0.08, { wave: 'triangle', vol: 0.05, noise: true, freq: 200 }),
  dodge: () => blip(300, 0.16, { wave: 'sine', vol: 0.1, slide: -180 }),
  cast: () => { blip(520, 0.12, { vol: 0.12, slide: 300 }); blip(880, 0.2, { vol: 0.06, delay: 0.05, slide: 400 }); },
  bigcast: () => { blip(220, 0.5, { wave: 'sawtooth', vol: 0.16, slide: 440 }); blip(880, 0.7, { vol: 0.1, delay: 0.15, slide: 880 }); },
  impact: () => blip(1200, 0.1, { noise: true, vol: 0.14 }),
  hit: () => blip(160, 0.12, { wave: 'square', vol: 0.09, slide: -60 }),
  hurt: () => blip(140, 0.25, { wave: 'sawtooth', vol: 0.14, slide: -70 }),
  shield: () => blip(660, 0.25, { vol: 0.08, slide: 120 }),
  block: () => blip(330, 0.12, { wave: 'square', vol: 0.1 }),
  parry: () => { blip(880, 0.15, { vol: 0.14 }); blip(1320, 0.3, { vol: 0.1, delay: 0.06 }); },
  chime: () => { blip(880, 0.3, { vol: 0.1 }); blip(1108, 0.4, { vol: 0.08, delay: 0.08 }); },
  success: () => { blip(660, 0.18, { vol: 0.12 }); blip(880, 0.22, { vol: 0.1, delay: 0.12 }); blip(1320, 0.4, { vol: 0.1, delay: 0.24 }); },
  fail: () => { blip(220, 0.3, { wave: 'sawtooth', vol: 0.1, slide: -80 }); },
  coin: () => { blip(1568, 0.1, { vol: 0.1 }); blip(2093, 0.18, { vol: 0.08, delay: 0.06 }); },
  plop: () => blip(400, 0.1, { vol: 0.12, slide: -200 }),
  portal: () => blip(300, 0.5, { wave: 'sine', vol: 0.12, slide: 500 }),
  rumble: () => blip(60, 1.2, { wave: 'sawtooth', vol: 0.18, slide: -20 }),
  bones: () => { for (let i = 0; i < 4; i++) blip(200 + Math.random() * 300, 0.06, { noise: true, vol: 0.08, delay: i * 0.07 }); },
  slam: () => { blip(70, 0.5, { wave: 'sawtooth', vol: 0.2, slide: -30 }); blip(400, 0.2, { noise: true, vol: 0.15 }); },
  throw: () => blip(200, 0.2, { vol: 0.08, slide: 150 }),
  duelstart: () => { blip(440, 0.2, { vol: 0.12 }); blip(587, 0.3, { vol: 0.1, delay: 0.18 }); },
  bossroar: () => { blip(80, 1.4, { wave: 'sawtooth', vol: 0.22, slide: 60 }); blip(55, 1.6, { wave: 'square', vol: 0.12, delay: 0.2 }); },
  bossdead: () => { blip(200, 1.6, { wave: 'sine', vol: 0.15, slide: -140 }); },
  scream: () => blip(900, 0.5, { wave: 'sawtooth', vol: 0.12, slide: 500 }),
  potion: () => { blip(500, 0.12, { vol: 0.1, slide: 200 }); blip(700, 0.2, { vol: 0.06, delay: 0.1 }); },
  levelup: () => { [523, 659, 784, 1047].forEach((f, i) => blip(f, 0.3, { vol: 0.1, delay: i * 0.1 })); },
  type: () => blip(1400 + Math.random() * 400, 0.02, { vol: 0.02 }),
};
export function sfx(name, volMul = 1) {
  const fn = SFX[name];
  if (fn && ctx) fn();
}
on('levelup', () => sfx('levelup'));

let _battleWas = false;
export function updateAudio() {
  if (!ctx || !playing) return;
  // 战斗音乐切换
  const combat = window.__sys?.combat?.CB;
  const inBattle = !!(combat && (combat.boss || combat.duel || combat.enemies?.some((e) => e.state === 'chase' || e.state === 'attack')));
  if (inBattle !== _battleWas) {
    _battleWas = inBattle;
    playTheme(inBattle ? 'battle' : currentThemeId());
  }
}
