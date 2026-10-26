/* Geometric construction ported directly from user-provided noria_optimizada.html.
 * Original dimensions, tessellation, PBR materials and cabin hierarchy are preserved.
 * Only the standalone renderer/environment/ground are omitted; shared glass batching
 * and four submerged foundations adapt the model to the host circuit.
 */
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

// Une mallas estáticas compatibles por material. Mantiene la geometría, los UV y
// las normales, pero reduce drásticamente las llamadas de dibujo (draw calls).
function geometrySignature(g){
  const attrs=Object.keys(g.attributes).sort().map(k=>{
    const a=g.attributes[k]; return `${k}:${a.itemSize}:${a.normalized?1:0}`;
  }).join(',');
  return `${g.index?'indexed':'nonindexed'}|${attrs}`;
}
function collectMergedParts(root, options={}){
  root.updateMatrixWorld(true);
  const inverse=root.matrixWorld.clone().invert();
  const buckets=new Map();
  const originalGeometries=new Set();
  // En los prototipos que requieren fidelidad de sombras, cada lote conserva
  // sus propios flags para no activar sombras en piezas que no las necesitan.
  const preserveShadowFlags=options.preserveShadowFlags===true;
  root.traverse(object=>{
    if(!object.isMesh || object.isInstancedMesh || !object.geometry || Array.isArray(object.material)) return;
    originalGeometries.add(object.geometry);
    const rel=new THREE.Matrix4().multiplyMatrices(inverse,object.matrixWorld);
    const geometry=object.geometry.clone();
    geometry.applyMatrix4(rel);
    const shadowKey=preserveShadowFlags?`|cast:${object.castShadow?1:0}|receive:${object.receiveShadow?1:0}`:'';
    const key=`${object.material.uuid}|${geometrySignature(geometry)}${shadowKey}`;
    if(!buckets.has(key)) buckets.set(key,{material:object.material,geometries:[],castShadow:false,receiveShadow:false});
    const bucket=buckets.get(key);
    bucket.geometries.push(geometry);
    bucket.castShadow ||= object.castShadow;
    bucket.receiveShadow ||= object.receiveShadow;
  });
  const parts=[];
  for(const bucket of buckets.values()){
    if(bucket.geometries.length===1){
      parts.push({geometry:bucket.geometries[0],material:bucket.material,castShadow:bucket.castShadow,receiveShadow:bucket.receiveShadow});
      continue;
    }
    let merged=null;
    try { merged=mergeGeometries(bucket.geometries,false); } catch(e) { /* fallback below keeps every original part */ }
    if(merged){
      for(const geometry of bucket.geometries) geometry.dispose();
      merged.computeBoundingSphere();
      parts.push({geometry:merged,material:bucket.material,castShadow:bucket.castShadow,receiveShadow:bucket.receiveShadow});
    } else {
      for(const geometry of bucket.geometries) parts.push({geometry,material:bucket.material,castShadow:bucket.castShadow,receiveShadow:bucket.receiveShadow});
    }
  }
  for(const geometry of originalGeometries) geometry.dispose();
  return parts;
}
function mergeDirectMeshes(root){
  root.updateMatrixWorld(true);
  const preserved=root.children.filter(o=>!(o.isMesh && !o.isInstancedMesh && !Array.isArray(o.material)));
  const parts=collectMergedParts({
    matrixWorld:root.matrixWorld,
    updateMatrixWorld:()=>root.updateMatrixWorld(true),
    traverse(fn){ for(const o of root.children){ if(o.isMesh && !o.isInstancedMesh && !Array.isArray(o.material)) fn(o); } }
  });
  // collectMergedParts espera el transform raíz real; las mallas directas de este
  // proyecto cuelgan de grupos con transform identidad, o sus matrices ya son mundiales.
  root.clear();
  for(const child of preserved) root.add(child);
  for(const part of parts){
    const mesh=new THREE.Mesh(part.geometry,part.material);
    mesh.castShadow=part.castShadow; mesh.receiveShadow=part.receiveShadow;
    root.add(mesh);
  }
}


