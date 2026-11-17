// The renderer: everything the player sees is drawn here, on one canvas, with vector
// shapes and glow — no image files. The logical field is 1280x720 and is scaled to fit
// the window; the game world never learns the window size.

import { FIELD, FONT, PALETTE } from './config.js';
import { createRandom } from './random.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_OVER = 'over';

const STAR_LAYERS = [
  { count: 96, speed: 12, size: 1, alpha: 0.6 },
  { count: 64, speed: 30, size: 1.6, alpha: 0.85 },
  { count: 32, speed: 60, size: 2.4, alpha: 1 },
];

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  const random = createRandom(1337);
  const stars = STAR_LAYERS.map((layer) =>
    Array.from({ length: layer.count }, () => ({
      x: random.next() * FIELD.width,
      y: random.next() * FIELD.height,
      ...layer,
    })),
  );
  const nebulas = Array.from({ length: 5 }, (_, i) => ({
    x: random.next() * FIELD.width,
    y: random.next() * FIELD.height,
    radius: random.range(180, 320),
    colour: ['#1b1040', '#3d0c4d', '#0c2b4d'][i % 3],
  }));

  function fit() {
    const scale = Math.min(window.innerWidth / FIELD.width, window.innerHeight / FIELD.height);
    canvas.width = Math.floor(FIELD.width * scale);
    canvas.height = Math.floor(FIELD.height * scale);
    canvas.style.width = `${canvas.width}px`;
    canvas.style.height = `${canvas.height}px`;
    return scale;
  }

  let scale = fit();
  window.addEventListener('resize', () => {
    scale = fit();
  });

  function drawBackground(dt, time) {
    ctx.fillStyle = PALETTE.backdrop;
    ctx.fillRect(0, 0, FIELD.width, FIELD.height);
    for (const nebula of nebulas) {
      const gradient = ctx.createRadialGradient(nebula.x, nebula.y, 0, nebula.x, nebula.y, nebula.radius);
      gradient.addColorStop(0, nebula.colour);
      gradient.addColorStop(1, 'rgba(7, 3, 18, 0)');
      ctx.fillStyle = gradient;
      ctx.fillRect(nebula.x - nebula.radius, nebula.y - nebula.radius, nebula.radius * 2, nebula.radius * 2);
    }
    for (const layer of stars) {
      for (const star of layer) {
        star.y += layer.speed * dt;
        if (star.y > FIELD.height) {
          star.y = -2;
          star.x = random.next() * FIELD.width;
        }
        ctx.globalAlpha = layer.alpha * (0.7 + 0.3 * Math.sin(time * 2 + star.x));
        ctx.fillStyle = '#cdd7ff';
        ctx.fillRect(star.x, star.y, layer.size, layer.size);
      }
    }
    ctx.globalAlpha = 1;
  }

  function drawShip(x, y, radius, tilt, colour, core) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(tilt);
    ctx.shadowColor = colour;
    ctx.shadowBlur = 18;
    ctx.fillStyle = colour;
    ctx.beginPath();
    ctx.moveTo(0, -radius - 6);
    ctx.lineTo(radius * 0.75, radius * 0.7);
    ctx.lineTo(radius * 0.35, radius * 0.3);
    ctx.lineTo(-radius * 0.35, radius * 0.3);
    ctx.lineTo(-radius * 0.75, radius * 0.7);
    ctx.closePath();
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.fillStyle = core;
    ctx.beginPath();
    ctx.arc(0, -radius * 0.2, radius * 0.28, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function drawEnemy(enemy, time) {
    ctx.save();
    ctx.translate(enemy.x, enemy.y);
    ctx.shadowColor = enemy.colour;
    ctx.shadowBlur = 14;
    ctx.fillStyle = enemy.colour;
    ctx.strokeStyle = enemy.colour;
    ctx.lineWidth = 2;
    if (enemy.kind === 'drifter') {
      ctx.rotate(enemy.age * 1.5 + enemy.phase);
      ctx.beginPath();
      for (let i = 0; i < 8; i += 1) {
        const angle = (i / 8) * Math.PI * 2;
        const r = enemy.radius * (i % 2 === 0 ? 1 : 0.7);
        const px = Math.cos(angle) * r;
        const py = Math.sin(angle) * r;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.fill();
    } else if (enemy.kind === 'weaver') {
      ctx.rotate(Math.sin(enemy.age * 2) * 0.4);
      ctx.beginPath();
      ctx.moveTo(0, -enemy.radius);
      ctx.lineTo(enemy.radius, 0);
      ctx.lineTo(0, enemy.radius);
      ctx.lineTo(-enemy.radius, 0);
      ctx.closePath();
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.fillStyle = '#fff3d6';
      ctx.beginPath();
      ctx.arc(0, 0, enemy.radius * 0.3, 0, Math.PI * 2);
      ctx.fill();
    } else if (enemy.kind === 'gunner') {
      ctx.rotate(Math.sin(enemy.age) * 0.2);
      ctx.beginPath();
      for (let i = 0; i < 6; i += 1) {
        const angle = (i / 6) * Math.PI * 2;
        const px = Math.cos(angle) * enemy.radius;
        const py = Math.sin(angle) * enemy.radius;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#2a1040';
      ctx.beginPath();
      ctx.arc(0, 0, enemy.radius * 0.45, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#ffd166';
      ctx.fillRect(-2, enemy.radius * 0.4, 4, enemy.radius * 0.7);
    } else if (enemy.kind === 'brute') {
      ctx.rotate(enemy.age * 0.4);
      ctx.beginPath();
      for (let i = 0; i < 5; i += 1) {
        const angle = (i / 5) * Math.PI * 2 - Math.PI / 2;
        const px = Math.cos(angle) * enemy.radius;
        const py = Math.sin(angle) * enemy.radius;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.strokeStyle = '#ffd166';
      ctx.beginPath();
      ctx.arc(0, 0, enemy.radius * 0.55, 0, Math.PI * 2);
      ctx.stroke();
    } else if (enemy.kind === 'maw') {
      const pulse = 1 + Math.sin(time * 4) * 0.05;
      ctx.scale(pulse, pulse);
      ctx.rotate(Math.sin(enemy.age * 0.5) * 0.08);
      ctx.beginPath();
      for (let i = 0; i < 12; i += 1) {
        const angle = (i / 12) * Math.PI * 2;
        const r = enemy.radius * (i % 2 === 0 ? 1.15 : 0.85);
        const px = Math.cos(angle) * r;
        const py = Math.sin(angle) * r;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.fillStyle = '#1a0510';
      ctx.beginPath();
      ctx.arc(0, 0, enemy.radius * 0.55, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#ff2e63';
      ctx.beginPath();
      ctx.arc(0, 0, enemy.radius * 0.3 + Math.sin(time * 6) * 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(0, 0, enemy.radius * 0.12, 0, Math.PI * 2);
      ctx.fill();
      // Boss health ring.
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.35)';
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.arc(0, 0, enemy.radius + 12, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * (enemy.hp / enemy.maxHp));
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawPowerup(powerup, time) {
    const colours = { spread: '#4df3ff', rapid: '#ffd166', shield: '#7dff9e', bomb: '#ff9f1c', life: '#ff5d73' };
    const labels = { spread: 'S', rapid: 'R', shield: 'H', bomb: 'B', life: '+1' };
    const bob = Math.sin(time * 3 + powerup.x) * 3;
    ctx.save();
    ctx.translate(powerup.x, powerup.y + bob);
    ctx.shadowColor = colours[powerup.kind];
    ctx.shadowBlur = 16;
    ctx.fillStyle = colours[powerup.kind];
    ctx.beginPath();
    ctx.arc(0, 0, 13, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#0a0618';
    ctx.font = `bold ${powerup.kind === 'life' ? 11 : 15}px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(labels[powerup.kind], 0, 1);
    ctx.restore();
  }

  function drawHud(world, best) {
    const player = world.player;
    ctx.save();
    ctx.fillStyle = PALETTE.panel;
    ctx.fillRect(0, 0, FIELD.width, 54);
    ctx.strokeStyle = PALETTE.panelEdge;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, 54.5);
    ctx.lineTo(FIELD.width, 54.5);
    ctx.stroke();
    ctx.textBaseline = 'middle';
    ctx.fillStyle = PALETTE.text;
    ctx.font = `bold 22px ${FONT}`;
    ctx.textAlign = 'left';
    ctx.fillText(`SCORE ${world.score.toLocaleString('en-US')}`, 18, 28);
    ctx.font = `16px ${FONT}`;
    ctx.fillStyle = PALETTE.muted;
    ctx.fillText(`BEST ${Math.max(best, world.score).toLocaleString('en-US')}`, 230, 29);
    ctx.textAlign = 'center';
    ctx.fillStyle = PALETTE.text;
    ctx.font = `bold 20px ${FONT}`;
    const hostiles = world.enemies.length + world.spawnQueue.length;
    ctx.fillText(
      world.wave === 0 ? 'GET READY' : `WAVE ${world.wave}${hostiles > 0 ? ` · ${hostiles} LEFT` : ''}`,
      FIELD.width / 2,
      28,
    );
    if (world.combo > 1) {
      ctx.fillStyle = '#ff9f1c';
      ctx.font = `bold 18px ${FONT}`;
      ctx.fillText(`COMBO x${Math.min(1 + world.combo * 0.1, 5).toFixed(1)}`, FIELD.width / 2, 48);
    }
    // Lives as little ships.
    ctx.textAlign = 'right';
    for (let i = 0; i < world.lives; i += 1) {
      drawShip(FIELD.width - 24 - i * 30, 28, 10, 0, PALETTE.player, PALETTE.playerCore);
    }
    // Bombs.
    ctx.font = `bold 16px ${FONT}`;
    ctx.fillStyle = '#ff9f1c';
    ctx.fillText(`BOMBS ${player.bombs}  [X]`, FIELD.width - 24 - Math.max(world.lives, 1) * 30 - 10, 29);
    // Active power-up timers.
    ctx.textAlign = 'left';
    ctx.font = `15px ${FONT}`;
    let line = 0;
    if (player.spread > 0) {
      ctx.fillStyle = '#4df3ff';
      ctx.fillText(`SPREAD x${player.spread + 1}`, 18, 76 + line * 20);
      line += 1;
    }
    if (player.rapidTimer > 0) {
      ctx.fillStyle = '#ffd166';
      ctx.fillText(`RAPID ${Math.ceil(player.rapidTimer)}s`, 18, 76 + line * 20);
      line += 1;
    }
    if (player.shieldTimer > 0) {
      ctx.fillStyle = '#7dff9e';
      ctx.fillText(`SHIELD ${Math.ceil(player.shieldTimer)}s`, 18, 76 + line * 20);
      line += 1;
    }
    ctx.restore();
  }

  function drawBanner(world) {
    if (world.bannerTimer <= 0 || world.banner === '') return;
    const alpha = Math.min(1, world.bannerTimer);
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.shadowColor = '#7b2fff';
    ctx.shadowBlur = 24;
    ctx.fillStyle = '#ffffff';
    ctx.font = `bold 44px ${FONT}`;
    ctx.fillText(world.banner, FIELD.width / 2, FIELD.height / 2 - 120);
    ctx.restore();
  }

  function drawTitle(world, best) {
    ctx.save();
    ctx.fillStyle = 'rgba(7, 3, 18, 0.55)';
    ctx.fillRect(0, 0, FIELD.width, FIELD.height);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.shadowColor = '#7b2fff';
    ctx.shadowBlur = 34;
    ctx.fillStyle = '#ffffff';
    ctx.font = `bold 92px ${FONT}`;
    ctx.fillText('VOIDSTORM', FIELD.width / 2, 200);
    ctx.shadowColor = '#ff2e63';
    ctx.shadowBlur = 18;
    ctx.fillStyle = '#ff5d73';
    ctx.font = `bold 26px ${FONT}`;
    ctx.fillText('A NEON ARENA SHOOTER', FIELD.width / 2, 258);
    ctx.shadowBlur = 0;
    ctx.fillStyle = PALETTE.text;
    ctx.font = `19px ${FONT}`;
    ctx.fillText('Fly with WASD or Arrow keys — hold SPACE or CLICK to fire', FIELD.width / 2, 330);
    ctx.fillText('X or RIGHT-CLICK spends a bomb  •  P pauses  •  M mutes', FIELD.width / 2, 360);
    ctx.fillStyle = PALETTE.gold;
    ctx.fillText('Blast the swarm. Chain kills for combos. Graze bullets for bonus points.', FIELD.width / 2, 400);
    ctx.fillText('Break the Void Maw every 5th wave.', FIELD.width / 2, 428);
    const blink = Math.sin(world.time * 4) > -0.2;
    if (blink) {
      ctx.fillStyle = '#ffffff';
      ctx.font = `bold 26px ${FONT}`;
      ctx.fillText('PRESS SPACE OR CLICK TO START', FIELD.width / 2, 480);
    }
    if (best > 0) {
      ctx.fillStyle = PALETTE.muted;
      ctx.font = `18px ${FONT}`;
      ctx.fillText(`BEST SCORE ${best.toLocaleString('en-US')}`, FIELD.width / 2, 530);
    }
    ctx.restore();
  }

  function drawPaused() {
    ctx.save();
    ctx.fillStyle = 'rgba(7, 3, 18, 0.65)';
    ctx.fillRect(0, 0, FIELD.width, FIELD.height);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#ffffff';
    ctx.font = `bold 52px ${FONT}`;
    ctx.fillText('PAUSED', FIELD.width / 2, FIELD.height / 2 - 20);
    ctx.fillStyle = PALETTE.muted;
    ctx.font = `20px ${FONT}`;
    ctx.fillText('Press P or Space to resume', FIELD.width / 2, FIELD.height / 2 + 30);
    ctx.restore();
  }

  function drawOver(world, best) {
    ctx.save();
    ctx.fillStyle = 'rgba(7, 3, 18, 0.72)';
    ctx.fillRect(0, 0, FIELD.width, FIELD.height);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.shadowColor = '#ff2e63';
    ctx.shadowBlur = 26;
    ctx.fillStyle = '#ff5d73';
    ctx.font = `bold 68px ${FONT}`;
    ctx.fillText('GAME OVER', FIELD.width / 2, 240);
    ctx.shadowBlur = 0;
    ctx.fillStyle = PALETTE.text;
    ctx.font = `bold 30px ${FONT}`;
    ctx.fillText(`SCORE  ${world.score.toLocaleString('en-US')}`, FIELD.width / 2, 320);
    ctx.font = `20px ${FONT}`;
    ctx.fillStyle = world.score >= best && world.score > 0 ? PALETTE.gold : PALETTE.muted;
    ctx.fillText(
      world.score >= best && world.score > 0 ? '★ NEW BEST SCORE ★' : `BEST  ${best.toLocaleString('en-US')}`,
      FIELD.width / 2,
      360,
    );
    ctx.fillStyle = PALETTE.text;
    ctx.font = `18px ${FONT}`;
    ctx.fillText(`Waves cleared: ${Math.max(0, world.wave - 1)}   •   Kills: ${world.kills}`, FIELD.width / 2, 400);
    const blink = Math.sin(world.time * 4) > -0.2;
    if (blink) {
      ctx.fillStyle = '#ffffff';
      ctx.font = `bold 24px ${FONT}`;
      ctx.fillText('PRESS SPACE OR CLICK TO PLAY AGAIN', FIELD.width / 2, 480);
    }
    ctx.restore();
  }

  return {
    draw(world, screen, best) {
      const dt = 1 / 60;
      ctx.setTransform(scale, 0, 0, scale, 0, 0);
      const shakeX = world.shake > 0 ? (Math.random() - 0.5) * world.shake : 0;
      const shakeY = world.shake > 0 ? (Math.random() - 0.5) * world.shake : 0;
      ctx.translate(shakeX, shakeY);
      drawBackground(dt, world.time);

      for (const powerup of world.powerups) drawPowerup(powerup, world.time);
      for (const enemy of world.enemies) drawEnemy(enemy, world.time);
      for (const bullet of world.bullets) {
        ctx.save();
        ctx.shadowColor = '#7df9ff';
        ctx.shadowBlur = 10;
        ctx.fillStyle = PALETTE.bullet;
        ctx.beginPath();
        ctx.arc(bullet.x, bullet.y, bullet.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
      for (const bullet of world.enemyBullets) {
        ctx.save();
        ctx.shadowColor = '#ff6b9d';
        ctx.shadowBlur = 10;
        ctx.fillStyle = PALETTE.enemyBullet;
        ctx.beginPath();
        ctx.arc(bullet.x, bullet.y, bullet.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
      for (const particle of world.particles) {
        ctx.globalAlpha = Math.max(0, particle.life / particle.maxLife);
        ctx.fillStyle = particle.colour;
        ctx.fillRect(particle.x - particle.size / 2, particle.y - particle.size / 2, particle.size, particle.size);
      }
      ctx.globalAlpha = 1;

      const player = world.player;
      if (player.alive) {
        if (player.shieldTimer > 0) {
          ctx.save();
          ctx.strokeStyle = 'rgba(125, 255, 158, 0.8)';
          ctx.lineWidth = 2;
          ctx.shadowColor = '#7dff9e';
          ctx.shadowBlur = 14;
          ctx.beginPath();
          ctx.arc(player.x, player.y, player.radius + 10, 0, Math.PI * 2);
          ctx.stroke();
          ctx.restore();
        }
        const blink = player.invulnerable > 0 && Math.floor(world.time * 12) % 2 === 0;
        if (!blink) {
          // Engine flame.
          const flame = 10 + Math.sin(world.time * 40) * 5;
          ctx.save();
          ctx.fillStyle = '#ff9f1c';
          ctx.shadowColor = '#ff9f1c';
          ctx.shadowBlur = 12;
          ctx.beginPath();
          ctx.moveTo(player.x - 6, player.y + player.radius * 0.7);
          ctx.lineTo(player.x, player.y + player.radius + flame);
          ctx.lineTo(player.x + 6, player.y + player.radius * 0.7);
          ctx.closePath();
          ctx.fill();
          ctx.restore();
          drawShip(player.x, player.y, player.radius, player.tilt, PALETTE.player, PALETTE.playerCore);
        }
      }

      for (const floater of world.floaters) {
        ctx.save();
        ctx.globalAlpha = Math.min(1, floater.life / 0.5);
        ctx.fillStyle = floater.colour;
        ctx.font = `bold 17px ${FONT}`;
        ctx.textAlign = 'center';
        ctx.fillText(floater.text, floater.x, floater.y);
        ctx.restore();
      }

      if (screen === SCREEN_PLAY || screen === SCREEN_PAUSED) drawHud(world, best);
      drawBanner(world);
      if (screen === SCREEN_TITLE) drawTitle(world, best);
      else if (screen === SCREEN_PAUSED) drawPaused();
      else if (screen === SCREEN_OVER) drawOver(world, best);
    },
  };
}
