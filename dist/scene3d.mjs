import { npcAvatar } from './avatar.mjs';
import * as THREE from './vendor/three.module.min.js';
import { WORLD, clamp } from './core.mjs';
import { makeAthlete, animateAthlete, disposeAthlete } from './characters.mjs';
import { batchStatic } from './graphics.mjs';
import { Effects } from './effects.mjs';
import { heritageHouse, addFutureVillage } from './village.mjs';

const U = 1 / 40;
const toWorld = p => new THREE.Vector3((p.x - WORLD.cx) * U, 0, (p.y - WORLD.cy) * U);
const material = (color, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness: .94, flatShading: true, ...extra });
const Y = new THREE.Vector3(0, 1, 0);

function texture(width, height, paint) {
  const c = document.createElement('canvas'); c.width = width; c.height = height;
  paint(c.getContext('2d'), width, height);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
function signTexture(title, background, foreground, subtitle = '') {
  return texture(512, 160, (c,w,h) => {
    c.fillStyle = background; c.fillRect(0,0,w,h); c.strokeStyle = foreground; c.lineWidth = 4; c.strokeRect(12,12,w-24,h-24);
    c.fillStyle = foreground; c.textAlign = 'center'; c.textBaseline = 'middle'; c.font = 'bold 49px Arial'; c.fillText(title,w/2,subtitle ? 64 : 83);
    if(subtitle){c.font='19px Arial';c.fillText(subtitle,w/2,111);}
  });
}

export class LikoloScene {
  constructor(canvas, { rendererFactory } = {}) {
    this.canvas = canvas;
    this.mobile=typeof matchMedia==='function'?matchMedia('(pointer:coarse)').matches||Math.min(innerWidth,innerHeight)<600:canvas.getBoundingClientRect().width<600;
    const rendererOptions = { canvas, antialias: !this.mobile, powerPreference: 'default' };
    this.renderer = rendererFactory ? rendererFactory(rendererOptions) : new THREE.WebGLRenderer(rendererOptions);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping; this.renderer.toneMappingExposure = 1.14;
    this.renderer.shadowMap.enabled = true;this.renderer.shadowMap.autoUpdate=false;this.lastShadow=-1; this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.scene = new THREE.Scene(); this.scene.background = new THREE.Color('#e6d7b8');
    this.scene.background=texture(32,512,(c,w,h)=>{const g=c.createLinearGradient(0,0,0,h);g.addColorStop(0,'#8d6bad');g.addColorStop(.48,'#d999b0');g.addColorStop(1,'#f0c79c');c.fillStyle=g;c.fillRect(0,0,w,h);});
    this.scene.fog = new THREE.Fog('#d5a2a1', 48, 100);
    this.camera = new THREE.PerspectiveCamera(38, 1, .1, 150);
    this.raycaster = new THREE.Raycaster(); this.ground = new THREE.Plane(Y, 0); this.rayHit = new THREE.Vector3();
    this.preset = 0; this.theta = .12; this.w = 1000; this.h = 680;
    this.geometries = { box: new THREE.BoxGeometry(1,1,1), sphere: new THREE.IcosahedronGeometry(1,1), lowSphere: new THREE.IcosahedronGeometry(1,0), cylinder: new THREE.CylinderGeometry(1,1,1,8) };
    this.palette = {
      cream: material('#efe2bb'), orange: material('#d9763e'), wood: material('#815133'), darkWood: material('#564534'), blue: material('#427e8c'),
      green: material('#4e7448'), foliage: material('#5a8146'), foliageLight: material('#769249'), skin: material('#825134'), hair: material('#302c25'), sand: material('#c99256'), chalk: material('#fff3d2')
    };
    this.scene.add(new THREE.HemisphereLight('#f3cbe9','#8e6855',1.9));
    const sun = new THREE.DirectionalLight('#ffe0a5',2.55); sun.position.set(-12,22,12); sun.castShadow = true;
    this.sun=sun;sun.shadow.mapSize.set(this.mobile?512:1024,this.mobile?512:1024); Object.assign(sun.shadow.camera,{left:-23,right:23,top:23,bottom:-23,near:1,far:65});
    sun.shadow.bias=-.00025;sun.shadow.normalBias=.045;this.scene.add(sun);
    this.environment(); this.buildCourt();this.staticDrawCallsSaved=batchStatic(this.scene);this.futureProps=addFutureVillage(this);this.effects=new Effects(this.scene);
    this.actors=[this.person('#d27240','1'),this.person('#428092','2'),this.person('#376c50','TOI')];
    this.actors.push(this.person('#a66ccd','8'));this.actors[3].root.visible=false;
    this.localMark=this.label('TOI');this.scene.add(this.localMark);
    this.bottle=this.makeBottle();this.scene.add(this.bottle.group);
    this.bottleHalo=this.ring(.32,.39,'#9cf7ff');this.bottleHalo.material.depthTest=true;this.scene.add(this.bottleHalo);
    this.bottleBeacon=new THREE.Sprite(new THREE.SpriteMaterial({map:texture(64,64,(c)=>{c.strokeStyle='#153d51';c.lineWidth=12;c.beginPath();c.moveTo(17,18);c.lineTo(32,37);c.lineTo(47,18);c.stroke();c.strokeStyle='#b5fcff';c.lineWidth=6;c.stroke();}),transparent:true,depthTest:true,depthWrite:false}));this.bottleBeacon.scale.set(.42,.42,1);this.bottleBeacon.visible=false;this.scene.add(this.bottleBeacon);
    this.ball=new THREE.Group();
    const cloth = this.mesh(new THREE.IcosahedronGeometry(.205,2),material('#ca6e3e'),this.ball);
    const band = new THREE.Mesh(new THREE.TorusGeometry(.194,.019,5,28),material('#efd5a3'));band.rotation.x=.45;this.ball.add(band);
    const band2=band.clone();band2.rotation.y=1.5;this.ball.add(band2);this.scene.add(this.ball);
    this.ballShadow=this.disc(.18,'#5f422a',.16);this.scene.add(this.ballShadow);
    this.aimLine=new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(),new THREE.Vector3(1,0,0)]),new THREE.LineDashedMaterial({color:'#e5a264',transparent:true,opacity:.78,dashSize:.22,gapSize:.19}));this.scene.add(this.aimLine);
    this.targetMarker=this.ring(.33,.37,'#e69a58');this.scene.add(this.targetMarker);
    this.catchRing=this.ring(.76,.8,'#f6ebac');this.scene.add(this.catchRing);
    this.flashRing=this.ring(.8,.86,'#fff2b2');this.scene.add(this.flashRing);
    this.sandParticles=new THREE.InstancedMesh(new THREE.IcosahedronGeometry(.025,0),this.palette.sand,12);this.sandParticles.instanceMatrix.setUsage(THREE.DynamicDrawUsage);this.scene.add(this.sandParticles);this.dummy=new THREE.Object3D();
    this.fit();
  }
  mesh(geometry, mat, parent=this.scene) { const m=new THREE.Mesh(geometry,mat);m.castShadow=true;m.receiveShadow=true;parent.add(m);return m; }
  box(parent,x,y,z,w,h,d,mat) { const m=this.mesh(this.geometries.box,mat,parent);m.position.set(x,y,z);m.scale.set(w,h,d);return m; }
  sphere(parent,x,y,z,rx,ry,rz,mat,low=false){const m=this.mesh(low?this.geometries.lowSphere:this.geometries.sphere,mat,parent);m.position.set(x,y,z);m.scale.set(rx,ry,rz);return m;}
  cylinder(parent,x,y,z,r,h,mat){const m=this.mesh(this.geometries.cylinder,mat,parent);m.position.set(x,y,z);m.scale.set(r,h,r);return m;}
  ring(inner,outer,color){const m=new THREE.Mesh(new THREE.RingGeometry(inner,outer,64),new THREE.MeshBasicMaterial({color,transparent:true,opacity:.9,side:THREE.DoubleSide,depthWrite:false}));m.rotation.x=-Math.PI/2;m.position.y=.035;return m;}
  disc(radius,color,opacity=.4){const m=new THREE.Mesh(new THREE.CircleGeometry(radius,24),new THREE.MeshBasicMaterial({color,transparent:true,opacity,depthWrite:false}));m.rotation.x=-Math.PI/2;m.position.y=.025;return m;}
  label(text,color='#fff5d8',background='#2f4a3a'){
    const map=texture(256,96,(c,w,h)=>{c.fillStyle=background;c.beginPath();c.roundRect(3,3,w-6,h-6,20);c.fill();c.fillStyle=color;c.font=`bold ${text.length>4?34:45}px Arial`;c.textAlign='center';c.textBaseline='middle';c.fillText(text,w/2,h/2+2);});
    const sprite=new THREE.Sprite(new THREE.SpriteMaterial({map,transparent:true,depthWrite:false}));sprite.scale.set(text==='TOI'?.83:.65,.32,1);return sprite;
  }
  environment(){
    const soil=texture(512,512,(c,w,h)=>{c.fillStyle='#b9794d';c.fillRect(0,0,w,h);let seed=341;for(let i=0;i<9000;i++){seed=(seed*1664525+1013904223)>>>0;const x=seed%w;seed=(seed*1664525+1013904223)>>>0;const y=seed%h;c.fillStyle=i%2?'#ae6d4045':'#d49a6650';c.fillRect(x,y,i%3+1,1);}});
    soil.wrapS=soil.wrapT=THREE.RepeatWrapping;soil.repeat.set(12,12);
    const floor=this.mesh(new THREE.PlaneGeometry(130,130),material('#ffffff',{map:soil}));floor.rotation.x=-Math.PI/2;floor.position.y=-.035;floor.castShadow=false;
    const roofMap=texture(256,256,(c,w,h)=>{c.fillStyle='#899393';c.fillRect(0,0,w,h);for(let x=0;x<w;x+=16){c.fillStyle='#a4acaa';c.fillRect(x,0,3,h);c.fillStyle='#6f7a7b';c.fillRect(x+6,0,2,h);}c.fillStyle='#b28a5a44';c.fillRect(80,0,70,h);});
    roofMap.wrapS=roofMap.wrapT=THREE.RepeatWrapping;roofMap.repeat.set(3,2);this.roofMaterial=material('#e6e6d9',{map:roofMap,metalness:.18});
    this.house(-7.5,-10,6.2,4.5,3.3,'#d7a879','BOUTIQUE','DU QUARTIER');
    this.house(.1,-10.7,6.5,4.5,3.6,'#729ba1','CHEZ NOUS','BIENVENUE');
    this.house(7.5,-9.7,5.4,4.2,3.0,'#dfba7d','LA BUVETTE','BOISSONS FRAÎCHES');
    this.house(-15.5,-2,4.2,5.0,3.0,'#c18469','', '',Math.PI/2);
    this.house(15.7,-1.8,4.3,4.7,3.2,'#b9c1a0','', '',-Math.PI/2);
    // Low walls leave the players and the small centre circle unobstructed.
    this.box(this.scene,-7.2,.45,8.7,7.4,.9,.32,material('#c2a277'));
    this.box(this.scene,6.6,.4,8.6,6.0,.8,.32,material('#7d9b91'));
    this.box(this.scene,-12.5,.6,-6.5,.28,1.2,4.0,material('#c7a980'));
    this.box(this.scene,12.7,.55,-6.7,.28,1.1,3.9,material('#d4b283'));
    const muralMap=texture(768,256,(c,w,h)=>{
      c.fillStyle='#e6d3a6';c.fillRect(0,0,w,h);const colors=['#bd6241','#3f7881','#b99745','#43664a'];
      for(let i=0;i<16;i++){c.fillStyle=colors[i%4];c.beginPath();c.moveTo(i*64-40,h);c.lineTo(i*64+25,65);c.lineTo(i*64+80,h);c.fill();}
      c.fillStyle='#e6d3a6';c.fillRect(228,35,320,150);c.fillStyle='#3d5e44';c.textAlign='center';c.font='bold 76px Arial';c.fillText('LIKOLO',384,139);
    });
    const mural=this.mesh(new THREE.PlaneGeometry(6.1,1.65),new THREE.MeshBasicMaterial({map:muralMap}),this.scene);mural.position.set(0,1.08,-8.35);mural.castShadow=false;
    this.box(this.scene,0,.92,-8.45,6.4,1.84,.18,material('#e6d3a6'));
    this.market(9.9,-5.8);
    for(const [x,z,s]of[[-12,-7,1.15],[13,-8,1.25],[-15,6,1.2],[15,7,1.2],[-8,11,.9],[8,12,1],[-20,-12,1.4],[20,-13,1.6]])this.mangoTree(x,z,s);
    this.banana(-12.8,4.6,1);this.banana(12.9,4.9,1.1);this.banana(-10.5,-12.9,.9);
    this.clothesline(-9.8,6.8);
    // Neighbours at the edge of the court, in everyday clothes.
    let neighbour=2;for(const [x,z,color]of[[-7.4,-6.6,'#ba6451'],[-5.8,-6.8,'#d0b253'],[6.2,7.7,'#547f8f']]){
      const a=this.person(color,null,npcAvatar(neighbour++));a.root.position.set(x,0,z);a.root.rotation.y=z<0?0:Math.PI;a.root.scale.setScalar(.87);a.leftArm.rotation.x=-.25;a.rightArm.rotation.x=-.4;
    }
    const benchMat=this.palette.wood;this.box(this.scene,5.7,.48,8,2.4,.16,.55,benchMat);for(const x of[4.8,6.6])this.box(this.scene,x,.23,8,.13,.46,.45,benchMat);
    for(const [x,z]of[[-10.5,5.9],[10.9,-5.4]]){this.cylinder(this.scene,x,.42,z,.34,.84,material('#638481'));this.cylinder(this.scene,x,.86,z,.35,.06,material('#adb0a0'));}
    // Soft clouds and distant roofs complete the view without external textures.
    for(const [x,z]of[[-27,-25],[-13,-28],[7,-29],[26,-23]]){
      this.box(this.scene,x,1.6,z,5,3.2,4,material('#c6aa83'));this.box(this.scene,x,3.3,z,5.5,.2,4.5,this.roofMaterial);
    }
  }
  house(x,z,w,d,h,color,title,subtitle='',rotation=0){
    return heritageHouse(this,x,z,w,d,h,color,title,subtitle,rotation,texture,signTexture);
  }
  market(x,z){
    const g=new THREE.Group();g.position.set(x,0,z);this.scene.add(g);
    this.box(g,0,.78,0,2.5,.16,1.0,this.palette.wood);for(const a of[-1,1])for(const b of[-1,1])this.box(g,a*1.08,.36,b*.35,.1,.72,.1,this.palette.darkWood);
    for(let i=0;i<3;i++){
      this.box(g,-.78+i*.78,.97,0,.66,.25,.75,material('#b28752'));
      const produce=this.mesh(new THREE.IcosahedronGeometry(.12,0),material(['#b4a642','#c87b3d','#7a973e'][i]),g);
      for(let k=0;k<7;k++){const fruit=k===0?produce:produce.clone();if(k>0)g.add(fruit);fruit.position.set(-.98+i*.78+(k%3)*.19,1.14+(k>5?.12:0),-.18+Math.floor(k/3)*.17);}
    }
    this.box(g,0,2.3,0,2.8,.08,1.5,material('#dbb966'));
    for(const a of[-1,1])this.cylinder(g,a*1.26,1.16,-.5,.035,2.32,this.palette.wood);
  }
  mangoTree(x,z,scale){
    const g=new THREE.Group();g.position.set(x,0,z);g.scale.setScalar(scale);this.scene.add(g);
    this.cylinder(g,0,1.3,0,.17,2.6,this.palette.wood);
    this.sphere(g,0,3.1,0,1.75,1.55,1.5,this.palette.foliage,true);this.sphere(g,-.85,2.8,.35,1.15,1.0,1.1,this.palette.foliageLight,true);this.sphere(g,.9,3.1,-.25,1.15,1.12,1.03,this.palette.green,true);
    for(const [a,b,c]of[[-1,2.8,1.0],[.8,2.7,.9],[.3,3.6,1.0]])this.sphere(g,a,b,c,.1,.13,.1,material('#c9a151'),true);
  }
  banana(x,z,scale){
    const group=new THREE.Group();group.position.set(x,0,z);group.scale.setScalar(scale);this.scene.add(group);this.cylinder(group,0,1.1,0,.12,2.2,material('#8c9b4e'));
    for(let i=0;i<7;i++){
      const a=i*Math.PI*2/7;const shape=new THREE.Shape();shape.moveTo(0,0);shape.quadraticCurveTo(.55,.8,.05,2.0);shape.quadraticCurveTo(-.5,.8,0,0);
      const leaf=this.mesh(new THREE.ShapeGeometry(shape,6),material(i%2?'#5a8445':'#779543',{side:THREE.DoubleSide}),group);leaf.position.set(0,2.05,0);leaf.rotation.set(-.48,a,.18);leaf.rotateX(.65);leaf.rotateZ(Math.PI/2);
    }
  }
  clothesline(x,z){
    for(const off of[-1.9,1.9])this.cylinder(this.scene,x+off,1.12,z,.045,2.25,this.palette.wood);
    const line=new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(x-1.9,2.2,z),new THREE.Vector3(x+1.9,2.2,z)]),new THREE.LineBasicMaterial({color:'#66553b'}));this.scene.add(line);
    for(let i=0;i<5;i++){const shirt=this.box(this.scene,x-1.4+i*.69,1.77,z,.48,.72,.035,material(['#dba158','#648c9b','#e6dbb7','#bc6e5b','#83a781'][i]));shirt.rotation.z=(i%2?.05:-.04);}
  }
  buildCourt(){
    const court=this.mesh(new THREE.PlaneGeometry(23.8,13.0),material('#ca995f'));court.rotation.x=-Math.PI/2;court.position.y=.004;court.castShadow=false;
    const patch=this.mesh(new THREE.CircleGeometry(WORLD.radius*U,48),material('#dac294'));patch.rotation.x=-Math.PI/2;patch.position.y=.009;patch.castShadow=false;
    const white=this.palette.chalk;
    for(const z of[-5.1,5.1])this.box(this.scene,0,.022,z,18.2,.022,.035,white);
    for(const x of[-9.1,9.1])this.box(this.scene,x,.022,0,.035,.022,10.2,white);
    this.circle=this.ring(WORLD.radius*U,WORLD.radius*U+.065,'#fff2d0');this.scene.add(this.circle);
    const scuff=this.ring(WORLD.radius*U+.085,WORLD.radius*U+.105,'#f0d4a2');scuff.material.opacity=.35;this.scene.add(scuff);
    for(const x of[-10.625,10.625]){const marker=this.ring(.54,.58,'#f3dab3');marker.position.x=x;marker.material.opacity=.6;this.scene.add(marker);}
    // Sparse ground detail is one draw call.
    let seed=81;const positions=[];for(let i=0;i<600;i++){seed=(seed*1664525+1013904223)>>>0;const x=seed/4294967296*24-12;seed=(seed*1664525+1013904223)>>>0;positions.push(x,.027,seed/4294967296*13-6.5);}
    const grains=new THREE.BufferGeometry();grains.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));this.scene.add(new THREE.Points(grains,new THREE.PointsMaterial({color:'#946c44',size:.022,transparent:true,opacity:.28})));
  }
  person(shirtColor,text,avatar=null){
    const variant=text==='1'?0:text==='2'?1:2;
    const a=makeAthlete({color:shirtColor,number:text==='TOI'?'7':text||'3',variant,avatar});this.scene.add(a.root);
    if(text){const badge=this.label(text==='TOI'?'7':text,text==='TOI'?'#fff5dd':'#fff4d6',text==='TOI'?'#2c5c43':shirtColor);badge.position.y=2.73;a.root.add(badge);}
    return a;
  }
  makeBottle(){
    const group=new THREE.Group();group.scale.setScalar(1.65);
    const glass=material('#96e5ed',{transparent:true,opacity:.78,depthWrite:false,roughness:.22});
    const body=this.mesh(new THREE.CylinderGeometry(.14,.15,.48,12),glass,group);body.position.y=.24;
    const shoulder=this.mesh(new THREE.CylinderGeometry(.065,.14,.13,12),glass,group);shoulder.position.y=.545;
    const neck=this.mesh(new THREE.CylinderGeometry(.065,.065,.14,10),glass,group);neck.position.y=.68;
    const rim=this.mesh(new THREE.TorusGeometry(.066,.018,6,20),material('#ffe28c'),group);rim.rotation.x=Math.PI/2;rim.position.y=.765;
    const sand=this.mesh(new THREE.CylinderGeometry(.118,.13,.44,12),material('#eec174'),group);sand.position.y=.05;
    for(const part of [body,shoulder,neck]){const outline=new THREE.LineSegments(new THREE.EdgesGeometry(part.geometry,25),new THREE.LineBasicMaterial({color:'#cbfcff',transparent:true,opacity:.85,depthTest:true,depthWrite:false}));outline.position.copy(part.position);group.add(outline);}
    return{group,sand};
  }
  fit(){
    const rect=this.canvas.getBoundingClientRect();this.w=Math.max(1,rect.width);this.h=Math.max(1,rect.height);this.portrait=this.w/this.h<1;
    this.theta=(this.portrait?Math.PI/2:.12)+[0,.32,-.32][this.preset];
    const elevation=.78,fov=this.portrait?43:38,aspect=this.w/this.h;
    const horizontal=Math.abs(Math.cos(this.theta))*25.5+Math.abs(Math.sin(this.theta))*16.8;
    const vertical=(Math.abs(Math.sin(this.theta))*25.5+Math.abs(Math.cos(this.theta))*16.8)*Math.sin(elevation)+3.1;
    const distance=Math.max(horizontal/(2*Math.tan(fov*Math.PI/360)*aspect),vertical/(2*Math.tan(fov*Math.PI/360)))*1.17;
    this.camera.fov=fov;this.camera.aspect=aspect;this.camera.position.set(Math.sin(this.theta)*Math.cos(elevation)*distance,Math.sin(elevation)*distance,Math.cos(this.theta)*Math.cos(elevation)*distance);
    this.playCameraPosition=this.camera.position.clone();this.camera.lookAt(0,.45,0);this.camera.updateProjectionMatrix();this.camera.updateMatrixWorld(true);
    const mobile=typeof matchMedia==='function'?matchMedia('(pointer:coarse)').matches||Math.min(innerWidth,innerHeight)<600:this.w<600;this.mobile=mobile;
    const shadowSize=mobile?512:1024;if(this.sun.shadow.mapSize.x!==shadowSize){this.sun.shadow.mapSize.set(shadowSize,shadowSize);this.sun.shadow.map?.dispose();this.sun.shadow.map=null;}
    this.renderer.shadowMap.needsUpdate=true;this.renderer.setPixelRatio(Math.min(devicePixelRatio||1,mobile?1:1.5));this.renderer.setSize(this.w,this.h,false);
  }
  changeView(){this.preset=(this.preset+1)%3;this.fit();return this.preset;}
  screenVector(x,y){const c=Math.cos(this.theta),s=Math.sin(this.theta);return{x:c*x+s*y,y:-s*x+c*y};}
  worldAt(x,y){
    this.raycaster.setFromCamera(new THREE.Vector2(x/this.w*2-1,-y/this.h*2+1),this.camera);
    if(!this.raycaster.ray.intersectPlane(this.ground,this.rayHit))return null;
    return{x:this.rayHit.x/U+WORLD.cx,y:this.rayHit.z/U+WORLD.cy};
  }
  handleEvent(event,game,demo=false){
    let type=event,position=toWorld(game.player);position.y=(game.player.height||0)+1.15;
    if(['bottleHit','topple','right','pour','gather','full'].includes(event)){position=toWorld(game.bottle);position.y=event==='full'?1:.35;}
    if(event==='shot'){position=toWorld(game.throwers[game.ball.owner??0]);position.y=1.6;if(game.ball.tempo==='rapide')type='fastShot';}
    if(event==='fastShot'){position=toWorld(game.player);position.y=1.4;}
    if(['land','jumpDodge'].includes(event))position.y=.08;
    this.effects.burst(type,position,demo?{duration:2.1}:{});
  }
  render(game,input,t){
    const positions=[...game.throwers,...(game.centers??[game.player])],active=game.status==='playing',b=game.ball;
    const ready=game.status==='ready';
    const cameraTarget=ready?new THREE.Vector3(Math.sin(this.theta)*10.8,5.8,Math.cos(this.theta)*10.8):this.playCameraPosition;
    this.camera.position.lerp(cameraTarget,.11);
    const heroOffset=ready&&this.portrait?2.6:0;
    this.camera.lookAt(-Math.cos(this.theta)*heroOffset,ready?1.05:.45,Math.sin(this.theta)*heroOffset);this.camera.updateMatrixWorld(true);
    for(let i=0;i<this.actors.length;i++){
      const role=i<2?'t'+i:'c'+(i-2),appearance=game.appearances?.[role],key=appearance?JSON.stringify(appearance):'';
      if(key!==(this.actors[i].appearanceKey??'')){const old=this.actors[i];const next=this.person(i===0?'#df844a':i===1?'#467cb2':'#37765a',i<2?String(i+1):i===2?'TOI':'',appearance);next.last.copy(old.last);next.facing=old.facing;next.appearanceKey=key;disposeAthlete(old);this.actors[i]=next;}
      const a=this.actors[i];a.root.visible=!!positions[i];if(!positions[i])continue;
      const center=i>=2,state=game.centerStates?.[i-2]??game,actor=positions[i],p=toWorld(actor),moving=active&&p.distanceToSquared(a.last)>.000015;
      const dx=p.x-a.last.x,dz=p.z-a.last.z;
      if(moving)a.facing=Math.atan2(dx,dz);else if(i<2&&b.state!=='retrieving')a.facing=Math.atan2(game.player.x-positions[i].x,game.player.y-positions[i].y);
      if(i===2&&ready)a.facing=this.theta;
      if(center&&state.action)a.facing=Math.atan2(game.bottle.x-actor.x,game.bottle.y-actor.y);
      if(i<2&&actor.intercepting&&!moving)a.facing=Math.atan2(b.x-actor.x,b.y-actor.y);
      if(center&&!state.action&&b.state==='flying')a.facing=Math.atan2(b.x-actor.x,b.y-actor.y);
      a.root.position.copy(p);a.root.position.y=center?(actor.height||0):0;a.root.rotation.y=a.facing;a.last.copy(p);
      const winding=i<2&&active&&b.state==='aiming'&&b.owner===i;
      animateAthlete(a,{time:t,moving,action:center?state.action?.kind:null,actionProgress:state.action?state.action.elapsed/state.action.duration:0,jumpHeight:center?actor.height:0,prone:!!actor.prone,
        catching:center?state.time<state.catchUntil:(game.simulationTime??game.time)<actor.catchUntil,holdingBall:(b.state==='held'&&(b.holder?b.holder===(center?'c'+(i-2):'t'+i):i===2))||(i<2&&b.owner===i&&b.state==='returnToPost'),charge:game.charge(),
        windup:winding?(actor.chargeStart!=null?clamp(((game.simulationTime??game.time)-actor.chargeStart)/1.1,0,1):1-clamp(b.timer/1.35,0,1)):0,feint:winding&&b.feintUntil>game.time,
        throwing:i===2&&b.state==='retrieving'&&b.elapsed<.3?b.elapsed/.3:0,
        sandInHand:i===2&&(game.sandInHand||(game.action?.kind==='pour'&&game.actionProgress()<.55)),winner:i===2&&game.status==='won',loser:i===2&&game.status==='lost'});
    }
    const local=game.localActor??game.player;this.localMark.position.copy(toWorld(local));this.localMark.position.y=(local.height||0)+(local.prone?.9:3.15);
    this.scene.updateMatrixWorld(true);
    const bottle=this.bottle.group,progress=game.actionProgress();
    const desiredAngle=game.action?.kind==='right'?(1-progress)*1.5:!game.bottle.upright?1.5:game.action?.kind==='empty'?1.32:0;
    this.bottleAngle=(this.bottleAngle||0)+(desiredAngle-(this.bottleAngle||0))*.18;
    bottle.position.copy(toWorld(game.bottle));const angle=this.bottleAngle,scale=bottle.scale.x;
    bottle.position.y=.025+scale*(Math.sin(Math.abs(angle))*.15);bottle.rotation.set(0,0,this.bottleAngle);
    const locate=toWorld(game.bottle);this.bottleHalo.position.set(locate.x,.055,locate.z);this.bottleHalo.scale.setScalar(1+Math.sin(t*4)*.07);this.bottleHalo.material.color.set(game.bottle.upright?'#9cf7ff':'#ffb590');this.bottleBeacon.position.set(locate.x,1.83+Math.sin(t*3)*.07,locate.z);
    this.bottle.sand.scale.y=Math.max(.001,game.fill);this.bottle.sand.position.y=.06+game.fill*.22;
    this.sandParticles.visible=(game.action?.kind==='pour'&&progress>.42)||game.action?.kind==='empty';
    if(this.sandParticles.visible){
      const mouth=new THREE.Vector3(0,.82,0).applyEuler(bottle.rotation).add(bottle.position);
      for(let i=0;i<12;i++){const f=(t*1.9+i/12)%1;this.dummy.position.copy(mouth);this.dummy.position.x+=Math.sin(i*3)*.045;this.dummy.position.y+=game.phase==='fill'?.45-f*.45:-f*Math.max(.1,mouth.y);this.dummy.position.z+=Math.cos(i*2)*.04;this.dummy.updateMatrix();this.sandParticles.setMatrixAt(i,this.dummy.matrix);}this.sandParticles.instanceMatrix.needsUpdate=true;
    }
    this.ball.visible=true;
    if(b.state==='held'||b.state==='aiming'||b.state==='returnToPost'){
      const hand=this.actors[b.state==='held'?(b.holder?(b.holder[0]==='c'?2+Number(b.holder[1]):Number(b.holder[1])):2):b.owner].rightHand;const v=new THREE.Vector3(0,-.035,.085);hand.localToWorld(v);this.ball.position.copy(v);
    }else{this.ball.position.copy(toWorld(b));this.ball.position.y=b.height??1.05;}
    this.ball.rotation.set(t*2,t*3,t);this.ballShadow.position.set(this.ball.position.x,.031,this.ball.position.z);this.ballShadow.material.opacity=.19/Math.max(1,this.ball.position.y*.65);
    const telegraph=active&&((b.state==='aiming'&&!!b.target)||!!game.aimPreview);
    this.aimLine.visible=this.targetMarker.visible=telegraph;
    if(telegraph){
      const from=toWorld(game.aimPreview?.from??game.throwers[b.owner]),to=toWorld(game.aimPreview?.to??b.target);from.y=to.y=.045;
      const high=b.plan?.style==='haut';this.aimLine.material.color.set(high?'#c8839d':'#e5a264');this.targetMarker.material.color.set(high?'#c8839d':'#e69a58');
      const attr=this.aimLine.geometry.attributes.position;attr.setXYZ(0,from.x,from.y,from.z);attr.setXYZ(1,to.x,to.y,to.z);attr.needsUpdate=true;this.aimLine.geometry.computeBoundingSphere();this.aimLine.computeLineDistances();
      this.targetMarker.position.set(to.x,.04,to.z);const pulse=1+Math.sin(t*11)*.09;this.targetMarker.scale.setScalar(pulse);
    }
    const p=toWorld(game.player);this.catchRing.visible=active&&game.time<game.catchUntil;this.catchRing.position.set(p.x,.046,p.z);
    this.flashRing.visible=game.flash>0;this.flashRing.position.set(p.x,.048,p.z);this.flashRing.scale.setScalar(1+(1-game.flash/.45)*1.4);this.flashRing.material.opacity=game.flash/.45;
    this.effects.update(t,active?b:null);
    for(const prop of this.futureProps){prop.group.position.y=prop.y+Math.sin(t*.7+prop.phase)*.16;if(prop.spin)prop.group.rotation.y=t*.4+prop.phase;}
    if(t-this.lastShadow>(this.mobile?1/10:1/24)){this.renderer.shadowMap.needsUpdate=true;this.lastShadow=t;}
    this.renderer.render(this.scene,this.camera);
  }
}
