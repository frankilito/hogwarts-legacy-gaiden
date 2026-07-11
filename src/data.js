// data.js — 游戏内容数据(学院/咒语/NPC/物品/课程/配方/家具/试题)
export const HOUSES = {
  gryffindor: { name: '格兰芬多', en: 'GRYFFINDOR', color: 0xa33e31, uiColor: '#c05a4a', banner: 'banner_patternA_red', shield: 'banner_shield_red', trait: '勇气与胆识', ghost: '差点没头的骑士', emoji: '🦁' },
  slytherin: { name: '斯莱特林', en: 'SLYTHERIN', color: 0x2f6b46, uiColor: '#4a9a6a', banner: 'banner_patternA_green', shield: 'banner_shield_green', trait: '野心与谋略', ghost: '血人巴罗', emoji: '🐍' },
  ravenclaw: { name: '拉文克劳', en: 'RAVENCLAW', color: 0x2f4d8e, uiColor: '#5a7ac0', banner: 'banner_patternA_blue', shield: 'banner_shield_blue', trait: '智慧与好奇', ghost: '灰衣女士', emoji: '🦅' },
  hufflepuff: { name: '赫奇帕奇', en: 'HUFFLEPUFF', color: 0xa8842f, uiColor: '#c9a852', banner: 'banner_patternA_yellow', shield: 'banner_shield_yellow', trait: '忠诚与勤恳', ghost: '胖修士', emoji: '🦡' },
};
export const TALENTS = {
  elemental: { name: '元素魔法', desc: '火焰与寒冰对你格外亲近。元素系伤害 +15%', icon: '🔥' },
  guardian: { name: '守护魔法', desc: '你的盾咒坚不可摧。护盾强度 +25%', icon: '🛡' },
  arcane: { name: '奥秘魔法', desc: '漂浮与传送信手拈来。法力上限 +20', icon: '✨' },
  alchemy: { name: '炼金药理', desc: '你调制的药剂总是恰到好处。药剂效果 +30%', icon: '⚗' },
};
export const TRAITS = {
  brave: { name: '勇敢', desc: '战斗受击伤害 -10%,对话中有热血选项', icon: '🦁' },
  witty: { name: '机敏', desc: '闪避距离 +15%,对话中能说出俏皮话', icon: '🃏' },
  gentle: { name: '温和', desc: '好感获取 +20%,能安抚紧张的同学', icon: '🕊' },
  curious: { name: '好奇', desc: '探索获得的经验 +15%,总能注意到细节', icon: '🔍' },
};
export const BODIES = [
  { id: 'Mage', name: '清瘦', tag: 'standard 学袍' },
  { id: 'Rogue', name: '矫健', tag: '轻便剪裁' },
  { id: 'Knight', name: '健壮', tag: '厚实肩线' },
];
export const HAIRS = [
  { id: 'short', name: '短发' }, { id: 'ponytail', name: '马尾' },
  { id: 'twin', name: '双辫' }, { id: 'long', name: '长发' }, { id: 'none', name: '光头' },
];
export const HAIR_COLORS = [0x2a2018, 0x4a3018, 0x8a5a28, 0xb8862f, 0xc0c0c8, 0x8a2f22, 0x30302a, 0xe8d9b0];
export const SKINS = [0xe8c8a0, 0xd8b58e, 0xc09a70, 0x9a7350, 0x7a5238];