export function createFerrisWheelPrototype() {
// Materiales metálicos, con valores físicos y variación de roughness.
const steel = new THREE.MeshStandardMaterial({color:0x3e484f, metalness:0.88, roughness:0.27});
const steelBright = new THREE.MeshStandardMaterial({color:0x9ca5a8, metalness:0.92, roughness:0.22});
const steelDark = new THREE.MeshStandardMaterial({color:0x20292f, metalness:0.78, roughness:0.34});
const cableMat = new THREE.MeshStandardMaterial({color:0x6d777d, metalness:0.82, roughness:0.28});
const warmMetal = new THREE.MeshStandardMaterial({color:0xc5a36e, metalness:0.78, roughness:0.27});
const enamelBlue = new THREE.MeshPhysicalMaterial({color:0x152936, metalness:0.62, roughness:0.24, clearcoat:0.75, clearcoatRoughness:0.2});
const glass = new THREE.MeshPhysicalMaterial({color:0x213946, metalness:0.52, roughness:0.12, transparent:true, opacity:0.46, clearcoat:1, clearcoatRoughness:0.08, side:THREE.DoubleSide});
const glassEdge = new THREE.MeshStandardMaterial({color:0x17232b, metalness:0.78, roughness:0.22});
const interiorMat = new THREE.MeshStandardMaterial({color:0x171d21, metalness:0.15, roughness:0.78});
const cushionMat = new THREE.MeshStandardMaterial({color:0x433a32, metalness:0.05, roughness:0.86});
const warmLamp = new THREE.MeshStandardMaterial({color:0xffb95e, emissive:0xff8b26, emissiveIntensity:2.6, roughness:0.25});

const wheelRoot = new THREE.Group(); wheelRoot.name = 'C3_FerrisWheel';
const C= new THREE.Vector3(0,35.2,0);
const R=28.7;
// Subconjunto giratorio con pivote situado exactamente en el eje central.
const wheelSpinPivot = new THREE.Group(); wheelSpinPivot.name = 'C3_FerrisWheelSpinPivot'; wheelSpinPivot.position.y = C.y; wheelRoot.add(wheelSpinPivot);
const wheelSpin = new THREE.Group(); wheelSpin.name = 'C3_FerrisWheelRotor'; wheelSpin.position.y = -C.y; wheelSpinPivot.add(wheelSpin);
let activeAssembly = wheelSpin;

function cylinderBetween(a,b,r,mat,segments=12){
  const d=new THREE.Vector3().subVectors(b,a); const len=d.length();
  const mesh=new THREE.Mesh(new THREE.CylinderGeometry(r,r,len,segments,1,false),mat);
  mesh.position.copy(a).add(b).multiplyScalar(0.5);
  mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),d.normalize());
  mesh.castShadow=true; mesh.receiveShadow=true; activeAssembly.add(mesh); return mesh;
}
function beamBetween(a,b,width,depth,mat){
  const d=new THREE.Vector3().subVectors(b,a); const len=d.length();
  const mesh=new THREE.Mesh(new THREE.BoxGeometry(width,len,depth),mat);
  mesh.position.copy(a).add(b).multiplyScalar(.5);
  mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),d.normalize());
  mesh.castShadow=true; mesh.receiveShadow=true; activeAssembly.add(mesh); return mesh;
}
function addBox(parent, size, pos, mat, bevel=0){
  const edgeRadius=bevel || Math.min(size[0],size[1],size[2])*0.075;
  let geo=new RoundedBoxGeometry(size[0],size[1],size[2],2,Math.max(0.001,edgeRadius));
  const mesh=new THREE.Mesh(geo,mat); mesh.position.set(pos[0],pos[1],pos[2]);
  mesh.castShadow=true; mesh.receiveShadow=true; parent.add(mesh); return mesh;
}
function torusRing(rad,tube,z,mat,segments=256){
  const m=new THREE.Mesh(new THREE.TorusGeometry(rad,tube,12,segments),mat);
  m.position.set(0,C.y,z); m.castShadow=true; m.receiveShadow=true; activeAssembly.add(m); return m;
}

