// story.js — 任务定义 + NPC 对话树
import { S, flag, setFlag, addItem, hasItem, removeItem, addXP, addGold, addAff, affTier, emit } from './state.js';
import { NPCS, ITEMS, HOUSES } from './data.js';

// ---------------- 任务 ----------------
export const QUESTS = {
  main: {
    name: '沉睡的机关', type: '主线',
    steps: [
      { id: 0, text: '入学日:在大厅与凡斯校长谈话', zone: 'hall' },
      { id: 1, text: '上你的第一堂课(查看日程,上午/午后前往教室)', zone: null },
      { id: 2, text: '深夜似乎有异响……夜晚后去楼梯厅调查', zone: 'stair' },
      { id: 3, text: '去图书馆找薇拉·奥利文帮忙', zone: 'library' },
      { id: 4, text: '深夜的禁书区里,有艾拉守护的线索', zone: 'library' },
      { id: 5, text: '调制「显形剂」(收集荧光菌、蛙眼石、月光花瓣,在魔药教室调制)', zone: 'potions' },
      { id: 6, text: '用显形剂让楼梯厅的裂缝密道现形', zone: 'stair' },
      { id: 7, text: '集齐三把学院之钥:狮(决斗夺冠)、鹰(天文塔星谜)、獾(培育月光花)', zone: null },
      { id: 8, text: '深入地下密室,解开古代机关,直抵机关厅', zone: 'dungeon' },
      { id: 9, text: '击败苏醒的古代守卫!', zone: 'dungeon' },
      { id: 10, text: '回去向凡斯校长报告,做出你的抉择', zone: 'hall' },
    ],
    rewards: { xp: 300, gold: 200 },
  },
  ghost_watch: {
    name: '停摆的怀表', type: '支线', giver: 'thomas',
    steps: [
      { id: 0, text: '老托马斯在找他生前的黄铜怀表,据说掉在了禁林的石阵附近', zone: 'forest' },
      { id: 1, text: '把怀表还给天文塔的老托马斯', zone: 'astro' },
    ],
    rewards: { xp: 80, gold: 40, items: { stardust: 2 } },
  },
  ella_poem: {
    name: '低语的诗页', type: '支线', giver: 'ella',
    steps: [
      { id: 0, text: '艾拉想要她生前写下的诗——据说被夹在禁书区的某本书里', zone: 'library' },
      { id: 1, text: '把诗页读给艾拉听', zone: 'library' },
    ],
    rewards: { xp: 70, items: { potion_mana: 2 } },
  },
  elf_recipe: {
    name: '小精灵的秘方', type: '支线', giver: 'tikki',
    steps: [
      { id: 0, text: '提基想复刻家传炖菜:给他带 2 朵荧光菌', zone: 'forest' },
      { id: 1, text: '把荧光菌交给提基', zone: 'stair' },
    ],
    rewards: { xp: 60, gold: 30, items: { gift_snack: 2 } },
  },
  duel_club: {
    name: '决斗社的荣耀', type: '社团', giver: 'victor',
    steps: [
      { id: 0, text: '黄昏时分,到庭院加入决斗社', zone: 'courtyard' },
      { id: 1, text: '赢下 3 场决斗社正式比赛', zone: 'courtyard' },
      { id: 2, text: '向维克多教授领取冠军之证', zone: null },
    ],
    rewards: { xp: 150, gold: 80, items: { key_lion: 1, trophy: 1 } },
  },
  deco_contest: {
    name: '宿舍装饰大赛', type: '支线',
    steps: [{ id: 0, text: '在寝室摆放至少 5 件家具,打造你的小天地', zone: 'dorm' }],
    rewards: { xp: 60, gold: 60 },
  },
  poppy_roots: {
    name: '波比的植物点心', type: '同伴', giver: 'poppy',
    steps: [
      { id: 0, text: '波比需要 2 段扭曲树根来做「植物点心」', zone: 'forest' },
      { id: 1, text: '把树根带给温室的波比', zone: 'greenhouse' },
    ],
    rewards: { xp: 70, aff: { poppy: 15 } },
  },
  vera_book: {
    name: '薇拉的借书单', type: '同伴', giver: 'vera',
    steps: [
      { id: 0, text: '薇拉的《高级魔咒理论》被人借走了……据说在斯莱特林的卡西安手里', zone: 'hall' },
      { id: 1, text: '把书还给图书馆的薇拉', zone: 'library' },
    ],
    rewards: { xp: 70, aff: { vera: 15, cassian: 5 } },
  },
  leo_train: {
    name: '里奥的特训', type: '同伴', giver: 'leo',
    steps: [
      { id: 0, text: '陪里奥练习决斗——赢他一场,让他心服口服', zone: 'courtyard' },
      { id: 1, text: '和里奥谈谈', zone: null },
    ],
    rewards: { xp: 80, aff: { leo: 15 } },
  },
  star_key: {
    name: '鹰之钥·星图', type: '主线支束', giver: 'celeste',
    steps: [{ id: 0, text: '夜晚在天文塔用望远镜连出「钥匙星座」', zone: 'astro' }],
    rewards: { items: { key_eagle: 1 }, xp: 90 },
  },
  moon_key: {
    name: '獾之钥·月光花', type: '主线支束', giver: 'thorne',
    steps: [
      { id: 0, text: '夜晚给温室的月光花圃浇水,让它开花', zone: 'greenhouse' },
      { id: 1, text: '把盛开的月光花带给索恩教授', zone: 'greenhouse' },
    ],
    rewards: { items: { key_badger: 1 }, xp: 90 },
  },
};