// ---------------- 咒语 ----------------
export const SPELLS = {
  bolt:    { name: '魔弹咒', inc: 'Fulgari', icon: '✨', mana: 0,  cd: 0.45, dmg: 12, type: 'basic', color: 0xf0d9a8, desc: '基础魔力飞弹,永不枯竭。' },
  stupefy: { name: '昏迷咒', inc: 'Stupefy', icon: '💫', mana: 12, cd: 4,   dmg: 26, type: 'attack', color: 0xff5a4a, desc: '红光冲击,击晕目标 2 秒。', unlock: '默认' },
  protego: { name: '铁甲咒', inc: 'Protego', icon: '🛡', mana: 8,  cd: 1.2, dmg: 0,  type: 'shield', color: 0x8fd0ff, desc: '按住展开护盾;完美格挡可反弹咒语。', unlock: '默认' },
  incendio:{ name: '火焰咒', inc: 'Incendio', icon: '🔥', mana: 16, cd: 6,  dmg: 34, type: 'attack', color: 0xff8a30, desc: '喷吐烈焰,点燃敌人持续灼烧。', unlock: '魔咒课·第2周' },
  glacius: { name: '冰冻咒', inc: 'Glacius', icon: '❄', mana: 14, cd: 6,   dmg: 20, type: 'attack', color: 0x9adfff, desc: '冻结敌人 3 秒;可冻结水面与机关。', unlock: '魔咒课·第2周' },
  fulmen:  { name: '雷电咒', inc: 'Fulmen', icon: '⚡', mana: 20, cd: 8,   dmg: 30, type: 'attack', color: 0xd8c8ff, desc: '链状电弧在敌人之间跳跃。', unlock: '技能树' },
  leviosa: { name: '漂浮咒', inc: 'Wingardium Leviosa', icon: '🪶', mana: 6, cd: 1, dmg: 0, type: 'utility', color: 0xd0b8ff, desc: '举起石块、器物或敌人,再掷出去。', unlock: '默认' },
  vertere: { name: '变形术', inc: 'Vertere', icon: '🐑', mana: 24, cd: 14, dmg: 0,  type: 'control', color: 0xa8e0a0, desc: '把敌人变成一只无害的木桶,持续 5 秒。', unlock: '技能树' },
  portara: { name: '时空门', inc: 'Portara', icon: '🌀', mana: 18, cd: 10, dmg: 0,  type: 'utility', color: 0x70e0d8, desc: '布置一对魔法门,穿行其间。古代机关的钥匙。', unlock: '主线' },
  duo:     { name: '协力冲击', inc: 'Duo Maxima', icon: '💞', mana: 30, cd: 20, dmg: 90, type: 'combo', color: 0xffb8e8, desc: '与同伴共同吟唱的合击术,威力惊人。', unlock: '同伴好感' },
};
export const SPELL_SLOTS_DEFAULT = ['stupefy', 'protego', 'leviosa', 'bolt'];

// ---------------- 物品 ----------------
export const ITEMS = {
  // 材料
  moonpetal: { name: '月光花瓣', icon: '🌸', type: 'ing', desc: '只在夜里舒展的银白花瓣。', price: 8 },
  gnarl: { name: '扭曲树根', icon: '🌿', type: 'ing', desc: '禁林边缘挖到的多节树根。', price: 5 },
  frogeye: { name: '蛙眼石', icon: '🫧', type: 'ing', desc: '像青蛙眼睛一样的圆石子。', price: 6 },
  stardust: { name: '星尘', icon: '✨', type: 'ing', desc: '天文塔顶收集的闪光尘埃。', price: 12 },
  mushroom: { name: '荧光菌', icon: '🍄', type: 'ing', desc: '地窖里发着幽光的蘑菇。', price: 6 },
  firefly: { name: '禁林萤火', icon: '🧚', type: 'ing', desc: '装在瓶子里仍在发光。', price: 10 },
  // 药剂
  potion_heal: { name: '愈伤药剂', icon: '🧪', type: 'potion', desc: '恢复 60 点生命。', price: 24, effect: { hp: 60 } },
  potion_mana: { name: '魔力药剂', icon: '🫙', type: 'potion', desc: '恢复 50 点法力。', price: 24, effect: { mp: 50 } },
  potion_luck: { name: '小福灵剂', icon: '🍀', type: 'potion', desc: '10 分钟内好感与掉落提升。', price: 60, effect: { luck: 600 } },
  potion_fire: { name: '抗火药剂', icon: '🔥', type: 'potion', desc: '免疫灼烧 5 分钟。', price: 40, effect: { fireproof: 300 } },
  // 礼物
  gift_choco: { name: '蜂蜜公爵巧克力', icon: '🍫', type: 'gift', desc: '谁能拒绝巧克力呢。', price: 15, aff: 6 },
  gift_quill: { name: '孔雀羽毛笔', icon: '🪶', type: 'gift', desc: '书写流畅,颇为体面。', price: 22, aff: 8 },
  gift_book: { name: '《高级魔咒理论》', icon: '📕', type: 'gift', desc: '厚得能当枕头。', price: 30, aff: 10 },
  gift_plant: { name: '盆栽跳跳菇', icon: '🪴', type: 'gift', desc: '会在盆里蹦跶的小蘑菇。', price: 26, aff: 8 },
  gift_snack: { name: '南瓜馅饼', icon: '🥧', type: 'gift', desc: '厨房小精灵的手艺。', price: 12, aff: 5 },
  // 任务物品
  gear_note: { name: '《创校者的齿轮》', icon: '📜', type: 'quest', desc: '记载着地下机关的古书抄页。' },
  key_lion: { name: '狮之钥', icon: '🗝', type: 'quest', desc: '勇气的试炼之证。' },
  key_eagle: { name: '鹰之钥', icon: '🗝', type: 'quest', desc: '智慧的试炼之证。' },
  key_badger: { name: '獾之钥', icon: '🗝', type: 'quest', desc: '耐心的试炼之证。' },
  key_snake: { name: '蛇之钥', icon: '🗝', type: 'quest', desc: '机变的试炼之证。' },
  watch_ghost: { name: '黄铜怀表', icon: '⌚', type: 'quest', desc: '托马斯生前最珍爱的怀表,指针停在他离开的那一刻。' },
  reveal_potion: { name: '显形剂', icon: '⚗', type: 'quest', desc: '能让隐形的东西现出原形。' },
};
// 药剂配方: 材料 -> 成品
export const RECIPES = [
  { id: 'potion_heal', name: '愈伤药剂', ings: ['moonpetal', 'gnarl'], stir: '顺时针 3 圈', heat: '文火' },
  { id: 'potion_mana', name: '魔力药剂', ings: ['stardust', 'mushroom'], stir: '逆时针 2 圈', heat: '旺火' },
  { id: 'potion_luck', name: '小福灵剂', ings: ['firefly', 'moonpetal', 'stardust'], stir: '顺时针 5 圈', heat: '文火' },
  { id: 'potion_fire', name: '抗火药剂', ings: ['frogeye', 'gnarl'], stir: '逆时针 4 圈', heat: '旺火' },
  { id: 'reveal_potion', name: '显形剂', ings: ['mushroom', 'frogeye', 'moonpetal'], stir: '顺时针 7 圈', heat: '文火' },
];

