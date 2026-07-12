// assets.js — 模型加载 + 程序化纹理工厂
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { tuneMaterial } from './engine.js';

export const A = { chars: {}, dungeon: {}, props: {}, ready: false, restReady: false };

// 核心角色(阻塞加载:玩家可选体型) / 其余角色后台流式加载
const CORE_CHARS = ['Mage', 'Rogue', 'Knight'];
const BG_CHARS = ['Rogue_Hooded', 'Barbarian', 'Skeleton_Mage', 'Skeleton_Minion', 'Skeleton_Rogue', 'Skeleton_Warrior'];
const PROP_LIST = ['wand', 'staff', 'spellbook_open', 'spellbook_closed', 'sword_1handed', 'shield_round', 'mug_full', 'Skeleton_Staff', 'Skeleton_Blade'];
const DUNGEON_LIST = [
  'wall', 'wall_arched', 'wall_archedwindow_open', 'wall_archedwindow_gated', 'wall_window_open', 'wall_window_closed',
  'wall_doorway_sides', 'wall_doorway_Tsplit', 'wall_corner', 'wall_corner_small', 'wall_endcap', 'wall_half', 'wall_half_endcap',
  'wall_pillar', 'wall_shelves', 'wall_broken', 'wall_cracked', 'wall_gated', 'wall_Tsplit', 'wall_crossing', 'wall_sloped',
  'floor_tile_small', 'floor_tile_large', 'floor_tile_small_decorated', 'floor_tile_small_broken_A', 'floor_tile_small_weeds_A',
  'floor_tile_big_grate', 'floor_wood_large', 'floor_wood_large_dark', 'floor_dirt_large', 'floor_dirt_small_weeds',
  'stairs', 'stairs_wide', 'stairs_narrow', 'stairs_wood', 'stairs_walled',
  'column', 'pillar', 'pillar_decorated', 'barrier', 'barrier_half', 'barrier_corner', 'barrier_column',
  'table_long', 'table_long_tablecloth', 'table_long_tablecloth_decorated_A', 'table_medium', 'table_medium_tablecloth',
  'table_small', 'table_small_decorated_A', 'chair', 'stool',
  'bed_decorated', 'bed_frame', 'bed_floor', 'shelf_large', 'shelf_small', 'shelves', 'shelf_small_candles',
  'trunk_large_A', 'trunk_medium_A', 'trunk_small_A', 'box_small', 'box_large', 'crates_stacked', 'barrel_large', 'barrel_small', 'keg_decorated',
  'banner_red', 'banner_green', 'banner_blue', 'banner_yellow',
  'banner_patternA_red', 'banner_patternA_green', 'banner_patternA_blue', 'banner_patternA_yellow',
  'banner_shield_red', 'banner_shield_green', 'banner_shield_blue', 'banner_shield_yellow',
  'candle', 'candle_lit', 'candle_thin_lit', 'candle_triple', 'candle_melted', 'torch_lit', 'torch_mounted',
  'bottle_A_green', 'bottle_A_brown', 'bottle_A_labeled_green', 'bottle_B_green', 'bottle_B_brown', 'bottle_C_green', 'bottle_C_brown',
  'plate', 'plate_food_A', 'plate_food_B', 'plate_stack', 'coin', 'coin_stack_small', 'coin_stack_medium', 'coin_stack_large',
  'key', 'keyring_hanging', 'sword_shield', 'sword_shield_gold', 'rubble_half', 'rubble_large',
];

// 资源镜像回退:github.io 不稳时逐文件切换 jsDelivr(国内网络友好)
const Q0 = new URLSearchParams(location.search);
const MIRRORS = (location.hostname.endsWith('github.io') || Q0.has('mirror'))
  ? ['https://cdn.jsdelivr.net/gh/frankilito/hogwarts-legacy-gaiden@main/']
  : [];
const urlCandidates = (rel) => [rel, ...MIRRORS.map((m) => m + rel)];

// 带重试+镜像回退的 GLTF 加载(抗不稳定网络)
function loadOneRetry(loader, url, triesPer = 2) {
  const cands = urlCandidates(url);
  return new Promise((res) => {
    let ci = 0, n = 0;
    const attempt = () => {
      loader.load(cands[ci], (g) => res(g), undefined, () => {
        n++;
        if (n >= triesPer && ci < cands.length - 1) { ci++; n = 0; }
        if (ci < cands.length) setTimeout(attempt, 500 + Math.random() * 500);
        else { console.warn('模型加载失败(含镜像重试)', url); res(null); }
      });
    };
    attempt();
  });
}

