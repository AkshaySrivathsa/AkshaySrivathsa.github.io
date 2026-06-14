/* ============================================================================
   NEURAL — transparent high-bloom brain built from the downloaded OBJ model
   ========================================================================== */

import * as THREE from 'three';
import { OBJLoader }         from 'three/addons/loaders/OBJLoader.js';
import { GLTFLoader }        from 'three/addons/loaders/GLTFLoader.js';
import { MeshSurfaceSampler} from 'three/addons/math/MeshSurfaceSampler.js';
import { EffectComposer }    from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass }        from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass }   from 'three/addons/postprocessing/UnrealBloomPass.js';

const clamp=(v,a,b)=>Math.min(b,Math.max(a,v));
const lerp=(a,b,t)=>a+(b-a)*t;
const easeOut=t=>1-Math.pow(1-t,3);
const smooth=t=>t*t*(3-2*t);
const rand=(a,b)=>a+Math.random()*(b-a);

const COL_GOLD  = new THREE.Color("#e1a13a");
const COL_GHOT  = new THREE.Color("#ffc45a");
const COL_BLUE  = new THREE.Color("#2c88dc");
const COL_BHOT  = new THREE.Color("#67bbff");
const COL_SHELL = new THREE.Color("#6d8dac");
const COL_RIM   = new THREE.Color("#7fb6df");

const canvas=document.getElementById('scene');
const mobile=/Mobi|Android|iPhone|iPad/i.test(navigator.userAgent)||innerWidth<760;
const renderer=new THREE.WebGLRenderer({canvas,antialias:!mobile,powerPreference:'high-performance',alpha:false});
renderer.setPixelRatio(Math.min(devicePixelRatio||1,mobile?1.35:1.8));
renderer.setSize(innerWidth,innerHeight);
renderer.outputColorSpace=THREE.SRGBColorSpace;
renderer.toneMapping=THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure=0.9;

const scene=new THREE.Scene();
scene.background=new THREE.Color(0x01031f);
scene.fog=new THREE.FogExp2(0x01031f,0.03);

const camera=new THREE.PerspectiveCamera(42,innerWidth/innerHeight,0.1,220);
camera.position.set(0,0,17);
camera.lookAt(0,0,0);

scene.add(new THREE.AmbientLight(0x7c8fa3,0.28));
const key=new THREE.DirectionalLight(0xf3f8ff,2.2); key.position.set(-4,4,7); scene.add(key);
const blueKey=new THREE.PointLight(0x58bfff,2.2,32,1.7); blueKey.position.set(5,1,8); scene.add(blueKey);
const goldKey=new THREE.PointLight(0xffc65a,1.8,28,1.9); goldKey.position.set(-5,-2,6); scene.add(goldKey);

const brain=new THREE.Group();
scene.add(brain);

function discTexture(){
  const s=96,c=document.createElement('canvas'); c.width=c.height=s;
  const x=c.getContext('2d'); const g=x.createRadialGradient(s/2,s/2,0,s/2,s/2,s/2);
  g.addColorStop(0,'rgba(255,255,255,1)');
  g.addColorStop(0.24,'rgba(255,255,255,0.88)');
  g.addColorStop(0.58,'rgba(255,255,255,0.25)');
  g.addColorStop(1,'rgba(255,255,255,0)');
  x.fillStyle=g; x.fillRect(0,0,s,s);
  const tex=new THREE.CanvasTexture(c); tex.colorSpace=THREE.SRGBColorSpace; return tex;
}
const DISC=discTexture();
function pointMat(scale){ return new THREE.ShaderMaterial({
  uniforms:{uTex:{value:DISC},uScale:{value:renderer.getPixelRatio()*scale}},
  vertexShader:`attribute float aSize; varying vec3 vC; uniform float uScale;
    void main(){ vC=color; vec4 mv=modelViewMatrix*vec4(position,1.0); gl_PointSize=aSize*uScale/-mv.z; gl_Position=projectionMatrix*mv; }`,
  fragmentShader:`uniform sampler2D uTex; varying vec3 vC;
    void main(){ vec4 t=texture2D(uTex,gl_PointCoord); if(t.a<0.025) discard; gl_FragColor=vec4(vC,t.a); }`,
  transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,vertexColors:true,toneMapped:false,
}); }

