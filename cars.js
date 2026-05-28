import * as THREE from 'three';
import { GLTFLoader }      from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader }     from 'three/addons/loaders/DRACOLoader.js';
import { FontLoader }      from 'three/addons/loaders/FontLoader.js';
import { TextGeometry }    from 'three/addons/geometries/TextGeometry.js';
import { EffectComposer }  from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass }      from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass }              from 'three/addons/postprocessing/ShaderPass.js';
import { OutputPass }              from 'three/addons/postprocessing/OutputPass.js';
import { RectAreaLightUniformsLib } from 'three/addons/lights/RectAreaLightUniformsLib.js';
import { RGBELoader }               from 'three/addons/loaders/RGBELoader.js';

// ─── Renderer ────────────────────────────────────────────────────────────────
const canvas = document.getElementById('c');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(window.devicePixelRatio);
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 0.90;
renderer.outputColorSpace = THREE.SRGBColorSpace;

// ─── Scene ────────────────────────────────────────────────────────────────────
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x000000);

// HDR environment map — gives metallic/glass reflections
const _pmrem = new THREE.PMREMGenerator(renderer);
_pmrem.compileEquirectangularShader();
new RGBELoader().load('cars-assets/rogland_clear_night_2k.hdr', hdr => {
  scene.environment = _pmrem.fromEquirectangular(hdr).texture;
  hdr.dispose();
  _pmrem.dispose();
});
// Scene-level depth fog — car orbit is 130-200 units from camera, near=350 keeps it fully clear.
// Stars at 2800 units fade ~80%. Anything past 3800 is completely misted.
scene.fog = new THREE.Fog(new THREE.Color(0.012, 0.004, 0.040), 350, 3800);

const camera = new THREE.PerspectiveCamera(42, window.innerWidth / window.innerHeight, 5, 7000);

// ─── Selective bloom (lights only) ───────────────────────────────────────────
const BLOOM_LAYER = 1;
const _bloomLayers = new THREE.Layers();
_bloomLayers.set(BLOOM_LAYER);
const _darkMat  = new THREE.MeshBasicMaterial({ color: 0x000000 });
const _savedMats = {};
let _bloomReady = false;
const _bloomBlack    = new THREE.Color(0x000000);
const _bloomDarkList = [];   // { mesh, mat } — opaque non-bloom meshes
const _bloomHideList = [];   // transparent non-bloom meshes (fog planes, glass)

const _bloomPass = new UnrealBloomPass(
  new THREE.Vector2(window.innerWidth * window.devicePixelRatio, window.innerHeight * window.devicePixelRatio),
  0.40,  // strength
  0.28,  // radius
  0.0    // threshold
);
const _bloomComposer = new EffectComposer(renderer);
_bloomComposer.renderToScreen = false;
_bloomComposer.addPass(new RenderPass(scene, camera));
_bloomComposer.addPass(_bloomPass);

