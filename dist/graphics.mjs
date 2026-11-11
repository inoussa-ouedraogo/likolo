import * as THREE from './vendor/three.module.min.js';
// Static meshes sharing geometry/material become one draw call. Animated meshes
// are created after this pass and remain separate.
export function batchStatic(scene){
 scene.updateMatrixWorld(true);const groups=new Map();
 scene.traverse(mesh=>{if(!mesh.isMesh||mesh.isInstancedMesh||Array.isArray(mesh.material)||mesh.name||mesh.material.transparent)return;
  const key=[mesh.geometry.uuid,mesh.material.uuid,mesh.castShadow,mesh.receiveShadow].join('/');if(!groups.has(key))groups.set(key,[]);groups.get(key).push(mesh);
 });
 let saved=0;for(const list of groups.values()){if(list.length<3)continue;const first=list[0],batch=new THREE.InstancedMesh(first.geometry,first.material,list.length);batch.name='static-batch';batch.castShadow=first.castShadow;batch.receiveShadow=first.receiveShadow;
  list.forEach((mesh,i)=>{batch.setMatrixAt(i,mesh.matrixWorld);mesh.removeFromParent();});batch.computeBoundingSphere();scene.add(batch);saved+=list.length-1;
 }return saved;
}