const halo=new THREE.Sprite(new THREE.SpriteMaterial({map:DISC,color:0xeaf6ff,transparent:true,opacity:0,blending:THREE.AdditiveBlending,depthWrite:false}));
halo.scale.set(0.72,0.72,1); scene.add(halo);

const DUST=mobile?80:145;
const dPos=new Float32Array(DUST*3),dCol=new Float32Array(DUST*3),dSize=new Float32Array(DUST),dVel=[];
for(let i=0;i<DUST;i++){
  dPos[i*3]=rand(-19,19); dPos[i*3+1]=rand(-12,12); dPos[i*3+2]=rand(-8,5);
  const c=(Math.random()<0.58?COL_BLUE:COL_GOLD).clone().multiplyScalar(rand(0.18,0.38));
  dCol[i*3]=c.r; dCol[i*3+1]=c.g; dCol[i*3+2]=c.b; dSize[i]=rand(0.7,1.8);
  dVel.push(new THREE.Vector3(rand(-0.08,0.08),rand(0.08,0.2),rand(-0.06,0.06)));
}
const dustGeo=new THREE.BufferGeometry();
dustGeo.setAttribute('position',new THREE.BufferAttribute(dPos,3));
dustGeo.setAttribute('color',new THREE.BufferAttribute(dCol,3));
dustGeo.setAttribute('aSize',new THREE.BufferAttribute(dSize,1));
const dust=new THREE.Points(dustGeo,pointMat(30)); dust.frustumCulled=false; scene.add(dust);

const composer=new EffectComposer(renderer);
composer.addPass(new RenderPass(scene,camera));
const bloom=new UnrealBloomPass(new THREE.Vector2(innerWidth,innerHeight), mobile?0.72:0.95, 0.5, 0.34);
composer.addPass(bloom);
let hoverGlow=0, rippleGlow=0;

let built=false, shellMat, rimMat, fiberMat, nodeGeo, nodePoints, pulseGeo, pulsePoints, burstGeo, burstPoints;
let nodes=[], fiberPaths=[], pulses=[], burstParts=[];
const TARGET_R=6.25;
const NODE_COUNT=mobile?260:460;
const PULSE_COUNT=mobile?30:58;
const BURST_MAX=mobile?95:170;

function largestGeometry(root){
  let best=null, bestCount=0;
  root.traverse(o=>{
    if(!o.isMesh||!o.geometry) return;
    const g=o.geometry.index?o.geometry.toNonIndexed():o.geometry.clone();
    const count=g.attributes.position?.count||0;
    if(count>bestCount){best=g; bestCount=count;}
  });
  return best;
}

function normalizeGeometry(geo){
  geo=geo.clone();
  if(geo.index) geo=geo.toNonIndexed();
  geo.deleteAttribute('uv'); geo.deleteAttribute('uv2');
  if(!geo.attributes.normal) geo.computeVertexNormals();
  geo.computeBoundingBox();
  const ctr=new THREE.Vector3(); geo.boundingBox.getCenter(ctr); geo.translate(-ctr.x,-ctr.y,-ctr.z);
  geo.computeBoundingSphere();
  const k=TARGET_R/(geo.boundingSphere?.radius||1); geo.scale(k,k,k);
  geo.rotateY(Math.PI);
  geo.computeVertexNormals();
  return geo;
}

