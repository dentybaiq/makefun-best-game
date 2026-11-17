// VOIDSTORM — every tuning number and colour in one place. The playfield is a fixed
// 1280x720 logical area; the renderer scales it to the window, so no rule below depends
// on the screen size. The game is a neon arena shooter: fly, shoot the swarm, grab
// power-ups, survive the waves, and break the Void Maw every fifth wave.

export const FIELD = { width: 1280, height: 720 };

/** The simulation's fixed step, in seconds: 60 updates a second whatever the display's rate. */
export const STEP = 1 / 60;

export const PLAYER = {
  radius: 16,
  speed: 420,
  fireInterval: 0.16,
  bulletSpeed: 780,
  bulletDamage: 1,
  invulnerable: 2.0,
  bombs: 2,
};

export const LIVES = 3;

/** Enemy kinds: how they move, how tough they are, what they are worth. */
export const ENEMY = {
  drifter: { radius: 15, speed: 120, hp: 1, score: 50, colour: '#ff5d73' },
  weaver: { radius: 14, speed: 170, hp: 2, score: 100, colour: '#ffb02e' },
  gunner: { radius: 17, speed: 90, hp: 3, score: 150, colour: '#c77dff' },
  brute: { radius: 30, speed: 55, hp: 9, score: 300, colour: '#ff4d6d' },
  maw: { radius: 64, speed: 40, hp: 120, score: 5000, colour: '#ff2e63' },
};

/** A wave is a budget of spawn points; each enemy kind costs points from it. */
export const WAVE = {
  budgetBase: 10,
  budgetPerWave: 6,
  spawnInterval: 0.9,
  spawnIntervalMin: 0.35,
  breather: 3.0,
  bossEvery: 5,
};

/** Combo: each kill adds one; it decays after a few seconds without a kill. */
export const COMBO = { window: 4.0, step: 0.1, cap: 5.0 };

export const POWERUP = {
  radius: 13,
  fallSpeed: 70,
  life: 9,
  dropChance: 0.16,
  kinds: ['spread', 'rapid', 'shield', 'bomb', 'life'],
  lifeChance: 0.06,
};

export const BOMB = { radius: 520, damage: 6, clearBullets: true };

/** Seconds of play per level of difficulty growth; spawn rates stop growing at max. */
export const DIFFICULTY = { perWaveSpeed: 0.04, maxSpeedMul: 1.9 };

export const PALETTE = {
  backdrop: '#070312',
  nebula1: '#1b1040',
  nebula2: '#3d0c4d',
  nebula3: '#0c2b4d',
  grid: 'rgba(120, 90, 255, 0.07)',
  player: '#4df3ff',
  playerCore: '#e8feff',
  bullet: '#7df9ff',
  enemyBullet: '#ff6b9d',
  particle: '#ffd166',
  panel: 'rgba(10, 8, 28, 0.82)',
  panelEdge: '#4d2a86',
  text: '#eef1ff',
  muted: '#9a94c7',
  gold: '#ffd166',
  danger: '#ff4d6d',
};

export const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';

/** Where the best score is kept between visits (this browser only). */
export const BEST_KEY = 'voidstorm.best';
