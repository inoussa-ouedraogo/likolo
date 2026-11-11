export const bottleHudMarkup=`<svg class="hud-bottle" viewBox="0 0 100 128" aria-hidden="true">
<defs><linearGradient id="hud-glass" x1="0" x2="1"><stop stop-color="#d4fcff" stop-opacity=".83"/><stop offset=".24" stop-color="#86d3e4" stop-opacity=".18"/><stop offset=".62" stop-color="#edffff" stop-opacity=".44"/><stop offset="1" stop-color="#3d8fa7" stop-opacity=".8"/></linearGradient><linearGradient id="hud-sand" x1="0" y1="0" x2="0" y2="1"><stop stop-color="#ffe5a0"/><stop offset="1" stop-color="#c58745"/></linearGradient><clipPath id="hud-bottle-clip"><path d="M44 12h12v20q0 5 7 12 7 7 7 16v39q0 10-20 10t-20-10V60q0-9 7-16t7-12z"/></clipPath></defs>
<ellipse class="hud-bottle-shadow" cx="50" cy="115" rx="28" ry="5" fill="#000" opacity=".23"/>
<g class="hud-bottle-pose"><path d="M43 12h14v20q0 5 7 12 8 8 8 16v39q0 12-22 12t-22-12V60q0-8 8-16t7-12z" fill="url(#hud-glass)" stroke="#bceff6" stroke-width="2"/>
<g clip-path="url(#hud-bottle-clip)"><rect id="hud-bottle-sand" x="28" y="109" width="44" height="0" fill="url(#hud-sand)"/><path d="m35 96 5-2m16 5 3 1m-16-9 3 1m15-8 3 1m-23-5 2-1m11-8 2 1m-11-9h3m8-8 2 1m-16-7h3" stroke="#fff1b5" stroke-width="1.5" stroke-linecap="round" opacity=".55"/><path d="M36 57v39q0 6 7 7" stroke="#fff" stroke-width="4" opacity=".43" fill="none"/><path d="M65 59v39" stroke="#0b405e" stroke-width="2" opacity=".25"/></g>
<path d="M44 16h12M44 29h12M35 52q15 5 30 0M32 102q18 8 36 0" fill="none" stroke="#e5feff" stroke-width="1.3" opacity=".6"/><ellipse cx="50" cy="11" rx="8.5" ry="3.2" fill="#1e4b63" stroke="#e1fbff" stroke-width="1.8"/><ellipse cx="50" cy="11" rx="4" ry="1" fill="#a6d9df"/>
<path class="hud-sand-stream" d="M50-7v34" fill="none" stroke="#ffe3a3" stroke-width="3" stroke-dasharray="2 5" stroke-linecap="round"/>
</g></svg><span class="bottle-hud-phase" aria-hidden="true">↑</span><span class="bottle-hud-warning" aria-hidden="true">!</span><b id="hud-bottle-percent">0<span>%</span></b>`;
const limit=v=>Math.max(0,Math.min(1,Number.isFinite(v)?v:0));
export function bottleVisualState(game){
 const states=game.centerStates??[game],actions=states.map(c=>c.action).filter(Boolean),progress=a=>limit(a.elapsed/a.duration),fallen=!game.bottle.upright;
 const pouring=actions.some(a=>a.kind==='pour')&&!fallen,emptying=actions.some(a=>a.kind==='empty')&&!fallen,right=actions.find(a=>a.kind==='right');
 const fill=limit(game.fill+actions.filter(a=>a.kind==='pour').reduce((n,a)=>n+.1*progress(a),0));
 const angle=right?86*(1-progress(right)):fallen?86:emptying?-42:0;
 return {fill,percent:Math.round(fill*100),angle,fallen,pouring,emptying,righting:!!right,phase:game.phase,label:`Bouteille ${fallen?'renversée':'debout'}, ${Math.round(fill*100)} %, ${game.phase==='empty'?'à vider':'à remplir'}`};
}
export class BottleHud {
 constructor(element){this.element=element;element.innerHTML=bottleHudMarkup;this.sand=element.querySelector('#hud-bottle-sand');this.percent=element.querySelector('#hud-bottle-percent');this.arrow=element.querySelector('.bottle-hud-phase');this.key='';}
 update(game){const s=bottleVisualState(game),key=[s.percent,s.angle,s.fallen,s.pouring,s.emptying,s.righting,s.phase].join('/');if(key===this.key)return;this.key=key;
  this.sand.setAttribute('y',String(109-s.fill*79));this.sand.setAttribute('height',String(s.fill*79));this.percent.innerHTML=s.percent+'<span>%</span>';this.arrow.textContent=s.phase==='empty'?'↓':'↑';
  this.element.style.setProperty('--bottle-tilt',s.angle+'deg');this.element.setAttribute('aria-label',s.label);this.element.classList.toggle('fallen',s.fallen);this.element.classList.toggle('pouring',s.pouring);this.element.classList.toggle('emptying',s.emptying);this.element.classList.toggle('righting',s.righting);
 }
}
