import * as THREE from './vendor/three.module.min.js';

export const FX_STYLES = {
  lose: { color:'#ff7437', count:76, speed:4.6, duration:.85, shape:1, size:20, ring:true },
  catch: { color:'#62f6eb', count:48, speed:2.8, duration:.7, shape:0, size:18, ring:true, inward:true },
  topple: { color:'#d495ff', count:42, speed:2.6, duration:.8, shape:2, size:16, ring:true },
  bottleHit: { color:'#bd8cff', count:24, speed:2.0, duration:.45, shape:2, size:14 },
  right: { color:'#7df3b6', count:24, speed:1.5, duration:.7, shape:1, size:13, ring:true },
  pour: { color:'#ffd67c', count:18, speed:1.0, duration:.45, shape:0, size:10 },
  gather: { color:'#e6bb76', count:12, speed:.8, duration:.42, shape:2, size:9 },
  shot: { color:'#ffca68', count:16, speed:2.3, duration:.35, shape:1, size:14 },
  fastShot: { color:'#75eaff', count:36, speed:4.0, duration:.55, shape:2, size:18, ring:true },
  throw: { color:'#ffa976', count:26, speed:3.3, duration:.5, shape:1, size:15, ring:true },
  full: { color:'#ffe694', count:44, speed:2.5, duration:1.0, shape:1, size:15, ring:true },
  win: { color:'#a0ffcd', count:90, speed:4.2, duration:1.5, shape:1, size:17, ring:true },
  jumpDodge: { color:'#c1f2ff', count:20, speed:1.8, duration:.5, shape:0, size:11, ring:true },
  land: { color:'#d6aa77', count:10, speed:.9, duration:.35, shape:0, size:9 }
};
export class Effects {
  constructor(scene,{capacity=440}={}) {
    this.capacity=capacity;this.cursor=0;this.items=Array.from({length:capacity},()=>({life:0}));this.lastTime=null;this.trailClock=0;
    this.positions=new Float32Array(capacity*3);this.colors=new Float32Array(capacity*3);this.sizes=new Float32Array(capacity);this.alphas=new Float32Array(capacity);this.shapes=new Float32Array(capacity);
    const g=new THREE.BufferGeometry();for(const [key,array,size]of[['position',this.positions,3],['tint',this.colors,3],['size',this.sizes,1],['alpha',this.alphas,1],['shape',this.shapes,1]])g.setAttribute(key,new THREE.BufferAttribute(array,size).setUsage(THREE.DynamicDrawUsage));
    const m=new THREE.ShaderMaterial({transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,
      vertexShader:`attribute vec3 tint; attribute float size; attribute float alpha; attribute float shape; varying vec3 vTint; varying float vAlpha; varying float vShape;
        void main(){vec4 mv=modelViewMatrix*vec4(position,1.0);gl_Position=projectionMatrix*mv;gl_PointSize=clamp(size*24.0/max(2.0,-mv.z),1.0,55.0);vTint=tint;vAlpha=alpha;vShape=shape;}`,
      fragmentShader:`varying vec3 vTint;varying float vAlpha;varying float vShape;
        void main(){vec2 p=gl_PointCoord-.5;float d=length(p)*2.0;float a=pow(max(0.0,1.0-d),1.8);
        if(vShape>0.5&&vShape<1.5){float cross=pow(max(0.0,1.0-min(abs(p.x),abs(p.y))*15.0),2.0);a=max(a,cross*max(0.0,1.0-d)*.8);}
        if(vShape>1.5){a*=1.0-smoothstep(.08,.34,abs(p.x+p.y*.35));}if(a*vAlpha<.015)discard;gl_FragColor=vec4(vTint,a*vAlpha);}`});
    this.points=new THREE.Points(g,m);this.points.frustumCulled=false;this.points.renderOrder=3;scene.add(this.points);
    this.rings=Array.from({length:12},()=>{const mesh=new THREE.Mesh(new THREE.RingGeometry(.92,1,56),new THREE.MeshBasicMaterial({color:'#ffffff',transparent:true,opacity:0,depthWrite:false,side:THREE.DoubleSide,blending:THREE.AdditiveBlending}));mesh.visible=false;scene.add(mesh);return{mesh,life:0,duration:1,scale:1};});
  }
  burst(type,position,options={}) {
    const style={...FX_STYLES[type],...options};if(!FX_STYLES[type])return;
    const color=new THREE.Color(style.color);
    for(let n=0;n<style.count;n++){
      const i=this.cursor++%this.capacity,p=this.items[i],a=n*2.399963+Math.random()*.3,z=1-2*(n+.5)/style.count,r=Math.sqrt(1-z*z);
      const direction=new THREE.Vector3(Math.cos(a)*r,z,Math.sin(a)*r),speed=style.speed*(.4+Math.random()*.7);
      const start=position.clone();if(style.inward)start.addScaledVector(direction,.9);
      Object.assign(p,{x:start.x,y:start.y,z:start.z,vx:direction.x*speed*(style.inward?-.65:1),vy:direction.y*speed*(style.inward?-.65:1)+.7,vz:direction.z*speed*(style.inward?-.65:1),life:style.duration*(.6+Math.random()*.4),duration:style.duration,gravity:type==='catch'?0:2.5,size:style.size});
      this.colors.set([color.r,color.g,color.b],i*3);this.shapes[i]=style.shape;
    }
    if(style.ring){const r=this.rings.find(r=>r.life<=0)||this.rings[0];r.life=r.duration=style.duration;r.scale=type==='lose'?2.4:type==='catch'?1.55:1.1;r.mesh.position.copy(position);r.mesh.rotation.set(type==='topple'||type==='right'?-Math.PI/2:0,0,0);r.mesh.material.color.copy(color);r.mesh.visible=true;}
  }
  update(time,ball=null) {
    const dt=this.lastTime===null?0:Math.min(.08,Math.max(0,time-this.lastTime));this.lastTime=time;
    if(ball?.state==='flying'){
      this.trailClock+=dt;const fast=ball.tempo==='rapide';
      if(this.trailClock>(fast?.022:.075)){this.trailClock=0;this.burst(fast?'fastShot':'shot',new THREE.Vector3((ball.x-500)/40,ball.height??1,(ball.y-340)/40),{count:fast?2:1,speed:.12,duration:fast?.26:.4,size:fast?16:9,ring:false,color:fast?'#8bebff':'#ffe2a5',shape:fast?2:0});}
    }
    for(let i=0;i<this.capacity;i++){
      const p=this.items[i];p.life-=dt;
      if(p.life>0){p.vy-=p.gravity*dt;p.x+=p.vx*dt;p.y+=p.vy*dt;p.z+=p.vz*dt;this.positions.set([p.x,p.y,p.z],i*3);this.sizes[i]=p.size;this.alphas[i]=Math.min(1,p.life/p.duration*1.6);}else{this.alphas[i]=0;this.sizes[i]=0;}
    }
    for(const r of this.rings){if(r.life<=0)continue;r.life-=dt;const t=1-r.life/r.duration;r.mesh.scale.setScalar(.15+t*r.scale);r.mesh.material.opacity=Math.max(0,1-t)*.9;r.mesh.visible=r.life>0;}
    for(const a of Object.values(this.points.geometry.attributes))a.needsUpdate=true;
  }
  reset(){for(const p of this.items)p.life=0;for(const r of this.rings){r.life=0;r.mesh.visible=false;}this.lastTime=null;}
  activeCount(){return this.items.filter(p=>p.life>0).length;}
}
