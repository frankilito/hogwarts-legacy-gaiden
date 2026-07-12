// gameplay.js — 游戏玩法总调度:交互/任务/上课/考试/采集/商店/装饰/机关/演出
import * as THREE from 'three';
import { P, throughDoor, fadeTransition, teleport } from './player.js';
import { pressed, Input } from './input.js';
import { S, emit, on, flag, setFlag, addItem, hasItem, removeItem, addXP, addGold, addGrade, advancePhase, saveGame, heal, restoreMp, affTier, addAff } from './state.js';
import { zones, activeZone } from './castle.js';
import { NPCS, ITEMS, RECIPES, FURNITURE, CLASSES, WEEK_SCHEDULE, QUIZ, EXAM_DAYS, SPELLS, HOUSES } from './data.js';
import { QUESTS, questStep, questActive, questDone, startQuest, advanceQuest, completeQuest, buildDialogue } from './story.js';
import { startDialogue, isOpen as dlgOpen, updateDialogueCam } from './dialogue.js';
import { nearestTalkable, npcs, relocateAll } from './npc.js';
import { runeTrace, potionBrew, herbQTE, astroConnect, quizExam } from './minigames.js';
import { A } from './assets.js';
import { spark } from './fx.js';
import { setPrompt, subtitle, toast } from './ui.js';

window.__itemName = (id) => ITEMS[id]?.name || id;
const $ = (id) => document.getElementById(id);

export function initGameplay() {
  on('gamestart', ({ fresh }) => {
    if (fresh) startIntro();
    else { relocateAll(true); }
  });
  on('phase', onPhaseChange);
  on('newday', () => { /* 采集点每日刷新:flags 带 day 后缀自动失效 */ });
  on('afftier', ({ npc, tier }) => {
    const def = NPCS[npc];
    toast(`💗 ${def?.icon || ''} 与 ${def?.name} 的关系升温了:${['', '相识', '朋友', '挚友', '形影不离'][tier]}`, true);
    if (def?.companion && tier >= 3 && !S.spells.includes('duo')) {
      S.spells.push('duo');
      toast('💞 领悟合击咒语:协力冲击!(同伴在场,F 键发动)', true);
    }
  });
  addEventListener('beforeunload', () => { if (S.started) saveGame(); });
  registerZoneInteracts();
}

// ---------------- 开场 ----------------
function startIntro() {
  teleport('hall', 0, 26, Math.PI);
  setTimeout(() => {
    const h = HOUSES[S.house];
    startDialogue('vance', {
      start: [
        { sp: 'narr', t: '1927 年 9 月 1 日。烛光在大厅上空漂浮,新学年的第一个夜晚。' },
        { sp: 'vance', t: `欢迎来到霍格沃茨,${S.name}。分院帽刚才在我耳边嘀咕了很久——它说你去 ${h.name} 再合适不过。`, emo: '😊' },
        { sp: 'vance', t: `${h.trait}。这是${h.name}的品格,也是分院帽在你身上看到的光。`, anim: 'interact' },
        { sp: 'me', t: '(你握紧了口袋里的魔杖。)', choices: [
          { t: '「我不会辜负学院的!」', aff: { vance: 4 } },
          { t: '「其实……我有点紧张。」', aff: { vance: 6 } },
          { t: '「大厅的天花板是真的天空吗?」', aff: { vance: 5 } },
        ] },
        { sp: 'vance', t: '紧张、期待、好奇——都很好,那是新学年的味道。去吧,熟悉一下城堡:南边的门通往楼梯厅,那里能到达城堡的每个角落。', emo: '🙂' },
        { sp: 'vance', t: '记得看看你的日程(Tab 键)。上课、交朋友、探索……这座城堡从不辜负愿意了解它的人。', next: 'end',
          action: () => { startQuest('main'); advanceQuest('main', 1); saveGame(); setTimeout(showControlHints, 1200); } },
      ],
    });
  }, 900);
}
function showControlHints() {
  toast('🕹 WASD 移动 · 鼠标视角 · E 交互 · Tab 面板', true);
  setTimeout(() => toast('⚔ 左键魔弹 · 1-4 咒语 · 右键护盾 · 空格翻滚 · Q 锁定'), 2600);
  setTimeout(() => toast('🚪 大厅南侧的门通往楼梯厅——去认识一下这座城堡吧'), 5200);
}

// ---------------- 阶段变化 ----------------
function onPhaseChange() {
  const [am, pm] = WEEK_SCHEDULE[S.day % 7];
  if (S.phase === 1 && am) { toast(`🔔 上课铃:${CLASSES[am].name}(${zoneName(CLASSES[am].zone)})`, true); }
  if (S.phase === 2 && pm) { toast(`🔔 上课铃:${CLASSES[pm].name}(${zoneName(CLASSES[pm].zone)})`, true); }
  if (S.phase === 2 && isExamToday()) toast('🖋 学期考试!午后在大厅举行', true);
  if (S.phase === 3) toast('🌇 黄昏了。决斗社在庭院集合。');
  if (S.phase === 5 && S.zone !== 'dorm') toast('🌌 已过宵禁……小心管理员,或者潜行(Shift)。');
  relocateAll(true);
}
function zoneName(id) { return { hall: '大厅', stair: '楼梯厅', library: '图书馆', greenhouse: '温室', astro: '天文塔', potions: '魔药教室', dorm: '宿舍', dungeon: '密室', forest: '禁林', courtyard: '庭院' }[id] || id; }
function isExamToday() { return EXAM_DAYS.includes(S.day % 21); }

