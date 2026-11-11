import { mkdir, copyFile, readFile, writeFile } from 'node:fs/promises';
const root=new URL('../',import.meta.url);
const build=new URL('node_modules/three/build/',root),dest=new URL('dist/vendor/',root);
await mkdir(dest,{recursive:true});
for(const file of ['three.module.min.js','three.core.min.js']) await copyFile(new URL(file,build),new URL(file,dest));
await copyFile(new URL('node_modules/three/LICENSE',root),new URL('THREE-LICENSE.txt',dest));
const module=await readFile(new URL('three.module.min.js',dest),'utf8');
if(!module.includes('./three.core.min.js'))throw new Error('Verify Three.js browser module imports before publishing.');
console.log('Three.js modules and MIT license copied for same-origin, offline-independent hosting.');

for(const [name,source] of [['GLTFLoader.js','loaders/GLTFLoader.js'],['BufferGeometryUtils.js','utils/BufferGeometryUtils.js'],['SkeletonUtils.js','utils/SkeletonUtils.js']]){const code=await readFile(new URL('node_modules/three/examples/jsm/'+source,root),'utf8');await writeFile(new URL(name,dest),code.replaceAll("from 'three'","from './three.module.min.js'").replaceAll("from '../utils/BufferGeometryUtils.js'","from './BufferGeometryUtils.js'"));}
