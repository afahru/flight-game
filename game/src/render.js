// Drawing only: the world's state and the current screen in, pixels out. A chase view
// from behind the plane over a projected patchwork ground, with the rings and the strip
// ahead and a lit HUD. The 1280x800 playfield is scaled to fit the window and centred;
// the canvas backing store is set to the window size in resize(), and the style size is
// pinned to the same CSS box, so a chart or HUD line can never sit off its own edge.
import { FIELD, FONT, PALETTE, RINGS, RUNWAY } from './config.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_OVER = 'over';

/** Perspective strength, in pixels, for the chase projection. */
const FOCAL = 700;
/** Ground grid: rows every 120 m out to 1800 m, columns every 120 m across 960 m. */
const GRID = { rowStep: 120, rows: 15, colStep: 120, cols: 8 };
const PANEL = { width: 640, top: 150, line: 32, bottom: 72 };

function wrapAngle(a) {
  while (a > Math.PI) a -= Math.PI * 2;
  while (a < -Math.PI) a += Math.PI * 2;
  return a;
}

function headingDegrees(heading) {
  return ((heading * 180 / Math.PI) % 360 + 360) % 360;
}

function cardinal(deg) {
  const names = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
  return names[Math.round(deg / 45) % 8];
}

export function createRenderer(canvas, terrain) {
  const context = canvas.getContext('2d');
  const view = { scale: 1, x: 0, y: 0 };
  const fonts = new Map();

  function resize() {
    const ratio = window.devicePixelRatio || 1;
    const width = Math.round(window.innerWidth * ratio);
    const height = Math.round(window.innerHeight * ratio);
    canvas.width = width;
    canvas.height = height;
    canvas.style.width = `${window.innerWidth}px`;
    canvas.style.height = `${window.innerHeight}px`;
    view.scale = Math.min(width / FIELD.width, height / FIELD.height);
    view.x = (width - FIELD.width * view.scale) / 2;
    view.y = (height - FIELD.height * view.scale) / 2;
  }

  function text(value, x, y, size, color, align, baseline) {
    if (!fonts.has(size)) fonts.set(size, `${size}px ${FONT}`);
    context.font = fonts.get(size);
    context.fillStyle = color;
    context.textAlign = align;
    context.textBaseline = baseline || 'alphabetic';
    context.fillText(value, x, y);
  }

  /** Project a world point into the field. Returns null when it is behind the camera. */
  function project(plane, wx, wy, wz, horizonY) {
    const dx = wx - plane.x;
    const dz = wz - plane.z;
    const sinH = Math.sin(plane.heading);
    const cosH = Math.cos(plane.heading);
    const fwd = dx * sinH + dz * cosH;
    if (fwd <= 2) return null;
    const right = dx * cosH - dz * sinH;
    return {
      x: FIELD.width / 2 + (right / fwd) * FOCAL,
      y: horizonY - ((wy - plane.y) / fwd) * FOCAL,
      f: fwd,
    };
  }

  function drawSky(plane, horizonY) {
    const gradient = context.createLinearGradient(0, 0, 0, horizonY);
    gradient.addColorStop(0, PALETTE.skyTop);
    gradient.addColorStop(0.7, PALETTE.skyMid);
    gradient.addColorStop(1, PALETTE.horizon);
    context.fillStyle = gradient;
    context.fillRect(0, 0, FIELD.width, horizonY);
    // The sun sits north-east, so it slides across as the plane turns.
    const sunX = FIELD.width / 2 + wrapAngle(0.6 - plane.heading) * 500;
    const sunY = 130;
    const glow = context.createRadialGradient(sunX, sunY, 8, sunX, sunY, 120);
    glow.addColorStop(0, PALETTE.sunGlow);
    glow.addColorStop(1, 'rgba(255, 233, 168, 0)');
    context.fillStyle = glow;
    context.fillRect(sunX - 130, sunY - 130, 260, 260);
    context.fillStyle = PALETTE.sun;
    context.beginPath();
    context.arc(sunX, sunY, 34, 0, Math.PI * 2);
    context.fill();
  }

  function drawClouds(plane, horizonY) {
    context.fillStyle = PALETTE.cloud;
    for (const cloud of terrain.clouds) {
      const p = project(plane, cloud.x, cloud.y, cloud.z, horizonY);
      if (!p) continue;
      const r = (cloud.r * FOCAL) / p.f;
      if (r < 2) continue;
      context.globalAlpha = 0.85;
      context.beginPath();
      context.ellipse(p.x, p.y, r, r * 0.42, 0, 0, Math.PI * 2);
      context.ellipse(p.x - r * 0.55, p.y + r * 0.12, r * 0.6, r * 0.3, 0, 0, Math.PI * 2);
      context.ellipse(p.x + r * 0.55, p.y + r * 0.12, r * 0.6, r * 0.3, 0, 0, Math.PI * 2);
      context.fill();
    }
    context.globalAlpha = 1;
  }

  function drawRidges(plane, horizonY) {
    // The volcano, west of the route, and two far ridges: triangles on the horizon.
    const peak = project(plane, terrain.volcano.x, terrain.volcano.height, terrain.volcano.z, horizonY);
    const baseL = project(plane, terrain.volcano.x - terrain.volcano.radius, 0, terrain.volcano.z, horizonY);
    const baseR = project(plane, terrain.volcano.x + terrain.volcano.radius, 0, terrain.volcano.z, horizonY);
    if (peak && baseL && baseR) {
      context.fillStyle = PALETTE.volcano;
      context.beginPath();
      context.moveTo(baseL.x, baseL.y);
      context.lineTo(peak.x, peak.y);
      context.lineTo(baseR.x, baseR.y);
      context.closePath();
      context.fill();
      // Snow cap: the top third of the cone.
      const capY = peak.y + (baseL.y - peak.y) * 0.3;
      const capLx = peak.x + (baseL.x - peak.x) * 0.3;
      const capRx = peak.x + (baseR.x - peak.x) * 0.3;
      context.fillStyle = PALETTE.volcanoSnow;
      context.beginPath();
      context.moveTo(capLx, capY);
      context.lineTo(peak.x, peak.y);
      context.lineTo(capRx, capY);
      context.closePath();
      context.fill();
    }
    const ridges = [
      { x: 900, z: 5200, h: 260, w: 700 },
      { x: -1500, z: 5600, h: 200, w: 600 },
    ];
    context.fillStyle = PALETTE.ridge;
    for (const ridge of ridges) {
      const top = project(plane, ridge.x, ridge.h, ridge.z, horizonY);
      const l = project(plane, ridge.x - ridge.w, 0, ridge.z, horizonY);
      const r = project(plane, ridge.x + ridge.w, 0, ridge.z, horizonY);
      if (!top || !l || !r) continue;
      context.beginPath();
      context.moveTo(l.x, l.y);
      context.lineTo(top.x, top.y);
      context.lineTo(r.x, r.y);
      context.closePath();
      context.fill();
    }
  }

  function drawGround(plane, horizonY) {
    context.fillStyle = PALETTE.groundFar;
    context.fillRect(0, horizonY, FIELD.width, FIELD.height - horizonY);
    // Patchwork cells: rows ahead of the plane, columns across it.
    const z0 = plane.z + 60;
    for (let row = 0; row < GRID.rows; row += 1) {
      const zA = z0 + row * GRID.rowStep;
      const zB = zA + GRID.rowStep;
      for (let col = 0; col < GRID.cols; col += 1) {
        const xA = -GRID.cols / 2 * GRID.colStep + col * GRID.colStep;
        const xB = xA + GRID.colStep;
        const corners = [
          project(plane, xA, terrain.heightAt(xA, zA), zA, horizonY),
          project(plane, xB, terrain.heightAt(xB, zA), zA, horizonY),
          project(plane, xB, terrain.heightAt(xB, zB), zB, horizonY),
          project(plane, xA, terrain.heightAt(xA, zB), zB, horizonY),
        ];
        if (corners.some((c) => c === null)) continue;
        const gx = Math.round(xA / GRID.colStep);
        const gz = Math.round(zA / GRID.rowStep);
        context.fillStyle = terrain.fieldShade(gx, gz) === 0 ? PALETTE.fieldA : PALETTE.fieldB;
        context.beginPath();
        context.moveTo(corners[0].x, corners[0].y);
        for (let i = 1; i < 4; i += 1) context.lineTo(corners[i].x, corners[i].y);
        context.closePath();
        context.fill();
      }
    }
  }

  function drawRunway(plane, horizonY) {
    const corners = [
      project(plane, RUNWAY.x, 0, RUNWAY.z0, horizonY),
      project(plane, RUNWAY.x + RUNWAY.width, 0, RUNWAY.z0, horizonY),
      project(plane, RUNWAY.x + RUNWAY.width, 0, RUNWAY.z1, horizonY),
      project(plane, RUNWAY.x, 0, RUNWAY.z1, horizonY),
    ];
    if (corners.some((c) => c === null)) return;
    context.fillStyle = PALETTE.runway;
    context.beginPath();
    context.moveTo(corners[0].x, corners[0].y);
    for (let i = 1; i < 4; i += 1) context.lineTo(corners[i].x, corners[i].y);
    context.closePath();
    context.fill();
    // Centreline dashes and the threshold bars.
    context.strokeStyle = PALETTE.runwayLine;
    context.lineWidth = 3;
    for (let z = RUNWAY.z0 + 60; z < RUNWAY.z1 - 40; z += 90) {
      const a = project(plane, RUNWAY.x + RUNWAY.width / 2, 0.2, z, horizonY);
      const b = project(plane, RUNWAY.x + RUNWAY.width / 2, 0.2, z + 45, horizonY);
      if (!a || !b) continue;
      context.beginPath();
      context.moveTo(a.x, a.y);
      context.lineTo(b.x, b.y);
      context.stroke();
    }
  }

  function drawRings(plane, mission, horizonY) {
    for (let i = 0; i < RINGS.length; i += 1) {
      const ring = RINGS[i];
      const p = project(plane, ring.x, ring.y, ring.z, horizonY);
      if (!p) continue;
      const r = (ring.r * FOCAL) / p.f;
      if (r < 3) continue;
      const done = i < mission.state.ringIndex;
      const next = i === mission.state.ringIndex;
      context.strokeStyle = next ? PALETTE.ringNext : done ? PALETTE.ringDone : PALETTE.ringFar;
      context.lineWidth = Math.max(3, r * 0.14);
      context.globalAlpha = next ? 1 : done ? 0.75 : 0.5;
      if (next) {
        context.shadowColor = PALETTE.ringNext;
        context.shadowBlur = 18;
      }
      context.beginPath();
      context.arc(p.x, p.y, r, 0, Math.PI * 2);
      context.stroke();
      context.shadowBlur = 0;
      context.globalAlpha = 1;
      if (next && r > 14) {
        text(`${Math.round(p.f)} m`, p.x, p.y + r + 22, 20, PALETTE.hudText, 'center', 'top');
      }
    }
  }

  function drawPlane(plane) {
    const cx = FIELD.width / 2;
    const cy = 560;
    context.save();
    context.translate(cx, cy);
    context.rotate(plane.roll);
    // Wings, wide and cream with red tips.
    context.fillStyle = PALETTE.planeBody;
    context.beginPath();
    context.moveTo(-104, 6);
    context.lineTo(-96, -14);
    context.lineTo(96, -14);
    context.lineTo(104, 6);
    context.lineTo(0, 16);
    context.closePath();
    context.fill();
    context.fillStyle = PALETTE.planeRed;
    context.fillRect(-104, -8, 16, 14);
    context.fillRect(88, -8, 16, 14);
    // Fuselage, narrowing away from the viewer toward the nose.
    context.fillStyle = PALETTE.planeBody;
    context.beginPath();
    context.moveTo(-24, 46);
    context.lineTo(-13, -58);
    context.lineTo(13, -58);
    context.lineTo(24, 46);
    context.closePath();
    context.fill();
    context.fillStyle = PALETTE.planeRed;
    context.fillRect(-13, -58, 26, 10);
    // Tailplane and fin, at the near end.
    context.fillStyle = PALETTE.planeDark;
    context.fillRect(-58, 30, 116, 10);
    context.beginPath();
    context.moveTo(-8, 44);
    context.lineTo(0, 4);
    context.lineTo(8, 44);
    context.closePath();
    context.fill();
    // Nav lights, lit: red left, green right, white on the tail.
    context.shadowBlur = 12;
    context.fillStyle = '#ff4d4d';
    context.shadowColor = '#ff4d4d';
    context.beginPath();
    context.arc(-100, -2, 5, 0, Math.PI * 2);
    context.fill();
    context.fillStyle = '#4dff88';
    context.shadowColor = '#4dff88';
    context.beginPath();
    context.arc(100, -2, 5, 0, Math.PI * 2);
    context.fill();
    context.fillStyle = '#ffffff';
    context.shadowColor = '#ffffff';
    context.beginPath();
    context.arc(0, 44, 4, 0, Math.PI * 2);
    context.fill();
    context.shadowBlur = 0;
    context.restore();
  }

  function drawCompass(plane) {
    const deg = headingDegrees(plane.heading);
    const cx = FIELD.width / 2;
    const y = 30;
    context.fillStyle = 'rgba(16, 28, 38, 0.72)';
    context.fillRect(cx - 170, 8, 340, 44);
    context.strokeStyle = PALETTE.hud;
    context.lineWidth = 2;
    context.beginPath();
    context.moveTo(cx, 8);
    context.lineTo(cx, 52);
    context.stroke();
    for (let off = -30; off <= 30; off += 5) {
      const d = (deg + off + 360) % 360;
      const x = cx + off * 5.4;
      const major = d % 45 === 0;
      context.strokeStyle = major ? PALETTE.hud : PALETTE.hudDim;
      context.lineWidth = major ? 2 : 1;
      context.beginPath();
      context.moveTo(x, 44);
      context.lineTo(x, major ? 30 : 36);
      context.stroke();
      if (major) text(d % 90 === 0 ? cardinal(d) : String(d), x, 26, 15, PALETTE.hudText, 'center', 'top');
    }
    text(`${String(Math.round(deg)).padStart(3, '0')}°`, cx, 58, 20, PALETTE.hud, 'center', 'top');
  }

  function drawAttitude(plane) {
    const cx = FIELD.width / 2;
    const cy = 736;
    const r = 44;
    context.save();
    context.beginPath();
    context.arc(cx, cy, r, 0, Math.PI * 2);
    context.clip();
    context.translate(cx, cy);
    context.rotate(-plane.roll);
    const pitchOff = plane.pitch * 60;
    context.fillStyle = '#3f8fd2';
    context.fillRect(-r, -r - pitchOff, r * 2, r + pitchOff);
    context.fillStyle = '#8a5a33';
    context.fillRect(-r, pitchOff, r * 2, r - pitchOff + 1);
    context.strokeStyle = '#ffffff';
    context.lineWidth = 2;
    context.beginPath();
    context.moveTo(-r, pitchOff);
    context.lineTo(r, pitchOff);
    context.stroke();
    context.restore();
    // Fixed aircraft symbol and the glowing ring.
    context.strokeStyle = PALETTE.hud;
    context.lineWidth = 3;
    context.beginPath();
    context.moveTo(cx - 18, cy);
    context.lineTo(cx - 5, cy);
    context.moveTo(cx + 5, cy);
    context.lineTo(cx + 18, cy);
    context.stroke();
    context.fillStyle = PALETTE.hud;
    context.beginPath();
    context.arc(cx, cy, 3, 0, Math.PI * 2);
    context.fill();
    context.strokeStyle = PALETTE.hud;
    context.shadowColor = PALETTE.hud;
    context.shadowBlur = 8;
    context.lineWidth = 2;
    context.beginPath();
    context.arc(cx, cy, r, 0, Math.PI * 2);
    context.stroke();
    context.shadowBlur = 0;
  }

  function bar(x, y, width, height, fraction, color, track) {
    context.fillStyle = track;
    context.fillRect(x, y, width, height);
    context.fillStyle = color;
    context.fillRect(x, y, width * Math.max(0, Math.min(1, fraction)), height);
  }

  function drawHud(plane, mission, now) {
    const kmh = Math.round(plane.speed * 3.6);
    const alt = Math.round(plane.y);
    const vs = plane.verticalSpeed;
    // Speed, top left.
    text('SPEED', 24, 26, 16, PALETTE.hudDim, 'left', 'top');
    text(`${kmh}`, 24, 44, 40, PALETTE.hud, 'left', 'top');
    text('km/h', 118, 66, 18, PALETTE.hudDim, 'left', 'top');
    bar(24, 96, 150, 8, kmh / 300, PALETTE.hud, 'rgba(255,255,255,0.15)');
    // Altitude, top right.
    text('ALTITUDE', FIELD.width - 24, 26, 16, PALETTE.hudDim, 'right', 'top');
    text(`${alt} m`, FIELD.width - 24, 44, 40, PALETTE.hud, 'right', 'top');
    const vsText = `${vs >= 0 ? '+' : ''}${vs.toFixed(1)} m/s`;
    text(vsText, FIELD.width - 24, 96, 18, vs >= 0 ? PALETTE.hud : PALETTE.hudAmber, 'right', 'top');
    drawCompass(plane);
    // Fuel and throttle, bottom left.
    const fuelColor = plane.fuel < 20 ? PALETTE.hudRed : plane.fuel < 45 ? PALETTE.hudAmber : PALETTE.hud;
    text('FUEL', 24, 700, 16, PALETTE.hudDim, 'left', 'top');
    bar(24, 722, 170, 12, plane.fuel / 100, fuelColor, 'rgba(255,255,255,0.15)');
    text(`${Math.round(plane.fuel)}%`, 202, 720, 18, fuelColor, 'left', 'top');
    text('THR', 24, 744, 16, PALETTE.hudDim, 'left', 'top');
    bar(24, 764, 170, 8, plane.throttle, PALETTE.hudAmber, 'rgba(255,255,255,0.15)');
    text(`${Math.round(plane.throttle * 100)}%`, 202, 760, 18, PALETTE.hudDim, 'left', 'top');
    // Rings and score, bottom right.
    text(`RING ${mission.state.ringsPassed}/6`, FIELD.width - 24, 700, 22, PALETTE.hudText, 'right', 'top');
    text(`SCORE ${mission.state.score}`, FIELD.width - 24, 730, 22, PALETTE.hud, 'right', 'top');
    drawAttitude(plane);
    // Warnings, under the compass.
    let warnY = 92;
    if (plane.stalled && Math.floor(now / 300) % 2 === 0) {
      text('STALL', FIELD.width / 2, warnY, 26, PALETTE.hudRed, 'center', 'top');
      warnY += 30;
    }
    if (plane.engineOut) {
      text('ENGINE OUT', FIELD.width / 2, warnY, 22, PALETTE.hudRed, 'center', 'top');
      warnY += 28;
    } else if (plane.fuel < 20 && Math.floor(now / 500) % 2 === 0) {
      text('LOW FUEL', FIELD.width / 2, warnY, 22, PALETTE.hudAmber, 'center', 'top');
    }
  }

  function drawGuidance(plane, mission) {
    const ring = mission.nextRing();
    if (!ring || mission.state.status !== 'flying') return;
    const bearing = wrapAngle(Math.atan2(ring.x - plane.x, ring.z - plane.z) - plane.heading);
    const dist = Math.hypot(ring.x - plane.x, ring.y - plane.y, ring.z - plane.z);
    if (Math.abs(bearing) < 0.45 || dist < 120) return;
    const label = `RING ${mission.state.ringIndex + 1}  ${Math.round(dist)} m`;
    if (bearing < 0) text(`◀  ${label}`, 24, 130, 22, PALETTE.ringNext, 'left', 'top');
    else text(`${label}  ▶`, FIELD.width - 24, 130, 22, PALETTE.ringNext, 'right', 'top');
  }

  function drawNotice(notice) {
    if (!notice || !notice.text) return;
    text(notice.text, FIELD.width / 2, 130, 24, PALETTE.hudText, 'center', 'top');
  }

  function drawPanel(title, lines, prompt, best) {
    const height = PANEL.top + lines.length * PANEL.line + PANEL.bottom;
    const x = (FIELD.width - PANEL.width) / 2;
    const y = (FIELD.height - height) / 2;
    context.fillStyle = PALETTE.panel;
    context.fillRect(x, y, PANEL.width, height);
    context.strokeStyle = PALETTE.hud;
    context.lineWidth = 2;
    context.strokeRect(x, y, PANEL.width, height);
    text(title, FIELD.width / 2, y + 78, 46, PALETTE.hudText, 'center');
    for (let index = 0; index < lines.length; index += 1) {
      text(lines[index], FIELD.width / 2, y + PANEL.top + index * PANEL.line, 20, PALETTE.hudDim, 'center');
    }
    if (best > 0) text(`Best ${best}`, FIELD.width / 2, y + height - 74, 20, PALETTE.hud, 'center');
    text(prompt, FIELD.width / 2, y + height - 40, 22, PALETTE.ringNext, 'center');
  }

  /** Paint one frame: the world, the plane, the HUD, then a panel for the screen. */
  function draw(world, screen, best, now) {
    const plane = world.plane;
    const horizonY = 340 + plane.pitch * 400;
    context.setTransform(1, 0, 0, 1, 0, 0);
    context.fillStyle = PALETTE.skyTop;
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.setTransform(view.scale, 0, 0, view.scale, view.x, view.y);
    // The world tilts with the bank; the plane and the HUD do not.
    context.save();
    context.translate(FIELD.width / 2, FIELD.height / 2);
    context.rotate(-plane.roll);
    context.translate(-FIELD.width / 2, -FIELD.height / 2);
    drawSky(plane, horizonY);
    drawClouds(plane, horizonY);
    drawRidges(plane, horizonY);
    drawGround(plane, horizonY);
    drawRunway(plane, horizonY);
    drawRings(plane, world.mission, horizonY);
    context.restore();
    if (screen === SCREEN_TITLE || screen === SCREEN_PLAY || screen === SCREEN_PAUSED) drawPlane(plane);
    if (screen === SCREEN_PLAY || screen === SCREEN_PAUSED) {
      drawHud(plane, world.mission, now);
      drawGuidance(plane, world.mission);
      drawNotice(world.notice);
    }
    if (screen === SCREEN_TITLE) {
      drawPanel('KANCIL AIR', [
        'Merapi Run: fly the mail route, six rings,',
        'then land on the Merapi strip before the fuel runs out.',
        'Arrows steer · W/S throttle · mouse steers too',
        'Space starts · P pauses',
        'Full throttle burns fuel fast. A slow plane stalls.',
      ], 'Press Space or click to start', best);
    } else if (screen === SCREEN_PAUSED) {
      drawPanel('Paused', ['The island will wait for you.'], 'Press P to resume', best);
    } else if (screen === SCREEN_OVER) {
      const m = world.mission.state;
      if (m.status === 'landed') {
        drawPanel('Landed', [
          `On the Merapi strip. Score ${m.score} (landing bonus ${m.landBonus}).`,
          `Rings ${m.ringsPassed} of 6 · fuel left ${Math.round(world.plane.fuel)}%.`,
        ], 'Press Space or click to fly again', best);
      } else {
        drawPanel('Crashed', [
          `${m.reason ? m.reason[0].toUpperCase() + m.reason.slice(1) : 'Something went wrong'}.`,
          `Score ${m.score} · rings ${m.ringsPassed} of 6.`,
        ], 'Press Space or click to try again', best);
      }
    }
  }

  resize();
  window.addEventListener('resize', resize);
  return { draw };
}
