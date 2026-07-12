// sw.js — 魔法缓存:资源缓存优先(断网/弱网也能进城堡),代码网络优先保持更新
const VER = 'hg-cache-v1';
const ASSET_RE = /\.(glb|gltf|bin|png|jpg|webp|ttf|woff2?)$/i;

self.addEventListener('install', (e) => self.skipWaiting());
self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((k) => k !== VER).map((k) => caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return;

  const isAsset = url.pathname.includes('/assets/') || url.pathname.includes('/libs/') || ASSET_RE.test(url.pathname);
  if (isAsset) {
    // 缓存优先:大文件一旦到手永不再下
    e.respondWith((async () => {
      const cache = await caches.open(VER);
      const hit = await cache.match(req);
      if (hit) return hit;
      const resp = await fetch(req);
      if (resp && resp.ok) cache.put(req, resp.clone());
      return resp;
    })());
  } else {
    // 网络优先(html/js 保持最新),失败回退缓存
    e.respondWith((async () => {
      const cache = await caches.open(VER);
      try {
        const resp = await fetch(req);
        if (resp && resp.ok) cache.put(req, resp.clone());
        return resp;
      } catch {
        const hit = await cache.match(req);
        if (hit) return hit;
        throw new Error('offline');
      }
    })());
  }
});
