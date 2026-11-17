// The world: one game of VOIDSTORM. It owns the state — the player, the swarm, the
// bullets, the score and the waves — and steps it in fixed 1/60 s slices. The renderer
// paints it; this file decides what happens. Events are a bitmask the loop reads.

import { COMBO, FIELD, LIVES, PLAYER, POWERUP, WAVE } from './config.js';
import { ACTION_BOMB } from './input.js';
import {
  addFloater,
  burst,
  createPlayer,
  detonateBomb,
  firePlayerGuns,
  maybeDropPowerup,
  spawnEnemy,
  updateBullets,
  updateEnemies,
  updateParticles,
  updatePowerups,
} from './entities.js';

export const EVENT_HIT = 1;
export const EVENT_OVER = 2;
export const EVENT_WAVE = 4;

const COST = { drifter: 1, weaver: 2, gunner: 3, brute: 5 };
const BOSS_WAVE_BONUS = 1000;

export function createWorld(random) {
  const world = {
    random,
    time: 0,
    score: 0,
    lives: LIVES,
    wave: 0,
    waveState: 'breather',
    breatherTimer: 1.2,
    spawnQueue: [],
    spawnTimer: 0,
    boss: null,
    combo: 0,
    comboTimer: 0,
    kills: 0,
    shake: 0,
    player: createPlayer(),
    bullets: [],
    enemyBullets: [],
    enemies: [],
    powerups: [],
    particles: [],
    floaters: [],
    over: false,
    /** The wave banner the renderer shows ("WAVE 3", "BOSS: VOID MAW", ...). */
    banner: '',
    bannerTimer: 0,
  };
  return world;
}

export function resetWorld(world) {
  const fresh = createWorld(world.random);
  for (const key of Object.keys(fresh)) world[key] = fresh[key];
}

/** Build one wave's spawn queue from its budget; boss waves open with the Void Maw. */
function buildWave(world) {
  const wave = world.wave;
  const queue = [];
  if (wave % WAVE.bossEvery === 0) {
    queue.push('maw');
    let budget = 6 + wave;
    while (budget > 0) {
      const kind = world.random.pick(['drifter', 'drifter', 'weaver', 'gunner']);
      budget -= COST[kind];
      queue.push(kind);
    }
    world.banner = `WAVE ${wave} — THE VOID MAW`;
    return queue;
  }
  let budget = WAVE.budgetBase + wave * WAVE.budgetPerWave;
  while (budget > 0) {
    const affordable = Object.keys(COST).filter((kind) => COST[kind] <= budget);
    const kind = world.random.pick(affordable);
    budget -= COST[kind];
    queue.push(kind);
  }
  world.banner = `WAVE ${wave}`;
  return queue;
}

function startWave(world) {
  world.wave += 1;
  world.spawnQueue = buildWave(world);
  world.spawnTimer = 0.5;
  world.waveState = 'spawning';
  world.bannerTimer = 2.2;
}

function spawnNext(world) {
  const kind = world.spawnQueue.shift();
  if (kind === 'maw') {
    const boss = spawnEnemy(world, 'maw', FIELD.width / 2, -80);
    world.boss = boss;
    return;
  }
  const x = world.random.range(40, FIELD.width - 40);
  spawnEnemy(world, kind, x, -30);
}

/** Score one kill: combo grows, the multiplier grows with it, the points float up. */
function killEnemy(world, enemy, audio) {
  world.kills += 1;
  world.combo += 1;
  world.comboTimer = COMBO.window;
  const mult = Math.min(1 + world.combo * COMBO.step, COMBO.cap);
  const points = Math.round(enemy.score * mult);
  world.score += points;
  addFloater(world, enemy.x, enemy.y, `+${points}`, mult > 1.5 ? '#ff9f1c' : '#ffd166');
  burst(world, enemy.x, enemy.y, enemy.colour, enemy.kind === 'brute' ? 26 : 14);
  burst(world, enemy.x, enemy.y, '#ffffff', 6, 160);
  audio.explosion(enemy.kind === 'brute' || enemy.kind === 'maw');
  maybeDropPowerup(world, enemy.x, enemy.y);
  if (enemy.kind === 'maw') {
    world.boss = null;
    world.score += BOSS_WAVE_BONUS;
    addFloater(world, enemy.x, enemy.y - 40, `BOSS DOWN +${BOSS_WAVE_BONUS}`, '#ff4d6d');
    burst(world, enemy.x, enemy.y, '#ff2e63', 60, 520);
    burst(world, enemy.x, enemy.y, '#ffd166', 40, 380);
    world.shake = Math.max(world.shake, 18);
  }
}

