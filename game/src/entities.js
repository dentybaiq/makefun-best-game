// Everything that lives in the field: the player ship, both sides' bullets, the five
// enemy kinds, power-ups, particles and floating score text. Entities are plain objects
// in the world's arrays; this file builds them and steps them. Collisions live in world.js.

import { ENEMY, FIELD, PLAYER, POWERUP, BOMB } from './config.js';

/** The player ship, fresh, at the bottom centre of the field. */
export function createPlayer() {
  return {
    x: FIELD.width / 2,
    y: FIELD.height - 90,
    radius: PLAYER.radius,
    fireTimer: 0,
    spread: 0,
    rapidTimer: 0,
    shieldTimer: 0,
    invulnerable: 0,
    bombs: PLAYER.bombs,
    alive: true,
    tilt: 0,
    trailTimer: 0,
  };
}

/** Fire the player's guns into the world's bullet array (spread grows with power-ups). */
export function firePlayerGuns(state, audio) {
  const player = state.player;
  const angles = player.spread === 0 ? [0] : player.spread === 1 ? [-0.09, 0, 0.09] : [-0.16, -0.08, 0, 0.08, 0.16];
  for (const angle of angles) {
    state.bullets.push({
      x: player.x,
      y: player.y - player.radius,
      vx: Math.sin(angle) * PLAYER.bulletSpeed,
      vy: -Math.cos(angle) * PLAYER.bulletSpeed,
      damage: PLAYER.bulletDamage,
      radius: 4,
    });
  }
  burst(state, player.x, player.y - player.radius - 6, '#7df9ff', 3, 140);
  audio.shoot();
}

/** Spawn one enemy of a kind at a position, with a random phase for its wobble. */
export function spawnEnemy(state, kind, x, y) {
  const spec = ENEMY[kind];
  const enemy = {
    kind,
    x,
    y,
    vx: 0,
    vy: spec.speed,
    hp: spec.hp,
    maxHp: spec.hp,
    radius: spec.radius,
    score: spec.score,
    colour: spec.colour,
    age: 0,
    phase: state.random.next() * Math.PI * 2,
    fireTimer: state.random.range(1.0, 2.2),
    attackTimer: 0,
    pattern: 0,
  };
  state.enemies.push(enemy);
  return enemy;
}

/** Step every enemy: each kind moves and attacks in its own way. */
export function updateEnemies(state, dt, audio) {
  const player = state.player;
  const speedMul = Math.min(1 + (state.wave - 1) * 0.04, 1.9);
  for (const enemy of state.enemies) {
    enemy.age += dt;
    if (enemy.kind === 'drifter') {
      const dx = player.x - enemy.x;
      const dy = player.y - enemy.y;
      const len = Math.hypot(dx, dy) || 1;
      enemy.vx = (dx / len) * ENEMY.drifter.speed * speedMul * 0.6;
      enemy.vy = (dy / len) * ENEMY.drifter.speed * speedMul * 0.6 + 30;
    } else if (enemy.kind === 'weaver') {
      enemy.vx = Math.sin(enemy.age * 3 + enemy.phase) * 220;
      enemy.vy = ENEMY.weaver.speed * speedMul;
    } else if (enemy.kind === 'gunner') {
      const targetY = 150 + Math.sin(enemy.phase) * 60;
      enemy.vy = (targetY - enemy.y) * 0.8;
      enemy.vx = Math.cos(enemy.age * 1.4 + enemy.phase) * 120;
      enemy.fireTimer -= dt;
      if (enemy.fireTimer <= 0 && enemy.y < player.y - 40) {
        enemy.fireTimer = state.random.range(1.5, 2.3);
        const dx = player.x - enemy.x;
        const dy = player.y - enemy.y;
        const len = Math.hypot(dx, dy) || 1;
        const speed = 320;
        state.enemyBullets.push({
          x: enemy.x,
          y: enemy.y + enemy.radius,
          vx: (dx / len) * speed,
          vy: (dy / len) * speed,
          radius: 5,
        });
        audio.enemyShoot();
      }
    } else if (enemy.kind === 'brute') {
      enemy.vy = ENEMY.brute.speed * speedMul;
      enemy.vx = Math.sin(enemy.age * 0.8 + enemy.phase) * 40;
      enemy.fireTimer -= dt;
      if (enemy.fireTimer <= 0 && enemy.y > 40 && enemy.y < player.y - 60) {
        enemy.fireTimer = state.random.range(2.4, 3.2);
        for (const angle of [-0.35, 0, 0.35]) {
          const dx = player.x - enemy.x;
          const dy = player.y - enemy.y;
          const base = Math.atan2(dy, dx) + angle;
          state.enemyBullets.push({
            x: enemy.x,
            y: enemy.y + enemy.radius,
            vx: Math.cos(base) * 260,
            vy: Math.sin(base) * 260,
            radius: 5,
          });
        }
        audio.enemyShoot();
      }
    } else if (enemy.kind === 'maw') {
      updateMaw(state, enemy, dt, audio);
    }
    enemy.x += enemy.vx * dt;
    enemy.y += enemy.vy * dt;
    if (enemy.kind !== 'maw') {
      enemy.x = Math.max(enemy.radius, Math.min(FIELD.width - enemy.radius, enemy.x));
    }
  }
}