export function loadFonts() {
  const loadFace = async (name, rel) => {
    for (const u of urlCandidates(rel)) {
      try {
        const f = await new FontFace(name, `url('${u}')`).load();
        document.fonts.add(f);
        return;
      } catch { /* 下一个镜像 */ }
    }
  };
  const p = Promise.all([
    loadFace('MaShan', 'assets/fonts/MaShanZheng.ttf'),
    loadFace('Cinzel', 'assets/fonts/Cinzel.ttf'),
    loadFace('XiaoWei', 'assets/fonts/ZCOOLXiaoWei.ttf'),
  ]).catch((e) => console.warn('font load fail', e));
  // 最多等 2.5 秒,慢网不阻塞进游戏(字体就绪后自动换上)
  return Promise.race([p, new Promise((r) => setTimeout(r, 2500))]);
}

export function loadModels(onProgress) {
  const loader = new GLTFLoader();
  const jobs = [];
  const total = CORE_CHARS.length + PROP_LIST.length + DUNGEON_LIST.length;
  let done = 0;
  const tick = () => { done++; onProgress?.(done / total); };
  const one = (url) => loadOneRetry(loader, url).then((g) => { tick(); return g; });
  for (const c of CORE_CHARS) jobs.push(one(`assets/models/chars/${c}.glb`).then((g) => { if (g) A.chars[c] = g; }));
  for (const p of PROP_LIST) jobs.push(one(`assets/models/props/${p}.gltf`).then((g) => { if (g) A.props[p] = prepStatic(g.scene); }));
  for (const d of DUNGEON_LIST) jobs.push(one(`assets/models/dungeon/${d}.glb`).then((g) => { if (g) A.dungeon[d] = prepStatic(g.scene); }));
  return Promise.all(jobs).then(() => { A.ready = true; });
}

// 其余角色后台流式加载(每就位一个广播一次)
export async function loadRestChars() {
  const loader = new GLTFLoader();
  for (const c of BG_CHARS) {
    if (A.chars[c]) continue;
    const g = await loadOneRetry(loader, `assets/models/chars/${c}.glb`, 4);
    if (g) {
      A.chars[c] = g;
      dispatchEvent(new CustomEvent('hg-model', { detail: c }));
    }
  }
  A.restReady = true;
  dispatchEvent(new CustomEvent('hg-model', { detail: '*' }));
}

function prepStatic(scene) {
  scene.traverse((o) => {
    if (o.isMesh) {
      o.castShadow = true; o.receiveShadow = true;
      tuneMaterial(o.material);
    }
  });
  return scene;
}

// ============== 程序化纹理工厂 ==============
export const T = {};
const _cache = {};
function canvasTex(key, w, h, draw, opts = {}) {
  if (_cache[key]) return _cache[key];
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  if (opts.repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; }
  t.anisotropy = 4;
  _cache[key] = t;
  return t;
}
const rnd = (() => { let s = 12345; return () => (s = (s * 16807) % 2147483647) / 2147483647; })();

// 石墙(城堡砖)
T.stone = (tone = 0) => canvasTex('stone' + tone, 512, 512, (g, w, h) => {
  const base = ['#4a4550', '#3d3944', '#57505a'][tone] || '#4a4550';
  g.fillStyle = base; g.fillRect(0, 0, w, h);
  const rows = 8, bw = 128;
  for (let r = 0; r < rows; r++) {
    const y = r * (h / rows), off = (r % 2) * bw / 2;
    for (let x = -1; x < 5; x++) {
      const bx = x * bw + off;
      const l = 0.82 + rnd() * 0.36;
      g.fillStyle = shade(base, l);
      g.fillRect(bx + 3, y + 3, bw - 6, h / rows - 6);
      g.fillStyle = 'rgba(255,255,255,.05)'; g.fillRect(bx + 3, y + 3, bw - 6, 4);
      g.fillStyle = 'rgba(0,0,0,.18)'; g.fillRect(bx + 3, y + h / rows - 9, bw - 6, 6);
      for (let i = 0; i < 14; i++) { g.fillStyle = `rgba(${rnd() > .5 ? '255,255,255' : '0,0,0'},${rnd() * .05})`; g.fillRect(bx + rnd() * bw, y + rnd() * h / rows, 8 + rnd() * 22, 3 + rnd() * 8); }
    }
  }
}, { repeat: true });

