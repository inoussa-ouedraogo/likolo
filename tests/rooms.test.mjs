import test from 'node:test';import assert from 'node:assert/strict';import { DatabaseSync } from 'node:sqlite';import { readFileSync } from 'node:fs';import { rooms } from '../worker/rooms.mjs';
function db(){
 const sql=new DatabaseSync(':memory:');
 sql.exec(readFileSync(new URL('../drizzle/0000_ambitious_boomer.sql',import.meta.url),'utf8'));
 return {prepare(query){return {bind(...args){return {
  async first(){return sql.prepare(query).get(...args);},
  async run(){const r=sql.prepare(query).run(...args);return {meta:{changes:r.changes}};}
 };}};}};
}
async function request(DB,action,body,origin='https://test.likolo'){const r=await rooms(new Request('https://test.likolo/api/rooms/'+action,{method:'POST',headers:{Origin:origin},body:JSON.stringify(body)}),{DB});return{status:r.status,data:await r.json()};}
async function room(DB,kind='duel'){const r=await request(DB,'create',{kind,name:'A'});assert.equal(r.status,200);return r.data;}
test('rooms persist across independent requests, enforce capacity and do not leak member tokens',async()=>{
 const DB=db(),a=await room(DB),b=(await request(DB,'join',{code:a.code,name:'B'})).data;assert.equal(b.seat,1);assert.ok(b.token&&b.token!==a.token);assert.equal(JSON.stringify(b.players).includes(a.token),false);assert.equal(JSON.stringify(b.match).includes(a.token),false);const full=await request(DB,'join',{code:a.code,name:'C'});assert.equal(full.status,409);const stranger=await request(DB,'sync',{code:a.code,token:'wrong'});assert.equal(stranger.status,403);
});
test('only host starts with all required members, inputs are seat-bound, actions are applied once',async()=>{
 const DB=db(),a=await room(DB);assert.equal((await request(DB,'start',a)).status,409);const b=(await request(DB,'join',{code:a.code,name:'B'})).data;assert.equal((await request(DB,'start',b)).status,403);assert.equal((await request(DB,'start',a)).data.match.status,'playing');const cmd={seq:1,action:'prone'};const one=await request(DB,'sync',{...a,commands:[cmd]});const two=await request(DB,'sync',{...a,commands:[cmd]});assert.equal(one.data.match.centers[0].player.prone,true);assert.equal(two.data.match.centers[0].player.prone,true);assert.equal(two.data.ack,1);assert.equal((await request(DB,'sync',{...b,commands:[{seq:1,action:'prone'}]})).data.match.centers[0].player.prone,true);
});
test('cross-origin writes are refused and host leaving closes the room',async()=>{const DB=db(),a=await room(DB);assert.equal((await request(DB,'sync',a,'https://other.example')).status,403);assert.equal((await request(DB,'leave',a)).status,200);assert.equal((await request(DB,'sync',a)).status,404);});
test('guest leaving returns remaining players to a reusable waiting lobby',async()=>{const DB=db(),a=await room(DB),b=(await request(DB,'join',{code:a.code,name:'B'})).data;await request(DB,'start',a);await request(DB,'leave',b);const state=(await request(DB,'sync',a)).data;assert.equal(state.match.status,'ready');assert.equal(state.players.length,1);assert.equal((await request(DB,'join',{code:a.code,name:'New player'})).status,200);});
test('avatars are shared by seat, survive rounds and update only for the authenticated player',async()=>{
 const DB=db(),a=(await request(DB,'create',{kind:'duel',avatar:{hair:2,shirt:4,skin:3}})).data;
 const b=(await request(DB,'join',{code:a.code,avatar:{hair:1,shirt:2,shoes:3}})).data;assert.equal(b.match.avatars[0].shirt,4);assert.equal(b.match.avatars[1].shoes,3);
 const updated=(await request(DB,'sync',{...b,avatar:{hair:0,shirt:5,skin:999}})).data;assert.equal(updated.match.avatars[0].shirt,4);assert.equal(updated.match.avatars[1].shirt,5);assert.equal(updated.match.avatars[1].skin,0);
 const {Match}=await import('../dist/match.mjs');const m=Match.restore(updated.match);m.status='lost';m.result={status:'lost',center:0,thrower:0};m.nextRound();assert.equal(m.view(0).appearances.t0.shirt,4);assert.equal(m.view(1).appearances.c0.shirt,5);
});
