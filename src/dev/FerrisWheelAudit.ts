import * as THREE from 'three';
import { RacingGameEngine } from '../game/RacingGameEngine';
import { C3_FERRIS_WHEEL_PLACEMENT, validateC3FerrisWheelPlacement } from '../game/circuits/singapore/SingaporeFerrisWheelLayout';
import type { SingaporeFerrisWheel } from '../game/circuits/singapore/SingaporeFerrisWheel';

interface AuditView { name: string; position: [number, number, number]; target: [number, number, number]; fov: number; far?: number; }
const views: AuditView[] = [
  { name: '01-interior-oblicua', position: [-15, 57, 90], target: [-100, 29, -40], fov: 46 },
  { name: '02-desde-pista', position: [-38.161030874, 2.15, -152.188730873], target: [-100, 29, -40], fov: 46 },
  { name: '03-ubicacion-interior', position: [-70, 340, 435], target: [-100, 8, -40], fov: 56, far: 6000 },
  { name: '04-base-y-agua', position: [-68, 9, -13], target: [-100, 3.5, -40], fov: 52 },
  { name: '05-cabinas-detalle', position: [-74, 40, -12], target: [-78, 36, -37.2], fov: 45 },
  { name: '06-general-circuito', position: [0, 1400, 100], target: [0, 0, 0], fov: 57, far: 6500 },
];
const status = document.getElementById('audit-status')!;
const previousOnLoad = THREE.DefaultLoadingManager.onLoad;
let rerender = () => {};
THREE.DefaultLoadingManager.onLoad = () => {
  document.documentElement.dataset.auditAssetsLoaded = 'true';
  previousOnLoad?.();
  rerender();
};
// The fixture locks construction randomness so before/after scenery is comparable.
const random = Math.random;
let seed = 0x4e4f5249;
Math.random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
let engine: RacingGameEngine;
try { engine = new RacingGameEngine(document.getElementById('audit-scene')!, 'singapore_marina'); }
finally { Math.random = random; }
const loop = engine as unknown as { isRunning: boolean; animFrameId: number | null };
loop.isRunning = false;
if (loop.animFrameId !== null) cancelAnimationFrame(loop.animFrameId);
engine.isPaused = true;
engine.qualityManager.isAdaptivePacerActive = false;
engine.qualityManager.setPreset('high');
engine.renderer.setPixelRatio(1);
engine.renderer.info.autoReset = false;
const targetScratch = new THREE.Vector3(), sunOffset = new THREE.Vector3(-80, 63, -74);
const sun = engine.scene.children.find(o => o.userData.c3PrimarySun) as THREE.DirectionalLight | undefined;
const controllers = engine.track as unknown as { ferrisWheel?: SingaporeFerrisWheel; maritimeFleet?: { setTime(t: number): void } };
let lastView = views[0], lastShow = true, lastTime = 8;
function render(view = lastView, show = lastShow, time = lastTime) {
  lastView = view; lastShow = show; lastTime = time;
  const ferris = engine.track.group.getObjectByName('C3_FerrisWheel');
  if (ferris) ferris.visible = show;
  controllers.ferrisWheel?.setTime(time);
  controllers.maritimeFleet?.setTime(time);
  engine.camera.position.fromArray(view.position); engine.camera.fov = view.fov;
  engine.camera.near = 0.25; engine.camera.far = view.far ?? 2200;
  engine.camera.lookAt(...view.target); engine.camera.updateProjectionMatrix(); engine.camera.updateMatrixWorld(true);
  targetScratch.fromArray(view.target);
  if (sun) {
    sun.position.copy(targetScratch).add(sunOffset); sun.target.position.copy(targetScratch);
    sun.target.updateMatrixWorld(true); sun.updateMatrixWorld(true);
  }
  engine.track.updateNearbyShadowCasters?.(targetScratch, 150);
  const water = engine.track.group.children.find(o => (o as THREE.Mesh).material instanceof THREE.ShaderMaterial && ((o as THREE.Mesh).material as THREE.ShaderMaterial).uniforms?.time) as THREE.Mesh | undefined;
  if (water) { (water.material as THREE.ShaderMaterial).uniforms.time.value = time; water.userData.c3Frame = (water.userData.c3Frame ?? 0) + 10; }
  status.style.display = 'none'; engine.renderer.info.reset();
  engine.renderer.render(engine.scene, engine.camera);
  const metrics = {
    name: view.name, showFerris: show && !!ferris, time,
    camera: { position: view.position, target: view.target, fov: view.fov },
    viewport: engine.renderer.getSize(new THREE.Vector2()).toArray(), dpr: engine.renderer.getPixelRatio(),
    calls: engine.renderer.info.render.calls, triangles: engine.renderer.info.render.triangles,
    geometries: engine.renderer.info.memory.geometries, textures: engine.renderer.info.memory.textures,
    seaLevel: water?.position.y, placement: C3_FERRIS_WHEEL_PLACEMENT,
    layout: validateC3FerrisWheelPlacement(), ferris: controllers.ferrisWheel?.diagnostics ?? null,
  };
  document.documentElement.dataset.auditMetrics = JSON.stringify(metrics);
  return metrics;
}
const controls = document.createElement('div'); controls.id = 'audit-controls';
const select = document.createElement('select'); select.setAttribute('aria-label', 'Vista de inspección de la noria');
views.forEach((v, i) => select.add(new Option(v.name, String(i))));
const label = document.createElement('label'); label.textContent = 'Mostrar noria ';
const checkbox = document.createElement('input'); checkbox.type = 'checkbox'; checkbox.checked = true; checkbox.setAttribute('aria-label', 'Mostrar noria'); label.appendChild(checkbox);
const time = document.createElement('input'); time.type = 'number'; time.value = '8'; time.step = '1'; time.min = '0'; time.style.width = '60px'; time.setAttribute('aria-label', 'Tiempo fijo de animación');
const button = document.createElement('button'); button.textContent = 'Aplicar vista';
button.onclick = () => render(views[Number(select.value)], checkbox.checked, Number(time.value));
controls.append(select, label, time, button); document.body.appendChild(controls);
rerender = () => render();
render(); document.documentElement.dataset.auditReady = 'true';
(window as unknown as { ferrisWheelAudit: unknown }).ferrisWheelAudit = { engine, views, render };
if (import.meta.hot) import.meta.hot.dispose(() => {
  THREE.DefaultLoadingManager.onLoad = previousOnLoad;
  engine.dispose(); controls.remove();
});