// ---------------- 注册各区域交互 ----------------
function registerZoneInteracts() {
  const dorm = zones.get('dorm');
  dorm?.addInteract({ x: 24, z: 0, r: 12, hidden: true }); // 占位
  dorm?.addInteract({
    x: 20, z: 6, r: 2.4, label: '睡觉(到第二天清晨)', icon: '🛏',
    cb: () => sleep(),
  });
  const potions = zones.get('potions');
  potions?.addInteract({
    x: 2.4, z: -11, r: 2.6, label: '使用坩埚 调制药剂', icon: '⚗',
    cb: () => openBrewMenu(),
  });
  const greenhouse = zones.get('greenhouse');
  greenhouse?.addInteract({
    x: 8.6, z: 16, r: 2.4, label: '照料曼德拉草', icon: '🌱',
    cb: async () => {
      if (flag('mandrake_' + S.day)) { toast('曼德拉草今天已经被照料过了'); return; }
      const score = await herbQTE();
      setFlag('mandrake_' + S.day);
      if (score >= 50) { addItem('gnarl', 1); addXP(15); }
      else addXP(5);
    },
  });
  greenhouse?.addInteract({
    x: -9, z: 10, r: 2.4, label: '月光花圃', icon: '🌸',
    cb: () => moonflowerInteract(),
  });
  const astro = zones.get('astro');
  astro?.addInteract({
    x: 0, z: -4, r: 2.6, label: '使用望远镜', icon: '🔭',
    cb: () => telescopeInteract(),
  });
  const library = zones.get('library');
  // 禁书区大门(覆盖 zones2 里的占位)
  const rg = library?.interact.find((i) => i.label === '进入 禁书区');
  if (rg) {
    rg.cond = () => {
      if (flag('restrictedOpen')) return true;
      if (S.phase >= 4 && (questStep('main') === 4 || questActive('ella_poem'))) return true;
      return '禁书区被银链封着。艾拉的低语:「深夜再来……」';
    };
    rg.cb = () => restrictedSection();
  }
  const stair = zones.get('stair');
  const crack = stair?.interact.find((i) => i.label === '裂缝后的密道');
  if (crack) {
    crack.cond = () => {
      if (flag('dungeonOpen')) return true;
      if (questStep('main') === 6 && hasItem('reveal_potion')) return true;
      if (questStep('main') === 6) return '裂缝在显形剂下若隐若现——你需要一瓶「显形剂」。';
      return '石墙上有一道细细的裂缝……似乎藏着什么。(推进主线以解锁)';
    };
    const origTo = crack.to;
    crack.cb = null;
    // 包一层:第一次使用显形剂
    const origIsDoor = crack.isDoor;
    crack.isDoor = false;
    crack.cb = () => {
      if (!flag('dungeonOpen')) {
        removeItem('reveal_potion', 1);
        setFlag('dungeonOpen');
        spark(new THREE.Vector3(P.pos.x, P.pos.y + 1.5, P.pos.z), { color: 0x70e0d8, n: 40, speed: 4 });
        toast('🕳 石墙如水波荡开,密道显形了!', true);
        advanceQuest('main', 7);
        saveGame();
        return;
      }
      throughDoor({ to: origTo, isDoor: origIsDoor });
    };
  }
  // 楼梯厅深夜调查点(主线2)
  stair?.addInteract({
    x: 0, z: -2, r: 3, label: '侧耳倾听', icon: '👂',
    cond: () => questStep('main') === 2 ? (S.phase >= 4 ? true : '声音只在夜里出现。等到夜晚再来。') : false,
    hiddenUnless: () => questStep('main') === 2,
    cb: () => {
      subtitle('地底深处传来齿轮转动的闷响……咔、咔、咔……', 3600);
      spark(new THREE.Vector3(P.pos.x, P.pos.y + 0.2, P.pos.z), { color: 0x8fd0ff, n: 16, speed: 1.5 });
      setTimeout(() => {
        startDialogue('isaac', {
          start: [
            { sp: 'isaac', t: '你也听到了?!0.3 赫兹!和我测的一模一样!', emo: '❗', anim: 'cheer' },
            { sp: 'isaac', t: '这不是水管,不是风,是齿轮!创校时期的黄铜齿轮!图书馆一定有记载——去找薇拉,她比索引卡还好用!' },
            { sp: 'me', t: '(伊萨克的眼睛亮得像两盏灯。)', next: 'end', action: () => advanceQuest('main', 3) },
          ],
        });
      }, 2200);
    },
  });
  // 禁林采集/石阵
  const forest = zones.get('forest');
  if (forest) {
    for (const g of forest.gatherSpots) {
      forest.addInteract({
        x: g.x, z: g.z, r: 2.2, label: `采集 ${g.label}`, icon: ITEMS[g.item]?.icon || '🌿',
        cond: () => {
          if (flag(`gather_${g.x}_${g.z}_${S.day}`)) return false;
          if (g.night && S.phase < 4) return `${g.label}只在夜里出现。`;
          return true;
        },
        cb: () => {
          P.rig.play('pickup', { once: true });
          setFlag(`gather_${g.x}_${g.z}_${S.day}`);
          setTimeout(() => { addItem(g.item, 1 + (Math.random() < 0.3 ? 1 : 0)); addXP(8); }, 500);
        },
      });
    }
    forest.addInteract({
      x: -16, z: -14, r: 2.6, label: '搜索石阵', icon: '🗿',
      cond: () => questStep('ghost_watch') === 0 ? true : false,
      cb: () => {
        P.rig.play('pickup', { once: true });
        setTimeout(() => {
          addItem('watch_ghost', 1);
          advanceQuest('ghost_watch', 1);
          subtitle('石缝里,一块黄铜怀表安静地躺了两百年。');
        }, 600);
      },
    });
  }
  // 地下密室:宝箱/金币/浮石/火盆/传送门/机关厅
  registerDungeon();
  // 庭院:决斗社
  const courtyard = zones.get('courtyard');
  courtyard?.addInteract({
    x: 0, z: 20.5, r: 4.5, label: '决斗练习场', icon: '⚔',
    cond: () => {
      if (S.phase !== 3) return '决斗社只在黄昏活动。';
      if (!questActive('duel_club') && !questDone('duel_club')) return '先和维克多教授聊聊,加入决斗社。';
      return true;
    },
    cb: () => window.__sys?.combat?.openDuelMenu?.(),
  });
  // 上课点(动态出现在对应教室)
  for (const [cid, c] of Object.entries(CLASSES)) {
    const zn = zones.get(c.zone);
    if (!zn) continue;
    const spot = { hall: [8, -6], stair: [0, -5], greenhouse: [0, 4], astro: [3, 0], potions: [0, -8] }[c.zone] || [0, 0];
    zn.addInteract({
      x: spot[0], z: spot[1], r: 3.2, label: `上课:${c.name}`, icon: c.icon,
      cond: () => {
        const [am, pm] = WEEK_SCHEDULE[S.day % 7];
        const cur = S.phase === 1 ? am : S.phase === 2 ? pm : null;
        if (cur !== cid) return false;
        if (flag(`class_${S.day}_${S.phase}`)) return false;
        return true;
      },
      cb: () => attendClass(cid),
    });
  }
  // 大厅:考试
  zones.get('hall')?.addInteract({
    x: 0, z: -18, r: 3.5, label: '参加学期考试', icon: '🖋',
    cond: () => isExamToday() && S.phase === 2 && !flag('exam_' + S.day) ? true : false,
    cb: () => runExam(),
  });
}

