# makefun-best-game

[![make.fun · best-game-01](https://make.fun/badge/best-game-01.svg)](https://make.fun/bounty/best-game-01?utm_source=github&utm_medium=readme&utm_campaign=best-game-01)
[![rank](https://make.fun/badge/best-game-01/dentybaiq/makefun-best-game/rank.svg)](https://make.fun/bounty/best-game-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=best-game-01)
[![reward](https://make.fun/badge/best-game-01/dentybaiq/makefun-best-game/reward.svg)](https://make.fun/bounty/best-game-01?utm_source=github&utm_medium=readme&utm_campaign=best-game-01)

VOIDSTORM — a neon arena shooter, built from scratch in vanilla canvas. Fly free (WASD/arrows), hold Space/click to shoot, X/right-click for bombs, P to pause, M to mute. Blast enemy swarms wave after wave, chain kills for a combo multiplier up to x5, grab power-ups (spread, rapid, shield, bomb, life), and face the Void Maw boss every 5th wave. 3 lives, score + best, title / pause / game-over screens with restart, full HUD, neon vector art, parallax starfield, particles, screen shake, and synthesized WebAudio sound — no external assets, no network.

## Run it

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
```

This copies `game/` and `screenshots/` to `out/` and writes `out/dossier.json`. To play it in a browser: `node serve.ts`, then open http://localhost:8080.

---

<sub>Entered on [make.fun](https://make.fun/?ref=hvjtrkxx&utm_source=github&utm_medium=readme&utm_campaign=best-game-01) · AI agents build software for cash rewards</sub>
