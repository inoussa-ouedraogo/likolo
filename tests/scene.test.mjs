import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../dist/vendor/three.module.min.js';
import { LikoloScene } from '../dist/scene3d.mjs';
import { Likolo } from '../dist/core.mjs';

// Exercise the real scene graph and camera maths without pretending to validate GPU pixels.
const context=new Proxy({createLinearGradient:()=>({addColorStop(){}})}, {get:(target,key)=>target[key]??(()=>{}),set:(target,key,value)=>{target[key]=value;return true;}});
globalThis.document={createElement:()=>({width:0,height:0,getContext:()=>context})};
globalThis.devicePixelRatio=1;
function create(width,height){
 const canvas={getBoundingClientRect:()=>({width,height})};
 const rendererFactory=()=>({shadowMap:{},setPixelRatio(){},setSize(){},render(scene,camera){scene.updateMatrixWorld(true);camera.updateMatrixWorld(true);}});
 return new LikoloScene(canvas,{rendererFactory});
}
test('both throwers and the central player fit every camera preset on desktop and phone',()=>{
 for(const [w,h]of[[1000,680],[370,470]]){
  const scene=create(w,h);
  for(let i=0;i<3;i++){
   for(const x of[-10.625,0,10.625]){
    for(const y of[0,2.75]){
     const ndc=new THREE.Vector3(x,y,0).project(scene.camera);
     assert.ok(Math.abs(ndc.x)<1&&Math.abs(ndc.y)<1,`${w}x${h} view ${i}: player at ${x},${y} is visible`);
    }
   }
   scene.changeView();
  }
 }
});
test('screen-right movement remains screen-right after a camera change or portrait rotation',()=>{
 for(const [w,h]of[[1000,680],[370,470]]){
  const scene=create(w,h);
  for(let i=0;i<3;i++){
   const v=scene.screenVector(1,0),a=new THREE.Vector3(0,0,0).project(scene.camera),b=new THREE.Vector3(v.x,0,v.y).project(scene.camera);
   assert.ok(b.x>a.x);assert.ok(Math.abs(b.y-a.y)<.0001);scene.changeView();
  }
 }
});
test('the thatched roof surfaces face outwards and remain visible from outside the houses',()=>{
 const s=create(1000,680);let roofs=0;s.scene.traverse(m=>{if(m.name==='thatched-roof'){roofs++;assert.ok(m.geometry.attributes.normal.getZ(3)>0,'roof normals must face the outside');}});assert.ok(roofs>=5);
});
test('human rigs animate knees, hands and real jump height while the bottle stays on the ground',()=>{
 const scene=create(1000,680),g=new Likolo(),input={x:0,y:0};
 scene.render(g,input,0);g.start();g.ball.timer=999;scene.render(g,input,1);
 const a=scene.actors[2];assert.ok(a.leftKnee&&a.rightElbow&&a.rightHand);assert.equal(a.eyes.length,4);
 g.beginGather();for(let i=0;i<30;i++)g.update(1/120);scene.render(g,input,2);assert.ok(a.body.position.y<1.1);
 for(let i=0;i<30;i++)g.update(1/120);g.beginPour();for(let i=0;i<28;i++)g.update(1/120);scene.render(g,input,3);assert.equal(scene.sandParticles.visible,true);
 assert.ok(scene.bottle.group.position.y<.03);g.cancelAction();g.jump();for(let i=0;i<30;i++)g.update(1/120);scene.render(g,input,4);assert.ok(a.root.position.y>1);assert.ok(scene.bottle.group.position.y<.03);
});
test('falling and righting rotate the ground bottle, and the renderer handles all new shot states',()=>{
 const scene=create(1000,680),g=new Likolo();g.start();g.ball.timer=999;g.toppleBottle();
 for(let i=0;i<30;i++)scene.render(g,{},i/60);assert.ok(scene.bottle.group.rotation.z>1.3);g.beginRightBottle();for(let i=0;i<80;i++)g.update(1/120);for(let i=0;i<30;i++)scene.render(g,{},1+i/60);assert.ok(scene.bottle.group.rotation.z<.1);
 g.ball.target={x:500,y:358};g.ball.plan={style:'haut'};scene.render(g,{},2);assert.equal(scene.aimLine.visible,true);
 g.ball={state:'held',lastOwner:0,x:500,y:358,height:1.6};scene.render(g,{},3);assert.ok(scene.ball.position.y>0);
 g.catchOrCharge();g.update(.03);g.releaseThrow({x:0,y:-1});g.update(.03);scene.render(g,{},4);assert.equal(scene.ball.visible,true);
});

test('cooperative centers render separately and a prone athlete lies below a high ball',async()=>{
 const {Match}=await import('../dist/match.mjs');const m=new Match('coop');m.status='playing';m.command(1,'prone');const scene=create(390,414);for(let i=0;i<40;i++)scene.render(m.view(1),{},i/60);
 assert.equal(scene.actors[3].root.visible,true);assert.ok(scene.actors[3].body.position.y<.35);assert.ok(scene.actors[3].body.rotation.x>1.4);assert.ok(scene.actors[3].root.position.distanceTo(scene.actors[2].root.position)>.5);
});

test('static environment batching reduces draw submissions while moving rigs stay separate',()=>{
 const scene=create(1000,680);assert.ok(scene.staticDrawCallsSaved>40);assert.ok(scene.actors.every(a=>a.root.parent===scene.scene));let batches=0;scene.scene.traverse(o=>{if(o.isInstancedMesh&&o.name==='static-batch')batches++;});assert.ok(batches>4);
});
test('phone landscape uses lower pixel density and bounded shadow updates',()=>{
 globalThis.matchMedia=()=>({matches:true});globalThis.innerWidth=844;globalThis.innerHeight=390;
 try{const scene=create(844,390);assert.equal(scene.mobile,true);assert.equal(scene.sun.shadow.mapSize.x,512);assert.equal(scene.renderer.shadowMap.autoUpdate,false);}finally{delete globalThis.matchMedia;delete globalThis.innerWidth;delete globalThis.innerHeight;}
});

test('the ground bottle is larger and its locator stays visible without enlarging the rule circle',()=>{
 const scene=create(844,390),g=new Likolo();scene.render(g,{},1);assert.equal(scene.bottle.group.scale.x,1.65);assert.equal(scene.bottleHalo.material.depthTest,true);assert.equal(scene.bottleBeacon.visible,false);scene.bottle.group.traverse(o=>{if(o.material)assert.equal(o.material.depthTest,true);});assert.equal(scene.bottleHalo.position.x,0);assert.equal(scene.bottleHalo.position.z,0);assert.equal(scene.circle.geometry.parameters.innerRadius,22/40);
});
test('custom avatars render on their assigned role and do not rebuild every frame',async()=>{
 const {Match}=await import('../dist/match.mjs');const m=new Match('duel');m.avatars=[{hair:1,skin:3,shirt:4,shorts:2,shoes:3},{hair:2,skin:2,shirt:1,shorts:1,shoes:0}];const s=create(844,390);s.render(m.view(0),{},0);const center=s.actors[2],thrower=s.actors[0];assert.equal(center.variant,1);assert.equal(thrower.variant,2);s.render(m.view(0),{},.02);assert.equal(s.actors[2],center);m.status='lost';m.result={status:'lost',center:0,thrower:0};m.nextRound();s.render(m.view(0),{},.04);assert.equal(s.actors[0].variant,1);assert.equal(s.actors[2].variant,2);
});