// ---------------- 地下密室机关 ----------------
function registerDungeon() {
  const d = zones.get('dungeon');
  if (!d) return;
  for (const c of d.chests) {
    d.addInteract({
      x: c.x, z: c.z, r: 2, label: '开启宝箱', icon: '🧰',
      cond: () => !flag('loot_' + c.id),
      cb: () => {
        setFlag('loot_' + c.id);
        P.rig.play('interact', { once: true });
        const roll = Math.random();
        setTimeout(() => {
          if (roll < 0.4) { addGold(20 + Math.floor(Math.random() * 25)); }
          else if (roll < 0.7) addItem('potion_heal', 1);
          else if (roll < 0.9) addItem(['mushroom', 'frogeye', 'stardust'][Math.floor(Math.random() * 3)], 2);
          else addItem('potion_luck', 1);
          spark(new THREE.Vector3(P.pos.x, P.pos.y + 1, P.pos.z), { color: 0xffd75a, n: 22, speed: 2.5, up: 2 });
        }, 500);
      },
    });
    // 放宝箱模型
    import('./castle.js').then(({ put }) => put(d, 'trunk_medium_A', c.x, 0, c.z, Math.random() * 6.28));
  }
  for (const c of d.coins) {
    d.addInteract({
      x: c.x, z: c.z, r: 1.8, label: '拾取金币', icon: '🪙',
      cond: () => !flag('loot_' + c.id),
      cb: () => { setFlag('loot_' + c.id); addGold(8 + Math.floor(Math.random() * 10)); P.rig.play('pickup', { once: true }); },
    });
    import('./castle.js').then(({ put }) => put(d, 'coin_stack_medium', c.x, 0, c.z));
  }
  // 浮石搬运(压力板机关)
  if (d._block) {
    d.addInteract({
      x: 0, z: 0, r: 2.2, dynamic: () => ({ x: d._block.mesh.position.x, z: d._block.mesh.position.z }),
      label: '漂浮咒:搬运浮石', icon: '🪶',
      cond: () => !d.gateObj1?.open,
      cb: () => {
        if (!d._block.held) {
          d._block.held = true;
          toast('🪶 浮石悬浮而起,跟随着你(再按 E 放下)');
          P.rig.play('castRaise', { once: true });
        } else {
          d._block.held = false;
          const bp = d._block.mesh.position;
          bp.y = 0.75;
          // 检查是否在压力板上
          const pl = d._plate.pos;
          if (Math.hypot(bp.x - pl.x, bp.z - pl.z) < 1.4) {
            bp.set(pl.x, 0.75, pl.z);
            openGate(d, '1');
          }
        }
      },
    });
  }
  // 传送门
  d._portalCd = 0;
  // 机关厅审视
  if (d._mechCenter) {
    d.addInteract({
      x: d._mechCenter.x, z: d._mechCenter.z, r: 4, label: '审视古代机关', icon: '⚙',
      cond: () => {
        const ms = questStep('main');
        if (ms === 8) {
          const keys = ['key_lion', 'key_eagle', 'key_badger'].filter((k) => hasItem(k)).length;
          if (keys < 3) return `机关上有三个钥匙孔——你还缺 ${3 - keys} 把学院之钥。`;
          return true;
        }
        if (ms >= 9) return true;
        return '巨大的黄铜圆环在缓缓转动,发出两百年前的声音。';
      },
      cb: () => {
        const ms = questStep('main');
        if (ms === 8) {
          advanceQuest('main', 9);
          window.__sys?.combat?.startBoss?.();
        } else if (ms >= 10) {
          toast('机关安静了。回去找校长吧。');
        } else if (ms === 9) {
          window.__sys?.combat?.startBoss?.();
        }
      },
    });
  }
}
export function openGate(d, id) {
  const g = d['gateObj' + id];
  if (!g || g.open) return;
  g.open = true;
  // 门下沉动画
  const mesh = g.mesh;
  let t = 0;
  const tick = () => {
    t += 0.016;
    mesh.position.y = -t * 2.2;
    if (t < 1.9) requestAnimationFrame(tick);
  };
  tick();
  const i = d.colliders.indexOf(g.col);
  if (i >= 0) d.colliders.splice(i, 1);
  toast('⛩ 沉重的石门缓缓沉入地面……', true);
  emit('sfx', 'rumble');
  addXP(30);
}

