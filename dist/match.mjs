import { npcAvatar } from './avatar.mjs';
import { Likolo, RULES, clamp, length } from './core.mjs';
const dir=(x,y)=>{const n=Math.hypot(x,y)||1;return{x:x/n,y:y/n};};
export const MODES={solo:{count:1,centers:1},duel:{count:2,centers:1},trio:{count:3,centers:1},coop:{count:2,centers:2}};
export class Match {
 constructor(kind='solo',difficulty='discovery',rotate=true){
  this.avatars=[];this.kind=MODES[kind]?kind:'solo';this.mode=difficulty==='challenge'?'challenge':'discovery';this.rotate=!!rotate;this.round=1;this.time=0;this.events=[];this.eventId=0;this.result=null;this.status='ready';
  this.roles=this.kind==='coop'?['c0','c1']:this.kind==='trio'?['c0','t0','t1']:this.kind==='duel'?['c0','t0']:['c0'];this.newRound();this.status='ready';
 }
 static restore(data){const m=Object.assign(Object.create(Match.prototype),data);m.centers=m.centers.map(c=>Object.assign(new Likolo(),c));return m;}
 newRound(){this.centers=Array.from({length:MODES[this.kind].centers},(_,i)=>{const c=new Likolo();c.start(this.mode);c.player.y=358+i*52;c.ball={state:'external'};return c;});this.throwers=[{x:75,y:340,catchUntil:-1,catchReady:0,chargeStart:null},{x:925,y:340,catchUntil:-1,catchReady:0,chargeStart:null}];this.bottle=this.centers[0].bottle;this.fill=0;this.phase='fill';this.ball={state:'aiming',owner:0,timer:2.25,x:75,y:340,height:1.75};this.status='playing';this.result=null;this.roundTime=0;this.inputs={};}
 emit(type,detail={}){this.events.push({id:++this.eventId,type,...detail});if(this.events.length>35)this.events.shift();}
 role(seat){return this.roles[seat]??null;}
 human(role){return this.roles.includes(role);}
 actor(seat){const role=this.role(seat);return role?.[0]==='t'?this.throwers[+role[1]]:this.centers[+(role?.[1]??0)]?.player;}
 heldBy(role){return this.ball.state==='held'&&this.ball.holder===role;}
 command(seat,action,aim={x:0,y:-1},height=.9){
  if(this.status!=='playing')return;const role=this.role(seat);if(!role)return;
  const isCenter=role[0]==='c',index=+role[1],c=this.centers[index],p=isCenter?c.player:this.throwers[index],b=this.ball;
  if(action==='catch'){
   if(this.heldBy(role)||(role===`t${b.owner}`&&b.state==='aiming')){if(p.chargeStart==null)p.chargeStart=this.time;return;}
   if(isCenter){c.ball={state:'external'};c.catchOrCharge();}else if(this.time>=p.catchReady){p.catchUntil=this.time+.48;p.catchReady=this.time+.85;this.emit('reach');}
  }
  if(action==='release'&&p.chargeStart!=null&&(this.heldBy(role)||(role===`t${b.owner}`&&b.state==='aiming'))){
   const power=clamp((this.time-p.chargeStart)/1.1,.12,1);p.chargeStart=null;
   if(isCenter){c.cancelAction();const d=dir(aim.x,aim.y);this.ball={state:'returning',owner:b.lastOwner??0,x:p.x,y:p.y,height:1.55,from:{x:p.x,y:p.y},end:{x:clamp(p.x+d.x*(180+power*650),30,970),y:clamp(p.y+d.y*(180+power*650),70,610)},age:0,duration:.5+power*.4,power};this.emit('throw');}
   else this.fire(index,aim,power,height);
  }
  if(!isCenter)return;
  c.ball={state:this.heldBy(role)?'held':'external'};
  if(action==='jump')c.jump();if(action==='prone')c.toggleProne();
  if(action==='gather')c.beginGather();if(action==='pour')c.beginPour();if(action==='right')c.beginRightBottle();
  for(const e of c.events)this.emit(e);c.events=[];
 }
 fire(owner,aim,power=.5,height=.9){const p=this.throwers[owner],d=dir(aim.x,aim.y),speed=260+power*460;
  this.ball={state:'flying',owner,x:p.x,y:p.y,vx:d.x*speed,vy:d.y*speed,age:0,height:1.75,targetHeight:clamp(height,.25,2.2),flightTime:.65,tempo:power>.7?'rapide':power<.3?'lent':'normal',style:height<.65?'bas':height>1.5?'haut':'tendu'};this.emit('shot');
 }
 inDefensiveLane(owner,x,y){return x>=(owner===0?30:864)&&x<=(owner===0?136:970)&&y>=70&&y<=610;}
 aiSpeed(kind){return ({intercept:390,fetch:225,reposition:255}[kind])*(this.mode==='challenge'?1.14:1);}
 moveAI(owner,target,speed,dt){const p=this.throwers[owner],d=length(target.x-p.x,target.y-p.y);if(d>.5){const step=Math.min(d,speed*dt);p.x+=(target.x-p.x)/d*step;p.y+=(target.y-p.y)/d*step;}}
 home(owner){return {x:owner===0?75:925,y:clamp(this.centers[0].player.y+(owner===0?-22:22),218,462)};}
 forecast(b,ahead){
  if(b.state==='returning'){const t=(b.age+ahead)/b.duration;if(t>=1)return null;return {x:b.from.x+(b.end.x-b.from.x)*t,y:b.from.y+(b.end.y-b.from.y)*t,height:.2+Math.sin(t*Math.PI)*3};}
  if(b.state==='flying'){const age=b.age+ahead;return {x:b.x+b.vx*ahead,y:b.y+b.vy*ahead,height:1.75+(b.targetHeight-1.75)*clamp(age/(b.flightTime||1),0,1)};}
  return null;
 }
 interceptionPoint(owner,b){
  const p=this.throwers[owner],speed=this.aiSpeed('intercept');let best=null,bestEffort=Infinity;
  for(let ahead=0;ahead<=1.6;ahead+=.025){
   const f=this.forecast(b,ahead);if(!f)break;
   if((b.age+ahead)<.1||f.height<.25||f.height>2.85||!this.inDefensiveLane(owner,f.x,f.y))continue;
   const distance=length(f.x-p.x,f.y-p.y);
   if(distance<=speed*ahead+30)return f;
   const effort=Math.max(0,distance-30)/(ahead+.04);if(effort<bestEffort){bestEffort=effort;best=f;}
  }return best;
 }
 moveDefenders(dt){
  const b=this.ball;
  for(let i=0;i<2;i++){
   if(this.human(`t${i}`))continue;const p=this.throwers[i];p.intercepting=false;
   if((b.state==='returning'||b.state==='flying')&&!(b.state==='flying'&&b.owner===i)){
    const target=this.interceptionPoint(i,b);
    if(target){p.intercepting=true;this.moveAI(i,target,this.aiSpeed('intercept'),dt);if(length(b.x-p.x,b.y-p.y)<95)p.catchUntil=this.time+.16;}
    else this.moveAI(i,this.home(i),this.aiSpeed('reposition')*.65,dt);
   }else if(b.state==='loose'){
    if(b.fetcher===i)this.moveAI(i,b,this.aiSpeed('fetch'),dt);else this.moveAI(i,this.home(i),this.aiSpeed('reposition'),dt);
   }else if(!(['aiming','returnToPost'].includes(b.state)&&b.owner===i))this.moveAI(i,this.home(i),this.aiSpeed('reposition'),dt);
  }
 }
 throwerCanCatch(owner,b){
  const p=this.throwers[owner],human=this.human(`t${owner}`);
  return (human?p.catchUntil>=this.time:p.intercepting&&(b.age??0)>=.1&&this.inDefensiveLane(owner,b.x,b.y))&&length(b.x-p.x,b.y-p.y)<(human?42:32)&&b.height>=(human?0:.25)&&b.height<2.85;
 }
 catchByThrower(owner){
  const p=this.throwers[owner],human=this.human(`t${owner}`);p.intercepting=false;p.catchUntil=this.time+.25;
  this.ball={state:human?'aiming':'returnToPost',owner,timer:RULES[this.mode].preparation,settle:0,x:p.x,y:p.y,height:1.6};this.emit('catch',{thrower:owner});
 }
 chooseFetcher(b){if(b.fetcher!=null)return;const candidates=[0,1].filter(i=>!this.human(`t${i}`));if(candidates.length)b.fetcher=candidates.reduce((a,i)=>length(b.x-this.throwers[i].x,b.y-this.throwers[i].y)<length(b.x-this.throwers[a].x,b.y-this.throwers[a].y)?i:a);}
 update(dt,inputs={}){
  dt=clamp(dt,0,.035);if(!dt||this.status!=='playing')return;this.time+=dt;this.roundTime+=dt;
  for(let i=0;i<this.centers.length;i++){
   const c=this.centers[i],seat=this.roles.indexOf(`c${i}`);c.bottle=this.bottle;c.fill=this.fill;c.phase=this.phase;c.ball={state:this.heldBy(`c${i}`)?'held':'external'};
   c.update(dt,inputs[seat]??{});this.fill=c.fill;this.phase=c.phase;
   for(const e of c.events)this.emit(e);c.events=[];
   if(c.status==='won'){this.end('won',i);return;}
  }
  for(let i=0;i<2;i++)if(this.human(`t${i}`)){
   const seat=this.roles.indexOf(`t${i}`),a=inputs[seat]??{},p=this.throwers[i],d=dir(a.x||0,a.y||0),n=Math.min(1,Math.hypot(a.x||0,a.y||0));
   p.x=clamp(p.x+d.x*n*280*dt,30,970);p.y=clamp(p.y+d.y*n*280*dt,70,610);
  }
  if(this.ball.state==='loose')this.chooseFetcher(this.ball);this.moveDefenders(dt);
  const b=this.ball,r=RULES[this.mode];
  if(b.state==='aiming'){
   const p=this.throwers[b.owner];b.x=p.x;b.y=p.y;
   if(!this.human(`t${b.owner}`)){
    const c=this.centers[Math.floor(this.roundTime/3)%this.centers.length];
    b.timer-=dt;
    if(!b.quick&&c.catches>=2&&(this.shots??0)%3===2&&!b.feinted&&b.timer<=1){b.feinted=true;b.feintUntil=this.time+.38;b.timer+=.38;c.stats.feints++;this.emit('feint');}
    if(b.timer<.6&&!b.target){c.stats.shots=this.shots??0;const plan=c.chooseShot();b.plan=plan;b.target={x:c.player.x+c.player.vx*.35,y:c.player.y+c.player.vy*.35};this.emit('prepare');}
    if(b.timer<=0){const plan=b.plan;this.fire(b.owner,{x:b.target.x-p.x,y:b.target.y-p.y},plan.tempo==='rapide'?.9:plan.tempo==='lent'?.12:.5,plan.targetHeight);this.shots=(this.shots??0)+1;}
   }
  }else if(b.state==='returnToPost'){
   const p=this.throwers[b.owner],target={x:b.owner===0?Math.min(p.x,136):Math.max(p.x,864),y:p.y};
   if((b.settle??0)>0)b.settle-=dt;
   else if(length(target.x-p.x,target.y-p.y)>3)this.moveAI(b.owner,target,this.aiSpeed('reposition'),dt);
   else {p.x=target.x;p.y=target.y;this.ball={state:'aiming',owner:b.owner,timer:this.mode==='challenge'?.26:.34,quick:true,x:p.x,y:p.y,height:1.75};}
   b.x=p.x;b.y=p.y;b.height=1.6;
  }else if(b.state==='held'){
   const p=b.holder[0]==='c'?this.centers[+b.holder[1]].player:this.throwers[+b.holder[1]];b.x=p.x;b.y=p.y;b.height=(p.height||0)+1.55;
  }else if(b.state==='flying'){
   b.x+=b.vx*dt;b.y+=b.vy*dt;b.age+=dt;b.height=1.75+(b.targetHeight-1.75)*clamp(b.age/b.flightTime,0,1);
   if(!b.bottleHit&&b.height<.65&&length(b.x-500,b.y-340)<13){b.bottleHit=true;this.centers[0].toppleBottle();this.emit('bottleHit');}
   for(let i=0;i<this.centers.length;i++){
    const c=this.centers[i],p=c.player,d=length(b.x-p.x,b.y-p.y);
    if(c.time<=c.catchUntil&&!p.prone&&d<=r.catchRadius&&b.height>=p.height+.08&&b.height<=p.height+2.9){c.cancelAction();c.catches++;c.catchUntil=-1;this.ball={state:'held',holder:`c${i}`,lastOwner:b.owner,x:p.x,y:p.y,height:p.height+1.55};this.emit('catch');break;}
    if(d<=21&&b.height>=p.height+.12&&b.height<=p.height+(p.prone?.48:2.35)){c.cancelAction();this.end('lost',i,b.owner);return;}
   }
   for(let i=0;i<2;i++)if(this.ball===b&&i!==b.owner&&this.throwerCanCatch(i,b))this.catchByThrower(i);
   if(this.ball===b&&(b.x<30||b.x>970||b.y<70||b.y>610||b.age>3.3))this.ball={state:'loose',owner:1-b.owner,x:clamp(b.x,30,970),y:clamp(b.y,70,610),height:.2};
  }else if(b.state==='returning'){
   b.age+=dt;const t=clamp(b.age/b.duration,0,1);b.x=b.from.x+(b.end.x-b.from.x)*t;b.y=b.from.y+(b.end.y-b.from.y)*t;b.height=.2+Math.sin(t*Math.PI)*3;
   for(let i=0;i<2;i++)if(this.ball===b&&this.throwerCanCatch(i,b))this.catchByThrower(i);
   if(this.ball===b&&t===1)this.ball={state:'loose',owner:b.owner,x:b.end.x,y:b.end.y,height:.2};
  }
  if(this.ball.state==='loose'){
   const ball=this.ball;this.chooseFetcher(ball);
   for(let i=0;i<2;i++){
    const p=this.throwers[i],human=this.human(`t${i}`);
    if((human||ball.fetcher===i)&&length(ball.x-p.x,ball.y-p.y)<25){this.ball={state:human?'aiming':'returnToPost',owner:i,timer:r.preparation,x:p.x,y:p.y,height:1.6};this.emit('retrieve',{thrower:i});break;}
   }
  }
 }
 end(status,center,thrower=0){this.status=status;this.result={status,center,thrower,round:this.round};this.emit(status==='lost'?'lose':'win');}
 nextRound(){if(this.result&&this.rotate&&this.kind!=='coop'&&this.kind!=='solo'&&this.result.status==='lost'){
  const c=this.roles.indexOf(`c${this.result.center}`);let t=this.roles.indexOf(`t${this.result.thrower}`);if(t<0)t=this.roles.findIndex(r=>r[0]==='t');if(c>=0&&t>=0)[this.roles[c],this.roles[t]]=[this.roles[t],this.roles[c]];
 }this.round++;this.newRound();}
 view(seat=0){const role=this.role(seat)??'c0',c=this.centers[role[0]==='c'?+role[1]:0];const g=Object.assign(new Likolo(),c);g.status=this.status;g.time=this.roundTime;g.throwers=this.throwers;g.bottle=this.bottle;g.fill=this.fill;g.phase=this.phase;g.ball=this.ball;g.centers=this.centers.map(c=>c.player);g.centerStates=this.centers;g.role=role;g.localActor=this.actor(seat);g.round=this.round;g.simulationTime=this.time;g.events=[];g.appearances=Object.fromEntries(this.roles.map((role,i)=>[role,this.avatars?.[i]]));for(const [i,role]of ['t0','t1','c0','c1'].entries())if(!this.human(role))g.appearances[role]=npcAvatar(i,this.avatars??[]);g.chargeStart=g.localActor?.chargeStart??null;g.charge=()=>g.chargeStart==null?0:clamp((this.time-g.chargeStart)/1.1,0,1);return g;}
}
