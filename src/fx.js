// fx.js — 氛围与魔法特效
import * as THREE from 'three';
import { A, T, makePortrait } from './assets.js';
import { E } from './engine.js';
import { S } from './state.js';

export const FX = { time: 0, bursts: [], portraits: [], quality: 'high' };
addEventListener('hg-quality', (e) => { FX.quality = e.detail; });

const QMUL = () => FX.quality === 'low' ? 0.4 : FX.quality === 'med' ? 0.7 : 1;

// ============ 火焰点集(蜡烛/火把 GPU 闪烁) ============
export function flamePoints(zone, positions, { size = 0.5, color = 0xffc86a } = {}) {
  const n = positions.length;
  const geo = new THREE.BufferGeometry();
  const pos = new Float32Array(n * 3), seed = new Float32Array(n);
  positions.forEach((p, i) => { pos.set([p.x, p.y, p.z], i * 3); seed[i] = Math.random() * 100; });
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('seed', new THREE.BufferAttribute(seed, 1));
  const mat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    uniforms: { uTime: { value: 0 }, uMap: { value: T.flame() }, uSize: { value: size * 130 }, uColor: { value: new THREE.Color(color) } },
    vertexShader: `attribute float seed; uniform float uTime; uniform float uSize; varying float vF;
      void main(){
        float f = 0.82 + 0.18*sin(uTime*9.0+seed) * sin(uTime*5.3+seed*2.1);
        vF = f;
        vec4 mv = modelViewMatrix * vec4(position + vec3(0.0, sin(uTime*3.0+seed)*0.01, 0.0),1.0);
        gl_PointSize = uSize * f / -mv.z;
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: `uniform sampler2D uMap; uniform vec3 uColor; varying float vF;
      void main(){
        vec4 t = texture2D(uMap, gl_PointCoord);
        gl_FragColor = vec4(uColor * t.rgb * (1.4*vF), t.a);
      }`,
  });
  const pts = new THREE.Points(geo, mat);
  pts.frustumCulled = false;
  zone.group.add(pts);
  zone.onUpdate(() => { mat.uniforms.uTime.value = FX.time; });
  return pts;
}

// 蜡烛簇:模型+火苗+稀疏点光
export function candles(zone, list, { model = 'candle_lit', light = true, lightEvery = 6, intensity = 8, dist = 9 } = {}) {
  const flames = [];
  const pl = [];
  list.forEach((p, i) => {
    if (model) pl.push({ n: p.tall ? 'candle_thin_lit' : model, x: p.x, y: p.y || 0, z: p.z, ry: Math.random() * 6.28 });
    flames.push({ x: p.x, y: (p.y || 0) + (p.tall ? 1.5 : 0.78) * (p.s || 1), z: p.z });
    if (light && i % lightEvery === 0) {
      const L = new THREE.PointLight(0xffb45e, intensity, dist, 2);
      L.position.set(p.x, (p.y || 0) + 1.4, p.z);
      zone.group.add(L);
    }
  });
  if (model) import('./castle.js').then(({ instBatch }) => instBatch(zone, pl));
  flamePoints(zone, flames, { size: 0.42 });
}

// 悬浮蜡烛(大厅) — 缓慢升降
export function floatingCandles(zone, n, { x0, x1, z0, z1, y0 = 6, y1 = 10 }) {
  n = Math.round(n * QMUL());
  const src = A.dungeon['candle_thin_lit'];
  if (!src) return;
  src.updateMatrixWorld(true);
  const parts = [];
  src.traverse((o) => { if (o.isMesh) parts.push({ geo: o.geometry, mat: o.material, mtx: o.matrixWorld.clone() }); });
  if (!parts.length) return;
  const data = [], flames = [];
  for (let i = 0; i < n; i++) {
    const d = { x: x0 + Math.random() * (x1 - x0), z: z0 + Math.random() * (z1 - z0), y: y0 + Math.random() * (y1 - y0), ph: Math.random() * 9, sp: 0.4 + Math.random() * 0.5 };
    data.push(d);
    flames.push({ x: d.x, y: d.y + 1.05, z: d.z });
  }
  const ims = parts.map((part) => {
    const im = new THREE.InstancedMesh(part.geo, part.mat, n);
    im.frustumCulled = false;
    zone.group.add(im);
    return im;
  });
  const T = new THREE.Matrix4(), M = new THREE.Matrix4();
  const fp = flamePoints(zone, flames, { size: 0.5 });
  const fpos = fp.geometry.attributes.position;
  const refresh = () => {
    for (let i = 0; i < n; i++) {
      const d = data[i];
      const y = d.y + Math.sin(FX.time * d.sp + d.ph) * 0.35;
      T.makeRotationY(Math.sin(FX.time * 0.3 + d.ph) * 0.1);
      T.setPosition(d.x, y, d.z);
      parts.forEach((part, j) => {
        M.copy(T).multiply(part.mtx);
        ims[j].setMatrixAt(i, M);
      });
      fpos.setY(i, y + 1.05);
    }
    for (const im of ims) im.instanceMatrix.needsUpdate = true;
    fpos.needsUpdate = true;
  };
  refresh();
  zone.onUpdate(refresh);
}

// ============ 体积光柱 ============
export function lightShaft(zone, x, y, z, { h = 9, r = 2.6, color = 0x9ab8e8, tilt = 0.35, dir = 0, opacity = 0.16 } = {}) {
  const geo = new THREE.ConeGeometry(r, h, 12, 1, true);
  const mat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    uniforms: { uTime: { value: 0 }, uColor: { value: new THREE.Color(color) }, uOp: { value: opacity }, uNoise: { value: T.smoke() } },
    vertexShader: `varying vec2 vUv; varying float vY; void main(){ vUv=uv; vY=uv.y; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
    fragmentShader: `uniform float uTime; uniform vec3 uColor; uniform float uOp; uniform sampler2D uNoise; varying vec2 vUv; varying float vY;
      void main(){
        float n = texture2D(uNoise, vec2(vUv.x*2.0+uTime*0.02, vUv.y*1.5-uTime*0.03)).r;
        float a = smoothstep(0.0,0.35,vY) * (0.35+0.65*n) * uOp;
        gl_FragColor = vec4(uColor, a);
      }`,
  });
  const cone = new THREE.Mesh(geo, mat);
  cone.position.set(x, y + h / 2, z);
  cone.rotation.z = tilt; cone.rotation.y = dir;
  zone.group.add(cone);
  zone.onUpdate(() => { mat.uniforms.uTime.value = FX.time; });
  if (!zone._shaftMats) zone._shaftMats = [];
  zone._shaftMats.push(mat);
  return cone;
}

