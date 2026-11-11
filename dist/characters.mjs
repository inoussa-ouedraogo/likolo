import { makeImportedAthlete, animateImportedAthlete, disposeImportedAthlete } from './imported-athlete.mjs';
import { cleanAvatar, AVATAR_OPTIONS } from './avatar.mjs';
import * as THREE from './vendor/three.module.min.js';

// Original stylised athletes: smooth silhouettes, facial features and articulated limbs.
const geometry = {
  sphere: new THREE.SphereGeometry(1,18,12),
  capsule: new THREE.CapsuleGeometry(1,1,5,12),
  palm: new THREE.SphereGeometry(1,12,8),
};
const mat=(color,extra={})=>new THREE.MeshStandardMaterial({color,roughness:.78,...extra});
const clothesCache=new Map();
function colorMaterial(color){if(!clothesCache.has(color))clothesCache.set(color,mat(color));return clothesCache.get(color);}
function mesh(parent,g,m,x,y,z,sx=1,sy=1,sz=1){const n=new THREE.Mesh(g,m);n.position.set(x,y,z);n.scale.set(sx,sy,sz);n.castShadow=true;n.receiveShadow=true;parent.add(n);return n;}
function ellipsoid(parent,m,x,y,z,sx,sy,sz){return mesh(parent,geometry.sphere,m,x,y,z,sx,sy,sz);}
function limb(parent,m,length,radius,offset=0){
  const g=new THREE.CapsuleGeometry(radius,Math.max(.01,length-2*radius),5,12);
  return mesh(parent,g,m,0,-length/2+offset,0);
}
function jerseyMap(number){
  const c=document.createElement('canvas');c.width=128;c.height=128;const x=c.getContext('2d');
  x.clearRect(0,0,128,128);x.fillStyle='#ffefd0';x.font='bold 92px Arial';x.textAlign='center';x.textBaseline='middle';x.fillText(number,64,70);
  const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;return new THREE.MeshBasicMaterial({map:t,transparent:true,depthWrite:false});
}
export function makeAthlete({color='#37765a',number='7',variant=0,avatar=null}={}){
  const imported=makeImportedAthlete({avatar,color,variant});if(imported)return imported;
  const custom=avatar?cleanAvatar(avatar):null;if(custom){variant=custom.hair;color=AVATAR_OPTIONS.shirt[custom.shirt];}
  const root=new THREE.Group();root.name=`athlete-${number}`;
  const body=new THREE.Group();body.position.y=1.1;root.add(body);
  const shirt=colorMaterial(color),skin=colorMaterial(custom?AVATAR_OPTIONS.skin[custom.skin]:['#805035','#99633f','#6d422e'][variant%3]),hair=colorMaterial('#242927'),cream=colorMaterial('#fbefd1'),shorts=colorMaterial(custom?AVATAR_OPTIONS.shorts[custom.shorts]:'#344c47'),shoeMaterial=colorMaterial(custom?AVATAR_OPTIONS.shoes[custom.shoes]:'#fbefd1');
  const outline=[new THREE.Vector2(.235,.03),new THREE.Vector2(.245,.2),new THREE.Vector2(.31,.52),new THREE.Vector2(.335,.63),new THREE.Vector2(.255,.75)];
  const torso=mesh(body,new THREE.LatheGeometry(outline,20),shirt,0,0,0,1,1,.66);torso.name='jersey';
  ellipsoid(body,shirt,0,.09,0,.27,.17,.18);ellipsoid(body,skin,0,.8,0,.09,.12,.09);
  const collar=mesh(body,new THREE.TorusGeometry(.115,.023,6,24),cream,0,.755,0);collar.rotation.x=Math.PI/2;
  const face=new THREE.Group();face.position.set(0,1.075,.012);body.add(face);
  ellipsoid(face,skin,0,0,0,.224,.276,.208);
  ellipsoid(face,skin,0,-.115,.02,.174,.145,.16);
  for(const s of[-1,1])ellipsoid(face,skin,s*.218,-.01,-.005,.043,.069,.036);
  const eyeWhite=colorMaterial('#fff9ef'),pupilMat=colorMaterial('#272b25');
  const eyes=[];
  for(const s of[-1,1]){
    const eye=ellipsoid(face,eyeWhite,s*.079,.045,.191,.06,.042,.025);eyes.push(eye);
    const pupil=ellipsoid(face,pupilMat,s*.079,.045,.214,.026,.031,.012);eyes.push(pupil);
    const browCurve=new THREE.QuadraticBezierCurve3(new THREE.Vector3(s*.126,.115,.184),new THREE.Vector3(s*.085,.139,.205),new THREE.Vector3(s*.04,.116,.2));
    mesh(face,new THREE.TubeGeometry(browCurve,8,.011,5,false),hair,0,0,0);
  }
  ellipsoid(face,skin,0,-.005,.213,.036,.052,.044);
  const smile=new THREE.QuadraticBezierCurve3(new THREE.Vector3(-.059,-.102,.189),new THREE.Vector3(0,-.137,.212),new THREE.Vector3(.059,-.102,.189));
  mesh(face,new THREE.TubeGeometry(smile,12,.008,5,false),colorMaterial('#573927'),0,0,0);
  const cap=mesh(face,new THREE.SphereGeometry(.23,20,12,0,Math.PI*2,0,Math.PI*.54),hair,0,.067,-.008,1,.86,1);
  if(variant===1){
    for(const s of[-1,1]){ellipsoid(face,hair,s*.19,.14,-.14,.117,.11,.11);for(let i=0;i<3;i++)ellipsoid(face,hair,s*.19,.08-i*.115,-.17,.052,.075,.054);}
  }else if(variant===0){
    for(let i=0;i<5;i++)ellipsoid(face,hair,(i-2)*.075,.26+Math.sin(i)*.025,-.025,.064,.075,.072);
  }else{
    ellipsoid(face,hair,0,.25,-.015,.17,.065,.15);
    const band=mesh(face,new THREE.TorusGeometry(.222,.017,6,28),colorMaterial('#e4b25f'),0,.087,-.007);band.rotation.x=Math.PI/2;band.scale.z=.9;
  }
  const numberMat=jerseyMap(number);
  const badge=mesh(body,new THREE.PlaneGeometry(.245,.28),numberMat,0,.41,.213);badge.castShadow=false;
  const back=badge.clone();back.position.z=-.213;back.rotation.y=Math.PI;body.add(back);
  const arms=[];
  for(const s of[-1,1]){
    const arm=new THREE.Group();arm.position.set(s*.345,.65,0);body.add(arm);
    limb(arm,shirt,.24,.125);limb(arm,skin,.39,.087);
    const forearm=new THREE.Group();forearm.position.y=-.38;arm.add(forearm);limb(forearm,skin,.36,.071);
    const hand=new THREE.Group();hand.position.set(0,-.375,.006);forearm.add(hand);
    ellipsoid(hand,skin,0,-.045,.015,.078,.106,.043);ellipsoid(hand,skin,-s*.069,-.023,.034,.028,.065,.028);
    arms.push({arm,forearm,hand});
  }
  const legs=[];
  for(const s of[-1,1]){
    const leg=new THREE.Group();leg.position.set(s*.16,1.1,0);root.add(leg);
    limb(leg,shorts,.43,.153);limb(leg,skin,.52,.107);
    const knee=new THREE.Group();knee.position.y=-.5;leg.add(knee);limb(knee,skin,.45,.078);
    ellipsoid(knee,cream,0,-.37,0,.081,.12,.08);
    const shoe=mesh(knee,new THREE.CapsuleGeometry(.103,.17,4,12),shoeMaterial,0,-.49,.075,1,.82,1);shoe.rotation.x=Math.PI/2;
    ellipsoid(knee,shirt,0,-.5,-.045,.105,.075,.065);legs.push({leg,knee});
  }
  const scoop=mesh(arms[1].hand,new THREE.SphereGeometry(.075,10,7),colorMaterial('#c59962'),0,-.045,.07,1,.45,1);scoop.visible=false;
  return {root,body,face,eyes,scoop,leftLeg:legs[0].leg,rightLeg:legs[1].leg,leftKnee:legs[0].knee,rightKnee:legs[1].knee,
    leftArm:arms[0].arm,rightArm:arms[1].arm,leftElbow:arms[0].forearm,rightElbow:arms[1].forearm,leftHand:arms[0].hand,rightHand:arms[1].hand,
    last:new THREE.Vector3(),facing:0,lastTime:0,variant};
}

