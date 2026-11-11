import test from 'node:test';
import assert from 'node:assert/strict';
import { Likolo, WORLD, RULES } from '../dist/core.mjs';
const advance=(g,seconds,input={})=>{for(let i=0;i<Math.ceil(seconds*120);i++)g.update(1/120,input);};
function safe(){const g=new Likolo();g.start();g.ball.timer=999;return g;}
function gather(g){assert.equal(g.beginGather(),true);advance(g,RULES[g.mode].gatherTime+.02);}
function shot(g,height=1.0){g.ball={state:'flying',owner:0,x:g.player.x-19,y:g.player.y,vx:200,vy:0,age:1,flightTime:.2,targetHeight:height,height,style:height<.7?'bas':'haut'};}

test('the smaller circle surrounds a bottle that stays on the ground while the player moves',()=>{
 const g=safe();assert.equal(g.bottle.upright,true);assert.equal(g.bottle.held,false);assert.ok(WORLD.radius<38);advance(g,1,{x:1});assert.ok(g.player.x>700);assert.equal(g.bottle.x,500);assert.equal(g.bottle.y,340);
});
test('each pour requires a fresh handful and consumes exactly one handful',()=>{
 const g=safe();assert.equal(g.beginPour(),false);assert.equal(g.fill,0);gather(g);assert.equal(g.sandInHand,1);assert.equal(g.beginPour(),true);assert.equal(g.sandInHand,0);advance(g,.5);assert.ok(Math.abs(g.fill-.1)<1e-8);assert.equal(g.beginPour(),false);advance(g,2,{sand:true});assert.ok(Math.abs(g.fill-.1)<1e-8);
 gather(g);g.beginPour();advance(g,.5);assert.ok(Math.abs(g.fill-.2)<1e-8);assert.equal(g.stats.gathers,2);assert.equal(g.stats.pours,2);
});
test('a fallen bottle must be righted before pouring; a refused pour preserves the handful',()=>{
 const g=safe();gather(g);g.toppleBottle();assert.equal(g.beginPour(),false);assert.equal(g.sandInHand,1);assert.equal(g.beginRightBottle(),true);advance(g,.62);assert.equal(g.bottle.upright,true);assert.equal(g.beginPour(),true);advance(g,.5);assert.ok(g.fill>.09);
});
test('bumping the bottle knocks it down without moving it along with the player',()=>{
 const g=safe();advance(g,.08,{y:-1});assert.equal(g.bottle.upright,false);assert.equal(g.bottle.x,500);assert.equal(g.bottle.y,340);
});
test('pouring and righting require returning to the small circle',()=>{
 const g=safe();g.player.x+=80;gather(g);assert.equal(g.beginPour(),false);assert.equal(g.sandInHand,1);g.toppleBottle();assert.equal(g.beginRightBottle(),false);g.player.x=500;assert.equal(g.beginRightBottle(),true);
});
test('movement interrupts a pour; its handful cannot be reused or poured remotely',()=>{
 const g=safe();gather(g);g.beginPour();advance(g,.1);advance(g,.03,{x:1});assert.equal(g.action,null);assert.equal(g.sandInHand,0);assert.equal(g.fill,0);advance(g,.3);assert.equal(g.beginPour(),false);
});
test('jumping has actual height, prevents a second jump in mid-air and blocks sand gestures',()=>{
 const g=safe();assert.equal(g.jump(),true);advance(g,.25);assert.ok(g.player.height>1);assert.equal(g.jump(),false);assert.equal(g.beginGather(),false);advance(g,.8);assert.equal(g.player.height,0);assert.equal(g.jump(),true);
});
test('a low ball hits a grounded player but passes underneath a correctly timed jump',()=>{
 const grounded=safe();shot(grounded,.38);advance(grounded,.02);assert.equal(grounded.status,'lost');
 const jumping=safe();jumping.jump();advance(jumping,.25);shot(jumping,.38);advance(jumping,.025);assert.equal(jumping.status,'playing');assert.ok(jumping.stats.jumpDodges>0);
});
test('a high ball can still hit a jumping player',()=>{
 const g=safe();g.jump();advance(g,.25);shot(g,1.95);advance(g,.02);assert.equal(g.status,'lost');
});
test('a timely interception prevents a hit, while an expired attempt does not',()=>{
 const g=safe();shot(g);g.catchOrCharge();advance(g,.03);assert.equal(g.status,'playing');assert.equal(g.ball.state,'held');
 const late=safe();late.catchOrCharge();advance(late,.7);shot(late);advance(late,.02);assert.equal(late.status,'lost');
});
test('opponents lead a moving player, then keep the announced trajectory fixed',()=>{
 const g=safe();g.player.vy=160;g.ball.timer=.3;advance(g,.02);const target={...g.ball.target};assert.ok(target.y>g.player.y+10);g.player.y=470;advance(g,.35);assert.equal(g.ball.state,'flying');assert.deepEqual(g.ball.target,target);
});
test('opponents reposition on their flank and adapt shot heights to frequent jumps',()=>{
 const g=safe();g.ball.timer=2;advance(g,.3);assert.notEqual(g.throwers[0].y,340);assert.equal(g.throwers[0].x,75);g.stats.jumps=3;g.stats.shots=2;assert.equal(g.chooseShot().style,'haut');
});
test('after repeated interceptions an opponent can feint before the real shot',()=>{
 const g=safe();g.catches=2;g.stats.shots=2;g.ball.timer=.99;advance(g,.02);assert.equal(g.stats.feints,1);assert.ok(g.ball.feintUntil>g.time);assert.equal(g.ball.target,undefined);
});
test('the better placed thrower retrieves a powerful return rather than always the original attacker',()=>{
 const g=safe();g.ball={state:'held',lastOwner:0,x:500,y:358};g.catchOrCharge();advance(g,1.2);g.releaseThrow({x:1,y:0});assert.equal(g.ball.state,'retrieving');assert.equal(g.ball.owner,1);assert.equal(g.ball.power,1);
});
test('a low shot can knock down the ground bottle',()=>{
 const g=safe();g.player.x=600;g.ball={state:'flying',owner:0,x:485,y:340,vx:200,vy:0,age:1,flightTime:.2,targetHeight:.38,height:.38};advance(g,.08);assert.equal(g.bottle.upright,false);
});
test('each difficulty can be won through distinct gathers, pours, interceptions and a final emptying',()=>{
 for(const mode of ['discovery','challenge']){
  const g=new Likolo();g.start(mode);
  for(let i=0;i<120*120&&g.status==='playing';i++){
   const b=g.ball;
   if(b.state==='flying'&&Math.hypot(b.x-g.player.x,b.y-g.player.y)<95&&g.time>=g.catchReady)g.catchOrCharge();
   if(b.state==='held'){if(g.chargeStart===null)g.catchOrCharge();else if(g.charge()>=.99)g.releaseThrow({x:0,y:-1});}
   else if(!g.action){if(!g.bottle.upright)g.beginRightBottle();else if(g.phase==='empty'||g.sandInHand)g.beginPour();else g.beginGather();}
   g.update(1/120);
  }
  assert.equal(g.status,'won',mode);assert.equal(g.fill,0);assert.equal(g.stats.pours,10);assert.ok(g.stats.gathers>=g.stats.pours);assert.ok(g.catches>=1);
 }
});
test('pause freezes movement, jump height and a sand action in progress',()=>{
 const g=safe();g.beginGather();g.status='paused';advance(g,1,{x:1});assert.equal(g.time,0);assert.equal(g.player.x,500);assert.equal(g.action.elapsed,0);assert.equal(g.sandInHand,0);
});