// ============ 尘埃/萤火粒子 ============
export function motes(zone, { x0, x1, y0, y1, z0, z1, n = 60, color = 0xd8c8a0, size = 22, speed = 0.05, tex = null }) {
  n = Math.round(n * QMUL());
  const geo = new THREE.BufferGeometry();
  const pos = new Float32Array(n * 3), seed = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    pos.set([x0 + Math.random() * (x1 - x0), y0 + Math.random() * (y1 - y0), z0 + Math.random() * (z1 - z0)], i * 3);
    seed[i] = Math.random() * 100;
  }
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('seed', new THREE.BufferAttribute(seed, 1));
  const mat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    uniforms: { uTime: { value: 0 }, uMap: { value: tex || T.dot() }, uColor: { value: new THREE.Color(color) }, uSize: { value: size }, uSpeed: { value: speed } },
    vertexShader: `attribute float seed; uniform float uTime; uniform float uSize; uniform float uSpeed; varying float vA;
      void main(){
        vec3 p = position;
        p.x += sin(uTime*uSpeed*7.0+seed)*0.5;
        p.y += sin(uTime*uSpeed*5.0+seed*1.7)*0.6;
        p.z += cos(uTime*uSpeed*6.0+seed*0.9)*0.5;
        vA = 0.35+0.65*abs(sin(uTime*0.7+seed*3.0));
        vec4 mv = modelViewMatrix*vec4(p,1.0);
        gl_PointSize = uSize*vA/ -mv.z;
        gl_Position = projectionMatrix*mv;
      }`,
    fragmentShader: `uniform sampler2D uMap; uniform vec3 uColor; varying float vA;
      void main(){ vec4 t=texture2D(uMap,gl_PointCoord); gl_FragColor=vec4(uColor*t.rgb, t.a*vA*0.7); }`,
  });
  const pts = new THREE.Points(geo, mat);
  pts.frustumCulled = false;
  zone.group.add(pts);
  zone.onUpdate(() => { mat.uniforms.uTime.value = FX.time; });
  return pts;
}

