import test from 'node:test';import assert from 'node:assert/strict';import { bottleVisualState } from '../dist/bottle-hud.mjs';
const game=(fill=0)=>({fill,phase:'fill',bottle:{upright:true},action:null});
test('the HUD distinguishes an empty, full, fallen and partially righted bottle',()=>{
 const g=game();assert.equal(bottleVisualState(g).percent,0);g.fill=1;g.phase='empty';assert.equal(bottleVisualState(g).percent,100);assert.equal(bottleVisualState(g).phase,'empty');g.bottle.upright=false;assert.equal(bottleVisualState(g).angle,86);g.action={kind:'right',elapsed:.3,duration:.6};assert.equal(bottleVisualState(g).angle,43);
});
test('the HUD smoothly previews a pouring scoop, including two simultaneous cooperative pours',()=>{
 const g=game(.3);g.action={kind:'pour',elapsed:.2,duration:.4};assert.equal(bottleVisualState(g).percent,35);g.centerStates=[{action:g.action},{action:g.action}];assert.equal(bottleVisualState(g).percent,40);g.fill=.98;assert.equal(bottleVisualState(g).percent,100);
});
test('emptying tilts the illustrated bottle and the visible level follows remaining sand',()=>{
 const g=game(.6);g.phase='empty';g.action={kind:'empty',elapsed:.2,duration:2};const state=bottleVisualState(g);assert.equal(state.emptying,true);assert.equal(state.angle,-42);assert.equal(state.percent,60);g.fill=.2;assert.equal(bottleVisualState(g).percent,20);
});
