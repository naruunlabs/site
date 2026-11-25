/* Admin "visitors" tab (2026-11-19). Uses the existing admin session (edgeCall).
   Data: clever-worker GET_SITE_VISITS -> site_visit_daily / site_visit_source (supabase/32).
   Visitors = devices counted once per page per day. Views = every page load. */
var VS_DATA = { daily: [], sources: [] };
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
  direct: '직접·카톡 등', naver: '네이버', blog: '블로그', google: '구글', daum: '다음',
  kakao: '카카오', instagram: '인스타그램', youtube: '유튜브', facebook: '페이스북', threads: '스레드', other: '기타 사이트'
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
    VS_DATA = { daily: r.daily || [], sources: r.sources || [] };
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
  var src = {};
  VS_DATA.sources.forEach(function (r) { if (r.day >= since) src[r.source] = (src[r.source] || 0) + (Number(r.visitors) || 0); });
  var srcList = Object.keys(src).map(function (k) { return { k: k, n: src[k] }; }).sort(function (a, b) { return b.n - a.n; });
  var srcTotal = srcList.reduce(function (a, s) { return a + s.n; }, 0);
  document.getElementById('vsSrcBody').innerHTML = srcList.length ? srcList.map(function (s) {
    var pct = srcTotal ? 100 * s.n / srcTotal : 0;
    return '<tr><td class="vs-name"><b>' + vsEsc(VS_SOURCES[s.k] || s.k) + '</b></td><td class="vs-n vs-strong">' + vsNum(s.n) + '</td>' +
      '<td class="vs-n">' + pct.toFixed(0) + '%</td><td class="vs-bar-cell"><div class="vs-bar"><i style="width:' + pct.toFixed(1) + '%"></i></div></td></tr>';
  }).join('') : '<tr><td colspan="4" class="vs-empty">아직 기록이 없습니다</td></tr>';

  var empty = !rows.length;
  document.getElementById('vsEmpty').style.display = empty ? '' : 'none';
}