/** The Void Maw boss: it parks near the top, strafes, and cycles three attacks. */
function updateMaw(state, maw, dt, audio) {
  const player = state.player;
  if (maw.y < 150) {
    maw.vy = ENEMY.maw.speed;
    maw.vx = 0;
    return;
  }
  maw.vy = 0;
  maw.vx = Math.sin(maw.age * 0.7) * 130;
  maw.attackTimer -= dt;
  if (maw.attackTimer > 0) return;
  maw.pattern = (maw.pattern + 1) % 3;
  if (maw.pattern === 0) {
    // Radial ring of bullets.
    maw.attackTimer = 2.6;
    for (let i = 0; i < 16; i += 1) {
      const angle = (i / 16) * Math.PI * 2 + maw.phase;
      state.enemyBullets.push({
        x: maw.x,
        y: maw.y + maw.radius * 0.6,
        vx: Math.cos(angle) * 190,
        vy: Math.sin(angle) * 190,
        radius: 6,
      });
    }
  } else if (maw.pattern === 1) {
    // Aimed fan at the player.
    maw.attackTimer = 1.8;
    const base = Math.atan2(player.y - maw.y, player.x - maw.x);
    for (const offset of [-0.4, -0.2, 0, 0.2, 0.4]) {
      state.enemyBullets.push({
        x: maw.x,
        y: maw.y + maw.radius * 0.6,
        vx: Math.cos(base + offset) * 330,
        vy: Math.sin(base + offset) * 330,
        radius: 6,
      });
    }
  } else {
    // Spawn a pack of drifters from its flanks.
    maw.attackTimer = 3.2;
    for (const side of [-1, 1]) {
      spawnEnemy(state, 'drifter', maw.x + side * maw.radius, maw.y + 20);
    }
  }
  audio.enemyShoot();
}

/** Step the player's bullets and the enemy bullets; drop the ones that left the field. */
export function updateBullets(state, dt) {
  for (const bullet of state.bullets) {
    bullet.x += bullet.vx * dt;
    bullet.y += bullet.vy * dt;
  }
  state.bullets = state.bullets.filter(
    (b) => b.y > -20 && b.y < FIELD.height + 20 && b.x > -20 && b.x < FIELD.width + 20,
  );
  for (const bullet of state.enemyBullets) {
    bullet.x += bullet.vx * dt;
    bullet.y += bullet.vy * dt;
  }
  state.enemyBullets = state.enemyBullets.filter(
    (b) => b.y > -20 && b.y < FIELD.height + 20 && b.x > -20 && b.x < FIELD.width + 20,
  );
}

/** Roll for a power-up drop where an enemy died. */
export function maybeDropPowerup(state, x, y) {
  if (state.random.next() > POWERUP.dropChance) return;
  const roll = state.random.next();
  const kind = roll < POWERUP.lifeChance ? 'life' : state.random.pick(POWERUP.kinds.filter((k) => k !== 'life'));
  state.powerups.push({ kind, x, y, vy: POWERUP.fallSpeed, age: 0, life: POWERUP.life });
}

/** Step power-ups: they drift down and blink out when their life runs out. */
export function updatePowerups(state, dt) {
  for (const powerup of state.powerups) {
    powerup.y += powerup.vy * dt;
    powerup.age += dt;
  }
  state.powerups = state.powerups.filter((p) => p.age < p.life && p.y < FIELD.height + 20);
}

/** A burst of sparks at a point. */
export function burst(state, x, y, colour, count, speed = 260) {
  for (let i = 0; i < count; i += 1) {
    const angle = state.random.next() * Math.PI * 2;
    const power = state.random.range(0.3, 1) * speed;
    state.particles.push({
      x,
      y,
      vx: Math.cos(angle) * power,
      vy: Math.sin(angle) * power,
      life: state.random.range(0.25, 0.7),
      maxLife: 0.7,
      size: state.random.range(2, 5),
      colour,
    });
  }
}

/** A bomb: a shockwave that hurts every enemy and wipes the enemy bullets. */
export function detonateBomb(state, audio) {
  const player = state.player;
  burst(state, player.x, player.y, '#ffd166', 40, 420);
  burst(state, player.x, player.y, '#ff5d73', 24, 300);
  for (const enemy of state.enemies) {
    enemy.hp -= BOMB.damage;
  }
  state.enemyBullets = [];
  state.shake = Math.max(state.shake, 14);
  audio.bomb();
}

/** Step particles and floating score text; drop the spent ones. */
export function updateParticles(state, dt) {
  for (const particle of state.particles) {
    particle.x += particle.vx * dt;
    particle.y += particle.vy * dt;
    particle.vx *= 0.98;
    particle.vy *= 0.98;
    particle.life -= dt;
  }
  state.particles = state.particles.filter((p) => p.life > 0);
  for (const floater of state.floaters) {
    floater.y -= 42 * dt;
    floater.life -= dt;
  }
  state.floaters = state.floaters.filter((f) => f.life > 0);
}

/** A score number that floats up from a kill and fades. */
export function addFloater(state, x, y, text, colour = '#ffd166') {
  state.floaters.push({ x, y, text, life: 0.9, colour });
}
