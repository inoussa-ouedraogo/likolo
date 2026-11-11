import test from 'node:test';import assert from 'node:assert/strict';
import { Match } from '../dist/match.mjs';import { NetPrediction } from '../dist/net-prediction.mjs';
function playing(){const m=new Match('duel');m.status='playing';return m;}
test('a remote player moves and jumps locally before any network reply without changing authoritative state',()=>{
 const authority=playing(),n=new NetPrediction();n.install(authority,0);n.command({action:'jump'});n.update(.025,{x:1,y:0});assert.ok(n.view().player.height>0);assert.ok(n.view().player.x>500);assert.equal(authority.centers[0].player.height,0);assert.equal(authority.centers[0].player.x,500);
});
test('reconciliation replays unacknowledged commands once and keeps acknowledged prone state',()=>{
 const authority=playing(),n=new NetPrediction(),command={seq:1,action:'prone'};n.install(authority,0,[command]);assert.equal(n.view().player.prone,true);n.install(authority,0,[command]);assert.equal(n.view().player.prone,true);authority.command(0,'prone');n.install(authority,0,[]);assert.equal(n.view().player.prone,true);
});
test('extrapolation is bounded and remote input remains smooth between snapshots',()=>{
 const authority=playing(),n=new NetPrediction();n.install(authority,0,[],{1:{x:0,y:1}},20);assert.ok(n.match.time<=.121);const before=n.view().throwers[0].y;n.update(.025,{x:0,y:0});assert.ok(n.view().throwers[0].y>before);assert.equal(authority.time,0);
});
test('predicted outcomes cannot mutate the authoritative score or round result',()=>{
 const authority=playing(),n=new NetPrediction();n.install(authority,0);n.match.end('lost',0,0);assert.equal(authority.status,'playing');assert.equal(authority.result,null);assert.equal(authority.round,1);n.install(authority,0);assert.equal(n.match.status,'playing');
});