// ---------------- 交互主循环 ----------------
let _mgBusy = false;
export function updateGameplay(dt) {
  if (dlgOpen()) { updateDialogueCam(dt); return; }
  if (_mgBusy) return;

  // 动态交互点(浮石跟随)
  const d = zones.get('dungeon');
  if (d?._block?.held) {
    const bp = d._block.mesh.position;
    const tx = P.pos.x - d.offset.x - Math.sin(P.yaw) * -1.6;
    const tz = P.pos.z - d.offset.z - Math.cos(P.yaw) * -1.6;
    bp.x += (tx - bp.x) * Math.min(1, dt * 6);
    bp.z += (tz - bp.z) * Math.min(1, dt * 6);
    bp.y = 1.4 + Math.sin(performance.now() / 400) * 0.12;
    d._blockCol.min.set(bp.x - 0.85 + d.offset.x, 0, bp.z - 0.85 + d.offset.z);
    d._blockCol.max.set(bp.x + 0.85 + d.offset.x, 0.01, bp.z + 0.85 + d.offset.z);
  }
  // 压力板检测(玩家踩上也行? 仅浮石)
  // 传送门
  if (activeZone?.id === 'dungeon' && d?._portals?.length === 2) {
    d._portalCd -= dt;
    if (d._portalCd <= 0) {
      for (let i = 0; i < 2; i++) {
        const p = d._portals[i];
        const w = d.W(p.x, p.z);
        if (Math.hypot(P.pos.x - w.x, P.pos.z - w.z) < 1.2) {
          const o = d._portals[1 - i];
          const wo = d.W(o.x, o.z);
          P.pos.x = wo.x; P.pos.z = wo.z + 1.6;
          d._portalCd = 1.2;
          spark(new THREE.Vector3(P.pos.x, P.pos.y + 1, P.pos.z), { color: i ? 0x2a86d0 : 0xd0862a, n: 26, speed: 3 });
          emit('sfx', 'portal');
          toast('🌀 穿过了古代传送门');
        }
      }
    }
  }

  // 交互优先级:近的 NPC vs 区域交互点
  const npc = nearestTalkable(2.5);
  const it = P.nearInteract;
  let choice = null;
  if (npc && it) {
    const wpN = new THREE.Vector3(); npc.rig.group.getWorldPosition(wpN);
    const dN = Math.hypot(wpN.x - P.pos.x, wpN.z - P.pos.z);
    const w = activeZone.W(it.x, it.z);
    const dI = Math.hypot(P.pos.x - w.x, P.pos.z - w.z);
    choice = dN < dI ? { npc } : { it };
  } else if (npc) choice = { npc };
  else if (it) choice = { it };

  // 提示(NPC 覆盖默认提示)
  if (choice?.npc && !window.__dialogOpen) {
    setPrompt(`<span class="k">E</span>💬 与 ${choice.npc.def.name} 交谈`);
  }

  if ((pressed('KeyE') || pressed('V_interact')) && choice) {
    if (choice.npc) return talkTo(choice.npc.id);
    const t2 = choice.it;
    if (t2.cond) {
      const r = t2.cond();
      if (r !== true) { if (typeof r === 'string') toast(r); return; }
    }
    if (t2.isDoor) { throughDoor(t2); return; }
    if (t2.shop) return openShop('tikki');
    if (t2.decor) return enterDecor();
    t2.cb?.(t2);
  }

  // Tab 菜单
  if (pressed('Tab') || pressed('V_menu')) window.__sys?.ui?.toggleMenu?.();
  updateDecor(dt);
}

// ---------------- NPC 对话(注入任务钩子) ----------------
export function talkTo(npcId) {
  const hooks = questHooksFor(npcId);
  startDialogue(npcId, buildDialogueEx(npcId, hooks));
}

function questHooksFor(npcId) {
  const hooks = [];
  const ms = questStep('main');
  const H = (t, fn, next = 'end') => hooks.push({ t: '📜 ' + t, action: fn, next });

  // 任课教师:上课时段可直接通过对话开始上课
  {
    const [am, pm] = WEEK_SCHEDULE[S.day % 7];
    const cur = S.phase === 1 ? am : S.phase === 2 ? pm : null;
    if (cur && CLASSES[cur].teacher === npcId && !flag(`class_${S.day}_${S.phase}`)) {
      hooks.push({ t: `📖 「教授,我来上${CLASSES[cur].name}了!」(开始上课)`, next: 'end', action: () => setTimeout(() => attendClass(cur), 350) });
    }
  }

  if (npcId === 'vance') {
    if (ms === 10) hooks.push({ t: '📜 「校长,地下的机关……」(做出抉择)', next: '__vanceFinal' });
  }
  if (npcId === 'vera') {
    if (ms === 3) hooks.push({ t: '📜 「薇拉,关于地下的齿轮声……」', next: '__veraMain' });
    if (affTier('vera') >= 1 && !S.quests.vera_book) H('「你在找什么书吗?」', () => startQuest('vera_book'));
    if (questStep('vera_book') === 1 && hasItem('gift_book')) H('把《高级魔咒理论》还给薇拉', () => { removeItem('gift_book', 1); completeQuest('vera_book'); });
  }
  if (npcId === 'cassian') {
    if (questStep('vera_book') === 0) hooks.push({ t: '📜 「薇拉的书在你这儿吧?」', next: '__cassianBook' });
  }
  if (npcId === 'grey') {
    if (ms === 5) hooks.push({ t: '📜 「教授,我需要调制显形剂。」', next: '__greyHint' });
  }
  if (npcId === 'victor') {
    if (!S.quests.duel_club) H('「我想加入决斗社!」', () => { startQuest('duel_club'); advanceQuest('duel_club', 1); });
    if (questStep('duel_club') === 2) H('领取冠军之证', () => { completeQuest('duel_club'); toast('🗝 获得 狮之钥!', true); checkKeys(); });
  }
  if (npcId === 'celeste') {
    if (ms >= 7 && !S.quests.star_key) H('「教授,我在找一个像钥匙的星座。」', () => { startQuest('star_key'); toast('夜晚去用望远镜寻找钥匙星座'); });
  }
  if (npcId === 'thorne') {
    if (ms >= 7 && !S.quests.moon_key) H('「教授,獾之钥的传说……」', () => { startQuest('moon_key'); toast('夜里去照料月光花圃'); });
    if (questStep('moon_key') === 1 && hasItem('moonflower_bloom')) H('献上盛开的月光花', () => { removeItem('moonflower_bloom', 1); completeQuest('moon_key'); toast('🗝 获得 獾之钥!', true); checkKeys(); });
  }
  if (npcId === 'thomas') {
    if (!S.quests.ghost_watch) hooks.push({ t: '📜 「您在找什么呢?」', next: '__thomasWatch' });
    if (questStep('ghost_watch') === 1 && hasItem('watch_ghost')) H('把怀表递过去', () => { removeItem('watch_ghost', 1); completeQuest('ghost_watch'); });
  }
  if (npcId === 'ella') {
    if (affTier('ella') >= 0 && !S.quests.ella_poem && questStep('main') >= 4) H('「你在守护着什么?」', () => startQuest('ella_poem'));
    if (questStep('ella_poem') === 1 && hasItem('poem_page')) H('轻声读出诗页', () => { removeItem('poem_page', 1); completeQuest('ella_poem'); });
  }
  if (npcId === 'tikki') {
    hooks.push({ t: '🛒 看看提基的货品', action: () => setTimeout(() => openShop('tikki'), 60), next: 'end' });
    if (!S.quests.elf_recipe) H('「你想念什么味道?」', () => startQuest('elf_recipe'));
    if (questStep('elf_recipe') === 0 && hasItem('mushroom', 2)) H('交出 2 朵荧光菌', () => { removeItem('mushroom', 2); advanceQuest('elf_recipe', 1); completeQuest('elf_recipe'); });
  }
  if (npcId === 'poppy') {
    if (affTier('poppy') >= 1 && !S.quests.poppy_roots) H('「需要我帮忙吗?」', () => startQuest('poppy_roots'));
    if (questStep('poppy_roots') === 0 && hasItem('gnarl', 2)) H('递上 2 段扭曲树根', () => { removeItem('gnarl', 2); advanceQuest('poppy_roots', 1); completeQuest('poppy_roots'); });
  }
  if (npcId === 'leo') {
    if (affTier('leo') >= 1 && !S.quests.leo_train) H('「想练一场吗?」', () => { startQuest('leo_train'); toast('黄昏去庭院和里奥切磋(决斗练习场)'); });
    if (questStep('leo_train') === 1) H('「服气了吗?」', () => completeQuest('leo_train'));
  }
  if (npcId === 'isaac' && ms >= 8) {
    H('「地下的机关,你怎么看?」', () => { addXP(10); subtitle('伊萨克塞给你一张写满齿轮比的草稿纸,眼睛闪闪发光。'); });
  }
  return hooks;
}