function applyPowerup(world, powerup, audio) {
  const player = world.player;
  if (powerup.kind === 'spread') player.spread = Math.min(2, player.spread + 1);
  else if (powerup.kind === 'rapid') player.rapidTimer = 8;
  else if (powerup.kind === 'shield') player.shieldTimer = 8;
  else if (powerup.kind === 'bomb') player.bombs = Math.min(5, player.bombs + 1);
  else if (powerup.kind === 'life') world.lives = Math.min(5, world.lives + 1);
  addFloater(world, player.x, player.y - 30, powerup.kind.toUpperCase(), '#4df3ff');
  burst(world, player.x, player.y, '#4df3ff', 12, 200);
  audio.powerup();
}

function hurtPlayer(world, audio) {
  const player = world.player;
  if (player.invulnerable > 0) return 0;
  if (player.shieldTimer > 0) {
    player.shieldTimer = 0;
    player.invulnerable = 1.2;
    burst(world, player.x, player.y, '#4df3ff', 22, 320);
    audio.hit();
    return EVENT_HIT;
  }
  world.lives -= 1;
  world.combo = 0;
  player.spread = Math.max(0, player.spread - 1);
  player.invulnerable = PLAYER.invulnerable;
  world.shake = Math.max(world.shake, 12);
  burst(world, player.x, player.y, '#ff5d73', 36, 420);
  burst(world, player.x, player.y, '#ffd166', 20, 300);
  audio.hit();
  if (world.lives <= 0) {
    player.alive = false;
    world.over = true;
    return EVENT_HIT | EVENT_OVER;
  }
  return EVENT_HIT;
}

function collide(world, audio) {
  const player = world.player;
  // Player bullets against enemies.
  for (const bullet of world.bullets) {
    for (const enemy of world.enemies) {
      if (enemy.hp <= 0) continue;
      const dx = bullet.x - enemy.x;
      const dy = bullet.y - enemy.y;
      const reach = bullet.radius + enemy.radius;
      if (dx * dx + dy * dy < reach * reach) {
        enemy.hp -= bullet.damage;
        bullet.y = -9999;
        burst(world, bullet.x, bullet.y + 9999, '#7df9ff', 2, 90);
        break;
      }
    }
  }
  world.bullets = world.bullets.filter((b) => b.y > -100);
  // Dead enemies pay out.
  const dead = world.enemies.filter((e) => e.hp <= 0);
  for (const enemy of dead) killEnemy(world, enemy, audio);
  world.enemies = world.enemies.filter((e) => e.hp > 0);
  if (!player.alive) return 0;
  // Enemies and their bullets against the player.
  let events = 0;
  for (const enemy of world.enemies) {
    const dx = enemy.x - player.x;
    const dy = enemy.y - player.y;
    const reach = enemy.radius + player.radius - 4;
    if (dx * dx + dy * dy < reach * reach) {
      enemy.hp -= 2;
      events |= hurtPlayer(world, audio);
      if (!player.alive) return events;
    }
  }
  for (const bullet of world.enemyBullets) {
    const dx = bullet.x - player.x;
    const dy = bullet.y - player.y;
    const reach = bullet.radius + player.radius - 4;
    if (dx * dx + dy * dy < reach * reach) {
      bullet.y = -9999;
      events |= hurtPlayer(world, audio);
      if (!player.alive) return events;
    }
  }
  world.enemyBullets = world.enemyBullets.filter((b) => b.y > -100);
  // Power-ups against the player.
  for (const powerup of world.powerups) {
    const dx = powerup.x - player.x;
    const dy = powerup.y - player.y;
    const reach = POWERUP.radius + player.radius + 6;
    if (dx * dx + dy * dy < reach * reach) {
      powerup.life = 0;
      applyPowerup(world, powerup, audio);
    }
  }
  world.powerups = world.powerups.filter((p) => p.life > 0);
  return events;
}

