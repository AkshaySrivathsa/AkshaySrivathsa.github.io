import * as THREE from 'three';
import { FBXLoader }       from 'three/addons/loaders/FBXLoader.js';
import { FontLoader }      from 'three/addons/loaders/FontLoader.js';
import { TextGeometry }    from 'three/addons/geometries/TextGeometry.js';
import { EffectComposer }  from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass }      from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass }              from 'three/addons/postprocessing/ShaderPass.js';
import { OutputPass }              from 'three/addons/postprocessing/OutputPass.js';
import { RectAreaLightUniformsLib } from 'three/addons/lights/RectAreaLightUniformsLib.js';

// ─── Renderer ────────────────────────────────────────────────────────────────
const canvas = document.getElementById('c');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(window.devicePixelRatio);
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.10;
renderer.outputColorSpace = THREE.SRGBColorSpace;

// ─── Scene ────────────────────────────────────────────────────────────────────
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x000000);
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
  new THREE.Vector2(window.innerWidth, window.innerHeight),
  0.55,  // strength
  0.18,  // wider radius — gives stars visible glow halo
  0.0
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
// ── Carbon fiber canvas — finer weave (8px cells, 16×16 grid in 128px) ───────
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

// Body: #170120 midnight purple — metallic with deep reflections
const matBody = new THREE.MeshStandardMaterial({
  color: new THREE.Color(0.040, 0.002, 0.065),
  metalness: 0.82, roughness: 0.20,
  side: THREE.DoubleSide,
});
addTriplanar(matBody, cfTex, 7.0, 0.28, true);

const matGlass = new THREE.MeshPhysicalMaterial({
  color:           new THREE.Color(0.94, 0.97, 1.0),
  metalness:       0.0,
  roughness:       0.04,
  transmission:    0.92,
  thickness:       3.0,
  ior:             1.52,
  reflectivity:    0.50,
  envMapIntensity: 0.5,
  transparent:     true,
  opacity:         1.0,
  side:            THREE.DoubleSide,
  depthWrite:      false,
  fog:             false,   // scene fog must never tint the glass
});

const matRubber = new THREE.MeshStandardMaterial({
  color: new THREE.Color(0.028, 0.028, 0.032),
  metalness: 0, roughness: 0.94,
});

const matRim = new THREE.MeshStandardMaterial({
  color: new THREE.Color(0.22, 0.22, 0.28),
  metalness: 0.82, roughness: 0.20,
});

const matBrakeDisc = new THREE.MeshStandardMaterial({
  color: new THREE.Color(0.18, 0.18, 0.20),
  metalness: 0.90, roughness: 0.35,
});

const matHead = new THREE.MeshStandardMaterial({
  color: 0xdde8ff,
  emissive: new THREE.Color(0xdde8ff),
  emissiveIntensity: 0.25,
  roughness: 0.05, metalness: 0.0,
});

const matBrake = new THREE.MeshStandardMaterial({
  color: 0xcc0000,
  emissive: new THREE.Color(0xcc0000),
  emissiveIntensity: 2.0,
  roughness: 0.0, metalness: 0.0,
});

const matChrome = new THREE.MeshStandardMaterial({
  color: new THREE.Color(0.72, 0.72, 0.75),
  metalness: 0.98, roughness: 0.06,
});

// Brake/tail light cover — deep red tint, lets the dark red emissive bleed through
const matTailCover = new THREE.MeshStandardMaterial({
  color: new THREE.Color(0.35, 0.0, 0.0),
  roughness: 0.04, metalness: 0.05,
  transparent: true, opacity: 0.40,
  side: THREE.DoubleSide,
});

// Headlight cover/lens — near-clear so the white LEDs show through
const matHeadCover = new THREE.MeshStandardMaterial({
  color: new THREE.Color(0.88, 0.92, 1.0),
  roughness: 0.04, metalness: 0.05,
  transparent: true, opacity: 0.22,
  side: THREE.DoubleSide,
});

// Brushed silver steel — used on bumpers, spoiler, trim
const matSteel = new THREE.MeshStandardMaterial({
  color: new THREE.Color(0.55, 0.55, 0.58),
  metalness: 0.88, roughness: 0.22,
});
addTriplanar(matSteel, smTex, 12.0, 0.55, false);


// ─── Number plate — image texture ────────────────────────────────────────────
const _plateTex = new THREE.TextureLoader().load('cars-assets/plate-akshay.png');
_plateTex.flipY = false;
_plateTex.anisotropy = 16;