// 石板地面
T.flagstone = () => canvasTex('flag', 512, 512, (g, w, h) => {
  g.fillStyle = '#37333d'; g.fillRect(0, 0, w, h);
  const n = 4;
  for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
    const l = 0.85 + rnd() * 0.32;
    g.fillStyle = shade('#45414c', l);
    g.fillRect(i * w / n + 4, j * h / n + 4, w / n - 8, h / n - 8);
    for (let k = 0; k < 10; k++) { g.fillStyle = `rgba(0,0,0,${rnd() * .08})`; g.fillRect(i * w / n + rnd() * w / n, j * h / n + rnd() * h / n, 6 + rnd() * 30, 2 + rnd() * 6); }
  }
}, { repeat: true });

// 木地板
T.wood = (dark = false) => canvasTex('wood' + dark, 512, 512, (g, w, h) => {
  const base = dark ? '#3a2a1c' : '#5a4230';
  g.fillStyle = base; g.fillRect(0, 0, w, h);
  const rows = 8;
  for (let r = 0; r < rows; r++) {
    const y = r * h / rows;
    g.fillStyle = shade(base, 0.85 + rnd() * 0.3);
    g.fillRect(0, y + 2, w, h / rows - 4);
    for (let i = 0; i < 26; i++) { g.strokeStyle = `rgba(0,0,0,${.05 + rnd() * .08})`; g.lineWidth = 1 + rnd(); g.beginPath(); const yy = y + rnd() * h / rows; g.moveTo(0, yy); g.bezierCurveTo(w * .3, yy + rnd() * 4 - 2, w * .7, yy + rnd() * 4 - 2, w, yy); g.stroke(); }
    g.fillStyle = 'rgba(0,0,0,.35)'; g.fillRect(0, y, w, 2);
  }
}, { repeat: true });

// 羊皮纸
T.paper = () => canvasTex('paper', 512, 512, (g, w, h) => {
  g.fillStyle = '#d8c49a'; g.fillRect(0, 0, w, h);
  for (let i = 0; i < 900; i++) { g.fillStyle = `rgba(120,90,40,${rnd() * .07})`; g.fillRect(rnd() * w, rnd() * h, 2 + rnd() * 8, 1 + rnd() * 3); }
  const grd = g.createRadialGradient(w / 2, h / 2, w * .2, w / 2, h / 2, w * .75);
  grd.addColorStop(0, 'rgba(0,0,0,0)'); grd.addColorStop(1, 'rgba(90,60,20,.4)');
  g.fillStyle = grd; g.fillRect(0, 0, w, h);
});

// 彩绘玻璃
T.stained = (seed = 1) => canvasTex('stained' + seed, 256, 512, (g, w, h) => {
  const palettes = [['#2b4a8e', '#8e2b2b', '#c9a52a', '#2b8e57', '#7a2b8e'], ['#8e2b6a', '#2b6a8e', '#c97a2a', '#4a8e2b', '#5a2b8e'], ['#2b8e8a', '#8e5a2b', '#b02bd8', '#c9c92a', '#2b448e']];
    const pal = palettes[seed % palettes.length];
  let s = seed * 777 + 13; const rr = () => (s = (s * 16807) % 2147483647) / 2147483647;
  // 三角/菱形铅条分格
  const cells = 7;
  for (let i = 0; i < cells; i++) for (let j = 0; j < cells * 2; j++) {
    g.fillStyle = pal[Math.floor(rr() * pal.length)];
    g.globalAlpha = 0.75 + rr() * 0.25;
    const x = i * w / cells, y = j * h / (cells * 2);
    g.fillRect(x, y, w / cells, h / (cells * 2));
  }
  g.globalAlpha = 1;
  g.strokeStyle = 'rgba(20,16,10,.9)'; g.lineWidth = 4;
  for (let i = 0; i <= cells; i++) { g.beginPath(); g.moveTo(i * w / cells, 0); g.lineTo(i * w / cells, h); g.stroke(); }
  for (let j = 0; j <= cells * 2; j++) { g.beginPath(); g.moveTo(0, j * h / (cells * 2)); g.lineTo(w, j * h / (cells * 2)); g.stroke(); }
  // 中央圆窗图案
  g.beginPath(); g.arc(w / 2, h * .3, w * .27, 0, 7); g.fillStyle = pal[seed % pal.length]; g.fill();
  g.lineWidth = 6; g.stroke();
  g.beginPath(); g.arc(w / 2, h * .3, w * .16, 0, 7); g.fillStyle = '#e8d9a8'; g.fill(); g.stroke();
});