// ============ 壁炉 ============
export function fireplace(zone, x, y, z, { w = 1.6, color = 0xff9a40 } = {}) {
  const grp = new THREE.Group(); grp.position.set(x, y, z);
  const mat = new THREE.SpriteMaterial({ map: T.flame(), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, color: 0xffc080 });
  const sprites = [];
  for (let i = 0; i < 4; i++) {
    const sp = new THREE.Sprite(mat.clone());
    sp.position.set((Math.random() - 0.5) * w * 0.5, 0.25 + Math.random() * 0.15, (Math.random() - 0.5) * 0.2);
    sp.scale.setScalar(0.7 + Math.random() * 0.5);
    grp.add(sp); sprites.push(sp);
  }
  const L = new THREE.PointLight(color, 26, 13, 2); L.position.y = 0.8; grp.add(L);
  zone.group.add(grp);
  motes(zone, { x0: x - w / 2, x1: x + w / 2, y0: y + 0.3, y1: y + 1.8, z0: z - 0.2, z1: z + 0.2, n: 10, color: 0xffa050, size: 10, speed: 0.4 });
  zone.onUpdate(() => {
    sprites.forEach((sp, i) => {
      const f = 0.75 + 0.3 * Math.sin(FX.time * 11 + i * 2.4) * Math.sin(FX.time * 7 + i);
      sp.scale.set(0.8 * f, 1.1 * f, 1);
    });
    L.intensity = 22 + Math.sin(FX.time * 9.5) * 4 + Math.sin(FX.time * 23) * 2;
  });
  return grp;
}

// ============ 会动的画像 ============
export function portrait(zone, x, y, z, ry, idx, { w = 1.35, talk = null } = {}) {
  const grp = new THREE.Group();
  grp.position.set(x, y, z); grp.rotation.y = ry;
  const h = w * 1.25;
  // 画框
  const frameMat = new THREE.MeshStandardMaterial({ color: 0x8a6a2f, roughness: 0.5, metalness: 0.5 });
  const fr = new THREE.Mesh(new THREE.BoxGeometry(w + 0.18, h + 0.18, 0.08), frameMat);
  const inner = new THREE.Mesh(new THREE.BoxGeometry(w + 0.06, h + 0.06, 0.1), new THREE.MeshStandardMaterial({ color: 0x3a2c14 }));
  grp.add(fr, inner);
  const p = makePortrait(idx);
  const canvasMesh = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshStandardMaterial({ map: p.tex, roughness: 0.9 }));
  canvasMesh.position.z = 0.07;
  grp.add(canvasMesh);
  zone.group.add(grp);
  const st = { grp, p, idx, blinkT: Math.random() * 4 + 2, blink: false, talking: false, zone, name: p.name, lookX: 0, lookY: 0 };
  FX.portraits.push(st);
  return st;
}
export function updatePortraits(dt, playerPos, zoneId) {
  for (const st of FX.portraits) {
    if (st.zone.id !== zoneId) continue;
    const wp = new THREE.Vector3(); st.grp.getWorldPosition(wp);
    const d = wp.distanceTo(playerPos);
    if (d > 16) continue;
    // 目光追随
    const local = st.grp.worldToLocal(playerPos.clone());
    st.lookX = THREE.MathUtils.clamp(local.x / 4, -1, 1);
    st.lookY = THREE.MathUtils.clamp(-local.y / 6, -0.6, 1);
    st.blinkT -= dt;
    if (st.blinkT <= 0) { st.blink = !st.blink; st.blinkT = st.blink ? 0.12 : 2 + Math.random() * 4; }
    if ((st._redrawT = (st._redrawT || 0) - dt) <= 0) {
      st.p.draw(FX.time, st.lookX, st.lookY, st.talking, st.blink);
      st._redrawT = 0.12;
    }
  }
}