// ---------------- 宿舍家具 ----------------
export const FURNITURE = [
  { id: 'bed_decorated', name: '雕花床', icon: '🛏', price: 0, prop: 'bed_decorated' },
  { id: 'table_small', name: '小圆桌', icon: '🪑', price: 20, prop: 'table_small_decorated_A' },
  { id: 'chair', name: '木椅', icon: '🪑', price: 12, prop: 'chair' },
  { id: 'shelf_large', name: '大书架', icon: '📚', price: 45, prop: 'shelf_large' },
  { id: 'shelf_small', name: '小书架', icon: '📖', price: 25, prop: 'shelf_small' },
  { id: 'trunk', name: '行李箱', icon: '🧳', price: 18, prop: 'trunk_medium_A' },
  { id: 'candle_triple', name: '三头烛台', icon: '🕯', price: 15, prop: 'candle_triple', lit: true },
  { id: 'plant', name: '盆栽', icon: '🪴', price: 22, prop: '@plant' },
  { id: 'rug', name: '学院地毯', icon: '🟥', price: 30, prop: '@rug' },
  { id: 'banner', name: '学院挂旗', icon: '🚩', price: 25, prop: '@housebanner', wall: true },
  { id: 'trophy', name: '决斗奖杯', icon: '🏆', price: 0, prop: 'sword_shield_gold', questReward: true },
  { id: 'barrel', name: '黄油啤酒桶', icon: '🛢', price: 28, prop: 'keg_decorated' },
  { id: 'crate_books', name: '一箱旧书', icon: '📦', price: 16, prop: 'box_small_decorated' },
  { id: 'owl_stand', name: '猫头鹰栖架', icon: '🦉', price: 38, prop: '@owl' },
  { id: 'cauldron_mini', name: '迷你坩埚', icon: '⚗', price: 34, prop: '@cauldron' },
  { id: 'starlamp', name: '星光吊灯', icon: '💫', price: 50, prop: '@starlamp', lit: true },
];