// 任务操作
export function questState(qid) { return S.quests[qid]; }
export function questStep(qid) { return S.quests[qid]?.step ?? -1; }
export function questActive(qid) { const q = S.quests[qid]; return q && !q.done; }
export function questDone(qid) { return !!S.quests[qid]?.done; }
export function startQuest(qid) {
  if (S.quests[qid]) return;
  S.quests[qid] = { step: 0, done: false };
  const q = QUESTS[qid];
  emit('toast', { text: `📜 接受任务:${q.name}`, big: true });
  emit('quest');
  if (!S.tracked || S.tracked === 'main') S.tracked = qid === 'main' ? 'main' : S.tracked;
}
export function advanceQuest(qid, toStep = null) {
  const q = S.quests[qid]; if (!q || q.done) return;
  q.step = toStep == null ? q.step + 1 : toStep;
  const def = QUESTS[qid];
  if (q.step >= def.steps.length) return completeQuest(qid);
  emit('toast', { text: `📜 ${def.name}:${def.steps[q.step].text}` });
  emit('quest');
}
export function completeQuest(qid) {
  const q = S.quests[qid]; if (!q || q.done) return;
  q.done = true;
  const def = QUESTS[qid];
  emit('toast', { text: `✅ 任务完成:${def.name}`, big: true });
  const r = def.rewards || {};
  if (r.xp) addXP(r.xp);
  if (r.gold) addGold(r.gold);
  if (r.items) for (const [id, n] of Object.entries(r.items)) { if (id === 'trophy') { S.inv.trophy = 1; } else addItem(id, n); }
  if (r.aff) for (const [npc, n] of Object.entries(r.aff)) addAff(npc, n);
  emit('quest');
}

