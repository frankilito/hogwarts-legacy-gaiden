// minigames.js — 课堂/活动小游戏(返回 Promise<score 0-100>)
import { Input } from './input.js';
import { emit } from './state.js';

const $ = (id) => document.getElementById(id);

function openMG(title, sub, html) {
  const p = $('mgPanel');
  p.innerHTML = `<h2>${title}</h2><div class="mg-sub">${sub}</div>${html}`;
  $('minigame').classList.remove('hidden');
  Input.enabled = false;
  window.__paused = false;
  document.exitPointerLock?.();
  return p;
}
function closeMG() {
  $('minigame').classList.add('hidden');
  Input.enabled = true;
}
function finish(res, score, flavor) {
  const p = $('mgPanel');
  const grade = score >= 90 ? 'O·超出预期' : score >= 75 ? 'E·超乎期待' : score >= 60 ? 'A·合格' : score >= 40 ? 'P·勉强及格' : 'T·太糟了';
  p.innerHTML += `<div class="mg-score">评分:${score.toFixed(0)} · ${grade}</div><div class="mg-sub">${flavor || ''}</div>`;
  emit('sfx', score >= 60 ? 'success' : 'fail');
  setTimeout(() => { closeMG(); res(score); }, 1600);
}

// ---------- 1. 符文描绘(魔咒课/黑魔法防御) ----------
const RUNES = [
  { name: '悬浮之弧', pts: [[0.2, 0.7], [0.35, 0.35], [0.55, 0.25], [0.75, 0.35], [0.8, 0.62]] },
  { name: '昏迷之折', pts: [[0.2, 0.3], [0.5, 0.55], [0.35, 0.75], [0.8, 0.75]] },
  { name: '护盾之环', pts: [[0.5, 0.2], [0.72, 0.35], [0.75, 0.62], [0.5, 0.8], [0.25, 0.62], [0.28, 0.35], [0.5, 0.2]] },
  { name: '烈焰之锋', pts: [[0.25, 0.8], [0.45, 0.3], [0.6, 0.55], [0.8, 0.2]] },
];
export function runeTrace({ spellName = '魔咒' } = {}) {
  return new Promise((res) => {
    const rune = RUNES[Math.floor(Math.random() * RUNES.length)];
    openMG(`魔咒课 · ${spellName}`, `沿着发光的轨迹描绘「${rune.name}」——按住并一笔画完`, `<canvas id="runeCanvas" width="640" height="420"></canvas>`);
    const cv = $('runeCanvas');
    const g = cv.getContext('2d');
    const W = cv.width, H = cv.height;
    const tp = rune.pts.map(([x, y]) => [x * W, y * H]);
    let drawing = false, path = [], done = false;
    function drawBase() {
      g.clearRect(0, 0, W, H);
      // 目标轨迹
      g.strokeStyle = 'rgba(201,168,106,.5)'; g.lineWidth = 14; g.lineCap = 'round'; g.lineJoin = 'round';
      g.beginPath(); tp.forEach(([x, y], i) => i ? g.lineTo(x, y) : g.moveTo(x, y)); g.stroke();
      g.strokeStyle = 'rgba(240,217,168,.9)'; g.lineWidth = 2; g.setLineDash([6, 8]);
      g.beginPath(); tp.forEach(([x, y], i) => i ? g.lineTo(x, y) : g.moveTo(x, y)); g.stroke();
      g.setLineDash([]);
      // 起点终点
      g.fillStyle = '#8fe08a'; g.beginPath(); g.arc(tp[0][0], tp[0][1], 10, 0, 7); g.fill();
      g.fillStyle = '#e08a8a'; g.beginPath(); g.arc(tp[tp.length - 1][0], tp[tp.length - 1][1], 10, 0, 7); g.fill();
      // 玩家轨迹
      if (path.length > 1) {
        g.strokeStyle = 'rgba(140,200,255,.95)'; g.lineWidth = 5; g.shadowColor = '#8cc8ff'; g.shadowBlur = 12;
        g.beginPath(); path.forEach(([x, y], i) => i ? g.lineTo(x, y) : g.moveTo(x, y)); g.stroke();
        g.shadowBlur = 0;
      }
    }
    drawBase();
    const pos = (e) => {
      const r = cv.getBoundingClientRect();
      const t = e.touches ? e.touches[0] : e;
      return [(t.clientX - r.left) * (W / r.width), (t.clientY - r.top) * (H / r.height)];
    };
    const down = (e) => { drawing = true; path = [pos(e)]; e.preventDefault(); };
    const move = (e) => { if (!drawing) return; path.push(pos(e)); drawBase(); e.preventDefault(); };
    const up = () => {
      if (!drawing || done) return;
      drawing = false; done = true;
      // 评分:玩家点到目标折线的平均距离 + 端点覆盖
      const segDist = (p, a, b) => {
        const dx = b[0] - a[0], dy = b[1] - a[1];
        const L2 = dx * dx + dy * dy;
        let t = L2 ? ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / L2 : 0;
        t = Math.max(0, Math.min(1, t));
        return Math.hypot(p[0] - (a[0] + dx * t), p[1] - (a[1] + dy * t));
      };
      const dist = (p) => Math.min(...tp.slice(1).map((b, i) => segDist(p, tp[i], b)));
      let avg = path.length ? path.reduce((s, p) => s + dist(p), 0) / path.length : 999;
      // 目标点覆盖率
      const cover = tp.filter((t2) => path.some((p) => Math.hypot(p[0] - t2[0], p[1] - t2[1]) < 34)).length / tp.length;
      let score = Math.max(0, 100 - avg * 1.8) * (0.4 + 0.6 * cover);
      if (path.length < 8) score = Math.min(score, 20);
      finish(res, Math.min(100, score), score >= 75 ? '魔杖尖迸出漂亮的星火!' : score >= 45 ? '咒语成型了,虽然歪歪扭扭。' : '魔杖冒了个屁一样的烟。');
      cleanup();
    };
    cv.addEventListener('mousedown', down); cv.addEventListener('mousemove', move); addEventListener('mouseup', up);
    cv.addEventListener('touchstart', down, { passive: false }); cv.addEventListener('touchmove', move, { passive: false }); cv.addEventListener('touchend', up);
    function cleanup() {
      cv.removeEventListener('mousedown', down); cv.removeEventListener('mousemove', move); removeEventListener('mouseup', up);
    }
  });
}

