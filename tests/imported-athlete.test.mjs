import test from 'node:test';import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';import * as THREE from '../dist/vendor/three.module.min.js';import {loadAthleteAssets,makeImportedAthlete,animateImportedAthlete,disposeImportedAthlete} from '../dist/imported-athlete.mjs';
// Exercise the real GLB skeleton without requiring a GPU or an image decoder.
const originalFetch=globalThis.fetch;globalThis.self=globalThis;globalThis.ProgressEvent=class{constructor(type,init){Object.assign(this,{type},init);}};globalThis.createImageBitmap=async()=>({width:128,height:128,close(){}});
globalThis.fetch=async(request,init)=>{const url=typeof request==='string'?request:request.url??String(request);if(url.startsWith('file:'))return new Response(await readFile(new URL(url)),{headers:{'Content-Type':'model/gltf-binary'}});return originalFetch(request,init);};
await loadAthleteAssets();
test('real CC0 model has a cloned humanoid skeleton, dark recolorable skin and sports clothing',()=>{
 const a=makeImportedAthlete({avatar:{hair:0,skin:4,shirt:3,shorts:2,shoes:3}}),b=makeImportedAthlete({avatar:{hair:1,skin:1,shirt:1}});assert.ok(a.imported);assert.notEqual(a.bones.Head,b.bones.Head);let triangles=0,skin=0,shirt=0; a.model.traverse(o=>{if(o.isSkinnedMesh)triangles+=o.geometry.index.count/3;for(const m of o.material?(Array.isArray(o.material)?o.material:[o.material]):[]){if(m.name==='Skin'){skin++;assert.equal(m.color.getHexString(),'38251e');}if(m.name==='Shirt'){shirt++;assert.equal(m.color.getHexString(),'8758a5');}}});assert.ok(triangles>10000);assert.ok(skin&&shirt);
 const box=new THREE.Box3().setFromObject(a.root,true);assert.ok(box.max.y<2.8);assert.ok(box.min.y>-.08);const before=b.bones.upperarm_r.quaternion.clone();animateImportedAthlete(a,{time:1,catching:true});assert.ok(a.rightHand.getWorldPosition(new THREE.Vector3()).y>1.3);assert.ok(before.equals(b.bones.upperarm_r.quaternion));disposeImportedAthlete(a);disposeImportedAthlete(b);
});
test('imported animations support gather, jump, prone and a sand handful without losing the rig',()=>{
 const a=makeImportedAthlete();animateImportedAthlete(a,{time:1,action:'gather',sandInHand:true});assert.ok(a.scoop.visible);assert.ok(a.pose.body>0);for(let i=0;i<60;i++)animateImportedAthlete(a,{time:2+i/60,prone:true});assert.ok(a.model.rotation.x>1.4);const box=new THREE.Box3().setFromObject(a.root,true);assert.ok(box.max.y<.9);assert.ok(box.min.y>-.2);disposeImportedAthlete(a);
});
test('deployed Worker serves the real binary GLB unchanged with its proper MIME type',async()=>{
 const worker=(await import('../dist/server/index.js')).default;const response=await worker.fetch(new Request('https://test.likolo/models/likolo-athlete.glb'),{});assert.equal(response.status,200);assert.equal(response.headers.get('content-type'),'model/gltf-binary');assert.deepEqual(Buffer.from(await response.arrayBuffer()),await readFile(new URL('../dist/models/likolo-athlete.glb',import.meta.url)));
});
test('hair stays close to the scalp and silhouettes have visibly distinct dimensions',()=>{
 for(let hair=0;hair<4;hair++){const a=makeImportedAthlete({avatar:{hair,build:1}});const bounds=new THREE.Box3().setFromObject(a.ownedHair,true);assert.ok(bounds.max.y<2.52);assert.ok(bounds.max.x-bounds.min.x<.38);assert.ok(bounds.max.y-bounds.min.y<.18);disposeImportedAthlete(a);}
 const slim=makeImportedAthlete({avatar:{build:0}}),broad=makeImportedAthlete({avatar:{build:2}});assert.ok(broad.model.scale.x>slim.model.scale.x*1.15);assert.ok(broad.model.scale.y>slim.model.scale.y);disposeImportedAthlete(slim);disposeImportedAthlete(broad);
});