// ============ 漂浮书本 ============
export function floatingBooks(zone, { x0, x1, y0, y1, z0, z1, n = 14 }) {
  n = Math.round(n * QMUL());
  const src = A.props['spellbook_closed'] || A.props['spellbook_open'];
  if (!src) return;
  src.updateMatrixWorld(true);
  let part = null;
  src.traverse((o) => { if (o.isMesh && !part) part = { geo: o.geometry, mat: o.material, mtx: o.matrixWorld.clone() }; });
  if (!part) return;
  const im = new THREE.InstancedMesh(part.geo, part.mat, n);
  im.frustumCulled = false;
  const data = [];
  for (let i = 0; i < n; i++) data.push({
    x: x0 + Math.random() * (x1 - x0), y: y0 + Math.random() * (y1 - y0), z: z0 + Math.random() * (z1 - z0),
    ph: Math.random() * 9, ry: Math.random() * 6.28, sp: 0.3 + Math.random() * 0.6, s: 2.2 + Math.random() * 1.4,
  });
  zone.group.add(im);
  const M = new THREE.Matrix4(), T = new THREE.Matrix4(), Q = new THREE.Quaternion(), V = new THREE.Vector3(), SC = new THREE.Vector3();
  zone.onUpdate(() => {
    data.forEach((d, i) => {
      V.set(d.x + Math.sin(FX.time * 0.4 + d.ph) * 0.6, d.y + Math.sin(FX.time * d.sp + d.ph) * 0.4, d.z + Math.cos(FX.time * 0.33 + d.ph) * 0.6);
      Q.setFromEuler(new THREE.Euler(Math.sin(FX.time * 0.7 + d.ph) * 0.25, d.ry + FX.time * 0.15, Math.sin(FX.time * 0.5 + d.ph) * 0.2));
      SC.setScalar(d.s);
      T.compose(V, Q, SC);
      M.copy(T).multiply(part.mtx);
      im.setMatrixAt(i, M);
    });
    im.instanceMatrix.needsUpdate = true;
  });
}

