// All sound is synthesised with WebAudio — no audio files, no network. The context is
// created lazily on the first user gesture (browsers block audio before one), and every
// call is guarded so a missing audio device never breaks the game.

export function createAudio() {
  let context = null;
  let master = null;
  let drone = null;
  let muted = false;

  function ensure() {
    if (context) {
      if (context.state === 'suspended') context.resume().catch(() => {});
      return context;
    }
    try {
      const AudioContext = window.AudioContext ?? window.webkitAudioContext;
      if (!AudioContext) return null;
      context = new AudioContext();
      master = context.createGain();
      master.gain.value = 0.35;
      master.connect(context.destination);
    } catch {
      context = null;
    }
    return context;
  }

  function tone({ type = 'sine', from = 440, to = null, duration = 0.15, volume = 0.2, delay = 0 }) {
    const ctx = ensure();
    if (!ctx || muted) return;
    try {
      const start = ctx.currentTime + delay;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(from, start);
      if (to !== null) osc.frequency.exponentialRampToValueAtTime(Math.max(1, to), start + duration);
      gain.gain.setValueAtTime(volume, start);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
      osc.connect(gain);
      gain.connect(master);
      osc.start(start);
      osc.stop(start + duration + 0.02);
    } catch {
      // Sound is garnish: never let it stop the game.
    }
  }

  function noise({ duration = 0.3, volume = 0.3, lowpass = 1200 }) {
    const ctx = ensure();
    if (!ctx || muted) return;
    try {
      const start = ctx.currentTime;
      const length = Math.max(1, Math.floor(ctx.sampleRate * duration));
      const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < length; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / length);
      const source = ctx.createBufferSource();
      source.buffer = buffer;
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = lowpass;
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(volume, start);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
      source.connect(filter);
      filter.connect(gain);
      gain.connect(master);
      source.start(start);
    } catch {
      // Sound is garnish: never let it stop the game.
    }
  }

  return {
    /** Call from any user gesture so the browser lets audio start. */
    unlock() {
      ensure();
    },
    shoot() {
      tone({ type: 'square', from: 880, to: 320, duration: 0.08, volume: 0.08 });
    },
    enemyShoot() {
      tone({ type: 'sawtooth', from: 300, to: 180, duration: 0.12, volume: 0.05 });
    },
    explosion(big = false) {
      noise({ duration: big ? 0.6 : 0.3, volume: big ? 0.4 : 0.22, lowpass: big ? 900 : 1600 });
      tone({ type: 'sine', from: 160, to: 40, duration: big ? 0.5 : 0.25, volume: 0.25 });
    },
    hit() {
      tone({ type: 'sawtooth', from: 200, to: 60, duration: 0.25, volume: 0.3 });
      noise({ duration: 0.2, volume: 0.2, lowpass: 800 });
    },
    powerup() {
      tone({ type: 'sine', from: 523, duration: 0.1, volume: 0.18 });
      tone({ type: 'sine', from: 659, duration: 0.1, volume: 0.18, delay: 0.08 });
      tone({ type: 'sine', from: 784, duration: 0.18, volume: 0.2, delay: 0.16 });
    },
    bomb() {
      noise({ duration: 0.9, volume: 0.4, lowpass: 700 });
      tone({ type: 'sine', from: 120, to: 30, duration: 0.8, volume: 0.35 });
    },
    waveClear() {
      tone({ type: 'triangle', from: 392, duration: 0.12, volume: 0.16 });
      tone({ type: 'triangle', from: 523, duration: 0.12, volume: 0.16, delay: 0.1 });
      tone({ type: 'triangle', from: 659, duration: 0.22, volume: 0.18, delay: 0.2 });
    },
    bossAlarm() {
      tone({ type: 'sawtooth', from: 220, to: 440, duration: 0.4, volume: 0.14 });
      tone({ type: 'sawtooth', from: 220, to: 440, duration: 0.4, volume: 0.14, delay: 0.45 });
    },
    /** A quiet two-note drone under the game; started once, at low volume. */
    startDrone() {
      const ctx = ensure();
      if (!ctx || drone || muted) return;
      try {
        drone = [];
        for (const freq of [55, 82.5]) {
          const osc = ctx.createOscillator();
          osc.type = 'triangle';
          osc.frequency.value = freq;
          const gain = ctx.createGain();
          gain.gain.value = 0.035;
          const lfo = ctx.createOscillator();
          lfo.frequency.value = 0.07;
          const lfoGain = ctx.createGain();
          lfoGain.gain.value = 0.015;
          lfo.connect(lfoGain);
          lfoGain.connect(gain.gain);
          osc.connect(gain);
          gain.connect(master);
          osc.start();
          lfo.start();
          drone.push(osc, lfo);
        }
      } catch {
        drone = null;
      }
    },
    toggleMute() {
      muted = !muted;
      if (master) master.gain.value = muted ? 0 : 0.35;
      return muted;
    },
  };
}
