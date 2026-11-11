import { readFile, writeFile, readdir, mkdir } from 'node:fs/promises';
import path from 'node:path';
// The existing static game stays source-owned. Compile the self-contained Worker
// by embedding these exact assets; no runtime asset binding is needed.
const assets={};
async function walk(dir){for(const e of await readdir(dir,{withFileTypes:true})){if(e.name==='server'||e.name==='.openai')continue;const p=path.join(dir,e.name);if(e.isDirectory())await walk(p);else {const binary=/\.(glb|png|jpg|webp|bin)$/.test(p);const data=await readFile(p);assets['/'+path.relative('dist',p)]=binary?{base64:data.toString('base64')}:data.toString('utf8');}}}
await walk('dist');
const strip=s=>s.replace(/^import .*?;\n/gm,'').replace(/^export /gm,'');
const avatar=strip(await readFile('dist/avatar.mjs','utf8'));
const core=strip(await readFile('dist/core.mjs','utf8'));
const match=strip(await readFile('dist/match.mjs','utf8')).replaceAll('const dir=','const shotDir=').replaceAll('dir(aim.','shotDir(aim.').replaceAll('d=dir(a.','d=shotDir(a.');
const room=strip(await readFile('worker/rooms.mjs','utf8'));
const out=`${avatar}\n${core}\n${match}\n${room}\nconst assets=${JSON.stringify(assets)};\nexport default {async fetch(request,env){const url=new URL(request.url);if(url.pathname.startsWith('/api/rooms/'))return rooms(request,env);if(!['GET','HEAD'].includes(request.method))return new Response('Method not allowed',{status:405});const p=url.pathname==='/'?'/index.html':url.pathname;const value=assets[p];if(value===undefined)return new Response('Not found',{status:404});const binary=typeof value==='object';const payload=binary?Uint8Array.from(atob(value.base64),c=>c.charCodeAt(0)):value;const type=p.endsWith('.glb')?'model/gltf-binary':p.endsWith('.png')?'image/png':p.endsWith('.html')?'text/html':p.endsWith('.css')?'text/css':p.endsWith('.mjs')||p.endsWith('.js')?'text/javascript':'text/plain';return new Response(request.method==='HEAD'?null:payload,{headers:{'Content-Type':type+(binary?'':'; charset=utf-8'),'Cache-Control':'no-cache','X-Content-Type-Options':'nosniff'}});}};\n`;
await mkdir('dist/server',{recursive:true});await writeFile('dist/server/index.js',out);
console.log('Worker built with '+Object.keys(assets).length+' game assets.');
