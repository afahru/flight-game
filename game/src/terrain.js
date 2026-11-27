// The island under the route: rolling hills that stay low near the centreline and grow
// toward the edges, a volcano off to the west, and the flat Merapi strip. Nothing here
// draws or reads the browser: heightAt is pure numbers, so the flight model and the
// renderer share one ground.
import { RUNWAY } from './config.js';

const CELL = 400;
const VOLCANO = { x: -700, z: 3600, radius: 550, height: 430 };

function hash2(ix, iz) {
  let h = (ix * 374761393 + iz * 668265263) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h = (h ^ (h >>> 16)) >>> 0;
  return h / 4294967296;
}

function smooth(t) {
  return t * t * (3 - 2 * t);
}

/** Smooth value noise, 0..1, over a 400 m grid. */
function noise(x, z) {
  const fx = x / CELL;
  const fz = z / CELL;
  const ix = Math.floor(fx);
  const iz = Math.floor(fz);
  const tx = smooth(fx - ix);
  const tz = smooth(fz - iz);
  const a = hash2(ix, iz);
  const b = hash2(ix + 1, iz);
  const c = hash2(ix, iz + 1);
  const d = hash2(ix + 1, iz + 1);
  return a + (b - a) * tx + (c - a) * tz + (a - b - c + d) * tx * tz;
}

function clamp01(v) {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}

export function createTerrain(seed) {
  // Clouds are fixed for the seed: a few soft puffs the route flies under.
  let s = seed | 0;
  function rnd() {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  const clouds = [];
  for (let i = 0; i < 14; i += 1) {
    clouds.push({
      x: -1200 + rnd() * 2400,
      y: 520 + rnd() * 280,
      z: 400 + rnd() * 6200,
      r: 60 + rnd() * 110,
    });
  }

  /** Metres above sea level at a ground point. 0 on the strip, low near the route. */
  function heightAt(x, z) {
    const n1 = noise(x, z);
    const n2 = noise(x * 2.3 + 100, z * 2.3 - 50);
    let h = 20 + (n1 - 0.5) * 140 + (n2 - 0.5) * 50;
    // Hills stay gentle over the route and grow toward the island's edges.
    const edge = clamp01((Math.abs(x) - 80) / 420);
    h *= 0.25 + 0.75 * edge;
    // The volcano, west of the route.
    const dx = x - VOLCANO.x;
    const dz = z - VOLCANO.z;
    const d = Math.sqrt(dx * dx + dz * dz);
    if (d < VOLCANO.radius) h += VOLCANO.height * Math.pow(1 - d / VOLCANO.radius, 1.4);
    // The strip is a flat pad; blend its edge so the ground does not cliff.
    const fx = clamp01((70 - Math.abs(x)) / 30);
    const fz = clamp01((z - 6030) / 30) * clamp01((6620 - z) / 30);
    h *= 1 - Math.min(fx, fz);
    return Math.max(0, h);
  }

  /** Patchwork field colour for a ground cell, so the land reads as farmland. */
  function fieldShade(gx, gz) {
    return hash2(gx * 3 + 11, gz * 5 + 7) < 0.5 ? 0 : 1;
  }

  return { heightAt, fieldShade, clouds, volcano: VOLCANO };
}
