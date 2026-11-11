import test from 'node:test';import assert from 'node:assert/strict';import { Match } from '../dist/match.mjs';
const run=(m,t,inputs={})=>{for(let i=0;i<Math.ceil(t/.01);i++)m.update(.01,inputs);};
const ready=(kind='duel')=>{const m=new Match(kind);m.status='playing';return m;};
function atPlayer(m,height){const p=m.centers[0].player;m.ball={state:'flying',owner:0,x:p.x-19,y:p.y,vx:200,vy:0,age:1,height,targetHeight:height,flightTime:.1};}
test('prone lowers the collider, blocks sand and catches, but remains vulnerable to low throws',()=>{
 const m=ready();m.command(0,'prone');assert.equal(m.centers[0].player.prone,true);m.command(0,'gather');assert.equal(m.centers[0].action,null);m.command(0,'catch');assert.equal(m.centers[0].catchUntil,-1);atPlayer(m,1.7);run(m,.02);assert.equal(m.status,'playing');atPlayer(m,.3);run(m,.02);assert.equal(m.status,'lost');
});
test('a human thrower can move, choose height, charge and release a fast shot',()=>{
 const m=ready();run(m,.2,{1:{y:1}});assert.ok(m.throwers[0].y>380);m.command(1,'catch');run(m,1.2);assert.equal(m.ball.state,'aiming');m.command(1,'release',{x:1,y:0},2.05);assert.equal(m.ball.state,'flying');assert.equal(m.ball.tempo,'rapide');assert.equal(m.ball.style,'haut');assert.ok(m.ball.vx>700);
});
test('a short charge produces a slower ball than a long charge',()=>{const slow=ready(),fast=ready();slow.command(1,'catch');run(slow,.1);slow.command(1,'release',{x:1,y:0},.38);fast.command(1,'catch');run(fast,1.15);fast.command(1,'release',{x:1,y:0},.38);assert.ok(fast.ball.vx>slow.ball.vx*1.8);});
test('human throwers intercept a return and retrieve a loose ball by running to it',()=>{
 const m=ready();const p=m.throwers[0];m.ball={state:'returning',owner:0,from:{x:p.x,y:p.y},end:{x:p.x+5,y:p.y},x:p.x,y:p.y,height:1,age:.2,duration:1};m.command(1,'catch');run(m,.01);assert.equal(m.ball.state,'aiming');assert.equal(m.ball.owner,0);m.ball={state:'loose',owner:0,x:p.x+60,y:p.y,height:.2};run(m,.15,{1:{x:1}});assert.equal(m.ball.state,'aiming');
});
test('a center catch can be charged and returned away from the bottle',()=>{const m=ready();m.command(0,'catch');atPlayer(m,1);run(m,.01);assert.equal(m.ball.holder,'c0');m.command(0,'catch');run(m,.7);m.command(0,'release',{x:0,y:-1});assert.equal(m.ball.state,'returning');assert.ok(m.ball.end.y<200);});
test('cooperative players have separate handfuls and one shared bottle and objective',()=>{
 const m=ready('coop');m.ball.timer=999;m.centers[1].player.y=358;m.command(0,'gather');m.command(1,'gather');run(m,.5);assert.equal(m.centers[0].sandInHand,1);assert.equal(m.centers[1].sandInHand,1);m.command(0,'pour');m.command(1,'pour');run(m,.5);assert.ok(Math.abs(m.fill-.2)<1e-8);assert.equal(m.centers[0].sandInHand,0);assert.equal(m.centers[1].sandInHand,0);assert.equal(m.centers[0].bottle,m.centers[1].bottle);
});
test('role rotation swaps the losing center with the human attacker; fixed roles stay fixed',()=>{
 const m=ready('trio');m.end('lost',0,1);m.nextRound();assert.deepEqual(m.roles,['t1','t0','c0']);assert.equal(m.round,2);const duel=ready();duel.end('lost',0,1);duel.nextRound();assert.deepEqual(duel.roles,['t0','c0']);const fixed=ready();fixed.rotate=false;fixed.end('lost',0,0);fixed.nextRound();assert.deepEqual(fixed.roles,['c0','t0']);
});
test('serialization preserves live actions and restores executable behavior',()=>{const m=ready('coop');m.command(1,'gather');run(m,.2);const restored=Match.restore(JSON.parse(JSON.stringify(m)));run(restored,.3);assert.equal(restored.centers[1].sandInHand,1);assert.equal(restored.view(1).role,'c1');});