// ---------- 2. 魔药调制 ----------
export function potionBrew({ recipe, inventory, consume = true }) {
  return new Promise((res) => {
    const decoys = ['蝾螈尾巴', '打喷嚏粉', '猫头鹰羽毛'];
    const ingNames = recipe.ings.map((id) => window.__itemName?.(id) || id);
    const options = [...ingNames, ...decoys.slice(0, 2)].sort(() => Math.random() - 0.5);
    let stepIdx = 0, mistakes = 0, stirDone = false, stirTurns = 0;
    const needTurns = parseInt(recipe.stir.match(/\d+/)?.[0] || '3');
    const clockwise = recipe.stir.includes('顺');
    openMG(`魔药调制 · ${recipe.name}`, `配方:依次投入 ${ingNames.join('、')} → ${recipe.stir} → ${recipe.heat}`, `
      <div id="cauldronView"><canvas id="cvPot" width="220" height="150"></canvas></div>
      <div class="potion-row" id="ingRow">${options.map((n) => `<button class="ing-chip" data-n="${n}">${n}</button>`).join('')}</div>
      <div id="stirBox" class="hidden"><div class="mg-sub">按住搅拌:${recipe.stir}</div><div class="stir-zone" id="stirZone"><div style="position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);font-size:30px">🥄</div></div><div class="mg-sub" id="stirCnt">0 / ${needTurns} 圈</div></div>
      <div id="heatBox" class="hidden"><div class="mg-sub">选择火候</div><div class="potion-row">
        <button class="ing-chip" data-h="文火">🕯 文火</button><button class="ing-chip" data-h="旺火">🔥 旺火</button></div></div>
    `);
    const pot = $('cvPot').getContext('2d');
    let liquid = '#3fae6a';
    let bubbleT = 0;
    const potTimer = setInterval(() => {
      bubbleT += 0.1;
      pot.fillStyle = '#141210'; pot.fillRect(0, 0, 220, 150);
      pot.fillStyle = liquid;
      pot.beginPath(); pot.ellipse(110, 90, 80, 40, 0, 0, 7); pot.fill();
      for (let i = 0; i < 5; i++) {
        const bx = 50 + ((i * 47 + bubbleT * 30) % 120);
        const by = 88 - Math.abs(Math.sin(bubbleT + i)) * 16;
        pot.fillStyle = 'rgba(255,255,255,.35)';
        pot.beginPath(); pot.arc(bx, by, 3 + (i % 3), 0, 7); pot.fill();
      }
    }, 90);
    $('ingRow').querySelectorAll('.ing-chip').forEach((el) => {
      el.onclick = () => {
        const want = ingNames[stepIdx];
        if (el.dataset.n === want) {
          el.classList.add('used'); stepIdx++;
          liquid = ['#3fae6a', '#4a6ae0', '#c9a52a', '#b05ad0'][stepIdx % 4];
          emit('sfx', 'plop');
          if (stepIdx >= ingNames.length) {
            $('ingRow').classList.add('hidden'); $('stirBox').classList.remove('hidden');
          }
        } else { mistakes++; el.classList.add('used'); liquid = '#6a4a3a'; emit('sfx', 'fail'); }
      };
    });
    // 搅拌:跟踪指针绕中心角度
    const zone = $('stirZone');
    let stirring = false, lastA = null, acc = 0;
    const center = () => { const r = zone.getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; };
    const ang = (e) => { const [cx, cy] = center(); const t = e.touches ? e.touches[0] : e; return Math.atan2(t.clientY - cy, t.clientX - cx); };
    const sd = (e) => { stirring = true; lastA = ang(e); e.preventDefault(); };
    const sm = (e) => {
      if (!stirring || stirDone) return;
      const a = ang(e);
      let d = a - lastA;
      while (d > Math.PI) d -= Math.PI * 2; while (d < -Math.PI) d += Math.PI * 2;
      acc += clockwise ? d : -d;
      lastA = a;
      stirTurns = Math.max(0, acc / (Math.PI * 2));
      $('stirCnt').textContent = `${stirTurns.toFixed(1)} / ${needTurns} 圈`;
      if (stirTurns >= needTurns) {
        stirDone = true;
        $('stirBox').classList.add('hidden'); $('heatBox').classList.remove('hidden');
      }
      e.preventDefault();
    };
    const su = () => { stirring = false; };
    zone.addEventListener('mousedown', sd); addEventListener('mousemove', sm); addEventListener('mouseup', su);
    zone.addEventListener('touchstart', sd, { passive: false }); addEventListener('touchmove', sm, { passive: false }); addEventListener('touchend', su);
    $('heatBox').querySelectorAll('.ing-chip').forEach((el) => {
      el.onclick = () => {
        const right = recipe.heat.includes(el.dataset.h);
        if (!right) mistakes++;
        clearInterval(potTimer);
        const over = Math.max(0, stirTurns - needTurns - 0.6);
        const score = Math.max(5, 100 - mistakes * 25 - over * 10);
        finish(res, score, score >= 75 ? '药剂泛起完美的光泽!' : score >= 45 ? '嗯……能喝,大概。' : '坩埚发出了不祥的咕噜声。');
        cleanup();
      };
    });
    function cleanup() {
      removeEventListener('mousemove', sm); removeEventListener('mouseup', su);
      removeEventListener('touchmove', sm); removeEventListener('touchend', su);
    }
  });
}