const matPlate = new THREE.MeshStandardMaterial({
  map: _plateTex,
  roughness: 0.40,
  metalness: 0.0,
  side: THREE.DoubleSide,
});

// ─── Porsche crest emblem ─────────────────────────────────────────────────────
const _emblemTex = new THREE.TextureLoader().load('cars-assets/porsche-logo.png');
_emblemTex.anisotropy = 16;
// Crest image is ~1:1.15 (w:h). Compress the U axis so it doesn't appear wide on the mesh.
_emblemTex.repeat.set(0.82, 1.0);
_emblemTex.offset.set(0.09, 0);

const matEmblem = new THREE.MeshStandardMaterial({
  map: _emblemTex,
  roughness: 0.25,
  metalness: 0.55,
  transparent: true,
  alphaTest: 0.1,
  side: THREE.DoubleSide,
});

// ─── Rear chrome lettering material ──────────────────────────────────────────
const matChromeLetters = new THREE.MeshStandardMaterial({
  color: new THREE.Color(0.88, 0.88, 0.92),
  metalness: 0.97,
  roughness: 0.06,
});

// ─── Interior: dark matte red ─────────────────────────────────────────────────
const matInterior = new THREE.MeshStandardMaterial({
  color: new THREE.Color(0.40, 0.005, 0.010),
  roughness: 0.88, metalness: 0.0,
  side: THREE.DoubleSide,
});

// ─── Steering wheel: matte black ─────────────────────────────────────────────
const matSteering = new THREE.MeshStandardMaterial({
  color: new THREE.Color(0.04, 0.04, 0.04),
  roughness: 0.65, metalness: 0.05,
});

// ─── Name-based classification ────────────────────────────────────────────────
function classify(name) {
  // Glass panels
  if (/glass|windshield|wind\d|tinted|side.?glass/i.test(name)) return 'glass';

  // Front headlight emissives (white) — rfog excluded (rear fog lights, not front)
  if (/headlightled|headlightmain|headlightstroke|frontfoglight$|foglight(?!cover)/i.test(name)
      && !/rear|brake|reverse|rfog/i.test(name)) return 'head';

  // Red rear brake / tail lights
  if (/brakelight(?!cover)|rmonol|taillight/i.test(name)) return 'brake';

  // Rear fog lights → chrome trim (not orange)
  if (/^rfoglights?$/i.test(name)) return 'chrome';

  // Reverse lights → chrome (not active in showcase)
  if (/reverselight(?!cover)|reverselightpat/i.test(name)) return 'chrome';

  // Brake / tail light covers → dark red transparent
  if (/brakelightcover|rearmonolightcover|rearmono.*cover/i.test(name)) return 'tailcover';

  // Headlight covers and lenses → near-clear transparent
  if (/headlightcover|headlightlen|headlightlens|headlightbase/i.test(name)) return 'headcover';

  // Steering wheel → matte black
  if (/steering|SteeringWheel/i.test(name)) return 'steering';

  // Interior surfaces → formula red
  if (/seat|interior|dashboard|dash|console|carpet|trim|panel|door.*inner|inner.*door|cabin|upholster/i.test(name)) return 'interior';

  // Front grilles, vents, mesh inserts → metallic silver (not purple)
  if (/grille|grill|FrontGrid|FrontMesh|bumper.*vent|vent.*bumper|intake(?!Frame)|FrontAir|grillmesh|gridmesh/i.test(name)) return 'chrome';

  // Rear diffuser / lower rear extension → metallic silver
  if (/diffuser|splitter|rearApron|rearLip|rearDif|rear.*lip|rear.*skirt|RearBottom|RearLower/i.test(name)) return 'chrome';

  // Chrome / silver: mirrors, exhaust, logos, fog covers, door handles, intake frames
  if (/mirror|exhaust|lightlogo|fogcover|^handles$|airIntakeFrame/i.test(name)) return 'chrome';

  // Brushed steel: shields, skirts, sills, door trim
  if (/shield|DoorShiel|LowerShield/i.test(name)) return 'steel';

  // Rims
  if (/rim|wrim/i.test(name)) return 'rim';

  // Tyres
  if (/^tire|tirefl|tirefr|tirerl|tirerr/i.test(name)) return 'rubber';

  // Brake discs
  if (/brakedisc/i.test(name)) return 'disc';

  // Porsche crest emblem
  if (/^Logo$|^logo$|^MainLogo$/i.test(name)) return 'emblem';

  // Number plates
  if (/^NumberF$|^NumberR$|^Reg_/i.test(name)) return 'plate';

  // Everything else (bumpers, spoiler, hood, doors, roof) → carbon fiber body
  return 'body';
}

