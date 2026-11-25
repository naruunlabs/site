/* 관리자 통합 화면 (2026-11-24): 할 일 · 고객 관리 · 도장 상세 창 · 발급 창.
   admin.html 의 자료(LICENSES · CUSTOMERS · ACADEMY_PROJECTS)와 저장 함수(onCustCell · onLicCell ·
   toggleActive · openOwnedLicense · openConvert · openMsgPicker 등)를 그대로 쓴다. 새 서버 동작은 없다. */
(function(){
'use strict';

/* ── 공통 ─────────────────────────────────────────── */
const $ = id => document.getElementById(id);
const esc = v => escapeHtml(v);
const SHOW_ORDER = ['kick','poomsae','jump','strike'];          // 화면에 보이는 제품 순서 (킥 → 품새 → 점프)
const ISSUE_ORDER = ['kick','poomsae','jump'];                   // 발급 창에서 고르는 제품
const PCOLOR = { kick:'#E3172E', poomsae:'#F5B829', jump:'#14B8A6', strike:'#A855F7' };
const STAGE = {
  cust:  { t:'정식 고객', c:'var(--st-live)',  bg:'var(--st-live-bg)' },
  trial: { t:'체험',      c:'var(--st-trial)', bg:'var(--st-trial-bg)' },
  lead:  { t:'잠재',      c:'#CFD7E3',         bg:'#F1F4F8' },
  churn: { t:'이탈·중지', c:'#6B7A90',         bg:'var(--st-off-bg)' },
  none:  { t:'장부 미연결', c:'#CFD7E3',       bg:'#F1F4F8' }
};
const ST_COLOR = s => `var(--st-${s})`, ST_BG = s => `var(--st-${s}-bg)`;
const enc = d => encodeURIComponent(JSON.stringify(d));
const digits = v => String(v || '').replace(/[^0-9]/g, '');
const pkey = l => productOfKey(l.license_key).key;
const sortByProduct = ls => ls.slice().sort((a,b) => SHOW_ORDER.indexOf(pkey(a)) - SHOW_ORDER.indexOf(pkey(b)));
const won = n => (Number(n) || 0).toLocaleString('ko-KR') + '원';
const ymdText = s => s ? String(s).slice(0,10).replace(/-/g,'.') : '-';

function stageOf(c){
  if (!c) return 'none';
  if (c.status === 'churned') return 'churn';
  const ls = licensesOfCustomer(c);
  if (ls.length && ls.every(l => !l.is_active)) return 'churn';
  if (ls.some(l => l.is_active && l.license_type !== 'trial')) return 'cust';
  if (ls.some(l => l.license_type === 'trial')) return 'trial';
  return 'lead';
}
function lastUse(ls){ return ls.map(l => l.last_verified_at).filter(Boolean).sort().pop() || null; }
function agoOf(iso){
  if (!iso) return null;
  const n = daysAgo(isoToYmd(iso));
  if (n === null) return null;
  return { n, t: n <= 0 ? '오늘' : n === 1 ? '어제' : n < 7 ? `${n}일 전` : n < 30 ? `${Math.floor(n/7)}주 전` : `${Math.floor(n/30)}달 전` };
}
function pill(l){
  const st = licenseState(l), k = pkey(l);
  return `<span class="nl-pp" style="background:${ST_BG(st)};color:${ST_COLOR(st)}"><b style="background:${PCOLOR[k]||'#888'}${k==='poomsae'?';color:#332300':''}">${esc(PRODUCT_TAG[k]||'?')}</b>${esc(licenseStateText(l, st))}</span>`;
}
function ptag(k){ return `<b class="nl-ptag" style="background:${PCOLOR[k]||'#888'}${k==='poomsae'?';color:#332300':''}">${esc(PRODUCT_TAG[k]||'?')}</b>`; }
function act(name, args, label, cls){ return `<button type="button" class="${cls||'nl-btn sm'}" data-nl-act="${name}" data-nl-args="${esc(JSON.stringify(args||[]))}">${label}</button>`; }

/* 할 일 항목 (admin.html 의 todayItems · 처리 완료/미룸 상태를 그대로 쓴다) */
function taskList(){
  const items = todayItems().map(x => ({ ...x, task_key: taskKey(x) }));
  const active = items.filter(x => !taskIsSaved(x));
  return {
    items,
    urgent: active.filter(x => URGENT_TASK_GROUPS.has(x.g)),
    watch:  active.filter(x => !URGENT_TASK_GROUPS.has(x.g)),
    saved:  items.filter(taskIsSaved)
  };
}
function urgentCustomerIds(){
  const set = new Set();
  for (const x of taskList().urgent) {
    const c = x.c || customerOfLicense(x.d);
    if (c) set.add(c.id);
  }
  return set;
}

/* ── 할 일 화면 ───────────────────────────────────── */
let todoView = 'urgent';
const GROUP_COLOR = { ledger:'expired', ended:'expired', ending:'soon', expire:'soon', nudge:'trial', cold:'off' };

function renderTodo(){
  const box = $('nlTodoList'); if (!box) return;
  const T = taskList();
  const cnt = T.urgent.length;
  ['nlNavTodo'].forEach(id => { const e = $(id); if (e) { e.textContent = cnt || ''; e.hidden = !cnt; } });

  /* 숫자 카드 */
  const L = LICENSES || [];
  const st = l => licenseState(l);
  const ym = todayStr().slice(0,7);
  const month = L.reduce((a,l) => a + (String(l.pay_date||'').startsWith(ym) ? Number(l.pay_amount)||0 : 0)
                                    + (String(l.extra_at||'').startsWith(ym) ? Number(l.extra_amount)||0 : 0), 0);
  const cards = [
    ['live',     '정식 사용중',    L.filter(l => st(l) === 'live').length, ST_COLOR('live')],
    ['trialing', '체험 진행중',    L.filter(l => l.license_type === 'trial' && l.is_active && ['trial','soon'].includes(st(l))).length, ST_COLOR('trial')],
    ['soon',     '만료 임박 (7일)', L.filter(l => l.license_type !== 'trial' && st(l) === 'soon').length, ST_COLOR('soon')],
    ['expired',  '만료 · 체험 끝',  L.filter(l => st(l) === 'expired').length, ST_COLOR('expired')],
    ['',         '이번 달 매출',    won(month), 'var(--admin-title,#182b49)']
  ];
  $('nlStats').innerHTML = cards.map(([f,t,n,c]) => f
    ? `<button type="button" class="nl-stat" data-nl-act="statFilter" data-nl-args="${esc(JSON.stringify([f]))}"><div class="n" style="color:${c}">${esc(n)}</div><div class="l">${esc(t)}</div></button>`
    : `<div class="nl-stat"><div class="n" style="color:${c}">${esc(n)}</div><div class="l">${esc(t)}</div></div>`).join('');

  /* 챙길 일 */
  const tot = { urgent:T.urgent.length, watch:T.watch.length, saved:T.saved.length };
  $('nlTodoViews').innerHTML = [['urgent','처리 필요'],['watch','계속 확인'],['saved','완료·미룸']].map(([k,t]) =>
    `<button type="button" class="${todoView===k?'on':''}" data-nl-act="todoView" data-nl-args="${esc(JSON.stringify([k]))}">${t} <span>${tot[k]}</span></button>`).join('');
  $('nlTodoCnt').textContent = cnt ? `처리 필요 ${cnt}건` : '';
  const shown = T[todoView];
  if (!shown.length) {
    box.innerHTML = `<div class="nl-empty">${todoView==='saved' ? '완료하거나 미룬 항목이 없습니다.' : '지금 챙길 일이 없습니다.'}</div>`;
  } else {
    box.innerHTML = TASK_GROUP_LABELS.map(([g, label]) => {
      const list = shown.filter(x => x.g === g); if (!list.length) return '';
      return `<div class="nl-todo-gt">${esc(label)} <span>${list.length}</span></div>` + list.map(x => {
        const ent = x.c || x.d, c = x.c || customerOfLicense(x.d);
        const prod = x.c ? '' : `<span class="nl-todo-prod">${ptag(x.P.key)}${esc(x.P.short)}</span>`;
        const sub = [c && c.owner_name ? c.owner_name + ' 관장님' : '', (c && c.phone) || ent.phone || ''].filter(Boolean).join(' · ');
        const state = ADMIN_TASK_STATES.get(x.task_key);
        const savedText = todoView === 'saved' ? ` · ${state && state.disposition === 'snoozed' ? state.snooze_until + ' 다시 알림' : '완료'}` : '';
        const openArgs = c ? ['openClient', [c.id, x.c ? 'info' : 'lic']] : ['openLicense', [ent.id]];
        const primary = x.c ? act('openClient', [c.id, 'info'], '자세히') :
          x.convert ? act('openConvert', [ent.id], '정식 전환', 'nl-btn sm pri') :
          act('msg', [ent.id, x.msg], '카톡 문구');
        const more = todoView === 'saved'
          ? act('task', [x.task_key, 'open'], '다시 표시')
          : `<details class="nl-more"><summary>더보기</summary><div>${x.convert ? act('msg', [ent.id, x.msg], '카톡 문구', 'nl-mi') : ''}${act('task', [x.task_key,'done'], '처리 완료', 'nl-mi')}${act('task', [x.task_key,'snoozed'], '3일 뒤 다시 알림', 'nl-mi')}</div></details>`;
        return `<div class="nl-todo" data-nl-row="${esc(JSON.stringify(openArgs))}">
          <span class="nl-dot" style="background:${ST_COLOR(GROUP_COLOR[x.g]||'off')}"></span>
          <div class="nl-todo-what"><b>${esc(ent.dojang_name||'')}${prod}</b><span>${esc(x.why)}${esc(savedText)}${sub ? ' · ' + esc(sub) : ''}</span></div>
          <div class="nl-todo-act">${primary}${more}</div></div>`;
      }).join('');
    }).join('');
  }

  /* 최근 일 (최근 7일) */
  const ev = [], since = Date.now() - 7 * 86400000;
  const push = (iso, html, cid, lid) => { const t = Date.parse(iso); if (isFinite(t) && t >= since && t <= Date.now() + 3600000) ev.push({ t, html, cid, lid }); };
  for (const l of L) {
    const P = productOfKey(l.license_key), c = customerOfLicense(l), nm = esc(l.dojang_name || '');
    push(l.created_at, `<b>${nm}</b> ${esc(P.short)} ${l.license_type === 'trial' ? '체험' : '정식'} 키 발급`, c && c.id, l.id);
    if (l.trial_started_at) push(l.trial_started_at, `<b>${nm}</b> ${esc(P.short)} 체험 시작 (첫 인증)`, c && c.id, l.id);
    if (l.pay_date && l.license_type !== 'trial' && Number(l.pay_amount)) push(l.pay_date + 'T12:00:00', `<b>${nm}</b> ${esc(P.short)} 판매 ${won(l.pay_amount)}`, c && c.id, l.id);
  }
  for (const c of (CUSTOMERS || [])) push(c.created_at, `<b>${esc(c.dojang_name||'')}</b> 고객 장부에 등록`, c.id, null);
  ev.sort((a,b) => b.t - a.t);
  $('nlFeed').innerHTML = ev.slice(0, 12).map(e => {
    const d = new Date(e.t), days = daysAgo(ymdLocal(d));
    const when = days === 0 ? `오늘 ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}` : days === 1 ? '어제' : `${d.getMonth()+1}/${d.getDate()}`;
    const args = e.cid ? ['openClient', [e.cid, 'lic']] : e.lid ? ['openLicense', [e.lid]] : null;
    return `<li${args ? ` data-nl-row="${esc(JSON.stringify(args))}"` : ''}><time>${esc(when)}</time><span>${e.html}</span></li>`;
  }).join('') || '<li class="nl-feed-empty">최근 7일 동안 생긴 일이 없습니다.</li>';
}

/* ── 고객 관리 화면 ───────────────────────────────── */
let view = 'dojang', filt = 'all', prodF = 'all';

function setView(v){ view = v; filt = 'all'; renderClients(); }
function statFilter(f){ view = 'lic'; filt = f; prodF = 'all'; const q = $('nlQ'); if (q) q.value = ''; switchTab('clients'); }

function searchHit(q, qd, c, ls){
  if (!q) return true;
  const hay = [c && c.dojang_name, c && c.owner_name, c && c.phone, c && c.memo, c && c.sigungu, c && c.referrer,
               ...ls.map(l => l.license_key), ...ls.map(l => l.dojang_name)].join(' ').toLowerCase();
  if (hay.includes(q)) return true;
  if (qd.length >= 3) return [c && c.phone, ...ls.map(l => l.phone)].some(p => digits(p).includes(qd));
  return false;
}
function clientRows(){
  const rows = (CUSTOMERS || []).map(c => ({ c, ls: licensesOfCustomer(c) }));
  for (const l of (LICENSES || [])) if (!customerOfLicense(l)) rows.push({ c: null, ls: [l], orphan: l });
  return rows;
}

function renderChips(){
  const F = view === 'dojang'
    ? [['all','전체'],['urgent','챙길 일 있음'],['cust','정식 고객'],['trial','체험'],['lead','잠재'],['churn','이탈·중지']]
    : [['all','전체'],['live','정식 사용중'],['trialing','체험중'],['soon','만료 임박'],['expired','만료'],['off','중지']];
  const mark = k => view === 'dojang'
    ? (k === 'urgent' ? '<i class="nl-udot"></i>' : STAGE[k] ? `<i class="nl-bar" style="background:${STAGE[k].c}"></i>` : '')
    : (k === 'trialing' ? `<i class="nl-cdot" style="background:${ST_COLOR('trial')}"></i>` : k !== 'all' ? `<i class="nl-cdot" style="background:${ST_COLOR(k)}"></i>` : '');
  const PR = [['all','모든 제품'], ...ISSUE_ORDER.map(k => [k, PRODUCTS[k].short])];
  $('nlChips').innerHTML = F.map(([k,t]) => `<button type="button" class="nl-chip${filt===k?' on':''}" data-nl-act="filt" data-nl-args="${esc(JSON.stringify([k]))}">${mark(k)}${esc(t)}</button>`).join('')
    + '<span class="nl-chip-gap"></span>'
    + PR.map(([k,t]) => `<button type="button" class="nl-chip${prodF===k?' on':''}" data-nl-act="prod" data-nl-args="${esc(JSON.stringify([k]))}">${esc(t)}</button>`).join('');
  document.querySelectorAll('#nlViewSeg button').forEach(b => b.classList.toggle('on', b.dataset.v === view));
  const sort = $('nlSort');
  if (sort && sort.dataset.view !== view) {
    sort.dataset.view = view;
    sort.innerHTML = view === 'dojang'
      ? '<option value="urgent">챙길 일 먼저</option><option value="created">최근 등록순</option><option value="name">도장명순</option><option value="paid">받은 돈 많은순</option><option value="use">최근 사용순</option>'
      : '<option value="expire">만료 임박순</option><option value="name">도장명순</option><option value="created">최근 등록순</option><option value="verified">최근 인증순</option>';
  }
}

function renderClients(){
  const tb = $('nlBody'); if (!tb) return;
  renderChips();
  const q = String(($('nlQ') || {}).value || '').trim().toLowerCase(), qd = digits(q);
  const branch = ($('nlBranch') || {}).value || '*';
  const how = ($('nlSort') || {}).value;
  const head = $('nlHead'), line = $('nlCount');
  tb.dataset.v = view;

  if (view === 'dojang') {
    const urg = urgentCustomerIds();
    let rows = clientRows().filter(r => {
      if (!searchHit(q, qd, r.c, r.ls)) return false;
      if (branch !== '*' && (!r.c || String(r.c.branch_code || '') !== branch)) return false;
      if (prodF !== 'all' && !r.ls.some(l => pkey(l) === prodF)) return false;
      const s = r.c ? stageOf(r.c) : 'none';
      if (filt === 'all') return true;
      if (filt === 'urgent') return r.c && urg.has(r.c.id);
      return s === filt;
    });
    const paid = r => r.ls.reduce((a,l) => a + licenseRevenue(l), 0);
    const rank = r => { const s = r.c ? stageOf(r.c) : 'none'; return s === 'churn' ? 2 : s === 'none' ? 1 : 0; };
    rows.sort((a,b) => {
      if (how === 'name') return String((a.c||a.orphan).dojang_name||'').localeCompare(String((b.c||b.orphan).dojang_name||''), 'ko');
      if (how === 'paid') return paid(b) - paid(a);
      if (how === 'use') return String(lastUse(b.ls)||'').localeCompare(String(lastUse(a.ls)||''));
      if (how !== 'created') {
        const ua = a.c && urg.has(a.c.id) ? 0 : 1, ub = b.c && urg.has(b.c.id) ? 0 : 1;
        if (ua !== ub) return ua - ub;
        if (rank(a) !== rank(b)) return rank(a) - rank(b);
      }
      return String((b.c||b.orphan).created_at||'').localeCompare(String((a.c||a.orphan).created_at||''));
    });
    head.innerHTML = '<tr><th>도장</th><th>제품 · 상태</th><th>고객 단계</th><th class="nl-hide-m">지역</th><th class="nl-hide-m">최근 사용</th><th class="nl-hide-m">받은 돈</th><th>후속 연락</th></tr>';
    line.innerHTML = `<span>도장 ${rows.length}곳 · 줄을 누르면 오른쪽에 자세히 열립니다</span><span class="nl-legend">${['cust','trial','lead','churn'].map(k => `<span><i class="nl-bar" style="background:${STAGE[k].c}"></i>${STAGE[k].t}</span>`).join('')}<span><i class="nl-udot"></i>챙길 일 있음</span></span>`;
    tb.innerHTML = rows.map(r => {
      if (r.orphan) {
        const l = r.orphan;
        return `<tr data-nl-row="${esc(JSON.stringify(['openLicense',[l.id]]))}">
          <td class="nl-nm" style="--bar:${STAGE.none.c}">${esc(l.dojang_name||'')}<small>${esc(l.phone||'')}</small></td>
          <td class="nl-c-prod">${pill(l)}</td>
          <td><span class="nl-badge" style="background:${STAGE.none.bg};color:#667085">${STAGE.none.t}</span></td>
          <td class="nl-hide-m"></td><td class="nl-hide-m"></td><td class="nl-hide-m"></td>
          <td>${act('linkOrphan', [l.id], '장부에 연결')}</td></tr>`;
      }
      const c = r.c, s = stageOf(c), S = STAGE[s], lu = agoOf(lastUse(r.ls)), money = paid(r);
      const coldUse = lu && lu.n >= 14 && r.ls.some(l => l.is_active && l.license_type !== 'trial');
      const due = c.next_action_at ? daysAgo(c.next_action_at) : null;
      return `<tr data-id="${esc(c.id)}" class="${nlOpenId === c.id ? 'nl-sel' : ''}" data-nl-row="${esc(JSON.stringify(['openClient',[c.id]]))}">
        <td class="nl-nm" style="--bar:${S.c}">${urg.has(c.id) ? '<i class="nl-udot" title="챙길 일 있음 · 할 일 화면에 떠 있습니다"></i>' : ''}${esc(c.dojang_name||'')}<small>${esc([c.owner_name, c.phone].filter(Boolean).join(' · '))}</small></td>
        <td class="nl-c-prod">${r.ls.length ? sortByProduct(r.ls).map(pill).join('') : '<span class="nl-mut">라이선스 없음</span>'}</td>
        <td><span class="nl-badge" style="background:${S.bg};color:${s==='lead'?'#667085':S.c}">${S.t}</span></td>
        <td class="nl-hide-m nl-mut">${esc([c.sido, c.sigungu].filter(Boolean).join(' '))}</td>
        <td class="nl-hide-m" title="${esc(isoToYmd(lastUse(r.ls)))}">${lu ? `<span class="${coldUse?'nl-cold':'nl-mut'}">${esc(lu.t)}</span>` : '<span class="nl-mut">-</span>'}</td>
        <td class="nl-hide-m">${money ? won(money) : '<span class="nl-mut">-</span>'}</td>
        <td class="nl-c-next${c.next_action ? '' : ' nl-hide-m'}">${c.next_action ? `<span class="${due !== null && due >= 0 ? 'nl-due' : ''}">${esc(c.next_action)}</span> <span class="nl-mut">${esc(ymdText(c.next_action_at).slice(5))}</span>` : '<span class="nl-mut">-</span>'}</td>
      </tr>`;
    }).join('') || '<tr><td colspan="7" class="nl-empty-row">조건에 맞는 도장이 없습니다.</td></tr>';
  } else {
    let rows = (LICENSES || []).filter(l => {
      const c = customerOfLicense(l);
      if (!searchHit(q, qd, c, [l])) return false;
      if (branch !== '*' && (!c || String(c.branch_code || '') !== branch)) return false;
      if (prodF !== 'all' && pkey(l) !== prodF) return false;
      const st = licenseState(l);
      if (filt === 'all') return true;
      if (filt === 'trialing') return l.license_type === 'trial' && l.is_active && ['trial','soon'].includes(st);
      if (filt === 'soon') return st === 'soon' && l.license_type !== 'trial';
      return st === filt;
    });
    rows = sortRows(rows, how || 'expire');
    head.innerHTML = '<tr><th>도장</th><th>제품</th><th class="nl-hide-m">키</th><th class="nl-hide-m">종류</th><th>만료</th><th class="nl-hide-m">최근 인증</th><th class="nl-hide-m">기기</th><th>상태</th></tr>';
    line.innerHTML = `<span>라이선스 ${rows.length}개 · 이 보기에서는 한 줄이 라이선스 하나라서 왼쪽 띠 = 라이선스 상태</span>`;
    tb.innerHTML = rows.map(l => {
      const st = licenseState(l), c = customerOfLicense(l), k = pkey(l);
      const args = c ? ['openClient', [c.id, 'lic']] : ['openLicense', [l.id]];
      return `<tr data-nl-row="${esc(JSON.stringify(args))}">
        <td class="nl-nm" style="--bar:${ST_COLOR(st)}">${esc(l.dojang_name||'')}<small>${esc(c && c.owner_name ? c.owner_name : (l.phone||''))}</small></td>
        <td><span class="nl-prodname">${ptag(k)}${esc(PRODUCTS[k] ? PRODUCTS[k].short : k)}</span></td>
        <td class="nl-hide-m"><code class="nl-key">${esc(l.license_key||'')}</code></td>
        <td class="nl-hide-m">${esc(memberTypeLabel(l.license_type))}</td>
        <td>${esc(licExpireText(l) || '-')}</td>
        <td class="nl-hide-m">${lastUseCell(l)}</td>
        <td class="nl-hide-m">${(Array.isArray(l.device_slots) ? l.device_slots.length : 0)} / ${Number(l.max_devices)||2}</td>
        <td><span class="nl-badge" style="background:${ST_BG(st)};color:${ST_COLOR(st)}">${esc(licenseStateText(l, st))}</span></td></tr>`;
    }).join('') || '<tr><td colspan="8" class="nl-empty-row">조건에 맞는 라이선스가 없습니다.</td></tr>';
  }
}

/* 장부에 아직 안 붙은 라이선스를 고객에 붙인다 (admin.html sendToLedger 와 같은 순서 · 화면만 이쪽에 남는다) */
async function linkOrphan(id){
  const d = (LICENSES || []).find(x => String(x.id) === String(id)); if (!d) return;
  try {
    let c = customerByNamePhone(d.dojang_name, d.phone);
    if (!c) {
      c = await edgeCall('SAVE_CUSTOMER', { dojang_name: d.dojang_name, phone: d.phone || null, memo: d.memo || null, branch_code: null, status: 'lead' });
      if (!c || !c.id) throw new Error('고객을 만들지 못했습니다');
      CUSTOMERS.unshift(c);
    }
    await edgeCall('UPDATE_LICENSE', { id: d.id, customer_id: c.id });
    d.customer_id = c.id;
    await syncCustomerStatus(c);
    showToast(`'${d.dojang_name}' 을(를) 고객 장부에 연결했습니다`);
    refresh(); openClient(c.id, 'lic');
  } catch (e) { showToast('연결 실패: ' + e.message); }
}

/* ── 도장 상세 창 ─────────────────────────────────── */
let nlOpenId = null, dtab = 'lic', notesCache = {}, tfLoaded = false;
const DTABS = [['lic','라이선스'],['info','기본 정보'],['sale','판매'],['log','상담 · 설문'],['aw','아카데미웹']];

function awCount(c){ return ((typeof ACADEMY_PROJECTS !== 'undefined' ? ACADEMY_PROJECTS : []) || []).filter(p => p.customer_id === c.id).length; }
function curClient(){ return nlOpenId ? (CUSTOMERS || []).find(c => c.id === nlOpenId) || null : null; }
function openClient(id, tab){
  if (tab !== 'aw') awFocus = null;
  nlOpenId = id; dtab = tab || 'lic';
  renderDrawer(true);
  $('nlDrawer').classList.add('on'); $('nlShade').classList.add('on');
  $('nlDrawer').setAttribute('aria-hidden', 'false');
  document.querySelectorAll('#nlBody tr, #awBody tr').forEach(tr => tr.classList.toggle('nl-sel', tr.dataset.id === id));
  if (dtab === 'log') loadNotesFor(id);
}
function closeDrawer(){
  nlOpenId = null;
  $('nlDrawer').classList.remove('on'); $('nlShade').classList.remove('on');
  $('nlDrawer').setAttribute('aria-hidden', 'true');
  document.querySelectorAll('#nlBody tr.nl-sel, #awBody tr.nl-sel').forEach(tr => tr.classList.remove('nl-sel'));
  awFocus = null;
}
function setDtab(t){ dtab = t; renderDrawer(true); if (t === 'log' && nlOpenId) loadNotesFor(nlOpenId); }
function openLicense(id){ openOwnedLicense(id); }

function bestLicense(c){
  const order = ['soon','trial','expired','live','off'];
  return licensesOfCustomer(c).slice().sort((a,b) => order.indexOf(licenseState(a)) - order.indexOf(licenseState(b)))[0] || null;
}

function renderDrawer(force){
  const c = curClient();
  if (!c) { if (nlOpenId) closeDrawer(); return; }
  const dr = $('nlDrawer');
  /* 입력 중이면 다시 그리지 않는다 (글자가 날아가지 않게) */
  if (!force && dr.contains(document.activeElement) && /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement.tagName)) return;
  const s = stageOf(c), S = STAGE[s], ls = sortByProduct(licensesOfCustomer(c)), best = bestLicense(c);
  $('nlDName').textContent = c.dojang_name || '';
  $('nlDStage').innerHTML = `<span class="nl-badge" style="background:${S.bg};color:${s==='lead'?'#667085':S.c}">${S.t}</span>`;
  $('nlDWho').textContent = [c.owner_name ? c.owner_name + ' 관장님' : '', c.phone, [c.sido, c.sigungu].filter(Boolean).join(' '), c.branch_code ? branchLabel(c.branch_code) : ''].filter(Boolean).join(' · ');
  $('nlDQuick').innerHTML =
    (c.phone ? `<a class="nl-btn sm" href="tel:${esc(digits(c.phone))}">전화</a>` : '')
    + (best ? act('msg', [best.id], '카톡 문구') : '')
    + act('setDtab', ['log'], '상담 기록')
    + act('issueFor', [c.id, ''], '+ 라이선스 발급');
  $('nlDTabs').innerHTML = DTABS.map(([k,t]) => `<button type="button" class="${dtab===k?'on':''}" data-nl-act="setDtab" data-nl-args="${esc(JSON.stringify([k]))}">${t}${k==='lic' ? ` <span>${ls.length}</span>` : k==='aw' && awCount(c) ? ` <span>${awCount(c)}</span>` : ''}</button>`).join('');
  const body = $('nlDBody');
  if (dtab === 'lic') body.innerHTML = drawerLicenses(c, ls);
  else if (dtab === 'info') body.innerHTML = drawerInfo(c);
  else if (dtab === 'sale') body.innerHTML = drawerSales(c, ls);
  else if (dtab === 'log') body.innerHTML = drawerLog(c);
  else body.innerHTML = drawerAcademy(c);
}

function drawerLicenses(c, ls){
  let h = ls.map(l => {
    const st = licenseState(l), k = pkey(l), P = PRODUCTS[k] || productOfKey(l.license_key);
    const isTrial = l.license_type === 'trial', ends = trialEndsAt(l), lu = agoOf(l.last_verified_at);
    const endText = isTrial ? (ends ? ends.toLocaleString('ko-KR', { month:'numeric', day:'numeric', hour:'numeric' }) + ' 종료' : `첫 인증 전 · 연 날부터 ${Number(l.trial_days)||3}일`)
                            : (l.expire_date ? ymdText(l.expire_date) : '평생');
    const slots = Array.isArray(l.device_slots) ? l.device_slots.length : 0;
    return `<div class="nl-lic" style="--bar:${ST_COLOR(st)}">
      <div class="nl-lic-h">${ptag(k)}<b>${esc(P.name || P.short)}</b><span class="nl-mut">${esc(memberTypeLabel(l.license_type))}</span>
        <span class="nl-badge" style="background:${ST_BG(st)};color:${ST_COLOR(st)}">${esc(licenseStateText(l, st))}</span></div>
      <div class="nl-lic-g">
        <div><small>${isTrial ? '체험 종료' : '만료일'}</small><b>${esc(endText)}</b></div>
        <div><small>최근 인증</small><b>${lu ? esc(lu.t) + ' · ' + esc(ymdText(isoToYmd(l.last_verified_at)).slice(5)) : '아직 없음'}</b></div>
        <div><small>기기</small><b>${slots} / ${Number(l.max_devices)||2}대</b></div>
      </div>
      <div class="nl-lic-a">
        ${act('copyKey', [l.license_key], '키 복사')}
        ${act('msg', [l.id], '카톡')}
        ${isTrial && l.is_active ? act('openConvert', [l.id], '정식 전환', 'nl-btn sm pri') : ''}
        ${act('openLicense', [l.id], '자세히 · 수정')}
        ${act('toggle', [l.id, !!l.is_active], l.is_active ? '중지' : '다시 켜기', 'nl-btn sm' + (l.is_active ? ' warn' : ''))}
        <details class="nl-more"><summary>더보기</summary><div>${act('move', [l.id], '다른 도장으로 옮기기', 'nl-mi')}${act('del', [l.id], '삭제', 'nl-mi warn')}</div></details>
      </div>
      <div class="nl-lic-key"><code>${esc(l.license_key||'')}</code></div>
    </div>`;
  }).join('');
  if (!ls.length) h = '<div class="nl-empty">아직 라이선스가 없습니다 (잠재 고객).</div>';
  const have = new Set(ls.filter(l => l.is_active && licenseState(l) !== 'expired').map(pkey));
  const miss = ISSUE_ORDER.filter(k => !have.has(k));
  if (miss.length) h += `<div class="nl-add-lic"><span>발급하기</span>${miss.map(k => act('issueFor', [c.id, k], '+ ' + esc(PRODUCTS[k].short))).join('')}</div>`;
  return h;
}

function fieldInput(c, f, label, opt){
  opt = opt || {};
  const v = c[f] == null ? '' : String(c[f]);
  const at = `data-id="${esc(c.id)}" data-f="${f}" onchange="onCustCell(this)" class="nl-in" aria-label="${esc(label)}"`;
  let input;
  if (opt.sel) {
    const opts = opt.sel.map(o => Array.isArray(o) ? o : [o, o || '— 고르기 —']);
    if (v && !opts.some(o => o[0] === v)) opts.push([v, v + ' (목록에 없음)']);
    input = `<select ${at}>${opts.map(([ov, ot]) => `<option value="${esc(ov)}"${ov === v ? ' selected' : ''}>${esc(ot)}</option>`).join('')}</select>`;
  } else if (opt.area) input = `<textarea rows="3" ${at}>${esc(v)}</textarea>`;
  else input = `<input type="${opt.type || 'text'}" value="${esc(v)}" ${at}>`;
  return `<label class="${opt.full ? 'full' : ''}"><span>${esc(label)}</span>${input}</label>`;
}
function drawerInfo(c){
  const status = `<label><span>고객 단계</span><select class="nl-in" data-id="${esc(c.id)}" data-f="status" onchange="onCustCell(this)">
      <option value="auto"${c.status === 'churned' ? '' : ' selected'}>자동 (라이선스로 계산)</option>
      <option value="churned"${c.status === 'churned' ? ' selected' : ''}>이탈로 보관</option></select></label>`;
  return `<div class="nl-form">
    ${fieldInput(c, 'dojang_name', '도장명', { full:true })}
    ${fieldInput(c, 'owner_name', '관장님')}
    ${fieldInput(c, 'phone', '전화', { type:'tel' })}
    ${fieldInput(c, 'sido', '시 / 도', { sel: CUST_SIDO })}
    ${fieldInput(c, 'sigungu', '시군구 · 읍면동')}
    ${fieldInput(c, 'source', '어떻게 알게 되셨나', { sel: CUST_SOURCE })}
    ${fieldInput(c, 'referrer', '소개해준 곳')}
    ${fieldInput(c, 'branch_code', '고객 소속', { sel: CUST_BRANCH_OPTIONS })}
    ${fieldInput(c, 'students', '관원수', { type:'number' })}
    ${fieldInput(c, 'biz_no', '사업자번호')}
    ${fieldInput(c, 'device', '기기')}
    ${fieldInput(c, 'next_action', '후속 연락·확인')}
    ${fieldInput(c, 'next_action_at', '처리 예정일', { type:'date' })}
    ${fieldInput(c, 'memo', '메모', { area:true, full:true })}
    ${status}
    <label><span>장부 등록일</span><input class="nl-in" value="${esc(ymdText(isoToYmd(c.created_at)))}" disabled></label>
  </div>
  <div class="nl-note">칸을 벗어나면 바로 저장됩니다. 도장명·전화는 이 도장의 라이선스에도 저절로 맞춰집니다.</div>
  <div class="nl-danger">${act('delClient', [c.id], '고객 장부에서 삭제', 'nl-btn sm warn')}<span>라이선스는 지워지지 않고 연결만 풀립니다.</span></div>`;
}
function drawerSales(c, ls){
  const sold = ls.filter(l => l.license_type !== 'trial' || licenseRevenue(l));
  if (!sold.length) return '<div class="nl-empty">판매 기록이 없습니다. 체험만 있는 도장입니다.</div>';
  const total = sold.reduce((a,l) => a + licenseRevenue(l), 0);
  return sold.map(l => {
    const k = pkey(l);
    return `<div class="nl-lic" style="--bar:${PCOLOR[k]||'#888'}">
      <div class="nl-lic-h">${ptag(k)}<b>${esc((PRODUCTS[k]||{}).short || k)} ${esc(memberTypeLabel(l.license_type))}</b><span class="nl-mut nl-right">받은 돈 ${won(licenseRevenue(l))}</span></div>
      <div class="nl-sale">${LIC_SALE_COLS.map(col => `<label><span>${esc(col.t)}</span>${licSaleCell(l, col)}</label>`).join('')}</div>
    </div>`;
  }).join('') + `<div class="nl-total"><span>합계</span><b>${won(total)}</b></div>
  <div class="nl-note">판매 1번 = 라이선스 1개. 정가·할인을 고치면 실수령이 저절로 맞춰집니다. 칸을 벗어나면 바로 저장됩니다.</div>`;
}

/* 상담 이력 (customer_notes) + 체험 설문 */
async function loadNotesFor(id){
  try {
    notesCache[id] = await edgeCall('GET_CUSTOMER_NOTES', { customer_id: id }) || [];
  } catch (e) { notesCache[id] = { error: e.message }; }
  if (nlOpenId === id && dtab === 'log') renderDrawer(true);
  if (!tfLoaded && typeof loadTrialFeedback === 'function') { tfLoaded = true; loadTrialFeedback(); }
}
function drawerLog(c){
  const notes = notesCache[c.id];
  let list;
  if (notes === undefined) list = '<div class="nl-empty">불러오는 중…</div>';
  else if (notes && notes.error) list = `<div class="nl-empty">상담 이력을 불러오지 못했습니다: ${esc(notes.error)}</div>`;
  else if (!notes.length) list = '<div class="nl-empty">아직 상담 기록이 없습니다.</div>';
  else list = '<ul class="nl-tl">' + notes.map(n => `<li><time>${esc(ymdText(n.noted_at))}${n.method ? ' · ' + esc(n.method) : ''}</time><p>${esc(n.body||'')}</p>${act('delNote', [n.id, c.id], '지우기', 'nl-x')}</li>`).join('') + '</ul>';
  const fb = (typeof TRIAL_FEEDBACK !== 'undefined' ? TRIAL_FEEDBACK : []) || [];
  const lids = new Set(licensesOfCustomer(c).map(l => String(l.id)));
  const mine = fb.filter(r => r.customer_id === c.id || lids.has(String(r.license_id)));
  const survey = mine.length ? mine.map(r => {
    const a = r.response, cs = r.case, key = (cs && cs.id) || r.license_id;
    const intent = a ? (TF_LABELS.intent[a.intent] || a.intent) : '';
    const state = a ? `응답함 · ${esc(intent)}` : cs && cs.sent_at ? '보냈음 · 아직 응답 없음' : r.ended ? '체험 끝 · 아직 안 보냄' : '체험 중 (끝나면 보냅니다)';
    const follow = cs ? (TF_LABELS.status[cs.followup_status] || '') : '';
    return `<div class="nl-lic" style="--bar:${a ? 'var(--st-live)' : 'var(--st-off)'}">
      <div class="nl-lic-h"><b>${esc(r.product_name || '')}</b><span class="nl-mut">${esc(state)}</span>${follow ? `<span class="nl-badge" style="background:#F1F4F8;color:#475467">후속: ${esc(follow)}</span>` : ''}</div>
      ${a && a.comment ? `<p class="nl-quote">“${esc(a.comment)}”</p>` : ''}
      <div class="nl-lic-a">${r.can_issue ? act('tf', ['tfCopy', key, true], '설문 카톡 문구 복사') : ''}${cs ? act('tf', ['tfDetail', key], '응답 · 후속 관리') : ''}${cs && !cs.sent_at ? act('tf', ['tfSent', key], '발송 완료로 표시') : ''}</div>
    </div>`;
  }).join('') : '<div class="nl-empty">체험 설문 대상이 아닙니다.</div>';
  return `<div class="nl-note-add">
      <input type="date" id="nlNoteDate" class="nl-in" value="${esc(todayStr())}" aria-label="날짜">
      <select id="nlNoteMethod" class="nl-in" aria-label="방법"><option>전화</option><option>카톡</option><option>방문</option><option>기타</option></select>
      <input type="text" id="nlNoteBody" class="nl-in" placeholder="무슨 얘기를 했나요 (엔터로 저장)" aria-label="상담 내용">
      ${act('addNote', [c.id], '기록', 'nl-btn sm pri')}
    </div>
    <div class="nl-sec">상담 이력</div>${list}
    <div class="nl-sec">체험 설문</div>${survey}`;
}
async function addNote(id){
  const body = String(($('nlNoteBody') || {}).value || '').trim(); if (!body) return;
  try {
    await edgeCall('ADD_CUSTOMER_NOTE', { customer_id: id, noted_at: $('nlNoteDate').value, method: $('nlNoteMethod').value, body });
    showToast('기록했습니다');
    await loadNotesFor(id);
    const b = $('nlNoteBody'); if (b) b.focus();
  } catch (e) { showToast('기록 실패: ' + e.message); }
}
async function delNote(noteId, custId){
  if (!confirm('이 기록을 지울까요?')) return;
  try { await edgeCall('DELETE_CUSTOMER_NOTE', { id: noteId }); await loadNotesFor(custId); }
  catch (e) { showToast('삭제 실패: ' + e.message); }
}

/* ── 아카데미웹 (2026-11-25 · 고객 관리와 같은 모양) ──
   진행 상태 9가지를 다섯 묶음 색으로 보인다: 상담·견적(연회색) · 제작 중(파랑) · 확인 중(주황) · 공개 완료(초록) · 취소(짙은 회색).
   한 줄 = 제작 건 하나 · 누르면 그 도장의 상세 창 '아카데미웹' 칸이 열리고 거기서 고친다. */
const AW_GROUP = {
  talk:   { t:'상담 · 견적', c:'#CFD7E3',          bg:'#F1F4F8',             fg:'#667085' },
  build:  { t:'제작 중',     c:'var(--st-trial)',  bg:'var(--st-trial-bg)' },
  review: { t:'확인 중',     c:'var(--st-soon)',   bg:'var(--st-soon-bg)' },
  done:   { t:'공개 완료',   c:'var(--st-live)',   bg:'var(--st-live-bg)' },
  cancel: { t:'취소',        c:'#6B7A90',          bg:'var(--st-off-bg)' }
};
const AW_OF = { inquiry:'talk', quoted:'talk', contracted:'build', materials:'build', building:'build', review:'review', launched:'done', maintenance:'done', cancelled:'cancel' };
const awList = () => ((typeof ACADEMY_PROJECTS !== 'undefined' ? ACADEMY_PROJECTS : []) || []);
const awGroup = p => AW_GROUP[AW_OF[p.status] || 'talk'];
const awLabel = s => (ACADEMY_STATUS.find(x => x[0] === s) || [s, s || '-'])[1];
const awBadge = p => { const G = awGroup(p); return `<span class="nl-badge" style="background:${G.bg};color:${G.fg || G.c}">${esc(awLabel(p.status))}</span>`; };
const awCust = p => (CUSTOMERS || []).find(x => x.id === p.customer_id) || null;
const safeUrl = u => /^https?:\/\//i.test(String(u || '').trim()) ? String(u).trim() : '';
const awDue = p => typeof academyDue === 'function' && academyDue(p);
let awFilt = 'all', awFocus = null;

function renderAcademy(){
  const tb = $('awBody'); if (!tb) return;
  const P = awList();
  const inG = g => p => (AW_OF[p.status] || 'talk') === g;
  const paidSum = P.reduce((a,p) => a + (Number(p.paid_amount) || 0), 0);

  /* 숫자 카드 (누르면 아래 목록이 그 묶음만) */
  const cards = [
    ['all',    '전체 제작 건',     P.length, 'var(--admin-title,#182b49)'],
    ['build',  '제작 진행 중',     P.filter(inG('build')).length, AW_GROUP.build.c],
    ['review', '확인 기다리는 곳', P.filter(inG('review')).length, AW_GROUP.review.c],
    ['due',    '오늘 연락할 곳',   P.filter(awDue).length, ST_COLOR('expired')],
    ['',       '누적 수금',        won(paidSum), 'var(--admin-title,#182b49)']
  ];
  $('awStats').innerHTML = cards.map(([f,t,n,c]) => f
    ? `<button type="button" class="nl-stat" data-nl-act="awFilt" data-nl-args="${esc(JSON.stringify([f]))}"><div class="n" style="color:${c}">${esc(n)}</div><div class="l">${esc(t)}</div></button>`
    : `<div class="nl-stat"><div class="n" style="color:${c}">${esc(n)}</div><div class="l">${esc(t)}</div></div>`).join('');

  /* 묶음 칩 */
  const F = ['all','due','talk','build','review','done','cancel'];
  $('awChips').innerHTML = F.map(k => {
    const mark = k === 'due' ? '<i class="nl-udot"></i>' : AW_GROUP[k] ? `<i class="nl-bar" style="background:${AW_GROUP[k].c}"></i>` : '';
    const t = k === 'all' ? '전체' : k === 'due' ? '오늘 연락' : AW_GROUP[k].t;
    return `<button type="button" class="nl-chip${awFilt===k?' on':''}" data-nl-act="awFilt" data-nl-args="${esc(JSON.stringify([k]))}">${mark}${esc(t)}</button>`;
  }).join('');

  /* 목록 */
  const q = String(($('awSearch') || {}).value || '').trim().toLowerCase(), qd = digits(q);
  const how = ($('awSort') || {}).value || 'next';
  const rows = P.filter(p => {
    const c = awCust(p) || {};
    if (q) {
      const hay = [c.dojang_name, c.owner_name, c.phone, p.domain, p.site_url, p.next_action, p.memo].filter(Boolean).join(' ').toLowerCase();
      if (!hay.includes(q) && !(qd.length >= 3 && digits(c.phone).includes(qd))) return false;
    }
    if (awFilt === 'all') return true;
    if (awFilt === 'due') return awDue(p);
    return inG(awFilt)(p);
  });
  const nameOf = p => String((awCust(p) || {}).dojang_name || '');
  const late = p => ['done','cancel'].includes(AW_OF[p.status]) ? 1 : 0;
  rows.sort((a,b) => {
    if (how === 'name') return nameOf(a).localeCompare(nameOf(b), 'ko');
    if (how === 'created') return String(b.created_at||'').localeCompare(String(a.created_at||''));
    if (late(a) !== late(b)) return late(a) - late(b);
    if (how === 'due') return String(a.due_at||'9999').localeCompare(String(b.due_at||'9999'));
    if (awDue(a) !== awDue(b)) return awDue(a) ? -1 : 1;
    return String(a.next_action_at||'9999').localeCompare(String(b.next_action_at||'9999'));
  });

  $('awCount').innerHTML = `<span>제작 ${rows.length}건${rows.length !== P.length ? ` (전체 ${P.length}건)` : ''} · 줄을 누르면 오른쪽에 자세히 열립니다</span><span class="nl-legend">${['talk','build','review','done','cancel'].map(k => `<span><i class="nl-bar" style="background:${AW_GROUP[k].c}"></i>${AW_GROUP[k].t}</span>`).join('')}<span><i class="nl-udot"></i>오늘 연락</span></span>`;
  const custOpts = '<option value="">— 도장 고르기 —</option>' + (CUSTOMERS || []).map(c => `<option value="${esc(c.id)}">${esc(c.dojang_name || '')}${c.owner_name ? ' · ' + esc(c.owner_name) : ''}</option>`).join('');
  tb.innerHTML = rows.map(p => {
    const c = awCust(p), G = awGroup(p), due = awDue(p);
    const quote = Number(p.quoted_amount) || 0, paid = Number(p.paid_amount) || 0;
    const url = safeUrl(p.site_url);
    let when = '<span class="nl-mut">-</span>';
    if (p.launched_at) when = `<span class="nl-mut">공개</span> ${esc(ymdText(p.launched_at).slice(2))}`;
    else if (p.due_at) {
      const n = daysAgo(p.due_at);
      when = esc(ymdText(p.due_at).slice(2)) + (n === null ? '' : n <= 0 ? ` <span class="nl-mut">D-${-n}</span>` : ` <span class="nl-due">${n}일 지남</span>`);
    }
    const o3d = p.option_3d && p.option_3d !== 'none' ? esc((ACADEMY_3D.find(x => x[0] === p.option_3d) || [0, p.option_3d])[1]) : '<span class="nl-mut">-</span>';
    const name = c
      ? `${due ? '<i class="nl-udot" title="오늘 연락할 곳"></i>' : ''}${esc(c.dojang_name || '')}<small>${esc([c.owner_name, c.phone].filter(Boolean).join(' · '))}</small>`
      : `<span class="nl-mut">고객 미지정</span><select class="nl-in" data-id="${esc(p.id)}" data-f="customer_id" onchange="saveAcademyCell(this)" aria-label="도장 연결">${custOpts}</select>`;
    const site = [p.domain ? esc(p.domain) : '', url ? `<a class="nl-link" href="${esc(url)}" target="_blank" rel="noopener noreferrer">${esc(url.replace(/^https?:\/\//i, '').replace(/\/$/, ''))}</a>` : ''].filter(Boolean).join('<br>');
    return `<tr data-id="${esc(c ? c.id : '')}"${c ? ` class="${nlOpenId === c.id ? 'nl-sel' : ''}" data-nl-row="${esc(JSON.stringify(['awOpen',[p.id]]))}"` : ''}>
      <td class="nl-nm" style="--bar:${G.c}">${name}</td>
      <td>${awBadge(p)}</td>
      <td>${paid || quote ? `<b>${won(paid)}</b>${quote ? ` <span class="nl-mut">/ ${won(quote)}</span>` : ''}` : '<span class="nl-mut">-</span>'}</td>
      <td>${when}</td>
      <td class="nl-hide-m">${site || '<span class="nl-mut">-</span>'}</td>
      <td class="nl-hide-m">${o3d}</td>
      <td class="nl-c-next${p.next_action ? '' : ' nl-hide-m'}">${p.next_action ? `<span class="${due ? 'nl-due' : ''}">${esc(p.next_action)}</span> <span class="nl-mut">${esc(ymdText(p.next_action_at).slice(5))}</span>` : '<span class="nl-mut">-</span>'}</td>
    </tr>`;
  }).join('') || `<tr><td colspan="7" class="nl-empty-row">${P.length ? '조건에 맞는 제작 건이 없습니다.' : '아직 제작 건이 없습니다. 오른쪽 위 [+ 제작 건 추가]를 눌러 보세요.'}</td></tr>`;
}
function awOpen(id){
  const p = awList().find(x => x.id === id);
  const c = p && awCust(p); if (!c) return;
  awFocus = id; openClient(c.id, 'aw');
  const card = [...document.querySelectorAll('#nlDBody [data-aw]')].find(e => e.dataset.aw === String(id));
  if (card && card.scrollIntoView) card.scrollIntoView({ block:'nearest' });
}
function awField(p, f, label, opt){
  opt = opt || {};
  const v = p[f] == null ? '' : String(p[f]);
  const at = `data-id="${esc(p.id)}" data-f="${f}" onchange="saveAcademyCell(this)" class="nl-in" aria-label="${esc(label)}"`;
  let input;
  if (opt.sel) input = `<select ${at}>${opt.sel.map(([ov, ot]) => `<option value="${esc(ov)}"${ov === v ? ' selected' : ''}>${esc(ot)}</option>`).join('')}</select>`;
  else if (opt.area) input = `<textarea rows="3" ${at}>${esc(v)}</textarea>`;
  else input = `<input type="${opt.type || 'text'}" value="${esc(v)}"${opt.type === 'number' ? ' min="0" step="1000"' : ''}${opt.ph ? ` placeholder="${esc(opt.ph)}"` : ''} ${at}>`;
  return opt.bare ? input : `<label class="${opt.full ? 'full' : ''}"><span>${esc(label)}</span>${input}</label>`;
}
function drawerAcademy(c){
  const list = awList().filter(p => p.customer_id === c.id);
  const custSel = (CUSTOMERS || []).map(x => [x.id, (x.dojang_name || '') + (x.owner_name ? ' · ' + x.owner_name : '')]);
  const cards = list.map(p => {
    const G = awGroup(p), quote = Number(p.quoted_amount) || 0, paid = Number(p.paid_amount) || 0, url = safeUrl(p.site_url);
    return `<div class="nl-lic${awFocus === p.id ? ' nl-focus' : ''}" data-aw="${esc(p.id)}" style="--bar:${G.c}">
      <div class="nl-lic-h"><b>홈페이지 제작</b>${awBadge(p)}<span class="nl-mut nl-right">${quote ? (paid >= quote ? '다 받음' : `남은 돈 ${won(quote - paid)}`) : ''}</span></div>
      <div class="nl-form">
        ${awField(p, 'status', '진행 상태', { sel: ACADEMY_STATUS })}
        ${awField(p, 'option_3d', '3D 옵션', { sel: ACADEMY_3D })}
        ${awField(p, 'quoted_amount', '견적 금액', { type:'number' })}
        ${awField(p, 'paid_amount', '받은 금액', { type:'number' })}
        ${awField(p, 'started_at', '시작일', { type:'date' })}
        ${awField(p, 'due_at', '공개 예정일', { type:'date' })}
        ${awField(p, 'launched_at', '공개일', { type:'date' })}
        ${awField(p, 'domain', '도메인', { ph:'예) sampletkd.com' })}
        ${awField(p, 'site_url', '홈페이지 주소', { type:'url', ph:'https://', full:true })}
        ${awField(p, 'next_action', '다음 할 일', { ph:'예) 사진 자료 받기' })}
        ${awField(p, 'next_action_at', '연락 예정일', { type:'date' })}
        ${awField(p, 'memo', '메모', { area:true, full:true })}
      </div>
      <div class="nl-lic-a">
        ${url ? `<a class="nl-btn sm" href="${esc(url)}" target="_blank" rel="noopener noreferrer">홈페이지 열기</a>` : ''}
        <details class="nl-more nl-more-l"><summary>더보기</summary><div>
          <label class="nl-mi-sel"><span>다른 도장으로 옮기기</span>${awField(p, 'customer_id', '옮길 도장', { sel: custSel, bare:true })}</label>
          ${act('awDel', [p.id], '이 제작 건 삭제', 'nl-mi warn')}
        </div></details>
      </div>
    </div>`;
  }).join('');
  return (cards || '<div class="nl-empty">아카데미웹 제작 건이 없습니다.</div>')
    + `<div class="nl-lic-a" style="margin-top:10px">${act('addAcademy', [c.id], '+ 제작 건 추가')}${list.length ? act('gotoAcademy', [c.id], '아카데미웹 목록에서 보기') : ''}</div>
    <div class="nl-note">칸을 벗어나면 바로 저장됩니다. 도장명·전화 같은 고객 정보는 '기본 정보' 칸에서 고칩니다.</div>`;
}
async function addAcademy(id){
  await openAcademyAddModal();
  setAcademyAddMode('existing');
  const sel = $('awExistingCustomer'); if (sel) sel.value = id;
}
function gotoAcademy(id){
  const c = (CUSTOMERS || []).find(x => x.id === id);
  closeDrawer(); awFilt = 'all'; switchTab('academy');
  const s = $('awSearch'); if (s && c) { s.value = c.dojang_name || ''; renderAcademyProjects(); }
}
async function delClient(id){
  await deleteCustomer(id);
  if (!(CUSTOMERS || []).some(c => c.id === id)) { closeDrawer(); refresh(); }
}

/* ── 발급 창 ──────────────────────────────────────── */
let imode = 'old', pick = null, presetProduct = '';

function openIssue(customerId, product, mode){
  pick = customerId ? (CUSTOMERS || []).find(c => c.id === customerId) || null : null;
  presetProduct = product || '';
  imode = mode || 'old';
  $('nlIq').value = ''; $('nlIErr').textContent = '';
  ['nlNName','nlNOwner','nlNPhone','nlNSigungu','nlNRef','nlNStudents','nlNMemo'].forEach(id => $(id).value = '');
  fillSelect($('nlNSido'), CUST_SIDO, ''); fillSelect($('nlNSource'), CUST_SOURCE, '');
  fillBranchSelect($('nlNBranch'), 'hq');
  document.querySelector('#nlIType input[value="trial"]').checked = true;
  $('nlIPayDate').value = todayStr(); $('nlIPayMethod').value = ''; $('nlITax').checked = false; $('nlIReason').value = '';
  setMode(imode);
  $('nlIssue').classList.add('show');
  setTimeout(() => { const f = imode === 'new' ? $('nlNName') : pick ? null : $('nlIq'); if (f) f.focus(); }, 40);
}
function fillSelect(el, list, v){ el.innerHTML = list.map(o => `<option value="${esc(o)}">${esc(o || '— 고르기 —')}</option>`).join(''); el.value = v; }
function closeIssue(){ $('nlIssue').classList.remove('show'); }
function setMode(m){
  imode = m;
  document.querySelectorAll('#nlIMode button').forEach(b => b.classList.toggle('on', b.dataset.m === m));
  $('nlIOld').hidden = m !== 'old'; $('nlINew').hidden = m !== 'new';
  if (m === 'new') pick = null;
  renderHits(); renderProducts(); renderPay();
}
function renderHits(){
  const box = $('nlIHits'), card = $('nlIPicked'), q = $('nlIq').value.trim(), qd = digits(q);
  if (pick) {
    $('nlIq').hidden = true; box.hidden = true;
    const s = stageOf(pick);
    card.innerHTML = `<div class="nl-picked"><div><b>${esc(pick.dojang_name||'')}</b> <span class="nl-badge" style="background:${STAGE[s].bg};color:${s==='lead'?'#667085':STAGE[s].c}">${STAGE[s].t}</span>
      <div class="nl-mut">${esc([pick.owner_name ? pick.owner_name + ' 관장님' : '', pick.phone, [pick.sido, pick.sigungu].filter(Boolean).join(' '), pick.source].filter(Boolean).join(' · ') || '정보 없음')}</div></div>
      ${act('unpick', [], '바꾸기')}</div>`;
    return;
  }
  $('nlIq').hidden = false; card.innerHTML = '';
  const low = q.toLowerCase();
  const hits = q ? (CUSTOMERS || []).filter(c => [c.dojang_name, c.owner_name].join(' ').toLowerCase().includes(low) || (qd.length >= 3 && digits(c.phone).includes(qd))).slice(0, 6) : [];
  box.innerHTML = hits.map(c => `<button type="button" data-nl-act="pickC" data-nl-args="${esc(JSON.stringify([c.id]))}">${esc(c.dojang_name||'')}<small>${esc([c.owner_name, c.phone, STAGE[stageOf(c)].t].filter(Boolean).join(' · '))}</small></button>`).join('')
    + (q && !hits.length ? `<button type="button" data-nl-act="toNew" data-nl-args="${esc(JSON.stringify([q]))}">찾는 도장이 없습니다 → '${esc(q)}' 새 도장으로 등록</button>` : '');
  box.hidden = !box.innerHTML;
}
function pickC(id){ pick = (CUSTOMERS || []).find(c => c.id === id) || null; renderHits(); renderProducts(); }
function unpick(){ pick = null; $('nlIq').value = ''; renderHits(); renderProducts(); $('nlIq').focus(); }
function toNew(name){ setMode('new'); $('nlNName').value = name; $('nlNOwner').focus(); }

function renderProducts(){
  const checked = new Set([...document.querySelectorAll('#nlIProd input:checked')].map(i => i.value));
  if (presetProduct) { checked.add(presetProduct); presetProduct = ''; }
  const have = new Set(pick ? licensesOfCustomer(pick).filter(l => l.is_active && licenseState(l) !== 'expired').map(pkey) : []);
  $('nlIProd').innerHTML = ISSUE_ORDER.map(k => {
    const dis = have.has(k);
    return `<label class="${dis ? 'dis' : ''}"><input type="checkbox" value="${k}"${dis ? ' disabled' : checked.has(k) ? ' checked' : ''}>${ptag(k)}${esc(PRODUCTS[k].short)}${dis ? ' <span class="nl-mut">이미 있음</span>' : ''}</label>`;
  }).join('');
  renderPay();
}
function issueType(){ const r = document.querySelector('#nlIType input:checked'); return r ? r.value : 'trial'; }
function renderPay(){
  const life = issueType() === 'lifetime';
  const prods = [...document.querySelectorAll('#nlIProd input:checked')].map(i => i.value);
  $('nlIPay').hidden = !life || !prods.length;
  const keep = {};
  document.querySelectorAll('#nlIPayRows [data-p]').forEach(e => { keep[e.dataset.p + ':' + e.dataset.k] = e.value; });
  $('nlIPayRows').innerHTML = prods.map(k => {
    const lp = keep[k + ':list'] ?? (PRODUCTS[k].price ?? ''), dc = keep[k + ':disc'] ?? '';
    return `<div class="nl-pay-row"><span>${ptag(k)}${esc(PRODUCTS[k].short)}</span>
      <label><span>정가</span><input type="number" min="0" class="nl-in" data-p="${k}" data-k="list" value="${esc(lp)}"></label>
      <label><span>할인 (−)</span><input type="number" min="0" class="nl-in" data-p="${k}" data-k="disc" value="${esc(dc)}" placeholder="0"></label>
      <label><span>실수령 (=)</span><input class="nl-in" data-net="${k}" disabled></label></div>`;
  }).join('');
  calcNet();
  const has = !!(pick || imode === 'new');
  $('nlIGo').textContent = !prods.length && imode === 'new' ? '고객만 등록' : '발급';
  $('nlIGoCopy').hidden = !prods.length;
  $('nlIGo').disabled = !has && !prods.length;
}
function calcNet(){
  document.querySelectorAll('#nlIPayRows [data-net]').forEach(o => {
    const k = o.dataset.net, lp = Number(document.querySelector(`#nlIPayRows [data-p="${k}"][data-k="list"]`).value) || 0,
      dc = Number(document.querySelector(`#nlIPayRows [data-p="${k}"][data-k="disc"]`).value) || 0;
    o.value = lp - dc >= 0 ? won(lp - dc) : '할인이 정가보다 큽니다';
  });
}

async function doIssue(alsoCopy){
  const err = $('nlIErr'); err.textContent = '';
  const prods = [...document.querySelectorAll('#nlIProd input:checked')].map(i => i.value);
  const type = issueType(), life = type === 'lifetime';
  if (imode === 'old' && !pick) { err.textContent = '도장을 먼저 찾아서 골라 주세요. 없는 도장이면 \'새 도장\'을 누르세요.'; return; }
  const nn = $('nlNName').value.trim();
  if (imode === 'new' && !nn) { err.textContent = '도장명을 적어 주세요.'; $('nlNName').focus(); return; }
  if (imode === 'old' && !prods.length) { err.textContent = '발급할 제품을 하나 이상 골라 주세요.'; return; }
  const sale = {};
  if (life) {
    for (const k of prods) {
      const lp = document.querySelector(`#nlIPayRows [data-p="${k}"][data-k="list"]`).value, dc = document.querySelector(`#nlIPayRows [data-p="${k}"][data-k="disc"]`).value;
      const list = lp === '' ? null : Number(lp), disc = dc === '' ? 0 : Number(dc);
      if (list !== null && disc > list) { err.textContent = `${PRODUCTS[k].short}: 할인이 정가보다 큽니다.`; return; }
      sale[k] = { list_price: list, discount: disc, pay_amount: list === null ? null : list - disc };
    }
  }
  const go = $('nlIGo'), goc = $('nlIGoCopy'); go.disabled = goc.disabled = true;
  const done = [];
  let c = pick;
  try {
    if (imode === 'new') {
      const phone = formatPhone($('nlNPhone').value) || null;
      const same = customerByNamePhone(nn, phone);
      if (same && confirm(`'${same.dojang_name}' (${same.phone || ''}) 도장이 이미 장부에 있습니다.\n새로 만들지 않고 그 도장에 붙일까요?`)) c = same;
      else {
        const branch_code = $('nlNBranch').value || null;
        const row = { dojang_name: nn, phone, status: 'lead', branch_code };
        const add = (f, id) => { const v = $(id).value.trim(); if (v) row[f] = v; };
        add('owner_name','nlNOwner'); add('sido','nlNSido'); add('sigungu','nlNSigungu'); add('source','nlNSource'); add('referrer','nlNRef'); add('memo','nlNMemo');
        const st = $('nlNStudents').value; if (st !== '') row.students = Number(st);
        c = await edgeCall('SAVE_CUSTOMER', row);
        if (!c || !c.id) throw new Error('고객 장부에 도장을 만들지 못했습니다');
        if (c.phone) c.phone = formatPhone(c.phone);
        CUSTOMERS.unshift(c);
        if ((c.branch_code || null) !== branch_code) showToast('고객 소속 저장을 확인하지 못했습니다. 상세 창 기본 정보에서 다시 골라 주세요.');
      }
    }
    for (const k of prods) {
      const payload = {
        dojang_name: c.dojang_name, license_key: generateKey(PRODUCTS[k].gen), license_type: type, version: AKM_VERSION,
        expire_date: null, pay_amount: life ? sale[k].pay_amount : null, pay_date: life ? ($('nlIPayDate').value || todayStr()) : null,
        pay_memo: null, phone: c.phone || null, max_devices: 2, trial_days: life ? null : 3
      };
      const rows = await edgeCall('INSERT_LICENSE', { ...payload, is_active: true });
      const lic = Array.isArray(rows) ? rows[0] : null;
      if (!lic || !lic.id) throw new Error(`${PRODUCTS[k].short} 발급 결과를 받지 못했습니다`);
      const patch = { id: lic.id, customer_id: c.id };
      if (life) Object.assign(patch, { list_price: sale[k].list_price, discount: sale[k].discount,
        discount_reason: $('nlIReason').value.trim() || null, pay_method: $('nlIPayMethod').value || null, tax_invoice: $('nlITax').checked });
      try { await edgeCall('UPDATE_LICENSE', patch); }
      catch (e) { showToast(`${PRODUCTS[k].short} 키는 만들었지만 장부 연결에 실패했습니다: ${e.message}`); }
      done.push({ ...payload, id: lic.id });
    }
    if (done.length) { await loadLicenses(); await syncCustomerStatus(c); }   // 새 라이선스가 목록에 들어온 뒤에 단계를 계산한다
    if (alsoCopy && done.length) {
      const msg = done.map(d => licenseIssueMsg(d)).join('\n\n──────────\n\n');
      try { await navigator.clipboard.writeText(msg); showToast('발급했습니다 · 카톡 안내문을 복사했습니다'); }
      catch (e) { prompt('자동 복사가 막혔습니다. 아래 내용을 직접 복사하세요.', msg); }
    } else showToast(done.length ? `${c.dojang_name} · ${done.map(d => productOfKey(d.license_key).short).join('·')} 발급했습니다` : `${c.dojang_name} 을(를) 고객 장부에 등록했습니다`);
    closeIssue();
    await loadCustomers();
    if (!$('tab-clients').classList.contains('active') && !$('tab-todo').classList.contains('active')) switchTab('clients');
    openClient(c.id, done.length ? 'lic' : 'info');
  } catch (e) {
    const ok = done.length ? ` (이미 발급된 것: ${done.map(d => productOfKey(d.license_key).short).join('·')} — 목록을 새로고침해 확인하세요)` : '';
    err.textContent = '실패: ' + e.message + ok;
    if (done.length) { loadLicenses(); loadCustomers(); }
  } finally { go.disabled = goc.disabled = false; }
}

/* ── 클릭 처리 (값은 JSON 속성으로만 넘긴다) ──────── */
const ACTIONS = {
  todoView: v => { todoView = v; renderTodo(); },
  task: (k, d) => saveAdminTask(k, d),
  statFilter, setView, filt: f => { filt = f; renderClients(); }, prod: p => { prodF = p; renderClients(); },
  awFilt: f => { awFilt = f; renderAcademy(); }, awOpen, awDel: id => deleteAcademyProject(id),
  openClient, openLicense, setDtab, linkOrphan, addNote, delNote, addAcademy, gotoAcademy, delClient,
  openConvert: id => openConvert(id),
  msg: (id, kind) => { const l = (LICENSES || []).find(x => String(x.id) === String(id)); if (l) openMsgPicker(enc(l), kind); },
  copyKey: k => copyKeyOnly(k),
  toggle: (id, cur) => toggleActive(id, cur),
  move: id => moveLicenseToCustomer(id),
  del: id => { const l = (LICENSES || []).find(x => String(x.id) === String(id)); if (l) deleteLicense(l.id, l.dojang_name); },
  issueFor: (cid, k) => openIssue(cid, k, 'old'),
  tf: (fn, ...a) => { if (['tfCopy','tfDetail','tfSent'].includes(fn) && typeof window[fn] === 'function') window[fn](...a); },
  pickC, unpick, toNew
};
document.addEventListener('click', e => {
  const b = e.target.closest('[data-nl-act]');
  if (b) {
    if (b.disabled) return;
    const fn = ACTIONS[b.dataset.nlAct]; if (typeof fn !== 'function') return;
    let args; try { args = JSON.parse(b.dataset.nlArgs || '[]'); } catch (_) { return; }
    if (!Array.isArray(args)) return;
    const d = b.closest('details'); if (d) d.open = false;
    fn(...args); return;
  }
  const row = e.target.closest('[data-nl-row]');
  if (row && !e.target.closest('a,button,input,select,textarea,summary,details')) {
    let spec; try { spec = JSON.parse(row.dataset.nlRow); } catch (_) { return; }
    const fn = ACTIONS[spec[0]]; if (typeof fn === 'function') fn(...(spec[1] || []));
  }
});
document.addEventListener('keydown', e => {
  if (e.key !== 'Escape') return;
  if ($('nlIssue') && $('nlIssue').classList.contains('show')) { closeIssue(); return; }
  if (document.querySelector('.modal-bg.show')) return;
  if (nlOpenId) closeDrawer();
});

/* ── 다른 화면이 자료를 다시 그릴 때 같이 다시 그린다 ── */
let pending = false;
function refresh(){
  if (pending) return; pending = true;
  setTimeout(() => {
    pending = false;
    try { renderTodo(); } catch (e) { console.error(e); }
    try { if ($('tab-clients') && $('tab-clients').classList.contains('active')) renderClients(); } catch (e) { console.error(e); }
    try { if ($('tab-academy') && $('tab-academy').classList.contains('active')) renderAcademy(); } catch (e) { console.error(e); }
    try { if (nlOpenId) renderDrawer(false); } catch (e) { console.error(e); }
  }, 0);
}
function wrap(name){
  const orig = window[name]; if (typeof orig !== 'function') return;
  window[name] = function(){ const r = orig.apply(this, arguments); if (r && typeof r.then === 'function') r.then(refresh, refresh); else refresh(); return r; };
}
['renderTable','renderCustomers','renderToday','renderAcademyProjects','loadTrialFeedback'].forEach(wrap);

/* 기록 메뉴: 방문자 · 오류 기록 · 체험 설문을 한 메뉴로 묶는다 */
function onTab(tab){
  const nav = $('nlLogsNav');
  if (nav) {
    const inLogs = ['visits','errors','feedback'].includes(tab);
    nav.hidden = !inLogs;
    if (inLogs) {
      const host = $('tab-' + tab); if (host && nav.parentNode !== host) host.insertBefore(nav, host.firstChild);
      nav.querySelectorAll('button').forEach(b => b.classList.toggle('on', b.dataset.t === tab));
    }
  }
  if (!['clients','todo','academy'].includes(tab)) closeDrawer();
  if (tab === 'todo') renderTodo();
  if (tab === 'clients') renderClients();
  if (tab === 'academy') renderAcademy();
}

/* 사이드바 선 아이콘 */
const IC = {
  todo:'<path d="M4 6.5l1.6 1.6L8.5 5"/><path d="M4 12.5l1.6 1.6 2.9-3.1"/><path d="M4 18.5l1.6 1.6 2.9-3.1"/><path d="M11.5 7h8.5M11.5 13h8.5M11.5 19h8.5"/>',
  users:'<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c.6-3.6 3.2-5.5 6.5-5.5s5.9 1.9 6.5 5.5"/><path d="M15.5 4.8a3.5 3.5 0 010 6.4M18 14.8c2 .7 3.2 2.4 3.5 5.2"/>',
  globe:'<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c2.5 2.6 3.7 5.6 3.7 9s-1.2 6.4-3.7 9c-2.5-2.6-3.7-5.6-3.7-9S9.5 5.6 12 3z"/>',
  pen:'<path d="M15.5 4.5l4 4L8 20H4v-4z"/><path d="M13.5 6.5l4 4"/>',
  chart:'<path d="M4 20h16"/><path d="M7 16v-5M12 16V6M17 16v-8"/>',
  list:'<path d="M8 6h12M8 12h12M8 18h12"/><circle cx="4" cy="6" r=".8"/><circle cx="4" cy="12" r=".8"/><circle cx="4" cy="18" r=".8"/>',
  table:'<rect x="3.5" y="4.5" width="17" height="15" rx="1.5"/><path d="M3.5 9.5h17M3.5 14.5h17M9.5 9.5v10"/>'
};
document.querySelectorAll('[data-nl-ic]').forEach(e => {
  e.innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true">${IC[e.dataset.nlIc] || ''}</svg>`;
});

/* 입력 칸 연결 */
function bind(){
  const q = $('nlQ'); if (q) q.addEventListener('input', renderClients);
  const s = $('nlSort'); if (s) s.addEventListener('change', renderClients);
  const br = $('nlBranch'); if (br) { fillBranchSelect(br, '*', true); br.addEventListener('change', renderClients); }
  document.querySelectorAll('#nlViewSeg button').forEach(b => b.addEventListener('click', () => setView(b.dataset.v)));
  document.querySelectorAll('#nlIMode button').forEach(b => b.addEventListener('click', () => setMode(b.dataset.m)));
  $('nlIq').addEventListener('input', renderHits);
  $('nlIProd').addEventListener('change', renderPay);
  $('nlIType').addEventListener('change', renderPay);
  $('nlIPayRows').addEventListener('input', calcNet);
  $('nlIssue').addEventListener('click', e => { if (e.target === $('nlIssue')) closeIssue(); });
  $('nlShade').addEventListener('click', closeDrawer);
  document.addEventListener('keydown', e => { if (e.key === 'Enter' && e.target && e.target.id === 'nlNoteBody' && nlOpenId) addNote(nlOpenId); });
}
bind();

window.nlOnTab = onTab;
window.nlOpenIssue = openIssue;
window.nlCloseIssue = closeIssue;
window.nlDoIssue = doIssue;
window.nlCloseDrawer = closeDrawer;
window.nlOpenClient = openClient;
window.nlRenderClients = renderClients;
window.nlRenderTodo = renderTodo;
window.nlRenderAcademy = renderAcademy;
refresh();
})();
