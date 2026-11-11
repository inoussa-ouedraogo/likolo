import test from 'node:test';import assert from 'node:assert/strict';import {cleanAvatar,npcAvatar} from '../dist/avatar.mjs';import {Match} from '../dist/match.mjs';
test('AI appearances are distinct from the local player and each other, deterministic on all clients',()=>{
 for(let hair=0;hair<4;hair++)for(let skin=0;skin<5;skin++){
  const player=cleanAvatar({hair,skin,shirt:3,build:2}),m=new Match('solo');m.avatars=[player];const a=m.view().appearances,b=Match.restore(JSON.parse(JSON.stringify(m))).view().appearances;
  assert.deepEqual(a,b);assert.deepEqual(a.c0,player);assert.notEqual(a.t0.hair,player.hair);assert.notEqual(a.t1.hair,player.hair);assert.notEqual(a.t0.skin,player.skin);assert.notEqual(a.t1.skin,player.skin);assert.notDeepEqual(a.t0,a.t1);assert.notEqual(a.t0.build,player.build);assert.notEqual(a.t1.build,player.build);
 }
});
test('human avatars stay attached to their seats while AI appearances fill only computer roles',()=>{
 const m=new Match('duel');m.avatars=[cleanAvatar({skin:4,hair:3}),cleanAvatar({skin:1,hair:0})];let v=m.view();assert.deepEqual(v.appearances.c0,m.avatars[0]);assert.deepEqual(v.appearances.t0,m.avatars[1]);m.status='lost';m.result={status:'lost',center:0,thrower:0};m.nextRound();v=m.view();assert.deepEqual(v.appearances.t0,m.avatars[0]);assert.deepEqual(v.appearances.c0,m.avatars[1]);assert.deepEqual(v.appearances.t1,npcAvatar(1,m.avatars));
});