function buildBrain(geo){
  const shell=new THREE.Mesh(geo,new THREE.MeshPhysicalMaterial({
    color:COL_SHELL,
    roughness:0.38,
    metalness:0.0,
    transmission:0.38,
    thickness:0.55,
    transparent:true,
    opacity:0.09,
    emissive:0x142a44,
    emissiveIntensity:0.34,
    side:THREE.DoubleSide,
    depthWrite:false,
    blending:THREE.NormalBlending,
  }));
  shell.frustumCulled=false; brain.add(shell); shellMat=shell.material;

  rimMat=new THREE.ShaderMaterial({
    uniforms:{uColor:{value:COL_RIM},uPower:{value:3.05},uOpacity:{value:0}},
    vertexShader:`varying vec3 vN; varying vec3 vV; void main(){ vec4 mv=modelViewMatrix*vec4(position,1.0); vN=normalize(normalMatrix*normal); vV=normalize(-mv.xyz); gl_Position=projectionMatrix*mv; }`,
    fragmentShader:`varying vec3 vN; varying vec3 vV; uniform vec3 uColor; uniform float uPower; uniform float uOpacity;
      void main(){ float f=pow(1.0-abs(dot(normalize(vN),normalize(vV))),uPower); gl_FragColor=vec4(uColor*f,f*uOpacity); }`,
    transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,side:THREE.DoubleSide,
  });
  const rim=new THREE.Mesh(geo,rimMat); rim.frustumCulled=false; brain.add(rim);

  const sampler=new MeshSurfaceSampler(new THREE.Mesh(geo)).build();
  const sp=new THREE.Vector3(), sn=new THREE.Vector3();
  const hemispheres=[[],[]];
  for(let i=0;i<NODE_COUNT;i++){
    sampler.sample(sp,sn);
    const surface=sp.clone(), nrm=sn.clone().normalize();
    const depth=rand(0.58,0.84);
    const target=surface.clone().multiplyScalar(depth).addScaledVector(nrm,-0.12);
    const start=target.clone().normalize().multiplyScalar(rand(12,22)).add(new THREE.Vector3(rand(-2,2),rand(-2,2),rand(-1,1)));
    const hub=Math.random()<0.18;
    const blue=hub?false:Math.random()<0.62;
    const baseC=blue?COL_BLUE:COL_GOLD;
    const hotC=blue?COL_BHOT:COL_GHOT;
    const color=hub?COL_GHOT.clone().multiplyScalar(1.45):baseC.clone().multiplyScalar(blue?0.98:1.16);
    const h=target.x<0?0:1;
    const heightN=clamp((target.y+TARGET_R)/(2*TARGET_R),0,1);
    const node={target,start,nrm,color,hub,baseSize:hub?rand(3.2,5.1):rand(1.25,2.35),delay:clamp(heightN*0.44+rand(0,0.18),0,1),phase:rand(0,Math.PI*2),cur:start.clone(),ndc:new THREE.Vector3()};
    nodes.push(node); hemispheres[h].push(i);
  }

  const nPos=new Float32Array(NODE_COUNT*3),nCol=new Float32Array(NODE_COUNT*3),nSize=new Float32Array(NODE_COUNT);
  nodes.forEach((n,i)=>{nPos[i*3]=n.start.x;nPos[i*3+1]=n.start.y;nPos[i*3+2]=n.start.z;nCol[i*3]=n.color.r;nCol[i*3+1]=n.color.g;nCol[i*3+2]=n.color.b;});
  nodeGeo=new THREE.BufferGeometry();
  nodeGeo.setAttribute('position',new THREE.BufferAttribute(nPos,3));
  nodeGeo.setAttribute('color',new THREE.BufferAttribute(nCol,3));
  nodeGeo.setAttribute('aSize',new THREE.BufferAttribute(nSize,1));
  nodePoints=new THREE.Points(nodeGeo,pointMat(mobile?18:26)); nodePoints.frustumCulled=false; brain.add(nodePoints);

  const fiberVerts=[],fiberCols=[];
  const fiberLimit=mobile?150:260;
  const inner = (v,scale=0.7)=>v.clone().multiplyScalar(scale);
  const nearestNode=(probe,pool)=>{
    let best=pool[0]??0,bd=1e9;
    for(const i of pool){const d=nodes[i].target.distanceToSquared(probe); if(d<bd){bd=d; best=i;}}
    return nodes[best];
  };
  function pushStream(points,color,intensity=0.55,store=true){
    if(points.length<4) return;
    const curve=new THREE.CatmullRomCurve3(points,false,"centripetal",0.72);
    const pts=curve.getPoints(44);
    if(store&&fiberPaths.length<fiberLimit) fiberPaths.push(pts);
    for(let i=0;i<pts.length-1;i++){
      const t=i/(pts.length-1);
      const glow=intensity*(0.62+0.38*Math.sin(Math.PI*t));
      fiberVerts.push(pts[i].x,pts[i].y,pts[i].z,pts[i+1].x,pts[i+1].y,pts[i+1].z);
      fiberCols.push(color.r*glow,color.g*glow,color.b*glow,color.r*glow,color.g*glow,color.b*glow);
    }
  }
  function bundle(base,color,count,spread,intensity){
    const a=base[0], b=base[base.length-1];
    const axis=new THREE.Vector3().subVectors(b,a).normalize();
    let side=new THREE.Vector3().crossVectors(axis,new THREE.Vector3(0,1,0)).normalize();
    if(side.lengthSq()<0.02) side.set(1,0,0);
    const lift=new THREE.Vector3().crossVectors(axis,side).normalize();
    for(let c=0;c<count;c++){
      const u=(c-(count-1)/2)*spread;
      const v=Math.sin(c*2.17)*spread*0.45;
      const pts=base.map((pt,k)=>{
        const taper=Math.sin(Math.PI*k/(base.length-1));
        const p=pt.clone().addScaledVector(side,u*taper).addScaledVector(lift,v*taper);
        return p.multiplyScalar(clamp(5.25/p.length(),0.72,1));
      });
      pushStream(pts,color,intensity*(0.9+0.08*Math.sin(c)),c<count-1);
    }
  }

  // Structured internal tracts: start deep, arc outward, then run under the transparent cortex.
  for(let h=0;h<2;h++){
    const sign=h===0?-1:1, pool=hemispheres[h];
    for(let lane=0; lane<(mobile?7:10); lane++){
      const yy=-4.2+lane*(8.4/((mobile?7:10)-1));
      const color=lane%3===1?COL_GOLD:COL_BLUE;
      const p0=inner(nearestNode(new THREE.Vector3(sign*1.0,yy*0.72,-2.8),pool).target,0.68);
      const p1=new THREE.Vector3(sign*0.75,yy*0.48,-1.8);
      const p2=new THREE.Vector3(sign*1.8,yy*0.22,0.15);
      const p3=new THREE.Vector3(sign*2.65,-yy*0.32,1.95);
      const p4=inner(nearestNode(new THREE.Vector3(sign*3.0,-yy*0.55,2.9),pool).target,0.78);
      bundle([p0,p1,p2,p3,p4],color,mobile?2:3,0.07,lane%3===1?0.62:0.5);
    }
    for(let band=0; band<(mobile?5:8); band++){
      const yy=-3.2+band*(6.4/((mobile?5:8)-1));
      const base=[];
      for(let k=0;k<6;k++){
        const z=-3.0+k*1.16;
        const x=sign*(2.4+0.42*Math.sin(k*0.9));
        const probe=new THREE.Vector3(x,yy+Math.sin(k*0.8)*0.36,z);
        base.push(inner(nearestNode(probe,pool).target,0.8));
      }
      bundle(base,band%2?COL_BLUE:COL_GOLD,mobile?1:2,0.045,band%2?0.38:0.54);
    }
  }

  // Central bridge fibers, kept fully inside the brain so they never pierce the outline.
  for(let i=0;i<(mobile?7:11);i++){
    const y=-3.15+i*(6.3/((mobile?7:11)-1));
    const z=-0.25+0.34*Math.sin(i*1.1);
    const base=[
      new THREE.Vector3(-2.05,y,z).multiplyScalar(0.62),
      new THREE.Vector3(-1.05,y*0.72,z-0.62).multiplyScalar(0.72),
      new THREE.Vector3(0,y*0.55,z-0.85).multiplyScalar(0.74),
      new THREE.Vector3(1.05,y*0.72,z-0.62).multiplyScalar(0.72),
      new THREE.Vector3(2.05,y,z).multiplyScalar(0.62)
    ];
    bundle(base,i%2?COL_BLUE:COL_GOLD,mobile?1:2,0.052,i%2?0.36:0.58);
  }

  // Short dendrite curls near bright hubs. They bend around the local surface instead of drawing straight chords.
  const hubs=nodes.map((n,i)=>[n,i]).filter(([n])=>n.hub).sort((a,b)=>Math.abs(a[0].target.z)-Math.abs(b[0].target.z)).map(([,i])=>i).slice(0,mobile?28:54);
  for(const i of hubs){
    const a=nodes[i];
    const pool=hemispheres[a.target.x<0?0:1].filter(j=>j!==i && a.target.distanceTo(nodes[j].target)<2.0);
    if(!pool.length) continue;
    pool.sort((j,k)=>a.target.distanceTo(nodes[j].target)-a.target.distanceTo(nodes[k].target));
    const b=nodes[pool[0]];
    const p0=inner(a.target,0.74), p3=inner(b.target,0.74);
    const mid=p0.clone().lerp(p3,0.5);
    const tangent=new THREE.Vector3(-a.nrm.y,a.nrm.x,0).normalize().multiplyScalar(0.28);
    pushStream([p0,mid.clone().add(tangent).multiplyScalar(0.9),mid.clone().sub(tangent).multiplyScalar(0.86),p3],a.color,0.25,false);
  }
  const fiberGeo=new THREE.BufferGeometry();
  fiberGeo.setAttribute('position',new THREE.Float32BufferAttribute(fiberVerts,3));
  fiberGeo.setAttribute('color',new THREE.Float32BufferAttribute(fiberCols,3));
  fiberMat=new THREE.LineBasicMaterial({vertexColors:true,transparent:true,opacity:0,depthWrite:false,depthTest:true,blending:THREE.AdditiveBlending,toneMapped:false});
  const fibers=new THREE.LineSegments(fiberGeo,fiberMat); fibers.frustumCulled=false; brain.add(fibers);

  const pPos=new Float32Array(PULSE_COUNT*3),pCol=new Float32Array(PULSE_COUNT*3),pSize=new Float32Array(PULSE_COUNT);
  const spawn=p=>{p.fiber=(Math.random()*fiberPaths.length)|0;p.t=Math.random()*0.15;p.speed=rand(0.24,0.66);const r=Math.random();p.color=r<0.38?COL_GOLD:r<0.62?COL_GHOT:r<0.86?COL_BLUE:COL_BHOT;};
  for(let i=0;i<PULSE_COUNT;i++){const p={};spawn(p);p.t=Math.random();p._spawn=spawn;pulses.push(p);pCol[i*3]=p.color.r;pCol[i*3+1]=p.color.g;pCol[i*3+2]=p.color.b;pSize[i]=rand(1.2,2.4);}
  pulseGeo=new THREE.BufferGeometry();
  pulseGeo.setAttribute('position',new THREE.BufferAttribute(pPos,3));
  pulseGeo.setAttribute('color',new THREE.BufferAttribute(pCol,3));
  pulseGeo.setAttribute('aSize',new THREE.BufferAttribute(pSize,1));
  pulsePoints=new THREE.Points(pulseGeo,pointMat(mobile?28:38)); pulsePoints.frustumCulled=false; brain.add(pulsePoints);

  const bPos=new Float32Array(BURST_MAX*3),bCol=new Float32Array(BURST_MAX*3),bSize=new Float32Array(BURST_MAX);
  for(let i=0;i<BURST_MAX;i++){burstParts.push({x:0,y:0,z:0,vx:0,vy:0,vz:0,life:0,max:1,active:false});const r=Math.random();const c=r<0.38?COL_GHOT:r<0.68?COL_GOLD:COL_BHOT;bCol[i*3]=c.r;bCol[i*3+1]=c.g;bCol[i*3+2]=c.b;}
  burstGeo=new THREE.BufferGeometry();
  burstGeo.setAttribute('position',new THREE.BufferAttribute(bPos,3));
  burstGeo.setAttribute('color',new THREE.BufferAttribute(bCol,3));
  burstGeo.setAttribute('aSize',new THREE.BufferAttribute(bSize,1));
  burstPoints=new THREE.Points(burstGeo,pointMat(mobile?30:42)); burstPoints.frustumCulled=false; brain.add(burstPoints);

  brain.rotation.set(0.08,-1.55,0);
  built=true; elapsed=0;
  document.getElementById('loader')?.classList.add('hidden');
  document.body.classList.add('ready');
}

