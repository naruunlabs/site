/* No analytics, customer names, tokens in storage, or third-party assets. */
(() => {
  const api='https://ebgoolsymyzkftvavpyj.supabase.co/functions/v1/clever-worker';
  const token=new URLSearchParams(location.search).get('t')||'';
  // Remove the bearer link from the address bar before any subsequent navigation.
  if(location.search) history.replaceState(null,'',location.pathname);
  const notice=document.getElementById('notice'),form=document.getElementById('survey');
  const questions=[
    ['usage','제품을 얼마나 사용해 보셨나요?',false,[['enough','충분히 사용해 봤습니다.'],['few','1~2회 정도 사용했습니다.'],['installed','설치만 하고 제대로 사용하지 못했습니다.'],['trouble','설치 또는 실행에 어려움이 있었습니다.']]],
    ['reasons','정식 구매를 결정하실 때 고려하시는 점은 무엇인가요? (복수 선택)',true,[['price','가격이 부담스러워서'],['accuracy','인식 정확도가 아쉬워서'],['ease','설치 및 사용 방법이 어려워서'],['time','충분히 체험하지 못해서'],['class','도장 수업에 활용할 방법을 찾지 못해서'],['no_plan','현재 구매 계획이 없어서'],['other','기타']]],
    ['improvement','가장 개선되었으면 하는 부분은 무엇인가요?',false,[['accuracy','인식 정확도'],['content','게임 및 훈련 콘텐츠'],['ease','설치 및 조작 편의성'],['design','화면 구성 및 디자인'],['none','특별히 개선할 부분 없음'],['unknown','충분히 사용하지 못해 아직 판단하기 어려움'],['other','기타']]],
    ['intent','향후 정식 구매 의향이 있으신가요?',false,[['consider','정식 구매를 고려하고 있습니다.'],['extra_trial','추가 체험 후 결정하고 싶습니다.'],['improved','제품이 개선되면 다시 고려하겠습니다.'],['no_plan','현재 구매 계획이 없습니다.']]]
  ];
  async function call(action,payload){
    const ac=new AbortController(),timer=setTimeout(()=>ac.abort(),15000);
    try{const r=await fetch(api,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action,payload}),signal:ac.signal,cache:'no-store',credentials:'omit',referrerPolicy:'no-referrer'});const d=await r.json();if(!r.ok)throw Error(d.error||'요청을 처리하지 못했습니다.');return d;}finally{clearTimeout(timer);}
  }
  function done(){form.hidden=true;notice.hidden=false;notice.textContent='소중한 의견 감사합니다! 관장님의 경험을 제품 개선에 참고하겠습니다.';notice.focus();}
  form.addEventListener('submit',async e=>{
    e.preventDefault();const status=document.getElementById('status'),button=document.getElementById('submit');
    const f=new FormData(form),reasons=f.getAll('reasons');
    if(!reasons.length){status.textContent='두 번째 문항에서 한 가지 이상 선택해 주세요.';return;}
    status.textContent='';button.disabled=true;button.textContent='보내는 중…';
    try{await call('FEEDBACK_SUBMIT',{token,usage:f.get('usage'),reasons,improvement:f.get('improvement'),intent:f.get('intent'),comment:document.getElementById('comment').value,consent_version:document.getElementById('consent').checked?'feedback-v1':null});done();}
    catch(err){status.textContent=(err.name==='AbortError'?'연결이 지연되고 있습니다.':err.message)+' 입력한 내용은 유지되어 있습니다. 다시 시도해 주세요.';}
    finally{button.disabled=false;button.textContent='체험 후기 보내기';}
  });
  async function init(){
    if(!token){notice.textContent='안내받으신 고객별 설문 링크로 접속해 주세요. 링크가 없으면 나른랩스에 문의해 주세요.';return;}
    try{const d=await call('FEEDBACK_OPEN',{token});if(d.submitted){done();return;}if(d.survey_version!=='v1')throw Error('설문 버전을 확인할 수 없습니다. 나른랩스에 문의해 주세요.');
      document.getElementById('intro').textContent=d.product_name+' 체험은 어떠셨나요? 짧은 의견이 제품 개선에 도움이 됩니다.';
      const root=document.getElementById('questions');for(const [name,title,multi,options]of questions){const field=document.createElement('fieldset'),legend=document.createElement('legend');legend.textContent=title;field.append(legend);for(const [value,label]of options){const wrap=document.createElement('label');wrap.className='option';const input=document.createElement('input');input.type=multi?'checkbox':'radio';input.name=name;input.value=value;input.required=!multi;wrap.append(input,document.createTextNode(label));field.append(wrap);}root.append(field);}notice.hidden=true;form.hidden=false;
    }catch(err){notice.textContent=(err.name==='AbortError'?'연결이 지연되고 있습니다. 안내받은 원래 설문 링크를 다시 열어 주세요.':err.message);}
  }
  init();
})();
