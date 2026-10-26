import * as THREE from 'three';
import { RacingGameEngine } from '../game/RacingGameEngine';
import { MARITIME_PLACEMENTS, validateMaritimeLayout, placementAt, footprint, type MaritimePlacement } from '../game/circuits/singapore/SingaporeMaritimeLayout';
import { SINGAPORE_WAYPOINTS } from '../game/circuits/singapore/SingaporeWaypoints';

interface AuditView { name: string; position: [number, number, number]; target: [number, number, number]; fov?: number; far?: number; width?: number; height?: number; }
function shipView(p: MaritimePlacement, suffix: string, camera: [number, number, number], targetY = p.kind === 'yacht' ? 3.1 : 0.8, fov = 56): AuditView {
  const [x, y, z] = camera, c = Math.cos(p.yaw), s = Math.sin(p.yaw);
  return { name: `${p.id}-${suffix}`, position: [p.x + c * x + s * z, y, p.z - s * x + c * z], target: [p.x, targetY, p.z], fov };
}
const yachts = MARITIME_PLACEMENTS.filter(p => p.kind === 'yacht');
const ribs = MARITIME_PLACEMENTS.filter(p => p.kind === 'rescue');
const driver = placementAt('camera', 'rescue', 0.020, 0);
const mapPoints = [...SINGAPORE_WAYPOINTS, ...MARITIME_PLACEMENTS.flatMap(p => footprint(p))];
const minX = Math.min(...mapPoints.map(p => p.x)), maxX = Math.max(...mapPoints.map(p => p.x));
const minZ = Math.min(...mapPoints.map(p => p.z)), maxZ = Math.max(...mapPoints.map(p => p.z));
const cx = (minX + maxX) * 0.5, cz = (minZ + maxZ) * 0.5;
const overviewHeight = Math.max((maxX - minX + 110) / (1280 / 720), maxZ - minZ + 110) / (2 * Math.tan(THREE.MathUtils.degToRad(25))) * 1.07;
const litRib = ribs[4], sunAzimuth = THREE.MathUtils.degToRad(157), litX = Math.sin(sunAzimuth) * 11, litZ = Math.cos(sunAzimuth) * 11;
const litLocalX = Math.cos(litRib.yaw) * litX - Math.sin(litRib.yaw) * litZ;
const litLocalZ = Math.sin(litRib.yaw) * litX + Math.cos(litRib.yaw) * litZ;
const views: AuditView[] = [
  { name: '01-general-superior', position: [cx, overviewHeight, cz + 55], target: [cx, 0, cz], fov: 50, far: 6000 },
  { name: '02-general-oblicua-noroeste', position: [cx - 500, 900, cz - 500], target: [cx, 0, cz], fov: 57, far: 6000 },
  shipView(yachts[0], 'desde-pista', [-50, 8, 5]),
  shipView(yachts[0], 'proa', [30, 15, -43]),
  shipView(yachts[0], 'popa', [-29, 12, 42]),
  shipView(yachts[0], 'cubiertas-detalle', [17, 23, 18], 5.0, 61),
  shipView(yachts[1], 'costado-oeste', [33, 16, -43]),
  shipView(yachts[2], 'distancia-media-sur', [-110, 12, 12]),
  shipView(yachts[2], 'detalle-sur', [-34, 17, 40]),
  shipView(yachts[3], 'lejano-norte', [150, 13, 6]),
  shipView(yachts[3], 'detalle-norte', [32, 18, -43]),
  ...ribs.map(p => shipView(p, 'rescate-detalle', [8, 5.5, -11], 0.85, 53)),
  { name: '27-altura-conduccion-yate', position: [driver.x, 1.4, driver.z], target: [driver.x - Math.sin(driver.yaw) * 125, 1.6, driver.z - Math.cos(driver.yaw) * 125], fov: 56 },
  { ...shipView(yachts[0], 'movil-horizontal', [-48, 10, -22]), width: 844, height: 390 },
  { ...shipView(ribs[12], 'movil-vertical', [8, 7, -14], 0.8, 55), width: 390, height: 844 },
  shipView(ribs[0], 'extra-popa-fueraborda', [-8.5, 4.2, 7.5], 0.3, 55),
  shipView(litRib, 'extra-costado-iluminado', [litLocalX, 4.2, litLocalZ], 0.3, 55),
  shipView(ribs[7], 'extra-cubierta-equipamiento', [1.5, 11, -1.2], 0.3, 57),
  shipView(ribs[11], 'extra-proa-babor', [-7.8, 4.2, -9.5], 0.3, 55),
];
const status = document.getElementById('audit-status')!;
const engine = new RacingGameEngine(document.getElementById('audit-scene')!, 'singapore_marina');
const loop = engine as unknown as { isRunning: boolean; animFrameId: number | null };
loop.isRunning = false;
if (loop.animFrameId !== null) cancelAnimationFrame(loop.animFrameId);
engine.isPaused = true;
engine.qualityManager.isAdaptivePacerActive = false;
engine.qualityManager.setPreset('high');
engine.renderer.setPixelRatio(1);
engine.renderer.info.autoReset = false;
const targetScratch = new THREE.Vector3(), sunOffset = new THREE.Vector3(-80, 63, -74);
const sun = engine.scene.children.find(o => o.userData.c3PrimarySun) as THREE.DirectionalLight;
let lastView: AuditView = views[0];
function render(view: AuditView, boats = true, time = 8) {
  lastView = view;
  const fleet = engine.track.group.getObjectByName('C3_MaritimeFleet');
  if (fleet) fleet.visible = boats;
  const controller = (engine.track as unknown as { maritimeFleet?: { setTime(t: number): void } }).maritimeFleet;
  controller?.setTime(time);
  engine.camera.position.fromArray(view.position); engine.camera.fov = view.fov ?? 56;
  engine.camera.near = 0.25; engine.camera.far = view.far ?? 2200; engine.camera.lookAt(...view.target);
  engine.camera.updateProjectionMatrix(); engine.camera.updateMatrixWorld(true);
  targetScratch.fromArray(view.target);
  sun.position.copy(targetScratch).add(sunOffset); sun.target.position.copy(targetScratch);
  sun.target.updateMatrixWorld(true); sun.updateMatrixWorld(true);
  engine.track.updateNearbyShadowCasters?.(targetScratch, 150);
  const water = engine.track.group.children.find(o => (o as THREE.Mesh).material instanceof THREE.ShaderMaterial && ((o as THREE.Mesh).material as THREE.ShaderMaterial).uniforms?.time) as THREE.Mesh;
  if (water) {
    const material = water.material as THREE.ShaderMaterial;
    material.uniforms.time.value = time;
    water.userData.c3Frame = (water.userData.c3Frame ?? 0) + 10;
  }
  status.style.display = 'none'; engine.renderer.info.reset();
  engine.renderer.render(engine.scene, engine.camera);
  const metrics = { name: view.name, boats, time, size: engine.renderer.getSize(new THREE.Vector2()).toArray(), dpr: engine.renderer.getPixelRatio(), calls: engine.renderer.info.render.calls, triangles: engine.renderer.info.render.triangles, geometries: engine.renderer.info.memory.geometries, textures: engine.renderer.info.memory.textures };
  document.documentElement.dataset.auditMetrics = JSON.stringify(metrics);
  return metrics;
}
const api = {
  ready: true, engine, views, placements: MARITIME_PLACEMENTS, layout: validateMaritimeLayout(), render,
  resize(width: number, height: number) { engine.renderer.setPixelRatio(1); engine.renderer.setSize(width, height, false); engine.camera.aspect = width / height; engine.camera.updateProjectionMatrix(); },
  renderLast(boats = true, time = 8) { return render(lastView, boats, time); },
  dataURL() { engine.renderer.render(engine.scene, engine.camera); return engine.renderer.domElement.toDataURL('image/png'); },
};
(window as unknown as { maritimeAudit: typeof api }).maritimeAudit = api;
// Development-only DOM controls also work with isolated-world browser tooling.
const controls = document.createElement('div'); controls.id = 'audit-controls';
controls.style.cssText = 'position:fixed;left:10px;top:10px;padding:10px;background:#071422e8;color:white;font:12px system-ui;z-index:9;display:flex;gap:8px';
const select = document.createElement('select'); select.setAttribute('aria-label', 'Vista de inspección');
views.forEach((view, i) => select.add(new Option(view.name, String(i))));
const label = document.createElement('label'); label.textContent = 'Mostrar embarcaciones ';
const checkbox = document.createElement('input'); checkbox.type = 'checkbox'; checkbox.setAttribute('aria-label', 'Mostrar embarcaciones'); label.appendChild(checkbox);
const button = document.createElement('button'); button.textContent = 'Aplicar vista';
button.onclick = () => render(views[Number(select.value)], checkbox.checked);
controls.append(select, label, button); document.body.appendChild(controls);
render(views[0], false); document.documentElement.dataset.auditReady = 'true';
