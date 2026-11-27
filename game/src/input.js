// Keyboard and pointer input. Arrows (or A D) steer, W and S work the throttle, the
// mouse steers while it is moving, and one-shot presses (start, pause) are queued as bit
// flags and taken once by the loop, so a press between two frames is never lost.

export const ACTION_CONFIRM = 1;
export const ACTION_PAUSE = 2;

const LEFT = new Set(['ArrowLeft', 'KeyA']);
const RIGHT = new Set(['ArrowRight', 'KeyD']);
const CLIMB = new Set(['ArrowUp']);
const DESCEND = new Set(['ArrowDown']);
const THROTTLE_UP = new Set(['KeyW']);
const THROTTLE_DOWN = new Set(['KeyS']);
const CONFIRM = new Set(['Space', 'Enter']);
const PAUSE = new Set(['KeyP', 'Escape']);

export function createInput(canvas) {
  let left = false;
  let right = false;
  let climb = false;
  let descend = false;
  let throttleUp = false;
  let throttleDown = false;
  let actions = 0;
  // Throttle the pilot sets by holding W or S; it moves on its own, not per frame.
  let throttle = 0;
  // Mouse steering: the pointer's offset from the middle, -1..1 each way.
  let mouseBank = 0;
  let mousePitch = 0;
  let mouseActive = false;
  let mouseTimer = 0;

  function keyDown(event) {
    if (LEFT.has(event.code)) left = true;
    else if (RIGHT.has(event.code)) right = true;
    else if (CLIMB.has(event.code)) climb = true;
    else if (DESCEND.has(event.code)) descend = true;
    else if (THROTTLE_UP.has(event.code)) throttleUp = true;
    else if (THROTTLE_DOWN.has(event.code)) throttleDown = true;
    else if (CONFIRM.has(event.code)) {
      if (!event.repeat) actions |= ACTION_CONFIRM;
    } else if (PAUSE.has(event.code)) {
      if (!event.repeat) actions |= ACTION_PAUSE;
    } else return;
    event.preventDefault();
  }
  function keyUp(event) {
    if (LEFT.has(event.code)) left = false;
    else if (RIGHT.has(event.code)) right = false;
    else if (CLIMB.has(event.code)) climb = false;
    else if (DESCEND.has(event.code)) descend = false;
    else if (THROTTLE_UP.has(event.code)) throttleUp = false;
    else if (THROTTLE_DOWN.has(event.code)) throttleDown = false;
  }

  window.addEventListener('keydown', keyDown);
  window.addEventListener('keyup', keyUp);
  window.addEventListener('blur', () => {
    left = right = climb = descend = throttleUp = throttleDown = false;
  });

  canvas.addEventListener('pointermove', (event) => {
    const rect = canvas.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    mouseBank = Math.max(-1, Math.min(1, (event.clientX - cx) / 320));
    mousePitch = Math.max(-1, Math.min(1, (cy - event.clientY) / 220));
    mouseActive = true;
    mouseTimer = 1.5;
  });
  canvas.addEventListener('pointerdown', () => {
    actions |= ACTION_CONFIRM;
  });

  return {
    /**
     * The controls for this step: bank and pitch -1..1, throttle 0..1. The mouse steers
     * while it has moved lately; otherwise the keys do.
     */
    controls(dt) {
      if (throttleUp) throttle = Math.min(1, throttle + dt * 0.7);
      if (throttleDown) throttle = Math.max(0, throttle - dt * 0.7);
      if (mouseTimer > 0) mouseTimer -= dt;
      else mouseActive = false;
      if (mouseActive) return { bank: mouseBank, pitch: mousePitch, throttle };
      const bank = (right ? 1 : 0) - (left ? 1 : 0);
      const pitch = (climb ? 1 : 0) - (descend ? 1 : 0);
      return { bank, pitch, throttle };
    },
    /** The one-shot presses since the last call, as ACTION_* flags. */
    takeActions() {
      const taken = actions;
      actions = 0;
      return taken;
    },
    /** The throttle lever, for the HUD. */
    throttle() {
      return throttle;
    },
    /** Reset the lever when a new sortie starts. */
    resetThrottle() {
      throttle = 0;
    },
  };
}
