// A tiny seeded random source (mulberry32) so a game can be replayed exactly from its
// seed: the same seed always deals the same waves, and the screenshot scenes are stable.

export function createRandom(seed) {
  let state = seed >>> 0;
  if (state === 0) state = 0x9e3779b9;
  return {
    /** A float in [0, 1). */
    next() {
      state |= 0;
      state = (state + 0x6d2b79f5) | 0;
      let t = Math.imul(state ^ (state >>> 15), 1 | state);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    },
    /** An integer in [min, max). */
    int(min, max) {
      return min + Math.floor(this.next() * (max - min));
    },
    /** A float in [min, max). */
    range(min, max) {
      return min + this.next() * (max - min);
    },
    /** One element of an array, uniformly. */
    pick(list) {
      return list[Math.floor(this.next() * list.length)];
    },
  };
}
