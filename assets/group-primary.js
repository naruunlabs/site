(function(){
  window.NLGroupPrimary={mount:function(button,host){
    if(!button)return null;
    document.body.appendChild(button);button.classList.add('group-primary');
    function theme(){try{
      const source=host&&host.document.getElementById('startBtn');if(!source)return;
      const style=host.getComputedStyle(source),root=document.documentElement.style;
      for(const pair of [['font-family','family'],['font-size','size'],['font-weight','weight'],['letter-spacing','spacing']])root.setProperty('--group-start-'+pair[1],style.getPropertyValue(pair[0]));
      const green=host.getComputedStyle(host.document.documentElement).getPropertyValue('--arcade-green').trim();root.setProperty('--group-start-color',green||style.color);
      const area=host.document.getElementById('drillCountArea');if(area){const x=area.getBoundingClientRect().left;if(x>=8&&x<100)root.setProperty('--group-start-left',x+'px');}
    }catch(e){}}
    theme();window.addEventListener('resize',theme);
    return {setRunning:function(on){button.disabled=false;button.classList.toggle('is-stop',!!on);button.textContent=on?'■ 중지':'▶ 시작!';button.setAttribute('aria-pressed',String(!!on));},refresh:theme};
  }};
})();
