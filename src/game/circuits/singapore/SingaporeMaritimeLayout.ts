import { SINGAPORE_WAYPOINTS } from './SingaporeWaypoints';

export type VesselKind = 'yacht' | 'rescue';
export interface MaritimePlacement {
  id: string;
  kind: VesselKind;
  x: number;
  z: number;
  yaw: number;
  routeFraction: number;
  outwardOffset: number;
  halfBeam: number;
  halfLength: number;
}
export interface XZ { x: number; z: number; }
type OrientedFootprint = Pick<MaritimePlacement, 'x' | 'z' | 'yaw' | 'halfBeam' | 'halfLength'>;

const route = SINGAPORE_WAYPOINTS;
const lengths = route.map((p, i) => Math.hypot(route[(i + 1) % route.length].x - p.x, route[(i + 1) % route.length].z - p.z));
const totalLength = lengths.reduce((a, b) => a + b, 0);
const signedArea = route.reduce((s, p, i) => s + p.x * route[(i + 1) % route.length].z - route[(i + 1) % route.length].x * p.z, 0);
export const YACHT_SCALE = 3;

/** Local -Z is the bow of BOTH supplied models; yaw therefore includes PI. */
export function placementAt(id: string, kind: VesselKind, fraction: number, offset: number, angle = 0): MaritimePlacement {
  let remaining = ((fraction % 1) + 1) % 1 * totalLength;
  let i = 0;
  while (i < lengths.length - 1 && remaining > lengths[i]) remaining -= lengths[i++];
  const a = route[i], b = route[(i + 1) % route.length];
  const t = remaining / lengths[i];
  const previous = route[(i + route.length - 1) % route.length], next = route[(i + 2) % route.length];
  let dx = next.x - previous.x, dz = next.z - previous.z;
  const length = Math.hypot(dx, dz); dx /= length; dz /= length;
  const sign = signedArea > 0 ? 1 : -1;
  return {
    id, kind,
    x: a.x + (b.x - a.x) * t + sign * dz * offset,
    z: a.z + (b.z - a.z) * t - sign * dx * offset,
    yaw: Math.atan2(dx, dz) + Math.PI + angle,
    routeFraction: fraction, outwardOffset: offset,
    // Conservative full-model dimensions, including brightwork / outboard.
    halfBeam: kind === 'yacht' ? 5.4 * YACHT_SCALE : 1.85,
    halfLength: kind === 'yacht' ? 22.8 * YACHT_SCALE : 4.7,
  };
}

export const MARITIME_PLACEMENTS: readonly MaritimePlacement[] = [
  { ...placementAt('Y01', 'yacht', 0.037, 36, 0.025), x: 727.95, z: -298.9 },
  { ...placementAt('Y02', 'yacht', 0.508, 52, -0.20), x: -755.89, z: 114.25 },
  placementAt('Y03', 'yacht', 0.835, 112, 0.35),
  placementAt('Y04', 'yacht', 0.320, 150, -0.28),
  ...([
    [0.002, 84, 0.15], [0.065, 28, -0.30], [0.130, 90, 0.38],
    [0.205, 30, 0.12], [0.265, 65, -0.28], [0.330, 38, 0.40],
    [0.395, 35, -0.24], [0.460, 28, 0.20], [0.525, 70, -0.16],
    [0.590, 34, 0.32], [0.655, 100, -0.35], [0.720, 40, 0.22],
    [0.785, 28, -0.20], [0.850, 64, 0.35], [0.925, 110, -0.30],
  ] as const).map(([fraction, offset, angle], i) => placementAt(`R${String(i + 1).padStart(2, '0')}`, 'rescue', fraction, offset, angle)),
];

export function isInsideTrackPolygon(p: XZ): boolean {
  let inside = false;
  for (let i = 0, j = route.length - 1; i < route.length; j = i++) {
    const a = route[i], b = route[j];
    if ((a.z > p.z) !== (b.z > p.z) && p.x < (b.x - a.x) * (p.z - a.z) / (b.z - a.z) + a.x) inside = !inside;
  }
  return inside;
}
export function footprint(p: OrientedFootprint): XZ[] {
  const c = Math.cos(p.yaw), s = Math.sin(p.yaw);
  return [[-p.halfBeam, -p.halfLength], [p.halfBeam, -p.halfLength], [p.halfBeam, p.halfLength], [-p.halfBeam, p.halfLength]].map(([x, z]) => ({ x: p.x + c * x + s * z, z: p.z - s * x + c * z }));
}
function pointSegmentDistance(p: XZ, a: XZ, b: XZ): number {
  const dx = b.x - a.x, dz = b.z - a.z;
  const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.z - a.z) * dz) / (dx * dx + dz * dz || 1)));
  return Math.hypot(p.x - a.x - dx * t, p.z - a.z - dz * t);
}
function cross(a: XZ, b: XZ, c: XZ): number { return (b.x - a.x) * (c.z - a.z) - (b.z - a.z) * (c.x - a.x); }
function segmentDistance(a: XZ, b: XZ, c: XZ, d: XZ): number {
  if (cross(a, b, c) * cross(a, b, d) <= 0 && cross(c, d, a) * cross(c, d, b) <= 0 && Math.max(Math.min(a.x, b.x), Math.min(c.x, d.x)) <= Math.min(Math.max(a.x, b.x), Math.max(c.x, d.x)) && Math.max(Math.min(a.z, b.z), Math.min(c.z, d.z)) <= Math.min(Math.max(a.z, b.z), Math.max(c.z, d.z))) return 0;
  return Math.min(pointSegmentDistance(a, c, d), pointSegmentDistance(b, c, d), pointSegmentDistance(c, a, b), pointSegmentDistance(d, a, b));
}

