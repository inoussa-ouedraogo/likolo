import * as THREE from './vendor/three.module.min.js';
const mat=(color,extra={})=>new THREE.MeshStandardMaterial({color,roughness:.92,...extra});

export function heritageHouse(host,x,z,w,d,h,color,title,subtitle,rotation,texture,signTexture){
  const g=new THREE.Group();g.position.set(x,0,z);g.rotation.y=rotation;host.scene.add(g);
  const timber=host.palette.darkWood,plaster=mat(color);
  host.box(g,0,h/2,0,w,h,d,plaster);host.box(g,0,.13,0,w+.3,.26,d+.3,mat('#a89c80'));
  for(const sx of[-1,1])for(const sz of[-1,1])host.box(g,sx*(w/2-.08),h/2,sz*(d/2+.025),.15,h,.16,timber);
  for(const y of[.36,h-.12])host.box(g,0,y,d/2+.04,w,.12,.12,timber);
  if(!host.thatchMaterial){const map=texture(512,512,(c,W,H)=>{
    c.fillStyle='#c39548';c.fillRect(0,0,W,H);let seed=527;
    for(let i=0;i<7000;i++){seed=(seed*1664525+1013904223)>>>0;const a=seed%W;seed=(seed*1664525+1013904223)>>>0;const b=seed%H;
      c.strokeStyle=['#eed18b','#9a7135','#dcb35f','#b18440'][i%4];c.lineWidth=1;c.beginPath();c.moveTo(a,b);c.lineTo(a+3,b+12+(i%20));c.stroke();}
  });map.wrapS=map.wrapT=THREE.RepeatWrapping;map.repeat.set(5,1);host.thatchMaterial=mat('#ead29b',{map});}
  const profile=[new THREE.Vector2(.03,.95),new THREE.Vector2(.28,.91),new THREE.Vector2(.57,.73),new THREE.Vector2(.85,.4),new THREE.Vector2(1.02,.15),new THREE.Vector2(1.08,.08),new THREE.Vector2(1.09,0)];
  const roof=host.mesh(new THREE.LatheGeometry(profile.reverse(),40),host.thatchMaterial,g);roof.name='thatched-roof';roof.position.y=h;roof.scale.set(w/2+.32,1,d/2+.35);
  for(const [r,y]of[[1.055,.1],[.85,.4]]){const tie=host.mesh(new THREE.TorusGeometry(r,.018,5,48),mat('#795a35'),g);tie.rotation.x=Math.PI/2;tie.position.y=h+y;tie.scale.set(w/2+.32,d/2+.35,1);}
  host.box(g,-w*.23,1.02,d/2+.05,.86,2.04,.08,timber);
  const door=host.box(g,-w*.23,.94,d/2+.1,.68,1.86,.06,mat('#925b3c'));
  for(let n=0;n<5;n++)host.box(g,-w*.23-.28+n*.14,.95,d/2+.14,.018,1.8,.025,mat('#603f30'));
  host.box(g,w*.22,1.4,d/2+.055,1.03,1.05,.08,timber);
  for(let i=0;i<5;i++){host.box(g,w*.22-.43+i*.215,1.4,d/2+.105,.025,.96,.03,mat('#d1b780'));host.box(g,w*.22,1.0+i*.2,d/2+.12,.92,.025,.03,mat('#d1b780'));}
  host.box(g,0,.16,d/2+.35,w*.75,.32,.6,mat('#aaa188'));
  if(title){const sign=host.mesh(new THREE.PlaneGeometry(w*.67,.58),new THREE.MeshBasicMaterial({map:signTexture(title,'#edd7a2','#614b38',subtitle)}),g);sign.position.set(0,h-.45,d/2+.1);sign.castShadow=false;}
  // Original pottery at the door, echoing the supplied village reference.
  const pot=host.mesh(new THREE.LatheGeometry([new THREE.Vector2(.13,0),new THREE.Vector2(.27,.12),new THREE.Vector2(.29,.4),new THREE.Vector2(.13,.63),new THREE.Vector2(.15,.7)],16),mat('#b47c55'),g);pot.position.set(w*.4,0,d/2+.35);
  return g;
}

export function addFutureVillage(host){
  const animated=[];
  const cyan=mat('#8ae6df',{emissive:'#29d8d6',emissiveIntensity:1.7}),violet=mat('#c79bdf',{emissive:'#995ce8',emissiveIntensity:1.2});
  for(const [x,z,hue]of[[-12,5,cyan],[12.5,5,violet],[-11,-6,cyan],[12,-6,violet]]){
    host.cylinder(host.scene,x,.25,z,.48,.5,mat('#665869'));
    const ring=host.mesh(new THREE.TorusGeometry(.45,.045,7,32),hue);ring.rotation.x=Math.PI/2;ring.position.set(x,.51,z);
    const crystal=host.mesh(new THREE.OctahedronGeometry(.36,0),hue);crystal.position.set(x,1.22,z);crystal.scale.y=1.6;animated.push({group:crystal,y:1.22,phase:x,spin:true});
  }
  for(let n=0;n<4;n++){
    const g=new THREE.Group();g.position.set(-7+n*4.8,5.1+(n%2)*1.0,-17-n%2);host.scene.add(g);
    const slab=host.mesh(new THREE.CylinderGeometry(1.4,1.1,.45,7),mat('#ae8268'),g);slab.rotation.z=.1*(n-1);
    const trim=host.mesh(new THREE.TorusGeometry(1.15,.035,6,40),n%2?cyan:violet,g);trim.rotation.x=Math.PI/2;trim.position.y=-.23;
    host.cylinder(g,0,.27,0,.8,.13,mat('#d3ac78'));animated.push({group:g,y:g.position.y,phase:n*2,spin:false});
  }
  // Wooden furniture and stepping stones stay outside the playing area.
  for(const [x,z]of[[-6,7.2],[7,-7]]){
    for(let i=0;i<7;i++)host.box(host.scene,x-.9+i*.3,.7,z,.24,.1,1.05,host.palette.wood);
    for(const sx of[-1,1])for(const sz of[-1,1])host.cylinder(host.scene,x+sx*.85,.34,z+sz*.4,.045,.68,host.palette.darkWood);
    const bowl=host.mesh(new THREE.LatheGeometry([new THREE.Vector2(.02,0),new THREE.Vector2(.14,.03),new THREE.Vector2(.24,.19)],16),mat('#c19160',{side:THREE.DoubleSide}));bowl.position.set(x,.77,z);
  }
  for(let i=0;i<14;i++){const x=-10+i*1.5,z=6.7+Math.sin(i)*.22;const s=host.mesh(new THREE.CylinderGeometry(.3+(i%3)*.07,.35,.07,6),mat('#cda776'));s.position.set(x,.05,z);s.rotation.y=i*.8;}
  return animated;
}
