import { SINGAPORE_WAYPOINTS } from './SingaporeWaypoints';
import { MARITIME_PLACEMENTS, isInsideTrackPolygon, type MaritimePlacement } from './SingaporeMaritimeLayout';

export const C3_FERRIS_WHEEL_SCALE = 2;

export interface FerrisWheelPlacement {
  x: number;
  z: number;
  yaw: number;
  baseHeightAboveSea: number;
  /** Conservative horizontal envelope, including every moving cabin. */
  safetyRadius: number;
}

/** Rigid marine landmark, inside the route; it does not follow waves or add physics bodies. */
export const C3_FERRIS_WHEEL_PLACEMENT: Readonly<FerrisWheelPlacement> = Object.freeze({
  x: -100,
  z: -40,
  yaw: 0,
  baseHeightAboveSea: 1.25,
  safetyRadius: 33 * C3_FERRIS_WHEEL_SCALE,
});

function distanceToTrack(x: number, z: number): number {
  let minimum = Infinity;
  for (let i = 0; i < SINGAPORE_WAYPOINTS.length; i++) {
    const a = SINGAPORE_WAYPOINTS[i];
    const b = SINGAPORE_WAYPOINTS[(i + 1) % SINGAPORE_WAYPOINTS.length];
    const dx = b.x - a.x, dz = b.z - a.z;
    const t = Math.max(0, Math.min(1, ((x - a.x) * dx + (z - a.z) * dz) / (dx * dx + dz * dz || 1)));
    minimum = Math.min(minimum, Math.hypot(x - a.x - dx * t, z - a.z - dz * t));
  }
  return minimum;
}

export function validateC3FerrisWheelPlacement(
  placement: Readonly<FerrisWheelPlacement> = C3_FERRIS_WHEEL_PLACEMENT,
  vessels: readonly MaritimePlacement[] = MARITIME_PLACEMENTS,
) {
  const problems: string[] = [];
  const finite = Object.values(placement).every(Number.isFinite);
  if (!finite || placement.safetyRadius <= 0 || placement.baseHeightAboveSea < 0.6) {
    return { valid: false, problems: ['Invalid ferris-wheel placement or marine deck height'], insideTrack: false, centrelineDistance: 0, clearWaterBeyondRoadbed: 0, minimumVesselGap: 0, nearestVessel: null as string | null };
  }
  // A circular envelope is deliberately stricter than the wheel's real X/Z footprint.
  const insideTrack = isInsideTrackPolygon(placement) && Array.from({ length: 64 }, (_, i) => {
    const angle = i * Math.PI * 2 / 64;
    return isInsideTrackPolygon({ x: placement.x + Math.cos(angle) * placement.safetyRadius, z: placement.z + Math.sin(angle) * placement.safetyRadius });
  }).every(Boolean);
  if (!insideTrack) problems.push('The complete ferris-wheel envelope must remain inside the track polygon');
  const centrelineDistance = distanceToTrack(placement.x, placement.z);
  // Roadbed is bounded by 12.5 m from the centreline in the existing circuit.
  const clearWaterBeyondRoadbed = centrelineDistance - placement.safetyRadius - 12.5;
  if (clearWaterBeyondRoadbed < 10) problems.push('Insufficient clear water between the ferris wheel and the roadbed');
  let minimumVesselGap = Infinity, nearestVessel: string | null = null;
  for (const vessel of vessels) {
    const gap = Math.hypot(vessel.x - placement.x, vessel.z - placement.z) - placement.safetyRadius - Math.hypot(vessel.halfBeam, vessel.halfLength);
    if (gap < minimumVesselGap) { minimumVesselGap = gap; nearestVessel = vessel.id; }
  }
  if (minimumVesselGap < 8) problems.push('Insufficient separation from the existing maritime fleet');
  return { valid: problems.length === 0, problems, insideTrack, centrelineDistance, clearWaterBeyondRoadbed, minimumVesselGap, nearestVessel };
}