// Anillos dobles, carriles secundarios y aro de iluminación encastrado.
for(const z of [-2.4,2.4]){
  torusRing(R,0.34,z,steel,320);
  torusRing(R-0.66,0.105,z,steelBright,320);
  torusRing(R+0.53,0.075,z,steelDark,320);
  torusRing(R-1.18,0.07,z,steel,320);
  torusRing(R+0.12,0.035,z+(z>0?0.20:-0.20),warmMetal,320);
}
// Refuerzos transversales cortos entre los dos planos estructurales del aro.
for(let i=0;i<64;i++){
  const a=i*Math.PI*2/64;
  const p1=new THREE.Vector3(Math.cos(a)*(R-0.72),C.y+Math.sin(a)*(R-0.72),-2.4);
  const p2=new THREE.Vector3(Math.cos(a)*(R-0.72),C.y+Math.sin(a)*(R-0.72),2.4);
  cylinderBetween(p1,p2,0.095,steelDark,8);
}

// Centro de rueda, placas mecánicas, eje y tapas circulares.
const axle = new THREE.Mesh(new THREE.CylinderGeometry(1.55,1.55,7.6,64),steelBright);
axle.rotation.x=Math.PI/2; axle.position.copy(C); axle.castShadow=true; axle.receiveShadow=true; activeAssembly.add(axle);
for(const z of [-3.0,3.0]){
  const flange=new THREE.Mesh(new THREE.CylinderGeometry(2.8,2.8,0.8,64),steelDark);
  flange.rotation.x=Math.PI/2; flange.position.set(0,C.y,z); flange.castShadow=true; flange.receiveShadow=true; activeAssembly.add(flange);
  const hubOuter=new THREE.Mesh(new THREE.CylinderGeometry(2.18,2.18,0.86,64),steelBright);
  hubOuter.rotation.x=Math.PI/2; hubOuter.position.set(0,C.y,z+(z>0?0.43:-0.43)); hubOuter.castShadow=true; activeAssembly.add(hubOuter);
  const hubInner=new THREE.Mesh(new THREE.CylinderGeometry(1.68,1.68,0.9,64),steel);
  hubInner.rotation.x=Math.PI/2; hubInner.position.set(0,C.y,z+(z>0?0.91:-0.91)); hubInner.castShadow=true; activeAssembly.add(hubInner);
  const cap=new THREE.Mesh(new THREE.CylinderGeometry(1.15,1.15,0.25,48),warmMetal);
  cap.rotation.x=Math.PI/2; cap.position.set(0,C.y,z+(z>0?1.42:-1.42)); cap.castShadow=true; activeAssembly.add(cap);
  // Tuercas visibles alrededor de las bridas del eje.
  for(let k=0;k<16;k++){
    const a=k*Math.PI*2/16;
    const bolt=new THREE.Mesh(new THREE.CylinderGeometry(.085,.085,.17,8),steelBright);
    bolt.rotation.x=Math.PI/2;
    bolt.position.set(Math.cos(a)*2.38,C.y+Math.sin(a)*2.38,z+(z>0?1.02:-1.02));
    bolt.castShadow=true; activeAssembly.add(bolt);
  }
}