// ─── Load ─────────────────────────────────────────────────────────────────────
const loadingEl  = document.getElementById('loading');
const barEl      = document.getElementById('loading-bar');
const carNameEl  = document.getElementById('car-name');
const scrollHint = document.getElementById('scroll-hint');

const plateMeshRefs = [];

new FBXLoader().load(
  'https://github.com/AkshaySrivathsa/AkshaySrivathsa.github.io/releases/download/v1.0-assets/porsche.fbx',
  fbx => {
    fbx.traverse(child => {
      if (!child.isMesh) return;

      child.castShadow = true;
      child.receiveShadow = true;

      const type = classify(child.name);
      switch (type) {
        case 'glass':  child.material = matGlass;         break;
        case 'head':
          child.material = matHead.clone();
          child.layers.enable(BLOOM_LAYER);
          break;
        case 'brake':
          child.material = matBrake.clone();
          child.layers.enable(BLOOM_LAYER);
          break;
        case 'rim':    child.material = matRim;           break;
        case 'rubber': child.material = matRubber;        break;
        case 'disc':   child.material = matBrakeDisc;     break;
        case 'chrome':     child.material = matChrome;       break;
        case 'tailcover':  child.material = matTailCover;   break;
        case 'headcover':  child.material = matHeadCover;   break;
        case 'steel':    child.material = matSteel;          break;
        case 'interior': child.material = matInterior;      break;
        case 'steering': child.material = matSteering;      break;
        case 'plate':
          child.visible = false; // replaced by accurate overlay below
          plateMeshRefs.push(child);
          break;
        case 'emblem':
          child.material = matEmblem;
          child.scale.setScalar(1.6);
          break;
        default:       child.material = matBody;           break;
      }
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

    // ── Plate overlays at exact mesh positions ────────────────────────────────
    fbx.updateMatrixWorld(true);

    const _pTex = new THREE.TextureLoader().load('cars-assets/plate-akshay.png');
    _pTex.flipY = true;

    plateMeshRefs.forEach(pm => {
      pm.updateWorldMatrix(true, false);

      const pmBox  = new THREE.Box3().setFromObject(pm);
      const wPos   = pmBox.getCenter(new THREE.Vector3());
      const pmSize = pmBox.getSize(new THREE.Vector3());
      const pmW    = Math.max(pmSize.x, pmSize.z);
      const pmH    = pmSize.y;

      const pMat = new THREE.MeshStandardMaterial({
        map: _pTex,
        roughness: 0.35,
        metalness: 0.0,
        side: THREE.FrontSide,
      });

      const plane = new THREE.Mesh(new THREE.PlaneGeometry(pmW, pmH), pMat);

      const isRear = /NumberR/i.test(pm.name);
      plane.rotation.y = isRear ? fbx.rotation.y + Math.PI : fbx.rotation.y;

      if (!isRear) return; // skip front plate

      const outDir = new THREE.Vector3(0, 0, -1)
        .applyAxisAngle(new THREE.Vector3(0, 1, 0), fbx.rotation.y);
      plane.position.copy(wPos);
      plane.position.addScaledVector(outDir, 1.5);

      scene.add(plane);
    });

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
  xhr => { if (xhr.total) barEl.style.width = (xhr.loaded / xhr.total * 100) + '%'; },
  err => console.error(err)
);

// ─── Cinematic camera ─────────────────────────────────────────────────────────
const CAM_CLEARANCE = 68;
let _camAxX = 130, _camAxZ = 200;

// _rawProgress  : where scroll says we are (0–1), jumps instantly
// _smoothProgress: velocity-capped lerp of _rawProgress, drives camera + text
// Exposed as window._carOrbitProgress so the HTML text animation stays in sync.
let _rawProgress = 0, _smoothProgress = 0;
const _ORBIT_H = 4 * window.innerHeight;

window.addEventListener('scroll', () => {
  _rawProgress = Math.min(window.scrollY / _ORBIT_H, 1);
}, { passive: true });

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  _bloomComposer.setSize(window.innerWidth, window.innerHeight);
  _finalComposer.setSize(window.innerWidth, window.innerHeight);
  _msaaTarget.setSize(
    window.innerWidth  * window.devicePixelRatio,
    window.innerHeight * window.devicePixelRatio
  );
});

let _prevRaf = performance.now();
function animate() {
  requestAnimationFrame(animate);
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

  // Bloom pass — use pre-built lists so scene.traverse never runs per-frame
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
}
animate();