// ---------------- 课程与作息 ----------------
export const PHASES = [
  { id: 'dawn', name: '清晨', icon: '🌅', h: 7 },
  { id: 'morning', name: '上午', icon: '☀️', h: 9 },
  { id: 'noon', name: '午后', icon: '🌤', h: 13 },
  { id: 'dusk', name: '黄昏', icon: '🌇', h: 17 },
  { id: 'night', name: '夜晚', icon: '🌙', h: 20 },
  { id: 'late', name: '深夜', icon: '🌌', h: 23 },
];
export const CLASSES = {
  charms: { name: '魔咒课', teacher: 'merry', zone: 'stair', icon: '✨', desc: '挥杖与吟唱的艺术' },
  potions: { name: '魔药课', teacher: 'grey', zone: 'potions', icon: '⚗', desc: '在坩埚上起舞的精确学科' },
  herbology: { name: '草药课', teacher: 'thorne', zone: 'greenhouse', icon: '🌿', desc: '与会咬人的植物打交道' },
  astronomy: { name: '天文课', teacher: 'celeste', zone: 'astro', icon: '🔭', desc: '星星知道所有答案' },
  defense: { name: '黑魔法防御术', teacher: 'victor', zone: 'hall', icon: '⚔', desc: '实战决斗与防御' },
};
// 每周课表: day%7 -> [上午, 午后]
export const WEEK_SCHEDULE = [
  ['charms', 'potions'],    // 周一
  ['herbology', 'defense'], // 周二
  ['potions', 'charms'],    // 周三
  ['defense', 'herbology'], // 周四
  ['charms', 'potions'],    // 周五
  [null, null],             // 周六 (社团/自由)
  [null, 'astronomy'],      // 周日 (夜晚天文课,放在午后槽显示)
];
export const WEEK_NAMES = ['周一', '周二', '周三', '周四', '周五', '周六', '周日'];
export const EXAM_DAYS = [6, 13, 20]; // 每周末考试(第7/14/21天,从0计)

