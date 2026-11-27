// Every tuning number, colour and mission fact in one place. The playfield is a fixed
// 1280x800 logical area; the renderer scales it to the window, so no rule below depends on
// the screen size. Kancil Air is a little mail plane flying the island route: six rings,
// then a landing on the Merapi strip.

export const FIELD = { width: 1280, height: 800 };

/** The simulation's fixed step, in seconds: 60 updates a second whatever the display's rate. */
export const STEP = 1 / 60;

/** Metres per second. Displayed as km/h (times 3.6). */
export const PLANE = {
  /** Below this the wing stops flying and the nose drops. */
  stallSpeed: 26,
  /** Fastest the engine can push, at full throttle, level. */
  maxSpeed: 75,
  /** Slowest it settles to at idle throttle, level. */
  minSpeed: 15,
  /** How fast speed chases the throttle's target, per second. */
  speedResponse: 0.55,
  /** Hardest bank, radians; hardest pitch, radians. */
  maxBank: 0.62,
  maxPitch: 0.34,
  /** How fast bank and pitch move toward where the pilot asks, per second. */
  bankRate: 2.4,
  pitchRate: 1.6,
  /** Turn rate multiplier on the coordinated-turn rate. */
  turnGain: 1.7,
};

export const FUEL = {
  start: 100,
  /** Units a second: a base burn plus a share of the throttle. */
  base: 0.12,
  perThrottle: 0.65,
  /** Units back for flying clean through a ring. */
  ringBonus: 3,
};

/** The route: six rings, then the strip. Ring heights are metres above sea level. */
export const RINGS = [
  { x: 0, y: 320, z: 900, r: 46 },
  { x: -180, y: 300, z: 1800, r: 46 },
  { x: 180, y: 340, z: 2700, r: 46 },
  { x: -120, y: 300, z: 3600, r: 46 },
  { x: 220, y: 220, z: 4500, r: 46 },
  { x: 0, y: 120, z: 5400, r: 46 },
];

/** The Merapi strip: flat ground, heading north, threshold at z 6100. */
export const RUNWAY = { x: -35, width: 70, z0: 6100, z1: 6550, heading: 0 };

/** Where the plane starts: already airborne over the south end, heading north. */
export const START = { x: 0, y: 320, z: 0, heading: 0, speed: 50, throttle: 0.7, fuel: FUEL.start };

export const SCORE = { ring: 100, land: 500, fuelPerUnit: 5 };

export const PALETTE = {
  skyTop: '#2e6da8',
  skyMid: '#7fb2d9',
  horizon: '#f7dcae',
  sun: '#ffd76a',
  sunGlow: '#ffe9a8',
  groundNear: '#5d8a44',
  groundFar: '#7ba05b',
  fieldA: '#6d9c4a',
  fieldB: '#8fae5a',
  volcano: '#6b5570',
  volcanoSnow: '#f2f5f7',
  ridge: '#5a6b8a',
  cloud: '#ffffff',
  runway: '#3a3f46',
  runwayLine: '#f2f2e8',
  ringNext: '#ffb020',
  ringDone: '#37d67a',
  ringFar: '#9fb6c9',
  planeBody: '#e8e0cf',
  planeRed: '#c0392b',
  planeDark: '#2c3440',
  hud: '#8dff9e',
  hudAmber: '#ffc857',
  hudRed: '#ff5a4e',
  hudText: '#eef6ee',
  hudDim: '#a8b8a8',
  panel: '#101c26',
};

export const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';

/** Where the best score is kept between visits (this browser only). */
export const BEST_KEY = 'kancil-air.best';
