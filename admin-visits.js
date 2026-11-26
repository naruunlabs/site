/* Admin "visitors" tab (2026-11-19). Uses the existing admin session (edgeCall).
   Data: clever-worker GET_SITE_VISITS -> site_visit_daily / site_visit_source (supabase/32).
   Visitors = devices counted once per page per day. Views = every page load. */
var VS_DATA = { daily: [], sources: [], hours: [] };
var VS_LOADED_DAYS = 0;
var VS_PAGES = [
  ['index', '메인', '/'],
  ['kickmaster', '킥마스터', '/kickmaster'],
  ['jumpmaster', '점프마스터', '/jumpmaster'],
  ['poomsaemaster', '품새마스터', '/poomsaemaster'],
  ['strikemaster', '스트라이크 마스터', '/strikemaster'],
  ['academyweb', '아카데미웹', '/academyweb'],
  ['terms', '이용약관', '/terms'],
  ['privacy', '개인정보처리방침', '/privacy'],
  ['refund-policy', '환불정책', '/refund-policy'],
  ['license', '라이선스 약관', '/license'],
  ['brandguide', '브랜드 가이드', '/brandguide']
];
var VS_SOURCES = {
  direct: '직접(주소·QR 등)', naver: '네이버', blog: '블로그', google: '구글', daum: '다음',
  kakao: '카톡', instagram: '인스타그램', youtube: '유튜브', facebook: '페이스북', threads: '스레드', other: '기타 사이트'
};