// ---------------- NPC ----------------
// model: {base, tint(袍色), skin, hair, hairColor, prop}
export const NPCS = {
  // 教师
  vance:  { name: '奥萝拉·凡斯', role: '校长', house: null, icon: '👑',
    model: { base: 'Mage', tint: 0x4a3a5e, skin: 0xe0c0a0, hair: 'long', hairColor: 0xd8d8e0, hand: 'staff' },
    portrait: { robe: '#4a3a5e', skin: '#e0c0a0', hair: '#d8d8e0', style: 'lady', acc: 'crown' },
    likes: ['gift_book', 'gift_quill'],
    sched: { dawn: ['hall', 0, -20], morning: ['stair', -8, 6], noon: ['hall', 0, -20], dusk: ['stair', -8, 6], night: ['hall', 0, -20], late: null },
    intro: '银发如霜的校长,眼里藏着许多故事。' },
  merry:  { name: '菲奥娜·梅里索恩', role: '魔咒课教授', house: 'ravenclaw', icon: '✨',
    model: { base: 'Mage', tint: 0x2f4d8e, skin: 0xe8c8a0, hair: 'ponytail', hairColor: 0x8a5a28, hand: 'wand' },
    portrait: { robe: '#2f4d8e', skin: '#e8c8a0', hair: '#8a5a28', style: 'lady' },
    likes: ['gift_choco', 'gift_quill'],
    sched: { dawn: ['hall', -6, -14], morning: ['stair', 0, -10], noon: ['stair', 0, -10], dusk: ['library', 6, 2], night: ['hall', -6, -14], late: null },
    intro: '年轻活泼的魔咒教授,施法像在跳舞。' },
  grey:   { name: '卡西乌斯·格雷', role: '魔药课教授', house: 'slytherin', icon: '⚗',
    model: { base: 'Rogue_Hooded', tint: 0x24322a, skin: 0xd8b58e, hair: 'none', hairColor: 0x2a2018, hand: 'wand' },
    portrait: { robe: '#24322a', skin: '#d8b58e', hair: null, style: 'wizard', acc: 'hood' },
    likes: ['gift_book'],
    sched: { dawn: ['potions', 0, -6], morning: ['potions', 0, -6], noon: ['potions', 0, -6], dusk: ['potions', 0, -6], night: ['hall', 6, -14], late: null },
    intro: '冷面毒舌的魔药大师,据说只对坩埚温柔。' },
  thorne: { name: '波默莉·索恩', role: '草药课教授', house: 'hufflepuff', icon: '🌿',
    model: { base: 'Barbarian', tint: 0x6b5a2f, skin: 0xc09a70, hair: 'short', hairColor: 0x8a5a28, hand: null },
    portrait: { robe: '#6b5a2f', skin: '#c09a70', hair: '#8a5a28', style: 'lady', acc: 'hat' },
    likes: ['gift_plant', 'gift_snack'],
    sched: { dawn: ['greenhouse', 0, 0], morning: ['greenhouse', 0, 0], noon: ['greenhouse', 0, 0], dusk: ['hall', 2, -14], night: ['hall', 2, -14], late: null },
    intro: '嗓门洪亮的草药学教授,手套上永远沾着土。' },
  victor: { name: '罗兰·维克多', role: '黑魔法防御术教授', house: 'gryffindor', icon: '⚔',
    model: { base: 'Knight', tint: 0x5e2f2f, skin: 0xd8b58e, hair: 'short', hairColor: 0x30302a, hand: 'sword_1handed' },
    portrait: { robe: '#5e2f2f', skin: '#d8b58e', hair: '#30302a', style: 'knight' },
    likes: ['gift_snack'],
    sched: { dawn: ['courtyard', 0, 0], morning: ['hall', 8, -6], noon: ['hall', 8, -6], dusk: ['courtyard', 0, 0], night: ['hall', 8, -14], late: null },
    intro: '退役傲罗,决斗社的指导教授,手臂上有龙留下的疤。' },
  celeste:{ name: '塞莱斯特·星川', role: '天文课教授', house: 'ravenclaw', icon: '🔭',
    model: { base: 'Mage', tint: 0x1c2440, skin: 0xe8c8a0, hair: 'long', hairColor: 0x2a2018, hand: 'staff' },
    portrait: { robe: '#1c2440', skin: '#e8c8a0', hair: '#2a2018', style: 'lady', acc: 'stars' },
    likes: ['stardust', 'gift_quill'],
    sched: { dawn: null, morning: ['astro', 0, 0], noon: ['astro', 0, 0], dusk: ['astro', 0, 0], night: ['astro', 0, 0], late: ['astro', 0, 0] },
    intro: '总是仰着头走路的天文教授,像在梦游。' },
  // 学生同伴
  leo:    { name: '里奥·布莱克伍德', role: '格兰芬多 · 三年级', house: 'gryffindor', icon: '🦁', companion: true,
    model: { base: 'Knight', tint: 0xa33e31, skin: 0xd8b58e, hair: 'short', hairColor: 0x8a2f22, hand: 'wand' },
    portrait: { robe: '#a33e31', skin: '#d8b58e', hair: '#c05a3a', style: 'boy' },
    likes: ['gift_snack', 'gift_choco'],
    sched: { dawn: ['hall', -3, 2], morning: 'class', noon: 'class', dusk: ['courtyard', 4, 2], night: ['hall', -3, 2], late: null },
    intro: '热血冒失的格兰芬多,梦想进傲罗办公室,决斗社常败常战。' },
  vera:   { name: '薇拉·奥利文', role: '拉文克劳 · 三年级', house: 'ravenclaw', icon: '🦅', companion: true,
    model: { base: 'Mage', tint: 0x2f4d8e, skin: 0xe8c8a0, hair: 'twin', hairColor: 0x2a2018, hand: 'spellbook_open' },
    portrait: { robe: '#2f4d8e', skin: '#e8c8a0', hair: '#2a2018', style: 'girl', acc: 'glasses' },
    likes: ['gift_book', 'gift_quill'],
    sched: { dawn: ['library', -4, 4], morning: 'class', noon: 'class', dusk: ['library', -4, 4], night: ['library', -4, 4], late: null },
    intro: '抱着书走路都能撞柱子的拉文克劳,知道图书馆每一层灰尘。' },
  cassian:{ name: '卡西安·罗尔', role: '斯莱特林 · 三年级', house: 'slytherin', icon: '🐍', companion: true,
    model: { base: 'Rogue', tint: 0x2f6b46, skin: 0xe8c8a0, hair: 'short', hairColor: 0xe8d9b0, hand: 'wand' },
    portrait: { robe: '#2f6b46', skin: '#e8c8a0', hair: '#e8d9b0', style: 'boy', acc: 'smirk' },
    likes: ['gift_quill', 'gift_book'],
    sched: { dawn: ['hall', 3, 6], morning: 'class', noon: 'class', dusk: ['dungeonDoor', 0, 0], night: ['hall', 3, 6], late: null },
    intro: '毒舌又骄傲的斯莱特林,决斗社排名第一,似乎在调查什么。' },
  poppy:  { name: '波比·梅多斯', role: '赫奇帕奇 · 二年级', house: 'hufflepuff', icon: '🦡', companion: true,
    model: { base: 'Rogue', tint: 0xa8842f, skin: 0xc09a70, hair: 'ponytail', hairColor: 0x4a3018, hand: null },
    portrait: { robe: '#a8842f', skin: '#c09a70', hair: '#4a3018', style: 'girl', acc: 'freckles' },
    likes: ['gift_plant', 'gift_snack'],
    sched: { dawn: ['greenhouse', 3, 3], morning: 'class', noon: 'class', dusk: ['greenhouse', 3, 3], night: ['hall', 6, 2], late: null },
    intro: '温柔的赫奇帕奇学妹,口袋里总装着给植物的小点心。' },
  isaac:  { name: '伊萨克·芬奇', role: '拉文克劳 · 四年级', house: 'ravenclaw', icon: '⚙',
    model: { base: 'Rogue_Hooded', tint: 0x2f4d8e, skin: 0x9a7350, hair: 'none', hairColor: 0x2a2018, hand: null },
    portrait: { robe: '#2f4d8e', skin: '#9a7350', hair: null, style: 'boy', acc: 'goggles' },
    likes: ['frogeye', 'stardust'],
    sched: { dawn: ['stair', 8, 8], morning: 'class', noon: 'class', dusk: ['stair', 8, 8], night: ['stair', 8, 8], late: null },
    intro: '痴迷古代机关的发明宅,书包里叮当作响。' },
  // 幽灵与小精灵
  thomas: { name: '老托马斯', role: '天文塔的幽灵', house: null, icon: '👻', ghost: true,
    model: { base: 'Knight', tint: 0x9ab8d8, skin: 0x9ab8d8, hair: 'none', hairColor: 0x9ab8d8, hand: null, ghost: true },
    portrait: { robe: '#9ab8d8', skin: '#cfe0f0', hair: null, style: 'wizard', acc: 'ghost' },
    likes: [],
    sched: { dawn: ['astro', 4, 4], morning: ['astro', 4, 4], noon: ['astro', 4, 4], dusk: ['astro', 4, 4], night: ['astro', 4, 4], late: ['astro', 4, 4] },
    intro: '在塔顶徘徊了两百年的守塔人,总在找什么东西。' },
  ella:   { name: '低语的艾拉', role: '图书馆的幽灵', house: null, icon: '👻', ghost: true,
    model: { base: 'Mage', tint: 0xb8d8d0, skin: 0xb8d8d0, hair: 'long', hairColor: 0xd0e8e0, hand: null, ghost: true },
    portrait: { robe: '#b8d8d0', skin: '#e0f0ea', hair: '#d0e8e0', style: 'lady', acc: 'ghost' },
    likes: [],
    sched: { dawn: ['library', 8, -6], morning: ['library', 8, -6], noon: ['library', 8, -6], dusk: ['library', 8, -6], night: ['library', 8, -6], late: ['library', 8, -6] },
    intro: '只肯用气声说话的幽灵,守着禁书区的秘密。' },
  tikki:  { name: '提基', role: '小卖部小精灵', house: null, icon: '🧦', shop: true,
    model: { base: 'Rogue', tint: 0x8a6a4a, skin: 0xc09a70, hair: 'none', hairColor: 0x2a2018, hand: 'mug_full', scale: 0.62 },
    portrait: { robe: '#8a6a4a', skin: '#c09a70', hair: null, style: 'elf' },
    likes: ['gift_snack'],
    sched: { dawn: ['stair', -10, 10], morning: ['stair', -10, 10], noon: ['stair', -10, 10], dusk: ['stair', -10, 10], night: ['stair', -10, 10], late: null },
    intro: '在楼梯间摆小摊的自由小精灵,收学生的零花钱,卖一切。' },
};