// Existing C3_PitPaddockMarineQuay: local X [-44,-7], Z [-145,145],
// at (687.89,-108.18), yaw -2.996. Only its exclusion footprint is read here.
const pitYaw = -2.996;
const pitQuay: OrientedFootprint = {
  x: 687.89 - 25.5 * Math.cos(pitYaw), z: -108.18 + 25.5 * Math.sin(pitYaw),
  yaw: pitYaw, halfBeam: 18.5, halfLength: 145,
};
const pitQuayCorners = footprint(pitQuay);
function containsPoint(rectangle: OrientedFootprint, point: XZ): boolean {
  const dx = point.x - rectangle.x, dz = point.z - rectangle.z;
  const c = Math.cos(rectangle.yaw), s = Math.sin(rectangle.yaw);
  return Math.abs(c * dx - s * dz) <= rectangle.halfBeam && Math.abs(s * dx + c * dz) <= rectangle.halfLength;
}
export function minimumPitQuayClearance(p: MaritimePlacement): number {
  const corners = footprint(p);
  if (corners.some(c => containsPoint(pitQuay, c)) || pitQuayCorners.some(c => containsPoint(p, c))) return 0;
  let minimum = Infinity;
  for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) minimum = Math.min(minimum, segmentDistance(corners[i], corners[(i + 1) % 4], pitQuayCorners[j], pitQuayCorners[(j + 1) % 4]));
  return minimum;
}
export function minimumTrackClearance(p: MaritimePlacement): number {
  const corners = footprint(p);
  let min = Infinity;
  for (let i = 0; i < route.length; i++) for (let j = 0; j < 4; j++) min = Math.min(min, segmentDistance(route[i], route[(i + 1) % route.length], corners[j], corners[(j + 1) % 4]));
  return min;
}
export function validateMaritimeLayout(placements: readonly MaritimePlacement[] = MARITIME_PLACEMENTS) {
  const problems: string[] = [];
  const ids = new Set<string>();
  const clearances = placements.map(p => {
    if (ids.has(p.id)) problems.push(`${p.id}: duplicate id`); ids.add(p.id);
    if (![p.x, p.z, p.yaw].every(Number.isFinite)) problems.push(`${p.id}: invalid pose`);
    if (isInsideTrackPolygon(p) || footprint(p).some(isInsideTrackPolygon)) problems.push(`${p.id}: inside track polygon`);
    const distance = minimumTrackClearance(p);
    // Roadbed is bounded by 12.5 m from the centreline; keep 10 m clear water.
    if (distance < 22.5) problems.push(`${p.id}: hull is only ${distance.toFixed(2)} m from centreline`);
    const pitDistance = minimumPitQuayClearance(p);
    if (pitDistance < 8) problems.push(`${p.id}: pit quay clearance is only ${pitDistance.toFixed(2)} m`);
    return { id: p.id, hullToCentreline: distance, clearWaterBeyondRoadbed: distance - 12.5, clearWaterBeyondPitQuay: pitDistance };
  });
  for (let i = 0; i < placements.length; i++) for (let j = i + 1; j < placements.length; j++) {
    const a = placements[i], b = placements[j];
    // Circumscribed radii are stricter than the oriented actual hulls.
    if (Math.hypot(a.x - b.x, a.z - b.z) < Math.hypot(a.halfBeam, a.halfLength) + Math.hypot(b.halfBeam, b.halfLength) + 8) problems.push(`${a.id}/${b.id}: insufficient vessel separation`);
  }
  return { valid: problems.length === 0, problems, clearances, yachts: placements.filter(p => p.kind === 'yacht').length, rescue: placements.filter(p => p.kind === 'rescue').length, routeLength: totalLength };
}