// ---------------- 对话构建 ----------------
const gossip = {
  vance: [
    '城堡的墙比我们所有人都年长。听,它在呼吸。',
    '分院帽昨晚又在哼歌了,跑调跑得很有个性。',
    '如果你在走廊闻到薄荷味,那是三楼的画像先生们在斗嘴。',
    '年轻人,规矩是护栏,不是牢笼。但深夜别去禁林,这是护栏。',
  ],
  merry: [
    '挥杖的诀窍是手腕!手腕!不是抡胳膊,你又不是在打棒球。',
    '我上学时把眉毛炸没过三次。看,现在不是长得挺好?',
    '悬浮咒学好了,搬家都不用请人。魔法很实用的!',
    '听说地下有旧机关的传言?哎呀,老掉牙的故事了……吧?',
  ],
  grey: [
    '搅拌是与药剂的对话。大部分人只会对它大吼大叫。',
    '别用你袖子碰我的坩埚。那是三十年的老伙计。',
    '愚蠢的问题没有,愚蠢的操作满地都是。',
    '月光花瓣要夜里摘的才有效。白天摘的只配泡茶。',
  ],
  thorne: [
    '哈!今天的跳跳菇特别精神,蹦得比一年级还高!',
    '植物不会说谎。你对它好,它就对你好。比人简单。',
    '曼德拉草换盆记得戴耳罩!去年有个孩子晕了一下午!',
    '月光花啊……那是最害羞的花。只有夜里才肯见人。',
  ],
  victor: [
    '决斗的第一课:活着。第二课:优雅地活着。',
    '我这条胳膊上的疤?挪威脊背龙。它现在想必还记得我。',
    '黄昏来庭院,决斗社永远欢迎有胆量的人。',
    '护盾不是躲避,是宣告:你,打不穿我。',
  ],
  celeste: [
    '嘘……星星们今晚很健谈。',
    '猎户的腰带松了三度,这意味着……我也不知道,但很浪漫。',
    '望远镜起雾时,等它自己醒过来。万物都有自己的节奏。',
    '有一个星座像把钥匙。找到它的人,会打开一些东西。',
  ],
  leo: [
    '总有一天我要进傲罗办公室!先从赢一场决斗开始!',
    '昨晚我又输给卡西安了……但我离他只差一点点!一点点!',
    '大厅的烤鸡是世界上最好吃的东西,不接受反驳。',
    '你听到过地下的声音吗?半夜,像巨大的齿轮……我不是做梦!',
  ],
  vera: [
    '嘘——这排书架的灰尘有两百年了,别惊动它们。',
    '《高级魔咒理论》第三版比第二版多了一章脚注,美妙极了。',
    '禁书区的艾拉其实人很好,只是……声音小了点。',
    '知识不危险,危险的是一知半解。',
  ],
  cassian: [
    '哦,是你。别挡着光。',
    '决斗社第一的位置,我暂时还不打算让出去。',
    '我在调查一些事。跟你无关。……暂时无关。',
    '斯莱特林不是坏人的学院,是不肯输的人的学院。',
  ],
  poppy: [
    '你闻,温室今天是甜的!是月光花要开了!',
    '我给每株植物都起了名字。那盆跳跳菇叫波仔。',
    '如果植物蔫了,先别急着浇水,听听它想说什么。',
    '禁林里的树根越扭,炖出来的点心越香……真的!',
  ],
  isaac: [
    '你知道吗,这座城堡的地基里有黄铜齿轮!创校时期的工艺!',
    '我在做一个自动记笔记的羽毛笔,就差……嗯,全部零件。',
    '地下的机关声,频率大约是 0.3 赫兹。我测过。',
    '如果发现古代机关,拜托,拜托让我看一眼!',
  ],
  thomas: [
    '两百年了……塔顶的风还是老样子。',
    '我生前是守塔人。现在也是,只是不用领薪水了。',
    '我的怀表……停在我离开的那一刻。真想再听一次它走针的声音。',
    '别怕幽灵,孩子。我们只是些不肯散场的老故事。',
  ],
  ella: [
    '(几乎听不见)……你好……',
    '(低语)禁书区的书……会咬不礼貌的手指……',
    '(轻声)我曾写过一首诗……写给月亮……后来忘在了书里……',
    '(低语)深夜……银链会松开……如果月亮愿意……',
  ],
  tikki: [
    '提基什么都卖!提基童叟无欺!',
    '袜子?提基有很多袜子!但提基是自由小精灵,袜子是自己买的!',
    '厨房的南瓜饼是提基烤的,校长吃了三块!',
    '给提基带点荧光菌吧,提基想念妈妈的炖菜了……',
  ],
};