// ============ 魔法天花板(大厅) ============
export function enchantedCeiling(zone, x, y, z, w, d) {
  const mat = new THREE.ShaderMaterial({
    side: THREE.DoubleSide, depthWrite: false, transparent: true,
    uniforms: { uTime: { value: 0 }, uPhase: { value: 0 }, uNoise: { value: T.smoke() }, uRain: { value: 0 } },
    vertexShader: `varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
    fragmentShader: `
      uniform float uTime; uniform float uPhase; uniform float uRain; uniform sampler2D uNoise; varying vec2 vUv;
      float hash(vec2 p){ return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453); }
      void main(){
        // uPhase: 0 白天 0.5 黄昏 1 夜晚
        vec3 day = mix(vec3(0.35,0.52,0.78), vec3(0.65,0.42,0.3), smoothstep(0.25,0.5,uPhase));
        vec3 night = vec3(0.03,0.045,0.10);
        vec3 col = mix(day, night, smoothstep(0.5,0.8,uPhase));
        // 流动云
        float n1 = texture2D(uNoise, vUv*2.0 + vec2(uTime*0.008, 0.0)).r;
        float n2 = texture2D(uNoise, vUv*3.5 - vec2(uTime*0.012, uTime*0.004)).r;
        float cloud = smoothstep(0.35, 0.85, n1*0.6+n2*0.55);
        vec3 cloudCol = mix(vec3(0.9,0.85,0.8), vec3(0.12,0.13,0.2), smoothstep(0.5,0.8,uPhase));
        cloudCol = mix(cloudCol, vec3(0.05,0.05,0.09), uRain*0.8);
        col = mix(col, cloudCol, cloud*(0.5+uRain*0.4));
        // 星星(夜)
        vec2 g = floor(vUv*160.0);
        float st = step(0.994, hash(g)) * (0.5+0.5*sin(uTime*2.0+hash(g.yx)*20.0));
        col += vec3(1.0,0.95,0.8)*st*smoothstep(0.55,0.85,uPhase)*(1.0-cloud)*(1.0-uRain);
        gl_FragColor = vec4(col, 0.96);
      }`,
  });
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, d), mat);
  m.rotation.x = Math.PI / 2;
  m.position.set(x, y, z);
  zone.group.add(m);
  zone._ceilingMat = mat;
  zone.onUpdate(() => {
    mat.uniforms.uTime.value = FX.time;
    mat.uniforms.uPhase.value = phase01();
    mat.uniforms.uRain.value = S.weather === 'rain' ? 1 : 0;
  });
}

export function phase01() {
  // 0 清晨→白天, 0.5 黄昏, 0.75+ 夜
  return [0.15, 0.05, 0.2, 0.5, 0.8, 0.95][S.phase] ?? 0.2;
}

// ============ 彩绘玻璃窗 ============
export function stainedWindow(zone, x, y, z, ry, { w = 2.6, h = 4.6, seed = 1 } = {}) {
  const grp = new THREE.Group();
  grp.position.set(x, y, z); grp.rotation.y = ry;
  const mat = new THREE.MeshStandardMaterial({ map: T.stained(seed), emissive: 0xffffff, emissiveMap: T.stained(seed), emissiveIntensity: 0.65, roughness: 0.4, metalness: 0.1 });
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat);
  grp.add(m);
  // 雨痕层
  const rainMat = new THREE.MeshBasicMaterial({ map: T.rainStreak(), transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false });
  rainMat.map = T.rainStreak().clone(); rainMat.map.wrapS = rainMat.map.wrapT = THREE.RepeatWrapping; rainMat.map.repeat.set(6, 2);
  const rain = new THREE.Mesh(new THREE.PlaneGeometry(w, h), rainMat);
  rain.position.z = 0.02;
  grp.add(rain);
  zone.group.add(grp);
  if (!zone._windowMats) zone._windowMats = [];
  zone._windowMats.push({ mat, rainMat });
  zone.onUpdate(() => {
    const p = phase01();
    const glow = p > 0.6 ? 0.3 : p > 0.4 ? 0.8 : 1.0; // 白天亮
    mat.emissiveIntensity = glow * (S.weather === 'rain' ? 0.45 : 0.75);
    if (S.weather === 'rain') { rainMat.opacity = 0.35; rainMat.map.offset.y = -FX.time * 0.7; }
    else rainMat.opacity = 0;
  });
  return grp;
}

// ============ 旋转楼梯(程序化) ============
export function spiralStair(zone, x, z, { r = 3.4, h = 8, steps = 26, turns = 1.05, dir = 1, mat = null } = {}) {
  const grp = new THREE.Group(); grp.position.set(x, 0, z);
  const stepGeo = new THREE.BoxGeometry(r * 0.72, 0.22, 1.05);
  const stepMat = mat || new THREE.MeshStandardMaterial({ map: T.flagstone(), roughness: 0.9 });
  const im = new THREE.InstancedMesh(stepGeo, stepMat, steps);
  const M = new THREE.Matrix4(), Q = new THREE.Quaternion(), V = new THREE.Vector3(), SC = new THREE.Vector3(1, 1, 1);
  for (let i = 0; i < steps; i++) {
    const t = i / (steps - 1);
    const a = t * Math.PI * 2 * turns * dir;
    V.set(Math.cos(a) * r * 0.62, t * h, Math.sin(a) * r * 0.62);
    Q.setFromEuler(new THREE.Euler(0, -a + (dir > 0 ? Math.PI / 2 : -Math.PI / 2), 0));
    M.compose(V, Q, SC);
    im.setMatrixAt(i, M);
  }
  im.castShadow = im.receiveShadow = true;
  grp.add(im);
  // 中柱
  const col = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.6, h + 2, 10), stepMat);
  col.position.y = h / 2;
  col.castShadow = true;
  grp.add(col);
  zone.group.add(grp);
  // 螺旋坡道碰撞:分 8 段线性 ramp
  const segs = 10;
  for (let sIdx = 0; sIdx < segs; sIdx++) {
    const t0 = sIdx / segs, t1 = (sIdx + 1) / segs;
    const a0 = t0 * Math.PI * 2 * turns * dir, a1 = t1 * Math.PI * 2 * turns * dir;
    zone.addRamp(x + Math.cos(a0) * r * 0.62, z + Math.sin(a0) * r * 0.62, x + Math.cos(a1) * r * 0.62, z + Math.sin(a1) * r * 0.62, t0 * h, t1 * h);
  }
  return grp;
}

// ============ 室外天穹 ============
export function skyDome(zone, radius = 120, { minPhase = 0 } = {}) {
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: { uTime: { value: 0 }, uPhase: { value: 0 }, uRain: { value: 0 } },
    vertexShader: `varying vec3 vPos; void main(){ vPos=position; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
    fragmentShader: `
      uniform float uTime; uniform float uPhase; uniform float uRain; varying vec3 vPos;
      float hash(vec2 p){ return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453); }
      void main(){
        float hgt = normalize(vPos).y*0.5+0.5;
        vec3 dayTop=vec3(0.25,0.45,0.75), dayBot=vec3(0.75,0.8,0.85);
        vec3 duskTop=vec3(0.2,0.16,0.38), duskBot=vec3(0.95,0.55,0.3);
        vec3 nightTop=vec3(0.012,0.02,0.05), nightBot=vec3(0.05,0.07,0.14);
        vec3 top = mix(dayTop, duskTop, smoothstep(0.25,0.55,uPhase));
        top = mix(top, nightTop, smoothstep(0.55,0.8,uPhase));
        vec3 bot = mix(dayBot, duskBot, smoothstep(0.25,0.55,uPhase));
        bot = mix(bot, nightBot, smoothstep(0.55,0.8,uPhase));
        vec3 col = mix(bot, top, pow(hgt,0.8));
        col = mix(col, col*vec3(0.5,0.55,0.62), uRain*0.7);
        // 星
        vec3 nd = normalize(vPos);
        vec2 sp = nd.xz/(nd.y+1.2);
        vec2 g = floor(sp*90.0);
        float st = step(0.992, hash(g));
        float tw = 0.5+0.5*sin(uTime*1.5+hash(g.yx)*30.0);
        col += vec3(1.0,0.95,0.85)*st*tw*smoothstep(0.6,0.85,uPhase)*step(0.05,hgt)*(1.0-uRain);
        gl_FragColor = vec4(col,1.0);
      }`,
  });
  const m = new THREE.Mesh(new THREE.SphereGeometry(radius, 24, 16), mat);
  zone.group.add(m);
  zone._skyMat = mat;
  zone.onUpdate(() => {
    mat.uniforms.uTime.value = FX.time;
    mat.uniforms.uPhase.value = Math.max(minPhase, phase01());
    mat.uniforms.uRain.value = S.weather === 'rain' ? 1 : 0;
  });
  return m;
}