/**
 * Step the world one fixed slice. `input` is { direction: [x, y], firing, actions } and
 * `audio` the sound board. Returns an EVENT_* bitmask. On the title screen the world
 * idles with a slow ambient drift so the backdrop is alive behind the menu.
 */
export function stepWorld(world, dt, input, audio, attract = false) {
  world.time += dt;
  if (world.bannerTimer > 0) world.bannerTimer -= dt;
  if (world.shake > 0) world.shake = Math.max(0, world.shake - dt * 30);
  if (world.comboTimer > 0) {
    world.comboTimer -= dt;
    if (world.comboTimer <= 0) world.combo = 0;
  }
  updateParticles(world, dt);

  if (attract) {
    // Title-screen drift: a few wanderers cross the field so the menu is alive.
    if (world.enemies.length < 5 && world.random.next() < dt * 0.8) {
      spawnEnemy(world, world.random.pick(['drifter', 'weaver']), world.random.range(40, FIELD.width - 40), -30);
    }
    updateEnemies(world, dt, audio);
    world.enemies = world.enemies.filter((e) => e.y < FIELD.height + 60);
    return 0;
  }

  const player = world.player;
  if (!player.alive) {
    updateEnemies(world, dt, audio);
    updateBullets(world, dt);
    return 0;
  }

  // Movement and engine trail.
  const [dx, dy] = input.direction;
  player.x = Math.max(player.radius, Math.min(FIELD.width - player.radius, player.x + dx * PLAYER.speed * dt));
  player.y = Math.max(player.radius, Math.min(FIELD.height - player.radius, player.y + dy * PLAYER.speed * dt));
  player.tilt = dx * 0.35;
  player.trailTimer -= dt;
  if (player.trailTimer <= 0) {
    player.trailTimer = 0.03;
    world.particles.push({
      x: player.x + (world.random.next() - 0.5) * 8,
      y: player.y + player.radius,
      vx: (world.random.next() - 0.5) * 20,
      vy: 120,
      life: 0.35,
      maxLife: 0.35,
      size: 3,
      colour: '#4df3ff',
    });
  }
  if (player.invulnerable > 0) player.invulnerable -= dt;
  if (player.rapidTimer > 0) player.rapidTimer -= dt;
  if (player.shieldTimer > 0) player.shieldTimer -= dt;

  // Firing.
  player.fireTimer -= dt;
  if (input.firing && player.fireTimer <= 0) {
    firePlayerGuns(world, audio);
    player.fireTimer = player.rapidTimer > 0 ? PLAYER.fireInterval * 0.55 : PLAYER.fireInterval;
  }

  // Bombs.
  if (input.actions & ACTION_BOMB && player.bombs > 0) {
    player.bombs -= 1;
    detonateBomb(world, audio);
    const dead = world.enemies.filter((e) => e.hp <= 0);
    for (const enemy of dead) killEnemy(world, enemy, audio);
    world.enemies = world.enemies.filter((e) => e.hp > 0);
  }

  // Waves.
  if (world.waveState === 'breather') {
    world.breatherTimer -= dt;
    if (world.breatherTimer <= 0) startWave(world);
  } else if (world.waveState === 'spawning') {
    world.spawnTimer -= dt;
    if (world.spawnTimer <= 0 && world.spawnQueue.length > 0) {
      spawnNext(world);
      world.spawnTimer = Math.max(
        WAVE.spawnIntervalMin,
        WAVE.spawnInterval - world.wave * 0.03,
      );
    }
    if (world.spawnQueue.length === 0) world.waveState = 'fighting';
  } else if (world.waveState === 'fighting') {
    if (world.enemies.length === 0) {
      const bonus = 100 * world.wave;
      world.score += bonus;
      addFloater(world, FIELD.width / 2, FIELD.height / 2 - 40, `WAVE ${world.wave} CLEAR +${bonus}`, '#ffd166');
      audio.waveClear();
      world.waveState = 'breather';
      world.breatherTimer = WAVE.breather;
      return EVENT_WAVE;
    }
  }

  updateEnemies(world, dt, audio);
  updateBullets(world, dt);
  updatePowerups(world, dt);
  world.enemies = world.enemies.filter((e) => e.y < FIELD.height + 80 || e.kind === 'maw');
  return collide(world, audio);
}