const _mixPass = new ShaderPass(new THREE.ShaderMaterial({
  uniforms: {
    baseTexture:  { value: null },
    bloomTexture: { value: _bloomComposer.renderTarget2.texture },
  },
  vertexShader: `varying vec2 vUv;
void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
  fragmentShader: `uniform sampler2D baseTexture,bloomTexture;
varying vec2 vUv;
void main(){ gl_FragColor = texture2D(baseTexture,vUv) + texture2D(bloomTexture,vUv); }`,
}), 'baseTexture');
_mixPass.needsSwap = true;

// Use MSAA render target for the final composer — true hardware AA in post chain
const _msaaTarget = new THREE.WebGLRenderTarget(
  window.innerWidth  * window.devicePixelRatio,
  window.innerHeight * window.devicePixelRatio,
  { samples: 8 }
);
const _finalComposer = new EffectComposer(renderer, _msaaTarget);
_finalComposer.addPass(new RenderPass(scene, camera));
_finalComposer.addPass(_mixPass);
_finalComposer.addPass(new OutputPass());

// ─── Star field (Points) ──────────────────────────────────────────────────────
RectAreaLightUniformsLib.init();

// Build a circular sprite for each star so bloom looks like a soft point of light
const _starSprite = (() => {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0,    'rgba(255,255,255,1)');
  g.addColorStop(0.08, 'rgba(255,255,255,1)');
  g.addColorStop(0.25, 'rgba(255,255,255,0.4)');
  g.addColorStop(0.6,  'rgba(255,255,255,0.08)');
  g.addColorStop(1,    'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(c);
})();

const _STARS = 5000;
const _sPos  = new Float32Array(_STARS * 3);
const _sCol  = new Float32Array(_STARS * 3);
// Vivid palette — white, saturated cool blue, saturated warm orange
const _sPalette = [
  [1.00, 1.00, 1.00],
  [0.42, 0.72, 1.00],
  [1.00, 0.62, 0.20],
];
for (let i = 0; i < _STARS; i++) {
  const theta = Math.random() * Math.PI * 2;
  const phi   = Math.acos(2 * Math.random() - 1);
  const r     = 2800;
  _sPos[i*3]   = r * Math.sin(phi) * Math.cos(theta);
  _sPos[i*3+1] = r * Math.sin(phi) * Math.sin(theta);
  _sPos[i*3+2] = r * Math.cos(phi);
  const col    = _sPalette[Math.floor(Math.random() * _sPalette.length)];
  const bright = 0.75 + Math.random() * 0.25; // always bright
  _sCol[i*3]   = col[0] * bright;
  _sCol[i*3+1] = col[1] * bright;
  _sCol[i*3+2] = col[2] * bright;
}
const _starGeo = new THREE.BufferGeometry();
_starGeo.setAttribute('position', new THREE.BufferAttribute(_sPos, 3));
_starGeo.setAttribute('color',    new THREE.BufferAttribute(_sCol, 3));

const _starPoints = new THREE.Points(_starGeo, new THREE.PointsMaterial({
  size: 18,
  map: _starSprite,
  vertexColors: true,
  sizeAttenuation: true,
  transparent: true,
  depthWrite: false,
  alphaTest: 0.002,
}));
scene.add(_starPoints);

// ─── Volumetric fog system ────────────────────────────────────────────────────

// Build a rich wispy fog texture: 14 overlapping soft radial blobs per texture
function _mkFogTex(seed) {
  const S = 512, c = document.createElement('canvas');
  c.width = c.height = S;
  const ctx = c.getContext('2d');
  ctx.clearRect(0, 0, S, S);
  const rng = (n) => { seed = (seed * 16807 + 0) % 2147483647; return (seed / 2147483647) * n; };
  for (let i = 0; i < 14; i++) {
    const x = rng(S), y = rng(S);
    const r = 35 + rng(130);
    const a = 0.22 + rng(0.38);
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0,    `rgba(220,225,248,${a.toFixed(3)})`);
    g.addColorStop(0.30, `rgba(210,218,245,${(a * 0.45).toFixed(3)})`);
    g.addColorStop(0.65, `rgba(200,212,242,${(a * 0.12).toFixed(3)})`);
    g.addColorStop(1,    'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, S, S);
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

// Four unique textures for visual variety across all planes
const _fogTexPool = [_mkFogTex(1234), _mkFogTex(5678), _mkFogTex(9012), _mkFogTex(3456)];
const _fogLayers  = [];

function _addFogPlane(w, d, y, ox, oz, op) {
  const mat = new THREE.MeshBasicMaterial({
    map:         _fogTexPool[_fogLayers.length % _fogTexPool.length],
    transparent: true,
    opacity:     op,
    blending:    THREE.AdditiveBlending,
    depthWrite:  false,
    side:        THREE.DoubleSide,
    fog:         false,   // not affected by scene fog
  });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, d), mat);
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.set(ox, y, oz);
  scene.add(mesh);
  _fogLayers.push({
    mesh, baseOp: op,
    phase:  Math.random() * Math.PI * 2,
    ampX:   14 + Math.random() * 28,
    ampZ:   10 + Math.random() * 22,
    freqX:  0.00013 + Math.random() * 0.00014,
    freqZ:  0.00010 + Math.random() * 0.00011,
    rotSpd: (Math.random() - 0.5) * 0.000014,
    baseX:  ox,
    baseZ:  oz,
  });
}

// ── Upper atmospheric haze only — above the car, never blocks body or glass ───
_addFogPlane(1100, 950, 90,    8, -10,  0.055);
_addFogPlane(1050, 900, 100, -12,  14,  0.050);
_addFogPlane(1150, 980, 112,  10,   8,  0.045);
_addFogPlane(1080, 920, 125, -10, -12,  0.040);
_addFogPlane(1200,1020, 140,   6,  10,  0.038);

// Light shaft cones — populated after FBX loads so we can use real bounding box
const _fogShafts = [];

function _mkLightCone(localPos, rx, col, op, rY) {
  const group = new THREE.Group();
  group.rotation.y = rY;
  // Transform local position into world space by the car's Y rotation
  const wp = new THREE.Vector3(localPos.x, localPos.y, localPos.z)
    .applyAxisAngle(new THREE.Vector3(0, 1, 0), rY);
  group.position.set(wp.x, localPos.y, wp.z);

  // ConeGeometry: apex at +height/2, base at −height/2.
  // Translate so apex sits at group origin (= light source position).
  const geo = new THREE.ConeGeometry(28, 105, 14, 1, true);
  geo.translate(0, -52.5, 0); // apex → y=0; base → y=−105

  const mesh = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({
    color: col, transparent: true, opacity: op,
    blending: THREE.AdditiveBlending,
    depthWrite: false, side: THREE.DoubleSide,
    fog: false,
  }));
  // rx rotates the −Y axis (base, opening) to point in desired world direction.
  // -(π/2 − tilt) → forward+down  |  (π/2 − tilt) → backward+down
  mesh.rotation.x = rx;
  group.add(mesh);
  scene.add(group);
  return { mesh, baseOp: op };
}

// ─── Lighting ─────────────────────────────────────────────────────────────────
scene.add(new THREE.AmbientLight(0xffffff, 0.35));

// Interior cabin light — illuminates seats visible through clear windows
const _cabinLight = new THREE.PointLight(0xfff4e8, 6.0, 240);
_cabinLight.position.set(0, 65, 15);
scene.add(_cabinLight);

const _ceilLight = new THREE.RectAreaLight(0xfff8f0, 8.0, 140, 260);
_ceilLight.position.set(0, 320, 0);
_ceilLight.lookAt(0, 0, 0);
scene.add(_ceilLight);

const _ceilPanel = new THREE.Mesh(
  new THREE.PlaneGeometry(140, 260),
  new THREE.MeshBasicMaterial({ color: new THREE.Color(1.0, 0.97, 0.90) })
);
_ceilPanel.rotation.x = Math.PI / 2;
_ceilPanel.position.set(0, 318, 0);
scene.add(_ceilPanel);

const _fillLight = new THREE.DirectionalLight(0xffffff, 0.55);
_fillLight.position.set(-200, 300, 150);
_fillLight.target.position.set(0, 40, 0);
scene.add(_fillLight);
scene.add(_fillLight.target);

// ─── Materials ────────────────────────────────────────────────────────────────
// ── Carbon fiber canvas ───────────────────────────────────────────────────────
const _cf = document.createElement('canvas');
_cf.width = _cf.height = 128;
const _cx = _cf.getContext('2d');
const _cs = 8;
for (let r = 0; r < 16; r++) {
  for (let c = 0; c < 16; c++) {
    const x = c * _cs, y = r * _cs;
    const horiz = (Math.floor(c / 2) + Math.floor(r / 2)) % 2 === 0;
    const g = _cx.createLinearGradient(x, y, x + _cs, y + _cs);
    if (horiz) {
      g.addColorStop(0,    '#181818'); g.addColorStop(0.35, '#3c3c3c');
      g.addColorStop(0.65, '#3c3c3c'); g.addColorStop(1,   '#141414');
    } else {
      g.addColorStop(0,    '#101010'); g.addColorStop(0.40, '#262626');
      g.addColorStop(0.60, '#262626'); g.addColorStop(1,   '#101010');
    }
    _cx.fillStyle = g; _cx.fillRect(x, y, _cs, _cs);
    _cx.fillStyle = '#050505';
    _cx.fillRect(x, y, 1, _cs); _cx.fillRect(x, y, _cs, 1);
  }
}
const cfTex = new THREE.CanvasTexture(_cf);
cfTex.wrapS = cfTex.wrapT = THREE.RepeatWrapping;

// ── Brushed silver canvas ─────────────────────────────────────────────────────
const _sm = document.createElement('canvas');
_sm.width = 256; _sm.height = 4;
const _mx = _sm.getContext('2d');
for (let y = 0; y < 4; y++) {
  const v = [0.62, 0.55, 0.68, 0.58][y];
  _mx.fillStyle = `rgb(${Math.round(v*255)},${Math.round(v*255)},${Math.round(v*258)})`;
  _mx.fillRect(0, y, 256, 1);
}
const smTex = new THREE.CanvasTexture(_sm);
smTex.wrapS = smTex.wrapT = THREE.RepeatWrapping;

// ── Triplanar helper (injected into onBeforeCompile) ─────────────────────────
function addTriplanar(mat, tex, scl, intensity = 1.0, additive = false) {
  mat.onBeforeCompile = shader => {
    shader.uniforms.uTex = { value: tex };
    shader.uniforms.uScl = { value: scl };
    shader.uniforms.uInt = { value: intensity };

    shader.vertexShader = 'varying vec3 vWPt;\nvarying vec3 vWNt;\n' + shader.vertexShader;
    shader.vertexShader = shader.vertexShader.replace('#include <project_vertex>',
      `#include <project_vertex>
      vWPt = (modelMatrix * vec4(transformed, 1.0)).xyz;
      vWNt = normalize(mat3(modelMatrix) * objectNormal);`);

    shader.fragmentShader =
      'varying vec3 vWPt;\nvarying vec3 vWNt;\nuniform sampler2D uTex;\nuniform float uScl,uInt;\n'
      + shader.fragmentShader;
    shader.fragmentShader = shader.fragmentShader.replace('#include <color_fragment>',
      `#include <color_fragment>
      vec3 _w = abs(vWNt);
      _w = pow(_w, vec3(5.0)); _w /= (_w.x+_w.y+_w.z+0.001);
      vec3 _tx = texture2D(uTex, vWPt.yz/uScl).rgb;
      vec3 _ty = texture2D(uTex, vWPt.xz/uScl).rgb;
      vec3 _tz = texture2D(uTex, vWPt.xy/uScl).rgb;
      vec3 _t  = _tx*_w.x + _ty*_w.y + _tz*_w.z;
      ${additive
        ? 'diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * _t * 3.2, uInt);'
        : 'diffuseColor.rgb = mix(diffuseColor.rgb, _t, uInt);'}`);
  };
}

// ── Corvette Stingray — Torch Red metallic paint ──────────────────────────────
const matBody = new THREE.MeshStandardMaterial({
  color: new THREE.Color(0.72, 0.02, 0.03),   // Torch Red
  metalness: 0.85, roughness: 0.18,
  side: THREE.DoubleSide,
});
addTriplanar(matBody, cfTex, 8.0, 0.12, true); // subtle carbon flake in paint

// Secondary / accent panels — darker red-black
const matBody2 = new THREE.MeshStandardMaterial({
  color: new THREE.Color(0.32, 0.01, 0.01),
  metalness: 0.80, roughness: 0.25,
  side: THREE.DoubleSide,
});

// Gloss black body panels & plastic
const matBlack = new THREE.MeshStandardMaterial({
  color: new THREE.Color(0.025, 0.025, 0.028),
  metalness: 0.10, roughness: 0.30,
  side: THREE.DoubleSide,
});

// Matte black bumpy plastic (sills, diffuser trim)
const matPlastic = new THREE.MeshStandardMaterial({
  color: new THREE.Color(0.04, 0.04, 0.045),
  metalness: 0.0, roughness: 0.88,
});

// Tyres
const matRubber = new THREE.MeshStandardMaterial({
  color: new THREE.Color(0.025, 0.025, 0.028),
  metalness: 0.0, roughness: 0.95,
});

// Rims — gunmetal dark chrome
const matRim = new THREE.MeshStandardMaterial({
  color: new THREE.Color(0.18, 0.18, 0.20),
  metalness: 0.96, roughness: 0.10,
});

// Brake discs — ventilated steel
const matBrakeDisc = new THREE.MeshStandardMaterial({
  color: new THREE.Color(0.42, 0.40, 0.38),
  metalness: 0.90, roughness: 0.40,
});

// Brake hub/caliper — bright yellow
const matBrakeHub = new THREE.MeshStandardMaterial({
  color: new THREE.Color(0.82, 0.68, 0.02),
  metalness: 0.3, roughness: 0.45,
});

// Chrome trim
const matChrome = new THREE.MeshStandardMaterial({
  color: new THREE.Color(0.82, 0.82, 0.85),
  metalness: 0.99, roughness: 0.04,
});
addTriplanar(matChrome, smTex, 10.0, 0.35, false);

// Headlight — white emissive, bloomed
const matHead = new THREE.MeshStandardMaterial({
  color: new THREE.Color(1.0, 0.97, 0.90),
  emissive: new THREE.Color(1.0, 0.97, 0.90),
  emissiveIntensity: 1.8,
  roughness: 0.0, metalness: 0.0,
});

// Unlit light (off-state)
const matLightOff = new THREE.MeshStandardMaterial({
  color: new THREE.Color(0.08, 0.08, 0.10),
  roughness: 0.15, metalness: 0.4,
  transparent: true, opacity: 0.55,
  side: THREE.DoubleSide,
});

// Clear glass — windshield & side windows
const matGlassClear = new THREE.MeshPhysicalMaterial({
  color: new THREE.Color(0.88, 0.95, 1.0),
  metalness: 0.0, roughness: 0.02,
  transmission: 0.90, thickness: 4.0, ior: 1.52,
  reflectivity: 0.55, envMapIntensity: 2.0,
  transparent: true, opacity: 1.0,
  side: THREE.DoubleSide, depthWrite: false, fog: false,
});

// Tinted windshield
const matGlassTinted = new THREE.MeshPhysicalMaterial({
  color: new THREE.Color(0.12, 0.18, 0.22),
  metalness: 0.0, roughness: 0.04,
  transmission: 0.55, thickness: 6.0, ior: 1.52,
  reflectivity: 0.65, envMapIntensity: 2.2,
  transparent: true, opacity: 0.80,
  side: THREE.DoubleSide, depthWrite: false, fog: false,
});

// Red tail/brake-light glass — strong emissive so it blooms visibly
const matGlassRed = new THREE.MeshStandardMaterial({
  color: new THREE.Color(1.0, 0.0, 0.0),
  emissive: new THREE.Color(1.0, 0.0, 0.0),
  emissiveIntensity: 3.5,
  roughness: 0.05, metalness: 0.0,
  transparent: true, opacity: 0.75,
  side: THREE.DoubleSide, depthWrite: false,
});

// Orange indicator glass — warm glow, less intense than brake lights
const matGlassOrange = new THREE.MeshStandardMaterial({
  color: new THREE.Color(1.0, 0.45, 0.0),
  emissive: new THREE.Color(1.0, 0.45, 0.0),
  emissiveIntensity: 1.2,
  roughness: 0.08, metalness: 0.0,
  transparent: true, opacity: 0.70,
  side: THREE.DoubleSide, depthWrite: false,
});

// Interior — red leather
const matInterior = new THREE.MeshStandardMaterial({
  color: new THREE.Color(0.38, 0.008, 0.008),
  roughness: 0.85, metalness: 0.0,
  side: THREE.DoubleSide,
});

// Steering wheel — matte black with carbon
const matSteering = new THREE.MeshStandardMaterial({
  color: new THREE.Color(0.04, 0.04, 0.04),
  roughness: 0.60, metalness: 0.05,
});
addTriplanar(matSteering, cfTex, 5.0, 0.45, true);

// Window border trim — gloss black
const matWindowBorder = new THREE.MeshStandardMaterial({
  color: new THREE.Color(0.03, 0.03, 0.03),
  metalness: 0.2, roughness: 0.25,
});

// ─── Material-name classification (matches GLB embedded material names) ────────
function classify(matName) {
  const n = matName || '';
  if (/Car_Paint_Main/i.test(n))        return 'body';
  if (/Car_Paint_Secondary/i.test(n))   return 'body2';
  if (/Car_Painnt_Black|Black_Diffuse|Metal_Black(?!_Rough)/i.test(n)) return 'black';
  if (/Plastic_Black/i.test(n))         return 'plastic';
  if (/Metal.Black.Rough/i.test(n))     return 'black';
  if (/Rubber|Tire/i.test(n))           return 'rubber';
  if (/Guide_Rim|Rim/i.test(n))         return 'rim';
  if (/Chrome_Dark/i.test(n))           return 'rim';
  if (/Chrome/i.test(n))                return 'chrome';
  if (/Brake_Hub/i.test(n))             return 'brakehub';
  if (/Brake_Disc/i.test(n))            return 'disc';
  if (/White_Light_Bulb_ON/i.test(n))   return 'head';
  if (/Light_Bulb|Side_Light/i.test(n)) return 'lightoff';
  if (/Glass.*Red|Red.*Glass/i.test(n)) return 'glassred';
  if (/Glass.*Orange|Orange.*Glass/i.test(n)) return 'glassorange';
  if (/Glass.*Tinted|Tinted/i.test(n))  return 'glasstinted';
  if (/Glass/i.test(n))                 return 'glassclear';
  if (/Interior.*Seat|Seat/i.test(n))   return 'interior';
  if (/Steering/i.test(n))              return 'steering';
  if (/Window_Border/i.test(n))         return 'windowborder';
  if (/Flag_Logo/i.test(n))             return 'chrome';
  if (/Shadow/i.test(n))                return 'shadow';
  return 'body';
}

// unused stub kept for lint-safety

// ─── Load ─────────────────────────────────────────────────────────────────────
const loadingEl  = document.getElementById('loading');
const barEl      = document.getElementById('loading-bar');
const carNameEl  = document.getElementById('car-name');
const scrollHint = document.getElementById('scroll-hint');

const _draco = new DRACOLoader();
_draco.setDecoderPath('https://www.gstatic.com/draco/versioned/decoders/1.5.7/');
const _gltfLoader = new GLTFLoader();
_gltfLoader.setDRACOLoader(_draco);

_gltfLoader.load(
  'cars-assets/corvette.glb',
  gltf => {
    const fbx = gltf.scene;
    fbx.traverse(child => {
      if (!child.isMesh) return;

      // Shadow planes are invisible geometry — hide them
      if (/shadow/i.test(child.name)) { child.visible = false; return; }

      child.castShadow = true;
      child.receiveShadow = true;

      const mats = Array.isArray(child.material) ? child.material : [child.material];
      const newMats = mats.map(mat => {
        const type = classify(mat ? mat.name : '');
        switch (type) {
          case 'body':         return matBody;
          case 'body2':        return matBody2;
          case 'black':        return matBlack;
          case 'plastic':      return matPlastic;
          case 'rubber':       return matRubber;
          case 'rim':          return matRim;
          case 'disc':         return matBrakeDisc;
          case 'brakehub':     return matBrakeHub;
          case 'chrome':       return matChrome;
          case 'glassclear':   return matGlassClear;
          case 'glasstinted':  return matGlassTinted;
          case 'glassred':     { child.layers.enable(BLOOM_LAYER); return matGlassRed; }
          case 'glassorange':  { child.layers.enable(BLOOM_LAYER); return matGlassOrange; }
          case 'interior':     return matInterior;
          case 'steering':     return matSteering;
          case 'windowborder': return matWindowBorder;
          case 'head':         { child.layers.enable(BLOOM_LAYER); return matHead; }
          case 'lightoff':     return matLightOff;
          case 'shadow':       { child.visible = false; return mat; }
          default:             return matBody;
        }
      });
      child.material = newMats.length === 1 ? newMats[0] : newMats;
    });

    const b2  = new THREE.Box3().setFromObject(fbx);
    const sz2 = b2.getSize(new THREE.Vector3());
    fbx.scale.setScalar(300 / Math.max(sz2.x, sz2.z));
    fbx.updateMatrixWorld(true); // force matrix update before bbox
    const b3  = new THREE.Box3().setFromObject(fbx);
    const c3  = b3.getCenter(new THREE.Vector3());
    const sz3 = b3.getSize(new THREE.Vector3());
    fbx.position.x -= c3.x;
    fbx.position.y -= b3.min.y;
    fbx.position.z -= c3.z;
    fbx.rotation.y = Math.PI * 0.05;
    scene.add(fbx);

    // Set camera ellipse axes from real bounding box — equal clearance all sides
    _camAxX = sz3.x / 2 + CAM_CLEARANCE;
    _camAxZ = sz3.z / 2 + CAM_CLEARANCE;

    // ── Cinematic fog — light shafts at real headlight + brake light positions ─
    {
      const hY = sz3.y * 0.30;   // headlight height (~30% of car height)
      const hX = sz3.x * 0.28;   // lateral offset
      const fZ = sz3.z * 0.48;   // front z edge
      const rY = fbx.rotation.y;
      // Rotation derivation: ConeGeometry base (−Y) is the opening.
      // For forward+downward (headlights): Rx(−(π/2 − 0.14)) maps −Y → (+Z, −0.14Y)
      // For backward+downward (brake):     Rx(+(π/2 − 0.10)) maps −Y → (−Z, −0.10Y)
      const headRx  = -(Math.PI / 2 - 0.14);
      const brakeRx =  (Math.PI / 2 - 0.10);
      _fogShafts.push(_mkLightCone(new THREE.Vector3( hX, hY,  fZ), headRx, new THREE.Color(0.78, 0.90, 1.0), 0.038, rY));
      _fogShafts.push(_mkLightCone(new THREE.Vector3(-hX, hY,  fZ), headRx, new THREE.Color(0.78, 0.90, 1.0), 0.038, rY));
      _fogShafts.push(_mkLightCone(new THREE.Vector3(  0, hY, -fZ), brakeRx, new THREE.Color(1.0, 0.05, 0.02), 0.026, rY));
    }

    // Build bloom lists once — avoids scene.traverse every frame
    scene.traverse(obj => {
      if (!obj.isMesh || _bloomLayers.test(obj.layers)) return;
      if (obj.material && obj.material.transparent) _bloomHideList.push(obj);
      else if (obj.material) _bloomDarkList.push({ mesh: obj, mat: obj.material });
    });
    _bloomReady = true;

    barEl.style.width = '100%'; // ensure bar hits 100% before fade
    setTimeout(() => {
      loadingEl.classList.add('out');
      setTimeout(() => {
        loadingEl.style.display = 'none';
        carNameEl.textContent = '';
        carNameEl.classList.add('show');
        scrollHint.classList.add('show');
      }, 2600);
    }, 300); // brief pause so scanner beam reaches bottom
  },
  xhr => {
    const pctEl = document.getElementById('load-pct');
    if (xhr.lengthComputable && xhr.total) {
      const pct = Math.round(xhr.loaded / xhr.total * 100);
      barEl.style.width = pct + '%';
      if (pctEl) pctEl.textContent = pct + '%';
    }
  },
  err => {
    console.error(err);
    const titleEl = document.getElementById('loading-title');
    if (titleEl) titleEl.textContent = 'LOAD ERROR — CHECK CONSOLE';
  }
);

// ─── Cinematic camera ─────────────────────────────────────────────────────────
const CAM_CLEARANCE = 68;
let _camAxX = 130, _camAxZ = 200;

// _rawProgress  : where scroll says we are (0–1), jumps instantly
// _smoothProgress: velocity-capped lerp of _rawProgress, drives camera + text
// Exposed as window._carOrbitProgress so the HTML text animation stays in sync.
let _rawProgress = 0, _smoothProgress = 0;
const _ORBIT_H = 3 * window.innerHeight; // matches 300vh orbit-spacer exactly

// Pause/resume the animation loop so section scrolling gets full GPU budget
let _animPaused = false;
let _animFrameId = null;

window.addEventListener('scroll', () => {
  _rawProgress = Math.min(window.scrollY / _ORBIT_H, 1);
  const inSections = window.scrollY > _ORBIT_H * 1.05;
  if (inSections && !_animPaused) {
    _animPaused = true;                 // stops the loop after current frame
  } else if (!inSections && _animPaused) {
    _animPaused = false;
    animate();                          // restart loop when scrolling back
  }
}, { passive: true });

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  _bloomComposer.setSize(window.innerWidth * window.devicePixelRatio, window.innerHeight * window.devicePixelRatio);
  _finalComposer.setSize(window.innerWidth, window.innerHeight);
  _msaaTarget.setSize(
    window.innerWidth  * window.devicePixelRatio,
    window.innerHeight * window.devicePixelRatio
  );
});

let _prevRaf = performance.now();
function animate() {
  const _nowRaf = performance.now();
  const _dtRaf  = Math.min((_nowRaf - _prevRaf) / 16.67, 3); // normalised to 60fps
  _prevRaf = _nowRaf;
  // Autonomous slow star drift
  _starPoints.rotation.y += 0.000022 * _dtRaf;
  _starPoints.rotation.x += 0.000008 * _dtRaf;

  // ── Fog drift ──────────────────────────────────────────────────────────────
  _fogLayers.forEach(fl => {
    fl.mesh.position.x = fl.baseX + Math.sin(_nowRaf * fl.freqX + fl.phase) * fl.ampX;
    fl.mesh.position.z = fl.baseZ + Math.cos(_nowRaf * fl.freqZ + fl.phase + 0.9) * fl.ampZ;
    fl.mesh.rotation.z += fl.rotSpd * _dtRaf;
    // Slow opacity breathing — makes the fog feel alive
    fl.mesh.material.opacity = fl.baseOp * (0.70 + 0.30 * Math.abs(Math.sin(_nowRaf * 0.00024 + fl.phase)));
  });

  // ── Light shaft shimmer (subtle turbulence) ────────────────────────────────
  _fogShafts.forEach((fs, i) => {
    fs.mesh.material.opacity = fs.baseOp * (0.78 + 0.22 * Math.sin(_nowRaf * 0.00078 + i * 1.57));
  });

  // ── Velocity-capped smooth progress ───────────────────────────────────────
  // Lerp toward raw scroll target but cap maximum speed so the orbit never
  // races through when the user scrolls fast.  Full orbit takes ≥ ~2.8 s.
  const _pDiff = _rawProgress - _smoothProgress;
  const _pStep = _pDiff * (1 - Math.pow(0.88, _dtRaf));   // lerp component
  const _pCap  = 0.006 * _dtRaf;                           // max Δ per frame
  _smoothProgress += Math.sign(_pStep) * Math.min(Math.abs(_pStep), _pCap);

  // Share with HTML script so text animation stays perfectly in sync
  window._carOrbitProgress = _smoothProgress;

  // ── Cinematic camera ───────────────────────────────────────────────────────
  const _cinAR = _smoothProgress * Math.PI * 2 + Math.PI * 1.05;

  camera.position.set(Math.sin(_cinAR) * _camAxX, 55, Math.cos(_cinAR) * _camAxZ);
  camera.lookAt(0, 46, 0);

  if (_bloomReady) {
    const _savedBg = scene.background;
    scene.background = _bloomBlack;
    _bloomDarkList.forEach(e => { e.mesh.material = _darkMat; });
    _bloomHideList.forEach(o => { o.visible = false; });
    _bloomComposer.render();
    scene.background = _savedBg;
    _bloomHideList.forEach(o => { o.visible = true; });
    _bloomDarkList.forEach(e => { e.mesh.material = e.mat; });
    _finalComposer.render();
  } else {
    renderer.render(scene, camera);
  }

  // Schedule next frame only if not paused
  if (!_animPaused) _animFrameId = requestAnimationFrame(animate);
}
animate();