// 32 radios dobles por lado; cada uno recibe una pieza de unión en la llanta.
const N=32;
for(const z of [-2.4,2.4]){
  for(let i=0;i<N;i++){
    const a=i*Math.PI*2/N;
    const r0=2.15, r1=R-0.3;
    const start=new THREE.Vector3(Math.cos(a)*r0,C.y+Math.sin(a)*r0,z);
    const end=new THREE.Vector3(Math.cos(a)*r1,C.y+Math.sin(a)*r1,z);
    cylinderBetween(start,end,0.115,steelBright,10);
    const offset=new THREE.Vector3(-Math.sin(a)*0.19,Math.cos(a)*0.19,0);
    cylinderBetween(start.clone().add(offset),end.clone().add(offset),0.043,steelDark,8);
    // Manguito metálico en el punto de unión de cada radio con la llanta.
    const node=new THREE.Mesh(new THREE.CylinderGeometry(0.27,0.27,0.62,10),warmMetal);
    node.rotation.x=Math.PI/2; node.position.copy(end); node.castShadow=true; node.receiveShadow=true; activeAssembly.add(node);
  }
  // Anillo de cerchas: diagonales cortas que añaden espesor y lectura industrial.
  for(let i=0;i<N;i++){
    const a=i*Math.PI*2/N, b=(i+1)*Math.PI*2/N;
    const pA=new THREE.Vector3(Math.cos(a)*(R-1.15),C.y+Math.sin(a)*(R-1.15),z);
    const pB=new THREE.Vector3(Math.cos(b)*(R-1.15),C.y+Math.sin(b)*(R-1.15),z);
    cylinderBetween(pA,pB,0.052,steel,8);
  }
}

// Pequeñas luces cálidas integradas en el aro; una sola malla instanciada por eficiencia.
const ledGeometry = new THREE.SphereGeometry(0.075,10,8);
const ledCount = 96*2;
const ledRing = new THREE.InstancedMesh(ledGeometry,warmLamp,ledCount);
ledRing.name = 'C3_FerrisWheelRimLEDs'; ledRing.castShadow=false; ledRing.receiveShadow=false;
const ledDummy = new THREE.Object3D(); let ledIndex=0;
for(const z of [-2.8,2.8]){
  for(let i=0;i<96;i++){
    const a=i*Math.PI*2/96;
    ledDummy.position.set(Math.cos(a)*(R+0.35),C.y+Math.sin(a)*(R+0.35),z);
    ledDummy.scale.set(1,1,1); ledDummy.updateMatrix(); ledRing.setMatrixAt(ledIndex++,ledDummy.matrix);
  }
}
ledRing.instanceMatrix.needsUpdate=true; activeAssembly.add(ledRing);

// Estructura de apoyo fija: grandes patas trianguladas, travesaños, placas y pernos.
activeAssembly = wheelRoot;
for(const z of [-3.35,3.35]){
  const footL=new THREE.Vector3(-14.2,0.15,z), footR=new THREE.Vector3(14.2,0.15,z);
  const topL=new THREE.Vector3(-0.75,35.0,z), topR=new THREE.Vector3(0.75,35.0,z);
  beamBetween(footL,topL,1.0,1.05,steelDark);
  beamBetween(footR,topR,1.0,1.05,steelDark);
  // Nervios paralelos exteriores, ligeramente más estrechos.
  beamBetween(new THREE.Vector3(-13.6,0.18,z+0.45),new THREE.Vector3(-0.5,34.0,z+0.45),0.19,0.22,steelBright);
  beamBetween(new THREE.Vector3(13.6,0.18,z+0.45),new THREE.Vector3(0.5,34.0,z+0.45),0.19,0.22,steelBright);
  // Travesaños entre patas a distintas cotas y arriostramiento cruzado.
  for(const y of [5.0,11.0,17.0,23.0]){
    const t=(y/31.9); const xl=-14.2+(13.1*t), xr=14.2-(13.1*t);
    beamBetween(new THREE.Vector3(xl,y,z),new THREE.Vector3(xr,y,z),0.38,0.55,steel);
  }
  beamBetween(new THREE.Vector3(-10.8,8.5,z+0.05),new THREE.Vector3(7.8,26.5,z+0.05),0.25,0.28,cableMat);
  beamBetween(new THREE.Vector3(10.8,8.5,z+0.05),new THREE.Vector3(-7.8,26.5,z+0.05),0.25,0.28,cableMat);
  // Placas base estructurales y cuatro pernos por pata.
  for(const x of [-14.2,14.2]){
    addBox(wheelRoot,[3.0,.42,2.6],[x,0.13,z],steelDark);
    addBox(wheelRoot,[2.5,.12,2.1],[x,0.39,z],steelBright);
    for(const bx of [-0.85,0.85]) for(const bz of [-0.72,0.72]){
      const bolt=new THREE.Mesh(new THREE.CylinderGeometry(.105,.105,.17,8),warmMetal);
      bolt.position.set(x+bx,0.53,z+bz); bolt.castShadow=true; activeAssembly.add(bolt);
    }
  }
}
// Arco/travesaño del eje a las patas; carcasas técnicas entre ambos apoyos.
for(const z of [-3.35,3.35]){
  beamBetween(new THREE.Vector3(-1.6,35.0,z),new THREE.Vector3(1.6,35.0,z),1.25,1.1,steelBright);
}
addBox(wheelRoot,[4.1,1.0,5.2],[0,33.45,0],steelDark);
addBox(wheelRoot,[3.4,.28,4.5],[0,34.08,0],steelBright);