// ---------- 3. 草药 QTE(曼德拉草换盆) ----------
export function herbQTE() {
  return new Promise((res) => {
    openMG('草药课 · 曼德拉草换盆', '在指针滑进绿色区域的瞬间点击!连续 4 次,别让它尖叫', `
      <div style="font-size:52px;margin:8px" id="mandrake">🌱</div>
      <div style="position:relative;width:480px;height:26px;margin:14px auto;border:1px solid var(--line);border-radius:13px;overflow:hidden;background:rgba(0,0,0,.4)">
        <div id="qteGreen" style="position:absolute;top:0;bottom:0;background:rgba(110,200,110,.55)"></div>
        <div id="qteMark" style="position:absolute;top:-2px;bottom:-2px;width:5px;background:#f0d9a8;box-shadow:0 0 8px #f0d9a8"></div>
      </div>
      <button class="btn primary" id="qteBtn" style="min-width:180px">拔!</button>
      <div class="mg-sub" id="qteMsg">第 1 / 4 步</div>
    `);
    let round = 0, hits = 0, t = 0, dir = 1, speed = 1.35, alive = true;
    let gLeft = 0.6, gW = 0.16;
    const mark = $('qteMark'), green = $('qteGreen');
    function setGreen() { gLeft = 0.25 + Math.random() * 0.55; gW = Math.max(0.09, 0.2 - round * 0.03); green.style.left = (gLeft * 100) + '%'; green.style.width = (gW * 100) + '%'; }
    setGreen();
    const timer = setInterval(() => {
      if (!alive) return;
      t += 0.016 * speed * dir;
      if (t > 1) { t = 1; dir = -1; } if (t < 0) { t = 0; dir = 1; }
      mark.style.left = (t * 100) + '%';
    }, 16);
    $('qteBtn').onclick = () => {
      if (!alive) return;
      const hit = t >= gLeft && t <= gLeft + gW;
      round++;
      if (hit) { hits++; $('mandrake').textContent = ['🌱', '🌿', '🥬', '🥕'][Math.min(3, round)]; emit('sfx', 'plop'); }
      else { $('mandrake').textContent = '😱'; $('qteMsg').textContent = '它在尖叫!!'; emit('sfx', 'scream'); }
      if (round >= 4) {
        alive = false; clearInterval(timer);
        const score = hits * 25;
        finish(res, score, score >= 75 ? '曼德拉草舒服地睡着了。' : score >= 50 ? '它嘟囔了几句,但没醒。' : '整个温室都听到了尖叫……');
      } else {
        $('qteMsg').textContent = `第 ${round + 1} / 4 步`;
        speed += 0.3; setGreen();
      }
    };
  });
}

