// The flight model, with no drawing and no browser in it: throttle, speed, bank, pitch,
// turn, stall, fuel and the ground roll. step() advances one fixed step from a control
// object { bank, pitch, throttle } (each -1..1, throttle 0..1) and reports what happened.
import { FUEL, PLANE, START, STEP } from './config.js';

export function createFlight() {
  const state = {
    x: START.x,
    y: START.y,
    z: START.z,
    heading: START.heading,
    pitch: 0,
    roll: 0,
    speed: START.speed,
    throttle: START.throttle,
    fuel: START.fuel,
    verticalSpeed: 0,
    stalled: false,
    engineOut: false,
    onGround: START.y <= 0,
  };

  function reset() {
    state.x = START.x;
    state.y = START.y;
    state.z = START.z;
    state.heading = START.heading;
    state.pitch = 0;
    state.roll = 0;
    state.speed = START.speed;
    state.throttle = START.throttle;
    state.fuel = START.fuel;
    state.verticalSpeed = 0;
    state.stalled = false;
    state.engineOut = false;
    state.onGround = START.y <= 0;
  }

  function moveToward(value, target, rate, dt) {
    if (value < target) return Math.min(target, value + rate * dt);
    return Math.max(target, value - rate * dt);
  }

  /** One fixed step. Returns nothing; read the state. */
  function step(dt, controls) {
    const wantThrottle = state.engineOut ? 0 : Math.max(0, Math.min(1, controls.throttle));
    state.throttle = moveToward(state.throttle, wantThrottle, 0.8, dt);

    const wantRoll = Math.max(-1, Math.min(1, controls.bank)) * PLANE.maxBank;
    const wantPitch = Math.max(-1, Math.min(1, controls.pitch)) * PLANE.maxPitch;
    state.roll = moveToward(state.roll, wantRoll, PLANE.bankRate, dt);
    // On the ground the nose stays down until rotation speed.
    if (state.onGround && state.speed < PLANE.stallSpeed) state.pitch = 0;
    else state.pitch = moveToward(state.pitch, wantPitch, PLANE.pitchRate, dt);

    // Speed chases the throttle, climbs bleed it, descents feed it, turns scrub it.
    const target = PLANE.minSpeed + state.throttle * (PLANE.maxSpeed - PLANE.minSpeed);
    state.speed += (target - state.speed) * (1 - Math.exp(-PLANE.speedResponse * dt));
    state.speed -= Math.sin(state.pitch) * 9.8 * 0.55 * dt;

    // A coordinated turn: bank sets the heading rate.
    const turnRate = (9.8 * Math.tan(state.roll) / Math.max(10, state.speed)) * PLANE.turnGain;
    if (!state.onGround) state.heading += turnRate * dt;
    state.speed -= Math.abs(turnRate) * state.speed * 0.06 * dt;
    if (state.speed < 0) state.speed = 0;

    state.stalled = !state.onGround && state.speed < PLANE.stallSpeed;
    if (state.stalled) state.pitch = Math.max(state.pitch - 0.6 * dt, -0.3);

    const sink = state.stalled ? -7 : 0;
    state.verticalSpeed = state.speed * Math.sin(state.pitch) + sink;
    if (state.onGround && state.speed < PLANE.stallSpeed) state.verticalSpeed = 0;

    state.x += state.speed * Math.cos(state.pitch) * Math.sin(state.heading) * dt;
    state.z += state.speed * Math.cos(state.pitch) * Math.cos(state.heading) * dt;
    state.y += state.verticalSpeed * dt;
    if (state.y <= 0) {
      state.y = 0;
      state.onGround = true;
      state.verticalSpeed = 0;
    } else {
      state.onGround = false;
    }

    state.fuel -= (FUEL.base + state.throttle * FUEL.perThrottle) * dt;
    if (state.fuel <= 0) {
      state.fuel = 0;
      state.engineOut = true;
    }
  }

  reset();
  return { state, reset, step };
}

// Re-exported so the mission and the autopilot share the step size.
export { STEP };