// 特殊对话分支挂载(story buildDialogue 的 nodes 扩展)
const _origBuild = buildDialogue;
export function buildDialogueEx(npcId, hooks) {
  const nodes = _origBuild(npcId, hooks);
  Object.assign(nodes, extraNodes(npcId));
  return nodes;
}
function extraNodes(npcId) {
  const out = {};
  if (npcId === 'vera') {
    out.__veraMain = [
      { sp: 'vera', t: '齿轮声?……等等,我在《城堡建造者轶闻》里见过!创校时期有位工匠,在地下造了一座「校准城堡魔力」的机关。', emo: '❗' },
      { sp: 'vera', t: '原书在禁书区。白天银链锁着,但深夜……艾拉说过,月亮愿意的时候,链子会松。', anim: 'interact' },
      { sp: 'me', t: '「深夜的禁书区……好,我去看看。」', next: 'end', action: () => advanceQuest('main', 4) },
    ];
  }
  if (npcId === 'cassian') {
    out.__cassianBook = [
      { sp: 'cassian', t: '哦,那本《高级魔咒理论》?是我借的,怎么了。', emo: '🙄' },
      { sp: 'me', t: '', choices: [
        { t: '「薇拉很着急,还给她好吗?」(真诚)', next: '__cassianGive', aff: { cassian: 3 } },
        { t: '「决斗定输赢,赢了你还书。」', next: '__cassianDuel' },
      ] },
    ];
    out.__cassianGive = [
      { sp: 'cassian', t: '……哼,拿去。告诉她第七章的注释是错的,我批注好了。', emo: '😌',
        action: () => { addItem('gift_book', 1, true); advanceQuest('vera_book', 1); toast('获得 📕《高级魔咒理论》(带批注)'); }, next: 'end' },
    ];
    out.__cassianDuel = [
      { sp: 'cassian', t: '有胆量。黄昏,庭院,决斗场。赢了我,书归你。', emo: '😏', next: 'end',
        action: () => { setFlag('cassianBookDuel'); toast('黄昏去庭院决斗场挑战卡西安'); } },
    ];
  }
  if (npcId === 'grey') {
    out.__greyHint = [
      { sp: 'grey', t: '显形剂?哼,总算有人问点正经问题。荧光菌、蛙眼石、月光花瓣——文火,顺时针,七圈,一圈都不许多。', emo: '🧐' },
      { sp: 'grey', t: '材料自己去找:荧光菌和蛙眼石禁林有,月光花瓣夜里的温室摘,或者去小卖部碰运气。搞砸了别把我的坩埚炸了。', next: 'end',
        action: () => toast('📜 显形剂配方已记入(坩埚处调制)') },
    ];
  }
  if (npcId === 'thomas') {
    out.__thomasWatch = [
      { sp: 'thomas', t: '我的怀表……黄铜的,链子断了一环。那晚我在禁林巡逻,再后来……我就不需要看时间了。', emo: '👻' },
      { sp: 'thomas', t: '它应该还躺在石阵附近。如果你去禁林……帮我看看,好吗?', next: 'end',
        action: () => startQuest('ghost_watch') },
    ];
  }
  if (npcId === 'vance') {
    out.__vanceFinal = [
      { sp: 'vance', t: '你击败了守卫……了不起。那么,那座机关,你觉得该如何处置?', emo: '🧐' },
      { sp: 'me', t: '', choices: [
        { t: '「封印它。有些力量应该沉睡。」', next: '__endSeal' },
        { t: '「研究它!让伊萨克和大家一起。」', next: '__endStudy' },
      ] },
    ];
    out.__endSeal = [
      { sp: 'vance', t: '谨慎是一种勇气。我会亲自加固封印——城堡谢谢你,孩子。', emo: '😊',
        action: () => { setFlag('ending', 'seal'); completeQuest('main'); setTimeout(celebration, 800); }, next: 'end' },
    ];
    out.__endStudy = [
      { sp: 'vance', t: '好奇心是魔法的火种。我会成立一个研究小组——伊萨克听到会高兴疯的。', emo: '😄',
        action: () => { setFlag('ending', 'study'); addAff('isaac', 20); completeQuest('main'); setTimeout(celebration, 800); }, next: 'end' },
    ];
  }
  return out;
}

// 庆典结局
function celebration() {
  fadeTransition(() => {
    S.phase = 4;
    teleport('hall', 0, 20, Math.PI);
    relocateAll(true);
    subtitle('当晚,大厅灯火通明——为一位学生,和一个重见天日的老故事。', 5000);
    let n = 0;
    const t = setInterval(() => {
      spark(new THREE.Vector3(P.pos.x + (Math.random() - 0.5) * 20, 6 + Math.random() * 4, P.pos.z + (Math.random() - 0.5) * 24), { color: [0xffd75a, 0xff7a5a, 0x8fd0ff, 0xd08fff][n % 4], n: 30, speed: 5, up: 1 });
      if (++n > 14) clearInterval(t);
    }, 380);
    setTimeout(() => {
      toast(`🎓 学年史册已记下你的名字:${S.name}·${HOUSES[S.house].name}`, true);
      toast(flag('ending') === 'seal' ? '「守护者」结局 · 机关沉眠,城堡安宁' : '「探求者」结局 · 智慧之门,由此开启', true);
      saveGame();
    }, 3200);
  });
}