// 书脊墙(图书馆书架填充)
T.books = (seed = 0) => canvasTex('books' + seed, 512, 512, (g, w, h) => {
  let s = seed * 999 + 7; const rr = () => (s = (s * 16807) % 2147483647) / 2147483647;
  const shelves = 5, cols = ['#7a3a2e', '#2e5a7a', '#5a7a2e', '#7a682e', '#5a2e7a', '#8a5a3a', '#3a7a6a', '#933', '#357'];
  g.fillStyle = '#241a10'; g.fillRect(0, 0, w, h);
  for (let r = 0; r < shelves; r++) {
    const y = r * h / shelves, sh = h / shelves;
    let x = 4;
    while (x < w - 6) {
      const bw = 12 + rr() * 22, bh = sh * (0.72 + rr() * 0.2);
      g.fillStyle = cols[Math.floor(rr() * cols.length)];
      g.fillRect(x, y + sh - bh - 6, bw, bh);
      g.fillStyle = 'rgba(255,255,255,.12)'; g.fillRect(x, y + sh - bh - 6, bw, 3);
      g.fillStyle = 'rgba(240,217,168,.5)'; g.fillRect(x + 2, y + sh - bh * .6, bw - 4, 2);
      x += bw + 2 + (rr() < .08 ? 14 : 0);
    }
    g.fillStyle = '#1a1208'; g.fillRect(0, y + sh - 6, w, 6);
    g.fillStyle = 'rgba(255,255,255,.06)'; g.fillRect(0, y + sh - 6, w, 2);
  }
}, { repeat: true });

// 精灵:柔光点
T.dot = () => canvasTex('dot', 64, 64, (g, w, h) => {
  const grd = g.createRadialGradient(32, 32, 2, 32, 32, 30);
  grd.addColorStop(0, 'rgba(255,255,255,1)'); grd.addColorStop(0.4, 'rgba(255,255,255,.5)'); grd.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grd; g.fillRect(0, 0, w, h);
});
// 精灵:火焰
T.flame = () => canvasTex('flame', 64, 64, (g) => {
  const grd = g.createRadialGradient(32, 40, 2, 32, 36, 28);
  grd.addColorStop(0, 'rgba(255,250,220,1)'); grd.addColorStop(0.35, 'rgba(255,190,80,.9)'); grd.addColorStop(0.75, 'rgba(220,90,20,.35)'); grd.addColorStop(1, 'rgba(180,40,0,0)');
  g.fillStyle = grd; g.beginPath(); g.ellipse(32, 34, 20, 27, 0, 0, 7); g.fill();
});
// 精灵:星光十字
T.star = () => canvasTex('star', 64, 64, (g) => {
  g.translate(32, 32);
  const grd = g.createRadialGradient(0, 0, 1, 0, 0, 26);
  grd.addColorStop(0, 'rgba(255,255,255,1)'); grd.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grd;
  g.beginPath(); g.ellipse(0, 0, 4, 26, 0, 0, 7); g.fill();
  g.beginPath(); g.ellipse(0, 0, 26, 4, 0, 0, 7); g.fill();
  g.beginPath(); g.arc(0, 0, 7, 0, 7); g.fill();
});
// 精灵:烟雾
T.smoke = () => canvasTex('smoke', 128, 128, (g, w, h) => {
  for (let i = 0; i < 26; i++) {
    const x = 24 + rnd() * 80, y = 24 + rnd() * 80, r = 12 + rnd() * 26;
    const grd = g.createRadialGradient(x, y, 1, x, y, r);
    grd.addColorStop(0, `rgba(255,255,255,${.10 + rnd() * .08})`); grd.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grd; g.beginPath(); g.arc(x, y, r, 0, 7); g.fill();
  }
});
// 精灵:雨痕
T.rainStreak = () => canvasTex('rain', 32, 128, (g, w, h) => {
  const grd = g.createLinearGradient(0, 0, 0, h);
  grd.addColorStop(0, 'rgba(180,200,255,0)'); grd.addColorStop(0.5, 'rgba(180,200,255,.55)'); grd.addColorStop(1, 'rgba(180,200,255,0)');
  g.fillStyle = grd; g.fillRect(13, 0, 5, h);
});
// 月亮
T.moon = () => canvasTex('moon', 128, 128, (g) => {
  const grd = g.createRadialGradient(64, 64, 10, 64, 64, 56);
  grd.addColorStop(0, '#fdf6e0'); grd.addColorStop(0.85, '#e8ddb8'); grd.addColorStop(1, 'rgba(232,221,184,0)');
  g.fillStyle = grd; g.beginPath(); g.arc(64, 64, 56, 0, 7); g.fill();
  for (let i = 0; i < 9; i++) { g.fillStyle = 'rgba(180,170,140,.35)'; g.beginPath(); g.arc(30 + rnd() * 66, 30 + rnd() * 66, 3 + rnd() * 8, 0, 7); g.fill(); }
});
// 符文魔法阵
T.runeCircle = () => canvasTex('rune', 256, 256, (g, w, h) => {
  g.strokeStyle = 'rgba(255,255,255,.95)'; g.lineWidth = 3;
  g.beginPath(); g.arc(128, 128, 110, 0, 7); g.stroke();
  g.lineWidth = 1.6; g.beginPath(); g.arc(128, 128, 92, 0, 7); g.stroke();
  for (let i = 0; i < 16; i++) {
    const a = i / 16 * Math.PI * 2;
    g.save(); g.translate(128 + Math.cos(a) * 101, 128 + Math.sin(a) * 101); g.rotate(a + Math.PI / 2);
    g.font = '14px serif'; g.fillStyle = 'rgba(255,255,255,.9)';
    g.fillText(String.fromCharCode(0x16A0 + Math.floor(rnd() * 70)), -5, 4); g.restore();
  }
  g.lineWidth = 2;
  g.beginPath();
  for (let i = 0; i < 5; i++) { const a = -Math.PI / 2 + i * Math.PI * 4 / 5; const x = 128 + Math.cos(a) * 88, y = 128 + Math.sin(a) * 88; i ? g.lineTo(x, y) : g.moveTo(x, y); }
  g.closePath(); g.stroke();
});

