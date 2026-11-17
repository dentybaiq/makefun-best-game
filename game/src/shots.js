// The screenshot scenes behind ?shot=start|play|end. Each one plays the real rules
// forward from a fresh world for a fixed number of steps, steered by a simple autopilot
// (dodge the nearest bullet, chase the nearest enemy), so the frame is what a short
// game really looks like and the same seed always gives the same frame. Sound is a
// silent stub: screenshots do not need it.

import { FIELD, STEP } from './config.js';
import { EVENT_OVER, resetWorld } from './world.js';
import { SCREEN_OVER, SCREEN_PLAY, SCREEN_TITLE } from './render.js';

const START_SECONDS = 5;
const PLAY_LIMIT_SECONDS = 90;
/** The play shot stops at the first busy mid-wave moment, not at a fixed clock time. */
const PLAY_MIN_WAVE = 3;
const PLAY_MIN_ENEMIES = 6;
const PLAY_MIN_COMBO = 2;
const END_LIMIT_SECONDS = 300;
/** The end shot first plays a real run into wave 3, then stops dodging. */
const END_SKILLED_SECONDS = 90;
const END_MIN_WAVE = 3;
const BOSS_LIMIT_SECONDS = 400;
/** Seconds of boss fight after the Void Maw parks at the top of the field. */
const BOSS_FIGHT_SECONDS = 12;

const silentAudio = {
  shoot() {},
  enemyShoot() {},
  explosion() {},
  hit() {},
  powerup() {},
  bomb() {},
  waveClear() {},
  bossAlarm() {},
  unlock() {},
  startDrone() {},
  toggleMute() {
    return false;
  },
};

/**
 * Steer the ship like a sensible player: hold the low band of the field, slide
 * under the nearest enemy above so shots connect, and flee from anything close
 * (bullets and ramming enemies alike). It never chases up into the swarm.
 */
function autopilot(state, skill) {
  const player = state.player;
  let mx = 0;
  let my = 0;
  let actions = 0;
  if (skill > 0) {
    // Flee the nearest bullet or enemy inside the danger radius, hardest when close.
    let threat = null;
    let threatDistance = 170;
    for (const bullet of state.enemyBullets) {
      const distance = Math.hypot(bullet.x - player.x, bullet.y - player.y);
      if (distance < threatDistance) {
        threatDistance = distance;
        threat = bullet;
      }
    }
    for (const other of state.enemies) {
      const distance = Math.hypot(other.x - player.x, other.y - player.y);
      if (distance < threatDistance) {
        threatDistance = distance;
        threat = other;
      }
    }
    if (threat) {
      const dx = player.x - threat.x;
      const dy = player.y - threat.y;
      const len = Math.hypot(dx, dy) || 1;
      const weight = threatDistance < 60 ? 2.2 : 1.4;
      mx += (dx / len) * weight;
      my += (dy / len) * weight;
    }
    // A bomb when the sky is full of bullets or something is right on top of the ship.
    let nearBullets = 0;
    for (const bullet of state.enemyBullets) {
      if (Math.hypot(bullet.x - player.x, bullet.y - player.y) < 110) nearBullets += 1;
    }
    if (player.bombs > 0 && (nearBullets >= 6 || threatDistance < 45)) actions = 4;
    // Slide under the nearest enemy above so the shots going straight up connect.
    let target = null;
    let targetDistance = Infinity;
    for (const other of state.enemies) {
      if (other.y > player.y - 40) continue;
      const distance = Math.abs(other.x - player.x) + (player.y - other.y) * 0.2;
      if (distance < targetDistance) {
        targetDistance = distance;
        target = other;
      }
    }
    if (target) {
      const dx = target.x - player.x;
      mx += Math.sign(dx) * Math.min(1, Math.abs(dx) / 60);
    }
    // Hold the low band: drift back down when pushed up, never above y = 420.
    const homeY = FIELD.height - 110;
    if (player.y < 420) my += 1;
    else if (player.y < homeY - 30) my += 0.35;
    else if (player.y > homeY + 30) my -= 0.35;
  }
  if (player.x < 80) mx += 1;
  if (player.x > FIELD.width - 80) mx -= 1;
  if (player.y < 120) my += 1;
  if (player.y > FIELD.height - 80) my -= 1;
  const len = Math.hypot(mx, my);
  return {
    direction: len > 0 ? [mx / len, my / len] : [0, 0],
    firing: true,
    actions,
  };
}

/**
 * Set `world` to the named scene (start, play or end; any other name is start) and return
 * the screen to draw over it and the best score to show. `stepWorld` is passed in so this
 * file does not import the world module back.
 */
export function stageShot(name, world, stepWorld) {
  resetWorld(world);
  if (name !== 'play' && name !== 'end' && name !== 'boss') {
    for (let index = 0; index < START_SECONDS / STEP; index += 1) {
      stepWorld(world, STEP, { direction: [0, 0], firing: false, actions: 0 }, silentAudio, true);
    }
    return { screen: SCREEN_TITLE, best: 0 };
  }
  if (name === 'boss') {
    // Play well until the Void Maw of wave 5 shows up, then fight it a little longer.
    for (let index = 0; index < BOSS_LIMIT_SECONDS / STEP; index += 1) {
      const events = stepWorld(world, STEP, autopilot(world, 1), silentAudio, false);
      if (events & EVENT_OVER) break;
      if (world.boss && world.boss.y > 100) {
        for (let extra = 0; extra < BOSS_FIGHT_SECONDS / STEP; extra += 1) {
          stepWorld(world, STEP, autopilot(world, 1), silentAudio, false);
        }
        break;
      }
    }
    return { screen: world.lives <= 0 ? SCREEN_OVER : SCREEN_PLAY, best: world.score };
  }
  if (name === 'play') {
    // Stop at the first busy moment of wave 3 or later: a swarm on screen, a combo
    // running, score floaters in the air — not a lull between waves.
    for (let index = 0; index < PLAY_LIMIT_SECONDS / STEP; index += 1) {
      const events = stepWorld(world, STEP, autopilot(world, 1), silentAudio, false);
      if (events & EVENT_OVER) break;
      if (
        world.wave >= PLAY_MIN_WAVE &&
        world.enemies.length >= PLAY_MIN_ENEMIES &&
        world.combo >= PLAY_MIN_COMBO
      ) {
        break;
      }
    }
    const over = world.lives <= 0;
    return { screen: over ? SCREEN_OVER : SCREEN_PLAY, best: world.score };
  }
  // The end shot is a real run's game over: play well into wave 3, then stand still
  // and let the swarm finish the ship, so the results screen shows waves and kills.
  for (let index = 0; index < END_SKILLED_SECONDS / STEP; index += 1) {
    const events = stepWorld(world, STEP, autopilot(world, 1), silentAudio, false);
    if (events & EVENT_OVER) break;
    if (world.wave >= END_MIN_WAVE) break;
  }
  if (world.lives > 0) {
    for (let index = 0; index < END_LIMIT_SECONDS / STEP; index += 1) {
      const events = stepWorld(world, STEP, autopilot(world, 0), silentAudio, false);
      if (events & EVENT_OVER) break;
    }
  }
  const over = world.lives <= 0;
  return { screen: over ? SCREEN_OVER : SCREEN_PLAY, best: world.score };
}
