// 薬剤師シフト管理 PWA Service Worker
// バージョンを上げると古いキャッシュが破棄される
const CACHE_VERSION = 'v34';
const CACHE_NAME = `shift-app-${CACHE_VERSION}`;

const SHELL_FILES = [
  './shift.html',
  './manifest.json',
  './icon.svg',
  './icon-192.png',
  './icon-512.png'
];

// インストール: シェルファイルをキャッシュ
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(SHELL_FILES))
  );
  self.skipWaiting();
});

// 有効化: 古いバージョンのキャッシュを削除
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then(names => Promise.all(
        names.filter(n => n !== CACHE_NAME).map(n => caches.delete(n))
      ))
      .then(() => self.clients.claim())
  );
});

// fetch: HTML はネットワーク優先 (更新を反映)、その他はキャッシュ優先
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);

  // 同一オリジンのみ扱う (祝日APIなど外部はそのまま素通し)
  if (url.origin !== self.location.origin) return;

  const isHtml = url.pathname.endsWith('.html')
              || url.pathname === '/'
              || url.pathname.endsWith('/');

  if (isHtml) {
    // ネットワーク優先 → 失敗時キャッシュ
    event.respondWith(
      fetch(event.request)
        .then(res => {
          const copy = res.clone();
          caches.open(CACHE_NAME).then(c => c.put(event.request, copy));
          return res;
        })
        .catch(() =>
          caches.match(event.request).then(c => c || caches.match('./shift.html'))
        )
    );
  } else {
    // キャッシュ優先 → なければネットワーク
    event.respondWith(
      caches.match(event.request).then(cached =>
        cached || fetch(event.request).then(res => {
          if (res.ok) {
            const copy = res.clone();
            caches.open(CACHE_NAME).then(c => c.put(event.request, copy));
          }
          return res;
        })
      )
    );
  }
});
