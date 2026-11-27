// Boot and the one loop: input is read every frame, the world advances in fixed 1/60 s
// steps (several in a slow frame, none in a fast one), and the renderer paints what is
// there. The game moves between four screens: title, play, paused and game over. On the
// title the plane flies itself, so the backdrop is the game running.
//
// ?seed=N fixes the terrain and clouds. ?shot=cover|play|landing|end (with &seed=N) stages
// that scene instead of running the loop, paints it twice and sets window.__shotReady.
import { BEST_KEY, STEP } from './config.js';
import { createTerrain } from './terrain.js';
import { createFlight } from './flight.js';
import { createMission, EVENT_CRASHED, EVENT_LANDED, EVENT_RING } from './mission.js';
import { ACTION_CONFIRM, ACTION_PAUSE, createInput } from './input.js';
import { createRenderer, SCREEN_OVER, SCREEN_PAUSED, SCREEN_PLAY, SCREEN_TITLE } from './render.js';
import { autopilot, stageShot } from './shots.js';

/** The longest frame the loop catches up on; a longer stall (a hidden tab) is dropped. */
const MAX_FRAME = 0.25;

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : Math.floor(Math.random() * 4294967296);

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const terrain = createTerrain(seed);
const flight = createFlight();
const mission = createMission(terrain);
const renderer = createRenderer(canvas, terrain);

const world = { plane: flight.state, mission, notice: null };
let noticeUntil = 0;
let allClearShown = false;

function readBest() {
  try {
    return Number.parseInt(window.localStorage.getItem(BEST_KEY) ?? '0', 10) || 0;
  } catch {
    return 0;
  }
}

function saveBest(value) {
  try {
    window.localStorage.setItem(BEST_KEY, String(value));
  } catch {
    // Storage can be off (private windows): the best score then lasts this visit only.
  }
}

function runShot(name) {
  const scene = stageShot(name, flight, mission);
  let painted = 0;
  function paint() {
    renderer.draw(world, scene.screen, scene.best, performance.now());
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

function runGame() {
  const input = createInput(canvas);
  let screen = SCREEN_TITLE;
  let best = readBest();
  let accumulator = 0;
  let last = performance.now();

  function announce(message) {
    status.textContent = message;
  }

  function startGame() {
    flight.reset();
    mission.reset(flight.state.z);
    input.resetThrottle();
    world.notice = null;
    allClearShown = false;
    accumulator = 0;
    screen = SCREEN_PLAY;
    announce('Flying. Six rings, then land on the Merapi strip.');
  }

  function endGame() {
    screen = SCREEN_OVER;
    if (mission.state.score > best) {
      best = mission.state.score;
      saveBest(best);
    }
    const m = mission.state;
    announce(m.status === 'landed'
      ? `Landed. Score ${m.score}. Best ${best}.`
      : `Crashed: ${m.reason}. Score ${m.score}. Best ${best}.`);
  }

  function showNotice(text, ms) {
    world.notice = { text };
    noticeUntil = performance.now() + ms;
  }

  function handleActions() {
    const actions = input.takeActions();
    if (actions & ACTION_CONFIRM && (screen === SCREEN_TITLE || screen === SCREEN_OVER)) startGame();
    else if (actions & ACTION_PAUSE && screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      announce('Paused.');
    } else if (actions & (ACTION_PAUSE | ACTION_CONFIRM) && screen === SCREEN_PAUSED) {
      screen = SCREEN_PLAY;
      announce('Flying.');
    }
  }

  function step() {
    if (screen === SCREEN_TITLE) {
      // The backdrop flies itself; if the sortie ends up there, restart it.
      flight.step(STEP, autopilot(flight.state, mission));
      mission.step(flight.state);
      if (mission.state.status !== 'flying') {
        flight.reset();
        mission.reset(flight.state.z);
      }
      return;
    }
    const controls = input.controls(STEP);
    flight.step(STEP, controls);
    const events = mission.step(flight.state);
    if (events & EVENT_RING) {
      showNotice(`Ring ${mission.state.ringsPassed} of 6 clear! +100`, 2200);
      announce(`Ring ${mission.state.ringsPassed} of 6.`);
    }
    if (mission.state.ringIndex === 6 && mission.state.ringsPassed > 0 && !allClearShown) {
      allClearShown = true;
      showNotice('All rings clear — line up for the Merapi strip', 2600);
    }
    if (events & (EVENT_LANDED | EVENT_CRASHED)) endGame();
  }

  function frame(now) {
    requestAnimationFrame(frame);
    accumulator += Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    handleActions();
    if (world.notice && now > noticeUntil) world.notice = null;
    if (screen === SCREEN_TITLE || screen === SCREEN_PLAY) {
      while (accumulator >= STEP && (screen === SCREEN_TITLE || screen === SCREEN_PLAY)) {
        step();
        accumulator -= STEP;
      }
    } else {
      accumulator = 0;
    }
    renderer.draw(world, screen, best, now);
  }

  // Leaving the tab pauses a running game rather than letting it fly on unseen.
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      announce('Paused.');
    }
  });

  announce('Kancil Air. Press Space or click to start.');
  requestAnimationFrame(frame);
}

if (shot) runShot(shot);
else runGame();