function vsEsc(v) { return String(v == null ? '' : v).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
function vsDay(offset) { return new Date(Date.now() + 9 * 3600000 - (offset || 0) * 86400000).toISOString().slice(0, 10); }
function vsNum(n) { return Number(n || 0).toLocaleString('ko-KR'); }

async function loadSiteVisits(force) {
  var days = Number(document.getElementById('vsDays').value) || 30;
  var msg = document.getElementById('vsMsg');
  if (!force && VS_LOADED_DAYS >= days) { renderSiteVisits(); return; }
  msg.textContent = '불러오는 중…';
  try {
    var r = await edgeCall('GET_SITE_VISITS', { days: days }) || {};
    VS_DATA = { daily: r.daily || [], sources: r.sources || [], hours: r.hours || [] };
    VS_LOADED_DAYS = days;
    msg.textContent = '마지막 불러오기 ' + new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' });
    renderSiteVisits();
  } catch (e) {
    msg.textContent = '방문자 기록을 불러오지 못했습니다: ' + e.message;
  }
}

function renderSiteVisits() {
  var days = Number(document.getElementById('vsDays').value) || 30;
  var since = vsDay(days - 1), today = vsDay(0), yday = vsDay(1);
  var rows = VS_DATA.daily.filter(function (r) { return r.day >= since; });
  var get = function (page, day, field) {
    var f = rows.find(function (r) { return r.page === page && r.day === day; });
    return f ? Number(f[field]) || 0 : 0;
  };
  var sum = function (page, field) {
    return rows.reduce(function (a, r) { return a + (r.page === page ? Number(r[field]) || 0 : 0); }, 0);
  };
  var allViews = rows.reduce(function (a, r) { return a + (r.page !== '*' ? Number(r.views) || 0 : 0); }, 0);
  var siteSum = sum('*', 'visitors');

  document.getElementById('vsToday').textContent = vsNum(get('*', today, 'visitors'));
  document.getElementById('vsYday').textContent = vsNum(get('*', yday, 'visitors'));
  document.getElementById('vsSum').textContent = vsNum(siteSum);
  document.getElementById('vsAvg').textContent = vsNum(Math.round(siteSum / days));
  document.getElementById('vsViews').textContent = vsNum(allViews);
  document.querySelectorAll('.vs-period').forEach(function (el) { el.textContent = days === 1 ? '오늘' : '최근 ' + days + '일'; });

  /* pages */
  var list = VS_PAGES.map(function (p) {
    return { key: p[0], name: p[1], path: p[2], today: get(p[0], today, 'visitors'), yday: get(p[0], yday, 'visitors'), vis: sum(p[0], 'visitors'), views: sum(p[0], 'views') };
  }).sort(function (a, b) { return b.vis - a.vis || b.views - a.views; });
  var maxVis = Math.max(1, list.reduce(function (a, p) { return Math.max(a, p.vis); }, 0));
  document.getElementById('vsPageBody').innerHTML = list.map(function (p) {
    return '<tr><td class="vs-name"><b>' + vsEsc(p.name) + '</b><span>' + vsEsc(p.path) + '</span></td>' +
      '<td class="vs-n" data-label="오늘">' + vsNum(p.today) + '</td>' +
      '<td class="vs-n" data-label="어제">' + vsNum(p.yday) + '</td>' +
      '<td class="vs-n vs-strong" data-label="방문자">' + vsNum(p.vis) + '</td>' +
      '<td class="vs-n" data-label="조회수">' + vsNum(p.views) + '</td>' +
      '<td class="vs-bar-cell"><div class="vs-bar"><i style="width:' + (100 * p.vis / maxVis).toFixed(1) + '%"></i></div></td></tr>';
  }).join('');

  /* chart */
  var sel = document.getElementById('vsChartPage');
  var cp = sel.value || '*';
  var series = [];
  for (var i = days - 1; i >= 0; i--) { var d = vsDay(i); series.push({ day: d, v: get(cp, d, 'visitors') }); }
  var maxV = Math.max(1, series.reduce(function (a, s) { return Math.max(a, s.v); }, 0));
  document.getElementById('vsChart').innerHTML = series.map(function (s) {
    var wd = ['일', '월', '화', '수', '목', '금', '토'][new Date(s.day + 'T12:00:00Z').getUTCDay()];
    return '<div class="vs-col' + (s.day === today ? ' is-today' : '') + '" title="' + s.day.slice(5).replace('-', '/') + ' (' + wd + ') ' + vsNum(s.v) + '명">' +
      (days <= 31 && s.v ? '<em>' + s.v + '</em>' : '') + '<i style="height:' + (s.v ? Math.max(3, 100 * s.v / maxV) : 0).toFixed(1) + '%"></i></div>';
  }).join('');
  document.getElementById('vsChartFrom').textContent = series[0].day.slice(5).replace('-', '/');
  document.getElementById('vsChartTo').textContent = '오늘';
  var peak = series.reduce(function (a, s) { return Math.max(a, s.v); }, 0);
  document.getElementById('vsChartMax').textContent = '가장 많은 날 ' + vsNum(peak) + '명';

  /* sources */
  /* 2026-11-25 · 페이지별 표처럼 오늘·어제 칸을 함께 보인다 (같은 site_visit_source 하루치) */
  var src = {}, srcDay = {};
  VS_DATA.sources.forEach(function (r) {
    var n = Number(r.visitors) || 0;
    if (r.day >= since) src[r.source] = (src[r.source] || 0) + n;
    if (r.day === today || r.day === yday) { srcDay[r.source + '|' + r.day] = (srcDay[r.source + '|' + r.day] || 0) + n; if (!(r.source in src)) src[r.source] = 0; }
  });
  var srcList = Object.keys(src).map(function (k) { return { k: k, n: src[k], t: srcDay[k + '|' + today] || 0, y: srcDay[k + '|' + yday] || 0 }; })
    .sort(function (a, b) { return b.n - a.n || b.t - a.t; });
  var srcTotal = srcList.reduce(function (a, s) { return a + s.n; }, 0);
  document.getElementById('vsSrcBody').innerHTML = srcList.length ? srcList.map(function (s) {
    var pct = srcTotal ? 100 * s.n / srcTotal : 0;
    return '<tr><td class="vs-name"><b>' + vsEsc(VS_SOURCES[s.k] || s.k) + '</b></td>' +
      '<td class="vs-n" data-label="오늘">' + vsNum(s.t) + '</td><td class="vs-n" data-label="어제">' + vsNum(s.y) + '</td>' +
      '<td class="vs-n vs-strong" data-label="방문자">' + vsNum(s.n) + '</td>' +
      '<td class="vs-n">' + pct.toFixed(0) + '%</td><td class="vs-bar-cell"><div class="vs-bar"><i style="width:' + pct.toFixed(1) + '%"></i></div></td></tr>';
  }).join('') : '<tr><td colspan="6" class="vs-empty">아직 기록이 없습니다</td></tr>';

  renderSourceHours(since);

  var empty = !rows.length;
  document.getElementById('vsEmpty').style.display = empty ? '' : 'none';
}

/* 2026-11-25 · 몇 시에 어디서 왔나 (site_visit_source_hour · supabase/34 · 11-25 부터 쌓임)
   줄 = 3시간 단위 시간대(새벽 0~6시는 한 줄), 칸 = 많이 온 경로 6개 + 그 외 + 합계.
   칸 색이 진할수록 그 경로에서 그 시간대에 많이 온 것. 경로마다 가장 많은 시간대는 굵게. */
var VS_BANDS = [[0, 6, '새벽 0~6시'], [6, 9, '아침 6~9시'], [9, 12, '오전 9~12시'], [12, 15, '낮 12~3시'],
  [15, 18, '오후 3~6시'], [18, 21, '저녁 6~9시'], [21, 24, '밤 9~12시']];
/* 2026-11-26 · 오늘 / 어제 / 기간 전체 고르기 (기본 = 오늘 · 11-26 완수님). 자료는 이미 날짜별로 받아 와 있어 다시 부르지 않는다. */
var VS_HOUR_MODE = 'today', VS_HOUR_SINCE = '';
function setHourMode(m) {
  VS_HOUR_MODE = m;
  document.querySelectorAll('#vsHourSeg button').forEach(function (b) { b.classList.toggle('on', b.getAttribute('data-h') === m); });
  renderSourceHours(VS_HOUR_SINCE);
}
function renderSourceHours(since) {
  var head = document.getElementById('vsHourHead'), body = document.getElementById('vsHourBody');
  if (!head || !body) return;
  VS_HOUR_SINCE = since;
  var today = vsDay(0), yday = vsDay(1);
  var pick = VS_HOUR_MODE === 'today' ? function (r) { return r.day === today; }
    : VS_HOUR_MODE === 'yday' ? function (r) { return r.day === yday; }
    : function (r) { return r.day >= since; };
  var hrs = (VS_DATA.hours || []).filter(pick);
  var tot = {};
  hrs.forEach(function (r) { tot[r.source] = (tot[r.source] || 0) + (Number(r.visitors) || 0); });
  var keys = Object.keys(tot).sort(function (a, b) { return tot[b] - tot[a]; });
  var cols = keys.slice(0, 6), rest = keys.length > 6;
  var colOf = function (src) { return cols.indexOf(src) >= 0 ? src : '_rest'; };
  if (rest) cols = cols.concat('_rest');
  if (!hrs.length) {
    head.innerHTML = '<tr><th>시간대</th><th class="vs-n">합계</th></tr>';
    var none = VS_HOUR_MODE === 'today' ? '오늘은 아직 기록이 없습니다' : VS_HOUR_MODE === 'yday' ? '어제는 기록이 없습니다' : '아직 기록이 없습니다 · 2026-11-25 부터 쌓입니다';
    body.innerHTML = '<tr><td colspan="2" class="vs-empty">' + none + '</td></tr>';
    return;
  }
  var cell = {}, bandSum = VS_BANDS.map(function () { return 0; });
  hrs.forEach(function (r) {
    var h = Number(r.hour), n = Number(r.visitors) || 0;
    var b = VS_BANDS.findIndex(function (x) { return h >= x[0] && h < x[1]; });
    if (b < 0) return;
    var k = b + '|' + colOf(r.source);
    cell[k] = (cell[k] || 0) + n; bandSum[b] += n;
  });
  var colMax = {};
  cols.forEach(function (c) { colMax[c] = Math.max.apply(null, VS_BANDS.map(function (x, b) { return cell[b + '|' + c] || 0; })); });
  var allMax = Math.max.apply(null, bandSum);
  var label = function (c) { return c === '_rest' ? '그 외' : (VS_SOURCES[c] || c); };
  head.innerHTML = '<tr><th>시간대</th>' + cols.map(function (c) { return '<th class="vs-n">' + vsEsc(label(c)) + '</th>'; }).join('') + '<th class="vs-n">합계</th></tr>';
  body.innerHTML = VS_BANDS.map(function (x, b) {
    /* 2026-11-26 · '새벽'·'낮' 글자 수와 시간 길이가 달라 줄 끝이 들쭉날쭉 → 낱말은 왼쪽 칸, 시간은 오른쪽 정렬 칸 */
    var nm = x[2].split(' ');
    return '<tr><td class="vs-name vs-band"><b><span>' + nm[0] + '</span><span>' + nm[1] + '</span></b></td>' + cols.map(function (c) {
      var n = cell[b + '|' + c] || 0, m = colMax[c] || 0;
      var a = m ? (0.06 + 0.5 * n / m) : 0;
      return '<td class="vs-n vs-heat' + (n && n === m ? ' vs-peak' : '') + '" data-label="' + vsEsc(label(c)) + '"' +
        (n ? ' style="background:rgba(7,87,216,' + a.toFixed(2) + ')' + (a > 0.4 ? ';color:#fff' : '') + '"' : '') + '>' + (n ? vsNum(n) : '·') + '</td>';
    }).join('') + '<td class="vs-n vs-strong' + (bandSum[b] && bandSum[b] === allMax ? ' vs-peak' : '') + '">' + vsNum(bandSum[b]) + '</td></tr>';
  }).join('') +
    /* 2026-11-26 · 맨 아래 합계 줄 = 경로마다 세로로 더한 값 (오른쪽 끝 = 전체 합계) */
    '<tr class="vs-total"><td class="vs-name"><b>합계</b></td>' + cols.map(function (c) {
      var t = VS_BANDS.reduce(function (a, x, b) { return a + (cell[b + '|' + c] || 0); }, 0);
      return '<td class="vs-n vs-strong" data-label="' + vsEsc(label(c)) + '">' + vsNum(t) + '</td>';
    }).join('') + '<td class="vs-n vs-strong">' + vsNum(bandSum.reduce(function (a, n) { return a + n; }, 0)) + '</td></tr>';
}