export function animateAthlete(a,pose){
  if(a.imported){animateImportedAthlete(a,pose);return;}
  const t=pose.time,dt=Math.max(.001,Math.min(.1,t-a.lastTime||.016));a.lastTime=t;
  const f=1-Math.exp(-17*dt),swing=pose.moving?Math.sin(t*12)*.67:0;
  const target={hip:1.1,bodyX:0,bodyY:0,bodyZ:Math.sin(t*2+a.variant)*.018,legL:swing,legR:-swing,kneeL:Math.max(0,-swing)*.8,kneeR:Math.max(0,swing)*.8,
    armL:-swing*.65,armR:swing*.65,elbowL:-.14,elbowR:-.14,armZL:.08,armZR:-.08};
  if(pose.action){
    const p=pose.actionProgress||0;
    if(pose.action==='gather'||pose.action==='right'){
      const bend=Math.sin(Math.PI*Math.min(1,p*1.15));target.hip-=.4*bend;target.bodyX=.7*bend;target.legL=target.legR=-.65*bend;target.kneeL=target.kneeR=1.25*bend;
      target.armR=-.38-.5*bend;target.elbowR=-.25;target.armL=-.4*bend;
    }else{
      target.hip-=.22;target.bodyX=.48;target.legL=target.legR=-.35;target.kneeL=target.kneeR=.7;
      target.armR=-1.02;target.elbowR=-.7;target.armL=pose.action==='empty'?-1.0:-.5;target.elbowL=-.45;
    }
  }
  if(pose.catching){target.armL=target.armR=-1.45;target.elbowL=target.elbowR=-.65;target.armZL=.18;target.armZR=-.18;}
  if(pose.holdingBall){target.armR=-1.4-(pose.charge||0)*1.05;target.elbowR=-.6;target.bodyY=-(pose.charge||0)*.35;}
  if(pose.windup){target.armR=-.7-pose.windup*1.65;target.elbowR=-.45;target.bodyY=-pose.windup*.35;}
  if(pose.feint){target.armR=-1.2+Math.sin(t*22)*.6;target.bodyY=Math.sin(t*14)*.12;}
  if(pose.throwing){target.armR=-.9+pose.throwing*.7;target.elbowR=-.08;target.bodyX=.18;}
  if(pose.jumpHeight>.05){target.legL=-.45;target.legR=.18;target.kneeL=.95;target.kneeR=.55;target.armL=-.8;target.armR=-.7;target.elbowL=target.elbowR=-.5;target.bodyX=-.07;}
  if(pose.prone){Object.assign(target,{hip:.27,bodyX:Math.PI/2,bodyY:0,bodyZ:0,legL:Math.PI/2,legR:Math.PI/2,kneeL:0,kneeR:0,armL:-1.35,armR:-1.35,elbowL:-.2,elbowR:-.2});}
  if(pose.winner){target.armL=target.armR=-2.65;target.elbowL=target.elbowR=-.35;target.bodyZ=Math.sin(t*7)*.1;}
  if(pose.loser){target.hip=.85;target.bodyX=.3;target.legL=-.3;target.legR=-.5;target.kneeL=.8;target.kneeR=1.0;target.armR=-.4;}
  const approach=(object,key,value)=>{object[key]+=(value-object[key])*f;};
  approach(a.body.position,'y',target.hip);approach(a.body.rotation,'x',target.bodyX);approach(a.body.rotation,'y',target.bodyY);approach(a.body.rotation,'z',target.bodyZ);
  for(const leg of[a.leftLeg,a.rightLeg])approach(leg.position,'y',target.hip);
  approach(a.leftLeg.rotation,'x',target.legL);approach(a.rightLeg.rotation,'x',target.legR);approach(a.leftKnee.rotation,'x',target.kneeL);approach(a.rightKnee.rotation,'x',target.kneeR);
  approach(a.leftArm.rotation,'x',target.armL);approach(a.rightArm.rotation,'x',target.armR);approach(a.leftArm.rotation,'z',target.armZL);approach(a.rightArm.rotation,'z',target.armZR);
  approach(a.leftElbow.rotation,'x',target.elbowL);approach(a.rightElbow.rotation,'x',target.elbowR);
  const blink=((t+a.variant*.9)%3.7)<.1;for(const eye of a.eyes){eye.userData.openY??=eye.scale.y;eye.scale.y+=((blink?.005:eye.userData.openY)-eye.scale.y)*.18;}
  a.face.rotation.y=Math.sin(t*.7+a.variant)*.055;a.scoop.visible=!!pose.sandInHand;
}

export function disposeAthlete(a){
 if(a.imported){disposeImportedAthlete(a);return;}
 const shared=new Set(Object.values(geometry)),geometries=new Set(),materials=new Set();
 a.root.traverse(o=>{if(o.geometry&&!shared.has(o.geometry))geometries.add(o.geometry);if(o.material?.map)materials.add(o.material);});
 for(const g of geometries)g.dispose();for(const m of materials){m.map.dispose();m.dispose();}a.root.removeFromParent();
}