// Plataforma técnica baja integrada en la máquina; sin barandillas decorativas.
addBox(wheelRoot,[31,.38,14.5],[0,.24,0],steelDark);
addBox(wheelRoot,[29,.14,13.3],[0,.48,0],steelBright);
for(let i=0;i<24;i++){
  const x=-13.2+i*1.15;
  addBox(wheelRoot,[.045,.018,12.0],[x,.565,0],steelDark);
}
// Une los apoyos, placas, pernos y plataforma por material; el aro giratorio queda aparte.
// Marine integration: four fixed piles, not a floating or wave-following body.
const pileMat = new THREE.MeshStandardMaterial({name:'C3_FerrisWheelMarinePiles', color:0x303a40, roughness:0.58, metalness:0.72});
for (const x of [-14.2,14.2]) for (const z of [-3.35,3.35]) {
  const top=-0.08, bottom=-4.2;
  const pile=new THREE.Mesh(new THREE.CylinderGeometry(0.55,0.62,top-bottom,16),pileMat);
  pile.position.set(x,(top+bottom)*0.5,z); pile.castShadow=true; pile.receiveShadow=true; wheelRoot.add(pile);
}
mergeDirectMeshes(wheelRoot);

// -----------------------------------------------------------------------------
// Cabinas: cuerpo esmaltado, marcos metálicos, cristales, techo, interior y luces.
// Cada góndola se mantiene vertical mientras rota la rueda: suspensión realista.
// -----------------------------------------------------------------------------
function createCabin(){
  const pivot=new THREE.Group();
  // Varillas colgantes y herrajes superiores.
  const hanger1=new THREE.Mesh(new THREE.CylinderGeometry(.055,.07,1.9,10),steelBright);
  hanger1.position.set(-0.82,-0.85,0); hanger1.castShadow=true; pivot.add(hanger1);
  const hanger2=hanger1.clone(); hanger2.position.x=0.82; pivot.add(hanger2);
  const topBar=addBox(pivot,[2.08,.16,.18],[0,-1.78,0],warmMetal);
  const cabin=new THREE.Group(); cabin.position.set(0,-3.28,0); pivot.add(cabin);
  // Bajo chasis.
  addBox(cabin,[2.88,.22,2.25],[0,-1.70,0],steelDark);
  addBox(cabin,[2.55,.13,1.98],[0,-1.56,0],steelBright);
  // Carrocería inferior compacta con esquinas ligeramente blindadas.
  const cabinBody=addBox(cabin,[2.68,1.18,2.03],[0,-.91,0],enamelBlue);
  // Molduras horizontales en ambos laterales.
  for(const z of [-1.03,1.03]){
    addBox(cabin,[2.72,.09,.07],[0,-1.37,z],warmMetal);
    addBox(cabin,[2.76,.055,.065],[0,-.35,z],steelBright);
    // Amplio panel panorámico dividido en tres ventanas por finos montantes.
    addBox(cabin,[2.42,1.53,.105],[0,.51,z],glassEdge);
    addBox(cabin,[2.23,1.32,.035],[0,.51,z+(z>0?.068:-.068)],glass);
    for(const x of [-.75,0,.75]){
      addBox(cabin,[.055,1.35,.10],[x,.51,z+(z>0?.11:-.11)],steelBright);
    }
    addBox(cabin,[2.47,.075,.11],[0,1.22,z+(z>0?.11:-.11)],warmMetal);
    addBox(cabin,[2.47,.07,.10],[0,-.17,z+(z>0?.11:-.11)],steelBright);
  }
  // Laterales de extremos con ventana más estrecha.
  for(const x of [-1.35,1.35]){
    addBox(cabin,[.10,1.52,1.7],[x,.5,0],glassEdge);
    addBox(cabin,[.035,1.3,1.5],[x+(x>0?.065:-.065),.5,0],glass);
    addBox(cabin,[.10,1.42,.055],[x+(x>0?.09:-.09),.5,0],steelBright);
  }
  // Techo redondeado simulado con doble cubierta, bordes metálicos y canalón.
  const roofFrame=addBox(cabin,[2.9,.23,2.28],[0,1.42,0],steelDark);
  const roofPanel=addBox(cabin,[2.7,.13,2.12],[0,1.58,0],enamelBlue);
  addBox(cabin,[2.93,.065,2.30],[0,1.67,0],warmMetal);
  // Luz de cabina discreta bajo el alero.
  for(const z of [-.72,.72]){
    const lamp= new THREE.Mesh(new THREE.BoxGeometry(.34,.055,.06),warmLamp);
    lamp.position.set(0,1.29,z); cabin.add(lamp);
  }
  // Interior visible a través del vidrio: banco corrido, respaldos y asideros.
  addBox(cabin,[2.05,.18,.52],[0,-.08,0],cushionMat);
  addBox(cabin,[2.08,.55,.16],[0,.23,-.26],cushionMat);
  addBox(cabin,[2.0,.08,.50],[0,.05,0],interiorMat);
  for(const x of [-.82,.82]){
    addBox(cabin,[.07,.46,.07],[x,-.04,.47],steelBright);
  }
  // Remaches visibles en las esquinas del faldón.
  for(const z of [-1.075,1.075]) for(const x of [-1.18,1.18]){
    const rivet=new THREE.Mesh(new THREE.SphereGeometry(.055,10,8),steelBright);
    rivet.position.set(x,-1.32,z); rivet.castShadow=true; cabin.add(rivet);
  }
  // Pequeñas luminarias frontales dobles, sin rótulos ni marcas.
  for(const x of [-.95,.95]){
    const light=new THREE.Mesh(new THREE.SphereGeometry(.075,12,8),warmLamp);
    light.scale.set(1,.55,.35); light.position.set(x,-1.08,1.11); cabin.add(light);
  }
  cabin.traverse(o=>{ if(o.isMesh){o.castShadow=false; o.receiveShadow=true;} });
  cabinBody.castShadow=true; roofFrame.castShadow=true; roofPanel.castShadow=true;
  return pivot;
}
// Una sola cabina prototipo: sus piezas se fusionan por material y propiedades
// de sombra, y todas las partes se dibujan mediante InstancedMesh. El vidrio se
// reordena de lejos a cerca para conservar el comportamiento de transparencia.
const cabinPrototype=createCabin();
// En las cabinas preservamos las diferencias de sombras al fusionar por material.
// Así, las piezas interiores no heredan el coste de sombras del techo o la carrocería.
const cabinParts=collectMergedParts(cabinPrototype,{preserveShadowFlags:true});
const cabinInstances=[];
for (const [partIndex, part] of cabinParts.entries()) {
  let instances, ids=null;
  if (part.material.transparent) {
    // BatchedMesh sorts the shared glass geometry for each actual camera, including the mirror.
    if (!part.geometry.index) {
      const count=part.geometry.getAttribute('position').count;
      const index=count>65535?new Uint32Array(count):new Uint16Array(count);
      for(let i=0;i<count;i++) index[i]=i;
      part.geometry.setIndex(new THREE.BufferAttribute(index,1));
    }
    instances=new THREE.BatchedMesh(N,part.geometry.getAttribute('position').count,part.geometry.index.count,part.material);
    const geometryId=instances.addGeometry(part.geometry);
    ids=Array.from({length:N},()=>instances.addInstance(geometryId));
    instances.perObjectFrustumCulled=true; instances.sortObjects=true; instances.frustumCulled=false;
    part.geometry.dispose();
  } else {
    instances=new THREE.InstancedMesh(part.geometry,part.material,N);
    instances.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    // Full-sweep bounds are independent of cabin phase and avoid source's unculled opaque batches.
    instances.boundingSphere=new THREE.Sphere(new THREE.Vector3(0,C.y-2.4,2.8),R+6);
    instances.boundingBox=new THREE.Box3(new THREE.Vector3(-R-3,C.y-R-6,-1),new THREE.Vector3(R+3,C.y+R+1,6));
    instances.frustumCulled=true;
  }
  instances.name=`C3_FerrisWheelCabins_${part.material.transparent?'Glass':'Opaque'}_${partIndex}`;
  instances.castShadow=part.castShadow; instances.receiveShadow=part.receiveShadow;
  instances.userData.c3NoShadow=!part.castShadow;
  wheelRoot.add(instances);
  cabinInstances.push({transparent:!!part.material.transparent,mesh:instances,ids});
}
// El prototipo ya se ha convertido a geometría agregada; libera su jerarquía.
cabinPrototype.clear();
const cabinData=Array.from({length:N},(_,i)=>({angle:i/N*Math.PI*2,radius:R+0.48}));
const cabinDummy=new THREE.Object3D();
const cabinMatrices=Array.from({length:N},()=>new THREE.Matrix4());
function updateCabinTransforms(rotation) {
  for(let i=0;i<N;i++) {
    const item=cabinData[i], a=item.angle+rotation;
    cabinDummy.position.set(Math.cos(a)*item.radius,C.y+Math.sin(a)*item.radius,2.8);
    cabinDummy.rotation.set(0,0,0); cabinDummy.scale.set(1,1,1); cabinDummy.updateMatrix();
    cabinMatrices[i].copy(cabinDummy.matrix);
  }
  for(const batch of cabinInstances) {
    for(let i=0;i<N;i++) batch.mesh.setMatrixAt(batch.ids?batch.ids[i]:i,cabinMatrices[i]);
    if(batch.mesh.isInstancedMesh) batch.mesh.instanceMatrix.needsUpdate=true;
  }
}
updateCabinTransforms(0);
for(const batch of cabinInstances) {
  if(batch.mesh.isBatchedMesh) { batch.mesh.computeBoundingBox(); batch.mesh.computeBoundingSphere(); }
}
// Cableados finos y abrazaderas periféricas cada cuatro radios: también giran con el aro.
activeAssembly=wheelSpin;
for(let i=0;i<N;i+=4){
  const a=i*Math.PI*2/N;
  for(const z of [-2.4,2.4]){
    const p=new THREE.Vector3(Math.cos(a)*(R+0.26),C.y+Math.sin(a)*(R+0.26),z);
    const clamp=new THREE.Mesh(new THREE.TorusGeometry(.23,.055,8,16),warmMetal);
    clamp.position.copy(p); clamp.rotation.x=Math.PI/2; clamp.castShadow=true; activeAssembly.add(clamp);
  }
}
mergeDirectMeshes(wheelSpin);
activeAssembly=wheelRoot;


// Keep immutable local matrices; world matrices must still follow the moving axle parent.
wheelRoot.traverse(object=>{
  if(object.isMesh) {
    object.layers.enable(1);
    object.userData.c3NoShadow=!object.castShadow;
    object.updateMatrix(); object.matrixAutoUpdate=false;
    object.matrixWorldAutoUpdate=true;
  }
});
wheelSpin.updateMatrix(); wheelSpin.matrixAutoUpdate=false;
return {
  root:wheelRoot, spinPivot:wheelSpinPivot, cabinBatches:cabinInstances, cabinMatrices,
  parameters:{radius:R,axleHeight:C.y,cabins:N,angularSpeed:0.035,foundationPiles:4},
  setAngle(angle) { wheelSpinPivot.rotation.z=angle; updateCabinTransforms(angle); },
};
}