function loadFallbackGLB(){
  new GLTFLoader().load('brain.glb',gltf=>{let src=null;gltf.scene.traverse(o=>{if(o.isMesh&&!src)src=o;});if(src)buildBrain(normalizeGeometry(src.geometry));},undefined,err=>{console.error('brain model failed',err);document.getElementById('loader')?.classList.add('hidden');document.body.classList.add('ready');});
}
new OBJLoader().load('brain.obj',obj=>{const geo=largestGeometry(obj); if(geo) buildBrain(normalizeGeometry(geo)); else loadFallbackGLB();},undefined,loadFallbackGLB);

function fiberAt(fi,t,out){const pts=fiberPaths[fi];const n=pts.length-1;const seg=clamp(t,0,1)*n;const i=Math.min(n-1,seg|0);out.copy(pts[i]).lerp(pts[i+1],seg-i);return out;}

let scrollTarget=0,scrollSmooth=0,ptrTX=0,ptrTY=0,ptrX=0,ptrY=0;
const mouseNDC=new THREE.Vector2(-10,-10);let pointerInside=false;
let dragging=false,moved=false,lastPX=0,lastPY=0,dragVelY=0,dragVelX=0,userRotX=0;
const ripple={active:false,t:0,origin:new THREE.Vector3()};let wantRipple=false;
function onScroll(){const max=Math.max(1,document.documentElement.scrollHeight-innerHeight);scrollTarget=clamp(scrollY/max,0,1);} onScroll();
addEventListener('scroll',onScroll,{passive:true});
function setPointer(e){ptrTX=e.clientX/innerWidth*2-1;ptrTY=e.clientY/innerHeight*2-1;mouseNDC.set(ptrTX,-ptrTY);pointerInside=true;}
addEventListener('pointermove',e=>{setPointer(e);if(dragging){const dx=e.clientX-lastPX,dy=e.clientY-lastPY;if(Math.abs(dx)+Math.abs(dy)>2)moved=true;dragVelY+=dx*0.00045;dragVelX+=dy*0.00035;lastPX=e.clientX;lastPY=e.clientY;}},{passive:true});
canvas.addEventListener('pointerdown',e=>{dragging=true;moved=false;lastPX=e.clientX;lastPY=e.clientY;});
addEventListener('pointerup',e=>{if(dragging&&!moved){setPointer(e);wantRipple=true;}dragging=false;});
addEventListener('pointerleave',()=>{pointerInside=false;mouseNDC.set(-10,-10);});
addEventListener('resize',()=>{camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setPixelRatio(Math.min(devicePixelRatio||1,mobile?1.35:1.8));renderer.setSize(innerWidth,innerHeight);composer.setSize(innerWidth,innerHeight);bloom.setSize(innerWidth,innerHeight);onScroll();});

