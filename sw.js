// 앱 파일을 캐시해 두고 오프라인에서도 열리게 한다.
// 캐시를 먼저 보여 주고 뒤에서 새 버전을 받아 두므로, 업데이트는 다음 실행 때 반영된다.
const CACHE = 'coloring-pad-v6';
// 글꼴(Google Fonts)은 처음 한 번 받아 두고 계속 쓴다. 앱 버전이 바뀌어도 지우지 않는다
const FONTS = 'coloring-pad-fonts';
const FONT_HOSTS = ['fonts.googleapis.com', 'fonts.gstatic.com'];
const SHELL = [
  './', 'index.html', 'style.css', 'manifest.webmanifest',
  'js/app.js', 'js/util.js', 'js/store.js', 'js/brushes.js', 'js/fill.js', 'js/editor.js', 'js/library.js',
  'js/icons.js', 'js/speech.js', 'js/progress.js', 'js/letters.js', 'js/trace.js',
  'js/faces.js', 'js/accessories.js', 'js/makeup.js',
  'icons/icon-180.png', 'icons/icon-192.png', 'icons/icon-512.png',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE && k !== FONTS).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (FONT_HOSTS.includes(url.hostname)) {
    e.respondWith(
      caches.open(FONTS).then(async (cache) => {
        const hit = await cache.match(req);
        if (hit) return hit;
        const res = await fetch(req);
        if (res.ok || res.type === 'opaque') cache.put(req, res.clone());
        return res;
      }),
    );
    return;
  }
  if (url.origin !== location.origin) return;
  e.respondWith(
    caches.open(CACHE).then(async (cache) => {
      const hit = await cache.match(req, { ignoreSearch: true });
      const net = fetch(req)
        .then((res) => {
          if (res.ok) cache.put(req, res.clone());
          return res;
        })
        .catch(() => hit);
      return hit || net;
    }),
  );
});
