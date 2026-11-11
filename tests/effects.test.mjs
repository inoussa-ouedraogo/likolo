import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../dist/vendor/three.module.min.js';
import { Effects, FX_STYLES } from '../dist/effects.mjs';
import { GameAudio } from '../dist/audio.mjs';
import { Likolo } from '../dist/core.mjs';
test('hit, catch and bottle events have separate visual signatures',()=>{
 const types=['lose','catch','topple','right','pour'];assert.equal(new Set(types.map(t=>FX_STYLES[t].color)).size,types.length);
 const scene=new THREE.Scene(),fx=new Effects(scene);for(const type of types){fx.burst(type,new THREE.Vector3(0,1,0));assert.ok(fx.activeCount()>0);fx.reset();assert.equal(fx.activeCount(),0);}
});
test('effects reuse a bounded particle and ring pool and expire after the event',()=>{
 const scene=new THREE.Scene(),fx=new Effects(scene,{capacity:120});const objects=scene.children.length;
 for(let i=0;i<100;i++)fx.burst('lose',new THREE.Vector3());assert.equal(scene.children.length,objects);assert.ok(fx.activeCount()<=120);
 for(let i=0;i<150;i++)fx.update(i*.02);assert.equal(fx.activeCount(),0);assert.ok(fx.rings.every(r=>!r.mesh.visible));
});
test('the opponents alternate clearly different slow and fast launch speeds',()=>{
 const g=new Likolo();g.start();g.stats.shots=0;const slow=g.chooseShot();g.stats.shots=1;const fast=g.chooseShot();assert.equal(slow.tempo,'lent');assert.equal(fast.tempo,'rapide');assert.ok(fast.speed>slow.speed*1.8);
});
test('impact, interception, bottle and fast shot sounds use distinct patterns; mute suppresses them',()=>{
 const a=new GameAudio();a.context={};const patterns=[];let calls=[];a.tone=(...args)=>calls.push(['tone',...args]);a.noise=(...args)=>calls.push(['noise',...args]);
 for(const event of ['lose','catch','topple','right','shot']){calls=[];a.play(event,{ball:{tempo:'rapide'}});assert.ok(calls.length);patterns.push(JSON.stringify(calls));}
 assert.equal(new Set(patterns).size,patterns.length);a.enabled=false;calls=[];a.play('lose');assert.equal(calls.length,0);
});
test('background groove schedules once, pauses independently and resumes without a backlog',()=>{
 const a=new GameAudio(),levels=[],notes=[];a.master={};a.context={currentTime:10,createGain:()=>({gain:{value:0,setTargetAtTime:(v)=>levels.push(v)},connect(){}})};a.tone=(...v)=>notes.push(v);a.noise=(...v)=>notes.push(v);
 a.updateMusic(true);assert.ok(notes.length>0);const count=notes.length;a.updateMusic(true);assert.equal(notes.length,count);
 a.musicEnabled=false;a.updateMusic(true);assert.equal(levels.at(-1),0);assert.equal(a.nextBeat,0);
 a.musicEnabled=true;a.context.currentTime=100;a.updateMusic(true);assert.ok(a.musicStep>1);assert.ok(a.nextBeat>100);assert.ok(a.nextBeat<100.4);
 a.updateMusic(false);assert.equal(levels.at(-1),0);a.enabled=false;a.updateMusic(true);assert.equal(levels.at(-1),0);
});
test('volume controls independently boost music and effects and clamp invalid values',()=>{
 const a=new GameAudio(),effects=[],music=[];a.context={currentTime:0};a.master={};a.effectsBus={gain:{setTargetAtTime:v=>effects.push(v)}};a.musicBus={gain:{setTargetAtTime:v=>music.push(v)}};a.tone=()=>{};a.noise=()=>{};
 a.setVolume('music',1);a.updateMusic(true);assert.equal(music.at(-1),1);assert.equal(a.effectsVolume,.4);
 a.setVolume('effects',.85);assert.equal(effects.at(-1),.85);assert.equal(a.musicVolume,1);
 a.setVolume('music',-2);a.updateMusic(true);assert.equal(music.at(-1),0);a.setVolume('effects',3);assert.equal(a.effectsVolume,1);a.setVolume('effects',NaN);assert.equal(a.effectsVolume,1);
});
