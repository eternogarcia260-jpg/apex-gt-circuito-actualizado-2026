from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
source = (ROOT / 'docs/sources/noria_optimizada.html').read_text()
helpers = source[source.index('// Une mallas estáticas'):source.index('// -----------------------------------------------------------------------------\n// Renderer / cámara')]
body = source[source.index('// Materiales metálicos'):source.index('// Los anclajes se apoyan')]
body = body.replace('const wheelRoot = new THREE.Group(); scene.add(wheelRoot);', "const wheelRoot = new THREE.Group(); wheelRoot.name = 'C3_FerrisWheel';")
body = body.replace('const wheelSpinPivot = new THREE.Group(); wheelSpinPivot.position.y = C.y;', "const wheelSpinPivot = new THREE.Group(); wheelSpinPivot.name = 'C3_FerrisWheelSpinPivot'; wheelSpinPivot.position.y = C.y;")
body = body.replace('const wheelSpin = new THREE.Group(); wheelSpin.position.y = -C.y;', "const wheelSpin = new THREE.Group(); wheelSpin.name = 'C3_FerrisWheelRotor'; wheelSpin.position.y = -C.y;")
body = body.replace('ledRing.castShadow=false;', "ledRing.name = 'C3_FerrisWheelRimLEDs'; ledRing.castShadow=false;")
# The source's service deck is retained. Piles only connect its existing four feet to the sea.
piles = """// Marine integration: four fixed piles, not a floating or wave-following body.
const pileMat = new THREE.MeshStandardMaterial({name:'C3_FerrisWheelMarinePiles', color:0x303a40, roughness:0.58, metalness:0.72});
for (const x of [-14.2,14.2]) for (const z of [-3.35,3.35]) {
  const top=-0.08, bottom=-4.2;
  const pile=new THREE.Mesh(new THREE.CylinderGeometry(0.55,0.62,top-bottom,16),pileMat);
  pile.position.set(x,(top+bottom)*0.5,z); pile.castShadow=true; pile.receiveShadow=true; wheelRoot.add(pile);
}
"""
body = body.replace('mergeDirectMeshes(wheelRoot);', piles + 'mergeDirectMeshes(wheelRoot);')
start = body.index('const cabinInstances=[];')
end = body.index('// El prototipo ya se ha convertido', start)
body = body[:start] + """const cabinInstances=[];
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
""" + body[end:]
start = body.index('const cabinData=')
end = body.index('// Cableados finos', start)
body = body[:start] + """const cabinData=Array.from({length:N},(_,i)=>({angle:i/N*Math.PI*2,radius:R+0.48}));
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
""" + body[end:]
footer = """
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
"""
out = """/* Geometric construction ported directly from user-provided noria_optimizada.html.
 * Original dimensions, tessellation, PBR materials and cabin hierarchy are preserved.
 * Only the standalone renderer/environment/ground are omitted; shared glass batching
 * and four submerged foundations adapt the model to the host circuit.
 */
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

""" + helpers + '\nexport function createFerrisWheelPrototype() {\n' + body + footer + '}\n'
(ROOT / 'src/game/circuits/singapore/FerrisWheelPrototype.js').write_text(out)
print('Wrote faithful prototype:', len(out.splitlines()), 'lines')
