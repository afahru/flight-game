// The mission: six rings in order, then a landing on the Merapi strip. It watches the
// plane each step, hands out ring points, and decides whether a touchdown is a landing
// or a crash. No drawing and no browser in it.
import { FUEL, RINGS, RUNWAY, SCORE } from './config.js';

export const EVENT_RING = 1;
export const EVENT_LANDED = 2;
export const EVENT_CRASHED = 4;

export function createMission(terrain) {
  const state = {
    ringIndex: 0,
    ringsPassed: 0,
    ringsMissed: 0,
    score: 0,
    status: 'flying',
    reason: '',
    landBonus: 0,
  };
  let prevZ = 0;
  let prevVerticalSpeed = 0;
  let wasAirborne = false;

  function reset(startZ) {
    state.ringIndex = 0;
    state.ringsPassed = 0;
    state.ringsMissed = 0;
    state.score = 0;
    state.status = 'flying';
    state.reason = '';
    state.landBonus = 0;
    prevZ = startZ;
    prevVerticalSpeed = 0;
    wasAirborne = false;
  }

  function nextRing() {
    return state.ringIndex < RINGS.length ? RINGS[state.ringIndex] : null;
  }

  function land(plane) {
    const vs = prevVerticalSpeed;
    const headingOff = Math.abs(plane.heading - RUNWAY.heading);
    const inStrip = plane.x >= RUNWAY.x && plane.x <= RUNWAY.x + RUNWAY.width
      && plane.z >= RUNWAY.z0 && plane.z <= RUNWAY.z1;
    if (!inStrip) return { ok: false, reason: 'down in the fields, off the strip' };
    if (plane.speed > 48) return { ok: false, reason: 'too fast for the strip' };
    if (plane.speed < 18) return { ok: false, reason: 'stalled onto the strip' };
    if (vs < -4.5) return { ok: false, reason: 'came down too hard' };
    if (headingOff > 0.3) return { ok: false, reason: 'landed sideways across the strip' };
    return { ok: true, reason: '' };
  }

  /** One step. Returns EVENT_* flags. `plane` is the flight state. */
  function step(plane) {
    if (state.status !== 'flying') return 0;
    let events = 0;

    // Rings: the plane crosses a ring's height when its z passes the ring's z.
    const ring = nextRing();
    if (ring && prevZ < ring.z && plane.z >= ring.z) {
      const dx = plane.x - ring.x;
      const dy = plane.y - ring.y;
      if (Math.sqrt(dx * dx + dy * dy) < ring.r) {
        state.ringsPassed += 1;
        state.score += SCORE.ring;
        plane.fuel = Math.min(100, plane.fuel + FUEL.ringBonus);
        events |= EVENT_RING;
      } else {
        state.ringsMissed += 1;
      }
      state.ringIndex += 1;
    }

    const ground = terrain.heightAt(plane.x, plane.z);
    const touching = plane.onGround;

    if (touching && wasAirborne) {
      // A touchdown: judge it.
      const result = land(plane);
      if (result.ok) {
        state.status = 'landed';
        state.landBonus = SCORE.land + Math.round(plane.fuel * SCORE.fuelPerUnit);
        state.score += state.landBonus;
        events |= EVENT_LANDED;
      } else {
        state.status = 'crashed';
        state.reason = result.reason;
        events |= EVENT_CRASHED;
      }
    } else if (touching && plane.speed > 5 && ground > 1) {
      // Rolled off the strip into rising ground.
      state.status = 'crashed';
      state.reason = 'ran off into the hills';
      events |= EVENT_CRASHED;
    } else if (!touching && plane.y <= ground) {
      // Flew into the hillside.
      state.status = 'crashed';
      state.reason = 'flew into the hillside';
      events |= EVENT_CRASHED;
    } else if (touching && plane.engineOut && plane.speed < 2 && plane.y === 0) {
      // Glided to a stop with no engine and no runway under it.
      state.status = 'crashed';
      state.reason = 'ran out of fuel';
      events |= EVENT_CRASHED;
    }

    prevZ = plane.z;
    prevVerticalSpeed = plane.verticalSpeed;
    wasAirborne = !plane.onGround;
    return events;
  }

  reset(0);
  return { state, reset, step, nextRing };
}