// ---------------- 禁书区 ----------------
function restrictedSection() {
  const ms = questStep('main');
  _mgBusy = true;
  fadeTransition(() => {
    P.pos.z = activeZone.offset.z - 22;
    _mgBusy = false;
    if (ms === 4) {
      setTimeout(() => startDialogue('ella', {
        start: [
          { sp: 'ella', t: '(月光下,银链无声滑落)……你找的……是那本会响的书吧……', emo: '👻' },
          { sp: 'ella', t: '(她指向最高的书架——一本书自己飘了下来,落进你手里)《创校者的齿轮》……两百年,终于有人来翻开它了……' },
          { sp: 'me', t: '「谢谢你,艾拉。」', next: 'end',
            action: () => { addItem('gear_note', 1); advanceQuest('main', 5); addAff('ella', 8); } },
        ],
      }), 700);
    } else if (questStep('ella_poem') === 0) {
      setTimeout(() => { addItem('poem_page', 1, true); toast('📜 你在一本旧诗集里找到一页娟秀的手稿'); advanceQuest('ella_poem', 1); }, 900);
    } else {
      subtitle('禁书区的书在低声交谈,看到你,又齐齐闭上了嘴。');
    }
  });
}

// ---------------- 月光花/望远镜 ----------------
function moonflowerInteract() {
  if (questStep('moon_key') === 0) {
    if (S.phase < 4) { toast('月光花只在夜里舒展。'); return; }
    P.rig.play('use', { once: true });
    setTimeout(() => {
      spark(new THREE.Vector3(P.pos.x, P.pos.y + 1, P.pos.z), { color: 0xbfd0ff, n: 30, speed: 2, up: 1.5 });
      addItem('moonflower_bloom', 1, true);
      toast('🌸 月光花在你掌心盛开,像一小捧月亮', true);
      advanceQuest('moon_key', 1);
    }, 700);
  } else if (S.phase >= 4) {
    subtitle('月光花轻轻摇晃,洒下一点银色的粉末。');
    if (!flag('moonpetal_gh_' + S.day)) { setFlag('moonpetal_gh_' + S.day); addItem('moonpetal', 1); }
  } else {
    subtitle('花苞闭得紧紧的,在等夜晚。');
  }
}
async function telescopeInteract() {
  if (S.phase < 4) { toast('白天的星星在害羞。夜里再来。'); return; }
  _mgBusy = true;
  if (questStep('star_key') === 0) {
    const score = await astroConnect({ key: true });
    _mgBusy = false;
    if (score >= 60) { completeQuest('star_key'); toast('🗝 获得 鹰之钥!', true); checkKeys(); }
    else toast('星光散了……再试一次吧。');
  } else {
    const score = await astroConnect({});
    _mgBusy = false;
    if (!flag('stargaze_' + S.day)) { setFlag('stargaze_' + S.day); addXP(Math.round(score / 5)); S.stats.stars++; }
  }
}
function checkKeys() {
  const keys = ['key_lion', 'key_eagle', 'key_badger'].filter((k) => hasItem(k)).length;
  if (keys >= 3 && questStep('main') === 7) {
    advanceQuest('main', 8);
    if (!S.spells.includes('portara')) { S.spells.push('portara'); toast('🌀 领悟新咒语:时空门!(技能页可装备)', true); }
    toast('三把学院之钥齐了!深入地下密室吧!', true);
  }
}

// ---------------- 上课/考试 ----------------
async function attendClass(cid) {
  _mgBusy = true;
  setFlag(`class_${S.day}_${S.phase}`);
  const c = CLASSES[cid];
  let score = 0;
  if (cid === 'charms' || cid === 'defense') score = await runeTrace({ spellName: c.name });
  else if (cid === 'potions') score = await potionBrew({ recipe: RECIPES[Math.floor(Math.random() * 2)] });
  else if (cid === 'herbology') score = await herbQTE();
  else if (cid === 'astronomy') score = await astroConnect({});
  _mgBusy = false;
  addGrade(cid, score);
  addXP(20 + Math.round(score / 4));
  toast(`${c.icon} ${c.name} 课堂表现 +${score.toFixed(0)} 学业分`);
  // 魔咒课解锁进阶咒语
  if (cid === 'charms') {
    if (!S.spells.includes('incendio')) {
      S.spells.push('incendio');
      if (S.slots[3] === 'bolt') S.slots[3] = 'incendio';
      toast('🔥 习得新咒语:火焰咒!(已装备到 4 号槽)', true);
    } else if (!S.spells.includes('glacius')) {
      S.spells.push('glacius');
      toast('❄ 习得新咒语:冰冻咒!(状态页可装备)', true);
    }
  }
  if (questStep('main') === 1) advanceQuest('main', 2);
  emit('hud');
}
async function runExam() {
  _mgBusy = true;
  setFlag('exam_' + S.day);
  const qs = [...QUIZ].sort(() => Math.random() - 0.5).slice(0, 5);
  const written = await quizExam(qs);
  _mgBusy = false;
  // 实践分 = 各科平均
  const gs = Object.values(S.grades);
  const practical = gs.length ? gs.reduce((s, g) => s + g.score / Math.max(1, g.sessions), 0) / gs.length : 40;
  const total = written * 0.6 + practical * 0.4;
  const pass = total >= 60;
  toast(`🖋 考试成绩:${total.toFixed(0)} 分 ${pass ? '· 通过!技能点 +2' : '· 下次加油'}`, true);
  if (pass) { S.skillPoints += 2; addXP(60); addGold(30); }
  else addXP(20);
  S.credits += Math.round(total / 5);
  emit('hud');
  saveGame();
}