// ============ 室外雨 ============
export function rainFall(zone, { x0, x1, z0, z1, y = 14, n = 400 }) {
  n = Math.round(n * QMUL());
  const geo = new THREE.BufferGeometry();
  const pos = new Float32Array(n * 3), seed = new Float32Array(n);
  for (let i = 0; i < n; i++) { pos.set([x0 + Math.random() * (x1 - x0), Math.random() * y, z0 + Math.random() * (z1 - z0)], i * 3); seed[i] = Math.random(); }
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('seed', new THREE.BufferAttribute(seed, 1));
  const mat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false,
    uniforms: { uTime: { value: 0 }, uY: { value: y }, uOn: { value: 0 } },
    vertexShader: `attribute float seed; uniform float uTime; uniform float uY; uniform float uOn; varying float vA;
      void main(){
        vec3 p = position;
        p.y = mod(position.y - uTime*(9.0+seed*5.0), uY);
        vA = uOn*(0.25+0.3*seed);
        vec4 mv = modelViewMatrix*vec4(p,1.0);
        gl_PointSize = (34.0+seed*20.0)/ -mv.z;
        gl_Position = projectionMatrix*mv;
      }`,
    fragmentShader: `varying float vA;
      void main(){
        vec2 c = gl_PointCoord-0.5;
        float a = (1.0-smoothstep(0.02,0.06,abs(c.x))) * (1.0-smoothstep(0.3,0.5,abs(c.y)));
        gl_FragColor = vec4(0.65,0.75,0.95, a*vA);
      }`,
  });
  const pts = new THREE.Points(geo, mat);
  pts.frustumCulled = false;
  zone.group.add(pts);
  zone.onUpdate(() => {
    mat.uniforms.uTime.value = FX.time;
    mat.uniforms.uOn.value += ((S.weather === 'rain' ? 1 : 0) - mat.uniforms.uOn.value) * 0.02;
  });
}