const ASSEMBLE_DUR=2.1,STAGGER=1.1;
const clock=new THREE.Clock();let elapsed=0;
const _v=new THREE.Vector3(),_cw=new THREE.Vector3(),_n=new THREE.Vector3(),_vd=new THREE.Vector3(),_w=new THREE.Vector3();
const _ray=new THREE.Raycaster(),_plane=new THREE.Plane(new THREE.Vector3(0,0,1),0);

function fireBurst(origin){
  let fired=0;
  for(const b of burstParts){
    if(fired>=BURST_MAX*0.55) break; if(b.active) continue;
    const dir=origin.clone().normalize().add(new THREE.Vector3(rand(-0.8,0.8),rand(-0.8,0.8),rand(-0.8,0.8))).normalize();
    b.x=origin.x;b.y=origin.y;b.z=origin.z;b.vx=dir.x*rand(3,8);b.vy=dir.y*rand(3,8);b.vz=dir.z*rand(3,8);b.max=b.life=rand(0.45,0.95);b.active=true;fired++;
  }
}

function animate(){
  requestAnimationFrame(animate);
  const dt=Math.min(clock.getDelta(),0.05); elapsed+=dt;
  scrollSmooth+=(scrollTarget-scrollSmooth)*(1-Math.pow(0.0015,dt));
  ptrX+=(ptrTX-ptrX)*(1-Math.pow(0.002,dt)); ptrY+=(ptrTY-ptrY)*(1-Math.pow(0.002,dt));
  const reveal=easeOut(clamp(elapsed/(ASSEMBLE_DUR+STAGGER),0,1));
  hoverGlow+=((pointerInside?1:0)-hoverGlow)*(1-Math.pow(0.02,dt));
  rippleGlow+=((ripple.active?1:0)-rippleGlow)*(1-Math.pow(0.018,dt));
  bloom.strength=(mobile?0.62:0.82)*reveal+0.08*hoverGlow+0.08*rippleGlow;
  bloom.radius=0.42;
  bloom.threshold=0.38;

  const decay=Math.pow(0.94,dt*60);
  brain.rotation.y+=dragVelY;userRotX=clamp(userRotX+dragVelX,-0.6,0.6);dragVelY*=decay;dragVelX*=decay;
  if(!dragging)brain.rotation.y+=dt*0.04;
  brain.rotation.x=lerp(brain.rotation.x,userRotX+ptrY*0.075,0.07);
  brain.position.x=ptrX*0.34;brain.position.y=-scrollSmooth*1.0;
  brain.scale.setScalar((innerWidth>860?1.12:innerWidth>540?0.62:0.5)+0.01*Math.sin(elapsed*0.8));
  brain.updateMatrixWorld(true);

  if(pointerInside){_ray.setFromCamera(mouseNDC,camera);if(_ray.ray.intersectPlane(_plane,_cw))halo.position.copy(_cw);}
  halo.material.opacity=lerp(halo.material.opacity,pointerInside?0.32:0,0.1)*reveal;

  if(built){
    if(wantRipple){wantRipple=false;let best=-1,bd=1e9;for(let i=0;i<nodes.length;i++){const dx=nodes[i].ndc.x-mouseNDC.x,dy=nodes[i].ndc.y-mouseNDC.y,d=dx*dx+dy*dy;if(d<bd){bd=d;best=i;}}if(best>=0){ripple.origin.copy(nodes[best].target);ripple.active=true;ripple.t=0;fireBurst(ripple.origin);}}
    let rFront=0;if(ripple.active){ripple.t+=dt;rFront=ripple.t*6.8;if(rFront>20)ripple.active=false;}

    const pos=nodeGeo.attributes.position.array,siz=nodeGeo.attributes.aSize.array,col=nodeGeo.attributes.color.array;
    for(let i=0;i<nodes.length;i++){
      const n=nodes[i];const e=easeOut(clamp((elapsed-n.delay*STAGGER)/ASSEMBLE_DUR,0,1));
      const br=1;
      let x=lerp(n.start.x,n.target.x*br,e),y=lerp(n.start.y,n.target.y*br,e),z=lerp(n.start.z,n.target.z*br,e);
      _v.set(x,y,z).applyMatrix4(brain.matrixWorld);_n.copy(n.nrm).transformDirection(brain.matrixWorld);
      const facing=_n.dot(_vd.copy(camera.position).sub(_v).normalize());const front=smooth(clamp((facing+0.05)/0.42,0,1));
      _v.project(camera);n.ndc.set(_v.x,_v.y,0);
      let ex=0;if(pointerInside&&e>0.6){ex=smooth(clamp(1-Math.hypot(_v.x-mouseNDC.x,_v.y-mouseNDC.y)/0.14,0,1));}
      if(ripple.active){const rr=clamp(1-Math.abs(n.target.distanceTo(ripple.origin)-rFront)/1.35,0,1);ex=Math.max(ex,smooth(rr));}
      const wave=Math.sin((n.target.distanceTo(ripple.origin)-rFront)*3.2)*0.16*(ripple.active?ex:0);
      const pop=ex*0.24+wave;
      const inset=-0.18;
      pos[i*3]=x+n.nrm.x*(pop+inset);pos[i*3+1]=y+n.nrm.y*(pop+inset);pos[i*3+2]=z+n.nrm.z*(pop+inset);n.cur.set(pos[i*3],pos[i*3+1],pos[i*3+2]);
      const tw=n.hub?1.45:1.08;
      siz[i]=n.baseSize*e*tw*(1+4.8*ex)*(0.72+0.28*front);
      const amp=(n.hub?1.55:1.18)+0.9*ex;col[i*3]=n.color.r*amp;col[i*3+1]=n.color.g*amp;col[i*3+2]=n.color.b*amp;
    }
    nodeGeo.attributes.position.needsUpdate=true;nodeGeo.attributes.aSize.needsUpdate=true;nodeGeo.attributes.color.needsUpdate=true;
    fiberMat.opacity=0.44*reveal+(ripple.active?0.1:0);
    rimMat.uniforms.uOpacity.value=0.16*reveal+0.03*hoverGlow;
    shellMat.opacity=0.085+0.012*hoverGlow;

    const pp=pulseGeo.attributes.position.array,ps=pulseGeo.attributes.aSize.array;
    for(let i=0;i<pulses.length;i++){const p=pulses[i];p.t+=dt*p.speed;if(p.t>=1)p._spawn(p);fiberAt(p.fiber,p.t,_v);pp[i*3]=_v.x;pp[i*3+1]=_v.y;pp[i*3+2]=_v.z;_w.copy(_v).applyMatrix4(brain.matrixWorld);_n.copy(_v).normalize().transformDirection(brain.matrixWorld);const pf=smooth(clamp((_n.dot(_vd.copy(camera.position).sub(_w).normalize())+0.05)/0.4,0,1));ps[i]=(0.95+1.05*Math.sin(p.t*Math.PI))*reveal*pf*(ripple.active?1.14:1);}
    pulseGeo.attributes.position.needsUpdate=true;pulseGeo.attributes.aSize.needsUpdate=true;

    const bp=burstGeo.attributes.position.array,bs=burstGeo.attributes.aSize.array;const drag=Math.pow(0.28,dt);
    for(let i=0;i<burstParts.length;i++){const b=burstParts[i];if(!b.active){bs[i]=0;continue;}b.life-=dt;if(b.life<=0){b.active=false;bs[i]=0;continue;}b.vx*=drag;b.vy*=drag;b.vz*=drag;b.x+=b.vx*dt;b.y+=b.vy*dt;b.z+=b.vz*dt;bp[i*3]=b.x;bp[i*3+1]=b.y;bp[i*3+2]=b.z;const lf=b.life/b.max;bs[i]=(0.8+3.8*lf);}
    burstGeo.attributes.position.needsUpdate=true;burstGeo.attributes.aSize.needsUpdate=true;
  }

  const dp=dustGeo.attributes.position.array;
  for(let i=0;i<DUST;i++){dp[i*3]+=dVel[i].x*dt;dp[i*3+1]+=dVel[i].y*dt;dp[i*3+2]+=dVel[i].z*dt;if(dp[i*3+1]>15)dp[i*3+1]=-15;}
  dustGeo.attributes.position.needsUpdate=true;
  composer.render();
}
animate();
window._neuralProgress=()=>scrollSmooth;