function shade(hex, mul) {
  const n = parseInt(hex.slice(1), 16);
  const r = Math.min(255, ((n >> 16) & 255) * mul), g2 = Math.min(255, ((n >> 8) & 255) * mul), b = Math.min(255, (n & 255) * mul);
  return `rgb(${r | 0},${g2 | 0},${b | 0})`;
}

// 会动的画像:返回 {texture, animate(t, lookX, lookY, talking)}
const PORTRAIT_SUBJECTS = [
  { bg: ['#2c3a55', '#141c2e'], robe: '#5a2e35', skin: '#d8b58e', hat: '#3a2a45', type: 'wizard', name: '沉思的巫师' },
  { bg: ['#4a3555', '#241a30'], robe: '#2e4a5a', skin: '#e8c8a0', hat: null, type: 'lady', name: '紫衣夫人' },
  { bg: ['#3a4a30', '#1a2415'], robe: '#6a5a2e', skin: '#c8a578', hat: '#2a3a25', type: 'wizard', name: '园丁老人' },
  { bg: ['#553a2c', '#2e1c12'], robe: '#4a4a55', skin: '#d0aa85', hat: null, type: 'knight', name: '打盹的骑士' },
  { bg: ['#2c5550', '#12302c'], robe: '#8e6a2e', skin: '#e0bb92', hat: '#553a1a', type: 'lady', name: '微笑的女院长' },
  { bg: ['#40304f', '#1d1226'], robe: '#30506a', skin: '#caa87f', hat: '#22384a', type: 'wizard', name: '星象学者' },
  { bg: ['#503028', '#26120c'], robe: '#3f5a35', skin: '#deb890', hat: null, type: 'cat', name: '馆长的猫' },
  { bg: ['#333a50', '#131828'], robe: '#703a3a', skin: '#d5b28a', hat: '#4a2828', type: 'lady', name: '红衣歌者' },
];
export function makePortrait(idx) {
  const s = PORTRAIT_SUBJECTS[idx % PORTRAIT_SUBJECTS.length];
  const c = document.createElement('canvas'); c.width = 128; c.height = 160;
  const g = c.getContext('2d');
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
  function draw(t = 0, lookX = 0, lookY = 0, talking = false, blink = false) {
    const w = 128, h = 160;
    const grd = g.createLinearGradient(0, 0, 0, h);
    grd.addColorStop(0, s.bg[0]); grd.addColorStop(1, s.bg[1]);
    g.fillStyle = grd; g.fillRect(0, 0, w, h);
    // 微光
    g.fillStyle = 'rgba(240,220,160,.08)'; g.beginPath(); g.arc(w / 2, 44, 40, 0, 7); g.fill();
    const bob = Math.sin(t * 0.8) * 1.5;
    const cx = w / 2 + lookX * 3, cy = 62 + bob;
    if (s.type === 'cat') {
      g.fillStyle = '#3a3430'; g.beginPath(); g.ellipse(cx, cy + 30, 30, 26, 0, 0, 7); g.fill();
      g.beginPath(); g.arc(cx, cy, 22, 0, 7); g.fill();
      g.beginPath(); g.moveTo(cx - 18, cy - 12); g.lineTo(cx - 24, cy - 30); g.lineTo(cx - 6, cy - 18); g.fill();
      g.beginPath(); g.moveTo(cx + 18, cy - 12); g.lineTo(cx + 24, cy - 30); g.lineTo(cx + 6, cy - 18); g.fill();
      g.fillStyle = blink ? '#3a3430' : '#d8c840';
      g.beginPath(); g.ellipse(cx - 8 + lookX * 2, cy - 2 + lookY * 2, 4, blink ? 0.6 : 5, 0, 0, 7); g.fill();
      g.beginPath(); g.ellipse(cx + 8 + lookX * 2, cy - 2 + lookY * 2, 4, blink ? 0.6 : 5, 0, 0, 7); g.fill();
    } else {
      // 身体
      g.fillStyle = s.robe; g.beginPath(); g.moveTo(cx - 34, h); g.quadraticCurveTo(cx - 30, cy + 26, cx - 16, cy + 18); g.lineTo(cx + 16, cy + 18); g.quadraticCurveTo(cx + 30, cy + 26, cx + 34, h); g.fill();
      // 头
      g.fillStyle = s.skin; g.beginPath(); g.ellipse(cx, cy, 17, 20, 0, 0, 7); g.fill();
      // 帽子/头发
      if (s.hat) { g.fillStyle = s.hat; g.beginPath(); g.moveTo(cx - 22, cy - 10); g.quadraticCurveTo(cx, cy - 26, cx + 22, cy - 10); g.lineTo(cx + 8, cy - 14); g.lineTo(cx + 2, cy - 46 - bob); g.lineTo(cx - 8, cy - 14); g.closePath(); g.fill(); }
      else { g.fillStyle = '#6a5638'; g.beginPath(); g.ellipse(cx, cy - 12, 18, 11, 0, Math.PI, 0); g.fill(); }
      if (s.type === 'knight') { g.strokeStyle = '#9aa0ad'; g.lineWidth = 5; g.beginPath(); g.arc(cx, cy - 2, 19, Math.PI * 1.1, Math.PI * 1.9); g.stroke(); }
      // 眼睛(会看人/眨眼)
      g.fillStyle = blink ? s.skin : '#241c14';
      g.beginPath(); g.ellipse(cx - 6 + lookX * 2.5, cy - 2 + lookY * 2, 2.4, blink ? 0.5 : 3, 0, 0, 7); g.fill();
      g.beginPath(); g.ellipse(cx + 6 + lookX * 2.5, cy - 2 + lookY * 2, 2.4, blink ? 0.5 : 3, 0, 0, 7); g.fill();
      // 嘴(说话开合)
      g.fillStyle = '#8a5a4a';
      const mo = talking ? 2 + Math.abs(Math.sin(t * 9)) * 3 : 1.2;
      g.beginPath(); g.ellipse(cx + lookX, cy + 9, 4, mo, 0, 0, 7); g.fill();
      if (s.type === 'wizard') { g.fillStyle = '#cfc4b0'; g.beginPath(); g.moveTo(cx - 8, cy + 8); g.quadraticCurveTo(cx, cy + 34 + bob, cx + 8, cy + 8); g.fill(); }
    }
    // 画框内暗角
    const v = g.createRadialGradient(w / 2, h / 2, 30, w / 2, h / 2, 110);
    v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(0,0,0,.5)');
    g.fillStyle = v; g.fillRect(0, 0, w, h);
    tex.needsUpdate = true;
  }
  draw(0);
  return { tex, draw, name: s.name };
}