// ============ 通用爆发粒子(战斗特效) ============
const MAXB = 900;
let burstPts = null, burstData = null, burstGeo = null;
export function initBursts() {
  burstGeo = new THREE.BufferGeometry();
  const pos = new Float32Array(MAXB * 3), col = new Float32Array(MAXB * 3), sz = new Float32Array(MAXB);
  burstGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  burstGeo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  burstGeo.setAttribute('psize', new THREE.BufferAttribute(sz, 1));
  const mat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, vertexColors: true,
    uniforms: { uMap: { value: T.star() } },
    vertexShader: `attribute float psize; varying vec3 vC;
      void main(){ vC = color; vec4 mv=modelViewMatrix*vec4(position,1.0); gl_PointSize = psize/ -mv.z; gl_Position=projectionMatrix*mv; }`,
    fragmentShader: `uniform sampler2D uMap; varying vec3 vC;
      void main(){ vec4 t=texture2D(uMap,gl_PointCoord); gl_FragColor=vec4(vC*t.rgb, t.a); }`,
  });
  burstPts = new THREE.Points(burstGeo, mat);
  burstPts.frustumCulled = false;
  burstPts.renderOrder = 5;
  E.scene.add(burstPts);
  burstData = [];
  for (let i = 0; i < MAXB; i++) burstData.push({ life: 0 });
}
let _bi = 0;
export function spark(p, { color = 0xffd080, n = 12, speed = 3, size = 90, life = 0.5, up = 0, spread = 1 } = {}) {
  const c = new THREE.Color(color);
  for (let k = 0; k < n; k++) {
    const d = burstData[_bi]; _bi = (_bi + 1) % MAXB;
    d.life = life * (0.6 + Math.random() * 0.6);
    d.maxLife = d.life;
    d.x = p.x; d.y = p.y; d.z = p.z;
    const a = Math.random() * Math.PI * 2, b = (Math.random() - 0.5) * Math.PI * spread;
    const sp = speed * (0.4 + Math.random() * 0.8);
    d.vx = Math.cos(a) * Math.cos(b) * sp; d.vy = Math.sin(b) * sp + up; d.vz = Math.sin(a) * Math.cos(b) * sp;
    d.r = c.r; d.g = c.g; d.b = c.b; d.size = size * (0.5 + Math.random());
  }
}
export function updateBursts(dt) {
  if (!burstGeo) return;
  const pos = burstGeo.attributes.position, col = burstGeo.attributes.color, sz = burstGeo.attributes.psize;
  for (let i = 0; i < MAXB; i++) {
    const d = burstData[i];
    if (d.life > 0) {
      d.life -= dt;
      d.x += d.vx * dt; d.y += d.vy * dt; d.z += d.vz * dt;
      d.vy -= 2.2 * dt;
      const f = Math.max(0, d.life / d.maxLife);
      pos.setXYZ(i, d.x, d.y, d.z);
      col.setXYZ(i, d.r * f * 1.5, d.g * f * 1.5, d.b * f * 1.5);
      sz.setX(i, d.size * f);
    } else { sz.setX(i, 0); }
  }
  pos.needsUpdate = true; col.needsUpdate = true; sz.needsUpdate = true;
}

// 施法魔法阵
export function castCircle(parent, { color = 0xc9a86a, r = 0.9 } = {}) {
  const mat = new THREE.MeshBasicMaterial({ map: T.runeCircle(), transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false, color });
  const m = new THREE.Mesh(new THREE.PlaneGeometry(r * 2, r * 2), mat);
  m.rotation.x = -Math.PI / 2;
  m.position.y = 0.06;
  parent.add(m);
  let t = 0;
  const tick = (dt) => {
    t += dt;
    m.rotation.z = t * 2.2;
    mat.opacity = Math.max(0, 0.95 - t * 1.4);
    m.scale.setScalar(1 + t * 0.8);
    if (t > 0.8) { parent.remove(m); mat.dispose(); return false; }
    return true;
  };
  FX.bursts.push(tick);
}
export function updateFxTicks(dt) {
  for (let i = FX.bursts.length - 1; i >= 0; i--) if (!FX.bursts[i](dt)) FX.bursts.splice(i, 1);
}

// 护盾泡
export function shieldBubble(color = 0x8fd0ff) {
  const mat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.22, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
  const m = new THREE.Mesh(new THREE.SphereGeometry(1.15, 18, 12), mat);
  m.scale.y = 1.25;
  return m;
}
