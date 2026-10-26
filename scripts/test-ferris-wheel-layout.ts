import assert from 'node:assert/strict';
import { C3_FERRIS_WHEEL_PLACEMENT, C3_FERRIS_WHEEL_SCALE, validateC3FerrisWheelPlacement } from '../src/game/circuits/singapore/SingaporeFerrisWheelLayout.ts';
import { MARITIME_PLACEMENTS } from '../src/game/circuits/singapore/SingaporeMaritimeLayout.ts';
import { SINGAPORE_WAYPOINTS } from '../src/game/circuits/singapore/SingaporeWaypoints.ts';

const placement = C3_FERRIS_WHEEL_PLACEMENT;
const result = validateC3FerrisWheelPlacement();
assert.equal(Object.isFrozen(placement), true, 'canonical placement is immutable');
assert.equal(C3_FERRIS_WHEEL_SCALE, 2);
assert.deepEqual([placement.x, placement.z, placement.yaw], [-100, -40, 0], 'the wheel keeps its original location and heading');
assert.equal(placement.safetyRadius, 66, 'the collision envelope doubles with the wheel');
assert.equal(result.valid, true, result.problems.join('; '));
assert.equal(result.insideTrack, true, 'the full 66 m envelope lies in the infield');
assert.ok(result.centrelineDistance > 128 && result.centrelineDistance < 129);
assert.ok(result.clearWaterBeyondRoadbed > 49, 'at least 49 m water remains beyond the existing roadbed');
assert.ok(result.minimumVesselGap > 130, 'conservative wheel/boat envelopes remain separated');
assert.equal(result.nearestVessel, 'R12');
assert.ok(placement.baseHeightAboveSea > 0.306 + 0.6, 'rigid platform clears the shader crest bound with margin');

for (const bad of [NaN, Infinity, -Infinity]) {
  assert.equal(validateC3FerrisWheelPlacement({ ...placement, x: bad }).valid, false);
  assert.equal(validateC3FerrisWheelPlacement({ ...placement, z: bad }).valid, false);
  assert.equal(validateC3FerrisWheelPlacement({ ...placement, yaw: bad }).valid, false);
}
assert.equal(validateC3FerrisWheelPlacement({ ...placement, safetyRadius: 0 }).valid, false);
assert.equal(validateC3FerrisWheelPlacement({ ...placement, baseHeightAboveSea: 0.2 }).valid, false);
assert.equal(validateC3FerrisWheelPlacement({ ...placement, x: 2000, z: 2000 }).valid, false, 'open sea outside the route is not the requested location');
const onTrack = validateC3FerrisWheelPlacement({ ...placement, x: SINGAPORE_WAYPOINTS[0].x, z: SINGAPORE_WAYPOINTS[0].z });
assert.equal(onTrack.valid, false);
assert.ok(onTrack.problems.some(p => p.includes('roadbed')));
const intruding = { ...MARITIME_PLACEMENTS[0], x: placement.x + 30, z: placement.z };
const vesselOverlap = validateC3FerrisWheelPlacement(placement, [intruding]);
assert.equal(vesselOverlap.valid, false);
assert.ok(vesselOverlap.problems.some(p => p.includes('fleet')));
const emptyFleet = validateC3FerrisWheelPlacement(placement, []);
assert.equal(emptyFleet.valid, true);
assert.equal(emptyFleet.nearestVessel, null);
assert.equal(emptyFleet.minimumVesselGap, Infinity);
console.log('PASS: ferris-wheel infield envelope, roadbed/fleet margins, deck clearance, invalid input, outside/track placements and overlap rejection.');
console.log(JSON.stringify(result, null, 2));
