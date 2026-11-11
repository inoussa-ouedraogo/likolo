import test from 'node:test';import assert from 'node:assert/strict';import { Match } from '../dist/match.mjs';
const start=(kind='solo')=>{const m=new Match(kind);m.status='playing';return m;};
const run=(m,t)=>{for(let i=0;i<Math.ceil(t/.01);i++)m.update(.01);};
const until=(m,predicate,limit=20)=>{for(let i=0;i<limit*100&&!predicate();i++)m.update(.01);assert.ok(predicate());};
function returning(m,end,duration=1){m.ball={state:'returning',owner:0,from:{x:500,y:358},end,x:500,y:358,height:1.55,age:0,duration};}
test('an AI moves onto the incoming path before landing, catches in the air and never teleports',()=>{
 const m=start();returning(m,{x:970,y:470},1.2);const before={...m.throwers[1]};run(m,.15);const p=m.throwers[1];assert.ok(Math.hypot(p.x-before.x,p.y-before.y)>5);assert.ok(Math.hypot(p.x-before.x,p.y-before.y)<=390*.16);assert.ok(p.x>=864&&p.x<=970);assert.equal(m.ball.state,'returning');
 until(m,()=>m.events.some(e=>e.type==='catch'&&e.thrower===1),1.2);assert.ok(m.roundTime<1.2);assert.equal(m.ball.owner,1);assert.equal(m.ball.state,'returnToPost');assert.equal(m.events.some(e=>e.type==='retrieve'),false);
});
test('a short return outside both lanes lands first, then only the nearest AI fetches and returns to its post',()=>{
 const m=start();returning(m,{x:500,y:70},.65);run(m,.6);assert.equal(m.ball.state,'returning');assert.equal(m.throwers[0].x,75);assert.equal(m.throwers[1].x,925);assert.equal(m.events.some(e=>e.type==='catch'),false);
 until(m,()=>m.ball.state==='loose',.1);const fetcher=m.ball.fetcher,other=1-fetcher;const before=m.throwers[fetcher].x;run(m,.15);assert.notEqual(m.throwers[fetcher].x,before);assert.equal(m.throwers[other].x,other===0?75:925);
 until(m,()=>m.ball.state==='returnToPost');assert.equal(m.ball.owner,fetcher);assert.ok(m.events.some(e=>e.type==='retrieve'&&e.thrower===fetcher));until(m,()=>m.ball.state==='aiming');assert.ok(fetcher===0?m.throwers[fetcher].x<=139:m.throwers[fetcher].x>=861);
});
test('AI receives a throw passing the center before the ball exits the court',()=>{
 const m=start();m.throwers[1].y=440;m.ball={state:'flying',owner:0,x:650,y:340,vx:440,vy:0,height:1.2,targetHeight:1.2,flightTime:.4,age:1};
 until(m,()=>m.events.some(e=>e.type==='catch'&&e.thrower===1),1);assert.equal(m.ball.owner,1);assert.notEqual(m.ball.state,'loose');assert.equal(m.events.some(e=>e.type==='retrieve'),false);
});
test('an AI cannot catch an airborne return above its reach',()=>{
 const m=start();returning(m,{x:970,y:358},1);m.throwers[1].x=770;m.throwers[1].y=358;m.ball.age=.5;m.ball.x=735;m.ball.y=358;m.ball.height=3.2;m.throwers[1].intercepting=true;
 assert.equal(m.throwerCanCatch(1,m.ball),false);run(m,.025);assert.equal(m.events.some(e=>e.type==='catch'),false);
});
test('defensive automation never moves a human thrower or catches on their behalf',()=>{
 const m=start('duel');returning(m,{x:30,y:358},1.2);run(m,.8);assert.equal(m.throwers[0].x,75);assert.equal(m.throwers[0].y,340);assert.equal(m.events.some(e=>e.type==='catch'&&e.thrower===0),false);
});
test('restoring a network snapshot keeps interception decisions executable',()=>{
 const m=start();returning(m,{x:970,y:470},1.2);run(m,.2);const copy=Match.restore(JSON.parse(JSON.stringify(m)));until(copy,()=>copy.events.some(e=>e.type==='catch'),1.2);assert.equal(copy.ball.owner,1);
});

test('a catch behind the line starts aiming in place without returning to the marker',()=>{
 for(const owner of [0,1]){const m=start();const p=m.throwers[owner];p.x=owner===0?105:895;p.y=485;m.catchByThrower(owner);until(m,()=>m.ball.state==='aiming',.3);assert.equal(p.x,owner===0?105:895);assert.equal(p.y,485);}
});
test('a fetch inside the court retreats only to the line, keeping its lateral position',()=>{
 for(const owner of [0,1]){const m=start();const p=m.throwers[owner];p.x=owner===0?350:650;p.y=490;m.catchByThrower(owner);until(m,()=>m.ball.state==='aiming',2);assert.ok(Math.abs(p.x-(owner===0?136:864))<=3);assert.equal(p.y,490);}
});

test('both AI stay behind their throwing line for the entire airborne return',()=>{
 for(const end of [{x:850,y:470},{x:150,y:470},{x:970,y:470},{x:30,y:470}]){
  const m=start();returning(m,end,1.2);
  for(let i=0;i<120&&m.ball.state==='returning';i++){
   m.update(.01);assert.ok(m.throwers[0].x<=136);assert.ok(m.throwers[1].x>=864);
   for(const e of m.events.filter(e=>e.type==='catch'&&e.thrower!=null))assert.ok(m.inDefensiveLane(e.thrower,m.throwers[e.thrower].x,m.throwers[e.thrower].y));
  }
 }
});
test('AI only crosses its line after an unreachable return has stopped',()=>{
 const m=start();returning(m,{x:800,y:470},1.2);
 until(m,()=>m.ball.state==='loose',1.3);assert.equal(m.events.some(e=>e.type==='catch'),false);assert.ok(m.throwers[1].x>=864);
 until(m,()=>m.throwers[1].x<864,1);assert.equal(m.ball.state,'loose');
 until(m,()=>m.ball.state==='returnToPost',1);until(m,()=>m.ball.state==='aiming',1);assert.ok(m.throwers[1].x>=861);
});

test('AI relaunches from its catch position in under half a second without lateral travel',()=>{
 for(const difficulty of ['discovery','challenge'])for(const owner of [0,1]){
  const m=new Match('solo',difficulty);m.status='playing';const p=m.throwers[owner];p.x=owner===0?105:895;p.y=485;m.centers[0].catches=4;m.shots=2;
  m.catchByThrower(owner);until(m,()=>m.ball.state==='flying',.5);assert.equal(p.x,owner===0?105:895);assert.equal(p.y,485);assert.ok(m.roundTime<.5);assert.equal(m.events.some(e=>e.type==='feint'),false);assert.ok(m.events.some(e=>e.type==='prepare'));
 }
});
test('AI returning with a recovered ball relaunches as soon as it reaches its line',()=>{
 const m=start();m.throwers[0].x=300;m.throwers[0].y=480;m.catchByThrower(0);
 until(m,()=>m.ball.state==='aiming',1);const ready=m.time;assert.equal(m.throwers[0].x,136);
 until(m,()=>m.ball.state==='flying',.4);assert.ok(m.time-ready<.4);assert.equal(m.throwers[0].x,136);assert.equal(m.throwers[0].y,480);
});