// ---------- 4. 星图连线(天文课/鹰之钥) ----------
export function astroConnect({ key = false } = {}) {
  return new Promise((res) => {
    openMG(key ? '天文塔 · 钥匙星座' : '天文课 · 星图观测', '按顺序点亮星星,连出星座——从发光的那颗开始', `<canvas id="runeCanvas" width="640" height="420"></canvas>`);
    const cv = $('runeCanvas'), g = cv.getContext('2d');
    const W = cv.width, H = cv.height;
    // 目标星座(钥匙形 or 随机)
    const constellation = key
      ? [[0.3, 0.3], [0.42, 0.22], [0.54, 0.3], [0.42, 0.4], [0.42, 0.62], [0.52, 0.72], [0.42, 0.78]]
      : [[0.25, 0.6], [0.38, 0.4], [0.52, 0.5], [0.66, 0.32], [0.78, 0.45]].map(([x, y]) => [x + (Math.random() - 0.5) * 0.06, y + (Math.random() - 0.5) * 0.06]);
    const stars = constellation.map(([x, y]) => [x * W, y * H]);
    // 干扰星
    const noise = [];
    for (let i = 0; i < 14; i++) noise.push([Math.random() * W, Math.random() * H]);
    let idx = 0, wrong = 0;
    function draw() {
      g.fillStyle = '#080a14'; g.fillRect(0, 0, W, H);
      for (const [x, y] of noise) { g.fillStyle = 'rgba(255,255,255,.5)'; g.beginPath(); g.arc(x, y, 2, 0, 7); g.fill(); }
      // 已连的线
      g.strokeStyle = 'rgba(140,200,255,.9)'; g.lineWidth = 2.5; g.shadowColor = '#8cc8ff'; g.shadowBlur = 10;
      g.beginPath();
      stars.slice(0, idx).forEach(([x, y], i) => i ? g.lineTo(x, y) : g.moveTo(x, y));
      g.stroke(); g.shadowBlur = 0;
      stars.forEach(([x, y], i) => {
        g.fillStyle = i < idx ? '#9ad0ff' : 'rgba(255,255,240,.9)';
        const r = i < idx ? 6 : 4.5;
        g.beginPath(); g.arc(x, y, r, 0, 7); g.fill();
        if (i === idx) { // 下一颗提示脉动
          g.strokeStyle = 'rgba(240,217,168,.9)'; g.lineWidth = 2;
          g.beginPath(); g.arc(x, y, 11 + Math.sin(Date.now() / 200) * 3, 0, 7); g.stroke();
        }
      });
    }
    const timer = setInterval(draw, 40);
    cv.onclick = (e) => {
      const r = cv.getBoundingClientRect();
      const x = (e.clientX - r.left) * (W / r.width), y = (e.clientY - r.top) * (H / r.height);
      const [tx, ty] = stars[idx];
      if (Math.hypot(x - tx, y - ty) < 22) {
        idx++;
        emit('sfx', 'chime');
        if (idx >= stars.length) {
          clearInterval(timer);
          draw();
          const score = Math.max(20, 100 - wrong * 15);
          finish(res, score, key ? '星星连成了一把钥匙,坠下一缕星光!' : '夜空为你眨了眨眼。');
        }
      } else wrong++;
    };
  });
}

// ---------- 5. 笔试(考试) ----------
export function quizExam(questions) {
  return new Promise((res) => {
    let idx = 0, correct = 0;
    const p = openMG('学期考试 · 笔试', '羊皮纸沙沙作响——选出正确答案', `<div id="quizBox"></div>`);
    function show() {
      const q = questions[idx];
      $('quizBox').innerHTML = `
        <div style="font-size:18px;margin:12px 0;color:var(--ink)">${idx + 1} / ${questions.length} · ${q.q}</div>
        <div style="display:flex;flex-direction:column;gap:8px;max-width:480px;margin:0 auto">
        ${q.a.map((a, i) => `<button class="dlg-choice" data-i="${i}">${'ABCD'[i]}. ${a}</button>`).join('')}</div>`;
      $('quizBox').querySelectorAll('.dlg-choice').forEach((el) => {
        el.onclick = () => {
          if (+el.dataset.i === q.c) { correct++; el.style.borderColor = '#8fe08a'; emit('sfx', 'chime'); }
          else { el.style.borderColor = '#e08a8a'; emit('sfx', 'fail'); }
          setTimeout(() => {
            idx++;
            if (idx >= questions.length) finish(res, correct / questions.length * 100, `答对 ${correct} / ${questions.length} 题`);
            else show();
          }, 500);
        };
      });
    }
    show();
  });
}
