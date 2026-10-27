/** Shared visual contact calibration for the flat Circuit 3 racing surface. */
export const SINGAPORE_TRACK_SURFACE_Y = 0.02;

/**
 * The vehicle model's neutral tire contact patch is at world Y=0.01 when its
 * physics root is at Y=0.35. Keep that model calibration intact elsewhere;
 * C3 offsets the visual root to meet its asphalt plane exactly.
 */
export const DEFAULT_VEHICLE_CONTACT_Y = 0.01;

/** Small positive clearance keeps the transparent contact shadow above asphalt. */
export const C3_CONTACT_SHADOW_CLEARANCE = 0.004;

export function getCircuitVehicleVisualOffset(circuitId?: string): number {
  return circuitId === 'singapore_marina'
    ? SINGAPORE_TRACK_SURFACE_Y - DEFAULT_VEHICLE_CONTACT_Y
    : 0;
}

/** Returns the local Y for a shadow mesh parented under a vehicle root. */
export function getCircuitContactShadowLocalY(circuitId: string | undefined, vehicleWorldY: number): number {
  const shadowWorldY = circuitId === 'singapore_marina'
    ? SINGAPORE_TRACK_SURFACE_Y + C3_CONTACT_SHADOW_CLEARANCE
    : 0.008;
  return shadowWorldY - vehicleWorldY;
}
