import * as THREE from 'three';
import { buildC3FloodlightRig, createC3FloodlightSteelMaterial } from '../game/circuits/singapore/SingaporeFloodlightDesign';

interface AuditView { name: string; position: [number, number, number]; target: [number, number, number]; fov: number; }
const views: AuditView[] = [
  { name: 'Conjunto completo', position: [23, 7.5, 17], target: [10.5, 3.8, 0.6], fov: 40 },
  { name: 'Detalle frontal', position: [5.6, 5.7, 6.7], target: [10.47, 7.56, 0.85], fov: 34 },
  { name: 'Orientación hacia pista', position: [0, 12, 28], target: [0, 3.1, 1.6], fov: 53 },
  { name: 'Parte posterior', position: [16.5, 9.1, -6.2], target: [10.47, 7.4, 0.85], fov: 35 },
];

const scene = new THREE.Scene();
scene.background = new THREE.Color(0xa4abb0);
const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(1);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.1;
document.getElementById('audit-scene')!.appendChild(renderer.domElement);
const camera = new THREE.PerspectiveCamera(40, 1, 0.05, 200);
scene.add(new THREE.HemisphereLight(0xe8f2fb, 0x687078, 2.2));
const sun = new THREE.DirectionalLight(0xfff3df, 3.3);
sun.position.set(-8, 15, 10); scene.add(sun);
const fill = new THREE.DirectionalLight(0xc7d8e9, 1.4);
fill.position.set(20, 8, -8); scene.add(fill);

const ground = new THREE.Mesh(new THREE.PlaneGeometry(120, 120), new THREE.MeshStandardMaterial({color:0x939b9f, roughness:0.95}));
ground.rotation.x = -Math.PI / 2; ground.position.y = -0.012; scene.add(ground);
const road = new THREE.Mesh(new THREE.PlaneGeometry(14, 100), new THREE.MeshStandardMaterial({color:0x333b40, roughness:0.97}));
road.rotation.x = -Math.PI / 2; road.position.y = 0.002; scene.add(road);
const lineMaterial = new THREE.MeshStandardMaterial({color:0xd9dcdf,roughness:0.85});
for (const x of [-6.7, 6.7]) {
  const line = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.008, 100), lineMaterial);
  line.position.set(x,0.009,0); scene.add(line);
}

// A production-sized straight-line station, with both sides of the actual road width.
const rig = buildC3FloodlightRig([
  {x:0,z:0,accumulatedDistance:1000},
  {x:0,z:2,accumulatedDistance:1002},
  {x:0,z:-2,accumulatedDistance:998},
], 7, createC3FloodlightSteelMaterial(), new THREE.MeshStandardMaterial({color:0x888888}));
scene.add(rig);
scene.updateMatrixWorld(true);

const controls = document.createElement('div'); controls.id = 'audit-controls';
const label = document.createElement('span'); label.textContent = 'Circuito 3 · nuevo foco';
const select = document.createElement('select'); select.setAttribute('aria-label','Vista de inspección del foco');
views.forEach((view,index) => select.add(new Option(view.name,String(index))));
const button = document.createElement('button'); button.textContent = 'Aplicar vista';
controls.append(label,select,button); document.body.appendChild(controls);
const status = document.getElementById('audit-status')!;
let activeView = views[0];
function render(view = activeView) {
  activeView = view;
  const width = window.innerWidth, height = window.innerHeight;
  renderer.setSize(width,height,false);
  camera.aspect = width / height; camera.fov = view.fov;
  camera.position.fromArray(view.position); camera.lookAt(...view.target);
  camera.updateProjectionMatrix(); camera.updateMatrixWorld(true);
  renderer.render(scene,camera);
  status.textContent = '7,56 m · 6 módulos × 18 ópticas · mallas fusionadas e instanciadas · ópticas apagadas';
  document.documentElement.dataset.auditReady = 'true';
  document.documentElement.dataset.auditMetrics = JSON.stringify({view:view.name,design:rig.userData.c3FloodlightDesign,calls:renderer.info.render.calls,triangles:renderer.info.render.triangles});
}
button.onclick = () => render(views[Number(select.value)]);
window.addEventListener('resize',() => render());
render();
(window as unknown as {floodlightAudit:unknown}).floodlightAudit = {scene,renderer,camera,rig,views,render};
if (import.meta.hot) import.meta.hot.dispose(() => {
  renderer.dispose(); controls.remove();
});
