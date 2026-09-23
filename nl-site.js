/* =====================================================================
   NARUUN LABS  site v4  -  common script
   1) contact links from admin (kakao / phone)
   2) reveal on scroll
   3) mode tabs + lazy videos
   4) hero / signature pose animations (dot figure)
   5) jump lane pad, kick VS counter, strike combo chips
   6) browser trial: skeleton + hand raise gauge only.
      No kick / jump / punch judging code lives here on purpose.
   ===================================================================== */
(function(){
  'use strict';
  var EDGE = 'https://ebgoolsymyzkftvavpyj.supabase.co/functions/v1/clever-worker';
  var reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  var B = document.body;
  var css = getComputedStyle(B);
  function cvar(n){ return (getComputedStyle(B).getPropertyValue(n)||'').trim(); }
  function track(name, p){ try{ if(window.gtag) gtag('event', name, p||{}); }catch(e){} }

  /* ---------- 1. contact ---------- */
  var kakaoUrl = '';
  function applyContact(d){
    var kakao=(d.kakao_url||'').trim(), tel=(d.tel_url||'tel:01076573579').trim(), phone=(d.phone||'010-7657-3579').trim();
    if(kakao && kakao!=='#'){
      kakaoUrl = kakao;
      document.querySelectorAll('.js-kakao').forEach(function(a){ a.href=kakao; a.target='_blank'; a.rel='noopener'; });
    }
    document.querySelectorAll('.js-tel').forEach(function(a){
      a.href=tel;
      if(a.dataset.tel==='full') a.textContent='전화 문의 '+phone;
      else if(a.dataset.tel==='num') a.textContent=phone;
    });
  }
  window.NL_HOME = fetch(EDGE,{method:'POST',headers:{'Content-Type':'application/json'},
      body:JSON.stringify({action:'GET_HOME_DATA',payload:{target:'index'}})})
    .then(function(r){return r.json();})
    .then(function(res){ var d=res&&res.data; if(d) applyContact(d); return d||null; })
    .catch(function(){ return null; });

  /* ---------- 2. reveal ---------- */
  if(!reduce && 'IntersectionObserver' in window){
    document.documentElement.classList.add('js-ready');
    var io=new IntersectionObserver(function(es){ es.forEach(function(e){ if(e.isIntersecting){ e.target.classList.add('on'); io.unobserve(e.target);} }); },{threshold:.12,rootMargin:'0px 0px -40px 0px'});
    document.querySelectorAll('.rv').forEach(function(el){
      var r=el.getBoundingClientRect(); if(r.top<innerHeight) el.classList.add('on'); else io.observe(el);
    });
  }

  /* ---------- 3. tabs + lazy videos ---------- */
  function loadVideo(v){ if(v && v.dataset.src && !v.src){ v.src=v.dataset.src; } }
  function playIn(el){ if(!el) return; el.querySelectorAll('video').forEach(function(v){ loadVideo(v); var p=v.play(); if(p&&p.catch)p.catch(function(){}); }); }
  function pauseIn(el){ if(!el) return; el.querySelectorAll('video').forEach(function(v){ try{v.pause();}catch(e){} }); }
  document.querySelectorAll('[data-tabs]').forEach(function(box){
    var tabs=[].slice.call(box.querySelectorAll('.mode-tab'));
    function sel(t, user){
      tabs.forEach(function(x){
        var on=x===t; x.setAttribute('aria-selected',on?'true':'false'); x.tabIndex=on?0:-1;
        var pane=document.getElementById(x.getAttribute('aria-controls'));
        if(pane){ pane.classList.toggle('on',on); on?playIn(pane):pauseIn(pane); }
      });
      if(user) track('mode_tab',{mode:t.dataset.name||''});
    }
    tabs.forEach(function(t,i){
      t.addEventListener('click',function(){ sel(t,true); });
      t.addEventListener('keydown',function(e){
        var k=e.key, n=null;
        if(k==='ArrowDown'||k==='ArrowRight') n=tabs[(i+1)%tabs.length];
        if(k==='ArrowUp'||k==='ArrowLeft') n=tabs[(i-1+tabs.length)%tabs.length];
        if(n){ e.preventDefault(); n.focus(); sel(n,true); }
      });
    });
    // start first pane video only when the section is near the screen
    if('IntersectionObserver' in window){
      var once=new IntersectionObserver(function(es){ if(es[0].isIntersecting){ sel(tabs.filter(function(x){return x.getAttribute('aria-selected')==='true';})[0]||tabs[0]); once.disconnect(); } },{rootMargin:'200px'});
      once.observe(box);
    }
  });

  /* ---------- helpers for "when visible" ---------- */
  function whenSeen(el, fn, th){
    if(!el) return;
    if(!('IntersectionObserver' in window)){ fn(); return; }
    var o=new IntersectionObserver(function(es){ if(es[0].isIntersecting){ fn(); o.disconnect(); } },{threshold:th||.35});
    o.observe(el);
  }
  function visibleLoop(el, step){
    // runs requestAnimationFrame only while el is on screen
    var on=false, raf=0, last=0;
    function tick(t){ if(!on) return; var dt=last?Math.min(64,t-last):16; last=t; step(t,dt); raf=requestAnimationFrame(tick); }
    function start(){ if(on) return; on=true; last=0; raf=requestAnimationFrame(tick); }
    function stop(){ on=false; cancelAnimationFrame(raf); }
    if('IntersectionObserver' in window){
      new IntersectionObserver(function(es){ es[0].isIntersecting?start():stop(); }).observe(el);
    } else start();
    document.addEventListener('visibilitychange',function(){ if(document.hidden) stop(); });
  }

  /* ---------- 4. dot figure ---------- */
  // joints: 0 head, 1 shL, 2 shR, 3 elL, 4 elR, 5 wrL, 6 wrR, 7 hipL, 8 hipR, 9 knL, 10 knR, 11 anL, 12 anR
  var EDGES=[[1,2],[1,3],[3,5],[2,4],[4,6],[1,7],[2,8],[7,8],[7,9],[9,11],[8,10],[10,12]];
  var P={
    guard:  [[56,18],[48,33],[62,33],[44,48],[68,46],[52,28],[70,28],[50,66],[60,66],[44,92],[66,92],[38,118],[72,118]],
    chamber:[[52,20],[45,34],[59,34],[42,48],[66,46],[50,29],[68,29],[49,66],[60,66],[44,92],[80,60],[38,118],[72,84]],
    kick:   [[46,24],[41,37],[55,35],[38,50],[62,46],[46,31],[64,30],[49,66],[61,64],[44,92],[86,56],[38,118],[112,48]],
    jab:    [[58,18],[50,33],[64,33],[46,48],[82,32],[54,28],[102,30],[50,66],[60,66],[44,92],[66,92],[38,118],[72,118]],
    cross:  [[60,18],[54,32],[66,34],[74,34],[70,46],[100,32],[70,28],[51,66],[61,66],[44,92],[67,92],[38,118],[73,118]],
    hook:   [[57,18],[49,33],[64,33],[45,48],[78,26],[53,28],[92,22],[50,66],[60,66],[44,92],[66,92],[38,118],[72,118]],
    upper:  [[57,19],[49,34],[64,34],[45,49],[74,46],[53,29],[84,22],[50,67],[60,67],[44,93],[66,93],[38,118],[72,118]],
    stand:  [[60,18],[52,33],[68,33],[46,47],[74,47],[43,61],[77,61],[54,66],[66,66],[54,92],[66,92],[54,118],[66,118]],
    land:   [[60,24],[52,39],[68,39],[46,52],[74,52],[43,65],[77,65],[54,72],[66,72],[50,95],[70,95],[54,118],[66,118]],
    air:    [[60,4],[52,19],[68,19],[46,33],[74,33],[43,47],[77,47],[54,52],[66,52],[53,76],[67,76],[55,98],[65,98]]
  };
  function lerpPose(a,b,e){ return a.map(function(p,i){ return [p[0]+(b[i][0]-p[0])*e, p[1]+(b[i][1]-p[1])*e]; }); }
  function ease(k){ return k<.5?2*k*k:1-Math.pow(-2*k+2,2)/2; }

  function Fig(canvas){
    var ctx=canvas.getContext('2d'), W=0,H=0,dpr=1, S=1, ox=0, oy=0;
    var cx=parseFloat(canvas.dataset.cx||'.5');
    function size(){
      var r=canvas.getBoundingClientRect(); dpr=Math.min(2,window.devicePixelRatio||1);
      W=Math.max(1,r.width); H=Math.max(1,r.height);
      canvas.width=Math.round(W*dpr); canvas.height=Math.round(H*dpr);
      S=(H*0.8)/140; ox=W*cx-60*S; oy=H*0.93-122*S;
    }
    size(); addEventListener('resize',size);
    var trail=[];
    return {
      ctx:ctx,
      xy:function(p){ return [ox+p[0]*S, oy+p[1]*S]; },
      clear:function(){ ctx.setTransform(dpr,0,0,dpr,0,0); ctx.clearRect(0,0,W,H); },
      size:function(){ return {W:W,H:H,S:S}; },
      draw:function(pts,col,glowJoint){
        var self=this; ctx.setTransform(dpr,0,0,dpr,0,0);
        // trail
        if(glowJoint!=null){ trail.push(self.xy(pts[glowJoint])); if(trail.length>9) trail.shift(); }
        else trail.length=0;
        for(var t=1;t<trail.length;t++){
          ctx.strokeStyle=col; ctx.globalAlpha=t/trail.length*.5; ctx.lineWidth=Math.max(2,S*5*t/trail.length);
          ctx.beginPath(); ctx.moveTo(trail[t-1][0],trail[t-1][1]); ctx.lineTo(trail[t][0],trail[t][1]); ctx.stroke();
        }
        ctx.globalAlpha=1; ctx.lineCap='round';
        ctx.shadowColor=col; ctx.shadowBlur=12;
        ctx.strokeStyle=col; ctx.globalAlpha=.55; ctx.lineWidth=Math.max(1.6,S*2.4);
        EDGES.forEach(function(e){ var a=self.xy(pts[e[0]]), b=self.xy(pts[e[1]]); ctx.beginPath(); ctx.moveTo(a[0],a[1]); ctx.lineTo(b[0],b[1]); ctx.stroke(); });
        ctx.globalAlpha=1; ctx.fillStyle=col;
        pts.forEach(function(p,i){
          var q=self.xy(p);
          if(i===0){ ctx.lineWidth=Math.max(1.6,S*2.4); ctx.beginPath(); ctx.arc(q[0],q[1],S*8,0,6.283); ctx.stroke(); }
          else { ctx.beginPath(); ctx.arc(q[0],q[1],Math.max(2.2,S*3.6),0,6.283); ctx.fill(); }
        });
        ctx.shadowBlur=0;
      }
    };
  }

  function seqRunner(frames){ // frames: [{p, d(ms), ev}]
    var i=0, t=0, from=frames[frames.length-1].p;
    return function(dt, onEv){
      var f=frames[i]; t+=dt;
      var k=Math.min(1,t/f.d), pts=lerpPose(from,f.p,ease(k));
      if(k>=1){ if(f.ev&&onEv) onEv(f.ev); from=f.p; t=0; i=(i+1)%frames.length; }
      return {pts:pts, glow:f.glow};
    };
  }

  function counterEl(id){ return id?document.getElementById(id):null; }

  document.querySelectorAll('canvas[data-pose]').forEach(function(cv){
    var kind=cv.dataset.pose, fig=Fig(cv), col=cv.dataset.color||cvar('--c2')||'#fff';
    var cnt=counterEl(cv.dataset.counter), n=parseInt(cnt&&cnt.textContent||'0',10)||0;
    function bump(){ n++; if(cnt) cnt.textContent=n; }
    var step;
    if(kind==='kick'){
      var run=seqRunner([{p:P.guard,d:520},{p:P.chamber,d:260},{p:P.kick,d:180,ev:'hit',glow:12},{p:P.kick,d:160,glow:12},{p:P.chamber,d:220},{p:P.guard,d:320}]);
      step=function(t,dt){ var r=run(dt,bump); fig.clear(); fig.draw(r.pts,col,r.glow); };
    }
    else if(kind==='strike'){
      var chips=cv.dataset.chips?document.querySelectorAll(cv.dataset.chips+' i'):[];
      var nameEl=counterEl(cv.dataset.name);
      var names=['잽','원투','원투 훅','원투 훅 어퍼'];
      var hitN=0;
      function onHit(ev){
        if(ev==='reset'){ hitN=0; [].forEach.call(chips,function(c){c.classList.remove('hit');}); if(nameEl) nameEl.textContent='READY'; return; }
        bump();
        if(chips[hitN]) chips[hitN].classList.add('hit');
        if(nameEl) nameEl.textContent=names[hitN]||'';
        hitN++;
      }
      var run2=seqRunner([{p:P.guard,d:500,ev:'reset'},{p:P.jab,d:150,ev:'hit',glow:6},{p:P.guard,d:260},{p:P.cross,d:170,ev:'hit',glow:5},{p:P.guard,d:280},{p:P.hook,d:190,ev:'hit',glow:6},{p:P.guard,d:280},{p:P.upper,d:190,ev:'hit',glow:6},{p:P.guard,d:900}]);
      step=function(t,dt){ var r=run2(dt,onHit); fig.clear(); fig.draw(r.pts,col,r.glow); };
    }
    else if(kind==='jump'){
      var ph=0, period=620, prevHalf=false, ropeCol=cv.dataset.rope||cvar('--c2');
      step=function(t,dt){
        ph=(ph+dt/period)%1;
        var hop=Math.sin(Math.PI*ph);                 // 0 at landing, 1 at top
        var base= hop<.18 ? lerpPose(P.land,P.stand,hop/.18) : lerpPose(P.stand,P.air,Math.min(1,(hop-.18)/.82));
        var half=ph>=.5; if(half&&!prevHalf) bump(); prevHalf=half;
        fig.clear();
        // rope: control point swings from over the head (ph 0) to under the feet (ph .5)
        var ctx=fig.ctx, a=fig.xy(base[5]), b=fig.xy(base[6]), s=fig.size().S;
        var cyTop=fig.xy([0,base[0][1]-40])[1], cyBot=fig.xy([0,base[11][1]+34])[1];
        var k=(1-Math.cos(2*Math.PI*ph))/2;          // 0 top, 1 bottom
        var cy=cyTop+(cyBot-cyTop)*k, mx=(a[0]+b[0])/2;
        var front = ph>.25 && ph<.75;
        function rope(){ ctx.save(); ctx.strokeStyle=ropeCol; ctx.lineWidth=Math.max(2,s*2.6); ctx.shadowColor=ropeCol; ctx.shadowBlur=14; ctx.beginPath(); ctx.moveTo(a[0],a[1]); ctx.quadraticCurveTo(mx,cy*2-(a[1]+b[1])/2,b[0],b[1]); ctx.stroke(); ctx.restore(); }
        if(!front) rope();
        fig.draw(base,col,null);
        if(front) rope();
        // ground shadow
        ctx.setTransform(1,0,0,1,0,0);
      };
    }
    else if(kind==='morph'){
      var seq=[[P.kick,'#FF4D5E','kick'],[P.air,'#5EEAD4','jump'],[P.cross,'#D8A8FF','strike']];
      var doors=document.querySelectorAll('[data-door]');
      var idx=0, tt=0, from=P.guard, to=seq[0][0], c=seq[0][1], hold=false, paused=false;
      function mark(k){ [].forEach.call(doors,function(d){ d.classList.toggle('lit',d.dataset.door===k); }); }
      mark('kick');
      [].forEach.call(doors,function(d){
        d.addEventListener('mouseenter',function(){ var j=['kick','jump','strike'].indexOf(d.dataset.door); if(j<0) return; paused=true; from=lerpPose(from,to,1); idx=j; to=seq[j][0]; c=seq[j][1]; tt=0; mark(seq[j][2]); });
        d.addEventListener('mouseleave',function(){ paused=false; });
      });
      var cur=P.guard;
      step=function(t,dt){
        tt+=dt;
        var k=Math.min(1,tt/700);
        cur=lerpPose(from,to,ease(k));
        if(tt>2300 && !paused){ from=to; idx=(idx+1)%seq.length; to=seq[idx][0]; c=seq[idx][1]; tt=0; mark(seq[idx][2]); }
        fig.clear(); fig.draw(cur,c,null);
      };
    }
    if(!step) return;
    if(reduce){ step(0,400); return; }
    visibleLoop(cv,step);
  });

  /* ---------- 5a. kick VS counter ---------- */
  document.querySelectorAll('.vs[data-blue]').forEach(function(vs){
    var bEl=vs.querySelector('.blue b'), rEl=vs.querySelector('.red b');
    var bT=+vs.dataset.blue, rT=+vs.dataset.red;
    whenSeen(vs,function(){
      if(reduce){ bEl.textContent=bT; rEl.textContent=rT; vs.classList.add('done'); return; }
      var t0=0;
      function f(t){ if(!t0)t0=t; var k=Math.min(1,(t-t0)/2600);
        bEl.textContent=Math.round(bT*k); rEl.textContent=Math.round(rT*Math.min(1,k*1.04));
        if(k<1) requestAnimationFrame(f); else vs.classList.add('done'); }
      requestAnimationFrame(f);
    },.45);
  });

  /* ---------- 5b. jump lane + pad ---------- */
  document.querySelectorAll('.stage[data-lane]').forEach(function(st){
    var pads=st.querySelectorAll('.pad span'), name=st.querySelector('.coach-name b'), jt=st.querySelector('.judge-txt');
    var moves=[
      {n:'모아 뛰기',  on:[7],     on2:[]},
      {n:'벌려 뛰기',  on:[6],     on2:[8]},
      {n:'앞뒤 뛰기',  on:[1],     on2:[7]},
      {n:'X 뛰기',     on:[6],     on2:[8], x:1},
      {n:'한발 뛰기',  on:[],      on2:[8]}
    ];
    var words=['1','2','3','4'];   // 단체 리듬은 카메라가 꺼져 있어 판정(PERFECT)이 없다 - 박자만 센다
    var i=0;
    function show(){
      var m=moves[i%moves.length];
      [].forEach.call(pads,function(p,k){ p.className=(m.on.indexOf(k)>=0?'on':'')+(m.on2.indexOf(k)>=0?' on2':''); });
      if(name) name.textContent=m.n;
      if(jt) jt.textContent=words[i%words.length];
      i++;
    }
    show();
    if(!reduce){ var timer=null; visibleLoop(st,function(t){ var s=Math.floor(t/1200); if(s!==timer){ timer=s; show(); } }); }
  });

  /* ---------- 6. TRIAL ---------- */
  var TR=null;
  var MP_URL='https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.0.1/vision_bundle.mjs';
  var MP_WASM='https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.0.1/wasm';
  var MP_MODEL='https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task';
  var landmarker=null;
  var CONN=[[11,12],[11,13],[13,15],[12,14],[14,16],[11,23],[12,24],[23,24],[23,25],[25,27],[24,26],[26,28],[27,31],[28,32],[27,29],[28,30]];
  var JOINTS=[0,11,12,13,14,15,16,23,24,25,26,27,28,31,32];

  function buildTrial(){
    var name=B.dataset.product||'NARUUN LABS';
    var next=B.dataset.trialNext||'실제 프로그램에서는 이 다음부터 동작을 세고 점수와 대결이 시작됩니다.';
    var el=document.createElement('div'); el.className='tr'; el.setAttribute('role','dialog'); el.setAttribute('aria-modal','true'); el.setAttribute('aria-label',name+' 체험');
    var C=(2*Math.PI*46).toFixed(1);
    el.innerHTML=
      '<div class="tr-top"><b>'+name+'<small>BROWSER TRIAL</small></b><button class="tr-x" type="button" aria-label="체험 닫기">✕</button></div>'+
      '<div class="tr-stage">'+
        '<video playsinline muted></video><canvas></canvas>'+
        '<div class="holo"><div class="tag">HAND SIGNAL</div><div class="ring"><svg viewBox="0 0 148 148">'+
          '<g class="spin"><circle cx="74" cy="74" r="68" fill="none" stroke="currentColor" stroke-opacity=".45" stroke-width="1" stroke-dasharray="2 7"/></g>'+
          '<circle cx="74" cy="74" r="56" fill="none" stroke="currentColor" stroke-opacity=".5" stroke-width="6" stroke-dasharray="1 4.86"/>'+
          '<circle cx="74" cy="74" r="46" fill="none" stroke="currentColor" stroke-opacity=".16" stroke-width="4"/>'+
          '<circle class="arc" cx="74" cy="74" r="46" fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-dasharray="'+C+'" stroke-dashoffset="'+C+'" transform="rotate(-90 74 74)"/>'+
        '</svg><div class="pct"><span>0</span><small>%</small></div></div><div class="main">그대로 유지</div></div>'+
        '<div class="start-flash">START!</div>'+
        '<div class="tr-guide" hidden></div>'+
        '<div class="tr-card" data-s="intro"><div class="in">'+
          '<span class="kicker">30초 체험</span><h3>손을 들면 수업이 시작됩니다</h3>'+
          '<p>AI가 카메라로 몸의 관절을 읽습니다. 2~3m 떨어져 몸 전체가 보이게 서 주세요.</p>'+
          '<p class="safe">영상은 저장하거나 전송하지 않고 이 기기 안에서만 처리합니다</p>'+
          '<div class="row"><button class="btn btn-main" data-a="go" type="button">카메라 켜기</button><button class="btn btn-line" data-a="close" type="button">다음에 할게요</button></div>'+
        '</div></div>'+
        '<div class="tr-card" data-s="load" hidden><div class="in"><div class="tr-spin"></div><p>AI 모델을 불러오는 중입니다…</p></div></div>'+
        '<div class="tr-card" data-s="done" hidden><div class="in">'+
          '<span class="kicker">READY</span><h3>인식 완료! 여기서부터가 진짜 수업입니다</h3><p>'+next+'</p>'+
          '<div class="row"><a class="btn btn-main js-kakao" href="#contact" data-a="talk">도입 상담하기</a><button class="btn btn-line" data-a="modes" type="button">수업 화면 보기</button><button class="btn btn-line" data-a="again" type="button">다시 해보기</button></div>'+
        '</div></div>'+
        '<div class="tr-card" data-s="fail" hidden><div class="in">'+
          '<h3>이 기기에서는 체험이 어려워요</h3><p class="why"></p>'+
          '<div class="row"><button class="btn btn-main" data-a="modes" type="button">수업 화면 보기</button><button class="btn btn-line" data-a="close" type="button">닫기</button></div>'+
        '</div></div>'+
      '</div>';
    document.body.appendChild(el);
    if(kakaoUrl){ var k=el.querySelector('.js-kakao'); k.href=kakaoUrl; k.target='_blank'; k.rel='noopener'; }
    var S={el:el, video:el.querySelector('video'), cv:el.querySelector('canvas'), holo:el.querySelector('.holo'),
      arc:el.querySelector('.arc'), pct:el.querySelector('.pct span'), flash:el.querySelector('.start-flash'),
      guide:el.querySelector('.tr-guide'), stream:null, raf:0, C:+C, busy:false};
    S.holo.style.color=cvar('--c2')||'#6ff2ff';
    el.addEventListener('click',function(e){
      var a=e.target.closest('[data-a]'); if(!a && e.target.closest('.tr-x')) a={dataset:{a:'close'}};
      if(!a) return;
      var act=a.dataset.a;
      if(act==='close') closeTrial();
      if(act==='go'||act==='again') startTrial();
      if(act==='modes'){ closeTrial(); var m=document.getElementById('modes'); if(m) m.scrollIntoView({behavior:reduce?'auto':'smooth'}); }
      if(act==='talk'){ track('trial_talk'); if(!kakaoUrl) closeTrial(); }
    });
    el.addEventListener('keydown',function(e){ if(e.key==='Escape') closeTrial(); });
    return S;
  }
  function card(s){ TR.el.querySelectorAll('.tr-card').forEach(function(c){ c.hidden=c.dataset.s!==s; }); }
  function fail(why){ stopCam(); TR.el.querySelector('.why').textContent=why; card('fail'); TR.guide.hidden=true; track('trial_fail',{why:why.slice(0,40)}); }
  function stopCam(){
    cancelAnimationFrame(TR.raf); TR.raf=0;
    if(TR.stream){ TR.stream.getTracks().forEach(function(t){ try{t.stop();}catch(e){} }); TR.stream=null; }
    TR.video.srcObject=null; TR.holo.classList.remove('on');
    var g=TR.cv.getContext('2d'); g.clearRect(0,0,TR.cv.width,TR.cv.height);
  }
  function openTrial(){
    if(!TR) TR=buildTrial();
    TR.el.classList.add('open'); document.documentElement.style.overflow='hidden';
    card('intro'); TR.guide.hidden=true;
    setTimeout(function(){ var b=TR.el.querySelector('[data-s="intro"] .btn-main'); if(b) b.focus(); },50);
    track('trial_open');
  }
  function closeTrial(){ if(!TR) return; stopCam(); TR.el.classList.remove('open'); document.documentElement.style.overflow=''; }

  function loadLandmarker(){
    if(landmarker) return Promise.resolve(landmarker);
    return import(MP_URL).then(function(mp){
      return mp.FilesetResolver.forVisionTasks(MP_WASM).then(function(fs){
        function make(dev){ return mp.PoseLandmarker.createFromOptions(fs,{baseOptions:{modelAssetPath:MP_MODEL,delegate:dev},runningMode:'VIDEO',numPoses:1}); }
        return make('GPU').catch(function(){ return make('CPU'); });
      });
    }).then(function(l){ landmarker=l; return l; });
  }

  function startTrial(){
    if(TR.busy) return; TR.busy=true;
    if(!navigator.mediaDevices||!navigator.mediaDevices.getUserMedia){ TR.busy=false; fail('이 브라우저는 카메라를 지원하지 않습니다. 크롬이나 사파리 최신 버전에서 열어 주세요.'); return; }
    card('load'); track('trial_start');
    var camP=navigator.mediaDevices.getUserMedia({video:{facingMode:'user',width:{ideal:960},height:{ideal:540}},audio:false});
    Promise.all([camP.then(function(s){ TR.stream=s; TR.video.srcObject=s; return TR.video.play(); }), loadLandmarker()])
      .then(function(){ TR.busy=false; card(''); runLoop(); })
      .catch(function(err){
        TR.busy=false;
        var n=err&&err.name;
        if(n==='NotAllowedError'||n==='SecurityError') fail('카메라 사용이 허용되지 않았습니다. 주소창의 카메라 권한을 허용한 뒤 다시 시도해 주세요.');
        else if(n==='NotFoundError'||n==='OverconstrainedError') fail('사용할 수 있는 카메라를 찾지 못했습니다.');
        else fail('AI 모델을 불러오지 못했습니다. 인터넷 연결을 확인하거나 수업 영상을 먼저 봐 주세요.');
      });
  }

  function runLoop(){
    var v=TR.video, cv=TR.cv, g=cv.getContext('2d');
    var col=cvar('--c2')||'#6ff2ff', col1=cvar('--c')||'#fff';
    var lastT=-1, prog=0, prevNow=performance.now(), started=false, seen=0, frames=0, t0=performance.now(), noBody=0;
    TR.guide.hidden=false; setGuide('손을 머리 위로 들어 보세요','몸 전체가 화면에 보이면 관절 점이 나타납니다');
    function setGuide(a,b){ TR.guide.innerHTML=a+(b?'<small>'+b+'</small>':''); }
    function loop(){
      TR.raf=requestAnimationFrame(loop);
      var now=performance.now(), dt=Math.min(100,now-prevNow); prevNow=now;
      if(v.readyState<2 || v.currentTime===lastT) return;
      lastT=v.currentTime;
      if(cv.width!==v.videoWidth){ cv.width=v.videoWidth; cv.height=v.videoHeight; }
      var res; try{ res=landmarker.detectForVideo(v,now); }catch(e){ return; }
      frames++;
      if(now-t0>4500 && frames/((now-t0)/1000)<5){ fail('이 기기에서는 인식 속도가 너무 느립니다. 권장 사양 기기에서 실제 프로그램을 써 보시길 권해 드립니다.'); return; }
      g.clearRect(0,0,cv.width,cv.height);
      var lm=res&&res.landmarks&&res.landmarks[0];
      if(!lm){ noBody+=dt; if(noBody>2500) setGuide('몸이 보이지 않아요','카메라에서 조금 더 뒤로 물러나 주세요'); decay(dt); return; }
      noBody=0; seen++;
      drawSkeleton(g,lm,cv.width,cv.height,col,col1);
      if(started) return;
      var up=handUp(lm);
      if(up){ prog=Math.min(1,prog+dt/1200); } else decay(dt);
      TR.holo.classList.toggle('on',prog>0);
      TR.arc.setAttribute('stroke-dashoffset',(TR.C*(1-prog)).toFixed(1));
      TR.pct.textContent=Math.round(prog*100);
      if(seen>8 && !up && prog===0) setGuide('손을 머리 위로 들어 보세요','한 손이면 충분해요');
      if(up) setGuide('좋아요! 그대로 유지','');
      if(prog>=1){
        started=true; TR.holo.classList.remove('on'); TR.guide.hidden=true;
        TR.flash.classList.remove('go'); void TR.flash.offsetWidth; TR.flash.classList.add('go');
        track('trial_done');
        setTimeout(function(){ stopCam(); card('done'); },1500);
      }
    }
    function decay(dt){ prog=Math.max(0,prog-dt/600); TR.holo.classList.toggle('on',prog>0); TR.arc.setAttribute('stroke-dashoffset',(TR.C*(1-prog)).toFixed(1)); TR.pct.textContent=Math.round(prog*100); }
    loop();
  }
  function vis(p){ return p && (p.visibility==null || p.visibility>.5); }
  function handUp(lm){
    var nose=lm[0], ls=lm[11], rs=lm[12];
    if(!vis(nose)||!vis(ls)||!vis(rs)) return false;
    var head=Math.abs(ls.x-rs.x)*0.5;
    return [15,16].some(function(w){ return vis(lm[w]) && lm[w].y < nose.y-head*0.6; });
  }
  function drawSkeleton(g,lm,W,H,col,col1){
    var lw=Math.max(3,W/220);
    g.lineCap='round'; g.shadowColor=col; g.shadowBlur=18;
    g.strokeStyle=col; g.globalAlpha=.7; g.lineWidth=lw;
    CONN.forEach(function(c){ var a=lm[c[0]], b=lm[c[1]]; if(!vis(a)||!vis(b)) return; g.beginPath(); g.moveTo(a.x*W,a.y*H); g.lineTo(b.x*W,b.y*H); g.stroke(); });
    g.globalAlpha=1;
    JOINTS.forEach(function(i){ var p=lm[i]; if(!vis(p)) return;
      g.fillStyle=(i===15||i===16)?'#fff':col;
      g.beginPath(); g.arc(p.x*W,p.y*H,i===0?lw*2.4:lw*1.35,0,6.283);
      if(i===0){ g.lineWidth=lw; g.strokeStyle=col; g.stroke(); } else g.fill(); });
    g.shadowBlur=0;
  }
  document.addEventListener('click',function(e){
    var t=e.target.closest('[data-trial]'); if(!t) return; e.preventDefault(); openTrial();
  });
})();