// ---------------- 考试题库 ----------------
export const QUIZ = [
  { q: '施展悬浮咒时,正确的手腕动作是?', a: ['一挥一抖', '画三个圆', '用力戳刺', '保持不动'], c: 0, cls: 'charms' },
  { q: '铁甲咒 Protego 最擅长防御哪类攻击?', a: ['咒语冲击', '物理坠物', '毒气', '心灵魔法'], c: 0, cls: 'charms' },
  { q: '昏迷咒的咒语颜色通常是?', a: ['红色', '绿色', '金色', '紫色'], c: 0, cls: 'charms' },
  { q: '变形术最重要的三要素是?', a: ['意志、想象、精确', '力量、速度、勇气', '墨水、羊皮纸、猫头鹰', '大声、更大声、最大声'], c: 0, cls: 'charms' },
  { q: '愈伤药剂的基底材料是?', a: ['月光花瓣', '龙肝', '蛙眼石', '荧光菌'], c: 0, cls: 'potions' },
  { q: '搅拌药剂时若配方写"文火",意味着?', a: ['小而稳的火苗', '完全熄火', '最旺的烈焰', '用手焐热'], c: 0, cls: 'potions' },
  { q: '调错药剂最先应该做什么?', a: ['立即离开坩埚', '尝一口', '加更多材料', '盖上盖子摇匀'], c: 0, cls: 'potions' },
  { q: '显形剂能让什么现出原形?', a: ['隐形的事物', '谎言', '梦境', '明天的天气'], c: 0, cls: 'potions' },
  { q: '给曼德拉草换盆时必须?', a: ['戴好耳罩', '唱摇篮曲', '闭上眼睛', '快速搅拌'], c: 0, cls: 'herbology' },
  { q: '月光花只在什么时候开放?', a: ['夜晚', '正午', '暴雨', '考试周'], c: 0, cls: 'herbology' },
  { q: '跳跳菇受惊时会?', a: ['原地弹跳', '喷出孢子', '大声唱歌', '装成石头'], c: 0, cls: 'herbology' },
  { q: '魔鬼网最怕什么?', a: ['阳光与火', '掌声', '冷水', '甜食'], c: 0, cls: 'herbology' },
  { q: '北方天空最亮的导航星被占星家称作?', a: ['北极星', '流浪者', '狮子心', '守夜人'], c: 0, cls: 'astronomy' },
  { q: '观测流星雨的最佳时段是?', a: ['后半夜', '黄昏', '午后', '早餐时'], c: 0, cls: 'astronomy' },
  { q: '天文望远镜起雾时应该?', a: ['等待其自然散去', '用袖子擦', '哈气加热', '倒过来敲'], c: 0, cls: 'astronomy' },
  { q: '决斗礼仪的第一步是?', a: ['互相行礼', '转身就跑', '大声嘲讽', '先发制人'], c: 0, cls: 'defense' },
  { q: '面对咒语连射,最稳妥的应对是?', a: ['侧向翻滚闪避', '站定硬抗', '闭眼祈祷', '原地起跳'], c: 0, cls: 'defense' },
  { q: '完美格挡的时机是?', a: ['咒语命中前一瞬', '施法者吟唱时', '命中之后', '随时都行'], c: 0, cls: 'defense' },
  { q: '被缴械后应当?', a: ['保持距离寻找魔杖', '徒手搏斗', '大声求饶', '假装昏倒'], c: 0, cls: 'defense' },
  { q: '古代守卫魔像的动力核心通常镶嵌在?', a: ['胸口', '脚底', '帽子里', '影子里'], c: 0, cls: 'defense' },
  { q: '在禁林中迷路,最不应该做的是?', a: ['乱跑并大喊', '原地做标记', '朝城堡灯光走', '召唤萤火'], c: 0, cls: 'herbology' },
  { q: '雷电咒的电弧会优先跳向?', a: ['最近的敌人', '最高的树', '金属餐具', '施法者自己'], c: 0, cls: 'charms' },
  { q: '幽灵最忌讳别人提起?', a: ['他们的死因', '天气', '甜点', '课程表'], c: 0, cls: 'astronomy' },
  { q: '时空门两端的距离上限取决于?', a: ['施法者的专注', '门的颜色', '风速', '月相'], c: 0, cls: 'charms' },
];

// 加载屏提示
export const TIPS = [
  '分院帽的建议值得一听——但选择永远是你自己的。',
  '按住 Shift 可以慢步潜行,深夜的管理员听觉敏锐。',
  '完美格挡(在咒语命中前一瞬举盾)可以把咒语弹回去。',
  '给同学送礼物前,先打听他们喜欢什么。',
  '月光花只在夜晚的温室开放。',
  '决斗社每到黄昏在庭院集合,冠军能得到奖杯。',
  '图书馆禁书区在夜里会有幽光——最好带上显形剂。',
  '漂浮咒不仅能搬石头,还能把骷髅兵举到半空。',
  '考试前记得复习:课堂表现和笔试都计入学分。',
  '天文塔顶的星星,连起来是一把钥匙的形状。',
  '宿舍可以布置家具,朋友能通过联机来参观。',
  '和同伴好感足够高后,战斗中可以发动双人合击。',
];
