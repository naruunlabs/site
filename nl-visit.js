/* =====================================================================
   NARUUN LABS  site visit counter (2026-11-19)
   - Counts one visit per device per page per day (admin "visitors" tab).
   - Sends only: page name, a random device number made here, and where the
     visitor came from (naver / google / ...). No name, IP or browser info.
   - Skipped for ?me=1 opt-out devices and localhost (same rule as GA4).
   - Failure is silent; the page never waits for it.
   Server side: clever-worker SITE_VISIT -> site_visit() (supabase/32).
   ===================================================================== */
(function () {
  'use strict';
  var EDGE = 'https://ebgoolsymyzkftvavpyj.supabase.co/functions/v1/clever-worker';
  var PAGES = ['index', 'academyweb', 'kickmaster', 'jumpmaster', 'strikemaster', 'poomsaemaster',
    'license', 'privacy', 'refund-policy', 'terms', 'brandguide'];
  try {
    var h = location.hostname;
    if (h === 'localhost' || h === '127.0.0.1' || h === '' || /\.local$/.test(h)) return;
    var q = new URLSearchParams(location.search);
    if (q.get('me') === '1') localStorage.setItem('naruunlabs_ga_optout', '1');
    if (q.get('me') === '0') localStorage.removeItem('naruunlabs_ga_optout');
    if (localStorage.getItem('naruunlabs_ga_optout') === '1') return;

    var page = location.pathname.replace(/^\/+/, '').replace(/\.html$/, '').replace(/\/+$/, '') || 'index';
    if (PAGES.indexOf(page) < 0) return;

    var KEY = 'naruunlabs_vid';
    var vid = localStorage.getItem(KEY);
    if (!vid || !/^[0-9a-f-]{36}$/.test(vid)) {
      vid = (window.crypto && crypto.randomUUID) ? crypto.randomUUID() :
        'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
          var r = Math.random() * 16 | 0;
          return (c === 'x' ? r : (r & 3 | 8)).toString(16);
        });
      localStorage.setItem(KEY, vid);
    }

    var src = 'direct';
    var ref = document.referrer || '';
    if (ref) {
      var rh = '';
      try { rh = new URL(ref).hostname.toLowerCase(); } catch (e) {}
      if (rh && rh !== h) {
        if (/(^|\.)blog\.naver\.com$|tistory\.com$|brunch\.co\.kr$/.test(rh)) src = 'blog';
        else if (/naver\.com$/.test(rh)) src = 'naver';
        else if (/(^|\.)google\./.test(rh)) src = 'google';
        else if (/daum\.net$/.test(rh)) src = 'daum';
        else if (/kakao\.com$|kakaocdn\.net$/.test(rh)) src = 'kakao';
        else if (/instagram\.com$/.test(rh)) src = 'instagram';
        else if (/youtube\.com$|youtu\.be$/.test(rh)) src = 'youtube';
        else if (/facebook\.com$|fb\.com$/.test(rh)) src = 'facebook';
        else if (/(^|\.)threads\.(net|com)$/.test(rh)) src = 'threads';   // 2026-11-25
        else src = 'other';
      }
    } else {
      /* 2026-11-25 · 앱 안 브라우저는 리퍼러를 안 보내는 일이 많다(특히 카톡).
         기기 안에서 '어느 앱 안인가'만 보고 경로를 고른다 · 브라우저 정보는 보내지 않는다. */
      var ua = navigator.userAgent || '';
      if (/KAKAOTALK/i.test(ua)) src = 'kakao';
      else if (/Instagram/.test(ua)) src = 'instagram';
      else if (/FBAN|FBAV|FB_IAB/.test(ua)) src = 'facebook';
      else if (/Barcelona/.test(ua)) src = 'threads';
    }

    fetch(EDGE, {
      method: 'POST',
      keepalive: true,
      headers: { 'Content-Type': 'text/plain' },
      body: JSON.stringify({ action: 'SITE_VISIT', payload: { page: page, visitor: vid, source: src } })
    }).catch(function () {});
  } catch (e) {}
})();
