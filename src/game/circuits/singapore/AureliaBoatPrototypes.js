/**
 * Faithful model extraction from docs/reference/aurelia-original.html.
 * Source SHA-256: 37995e90173b7a8525f9e378d52f66a315de58efdc6fd88bd723f3fc3ae02611
 * All original geometry, UVs, procedural textures, tessellation, materials and
 * micro-details are retained. Only the separate presentation renderer/camera/
 * studio lights/post FX are not part of a game-world model.
 * Regenerate with: node scripts/extract-aurelia-models.mjs
 * This is JavaScript intentionally: it preserves the supplied model source;
 * the integration and fleet lifecycle are typed in SingaporeMaritimeFleet.ts.
 */
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

export function createAureliaBoatPrototypes(maxAnisotropy = 16) {
  const scene = new THREE.Group();
  scene.name = 'AURELIA_Yacht_Prototype';
  // Texture capability input only, never a second renderer.
  const renderer = { capabilities: { getMaxAnisotropy: () => Math.max(1, maxAnisotropy) } };
  const random = (() => { let s = 19770923; return () => { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; }; })();
  const mat = {};
  mat.hull = new THREE.MeshPhysicalMaterial({ color: 0xcbd1cd, metalness: 0.008, roughness: 0.50, clearcoat: 0.22, clearcoatRoughness: 0.40, envMapIntensity: 0.22 });
  mat.navy = new THREE.MeshPhysicalMaterial({ color: 0x071827, metalness: 0.06, roughness: 0.44, clearcoat: 0.34, clearcoatRoughness: 0.34, envMapIntensity: 0.25 });
  mat.underside = new THREE.MeshPhysicalMaterial({ color: 0x0a1c27, metalness: 0.035, roughness: 0.50, clearcoat: 0.20, clearcoatRoughness: 0.42, envMapIntensity: 0.20 });
  mat.gold = new THREE.MeshStandardMaterial({ color: 0xa98f61, metalness: 0.56, roughness: 0.46, envMapIntensity: 0.40 });
  mat.chrome = new THREE.MeshPhysicalMaterial({ color: 0x929fa4, metalness: 0.70, roughness: 0.43, clearcoat: 0.08, clearcoatRoughness: 0.46, envMapIntensity: 0.40 });
  mat.chromeDark = new THREE.MeshStandardMaterial({ color: 0x26353c, metalness: 0.38, roughness: 0.48, envMapIntensity: 0.35 });
  mat.glass = new THREE.MeshPhysicalMaterial({ color: 0xffffff, metalness: 0.015, roughness: 0.28, clearcoat: 0.34, clearcoatRoughness: 0.30, envMapIntensity: 0.20 });
  mat.white = new THREE.MeshPhysicalMaterial({ color: 0xcbd1cc, metalness: 0.008, roughness: 0.56, clearcoat: 0.18, clearcoatRoughness: 0.43, envMapIntensity: 0.20 });
  mat.whiteTrim = new THREE.MeshStandardMaterial({ color: 0xc3cbc7, metalness: 0.025, roughness: 0.54, envMapIntensity: 0.18 });
  mat.rubber = new THREE.MeshStandardMaterial({ color: 0x10191f, roughness: 0.68, metalness: 0.04 });
  mat.black = new THREE.MeshStandardMaterial({ color: 0x0b1115, roughness: 0.42, metalness: 0.08 });
  mat.leather = new THREE.MeshPhysicalMaterial({ color: 0xd8d0c1, roughness: 0.78, clearcoat: 0.12, clearcoatRoughness: 0.6 });
  mat.cushion = new THREE.MeshPhysicalMaterial({ color: 0xe4e0d5, roughness: 0.92, sheen: 0.28, sheenColor: 0xaeb8b7 });
  mat.cushionDark = new THREE.MeshPhysicalMaterial({ color: 0x253942, roughness: 0.91, sheen: 0.24 });
  mat.blackCushion = new THREE.MeshPhysicalMaterial({ color: 0x303b40, roughness: 0.90, sheen: 0.22 });
  mat.wood = new THREE.MeshStandardMaterial({ color: 0xb49a70, roughness: 0.75, metalness: 0.0 });
  mat.darkWood = new THREE.MeshStandardMaterial({ color: 0x342d25, roughness: 0.70, metalness: 0.015 });
  mat.waterAccent = new THREE.MeshStandardMaterial({ color: 0x6d969e, roughness: 0.40, metalness: 0.08 });
  mat.emissiveWarm = new THREE.MeshStandardMaterial({ color: 0xb8874d, emissive: 0xd27b32, emissiveIntensity: 0.65, roughness: 0.48 });
  mat.emissiveCool = new THREE.MeshStandardMaterial({ color: 0x62bfa0, emissive: 0x209b78, emissiveIntensity: 0.75, roughness: 0.38 });
  mat.emissiveRed = new THREE.MeshStandardMaterial({ color: 0xb64b48, emissive: 0xb52b28, emissiveIntensity: 0.72, roughness: 0.42 });
  
  function createNoiseTexture(size = 256, base = 128, amplitude = 10) {
    const data = new Uint8Array(size * size * 4);
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const i = (y * size + x) * 4;
        const grain = (random() - 0.5) * amplitude;
        const cloud = Math.sin(x * 0.07) * Math.cos(y * 0.05) * amplitude * 0.16;
        const v = THREE.MathUtils.clamp(base + grain + cloud, 0, 255);
        data[i] = v; data[i + 1] = v; data[i + 2] = v; data[i + 3] = 255;
      }
    }
    const texture = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
    texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
    texture.minFilter = THREE.LinearMipmapLinearFilter;
    texture.magFilter = THREE.LinearFilter;
    texture.generateMipmaps = true;
    texture.needsUpdate = true;
    return texture;
  }
  const microRoughness = createNoiseTexture(512, 213, 12);
  const microBump = createNoiseTexture(512, 128, 22);
  mat.hull.roughnessMap = microRoughness;
  mat.navy.roughnessMap = microRoughness;
  mat.hull.bumpMap = microBump; mat.hull.bumpScale = 0.0018;
  mat.navy.bumpMap = microBump; mat.navy.bumpScale = 0.0014;
  mat.white.roughnessMap = microRoughness;
  mat.white.bumpMap = microBump; mat.white.bumpScale = 0.0012;
  
  function makeWoodTexture() {
    const canvas = document.createElement('canvas'); canvas.width = 512; canvas.height = 512;
    const ctx = canvas.getContext('2d');
    const grad = ctx.createLinearGradient(0, 0, 512, 0);
    grad.addColorStop(0, '#9e8058'); grad.addColorStop(.18, '#b99b6e'); grad.addColorStop(.45, '#c5a97d');
    grad.addColorStop(.73, '#b4976a'); grad.addColorStop(1, '#a1845c');
    ctx.fillStyle = grad; ctx.fillRect(0, 0, 512, 512);
    // Fine longitudinal teak fibres: restrained contrast, no repeated cartoon stripes.
    for (let i = 0; i < 360; i++) {
      const x = random() * 512, alpha = 0.012 + random() * 0.055;
      const dark = random() > .46;
      ctx.strokeStyle = dark ? `rgba(54,38,24,${alpha})` : `rgba(246,222,183,${alpha*.82})`;
      ctx.lineWidth = .35 + random() * 1.25; ctx.beginPath();
      ctx.moveTo(x, 0);
      const drift = (random() - .5) * 4.0, phase = random() * 6.28, freq = .012 + random() * .018;
      for (let y = 0; y <= 512; y += 16) ctx.lineTo(x + Math.sin(y*freq + phase)*1.6 + drift*y/512, y);
      ctx.stroke();
    }
    // A few almost imperceptible growth streaks add natural variation at close inspection.
    for (let i = 0; i < 8; i++) {
      const x = random()*512, w = 2 + random()*6;
      const g = ctx.createLinearGradient(x-w,0,x+w,0);
      g.addColorStop(0,'rgba(55,39,23,0)'); g.addColorStop(.5,`rgba(55,39,23,${.025+random()*.025})`); g.addColorStop(1,'rgba(55,39,23,0)');
      ctx.fillStyle=g; ctx.fillRect(x-w,0,w*2,512);
    }
    // Fine low-amplitude grain noise, avoiding high-contrast speckling.
    for (let i = 0; i < 9000; i++) {
      const v = random() > .5 ? 'rgba(45,31,20,.025)' : 'rgba(255,239,205,.045)';
      ctx.fillStyle=v; ctx.fillRect(random()*512, random()*512, .5+random()*1.1, .5+random()*2.0);
    }
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace; texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
    texture.anisotropy = Math.min(renderer.capabilities.getMaxAnisotropy(), 12);
    texture.needsUpdate = true;
    return texture;
  }
  function makeGelcoatTexture() {
    const canvas=document.createElement('canvas'); canvas.width=512; canvas.height=512;
    const c=canvas.getContext('2d'); c.fillStyle='#faf9f4'; c.fillRect(0,0,512,512);
    for(let i=0;i<420;i++) {
      const x=random()*512, y=random()*512, r=8+random()*42;
      const g=c.createRadialGradient(x,y,0,x,y,r);
      g.addColorStop(0,random()>.5?'rgba(120,137,137,.022)':'rgba(255,255,255,.03)');
      g.addColorStop(1,'rgba(255,255,255,0)'); c.fillStyle=g; c.fillRect(x-r,y-r,r*2,r*2);
    }
    for(let i=0;i<11000;i++) {
      const alpha=.006+random()*.012;
      c.fillStyle=random()>.5?`rgba(92,107,108,${alpha})`:`rgba(255,255,255,${alpha*1.4})`;
      c.fillRect(random()*512,random()*512,.45+random()*1.0,.45+random()*1.0);
    }
    const texture=new THREE.CanvasTexture(canvas); texture.colorSpace=THREE.SRGBColorSpace;
    texture.wrapS=texture.wrapT=THREE.RepeatWrapping; texture.anisotropy=Math.min(renderer.capabilities.getMaxAnisotropy(),8); texture.needsUpdate=true;
    return texture;
  }
  function makeGlassTexture() {
    const canvas=document.createElement('canvas'); canvas.width=512; canvas.height=256;
    const c=canvas.getContext('2d');
    const g=c.createLinearGradient(0,0,0,256);
    g.addColorStop(0,'#203a49'); g.addColorStop(.22,'#102a3a'); g.addColorStop(.58,'#071b2a'); g.addColorStop(1,'#0b2534');
    c.fillStyle=g; c.fillRect(0,0,512,256);
    const sheen=c.createLinearGradient(0,0,512,0);
    sheen.addColorStop(0,'rgba(185,216,225,.02)'); sheen.addColorStop(.28,'rgba(185,216,225,.015)');
    sheen.addColorStop(.36,'rgba(220,237,237,.15)'); sheen.addColorStop(.39,'rgba(220,237,237,.035)');
    sheen.addColorStop(.68,'rgba(180,213,223,.02)'); sheen.addColorStop(.78,'rgba(235,244,241,.09)'); sheen.addColorStop(1,'rgba(185,216,225,.015)');
    c.fillStyle=sheen; c.fillRect(0,0,512,256);
    for(let i=0;i<34;i++) {
      const x=random()*512, w=.4+random()*2.5;
      c.fillStyle=`rgba(205,228,232,${.008+random()*.018})`; c.fillRect(x,0,w,256);
    }
    const texture=new THREE.CanvasTexture(canvas); texture.colorSpace=THREE.SRGBColorSpace;
    texture.wrapS=texture.wrapT=THREE.RepeatWrapping; texture.anisotropy=Math.min(renderer.capabilities.getMaxAnisotropy(),8); texture.needsUpdate=true;
    return texture;
  }
  function makeSpaWaterTexture() {
    const canvas=document.createElement('canvas'); canvas.width=512; canvas.height=512;
    const c=canvas.getContext('2d');
    const g=c.createRadialGradient(256,238,18,256,256,300);
    g.addColorStop(0,'#2b8790'); g.addColorStop(.55,'#246f7c'); g.addColorStop(1,'#174c5a');
    c.fillStyle=g; c.fillRect(0,0,512,512);
    for(let i=0;i<22;i++) {
      const r=26+i*10+(random()-.5)*3;
      c.beginPath(); c.arc(256+(random()-.5)*5,256+(random()-.5)*5,r,0,Math.PI*2);
      c.strokeStyle=i%3===0?'rgba(194,231,225,.095)':'rgba(12,53,64,.065)';
      c.lineWidth=.8+random()*1.2; c.stroke();
    }
    for(let i=0;i<420;i++) {
      const x=random()*512,y=random()*512;
      c.strokeStyle=random()>.5?'rgba(210,239,231,.045)':'rgba(4,41,54,.04)'; c.lineWidth=.5+random()*1.2;
      c.beginPath(); c.moveTo(x,y); c.bezierCurveTo(x+6,y-4,x+12,y+4,x+20,y+(random()-.5)*5); c.stroke();
    }
    const texture=new THREE.CanvasTexture(canvas); texture.colorSpace=THREE.SRGBColorSpace;
    texture.wrapS=texture.wrapT=THREE.RepeatWrapping; texture.anisotropy=Math.min(renderer.capabilities.getMaxAnisotropy(),8); texture.needsUpdate=true; return texture;
  }
  function makeFabricTexture() {
    const canvas=document.createElement('canvas'); canvas.width=512; canvas.height=512;
    const c=canvas.getContext('2d'); c.fillStyle='#f1eee5'; c.fillRect(0,0,512,512);
    for(let y=0;y<512;y+=2) { c.strokeStyle=`rgba(93,99,96,${.018+random()*.018})`; c.lineWidth=.45; c.beginPath(); c.moveTo(0,y); c.lineTo(512,y+(random()-.5)*1.2); c.stroke(); }
    for(let x=0;x<512;x+=3) { c.strokeStyle=`rgba(255,255,255,${.10+random()*.06})`; c.lineWidth=.4; c.beginPath(); c.moveTo(x,0); c.lineTo(x+(random()-.5)*1.2,512); c.stroke(); }
    for(let i=0;i<7000;i++){const a=.012+random()*.025;c.fillStyle=random()>.5?`rgba(55,64,65,${a})`:`rgba(255,255,255,${a})`;c.fillRect(random()*512,random()*512,.5+random()*1.3,.5+random()*1.3);}
    const texture=new THREE.CanvasTexture(canvas); texture.colorSpace=THREE.SRGBColorSpace; texture.wrapS=texture.wrapT=THREE.RepeatWrapping; texture.anisotropy=Math.min(renderer.capabilities.getMaxAnisotropy(),8); texture.needsUpdate=true; return texture;
  }
  const woodTexture = makeWoodTexture();
  const glassTexture = makeGlassTexture(); mat.glass.map=glassTexture; mat.glass.color.setHex(0xffffff); mat.glass.needsUpdate=true;
  const gelcoatTexture = makeGelcoatTexture();
  mat.hull.map=gelcoatTexture; mat.hull.needsUpdate=true;
  mat.white.map=gelcoatTexture; mat.white.needsUpdate=true;
  const spaWaterTexture = makeSpaWaterTexture();
  const fabricTexture = makeFabricTexture();
  mat.cushion.map=fabricTexture; mat.cushion.bumpMap=microBump; mat.cushion.bumpScale=.006;
  mat.cushionDark.map=fabricTexture; mat.cushionDark.bumpMap=microBump; mat.cushionDark.bumpScale=.005;
  mat.blackCushion.map=fabricTexture; mat.blackCushion.bumpMap=microBump; mat.blackCushion.bumpScale=.005;
  const teakMaterial = new THREE.MeshStandardMaterial({ map: woodTexture, color: 0xffffff, roughness: 0.78, metalness: 0.0 });
  teakMaterial.bumpMap = microBump; teakMaterial.bumpScale = 0.0035;
  const teakEdgeMaterial = new THREE.MeshStandardMaterial({ color: 0x342c23, roughness: 0.84 });
  const teakCaulkMaterial = new THREE.MeshStandardMaterial({ color: 0x29241e, roughness: 0.88, metalness: 0.0 });
  
  // Shared primitive-geometry cache. Repeated bolts, cylinders, trim rings, spheres and boxes
  // reuse the same immutable buffers; per-object variation remains in each Mesh transform.
  // This reduces JS/GPU buffer duplication and startup work without changing silhouettes.
  const primitiveGeometryCache = new Map();
  let primitiveGeometryCacheHits = 0;
  let primitiveGeometryCacheMisses = 0;
  const geometryKeyValue = value => typeof value === 'number' ? Number(value).toPrecision(10) : String(value);
  function getPrimitiveGeometry(type, args, factory) {
    const key = `${type}|${args.map(geometryKeyValue).join('|')}`;
    const cached = primitiveGeometryCache.get(key);
    if (cached) { primitiveGeometryCacheHits++; return cached; }
    const geometry = factory();
    primitiveGeometryCache.set(key, geometry);
    primitiveGeometryCacheMisses++;
    return geometry;
  }
  function cachedCylinderGeometry(radiusTop, radiusBottom, height, radialSegments=8, heightSegments=1, openEnded=false, thetaStart=0, thetaLength=Math.PI*2) {
    const args=[radiusTop,radiusBottom,height,radialSegments,heightSegments,openEnded,thetaStart,thetaLength];
    return getPrimitiveGeometry('cylinder', args, () => new THREE.CylinderGeometry(...args));
  }
  function cachedTorusGeometry(radius=1, tube=0.4, radialSegments=12, tubularSegments=48, arc=Math.PI*2) {
    const args=[radius,tube,radialSegments,tubularSegments,arc];
    return getPrimitiveGeometry('torus', args, () => new THREE.TorusGeometry(...args));
  }
  function cachedSphereGeometry(radius=1, widthSegments=32, heightSegments=16, phiStart=0, phiLength=Math.PI*2, thetaStart=0, thetaLength=Math.PI) {
    const args=[radius,widthSegments,heightSegments,phiStart,phiLength,thetaStart,thetaLength];
    return getPrimitiveGeometry('sphere', args, () => new THREE.SphereGeometry(...args));
  }
  function cachedBoxGeometry(width=1, height=1, depth=1, widthSegments=1, heightSegments=1, depthSegments=1) {
    const args=[width,height,depth,widthSegments,heightSegments,depthSegments];
    return getPrimitiveGeometry('box', args, () => new THREE.BoxGeometry(...args));
  }
  function cachedRoundedBoxGeometry(width=1, height=1, depth=1, segments=2, radius=0.1) {
    const args=[width,height,depth,segments,radius];
    return getPrimitiveGeometry('rounded-box', args, () => new RoundedBoxGeometry(...args));
  }
  
  function addMesh(geometry, material, parent = scene, position = null, rotation = null) {
    const mesh = new THREE.Mesh(geometry, material);
    if (position) mesh.position.set(position[0], position[1], position[2]);
    if (rotation) mesh.rotation.set(rotation[0], rotation[1], rotation[2]);
    mesh.castShadow = true; mesh.receiveShadow = true;
    parent.add(mesh);
    return mesh;
  }
  function roundedBox(parent, w, h, d, x, y, z, material, radius = 0.08, segments = 4) {
    const r = Math.max(0.002, Math.min(radius, w * 0.22, h * 0.42, d * 0.22));
    return addMesh(cachedRoundedBoxGeometry(w, h, d, segments, r), material, parent, [x, y, z]);
  }
  function cylinderBetween(parent, a, b, radius, material, radialSegments = 10) {
    const va = new THREE.Vector3(...a), vb = new THREE.Vector3(...b);
    const diff = new THREE.Vector3().subVectors(vb, va);
    const geometry = cachedCylinderGeometry(1, 1, 1, radialSegments);
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.copy(va).add(vb).multiplyScalar(0.5);
    mesh.scale.set(radius, diff.length(), radius);
    mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), diff.normalize());
    mesh.castShadow = true; mesh.receiveShadow = true; parent.add(mesh); return mesh;
  }
  function tube(parent, points, radius, material, tubularSegments = 100, radialSegments = 8, closed = false) {
    const curve = new THREE.CatmullRomCurve3(points.map(p => p.isVector3 ? p : new THREE.Vector3(...p)), closed, 'centripetal');
    return addMesh(new THREE.TubeGeometry(curve, tubularSegments, radius, radialSegments, closed), material, parent);
  }
  function sphere(parent, x, y, z, sx, sy, sz, material, widthSegments = 18, heightSegments = 12) {
    const m = addMesh(cachedSphereGeometry(1, widthSegments, heightSegments), material, parent, [x, y, z]);
    m.scale.set(sx, sy, sz); return m;
  }
  // Procedural hull mesh. Each longitudinal station controls beam, sheer and the smooth cross-section.
  const stations = [
    [-22.0, 0.025, 3.22], [-20.0, 0.17, 2.93], [-17.2, 0.36, 2.62], [-13.0, 0.60, 2.36],
    [-8.0, 0.81, 2.18], [0.0, 0.97, 2.10], [8.0, 1.0, 2.12], [14.0, 0.96, 2.19],
    [18.0, 0.88, 2.30], [21.0, 0.76, 2.45], [22.0, 0.68, 2.52]
  ];
  const maxHalfBeam = 5.15;
  const sectionDesign = [
    [-0.88, 0.0], [-0.98, -0.34], [-1.0, -1.02], [-0.94, -2.08], [-0.76, -3.02], [-0.38, -3.54], [0.0, -3.65],
    [0.38, -3.54], [0.76, -3.02], [0.94, -2.08], [1.0, -1.02], [0.98, -0.34], [0.88, 0.0]
  ];
  const section = [];
  const sectionSteps = 5;
  for (let i = 0; i < sectionDesign.length - 1; i++) {
    const p0 = sectionDesign[Math.max(0, i - 1)], p1 = sectionDesign[i];
    const p2 = sectionDesign[i + 1], p3 = sectionDesign[Math.min(sectionDesign.length - 1, i + 2)];
    for (let k = 0; k < sectionSteps; k++) {
      const t = k / sectionSteps;
      section.push([
        catmullValue(p0[0], p1[0], p2[0], p3[0], t),
        catmullValue(p0[1], p1[1], p2[1], p3[1], t)
      ]);
    }
  }
  section.push([...sectionDesign[sectionDesign.length - 1]]);
  // Sample the design stations with a Catmull-Rom loft. The dense mesh removes visible
  // straight segments along the sheer line while retaining the hand-authored hull proportions.
  function catmullValue(p0, p1, p2, p3, t) {
    const t2 = t * t, t3 = t2 * t;
    return 0.5 * ((2 * p1) + (-p0 + p2) * t + (2*p0 - 5*p1 + 4*p2 - p3) * t2 + (-p0 + 3*p1 - 3*p2 + p3) * t3);
  }
  function sampleStation(z) {
    if (z <= stations[0][0]) return { beamFactor: stations[0][1], top: stations[0][2] };
    if (z >= stations[stations.length - 1][0]) return { beamFactor: stations[stations.length - 1][1], top: stations[stations.length - 1][2] };
    let i = 0;
    while (i < stations.length - 2 && z > stations[i + 1][0]) i++;
    const s1 = stations[i], s2 = stations[i + 1];
    const s0 = stations[Math.max(0, i - 1)], s3 = stations[Math.min(stations.length - 1, i + 2)];
    const t = (z - s1[0]) / (s2[0] - s1[0]);
    return {
      beamFactor: THREE.MathUtils.clamp(catmullValue(s0[1], s1[1], s2[1], s3[1], t), 0.02, 1.0),
      top: catmullValue(s0[2], s1[2], s2[2], s3[2], t)
    };
  }
  const denseStations = [];
  const stationsPerSpan = 18;
  for (let i = 0; i < stations.length - 1; i++) {
    const start = stations[i], end = stations[i + 1];
    for (let j = 0; j < stationsPerSpan; j++) {
      const z = THREE.MathUtils.lerp(start[0], end[0], j / stationsPerSpan);
      const smp = sampleStation(z);
      denseStations.push([z, smp.beamFactor, smp.top]);
    }
  }
  denseStations.push([...stations[stations.length - 1]]);
  
  const hullPositions = [];
  const hullUVs = [];
  for (let i = 0; i < denseStations.length; i++) {
    const [z, beamFactor, topY] = denseStations[i];
    for (let j = 0; j < section.length; j++) {
      const [xf, yOffset] = section[j];
      hullPositions.push(xf * maxHalfBeam * beamFactor, topY + yOffset, z);
      hullUVs.push(j / (section.length - 1), i / (denseStations.length - 1));
    }
  }
  const hullIndicesByMaterial = [[], [], []];
  const cols = section.length;
  for (let i = 0; i < denseStations.length - 1; i++) {
    for (let j = 0; j < cols - 1; j++) {
      const a = i * cols + j, b = (i + 1) * cols + j, c = i * cols + j + 1, d = (i + 1) * cols + j + 1;
      const avgY = (hullPositions[a*3+1] + hullPositions[b*3+1] + hullPositions[c*3+1] + hullPositions[d*3+1]) / 4;
      const group = avgY < -0.28 ? 0 : avgY < 0.33 ? 1 : 2;
      // Reverse winding so the outer hull normals face outwards on both port and starboard sides.
      hullIndicesByMaterial[group].push(a, c, b, b, c, d);
    }
  }
  const allIndices = []; const hullGeo = new THREE.BufferGeometry();
  hullGeo.setAttribute('position', new THREE.Float32BufferAttribute(hullPositions, 3));
  hullGeo.setAttribute('uv', new THREE.Float32BufferAttribute(hullUVs, 2));
  let indexOffset = 0;
  for (let g = 0; g < hullIndicesByMaterial.length; g++) {
    allIndices.push(...hullIndicesByMaterial[g]);
    hullGeo.addGroup(indexOffset, hullIndicesByMaterial[g].length, g);
    indexOffset += hullIndicesByMaterial[g].length;
  }
  hullGeo.setIndex(allIndices); hullGeo.computeVertexNormals(); hullGeo.computeBoundingSphere();
  const hull = addMesh(hullGeo, [mat.underside, mat.navy, mat.hull]); hull.name = 'Hull · 45m';
  // Close the bow and transom with clean end-cap surfaces; avoids open cross-sections from side views.
  function addHullEndCap(station, outwardSign) {
    const [z, beamFactor, topY] = station;
    const shape = new THREE.Shape();
    section.forEach(([xf, yOffset], index) => {
      const x = xf * maxHalfBeam * beamFactor;
      const y = topY + yOffset;
      if (index === 0) shape.moveTo(x, y); else shape.lineTo(x, y);
    });
    shape.closePath();
    const cap = addMesh(new THREE.ShapeGeometry(shape, 1), mat.hull, scene, [0, 0, z + outwardSign * .003], outwardSign < 0 ? [0, Math.PI, 0] : [0, 0, 0]);
    cap.name = outwardSign > 0 ? 'Transom cap' : 'Bow cap';
    cap.castShadow = true; cap.receiveShadow = true;
  }
  addHullEndCap(stations[0], -1);
  addHullEndCap(stations[stations.length - 1], 1);
  
  function interpolateStation(z) {
    const smp = sampleStation(z);
    return { beam: smp.beamFactor * maxHalfBeam, top: smp.top };
  }
  function deckY(z) { return interpolateStation(z).top + 0.09; }
  function beamAt(z, factor=0.88) { return interpolateStation(z).beam * factor; }
  // Solve the cross-section at a fixed world-space height so inlaid trims sit on the curved shell.
  function hullSideFactorAtY(topY, worldY) {
    const offset = worldY - topY;
    for (let j = Math.floor((section.length - 1) / 2); j < section.length - 1; j++) {
      const a = section[j], b = section[j + 1];
      if (offset >= a[1] && offset <= b[1]) {
        const span = (offset - a[1]) / Math.max(1e-5, b[1] - a[1]);
        return THREE.MathUtils.lerp(a[0], b[0], span);
      }
    }
    return offset < section[Math.floor((section.length - 1) / 2)][1] ? 0 : section[section.length - 1][0];
  }
  
  // Cambered upper deck closes the hull and creates a readable sheer line.
  const deckPositions = [], deckIndices = [];
  const deckRows = 9;
  for (const [z, beamFactor, topY] of denseStations) {
    for (let j=0;j<deckRows;j++) {
      const f = -1 + 2*j/(deckRows-1);
      const camber = (1-Math.abs(f))*0.12;
      deckPositions.push(f * maxHalfBeam * beamFactor * 0.88, topY + camber + 0.04, z);
    }
  }
  for (let i=0;i<denseStations.length-1;i++) for(let j=0;j<deckRows-1;j++) {
    const a=i*deckRows+j,b=(i+1)*deckRows+j,c=a+1,d=b+1;
    // Counter-clockwise from above: keep deck normals pointing out/up for the PBR lighting.
    deckIndices.push(a,b,c,b,d,c);
  }
  const deckGeo = new THREE.BufferGeometry(); deckGeo.setAttribute('position',new THREE.Float32BufferAttribute(deckPositions,3)); deckGeo.setIndex(deckIndices); deckGeo.computeVertexNormals();
  const deckMat = new THREE.MeshStandardMaterial({ color:0xd9ddd8, metalness:.012, roughness:.76, side:THREE.DoubleSide, map:gelcoatTexture, roughnessMap:microRoughness, bumpMap:microBump, bumpScale:.0012 });
  addMesh(deckGeo,deckMat).name='Cambered deck';
  
  // Boot stripe follows the actual station profile rather than a straight decal.
  for (const side of [-1,1]) {
    const trimPts = [];
    const sheerPts = [];
    for (const [z, factor, topY] of denseStations) {
      const beam = maxHalfBeam * factor;
      trimPts.push([side*beam*hullSideFactorAtY(topY,0.23)*1.004, 0.23, z]);
      sheerPts.push([side*beam*0.865, topY+0.10, z]);
    }
    tube(scene,trimPts,.022,mat.gold,220,8,false).name='Fine gold boot stripe';
    tube(scene,sheerPts,.028,mat.chrome,220,8,false).name='Satin deck edge brightwork';
  }
  
  // A very fine chine highlight helps the long hull read as a sculpted composite shell.
  for(const side of [-1,1]) {
    const chine=[];
    for(const [z, factor, topY] of denseStations) {
      const beam=maxHalfBeam*factor;
      const f=hullSideFactorAtY(topY,1.02);
      chine.push([side*beam*f*1.002,1.02,z]);
    }
    tube(scene,chine,.010,mat.whiteTrim,220,6,false).name='Subtle hull chine highlight';
  }
  
  // Stainless guard rails, with correctly spaced posts that taper with the hull.
  for (const side of [-1,1]) {
    const low=[], high=[];
    for(let z=-18.8; z<=18.2; z+=0.8) {
      const b=beamAt(z,0.875), y=deckY(z);
      low.push([side*b,y+0.56,z]); high.push([side*b,y+0.86,z]);
    }
    tube(scene,low,.026,mat.chrome,180,8,false);
    tube(scene,high,.028,mat.chrome,180,8,false);
    for(let z=-18.7; z<=18.0; z+=0.88) {
      const b=beamAt(z,0.875), y=deckY(z);
      cylinderBetween(scene,[side*b,y+0.02,z],[side*b,y+0.84,z],.018,mat.chrome,10);
      // compact deck-mounted stainless feet
      cylinderBetween(scene,[side*b,y-0.005,z],[side*b,y+0.09,z],.04,mat.chromeDark,10);
    }
  }
  
  // Hull-side windows, portholes, polished air intakes and fine service detailing.
  const portholeRing = new THREE.MeshStandardMaterial({ color:0x9c8158, metalness:.68, roughness:.36 });
  const portholeGlass = new THREE.MeshPhysicalMaterial({ color:0x04111d, metalness:.04, roughness:.22, clearcoat:.36, envMapIntensity:.42 });
  for (const side of [-1,1]) {
    for (let z=-11.4; z<=6.5; z+=3.25) {
      const st=interpolateStation(z); const y=0.63; const x=side*st.beam*hullSideFactorAtY(st.top,y)*1.006;
      const g=new THREE.Group(); g.position.set(x,y,z); scene.add(g);
      // Cylinders lie on the transverse axis, so their circular faces point out through the hull side.
      addMesh(cachedCylinderGeometry(.185,.185,.04,32),portholeRing,g,[0,0,0],[0,0,side*Math.PI/2]);
      addMesh(cachedCylinderGeometry(.145,.145,.06,32),portholeGlass,g,[0,0,0],[0,0,side*Math.PI/2]);
      // Torus is slightly proud of the glass, leaving a readable machined metal ring.
      addMesh(cachedTorusGeometry(.162,.018,8,32),mat.chrome,g,[side*.032,0,0],[0,side*Math.PI/2,0]);
    }
    // Air-intake slats aft, inset in charcoal surround.
    const zVent=8.1, stVent=interpolateStation(zVent), xVent=side*stVent.beam*hullSideFactorAtY(stVent.top,1.47)*1.012;
    roundedBox(scene,.075,.56,1.35,xVent,1.47,zVent,mat.chromeDark,.04,3);
    for(let k=0;k<7;k++) roundedBox(scene,.04,.035,1.14,xVent+side*.045,1.26+k*.067,zVent,mat.chrome,.012,2);
  }
  
  // Flush side boarding/service doors: layered gasket, painted panel and a small machined latch.
  for(const side of [-1,1]) {
    const doorZ=11.35, doorY=1.42, st=interpolateStation(doorZ);
    const shellX=st.beam*hullSideFactorAtY(st.top,doorY)*1.006;
    roundedBox(scene,.075,.86,2.02,side*shellX,doorY,doorZ,mat.rubber,.045,6);
    roundedBox(scene,.035,.78,1.93,side*(shellX+.038),doorY,doorZ,mat.hull,.038,6);
    roundedBox(scene,.018,.10,.24,side*(shellX+.061),doorY+.02,doorZ+.68,mat.chrome,.022,4);
    roundedBox(scene,.012,.025,.16,side*(shellX+.067),doorY+.02,doorZ+.68,mat.chromeDark,.008,3);
  }
  
  // Starboard rescue craft — professional offshore-response RIB, redesigned to match
  // the visual language of the supplied reference (deep orange hull, graphite collar,
  // high cockpit, multi-seat shock-mitigating interior, radar arch and marine hardware).
  const rescueMat = {
    hull: new THREE.MeshPhysicalMaterial({ color:0xc9341e, metalness:0.012, roughness:0.48, clearcoat:0.20, clearcoatRoughness:0.46, envMapIntensity:0.11, side:THREE.DoubleSide }),
    // Safety red-orange marine PVC collar: saturated pigment under a restrained
    // woven-albedo map; the separate black rub-rails stay graphite for contrast.
    tube: new THREE.MeshPhysicalMaterial({ color:0xf45a2b, metalness:0.0, roughness:0.68, clearcoat:0.095, clearcoatRoughness:0.62, envMapIntensity:0.095, side:THREE.DoubleSide }),
    tubeShade: new THREE.MeshStandardMaterial({ color:0x41474a, roughness:0.86, metalness:0.0 }),
    seam: new THREE.MeshStandardMaterial({ color:0x111719, roughness:0.91, metalness:0.0 }),
    tubeSeam: new THREE.MeshStandardMaterial({ color:0xb64029, roughness:0.86, metalness:0.0 }),
    deck: new THREE.MeshStandardMaterial({ color:0x333c40, roughness:0.91, metalness:0.012, bumpMap:microBump, bumpScale:0.0040 }),
    seat: new THREE.MeshPhysicalMaterial({ color:0x303a40, roughness:0.88, sheen:0.20, sheenColor:0x8a999d, bumpMap:microBump, bumpScale:0.0050 }),
    seatPanel: new THREE.MeshPhysicalMaterial({ color:0x465156, roughness:0.87, sheen:0.18, bumpMap:microBump, bumpScale:0.0040 }),
    rubber: new THREE.MeshStandardMaterial({ color:0x080d10, roughness:0.78, metalness:0.02 }),
    strap: new THREE.MeshStandardMaterial({ color:0x151c20, roughness:0.89, metalness:0.01 }),
    reflective: new THREE.MeshStandardMaterial({ color:0xd7dfdc, metalness:0.12, roughness:0.52, envMapIntensity:0.16 }),
    orange: new THREE.MeshPhysicalMaterial({ color:0xd93b20, metalness:0.005, roughness:0.52, clearcoat:0.12, clearcoatRoughness:0.54, envMapIntensity:0.075 }),
    console: new THREE.MeshPhysicalMaterial({ color:0x343e43, metalness:0.035, roughness:0.58, clearcoat:0.12, clearcoatRoughness:0.48, envMapIntensity:0.14 }),
    hardtop: new THREE.MeshPhysicalMaterial({ color:0x20272b, metalness:0.08, roughness:0.48, clearcoat:0.22, clearcoatRoughness:0.42, envMapIntensity:0.18 }),
    windscreen: new THREE.MeshPhysicalMaterial({ color:0x152b35, metalness:0.035, roughness:0.24, clearcoat:0.62, clearcoatRoughness:0.22, envMapIntensity:0.18, side:THREE.DoubleSide }),
    screen: new THREE.MeshPhysicalMaterial({ color:0x061217, metalness:0.04, roughness:0.22, clearcoat:0.30, clearcoatRoughness:0.22, envMapIntensity:0.10 }),
    seatBase: new THREE.MeshStandardMaterial({ color:0x151c20, metalness:0.07, roughness:0.62 }),
    engine: new THREE.MeshPhysicalMaterial({ color:0x10171b, metalness:0.12, roughness:0.42, clearcoat:0.28, clearcoatRoughness:0.34, envMapIntensity:0.18 }),
    engineTrim: new THREE.MeshStandardMaterial({ color:0x68747a, metalness:0.56, roughness:0.38, envMapIntensity:0.22 }),
    propeller: new THREE.MeshPhysicalMaterial({ color:0x4a555b, metalness:0.68, roughness:0.31, clearcoat:0.10, clearcoatRoughness:0.38, envMapIntensity:0.16 }),
    seamTape: new THREE.MeshStandardMaterial({ color:0x353d40, roughness:0.88, metalness:0.0 }),
    stitch: new THREE.MeshStandardMaterial({ color:0x768084, roughness:0.88, metalness:0.02 }),
    display: new THREE.MeshStandardMaterial({ color:0x126071, emissive:0x0c4857, emissiveIntensity:0.42, roughness:0.30, metalness:0.02 }),
    redLamp: new THREE.MeshStandardMaterial({ color:0xff3218, emissive:0xff210b, emissiveIntensity:0.65, roughness:0.32 }),
    blueLamp: new THREE.MeshStandardMaterial({ color:0x1989ff, emissive:0x076dff, emissiveIntensity:0.65, roughness:0.32 }),
    greenLamp: new THREE.MeshStandardMaterial({ color:0x36b67b, emissive:0x0a4a2b, emissiveIntensity:0.10, roughness:0.34 }),
    whiteLamp: new THREE.MeshStandardMaterial({ color:0xfff1d4, emissive:0xffdda0, emissiveIntensity:0.34, roughness:0.28 })
  };
  rescueMat.tube.map = makeRibFabricAlbedo();
  rescueMat.tube.bumpMap = makeRibWeaveBump(); rescueMat.tube.bumpScale = 0.0038;
  rescueMat.tube.roughnessMap = microRoughness;
  rescueMat.hull.map = gelcoatTexture.clone(); rescueMat.hull.map.repeat.set(1.4,2.5); rescueMat.hull.map.needsUpdate = true;
  rescueMat.hull.roughnessMap = microRoughness; rescueMat.hull.bumpMap = microBump; rescueMat.hull.bumpScale = 0.0021;
  rescueMat.orange.map = gelcoatTexture.clone(); rescueMat.orange.map.repeat.set(1.8,2.4); rescueMat.orange.map.needsUpdate = true;
  rescueMat.orange.roughnessMap = microRoughness; rescueMat.orange.bumpMap = microBump; rescueMat.orange.bumpScale = 0.0018;
  rescueMat.hardtop.map = fabricTexture.clone(); rescueMat.hardtop.map.repeat.set(2.3,2.3); rescueMat.hardtop.map.needsUpdate = true;
  rescueMat.hardtop.bumpMap = microBump; rescueMat.hardtop.bumpScale = 0.0016;
  rescueMat.console.bumpMap = microBump; rescueMat.console.bumpScale = 0.0017;
  rescueMat.rubber.bumpMap = microBump; rescueMat.rubber.bumpScale = 0.0024; rescueMat.rubber.roughnessMap = microRoughness;
  rescueMat.engine.roughnessMap = microRoughness; rescueMat.engine.bumpMap = microBump; rescueMat.engine.bumpScale = 0.0010;
  rescueMat.seat.map = fabricTexture.clone();
  rescueMat.seat.map.repeat.set(2.8, 2.8);
  rescueMat.seat.map.needsUpdate = true;
  rescueMat.seatPanel.map = fabricTexture.clone();
  rescueMat.seatPanel.map.repeat.set(2.2,2.2);
  rescueMat.seatPanel.needsUpdate = true;
  function makeRescueNonslipTexture() {
    const canvas=document.createElement('canvas'); canvas.width=512; canvas.height=512;
    const c=canvas.getContext('2d'); c.fillStyle='#3a4347'; c.fillRect(0,0,512,512);
    for(let y=0;y<512;y+=10) for(let x=0;x<512;x+=10) {
      const n=((x/10+y/10)%2===0);
      c.fillStyle=n?'rgba(4,9,12,.30)':'rgba(185,197,196,.10)';
      c.beginPath(); c.moveTo(x+2,y+1); c.lineTo(x+7,y+2); c.lineTo(x+9,y+5); c.lineTo(x+6,y+8); c.lineTo(x+2,y+7); c.closePath(); c.fill();
    }
    for(let i=0;i<10000;i++) { const a=.018+random()*.04; c.fillStyle=random()>.5?`rgba(10,17,19,${a})`:`rgba(244,247,240,${a*.6})`; c.fillRect(random()*512,random()*512,.4+random()*1.1,.4+random()*1.1); }
    const tex=new THREE.CanvasTexture(canvas); tex.colorSpace=THREE.SRGBColorSpace; tex.wrapS=tex.wrapT=THREE.RepeatWrapping; tex.repeat.set(2.8,6.5); tex.anisotropy=Math.min(renderer.capabilities.getMaxAnisotropy(),8); tex.needsUpdate=true; return tex;
  }
  rescueMat.deck.map=makeRescueNonslipTexture(); rescueMat.deck.needsUpdate=true;
  // Separate, low-contrast woven PVC fabric for the rescue collar. Cross-fibres are
  // deliberately subtle: they should catch grazing light, not look like a tiled bitmap.
  // The pale warm albedo lets the dedicated material tint render safety red-orange.
  function makeRibFabricAlbedo() {
    const canvas=document.createElement('canvas'); canvas.width=512; canvas.height=512;
    const c=canvas.getContext('2d'); c.fillStyle='#eee4dc'; c.fillRect(0,0,512,512);
    for(let y=0;y<512;y+=4) {
      c.strokeStyle=(Math.floor(y/4)%2===0)?'rgba(38,45,47,.075)':'rgba(255,255,255,.075)';
      c.lineWidth=1; c.beginPath(); c.moveTo(0,y); c.lineTo(512,y+1.5); c.stroke();
    }
    for(let x=0;x<512;x+=4) {
      c.strokeStyle=(Math.floor(x/4)%2===0)?'rgba(255,255,255,.045)':'rgba(25,32,34,.045)';
      c.lineWidth=1; c.beginPath(); c.moveTo(x,0); c.lineTo(x+1.2,512); c.stroke();
    }
    for(let i=0;i<6200;i++) {
      const a=.008+random()*.025;
      c.fillStyle=random()>.53?`rgba(255,255,255,${a})`:`rgba(12,18,20,${a})`;
      c.fillRect(random()*512,random()*512,.45+random()*1.1,.45+random()*1.3);
    }
    const tex=new THREE.CanvasTexture(canvas); tex.colorSpace=THREE.SRGBColorSpace;
    tex.wrapS=tex.wrapT=THREE.RepeatWrapping; tex.repeat.set(6,4);
    tex.anisotropy=Math.min(renderer.capabilities.getMaxAnisotropy(),8); tex.needsUpdate=true; return tex;
  }
  function makeRibWeaveBump() {
    const canvas=document.createElement('canvas'); canvas.width=512; canvas.height=512;
    const c=canvas.getContext('2d'); c.fillStyle='#808080'; c.fillRect(0,0,512,512);
    for(let y=0;y<512;y+=4) {
      c.fillStyle=(Math.floor(y/4)%2===0)?'#737373':'#888888'; c.fillRect(0,y,512,1.2);
    }
    for(let x=0;x<512;x+=4) {
      c.fillStyle=(Math.floor(x/4)%2===0)?'#898989':'#777777'; c.fillRect(x,0,1.2,512);
    }
    const tex=new THREE.CanvasTexture(canvas); tex.wrapS=tex.wrapT=THREE.RepeatWrapping;
    tex.repeat.set(6,4); tex.anisotropy=Math.min(renderer.capabilities.getMaxAnisotropy(),8); tex.needsUpdate=true; return tex;
  }
  
  // The RIB is a separate, full-scale object afloat alongside the yacht—not on a cradle.
  // Dimensions with scale applied: approx. 7.7 m overall inflatable hull length x 3.45 m beam; outboard extends the full length to about 8.1 m.
  const lifeboat = new THREE.Group();
  lifeboat.position.set(6.98, -0.63, 8.70);
  lifeboat.scale.setScalar(1.55);
  lifeboat.name = 'Professional offshore rescue RIB · afloat · approx. 7 m';
  scene.add(lifeboat);
  
  // Deep-V rigid hull, with a fuller bow entry and more substantial lower shell.
  const rbStations = [
    [-2.57,0.035,0.37],[-2.28,0.22,0.405],[-1.84,0.46,0.425],[-1.23,0.66,0.42],
    [-0.46,0.79,0.405],[0.42,0.81,0.39],[1.18,0.76,0.38],[1.78,0.63,0.36],[2.16,0.42,0.345]
  ];
  const rbSection = [[-0.66,0.045],[-0.88,0.0],[-1.0,-0.12],[-0.82,-0.29],[-0.44,-0.425],[0,-0.475],[0.44,-0.425],[0.82,-0.29],[1.0,-0.12],[0.88,0.0],[0.66,0.045]];
  const rbPositions=[], rbIndices=[];
  const rbLongSteps=96;
  function rescueStationAt(z) {
    let i=0;
    while(i<rbStations.length-2 && z>rbStations[i+1][0]) i++;
    const a=rbStations[i], b=rbStations[i+1], p0=rbStations[Math.max(0,i-1)], p3=rbStations[Math.min(rbStations.length-1,i+2)];
    const t=THREE.MathUtils.clamp((z-a[0])/(b[0]-a[0]),0,1);
    return { beam:Math.max(0.018,catmullValue(p0[1],a[1],b[1],p3[1],t)), top:catmullValue(p0[2],a[2],b[2],p3[2],t) };
  }
  for(let i=0;i<=rbLongSteps;i++) {
    const z=THREE.MathUtils.lerp(rbStations[0][0],rbStations[rbStations.length-1][0],i/rbLongSteps);
    const st=rescueStationAt(z);
    for(const [xf,yf] of rbSection) rbPositions.push(xf*st.beam,st.top+yf,z);
  }
  const rbCols=rbSection.length;
  for(let i=0;i<rbLongSteps;i++) for(let j=0;j<rbCols-1;j++) {
    const a=i*rbCols+j,b=(i+1)*rbCols+j,c=a+1,d=b+1;
    rbIndices.push(a,c,b,b,c,d);
  }
  const rbGeometry=new THREE.BufferGeometry();
  rbGeometry.setAttribute('position',new THREE.Float32BufferAttribute(rbPositions,3));
  rbGeometry.setIndex(rbIndices); rbGeometry.computeVertexNormals(); rbGeometry.computeBoundingSphere();
  const rbHull=addMesh(rbGeometry,rescueMat.hull,lifeboat); rbHull.name='Deep-V orange rescue hull with moulded chines';
  
  // Inner sole and raised side stringers. The floor now sits clearly above the waterline.
  roundedBox(lifeboat,1.18,.055,4.05,0,.50,-.12,rescueMat.deck,.07,6).name='Textured non-slip cockpit sole';
  for(const side of [-1,1]) {
    roundedBox(lifeboat,.095,.11,3.72,side*.55,.48,-.10,rescueMat.rubber,.035,5);
    // Orange cockpit side coamings merge the deck with the coloured hull.
    roundedBox(lifeboat,.075,.19,2.68,side*.575,.57,-.10,rescueMat.orange,.025,4);
  }
  // Flush foredeck locker with latch, seams and anti-slip inset.
  roundedBox(lifeboat,.52,.035,.55,0,.548,-1.58,rescueMat.console,.045,6);
  roundedBox(lifeboat,.40,.012,.39,0,.568,-1.58,rescueMat.deck,.028,4);
  roundedBox(lifeboat,.07,.016,.035,0,.579,-1.82,rescueMat.engineTrim,.008,3);
  
  // Safety red-orange inflatable collar: welded chambers, visible warm-dark seam rings and separate graphite rub-rails.
  const collarPath = [
    [0,.62,-2.72],[-.30,.62,-2.57],[-.58,.62,-2.28],[-.78,.62,-1.88],[-.88,.62,-1.40],[-.90,.62,-.72],
    [-.90,.62,.18],[-.86,.62,.98],[-.74,.62,1.60],[-.55,.62,2.02],[-.28,.62,2.20],[0,.62,2.22],
    [.28,.62,2.20],[.55,.62,2.02],[.74,.62,1.60],[.86,.62,.98],[.90,.62,.18],[.90,.62,-.72],
    [.88,.62,-1.40],[.78,.62,-1.88],[.58,.62,-2.28],[.30,.62,-2.57]
  ];
  tube(lifeboat,collarPath,.215,rescueMat.tube,220,18,true).name='Safety red-orange woven PVC inflatable multi-chamber collar';
  // Thick moulded black rubbing strake following both outboard shoulders.
  for(const side of [-1,1]) {
    const lowerRail=[[side*.57,.49,-2.12],[side*.79,.49,-1.76],[side*.91,.49,-1.28],[side*.945,.49,-.62],[side*.945,.49,.22],[side*.90,.49,.98],[side*.78,.49,1.55],[side*.55,.49,1.92],[side*.28,.49,2.08]];
    tube(lifeboat,lowerRail,.067,rescueMat.rubber,144,12,false).name='Heavy black side impact rub strake';
    const upperRail=lowerRail.map(([x,y,z])=>[x*1.005,.715,z]);
    tube(lifeboat,upperRail,.022,rescueMat.tubeShade,144,8,false).name='Raised upper collar rub line';
  }
  // Protective black bow nose and reinforced towing patch.
  tube(lifeboat,[[-.48,.54,-2.36],[-.34,.48,-2.60],[0,.465,-2.70],[.34,.48,-2.60],[.48,.54,-2.36]],.095,rescueMat.rubber,64,12,false).name='Reinforced black bow impact cap';
  const collarSeamStations=[[-1.78,.82],[-1.22,.89],[-.58,.90],[.12,.90],[.80,.88],[1.38,.80],[1.78,.66]];
  for(const side of [-1,1]) for(const [z,cxAbs] of collarSeamStations) {
    const seam=addMesh(cachedTorusGeometry(.205,.007,8,32),rescueMat.tubeSeam,lifeboat,[side*cxAbs,.62,z],[0,side*Math.PI/2,0]);
    seam.name='Welded inflatable chamber seam';
  }
  // Discrete reflective safety patches, never text decals.
  for(const side of [-1,1]) for(const z of [-1.30,-.18,.98]) {
    const patch=roundedBox(lifeboat,.025,.048,.16,side*.985,.655,z,rescueMat.reflective,.009,4);
    patch.name='Reflective marine safety patch';
  }
  // Perimeter grab line on individual rubber reinforced loops.
  for(const side of [-1,1]) {
    const grabPath=[ [side*.77,.735,-1.90],[side*.91,.75,-1.35],[side*.955,.75,-.62],[side*.96,.75,.28],[side*.91,.74,1.10],[side*.73,.72,1.72] ];
    tube(lifeboat,grabPath,.013,rescueMat.strap,96,6,false).name='Continuous perimeter grab line';
    for(const [x,z] of [[.82,-1.55],[.94,-.86],[.96,-.12],[.94,.62],[.82,1.32]]) {
      tube(lifeboat,[[side*x,.57,z],[side*x*1.05,.68,z],[side*x,.745,z]],.018,rescueMat.rubber,14,7,false);
    }
  }
  // Inflation valves and inset valve caps on the outboard faces of the separate chambers.
  for(const side of [-1,1]) for(const [z,cx] of [[-1.48,.88],[-.70,.91],[.18,.91],[1.02,.85]]) {
    addMesh(cachedCylinderGeometry(.040,.040,.025,24),rescueMat.rubber,lifeboat,[side*cx,.62,z],[0,0,side*Math.PI/2]).name='Inflatable chamber valve';
    addMesh(cachedTorusGeometry(.029,.005,6,20),rescueMat.engineTrim,lifeboat,[side*(cx+.014),.62,z],[0,side*Math.PI/2,0]);
  }
  // Stainless tow eye, recessed tie-downs and cleats at the bow.
  const bowEye=addMesh(cachedTorusGeometry(.072,.014,10,32),mat.chrome,lifeboat,[0,.32,-2.68],[Math.PI/2,0,0]);
  bowEye.name='Stainless bow towing eye';
  for(const side of [-1,1]) {
    roundedBox(lifeboat,.15,.045,.085,side*.55,.46,-2.07,mat.chromeDark,.018,4);
    for(const dx of [-.045,.045]) sphere(lifeboat,side*.55+dx,.485,-2.07,.012,.012,.012,mat.chrome,10,7);
  }
  
  // Tubular bow guard: impact protection, towing clearance and realistic deck hardware.
  tube(lifeboat,[[-.54,.72,-2.18],[-.61,.79,-2.38],[-.43,.84,-2.58],[0,.855,-2.66],[.43,.84,-2.58],[.61,.79,-2.38],[.54,.72,-2.18]],.031,rescueMat.hardtop,90,10,false).name='Stainless reinforced bow guard';
  for(const side of [-1,1]) {
    cylinderBetween(lifeboat,[side*.49,.57,-2.22],[side*.54,.73,-2.18],.026,rescueMat.hardtop,10);
    cylinderBetween(lifeboat,[side*.48,.57,-2.40],[side*.61,.79,-2.38],.026,rescueMat.hardtop,10);
  }
  // Deck-side rescue ring with webbing and a compact stainless stowage bracket.
  const rescueRing=addMesh(cachedTorusGeometry(.18,.043,12,40),rescueMat.orange,lifeboat,[-.755,1.34,.56],[0,Math.PI/2,0]);
  rescueRing.name='Orange personal rescue lifebuoy';
  tube(lifeboat,[[-.785,1.20,.56],[-.785,1.34,.56],[-.785,1.48,.56]],.012,rescueMat.reflective,24,6,false);
  tube(lifeboat,[[-.755,1.34,.38],[-.755,1.34,.74]],.010,rescueMat.reflective,24,6,false);
  tube(lifeboat,[[-.71,1.34,.41],[-.68,1.43,.45],[-.68,1.43,.67],[-.71,1.34,.71]],.012,mat.chromeDark,32,6,false);
  
  // Helm pedestal, angled instrument fascia, a three-pane tinted windscreen and black seals.
  roundedBox(lifeboat,.80,.54,.52,0,.80,-.39,rescueMat.console,.085,8).name='Moulded helm console';
  roundedBox(lifeboat,.60,.16,.042,0,.995,-.668,rescueMat.screen,.022,6).name='Main marine display bezel';
  roundedBox(lifeboat,.515,.105,.012,0,1.005,-.694,rescueMat.display,.012,5).name='Illuminated marine multifunction display';
  for(const x of [-.27,-.18,.18,.27]) sphere(lifeboat,x,.845,-.667,.021,.021,.012,rescueMat.engineTrim,12,8);
  for(const x of [-.30,.30]) {
    cylinderBetween(lifeboat,[x,.91,-.64],[x,.99,-.64],.012,mat.chromeDark,10);
    sphere(lifeboat,x,1.025,-.64,.024,.015,.014,rescueMat.orange,12,8);
  }
  function rescueQuad(points, material, name) {
    const g=new THREE.BufferGeometry();
    g.setAttribute('position',new THREE.Float32BufferAttribute(points.flat(),3));
    g.setIndex([0,1,2,0,2,3]); g.computeVertexNormals();
    const m=addMesh(g,material,lifeboat); m.name=name; return m;
  }
  const glassSections=[[-.54,-.20],[-.19,.18],[.18,.54]];
  for(let i=0;i<glassSections.length;i++) {
    const [x0,x1]=glassSections[i];
    const pane=rescueQuad([[x0,1.08,-.67],[x1,1.08,-.67],[x1-.055,1.48,-.30],[x0+.055,1.48,-.30]],rescueMat.windscreen,`Tinted laminated windshield pane ${i+1}`);
    pane.renderOrder=2;
  }
  // Thick black windshield seals and satin frame rails follow the sloped glass.
  tube(lifeboat,[[-.56,1.065,-.68],[.56,1.065,-.68]],.025,rescueMat.rubber,32,8,false);
  tube(lifeboat,[[-.60,1.075,-.67],[-.44,1.30,-.46],[-.49,1.49,-.30],[.49,1.49,-.30],[.44,1.30,-.46],[.60,1.075,-.67]],.026,rescueMat.hardtop,96,8,false);
  for(const x of [-.19,.18]) tube(lifeboat,[[x,1.08,-.69],[x*.82,1.48,-.31]],.012,rescueMat.tubeShade,18,6,false);
  // Two compact marine wipers, mounted on the glass plane with rubber blades.
  for(const side of [-1,1]) {
    const pivot=[side*.255,1.105,-.644], elbow=[side*.215,1.17,-.582], tip=[side*.075,1.205,-.548];
    sphere(lifeboat,pivot[0],pivot[1],pivot[2],.017,.014,.012,rescueMat.engineTrim,10,7);
    tube(lifeboat,[pivot,elbow],.0065,mat.chromeDark,12,5,false);
    tube(lifeboat,[elbow,tip],.008,rescueMat.rubber,16,5,false);
    cylinderBetween(lifeboat,[pivot[0],pivot[1]-.012,pivot[2]+.01],[pivot[0],pivot[1]+.012,pivot[2]+.01],.010,mat.chromeDark,8);
  }
  // Flush instrument keys, guarded throttle gate and two recessed cup holders.
  roundedBox(lifeboat,.16,.018,.11,.29,1.105,-.285,rescueMat.seatBase,.018,4);
  for(let i=0;i<4;i++) {
    roundedBox(lifeboat,.022,.012,.025,.235+i*.035,1.119,-.292,(i===0?rescueMat.redLamp:rescueMat.engineTrim),.006,3);
  }
  for(const x of [-.30,.30]) {
    addMesh(cachedTorusGeometry(.046,.006,6,22),mat.chromeDark,lifeboat,[x,1.102,-.18],[Math.PI/2,0,0]);
    addMesh(cachedCylinderGeometry(.038,.038,.012,20),rescueMat.rubber,lifeboat,[x,1.098,-.18]);
  }
  // Real steering wheel, binnacle, throttle lever, and protected grab rails.
  roundedBox(lifeboat,.60,.12,.28,0,1.095,-.10,rescueMat.console,.035,5);
  const wheel=addMesh(cachedTorusGeometry(.135,.014,10,40),mat.chrome,lifeboat,[0,1.17,-.015],[-.17,0,0]);
  wheel.name='Stainless helm steering wheel';
  for(const [a,b] of [[[-.10,1.17,-.015],[.10,1.17,-.015]],[[0,1.07,-.015],[0,1.27,-.015]]]) cylinderBetween(lifeboat,a,b,.008,mat.chromeDark,8);
  cylinderBetween(lifeboat,[.30,.93,-.10],[.38,1.10,-.03],.022,mat.chromeDark,10);
  sphere(lifeboat,.385,1.105,-.02,.045,.035,.045,rescueMat.rubber,14,10);
  for(const side of [-1,1]) tube(lifeboat,[[side*.42,.66,-.25],[side*.46,.83,.03],[side*.43,.86,.34]],.022,mat.chromeDark,30,8,false);
  
  // Four individual shock-mitigating bucket seats with moulded bolsters and stitched upholstery.
  function makeRibSeat(x,z,index) {
    roundedBox(lifeboat,.39,.10,.39,x,.555,z,rescueMat.seatBase,.055,6).name=`Seat ${index} suspension base`;
    const cushion=roundedBox(lifeboat,.365,.105,.35,x,.625,z+.035,rescueMat.seat,.06,7); cushion.name=`Seat ${index} textured cushion`;
    const back=roundedBox(lifeboat,.365,.40,.125,x,.855,z+.165,rescueMat.seatPanel,.062,8); back.rotation.x=-.13; back.name=`Seat ${index} wraparound backrest`;
    for(const sx of [-1,1]) {
      const bolster=roundedBox(lifeboat,.075,.30,.19,x+sx*.15,.78,z+.19,rescueMat.seat,.035,6); bolster.rotation.x=-.10;
      tube(lifeboat,[[x+sx*.155,.71,z-.12],[x+sx*.155,.72,z+.02],[x+sx*.155,.91,z+.12],[x+sx*.155,.98,z+.20]],.006,rescueMat.reflective,24,5,false);
      tube(lifeboat,[[x+sx*.11,.955,z+.18],[x+sx*.11,.84,z+.25]],.007,rescueMat.strap,12,5,false);
    }
    // Double top-stitching around the cushion and vertical panel seams in the backrest.
    tube(lifeboat,[[x-.145,.684,z-.105],[x-.155,.684,z-.02],[x-.145,.684,z+.145],[x+.145,.684,z+.145],[x+.155,.684,z-.02],[x+.145,.684,z-.105]],.0032,rescueMat.stitch,36,4,true).name=`Seat ${index} fine cushion piping`;
    tube(lifeboat,[[x-.12,.745,z+.099],[x-.12,.91,z+.105],[x-.08,.95,z+.105]],.0032,rescueMat.stitch,18,4,false);
    tube(lifeboat,[[x+.12,.745,z+.099],[x+.12,.91,z+.105],[x+.08,.95,z+.105]],.0032,rescueMat.stitch,18,4,false);
    tube(lifeboat,[[x-.105,.94,z+.102],[x,.925,z+.102],[x+.105,.94,z+.102]],.0032,rescueMat.seam,18,4,false);
    // Low-profile twin harness straps and a machined central latch.
    for(const sx of [-1,1]) tube(lifeboat,[[x+sx*.105,.968,z+.092],[x+sx*.078,.86,z+.073],[x+sx*.035,.785,z+.045]],.009,rescueMat.strap,18,5,false);
    roundedBox(lifeboat,.055,.043,.014,x,.785,z+.052,rescueMat.engineTrim,.009,4);
    roundedBox(lifeboat,.024,.018,.008,x,.785,z+.063,rescueMat.rubber,.004,3);
    // Paired stainless pedestal legs and dark suspension collars.
    for(const sx of [-1,1]) {
      cylinderBetween(lifeboat,[x+sx*.12,.50,z],[x+sx*.12,.55,z],.018,mat.chromeDark,10);
      roundedBox(lifeboat,.045,.025,.045,x+sx*.12,.515,z,rescueMat.engineTrim,.01,3);
    }
  }
  makeRibSeat(-.30,.38,1); makeRibSeat(.30,.38,2);
  makeRibSeat(-.30,1.02,3); makeRibSeat(.30,1.02,4);
  // Inboard foot rails and passenger grab handles.
  for(const side of [-1,1]) {
    tube(lifeboat,[[side*.47,.51,.20],[side*.49,.53,.62],[side*.48,.51,1.12]],.018,mat.chromeDark,32,7,false);
    for(const z of [.28,.72,1.14]) roundedBox(lifeboat,.09,.035,.11,side*.47,.50,z,rescueMat.rubber,.015,4);
  }
  
  // Heavy black radar/overhead safety arch, roof, navigation antennas and response lightbar.
  for(const side of [-1,1]) {
    tube(lifeboat,[[side*.58,.95,-.18],[side*.66,1.25,.02],[side*.72,1.67,.20],[side*.70,1.83,.35],[side*.68,1.83,.78],[side*.63,1.58,1.02],[side*.57,1.04,1.02]],.036,rescueMat.hardtop,92,10,false).name='Structural overhead radar arch';
    cylinderBetween(lifeboat,[side*.60,.90,-.18],[side*.58,.99,-.18],.055,rescueMat.hardtop,16);
    cylinderBetween(lifeboat,[side*.58,.96,1.02],[side*.57,1.05,1.02],.055,rescueMat.hardtop,16);
  }
  for(const z of [-.08,.34,.76]) tube(lifeboat,[[-.68,1.80,z],[0,1.82,z],[.68,1.80,z]],.022,rescueMat.hardtop,36,8,false);
  roundedBox(lifeboat,1.55,.085,1.35,0,1.84,.34,rescueMat.hardtop,.08,8).name='Matte marine hardtop';
  // Roof edge seals and anti-slip patches.
  for(const side of [-1,1]) tube(lifeboat,[[side*.70,1.79,-.30],[side*.77,1.79,.12],[side*.77,1.79,.62],[side*.69,1.79,.98]],.014,rescueMat.rubber,40,6,false);
  for(const x of [-.48,.48]) {
    roundedBox(lifeboat,.20,.035,.16,x,1.895,-.16,rescueMat.rubber,.025,4);
    roundedBox(lifeboat,.135,.025,.105,x,1.92,-.16,rescueMat.whiteLamp,.02,5);
  }
  // Blue/red emergency beacons are small, physically integrated fittings rather than bloom blobs.
  roundedBox(lifeboat,.48,.045,.11,0,1.905,-.30,rescueMat.rubber,.018,4);
  sphere(lifeboat,-.13,1.944,-.30,.085,.042,.047,rescueMat.blueLamp,18,10);
  sphere(lifeboat,.13,1.944,-.30,.085,.042,.047,rescueMat.redLamp,18,10);
  // Low-profile radar radome, rotary base and two whip antennas.
  cylinderBetween(lifeboat,[0,1.90,.39],[0,1.96,.39],.125,rescueMat.engine,28);
  sphere(lifeboat,0,2.015,.39,.235,.068,.205,rescueMat.reflective,28,18);
  for(const x of [-.54,.54]) {
    cylinderBetween(lifeboat,[x,1.88,.68],[x*1.05,2.46,.71],.009,mat.chromeDark,8);
    sphere(lifeboat,x*1.05,2.45,.71,.018,.022,.018,rescueMat.rubber,10,7);
  }
  cylinderBetween(lifeboat,[0,1.88,.84],[0,2.24,.88],.008,mat.chromeDark,8);
  // Compact deck spotlights, cleats, tie-down eyes and hull-side moulded strakes.
  for(const side of [-1,1]) {
    const hullStripe=[[side*.45,.20,-1.95],[side*.62,.17,-1.40],[side*.72,.14,-.65],[side*.75,.13,.20],[side*.70,.15,1.15],[side*.52,.19,1.80]];
    tube(lifeboat,hullStripe,.021,rescueMat.rubber,112,7,false).name='Hull chine protective stripe';
    roundedBox(lifeboat,.14,.05,.09,side*.57,.48,-1.95,mat.chromeDark,.018,4);
    roundedBox(lifeboat,.18,.055,.10,side*.60,.48,1.70,mat.chromeDark,.018,4);
    cylinderBetween(lifeboat,[side*.57,.49,1.70],[side*.57,.53,1.70],.013,mat.chrome,8);
  }
  // Aft transom and outboard engine with distinct cowling, vents, steering shaft and propeller.
  roundedBox(lifeboat,1.10,.34,.15,0,.43,2.13,rescueMat.hull,.035,6).name='Reinforced orange transom';
  roundedBox(lifeboat,.56,.105,.18,0,.50,2.22,rescueMat.rubber,.035,6).name='Outboard transom clamp';
  sphere(lifeboat,0,.81,2.25,.255,.245,.275,rescueMat.engine,32,22).name='Sculpted dark outboard cowling';
  sphere(lifeboat,0,.91,2.32,.215,.15,.21,rescueMat.engine,28,18);
  roundedBox(lifeboat,.27,.038,.025,0,.92,2.49,rescueMat.engineTrim,.012,4);
  for(const side of [-1,1]) for(let j=0;j<4;j++) roundedBox(lifeboat,.012,.085,.012,side*.248,.77,2.18+j*.035,rescueMat.rubber,.004,3);
  cylinderBetween(lifeboat,[0,.61,2.30],[0,.15,2.42],.055,rescueMat.engineTrim,16);
  sphere(lifeboat,0,.14,2.43,.11,.075,.11,rescueMat.engine,20,14);
  const propGroup=new THREE.Group(); propGroup.position.set(0,.12,2.48); lifeboat.add(propGroup);
  sphere(propGroup,0,0,0,.073,.049,.060,rescueMat.propeller,20,12);
  const propBladeShape=new THREE.Shape();
  propBladeShape.moveTo(-.024,.028);
  propBladeShape.bezierCurveTo(-.052,.078,-.040,.160,-.010,.225);
  propBladeShape.bezierCurveTo(.012,.265,.070,.244,.082,.210);
  propBladeShape.bezierCurveTo(.071,.161,.046,.083,.025,.034);
  propBladeShape.bezierCurveTo(.012,.006,-.010,.006,-.024,.028);
  const propBladeGeo=new THREE.ExtrudeGeometry(propBladeShape,{depth:.032,bevelEnabled:true,bevelThickness:.006,bevelSize:.006,bevelSegments:2,steps:1,curveSegments:8});
  propBladeGeo.translate(0,0,-.016);
  for(let i=0;i<3;i++) {
    const blade=addMesh(propBladeGeo,rescueMat.propeller,propGroup);
    blade.rotation.z=i*Math.PI*2/3; blade.name=`Sculpted three-blade outboard propeller ${i+1}`;
  }
  // Final close-up pass: details that make this read as a working offshore craft.
  // Raised inspection hatch fasteners, gasket seam and flush deck tie-down eyes.
  tube(lifeboat,[[-.215,.577,-1.76],[.215,.577,-1.76],[.215,.577,-1.40],[-.215,.577,-1.40]],.0038,rescueMat.seam,28,4,true);
  for(const x of [-.205,.205]) for(const z of [-1.735,-1.425]) {
    addMesh(cachedCylinderGeometry(.010,.010,.008,10),mat.chromeDark,lifeboat,[x,.579,z]);
    addMesh(cachedCylinderGeometry(.003,.003,.009,6),rescueMat.engineTrim,lifeboat,[x,.585,z]);
  }
  for(const side of [-1,1]) {
    // Stainless stanchion foot plates and visible fasteners.
    for(const z of [-.18,.34,.78]) {
      roundedBox(lifeboat,.11,.025,.105,side*.60,.925,z,rescueMat.seatBase,.018,4);
      for(const dz of [-.032,.032]) addMesh(cachedCylinderGeometry(.008,.008,.008,8),mat.chrome,lifeboat,[side*.60,.940,z+dz]);
    }
    // Six flush anti-rub fixing heads follow the actual side shoulder.
    for(const [z,cx] of [[-1.60,.88],[-1.12,.93],[-.60,.95],[-.02,.95],[.58,.91],[1.18,.84]]) {
      addMesh(cachedCylinderGeometry(.010,.010,.012,10),mat.chromeDark,lifeboat,[side*(cx+.012),.49,z],[0,0,side*Math.PI/2]);
    }
    // Port and starboard navigation lamps in compact, gasketed housings.
    roundedBox(lifeboat,.13,.085,.14,side*.70,.69,-1.98,rescueMat.rubber,.028,5);
    sphere(lifeboat,side*.70,.713,-1.99,.043,.030,.047,side<0?rescueMat.redLamp:rescueMat.greenLamp,14,10);
    // Hull-side drain plugs with recessed metal lips near the transom.
    addMesh(cachedTorusGeometry(.031,.006,7,20),mat.chromeDark,lifeboat,[side*.46,.235,1.72],[0,side*Math.PI/2,0]);
    addMesh(cachedCylinderGeometry(.022,.022,.015,16),rescueMat.rubber,lifeboat,[side*.468,.235,1.72],[0,0,side*Math.PI/2]);
    for(const z of [1.51,1.60]) {
      roundedBox(lifeboat,.10,.025,.065,side*.56,.34,z,rescueMat.seatBase,.012,3);
    }
  }
  // Engine service seam, inset fasteners, trim tabs and a subtle sacrificial anode.
  tube(lifeboat,[[-.205,.885,2.30],[-.17,.98,2.34],[0,1.005,2.35],[.17,.98,2.34],[.205,.885,2.30]],.0045,rescueMat.engineTrim,32,5,false);
  for(const side of [-1,1]) {
    sphere(lifeboat,side*.184,.83,2.405,.010,.010,.008,mat.chromeDark,8,6);
    roundedBox(lifeboat,.20,.035,.16,side*.34,.20,2.15,rescueMat.engineTrim,.015,4);
  }
  // Subtle grip pads on the cockpit coamings: matte rubber, close to flush.
  for(const side of [-1,1]) for(const z of [-.82,-.32,.18,.68,1.18]) {
    roundedBox(lifeboat,.045,.012,.20,side*.558,.676,z,rescueMat.rubber,.008,3);
  }
  // Every visible part receives proper shadowing; no floating cradle remains.
  lifeboat.traverse(o=>{ if(o.isMesh){o.castShadow=true;o.receiveShadow=true;} });
  
  // Main salon: porcelain-white sculpted shell with deep panoramic glass and fine mullions.
  roundedBox(scene,7.72,1.78,15.15,0,3.12,-2.35,mat.hull,.28,6).name='Main salon shell';
  // Continuous dark window ribbons on both sides.
  for(const side of [-1,1]) {
    // Black EPDM seal, glass inset and fine stainless lip are layered instead of painted flat on the cabin.
    roundedBox(scene,.09,1.03,11.86,side*3.88,3.17,-2.65,mat.rubber,.035,5);
    roundedBox(scene,.046,.88,11.57,side*3.936,3.17,-2.65,mat.glass,.027,5);
    for(let z=-8.05;z<=2.9;z+=1.92) roundedBox(scene,.052,.96,.052,side*3.956,3.18,z,mat.chromeDark,.012,3);
    // Satin lower and upper glazing rails.
    roundedBox(scene,.065,.045,11.92,side*3.952,2.685,-2.65,mat.chrome,.018,3);
    roundedBox(scene,.055,.032,11.82,side*3.952,3.675,-2.65,mat.chromeDark,.012,3);
  }
  // Bow-facing glass panes, individually framed.
  for(let i=0;i<5;i++) {
    const x=-2.43+i*1.215;
    roundedBox(scene,1.20,1.03,.075,x,3.22,-9.955,mat.rubber,.04,5);
    const pane=roundedBox(scene,1.13,.96,.045,x,3.22,-9.997,mat.glass,.035,5);
    pane.rotation.x=-.045;
    if(i>0) roundedBox(scene,.034,1.01,.04,x-.59,3.22,-10.02,mat.chromeDark,.01,3);
  }
  roundedBox(scene,7.0,.13,14.3,0,4.05,-2.35,mat.whiteTrim,.05,4);
  // Fine, satin-finish reveal along the salon roof edge. It adds a crisp manufactured edge without a mirror-like highlight.
  for (const side of [-1,1]) {
    tube(scene,[[side*3.68,4.045,-9.15],[side*3.74,4.045,-6.0],[side*3.74,4.045,-2.6],[side*3.70,4.045,1.0],[side*3.58,4.045,4.25]],.021,mat.chromeDark,100,6,false);
  }
  
  // Upper lounge and wheelhouse, offset with sculpted, tiered silhouette.
  roundedBox(scene,6.66,1.28,10.0,0,4.72,-3.35,mat.hull,.25,6).name='Upper deck salon';
  for(const side of [-1,1]) {
    roundedBox(scene,.09,.77,7.55,side*3.35,4.73,-3.75,mat.rubber,.026,4);
    roundedBox(scene,.042,.64,7.32,side*3.405,4.73,-3.75,mat.glass,.02,4);
    for(let z=-7.1;z<=-.1;z+=1.82) roundedBox(scene,.05,.72,.045,side*3.43,4.73,z,mat.chromeDark,.01,3);
    roundedBox(scene,.055,.045,7.78,side*3.43,4.34,-3.75,mat.chrome,.016,3);
  }
  for(let i=0;i<4;i++) roundedBox(scene,1.20,.76,.05,-1.82+i*1.22,4.79,-8.365,mat.glass,.025,3);
  roundedBox(scene,5.93,1.08,5.65,0,5.88,-4.20,mat.white,.22,6).name='Wheelhouse';
  // Wraparound windscreen.
  for(let i=0;i<5;i++) {
    const x=-2.28+i*1.14;
    roundedBox(scene,1.10,.86,.075,x,5.96,-7.035,mat.rubber,.045,5);
    const panel=roundedBox(scene,1.02,.78,.042,x,5.96,-7.078,mat.glass,.04,5);
    panel.rotation.x=-.12;
    if(i<4) roundedBox(scene,.032,.82,.04,x+.53,5.97,-7.099,mat.chromeDark,.01,3);
  }
  // Slender handrails and anti-glare eyebrow on bridge.
  roundedBox(scene,6.1,.11,.35,0,6.48,-7.02,mat.whiteTrim,.05,4);
  roundedBox(scene,6.05,.17,5.84,0,6.56,-4.1,mat.white,.15,5);
  // Bridge roof edge and subtle anti-glare trim, kept dark enough to preserve silhouette under strong daylight.
  for (const side of [-1,1]) {
    tube(scene,[[side*2.92,6.55,-6.65],[side*3.00,6.55,-5.0],[side*3.00,6.55,-3.2],[side*2.88,6.55,-1.35]],.018,mat.chromeDark,56,6,false);
  }
  
  // Flybridge deck with ivory edge, teak finish and a thin gold reveal.
  roundedBox(scene,8.05,.26,10.2,0,6.77,-1.15,mat.white,.16,5).name='Flybridge deck';
  roundedBox(scene,7.72,.035,9.85,0,6.92,-1.15,teakMaterial,.04,3);
  for(const side of [-1,1]) {
    tube(scene,[[side*3.85,7.26,-6.05],[side*3.92,7.26,-3],[side*3.91,7.26,0],[side*3.7,7.26,3.6]],.025,mat.chrome,72,8,false);
    tube(scene,[[side*3.85,7.54,-6.05],[side*3.92,7.54,-3],[side*3.91,7.54,0],[side*3.7,7.54,3.6]],.028,mat.chrome,72,8,false);
    for(let z=-5.8;z<=3.5;z+=1.25) {
      const x=side*(z>2?3.8:3.91);
      cylinderBetween(scene,[x,6.93,z],[x,7.52,z],.021,mat.chrome,8);
    }
  }
  // Floating hardtop with dark glass underside and a subtle champagne perimeter.
  roundedBox(scene,7.58,.27,7.65,0,8.40,-4.25,mat.hull,.23,7).name='Floating hardtop';
  roundedBox(scene,7.28,.038,7.34,0,8.245,-4.25,mat.black,.13,5);
  // Narrow perimeter bead sharpens the floating roof edge at distance; satin metal, not a gold mirror strip.
  for (const side of [-1,1]) {
    tube(scene,[[side*3.58,8.535,-7.72],[side*3.68,8.535,-5.7],[side*3.70,8.535,-3.9],[side*3.62,8.535,-1.1],[side*3.52,8.535,-.78]],.018,mat.chromeDark,64,6,false);
  }
  // Two flush HVAC grilles with real recess depth and parallel machined slats break up the large top plane.
  for(const side of [-1,1]) {
    const gx=side*2.36, gz=-2.02;
    roundedBox(scene,.94,.018,.60,gx,8.544,gz,mat.whiteTrim,.07,6);
    roundedBox(scene,.855,.012,.515,gx,8.554,gz,mat.chromeDark,.055,6);
    for(let k=0;k<7;k++) roundedBox(scene,.76,.008,.018,gx,8.562,gz-.205+k*.068,mat.chrome,.006,3);
  }
  for(const x of [-3.22,3.22]) for(const z of [-7.12,-1.5]) {
    roundedBox(scene,.14,1.55,.14,x,7.54,z,mat.chrome,.055,4);
  }
  // Slim warm LED cove beneath the hardtop perimeter.
  const canopyLEDMat = new THREE.MeshStandardMaterial({ color:0xffdfa4, emissive:0xffb75c, emissiveIntensity:1.25, roughness:.3 });
  roundedBox(scene,6.55,.025,.035,0,8.24,-7.78,canopyLEDMat,.01,2);
  roundedBox(scene,6.55,.025,.035,0,8.24,-.72,canopyLEDMat,.01,2);
  
  // Procedural teak planking uses instancing for detail without hundreds of draw calls.
  function addTeakPanel(centerZ, length, width, count, material = teakMaterial, yOffset=.02, fixedSurfaceY=null) {
    // Continuous dark caulking bed underneath individually cut boards.
    const plankWidth = width/count;
    const longitudinalSegments = Math.max(1, Math.ceil(length/1.12));
    const segmentSpan = length/longitudinalSegments;
    const plankLength = Math.max(.12, segmentSpan-.010);
    const surfaceAt = (z,x) => {
      if(fixedSurfaceY!==null) return fixedSurfaceY;
      const st=interpolateStation(z);
      return st.top+.04+.12*(1-Math.min(1,Math.abs(x)/Math.max(.01,st.beam*.88)));
    };
    const nx=17, nz=Math.max(16,Math.ceil(length/.32));
    const backingPos=[], backingIdx=[];
    for(let iz=0;iz<=nz;iz++) {
      const z=centerZ-length/2+length*iz/nz;
      for(let ix=0;ix<=nx;ix++) {
        const x=-width/2+width*ix/nx;
        backingPos.push(x,surfaceAt(z,x)+.00025,z);
      }
    }
    for(let iz=0;iz<nz;iz++) for(let ix=0;ix<nx;ix++) {
      const a=iz*(nx+1)+ix,b=(iz+1)*(nx+1)+ix,c=a+1,d=b+1;
      backingIdx.push(a,b,c,b,d,c);
    }
    const backingGeo=new THREE.BufferGeometry();
    backingGeo.setAttribute('position',new THREE.Float32BufferAttribute(backingPos,3)); backingGeo.setIndex(backingIdx); backingGeo.computeVertexNormals();
    const backing=addMesh(backingGeo,teakCaulkMaterial); backing.name='Teak caulking substrate';
    const geom = cachedBoxGeometry(plankWidth*.955,.038,plankLength);
    const placements = [];
    const xStart = -width/2+plankWidth/2;
    for(let iz=0;iz<longitudinalSegments;iz++) {
      const z = centerZ-length/2+(iz+.5)*segmentSpan;
      const st = interpolateStation(z);
      const deckHalfWidth = fixedSurfaceY===null ? st.beam*.88 : width/2;
      for(let ix=0;ix<count;ix++) {
        const x=xStart+ix*plankWidth;
        if(Math.abs(x)+plankWidth*.48 > deckHalfWidth-.02) continue;
        const surfaceY = surfaceAt(z,x);
        placements.push({x,y:surfaceY+yOffset,z,tone:.965+random()*.065});
      }
    }
    const mesh = new THREE.InstancedMesh(geom,material,placements.length);
    const dummy = new THREE.Object3D();
    placements.forEach((p,i)=>{
      dummy.position.set(p.x,p.y,p.z); dummy.rotation.set(0,0,0); dummy.scale.set(1,1,1); dummy.updateMatrix(); mesh.setMatrixAt(i,dummy.matrix);
      if(material===teakMaterial) mesh.setColorAt(i,new THREE.Color(p.tone,p.tone*.98,p.tone*.92));
    });
    mesh.castShadow=true; mesh.receiveShadow=true; mesh.instanceMatrix.needsUpdate=true; mesh.computeBoundingSphere(); scene.add(mesh); return mesh;
  }
  addTeakPanel(13.55,8.0,6.7,42,teakMaterial,.02);
  addTeakPanel(-15.1,5.5,4.7,32,teakMaterial,.02);
  addTeakPanel(0.9,5.4,6.6,39,teakMaterial,.02,6.9375);
  
  // Fine teak seams along the main aft deck and the swim platform.
  for(const z of [9.3,17.8]) roundedBox(scene,6.65,.022,.035,0,deckY(z)+.12,z,teakEdgeMaterial,.008,2);
  // Flush service hatches and recessed deck fittings: deliberately low profile so they never look like floating props.
  const hatchRim = new THREE.MeshStandardMaterial({ color:0x66757b, metalness:0.42, roughness:0.48 });
  const hatchInset = new THREE.MeshStandardMaterial({ color:0xb5b6ad, metalness:0.10, roughness:0.62 });
  for (const [x,z,w,d] of [[-2.25,-11.2,.72,.92],[2.25,-11.2,.72,.92],[-2.35,7.9,.62,.72],[2.35,7.9,.62,.72]]) {
    const y = deckY(z) + .105;
    roundedBox(scene,w,.035,d,x,y,z,hatchRim,.055,4);
    roundedBox(scene,w-.065,.018,d-.065,x,y+.022,z,hatchInset,.04,4);
    roundedBox(scene,.12,.014,.026,x,y+.034,z,hatchRim,.008,2);
  }
  roundedBox(scene,6.15,.25,2.0,0,1.34,21.55,mat.white,.09,4).name='Hydraulic swim platform';
  addTeakPanel(21.5,1.6,5.9,34,teakMaterial,.02,1.465);
  
  // Foredeck sunpads, adjustable backrests and machined fittings.
  function makeSunbed(x,z,y,angle=0) {
    const g=new THREE.Group(); g.position.set(x,y,z); g.rotation.y=0; scene.add(g);
    roundedBox(g,.96,.17,2.48,0,.17,0,mat.whiteTrim,.08,4);
    roundedBox(g,.91,.20,2.38,0,.30,0,mat.cushion,.09,5);
    const back=roundedBox(g,.88,.13,1.05,0,.48,-.61,mat.cushion,.06,4);
    back.rotation.x=-.25;
    roundedBox(g,.93,.045,2.43,0,.08,0,mat.darkWood,.025,3);
    for(const sx of [-.34,.34]) cylinderBetween(g,[sx,.04,-.82],[sx,.20,-.82],.024,mat.chrome,8);
    return g;
  }
  makeSunbed(-1.62,-15.0,deckY(-15.0)-.015,.0);
  makeSunbed(0,-15.75,deckY(-15.75)-.015,0);
  makeSunbed(1.62,-15.0,deckY(-15.0)-.015,0);
  // Bow cleats, anchor pockets, anchor flukes and chain guides.
  for(const side of [-1,1]) {
    const z=-19.0, beam=beamAt(z,.7), x=side*beam;
    roundedBox(scene,.42,.13,.20,x,deckY(z)+.22,z,mat.chrome,.06,4);
    cylinderBetween(scene,[x,deckY(z)+.26,z-.08],[x,deckY(z)+.26,z+.08],.045,mat.chrome,12);
    roundedBox(scene,.65,.32,.12,side*1.3,deckY(-20)+.1,-20.0,mat.black,.04,4);
    cylinderBetween(scene,[side*1.3,deckY(-20)-.06,-20.05],[side*1.3,deckY(-20)-.32,-20.28],.075,mat.chromeDark,12);
    tube(scene,[[side*1.3,deckY(-20)-.28,-20.28],[side*1.5,deckY(-20)-.40,-20.6],[side*1.68,deckY(-20)-.38,-20.7]],.022,mat.chrome,20,6,false);
  }
  
  // Aft salon furniture: upholstered modular sofas with piping, tables and individual feet.
  function makeSofa(x,z,y,width=2.05,depth=1.22,material=mat.cushion) {
    const g=new THREE.Group(); g.position.set(x,y,z); scene.add(g);
    roundedBox(g,width,.22,depth,0,.25,0,mat.darkWood,.09,6);
    const count=width>2.3?3:2, padGap=.045, padWidth=(width*.86-padGap*(count-1))/count;
    for(let i=0;i<count;i++) {
      const px=(i-(count-1)/2)*(padWidth+padGap);
      roundedBox(g,padWidth,.20,depth*.66,px,.475,.055,material,.085,7);
      roundedBox(g,padWidth*.985,.38,.145,px,.735,-depth*.365,material,.07,7);
      // Fine tonal stitch line around each loose cushion; it reads as textile, not a hard plastic groove.
      tube(g,[[px-padWidth*.40,.578,depth*.385],[px+padWidth*.40,.578,depth*.385]],.006,mat.leather,16,5,false);
    }
    roundedBox(g,.18,.46,depth*.72,-width*.455,.57,0,material,.075,6);
    roundedBox(g,.18,.46,depth*.72,width*.455,.57,0,material,.075,6);
    for(const sx of [-width*.37,width*.37]) for(const sz of [-depth*.30,depth*.30]) cylinderBetween(g,[sx,.04,sz],[sx,.25,sz],.024,mat.chromeDark,10);
    roundedBox(g,width*.88,.018,.024,0,.36,depth*.405,mat.darkWood,.006,3);
    return g;
  }
  makeSofa(-1.9,12.8,deckY(12.8)+.07,2.45,1.18,mat.cushion);
  makeSofa(1.9,12.8,deckY(12.8)+.07,2.45,1.18,mat.cushion);
  // Oval outdoor dining table and four swivel chairs.
  const tableY=deckY(15.5)+.58;
  const table=addMesh(cachedCylinderGeometry(.70,.62,.12,48),mat.white,scene,[0,tableY,15.5]); table.scale.z=1.25;
  const tableEdge=addMesh(cachedTorusGeometry(.655,.012,8,48),mat.chromeDark,scene,[0,tableY+.052,15.5],[Math.PI/2,0,0]); tableEdge.scale.z=1.25;
  cylinderBetween(scene,[0,deckY(15.5)+.13,15.5],[0,tableY-.05,15.5],.09,mat.chromeDark,16);
  for(const side of [-1,1]) for(const z of [14.35,16.65]) {
    const x=side*1.12;
    roundedBox(scene,.67,.14,.67,x,deckY(z)+.45,z,mat.darkWood,.1,4);
    roundedBox(scene,.62,.18,.61,x,deckY(z)+.57,z,mat.cushionDark,.1,5);
    roundedBox(scene,.62,.54,.13,x,deckY(z)+.83,z+side*.29,mat.cushionDark,.07,4);
    cylinderBetween(scene,[x-.20,deckY(z)+.12,z-.18],[x-.20,deckY(z)+.42,z-.18],.024,mat.chrome,8);
    cylinderBetween(scene,[x+.20,deckY(z)+.12,z+.18],[x+.20,deckY(z)+.42,z+.18],.024,mat.chrome,8);
  }
  // Small stainless cleats, deck sockets and flush service panels.
  for(const side of [-1,1]) for(const z of [-12.2,-8.2,4.8,7.4,18.2]) {
    const x=side*beamAt(z,.77);
    roundedBox(scene,.25,.07,.12,x,deckY(z)+.15,z,mat.chrome,.035,3);
    roundedBox(scene,.13,.018,.34,x-side*.17,deckY(z)+.11,z,mat.chromeDark,.008,2);
  }
  
  // Flybridge lounge furniture, pale cushions, cocktail table and a circular spa.
  makeSofa(-2.0,0.8,6.90,2.25,1.12,mat.cushion);
  makeSofa(2.0,0.8,6.90,2.25,1.12,mat.cushion);
  const cocktail=addMesh(cachedCylinderGeometry(.52,.48,.095,36),mat.white,scene,[0,7.49,1.95]); cocktail.scale.z=1.12;
  cylinderBetween(scene,[0,7.02,1.95],[0,7.43,1.95],.07,mat.chromeDark,12);
  // Hot tub shell, brushed-metal rim, turquoise water and inset jets.
  const spaX=0, spaY=7.11, spaZ=-.4;
  addMesh(cachedCylinderGeometry(1.18,1.08,.57,64),mat.white,scene,[spaX,spaY,spaZ]);
  // TorusGeometry is born in the XY plane: rotate it onto the horizontal XZ plane for a real spa rim.
  addMesh(cachedTorusGeometry(1.12,.055,12,72),mat.chrome,scene,[spaX,spaY+.28,spaZ],[Math.PI/2,0,0]);
  const spaWaterMaterial = new THREE.MeshPhysicalMaterial({map:spaWaterTexture,color:0xffffff,roughness:.34,metalness:.015,clearcoat:.28,clearcoatRoughness:.34,envMapIntensity:.24});
  const spaWaterSurface = addMesh(cachedCylinderGeometry(1.00,.98,.075,64),spaWaterMaterial,scene,[spaX,spaY+.27,spaZ]);
  spaWaterSurface.name='Textured spa water';
  for(let i=0;i<10;i++) {
    const a=i/10*Math.PI*2;
    sphere(scene,Math.cos(a)*.87,spaY+.31,spaZ+Math.sin(a)*.87,.04,.018,.04,mat.chrome,10,8);
  }
  // Two low teak side tables and small gold accessories on the upper lounge.
  for(const side of [-1,1]) {
    roundedBox(scene,.72,.12,.72,side*3.0,7.45,1.95,mat.darkWood,.08,4);
    sphere(scene,side*3.0,7.56,1.95,.11,.10,.11,mat.gold,16,10);
  }
  
  // Radar arch, satcom domes, aerials, spotlight housings and a rotating radar bar.
  const mastGroup=new THREE.Group(); mastGroup.position.set(0,8.53,-4.35); scene.add(mastGroup);
  roundedBox(mastGroup,.20,.55,.20,0,.24,0,mat.chromeDark,.05,4);
  cylinderBetween(mastGroup,[-.9,.15,0],[.9,.15,0],.032,mat.chrome,10);
  const radome=sphere(mastGroup,0,.62,0,.42,.24,.42,mat.white,24,16);
  sphere(mastGroup,-.95,.13,0,.18,.06,.12,mat.black,16,8);
  sphere(mastGroup,.95,.13,0,.18,.06,.12,mat.black,16,8);
  const radarDish=new THREE.Group(); radarDish.position.set(0,.86,0); mastGroup.add(radarDish);
  roundedBox(radarDish,1.55,.055,.09,0,0,0,mat.chrome,.025,4);
  roundedBox(radarDish,.42,.12,.11,0,.035,0,mat.white,.035,4);
  cylinderBetween(mastGroup,[0,.78,0],[0,1.65,0],.022,mat.chrome,8);
  cylinderBetween(mastGroup,[-.45,.75,.05],[-.70,1.48,.05],.012,mat.chrome,6);
  cylinderBetween(mastGroup,[.45,.75,.05],[.70,1.48,.05],.012,mat.chrome,6);
  // Roof sensor puck and paired searchlights.
  for(const side of [-1,1]) {
    const lightHousing=roundedBox(scene,.34,.19,.27,side*2.45,6.83,-6.80,mat.chromeDark,.07,4);
    roundedBox(scene,.22,.08,.06,side*2.45,6.83,-6.94,mat.emissiveWarm,.025,3);
  }
  sphere(scene,0,6.80,-1.9,.24,.08,.24,mat.white,20,10);
  
  // Hull-side nameplates and small running lights (red port, green starboard).
  const navLights=[]; const luminousMeshes=[]; const pointLights=[];
  function addLamp(x,y,z,material,color,intensity=0.65,distance=8) {
    const bulb=sphere(scene,x,y,z,.075,.055,.055,material,14,8); luminousMeshes.push(bulb);
    // Keep the original luminous fitting, but use the circuit lighting; no extra lights.
    return bulb;
  }
  for(const side of [-1,1]) {
    const z=-18.2, x=side*beamAt(z,.66), y=deckY(z)+.44;
    const m=side<0?mat.emissiveRed:mat.emissiveCool;
    navLights.push(addLamp(x,y,z,m,side<0?0xff3030:0x30ffb5,.7,9));
  }
  // Warm deck LEDs along cockpit edges and blue underwater ambience strip.
  const deckLightPositions=[];
  for(const side of [-1,1]) for(let z=-8;z<=17;z+=4.2) deckLightPositions.push([side*beamAt(z,.82),deckY(z)+.19,z]);
  for(const [x,y,z] of deckLightPositions) addLamp(x,y,z,mat.emissiveWarm,0xffb466,.23,4.5);
  const underglow = [];
  for(const side of [-1,1]) {
    const glowMat=new THREE.MeshStandardMaterial({color:0x30c8e5,emissive:0x0598bd,emissiveIntensity:.9,transparent:true,opacity:.62,roughness:.26});
    const glowPts=[];
    for(let z=-13;z<=15;z+=1.4) { const st=interpolateStation(z); glowPts.push([side*st.beam*hullSideFactorAtY(st.top,.10)*1.006,.10,z]); }
    const strip=tube(scene,glowPts,.038,glowMat,160,8,false); strip.visible=false; underglow.push(strip);
  }
  // Warm step lights near the aft boarding stairs.
  for(let i=0;i<5;i++) {
    const z=6.2+i*.37;
    roundedBox(scene,.07,.035,.08,3.22,2.38-i*.12,z,mat.emissiveWarm,.018,3);
  }
  
  // Environmental wake, bubbles and open-sea plane removed for isolated transparent model presentation.
  
  // Additional slim side rails on the boarding stairs and a clean, unbranded transom.
  for(const side of [-1,1]) {
    for(let i=0;i<6;i++) roundedBox(scene,.74,.08,.19,side*(2.9-i*.16),2.38-i*.13,5.65+i*.38,mat.whiteTrim,.035,3);
    tube(scene,[[side*3.7,2.56,5.55],[side*3.15,2.22,7.65],[side*2.9,2.12,8.2]],.028,mat.chrome,30,8,false);
  }
  roundedBox(scene,1.42,.23,.075,0,1.82,22.04,mat.chromeDark,.04,4);
  
  // No HUD or lettering: orbit and pinch/scroll directly on the rendered yacht.
  // Navigation lights remain subtle in daylight; no UI elements are drawn over the model.
  for(const p of pointLights) p.intensity=0.075;
  for(const item of luminousMeshes) if(item.material && 'emissiveIntensity' in item.material) item.material.emissiveIntensity=Math.min(item.material.emissiveIntensity || 0.4,0.42);
  for(const strip of underglow) strip.visible=false;
  
  // Shadow budget: micro-hardware remains visible and still receives shadows, but it does
  // not cast a separate tiny silhouette into the 3072px shadow map. This reduces shadow-pass
  // draw calls without changing meshes, textures, silhouettes or the primary hull shadows.
  function disableMicroShadowCasters(root, maxDimension = 0.17, maxDiagonal = 0.23) {
    root.updateMatrixWorld(true);
    const box = new THREE.Box3();
    const size = new THREE.Vector3();
    let examined = 0, disabled = 0;
    root.traverse(object => {
      if (!object.isMesh || object.isInstancedMesh || !object.castShadow || object.userData?.keepShadowCaster) return;
      examined++;
      box.setFromObject(object);
      box.getSize(size);
      const maxSide = Math.max(size.x, size.y, size.z);
      const diagonal = size.length();
      if (maxSide <= maxDimension && diagonal <= maxDiagonal) {
        object.castShadow = false;
        disabled++;
      }
    });
    return { examined, microCastersDisabled: disabled, thresholdMeters: maxDimension };
  }
  const microShadowStats = disableMicroShadowCasters(scene);
  // Radar rotates continuously. Its small shadow is visually negligible, so exclude it from
  // the static shadow map; all large stationary structures keep their full shadow quality.
  if (radarDish) radarDish.traverse(object => { if (object.isMesh) object.castShadow = false; });
  
  // Static draw-call optimization. Repeated tiny meshes (rails, fasteners, upholstery
  // seams, vents and fittings) are merged by material and spatial cell. Their original
  // transforms are baked into the new buffers, so silhouettes, UVs, normals, materials
  // and shadow flags are preserved. Instanced teak panels and animated radar parts stay
  // untouched. Spatial cells retain useful frustum culling during close-up orbit views.
  function optimizeStaticMeshes(root, { outputRoot=root, excludeRoots=[], cellSize=8, label='model' }={}) {
    scene.updateMatrixWorld(true);
    root.updateWorldMatrix(true, true);
    outputRoot.updateWorldMatrix(true, false);
    const outputInverse = outputRoot === scene ? new THREE.Matrix4() : new THREE.Matrix4().copy(outputRoot.matrixWorld).invert();
    const excluded = new Set(excludeRoots);
    const buckets = new Map();
    const clonedForMerge = [];
    let visitedMeshes = 0, eligibleMeshes = 0;
  
    function geometryLayout(geometry) {
      if (!geometry || !geometry.isBufferGeometry ||
          (geometry.drawRange && (geometry.drawRange.start !== 0 || geometry.drawRange.count !== Infinity)) ||
          (geometry.morphAttributes && Object.keys(geometry.morphAttributes).some(k => geometry.morphAttributes[k]?.length))) return null;
      const attrs = Object.keys(geometry.attributes).sort();
      if (!attrs.includes('position')) return null;
      const descriptor = [];
      for (const name of attrs) {
        const a = geometry.attributes[name];
        if (!a || a.isInterleavedBufferAttribute || !a.array) return null;
        descriptor.push(`${name}:${a.itemSize}:${a.normalized?1:0}:${a.array.constructor.name}:${a.gpuType??0}`);
      }
      return `${geometry.index ? geometry.index.array.constructor.name : 'non-indexed'}|${descriptor.join(';')}`;
    }
  
    function canMerge(mesh) {
      if (!mesh.isMesh || mesh.isInstancedMesh || mesh.isSkinnedMesh || mesh.isBatchedMesh ||
          !mesh.visible || Array.isArray(mesh.material) || !mesh.material || !mesh.material.visible ||
          mesh.renderOrder !== 0 || mesh.material.transparent || mesh.material.opacity < 1 ||
          mesh.material.alphaTest > 0 || mesh.material.depthWrite === false || mesh.material.wireframe ||
          mesh.material.blending !== THREE.NormalBlending || mesh.material.transmission > 0 ||
          mesh.userData?.keepSeparate || !geometryLayout(mesh.geometry)) return false;
      return true;
    }
  
    function walk(node) {
      if (node !== root && (!node.visible || excluded.has(node))) return;
      if (node !== root && node.isMesh) {
        visitedMeshes++;
        if (canMerge(node)) {
          const layout = geometryLayout(node.geometry);
          const baked = node.geometry.clone();
          // Since canMerge excludes material arrays, geometry groups are redundant here and can
          // otherwise block batching of CylinderGeometry (which creates top/side/bottom groups).
          baked.clearGroups();
          const relativeMatrix = new THREE.Matrix4().multiplyMatrices(outputInverse, node.matrixWorld);
          baked.applyMatrix4(relativeMatrix);
          baked.computeBoundingBox();
          const center = baked.boundingBox ? baked.boundingBox.getCenter(new THREE.Vector3()) : new THREE.Vector3();
          const cell = Math.floor(center.z / cellSize);
          const key = [node.material.uuid, layout, node.castShadow?1:0, node.receiveShadow?1:0,
            node.frustumCulled?1:0, node.layers.mask, node.renderOrder, cell].join('|');
          if (!buckets.has(key)) buckets.set(key, []);
          buckets.get(key).push({ mesh:node, geometry:baked, material:node.material, key });
          clonedForMerge.push(baked);
          eligibleMeshes++;
        }
      }
      for (const child of [...node.children]) walk(child);
    }
    walk(root);
  
    let mergedBatches = 0, mergedSources = 0, estimatedDrawCallsSaved = 0;
    const removedGeometries = new Set();
    for (const group of buckets.values()) {
      if (group.length < 2) continue;
      let mergedGeometry = null;
      try { mergedGeometry = mergeGeometries(group.map(item => item.geometry), false); }
      catch (error) { console.warn(`AURELIA batching skipped a ${label} group:`, error); }
      if (!mergedGeometry) continue;
      mergedGeometry.computeBoundingBox();
      mergedGeometry.computeBoundingSphere();
      const source = group[0].mesh;
      const batch = new THREE.Mesh(mergedGeometry, source.material);
      batch.name = `Static batch · ${label} · ${group.length} meshes`;
      batch.castShadow = source.castShadow;
      batch.receiveShadow = source.receiveShadow;
      batch.frustumCulled = source.frustumCulled;
      batch.layers.mask = source.layers.mask;
      batch.renderOrder = source.renderOrder;
      batch.userData.aureliaStaticBatch = true;
      outputRoot.add(batch);
      for (const item of group) {
        item.mesh.parent.remove(item.mesh);
        removedGeometries.add(item.mesh.geometry);
      }
      mergedBatches++;
      mergedSources += group.length;
      estimatedDrawCallsSaved += group.length - 1;
    }
  
    // Dispose temporary transformed copies; merged buffers own their copied attributes.
    for (const g of clonedForMerge) g.dispose();
    // Dispose removed GPU buffers only when no surviving object (e.g. shared propeller blade)
    // still references the original geometry.
    const stillUsed = new Set();
    scene.traverse(o => { if (o.isMesh && o.geometry) stillUsed.add(o.geometry); });
    for (const g of removedGeometries) if (!stillUsed.has(g)) {
      g.dispose();
      for (const [key, cachedGeometry] of primitiveGeometryCache) {
        if (cachedGeometry === g) primitiveGeometryCache.delete(key);
      }
    }
    outputRoot.updateWorldMatrix(true, true);
    return { label, visitedMeshes, eligibleMeshes, mergedSources, mergedBatches, estimatedDrawCallsSaved };
  }
  
  // Keep the tender as its own transformable model. The yacht's rotating radar antenna
  // remains separate; all visible design details and every InstancedMesh retain their geometry.
  const yachtBatchStats = optimizeStaticMeshes(scene, {
    outputRoot: scene,
    excludeRoots: [lifeboat, radarDish],
    cellSize: 8,
    label: 'yacht'
  });
  const rescueBatchStats = optimizeStaticMeshes(lifeboat, {
    outputRoot: lifeboat,
    excludeRoots: [],
    cellSize: 12,
    label: 'rescue RIB'
  });
  
  scene.remove(lifeboat);
  // Remove only the reference's alongside-yacht X/Z position; retain its
  // full-scale 1.55 transform and original -0.63 m waterline calibration.
  lifeboat.position.set(0, -0.63, 0);
  lifeboat.name = 'AURELIA_RescueRIB_Prototype';
  radarDish.name = 'AURELIA_RotatingRadar';
  radarDish.userData.aureliaAnimated = true;
  for (const root of [scene, lifeboat]) {
    root.updateMatrixWorld(true);
    root.traverse(object => {
      if (!object.isMesh) return;
      object.userData.c3NoShadow = !object.castShadow;
      object.layers.enable(1);
    });
  }
  return {
    yacht: scene,
    rescue: lifeboat,
    radar: radarDish,
    diagnostics: {
      sourceSha256: '37995e90173b7a8525f9e378d52f66a315de58efdc6fd88bd723f3fc3ae02611',
      design: 'Original AURELIA 45 m yacht and full-scale offshore rescue RIB',
      sourceGeometryAndTexturesPreserved: true,
      microShadows: microShadowStats,
      yachtBatching: yachtBatchStats,
      rescueBatching: rescueBatchStats,
      primitiveGeometryCacheHits,
      primitiveGeometryCacheMisses,
    },
  };
}
