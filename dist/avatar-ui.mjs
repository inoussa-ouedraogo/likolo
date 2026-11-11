import * as THREE from './vendor/three.module.min.js';
import {makeAthlete,animateAthlete,disposeAthlete} from './characters.mjs';
import {cleanAvatar,AVATAR_OPTIONS,AVATAR_PRESETS} from './avatar.mjs';
export function setupAvatar(onChange){
 let avatar=cleanAvatar();try{avatar=cleanAvatar(JSON.parse(localStorage.getItem('likolo-avatar')||'{}'));}catch{}
 const dialog=document.getElementById('avatar-dialog'),canvas=document.getElementById('avatar-preview'),fields=document.getElementById('avatar-fields');let renderer,actor,frame=0;
 const scene=new THREE.Scene();scene.background=new THREE.Color('#172940');const camera=new THREE.PerspectiveCamera(34,1,.1,30);camera.position.set(0,1.6,5.5);camera.lookAt(0,1.25,0);
 scene.add(new THREE.HemisphereLight('#fff4df','#496c8b',2.5));const light=new THREE.DirectionalLight('#fff0d5',3);light.position.set(3,4,5);scene.add(light);
 const podium=new THREE.Mesh(new THREE.CylinderGeometry(.7,.8,.08,48),new THREE.MeshStandardMaterial({color:'#304a61'}));podium.position.y=-.05;scene.add(podium);
 function save(){try{localStorage.setItem('likolo-avatar',JSON.stringify(avatar));}catch{}onChange({...avatar});}
 function refresh(){if(actor)disposeAthlete(actor);actor=makeAthlete({avatar,number:'7'});scene.add(actor.root);for(const b of fields.querySelectorAll('[data-key]'))b.setAttribute('aria-pressed',String(avatar[b.dataset.key]===Number(b.dataset.value)));save();}
 const presets=document.createElement('div');presets.className='avatar-presets';for(const preset of AVATAR_PRESETS){const b=document.createElement('button');b.textContent=preset.name;b.onclick=()=>{avatar=cleanAvatar(preset);refresh();};presets.append(b);}fields.append(presets);
 for(const [key,title] of Object.entries({hair:'Coiffure',skin:'Teint',shirt:'Haut',shorts:'Short',shoes:'Chaussures',build:'Silhouette'})){
  const group=document.createElement('fieldset'),legend=document.createElement('legend');legend.textContent=title;group.append(legend);
  const options=key==='hair'?['Boucles courtes','Tresses plaquées','Bandeau','Coupe rase']:AVATAR_OPTIONS[key];
  options.forEach((value,i)=>{const b=document.createElement('button');b.type='button';b.dataset.key=key;b.dataset.value=String(i);b.setAttribute('aria-label',key==='hair'?value:title+' '+(i+1));if(key==='hair'||key==='build')b.textContent=value;else{b.style.background=value;b.className='avatar-swatch';}b.onclick=()=>{avatar={...avatar,[key]:i};refresh();};group.append(b);});fields.append(group);
 }
 function render(t){if(!dialog.open)return;const w=canvas.clientWidth||240,h=canvas.clientHeight||300;renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix();animateAthlete(actor,{time:t/1000,moving:false});actor.root.rotation.y=Math.sin(t*.0004)*.35;renderer.render(scene,camera);frame=requestAnimationFrame(render);}
 function open(){dialog.showModal();try{renderer??=new THREE.WebGLRenderer({canvas,antialias:true,alpha:false});renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));refresh();frame=requestAnimationFrame(render);}catch{document.getElementById('avatar-preview-note').hidden=false;}}
 document.getElementById('avatar-button').onclick=open;document.getElementById('avatar-close').onclick=()=>dialog.close();dialog.addEventListener('close',()=>{cancelAnimationFrame(frame);if(renderer){renderer.dispose();renderer=null;}canvas.width=1;canvas.height=1;});save();return ()=>({...avatar});
}
