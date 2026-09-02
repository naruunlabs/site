// =========================================================
//  나른랩스 서비스워커
//  수정일: 2026-07-31
//
//  무엇이 바뀌었나
//    예전에는 한 번 받아온 파일을 캐시에서 계속 꺼내 썼습니다.
//    그래서 프로그램을 고쳐서 올려도 고객 태블릿에는 옛날 버전이 그대로 뜨고,
//    "고쳤다는데 그대로예요" 같은 문의가 생길 수 있었습니다.
//    이용약관 제6조의 "업데이트는 자동으로 반영됩니다" 와도 맞지 않았습니다.
//
//    이제 이렇게 나눕니다.
//      · html / js / json  → 항상 인터넷에서 새로 받아옵니다 (네트워크 우선)
//                            인터넷이 끊겼을 때만 캐시에서 꺼냅니다.
//      · 이미지 / 폰트 / 영상 / 음원 → 캐시에서 먼저 꺼냅니다 (거의 안 바뀌므로)
//
//  ※ 파일을 크게 바꾼 뒤에는 아래 CACHE_NAME 의 날짜를 오늘 날짜로 바꿔주세요.
//    그러면 예전 캐시가 통째로 비워집니다.
// =========================================================

const CACHE_NAME = 'naruunlabs-2026-09-02g-main-short-copy';

const APP_SHELL = [
  './',
  './index.html',
  './academyweb.html',
  './manifest.json'
];

// 캐시에서 먼저 꺼내도 되는 파일 (거의 바뀌지 않는 것들)
const STATIC_EXT = /\.(svg|png|jpg|jpeg|gif|webp|ico|woff2?|ttf|otf|mp4|webm|mp3|wav|ogg)$/i;

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(APP_SHELL))
      .catch(() => undefined)
  );
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

/** 인터넷에서 먼저 받아오고, 실패하면 캐시에서 꺼낸다 */
function networkFirst(request, offlineFallback) {
  return fetch(request)
    .then(response => {
      if (response && response.ok) {
        const copy = response.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(request, copy));
      }
      return response;
    })
    .catch(async () => {
      const cached = await caches.match(request);
      if (cached) return cached;
      if (offlineFallback) {
        const fallback = await caches.match(offlineFallback);
        if (fallback) return fallback;
      }
      return new Response('오프라인 상태입니다.', {
        status: 503,
        headers: { 'Content-Type': 'text/plain; charset=utf-8' }
      });
    });
}

/** 캐시에서 먼저 꺼내고, 없으면 인터넷에서 받아온다 */
function cacheFirst(request) {
  return caches.match(request).then(cached => {
    if (cached) return cached;
    return fetch(request).then(response => {
      if (response && response.ok) {
        const copy = response.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(request, copy));
      }
      return response;
    });
  });
}

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);

  // 다른 사이트(CDN, 서버 API 등)는 서비스워커가 손대지 않는다.
  // 라이선스 인증 요청이 캐시되면 절대 안 되기 때문이다.
  if (url.origin !== self.location.origin) return;

  // 1) 페이지 이동 — 항상 최신을 받아온다
  if (event.request.mode === 'navigate') {
    event.respondWith(networkFirst(event.request, './index.html'));
    return;
  }

  // 2) 이미지·폰트·영상·음원 — 캐시 우선
  if (STATIC_EXT.test(url.pathname)) {
    event.respondWith(cacheFirst(event.request));
    return;
  }

  // 3) 그 밖의 것(html, js, json 등) — 네트워크 우선
  event.respondWith(networkFirst(event.request));
});