const greetByTier = (id) => {
  const n = NPCS[id];
  const t = affTier(id);
  const g = {
    0: [`你好,${S.name === '' ? '同学' : S.name}。有什么事吗?`, '嗯?找我有事?'],
    1: ['哦,是你呀。', '又见面了。'],
    2: ['嘿!正想找你呢。', '你来啦,今天过得怎么样?'],
    3: ['看到你就安心了。', '我的好朋友来了!'],
    4: ['无论什么时候,你都可以来找我。', '有你在,今天一定是个好日子。'],
  }[t];
  if (id === 'ella') return '(气声)……你来了……';
  if (id === 'thomas') return '哦……是活人的脚步声,真好。';
  if (id === 'tikki') return '客人!提基的贵客!';
  if (id === 'grey' && t < 2) return '有事说事。药剂在等我。';
  if (id === 'cassian' && t < 2) return '哦,是你。有话快说。';
  return g[Math.floor(Math.random() * g.length)];
};

// 送礼选项
function giftChoices(npcId, back) {
  const gifts = Object.entries(S.inv).filter(([id]) => ITEMS[id]?.type === 'gift');
  if (!gifts.length) return [{ t: '(你没有可以送的礼物)', next: back }];
  const likes = NPCS[npcId].likes || [];
  const out = gifts.map(([id, n]) => ({
    t: `送出 ${ITEMS[id].icon} ${ITEMS[id].name} ×1`,
    action: () => {
      removeItem(id, 1);
      const base = ITEMS[id].aff || 5;
      const liked = likes.includes(id);
      addAff(npcId, liked ? Math.round(base * 1.6) : base);
      emit('gifted', { npcId, id, liked });
    },
    next: likes.includes(id) ? npcId + '_giftLove' : npcId + '_giftOk',
  }));
  out.push({ t: '还是算了', next: back });
  return out;
}

// 构建某 NPC 的通用对话(闲聊/送礼/同伴/任务钩子由 gameplay 注入)
export function buildDialogue(npcId, hooks = []) {
  const def = NPCS[npcId];
  const lines = gossip[npcId] || ['……'];
  const line = lines[Math.floor(Math.random() * lines.length)];
  const isComp = def.companion && affTier(npcId) >= 2;
  const mainChoices = [
    ...hooks,
    { t: '聊聊天', next: 'chat' },
    { t: '送份礼物', next: 'gift', cond: () => !def.ghost },
    ...(isComp ? [S.companion === npcId
      ? { t: '「今天先到这里吧。」(解除同伴)', action: () => { S.companion = null; emit('companion'); }, next: 'end' }
      : { t: '「跟我一起走吧!」(邀请同伴)', action: () => { S.companion = npcId; emit('companion'); }, next: 'companionYes' }] : []),
    { t: '再见', next: 'end' },
  ];
  return {
    start: [
      { sp: npcId, t: greetByTier(npcId), choices: mainChoices },
    ],
    chat: [
      { sp: npcId, t: line, emo: def.ghost ? '👻' : ['😊', '🙂', '✨'][Math.floor(Math.random() * 3)],
        action: () => { const k = 'chat_' + npcId + '_' + S.day; if (!flag(k)) { setFlag(k); addAff(npcId, 2); } } },
      { sp: npcId, t: '……还有别的事吗?', choices: mainChoices },
    ],
    gift: [
      { sp: 'me', t: '我有点东西想送你。', choices: giftChoices(npcId, 'start') },
    ],
    [npcId + '_giftLove']: [
      { sp: npcId, t: '这……这是我最喜欢的!你怎么知道的?谢谢你!', emo: '💖', anim: 'cheer', next: 'end' },
    ],
    [npcId + '_giftOk']: [
      { sp: npcId, t: '给我的?谢谢,我很喜欢。', emo: '😊', next: 'end' },
    ],
    companionYes: [
      { sp: npcId, t: npcId === 'leo' ? '好耶!看谁敢惹我们!' : npcId === 'vera' ? '正好,我想去核对一条注释……走吧。' : npcId === 'cassian' ? '哼,算你有眼光。' : '嗯!我跟着你!', emo: '😊', anim: 'cheer', next: 'end' },
    ],
  };
}