// ---------------- 睡觉 ----------------
function sleep() {
  fadeTransition(() => {
    P.rig.play('lie', { force: true });
    const toDawn = (6 - S.phase) % 6 || 6;
    advancePhase(toDawn);
    heal(999); restoreMp(999);
    toast(`🌅 ${'新的一天。'}${WEEK_SCHEDULE[S.day % 7][0] ? '今天有课,别迟到!' : '今天没课,自由活动!'}`, true);
    if (S.weather === 'rain') toast('🌧 窗外下起了雨,雨点敲着玻璃。');
    saveGame();
    setTimeout(() => P.rig.play('idle'), 1500);
  }, 700);
}

// ---------------- 商店 ----------------
const SHOP_STOCK = {
  tikki: ['potion_heal', 'potion_mana', 'gift_choco', 'gift_quill', 'gift_book', 'gift_plant', 'gift_snack', 'moonpetal', 'frogeye', 'mushroom'],
  owl: ['gift_choco', 'gift_snack', 'potion_heal'],
};
export function openShop(kind) {
  const stock = SHOP_STOCK[kind] || SHOP_STOCK.tikki;
  const body = $('mpMenuBody');
  $('mpMenu').classList.remove('hidden');
  Input.enabled = false;
  document.exitPointerLock?.();
  const render = () => {
    body.innerHTML = `<h2 style="text-align:center;color:var(--gold-hi);letter-spacing:4px;margin-bottom:4px">${kind === 'tikki' ? '🧦 提基的百宝摊' : '🦉 猫头鹰邮购'}</h2>
      <div style="text-align:center;color:var(--ink-dim);font-size:13px;margin-bottom:10px">你的金币:🪙 ${S.gold}</div>
      <div style="max-height:46vh;overflow:auto">
      ${stock.map((id) => {
        const it = ITEMS[id];
        return `<div class="sched-row"><span style="font-size:22px">${it.icon}</span>
          <span style="flex:1"><b>${it.name}</b><br><span style="font-size:12px;color:#9c8f74">${it.desc}</span></span>
          <span style="color:#e8c96a">🪙 ${it.price}</span>
          <button class="btn small" data-buy="${id}" ${S.gold < it.price ? 'disabled' : ''}>购买</button></div>`;
      }).join('')}
      ${kind === 'owl' ? `<div class="divider"></div><div style="color:var(--ink-dim);font-size:13px;padding:4px 12px">家具请在「布置房间」模式下购买摆放</div>` : ''}
      </div>
      <div style="display:flex;gap:10px;margin-top:12px"><button class="btn" id="shopClose" style="flex:1">离开</button></div>`;
    body.querySelectorAll('[data-buy]').forEach((el) => {
      el.onclick = () => {
        const it = ITEMS[el.dataset.buy];
        if (S.gold < it.price) return;
        addGold(-it.price);
        addItem(el.dataset.buy, 1);
        emit('sfx', 'coin');
        render();
      };
    });
    $('shopClose').onclick = () => { $('mpMenu').classList.add('hidden'); Input.enabled = true; };
  };
  render();
}

