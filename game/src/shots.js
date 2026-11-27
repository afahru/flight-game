// The screenshot scenes behind ?shot=cover|play|landing|end. Each one flies the real
// rules forward from a fresh world with a simple autopilot (steer at the next ring, hold
// a speed, flare onto the strip), so the frame is what a real sortie looks like and the
// same seed always gives the same frame.
import { PLANE, STEP } from './config.js';
import { SCREEN_OVER, SCREEN_PLAY, SCREEN_TITLE } from './render.js';

function wrapAngle(a) {
  while (a > Math.PI) a -= Math.PI * 2;
  while (a < -Math.PI) a += Math.PI * 2;
  return a;
}

function clamp(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v;
}

/** Steer at a point (tx, ty, tz) holding a speed: bank for the heading, pitch for the climb. */
function pilotTo(plane, tx, ty, tz, speedTarget) {
  const desiredHeading = Math.atan2(tx - plane.x, tz - plane.z);
  const headingError = wrapAngle(desiredHeading - plane.heading);
  const bank = clamp(headingError * 2.5, -1, 1);
  const desiredVs = clamp((ty - plane.y) / 6, -9, 5);
  const desiredPitch = Math.asin(clamp(desiredVs / Math.max(20, plane.speed), -0.5, 0.5));
  const pitch = clamp(desiredPitch / PLANE.maxPitch, -1, 1);
  let throttle = 0.65;
  if (plane.speed < speedTarget - 4) throttle = 0.9;
  else if (plane.speed > speedTarget + 4) throttle = 0.4;
  return { bank, pitch, throttle };
}

/** The autopilot's controls for this step: rings first, then the strip. */
export function autopilot(plane, mission) {
  if (mission.state.status !== 'flying') return { bank: 0, pitch: 0, throttle: 0 };
  const ring = mission.nextRing();
  if (ring) return pilotTo(plane, ring.x, ring.y, ring.z, 48);
  // All rings clear: fly the centreline down. Hold the strip's heading, steer back to
  // x = 0, and sink gently to the ground. This is a heading hold, not a point to chase,
  // so there is nothing to overshoot and turn back for.
  const desiredHeading = clamp(-plane.x * 0.002, -0.3, 0.3);
  const headingError = wrapAngle(desiredHeading - plane.heading);
  const bank = clamp(headingError * 2.5, -1, 1);
  // A firm descent, then a short flare: a sink that shrinks with height floats past
  // the strip, so the last metres come down at a steady -1.5 m/s instead.
  const desiredVs = plane.y > 8 ? -6 : -1.5;
  const desiredPitch = Math.asin(clamp(desiredVs / Math.max(20, plane.speed), -0.5, 0.5));
  const pitch = clamp(desiredPitch / PLANE.maxPitch, -1, 1);
  let throttle = 0.35;
  if (plane.speed < 26) throttle = 0.8;
  else if (plane.speed > 34) throttle = 0.15;
  return { bank, pitch, throttle };
}

function simulate(flight, mission, seconds, until) {
  const limit = Math.floor(seconds / STEP);
  for (let i = 0; i < limit; i += 1) {
    flight.step(STEP, autopilot(flight.state, mission));
    mission.step(flight.state);
    if (until && until(flight.state, mission.state)) break;
  }
}

/**
 * Set the world to the named scene and return the screen to draw over it and the best
 * score to show. cover: ring three ahead. play: mid-route, banking. landing: on final.
 * end: the sortie over (landed or crashed). Any other name is the title backdrop.
 */
export function stageShot(name, flight, mission) {
  flight.reset();
  mission.reset(flight.state.z);
  if (name === 'cover') {
    simulate(flight, mission, 60, (p) => p.z >= 2250);
    return { screen: SCREEN_PLAY, best: mission.state.score };
  }
  if (name === 'play') {
    simulate(flight, mission, 90, (p) => p.z >= 4100);
    return { screen: SCREEN_PLAY, best: mission.state.score };
  }
  if (name === 'landing') {
    simulate(flight, mission, 150, (p) => p.z >= 5600 && p.y < 120);
    return { screen: SCREEN_PLAY, best: mission.state.score };
  }
  if (name === 'end') {
    simulate(flight, mission, 300, (p, m) => m.status !== 'flying');
    return { screen: SCREEN_OVER, best: mission.state.score };
  }
  simulate(flight, mission, 5, null);
  return { screen: SCREEN_TITLE, best: 0 };
}
