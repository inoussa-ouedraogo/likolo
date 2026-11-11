import * as THREE from './vendor/three.module.min.js';
import {GLTFLoader} from './vendor/GLTFLoader.js';
import {clone} from './vendor/SkeletonUtils.js';
import {cleanAvatar,AVATAR_OPTIONS} from './avatar.mjs';
let template=null,loading;
export function loadAthleteAssets(){return loading??=(new GLTFLoader().loadAsync(new URL('./models/likolo-athlete.glb',import.meta.url).href).then(g=>{template=g.scene;return template;}));}
const axisX=new THREE.Vector3(1,0,0),axisZ=new THREE.Vector3(0,0,1),axisY=new THREE.Vector3(0,1,0),q1=new THREE.Quaternion(),q2=new THREE.Quaternion();
export function makeImportedAthlete({avatar,color,variant=0}={}){
 if(!template)return null;
 const config=cleanAvatar(avatar??{hair:variant,skin:variant%3});
 const root=new THREE.Group(),model=clone(template);root.name='quaternius-athlete';root.add(model);
 model.updateMatrixWorld(true);const box=new THREE.Box3().setFromObject(model);const scale=2.43/(box.max.y-box.min.y);model.scale.setScalar(scale);model.position.y=-box.min.y*scale;model.updateMatrixWorld(true);
 const bones={};model.traverse(o=>{if(o.isBone){bones[o.name]=o;o.userData.rest=o.quaternion.clone();o.userData.worldRest=o.getWorldQuaternion(new THREE.Quaternion());}if(o.isMesh){o.castShadow=true;o.receiveShadow=true;const mats=(Array.isArray(o.material)?o.material:[o.material]).map(m=>{const copy=m.clone();const key={Skin:'skin',Shirt:'shirt',Shorts:'shorts',Shoes:'shoes'}[m.name];if(key)copy.color.set(key==='shirt'&&!avatar&&color?color:AVATAR_OPTIONS[key][config[key]]);return copy;});o.material=Array.isArray(o.material)?mats:mats[0];}});
 const head=bones.Head,headWorld=new THREE.Vector3();head.getWorldPosition(headWorld);
 const hair=new THREE.Group(),dark=new THREE.MeshStandardMaterial({color:'#17130f',roughness:.95});
 const puff=(x,y,z,sx,sy,sz)=>{const m=new THREE.Mesh(new THREE.SphereGeometry(1,10,7),dark);m.position.set(x,y,z);m.scale.set(sx,sy,sz);m.castShadow=true;hair.add(m);};
 // Hair is authored locally and follows the imported head bone.
 const scalp=new THREE.Mesh(new THREE.SphereGeometry(1,22,12,0,Math.PI*2,0,Math.PI*.52),dark);scalp.position.set(0,2.355,-.025);scalp.scale.set(.168,config.hair===3?.078:.108,.16);scalp.castShadow=true;hair.add(scalp);
 if(config.hair===0){for(let row=0;row<2;row++)for(let i=0;i<12;i++){const a=i/12*Math.PI*2,r=.13-row*.06;puff(Math.cos(a)*r,2.424+row*.035,Math.sin(a)*r-.025,.033,.032,.033);}}
 else if(config.hair===1){for(let i=-2;i<=2;i++){const points=[];for(let j=0;j<=10;j++){const t=j/10;points.push(new THREE.Vector3(i*.052,2.392+Math.sin(t*Math.PI)*(.075-Math.abs(i)*.009),.117-t*.285));}const braid=new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points),12,.012,5,false),dark);braid.castShadow=true;hair.add(braid);}}
 else if(config.hair===2){const band=new THREE.Mesh(new THREE.TorusGeometry(.164,.012,6,28),new THREE.MeshStandardMaterial({color:AVATAR_OPTIONS.shirt[config.shirt]}));band.position.set(0,2.375,-.025);band.rotation.x=Math.PI/2;band.scale.y=.95;hair.add(band);}
 root.add(hair);root.updateMatrixWorld(true);head.attach(hair);
 const scoop=new THREE.Mesh(new THREE.SphereGeometry(.07,8,6),new THREE.MeshStandardMaterial({color:'#c59962'}));bones.hand_r.add(scoop);scoop.visible=false;
 const a={imported:true,root,model,bones,scoop,body:model,face:head,eyes:[],leftArm:bones.upperarm_l,rightArm:bones.upperarm_r,leftElbow:bones.lowerarm_l,rightElbow:bones.lowerarm_r,leftLeg:bones.thigh_l,rightLeg:bones.thigh_r,leftKnee:bones.calf_l,rightKnee:bones.calf_r,leftHand:bones.hand_l,rightHand:bones.hand_r,last:new THREE.Vector3(),facing:0,lastTime:0,variant:config.hair,baseY:model.position.y,ownedHair:hair};
 const shape=[{x:.91,y:.96,head:1.04},{x:1,y:1,head:1},{x:1.09,y:1.035,head:.96}][config.build];model.scale.x*=shape.x;model.scale.y*=shape.y;head.scale.x*=shape.head;a.appearance=config;
 animateImportedAthlete(a,{time:0});return a;
}
function rotate(a,name,x=0,z=0,y=0){const b=a.bones[name];if(!b)return;const rest=b.userData.rest,world=b.userData.worldRest;q1.setFromAxisAngle(axisX,x);q2.setFromAxisAngle(axisZ,z);q1.multiply(q2);q2.setFromAxisAngle(axisY,y);q1.multiply(q2);q2.copy(world).invert().multiply(q1).multiply(world);b.quaternion.copy(rest).multiply(q2);}
export function animateImportedAthlete(a,p){
 const t=p.time??0,dt=Math.max(.001,Math.min(.1,t-a.lastTime||.016));a.lastTime=t;const f=1-Math.exp(-18*dt),s=p.moving?Math.sin(t*12)*.6:0;
 const target={body:0,drop:0,armL:-s*.65,armR:s*.65,elbowL:-.12,elbowR:-.12,legL:s,legR:-s,kneeL:Math.max(0,-s)*.9,kneeR:Math.max(0,s)*.9,prone:0};
 if(p.action){target.drop=-.08;target.body=.65;target.legL=target.legR=-.35;target.kneeL=target.kneeR=.75;target.armR=p.action==='gather'||p.action==='right'?-.4:-1.1;target.elbowR=-.55;}
 if(p.catching){target.armL=target.armR=-1.55;target.elbowL=target.elbowR=-.25;}
 if(p.holdingBall||p.windup){target.armR=-1.4-(p.charge??p.windup??0)*.9;target.elbowR=-.7;}
 if(p.feint)target.armR=-1.4+Math.sin(t*22)*.35;
 if(p.throwing){target.armR=-.5;target.elbowR=-.1;}
 if(p.jumpHeight>.05){target.legL=-.4;target.kneeL=.8;target.kneeR=.5;target.armL=-.7;}
 if(p.prone){Object.assign(target,{prone:Math.PI/2,drop:.35,body:0,legL:0,legR:0,kneeL:0,kneeR:0,armL:0,armR:0});}
 if(p.winner){target.armL=target.armR=-2.6;target.elbowL=target.elbowR=-.25;}
 if(p.loser){target.body=.3;target.drop=-.10;target.kneeL=.6;target.kneeR=.6;}
 a.pose??={...target};for(const key in target)a.pose[key]+=(target[key]-a.pose[key])*f;const v=a.pose;
 a.model.rotation.x=v.prone;a.model.position.y=a.baseY+v.drop;
 rotate(a,'spine_01',v.body);rotate(a,'upperarm_l',v.armL,-1.48);rotate(a,'upperarm_r',v.armR,1.48);rotate(a,'lowerarm_l',0,0,v.elbowL);rotate(a,'lowerarm_r',0,0,-v.elbowR);
 rotate(a,'thigh_l',v.legL);rotate(a,'thigh_r',v.legR);rotate(a,'calf_l',v.kneeL);rotate(a,'calf_r',v.kneeR);rotate(a,'Head',Math.sin(t*.7)*.025);
 a.scoop.visible=!!p.sandInHand;a.root.updateMatrixWorld(true);
}
export function disposeImportedAthlete(a){
 const materials=new Set();a.model.traverse(o=>{if(o.isMesh)for(const m of Array.isArray(o.material)?o.material:[o.material])materials.add(m);});
 a.ownedHair.traverse(o=>{if(o.geometry)o.geometry.dispose();if(o.material)materials.add(o.material);});a.scoop.geometry.dispose();materials.add(a.scoop.material);for(const m of materials)m.dispose();a.root.removeFromParent();
}