// ---------------- 宿舍装饰 ----------------
const decor = { active: false, sel: null, ghost: null, rot: 0 };
export function rebuildDecor() {
  const dorm = zones.get('dorm');
  if (!dorm?._decorRoot) return;
  const root = dorm._decorRoot;
  while (root.children.length) root.remove(root.children[0]);
  // 移除旧家具碰撞
  dorm.colliders = dorm.colliders.filter((c) => !c._decor);
  for (const it of S.decor) {
    const def = FURNITURE.find((f) => f.id === it.id);
    if (!def) continue;
    const m = makeFurnMesh(def);
    if (!m) continue;
    m.position.set(it.x, def.wall ? 2.2 : 0, it.z);
    m.rotation.y = it.rot || 0;
    root.add(m);
    if (!def.wall) {
      const c = { min: new THREE.Vector3(it.x - 0.8 + dorm.offset.x, 0, it.z - 0.8 + dorm.offset.z), max: new THREE.Vector3(it.x + 0.8 + dorm.offset.x, 1.4, it.z + 0.8 + dorm.offset.z), _decor: true };
      dorm.colliders.push(c);
    }
  }
}
function makeFurnMesh(def) {
  if (def.prop.startsWith('@')) {
    const g = new THREE.Group();
    if (def.prop === '@rug') {
      const rug = new THREE.Mesh(new THREE.CircleGeometry(1.6, 18), new THREE.MeshStandardMaterial({ color: HOUSES[S.house].color, roughness: 1 }));
      rug.rotation.x = -Math.PI / 2; rug.position.y = 0.05;
      g.add(rug);
    } else if (def.prop === '@plant') {
      const pot = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.24, 0.4, 10), new THREE.MeshStandardMaterial({ color: 0x8a5a3a }));
      pot.position.y = 0.2;
      const leaf = new THREE.Mesh(new THREE.SphereGeometry(0.4, 8, 6), new THREE.MeshStandardMaterial({ color: 0x3a6b35 }));
      leaf.position.y = 0.72; leaf.scale.y = 1.2;
      g.add(pot, leaf);
    } else if (def.prop === '@housebanner') {
      const src = A.dungeon[HOUSES[S.house].banner];
      if (src) g.add(src.clone(true));
    } else if (def.prop === '@owl') {
      const stand = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.09, 1.4, 8), new THREE.MeshStandardMaterial({ color: 0x4a3a28 }));
      stand.position.y = 0.7;
      const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.6, 6), stand.material);
      bar.rotation.z = Math.PI / 2; bar.position.y = 1.4;
      const owl = new THREE.Mesh(new THREE.SphereGeometry(0.18, 8, 8), new THREE.MeshStandardMaterial({ color: 0xd8ccb0 }));
      owl.scale.y = 1.3; owl.position.y = 1.62;
      const eyeL = new THREE.Mesh(new THREE.SphereGeometry(0.045, 6, 6), new THREE.MeshBasicMaterial({ color: 0x201408 }));
      eyeL.position.set(-0.06, 1.68, 0.14);
      const eyeR = eyeL.clone(); eyeR.position.x = 0.06;
      g.add(stand, bar, owl, eyeL, eyeR);
    } else if (def.prop === '@cauldron') {
      const pot = new THREE.Mesh(new THREE.SphereGeometry(0.4, 10, 8, 0, 7, 0.8, 1.6), new THREE.MeshStandardMaterial({ color: 0x1c1c22, metalness: 0.7, roughness: 0.5 }));
      pot.position.y = 0.35;
      g.add(pot);
    } else if (def.prop === '@starlamp') {
      const orb = new THREE.Mesh(new THREE.IcosahedronGeometry(0.3, 1), new THREE.MeshStandardMaterial({ color: 0xf0d9a8, emissive: 0xc9a86a, emissiveIntensity: 1.5 }));
      orb.position.y = 2.4;
      const L = new THREE.PointLight(0xf0d9a8, 10, 8, 2);
      L.position.y = 2.3;
      g.add(orb, L);
    }
    g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
    return g;
  }
  const src = A.dungeon[def.prop] || A.props[def.prop];
  if (!src) return null;
  const m = src.clone(true);
  m.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  return m;
}
function enterDecor() {
  decor.active = true;
  P.state = 'decor';
  Input.enabled = true;
  $('decorBar').classList.remove('hidden');
  renderDecorBar();
  toast('🪑 布置模式:走到位置按 E 放置 · R 旋转 · Q 移除最近 · Esc 退出', true);
}
function exitDecor() {
  decor.active = false;
  P.state = 'normal';
  $('decorBar').classList.add('hidden');
  if (decor.ghost) { decor.ghost.parent?.remove(decor.ghost); decor.ghost = null; }
  rebuildDecor();
  saveGame();
}
function renderDecorBar() {
  const bar = $('decorBar');
  bar.innerHTML = `<button class="btn small" id="decorExit">完成 ✓</button>` + FURNITURE.map((f) => {
    const owned = S.inv['furn_' + f.id] || 0;
    const placed = S.decor.filter((d) => d.id === f.id).length;
    const free = f.price === 0 && !f.questReward;
    const canBuy = S.gold >= f.price;
    return `<div class="decor-item ${decor.sel === f.id ? 'sel' : ''}" data-f="${f.id}">
      <span class="ic">${f.icon}</span>${f.name}<br>
      <span style="color:#8d8064">${f.questReward ? (S.inv.trophy ? '已拥有' : '决斗夺冠奖励') : owned > 0 || free ? `持有 ${free ? '∞' : owned}` : `🪙${f.price}`}</span>
      ${placed ? `<span style="color:#8fb8ff"> 已摆${placed}</span>` : ''}</div>`;
  }).join('');
  $('decorExit').onclick = exitDecor;
  bar.querySelectorAll('.decor-item').forEach((el) => {
    el.onclick = () => {
      const f = FURNITURE.find((x) => x.id === el.dataset.f);
      const owned = S.inv['furn_' + f.id] || 0;
      const free = f.price === 0 && !f.questReward;
      if (f.questReward && !S.inv.trophy) { toast('决斗社夺冠后可获得'); return; }
      if (!free && owned <= 0 && !f.questReward) {
        if (S.gold < f.price) { toast('金币不够'); return; }
        addGold(-f.price);
        addItem('furn_' + f.id, 1, true);
        toast(`购入 ${f.name}`);
      }
      decor.sel = f.id;
      renderDecorBar();
      makeGhost(f);
    };
  });
}
function makeGhost(f) {
  const dorm = zones.get('dorm');
  if (decor.ghost) decor.ghost.parent?.remove(decor.ghost);
  const m = makeFurnMesh(f);
  if (!m) return;
  m.traverse((o) => { if (o.isMesh && o.material) { o.material = o.material.clone(); o.material.transparent = true; o.material.opacity = 0.55; } });
  dorm._decorRoot.add(m);
  decor.ghost = m;
}
function updateDecor(dt) {
  if (!decor.active) {
    if (P.state === 'decor') P.state = 'normal';
    return;
  }
  if (pressed('Escape')) { exitDecor(); return; }
  const dorm = zones.get('dorm');
  const b = dorm._decorBounds;
  if (decor.ghost && decor.sel) {
    const f = FURNITURE.find((x) => x.id === decor.sel);
    // 幽灵跟随玩家前方
    const gx = Math.round((P.pos.x - dorm.offset.x + Math.sin(P.yaw) * 1.8) * 2) / 2;
    const gz = Math.round((P.pos.z - dorm.offset.z + Math.cos(P.yaw) * 1.8) * 2) / 2;
    const cx = Math.max(b.x0, Math.min(b.x1, gx));
    const cz = Math.max(b.z0, Math.min(b.z1, gz));
    if (pressed('KeyR')) decor.rot = (decor.rot + Math.PI / 4) % (Math.PI * 2);
    decor.ghost.position.set(cx, f.wall ? 2.2 : 0, f.wall ? (Math.abs(cz - b.z0) < Math.abs(cz - b.z1) ? b.z0 - 1 : cz) : cz);
    decor.ghost.rotation.y = decor.rot;
    if (pressed('KeyE') || pressed('V_interact')) {
      const owned = S.inv['furn_' + decor.sel] || 0;
      const free = f.price === 0 && !f.questReward;
      const already = S.decor.filter((d) => d.id === decor.sel).length;
      if (!free && !f.questReward && owned - already <= 0) { toast('这件家具没有存货了,再买一件吧'); }
      else if (f.questReward && already >= 1) { toast('奖杯只有一座!'); }
      else {
        S.decor.push({ id: decor.sel, x: cx, z: decor.ghost.position.z, rot: decor.rot });
        rebuildDecor();
        emit('sfx', 'plop');
        if (S.decor.length >= 5 && !questDone('deco_contest')) { startQuest('deco_contest'); completeQuest('deco_contest'); }
      }
    }
  }
  if (pressed('KeyQ')) {
    // 移除最近
    let best = -1, bd = 2.5;
    S.decor.forEach((d2, i) => {
      const dd = Math.hypot(d2.x - (P.pos.x - dorm.offset.x), d2.z - (P.pos.z - dorm.offset.z));
      if (dd < bd) { bd = dd; best = i; }
    });
    if (best >= 0) {
      const rm = S.decor.splice(best, 1)[0];
      const f = FURNITURE.find((x) => x.id === rm.id);
      if (f && f.price > 0) addItem('furn_' + rm.id, 1, true);
      rebuildDecor();
      toast('已收起家具');
    }
  }
}

// 首次加载后重建装饰
on('gamestart', () => setTimeout(rebuildDecor, 300));
