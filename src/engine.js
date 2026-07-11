// engine.js — 渲染器/相机/后期/画质
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

export const E = {
  renderer: null, scene: null, camera: null, composer: null, bloom: null,
  quality: 'high', // low | med | high
  fps: 60, _fpsAcc: 0, _fpsN: 0, _autoTimer: 0,
};

export function initEngine(canvas) {
  const r = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  r.outputColorSpace = THREE.SRGBColorSpace;
  r.toneMapping = THREE.ACESFilmicToneMapping;
  r.toneMappingExposure = 1.08;
  r.shadowMap.enabled = true;
  r.shadowMap.type = THREE.PCFSoftShadowMap;
  E.renderer = r;

  E.scene = new THREE.Scene();
  E.scene.background = new THREE.Color(0x07060a);

  E.camera = new THREE.PerspectiveCamera(55, innerWidth / innerHeight, 0.1, 900);
  E.camera.position.set(0, 3, 8);

  const composer = new EffectComposer(r);
  composer.addPass(new RenderPass(E.scene, E.camera));
  E.bloom = new UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), 0.5, 0.55, 0.9);
  composer.addPass(E.bloom);
  composer.addPass(new OutputPass());
  E.composer = composer;

  applyQuality(localStorage.getItem('hg_quality') || autoDetectQuality());
  addEventListener('resize', onResize);
  onResize();
  return E;
}

function autoDetectQuality() {
  const gl = E.renderer.getContext();
  const dbg = gl.getExtension('WEBGL_debug_renderer_info');
  const gpu = dbg ? gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL) : '';
  if (/Apple|M1|M2|M3|M4|RTX|Radeon Pro/i.test(gpu)) return 'high';
  if (matchMedia('(pointer:coarse)').matches) return 'med';
  return 'high';
}

export function applyQuality(q) {
  E.quality = q;
  const r = E.renderer;
  const pr = q === 'low' ? Math.min(devicePixelRatio, 1) * 0.8 : q === 'med' ? Math.min(devicePixelRatio, 1.5) : Math.min(devicePixelRatio, 2);
  r.setPixelRatio(pr);
  r.shadowMap.enabled = q !== 'low';
  E.bloom.enabled = q !== 'low';
  E.bloom.strength = q === 'high' ? 0.5 : 0.38;
  localStorage.setItem('hg_quality', q);
  onResize();
  // 通知场景端调整(粒子密度等)
  dispatchEvent(new CustomEvent('hg-quality', { detail: q }));
}

function onResize() {
  const w = innerWidth, h = innerHeight;
  E.camera.aspect = w / h;
  E.camera.updateProjectionMatrix();
  E.renderer.setSize(w, h);
  E.composer.setSize(w, h);
}

export function renderFrame(dt) {
  E._fpsAcc += dt; E._fpsN++;
  if (E._fpsAcc >= 1) { E.fps = Math.round(E._fpsN / E._fpsAcc); E._fpsAcc = 0; E._fpsN = 0; }
  E.composer.render();
}

// 材质通用:让 KayKit 模型接受更浓的光影
export function tuneMaterial(mat) {
  if (!mat) return;
  if (mat.map) { mat.map.colorSpace = THREE.SRGBColorSpace; mat.map.anisotropy = 4; }
  mat.metalness = Math.min(mat.metalness ?? 0, 0.15);
  mat.roughness = Math.max(mat.roughness ?? 1, 0.7);
}
