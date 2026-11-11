import test from 'node:test';import assert from 'node:assert/strict';import {spawn} from 'node:child_process';import {once} from 'node:events';import {mkdtemp,rm} from 'node:fs/promises';import path from 'node:path';
test('OVH server serves the game and persists a real multiplayer room in SQLite across restarts',async()=>{
 const folder=await mkdtemp(path.join(process.cwd(),'.test-ovh-'));let child;
 const launch=async()=>{child=spawn(process.execPath,['server/ovh.mjs'],{cwd:new URL('../',import.meta.url),env:{...process.env,PORT:'0',HOST:'127.0.0.1',PUBLIC_ORIGIN:'',DATABASE_PATH:path.join(folder,'game.sqlite')},stdio:['ignore','pipe','pipe']});return new Promise((resolve,reject)=>{let text='';const timeout=setTimeout(()=>reject(new Error('Server startup timed out')),10000);child.stdout.on('data',chunk=>{text+=chunk;const match=text.match(/http:\/\/127.0.0.1:(\d+)/);if(match){clearTimeout(timeout);resolve(match[0]);}});child.once('error',error=>{clearTimeout(timeout);reject(error);});});};
 const stop=async()=>{const done=once(child,'exit');child.kill('SIGTERM');await done;child=null;};
 try{
  let origin=await launch();assert.equal((await fetch(origin+'/healthz')).status,200);assert.match(await(await fetch(origin)).text(),/LIKOLO/);assert.equal((await fetch(origin+'/models/likolo-athlete.glb')).headers.get('content-type'),'model/gltf-binary');
  const post=async(action,body,requestOrigin=origin)=>{const response=await fetch(origin+'/api/rooms/'+action,{method:'POST',headers:{Origin:requestOrigin,'Content-Type':'application/json'},body:JSON.stringify(body)});return{status:response.status,data:await response.json()};};
  const a=await post('create',{kind:'duel',name:'Hôte',avatar:{skin:4,hair:3}});assert.equal(a.status,200);const b=await post('join',{code:a.data.code,name:'Invité'});assert.equal(b.status,200);assert.equal((await post('start',a.data)).data.match.status,'playing');assert.equal((await post('sync',a.data,'https://other.example')).status,403);
  await stop();origin=await launch();const restored=await post('sync',{code:a.data.code,token:a.data.token});assert.equal(restored.status,200);assert.equal(restored.data.players.length,2);assert.equal(restored.data.match.avatars[0].skin,4);
  assert.equal((await fetch(origin+'/api/rooms/sync',{method:'POST',body:'x'.repeat(17000)})).status,413);
 }finally{if(child)await stop();await rm(folder,{recursive:true,force:true});}
});
