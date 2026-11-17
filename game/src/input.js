// Keyboard and mouse input, read once per frame. Movement is a direction vector from
// WASD or the arrow keys; firing is Space (held) or the mouse button (held); X or a
// right-click spends a bomb; P pauses; Enter or Space confirms on the menus.

export const ACTION_CONFIRM = 1;
export const ACTION_PAUSE = 2;
export const ACTION_BOMB = 4;

const MOVE_KEYS = {
  ArrowUp: [0, -1],
  KeyW: [0, -1],
  ArrowDown: [0, 1],
  KeyS: [0, 1],
  ArrowLeft: [-1, 0],
  KeyA: [-1, 0],
  ArrowRight: [1, 0],
  KeyD: [1, 0],
};

export function createInput(canvas) {
  const held = new Set();
  let actions = 0;
  let firing = false;
  let mouse = { x: 0, y: 0, inside: false };

  function press(code) {
    if (code === 'Space' || code === 'Enter') actions |= ACTION_CONFIRM;
    else if (code === 'KeyP' || code === 'Escape') actions |= ACTION_PAUSE;
    else if (code === 'KeyX') actions |= ACTION_BOMB;
  }

  window.addEventListener('keydown', (event) => {
    if (event.repeat) return;
    held.add(event.code);
    press(event.code);
    if (event.code === 'Space' || event.code.startsWith('Arrow')) event.preventDefault();
  });
  window.addEventListener('keyup', (event) => {
    held.delete(event.code);
    if (event.code === 'Space') firing = held.has('Space') || firingMouse;
  });

  let firingMouse = false;
  canvas.addEventListener('pointerdown', (event) => {
    if (event.button === 2) {
      actions |= ACTION_BOMB;
      return;
    }
    firingMouse = true;
    firing = true;
    actions |= ACTION_CONFIRM;
    const rect = canvas.getBoundingClientRect();
    mouse = { x: event.clientX - rect.left, y: event.clientY - rect.top, inside: true };
  });
  window.addEventListener('pointerup', (event) => {
    if (event.button === 0) {
      firingMouse = false;
      firing = held.has('Space');
    }
  });
  canvas.addEventListener('pointermove', (event) => {
    const rect = canvas.getBoundingClientRect();
    mouse = { x: event.clientX - rect.left, y: event.clientY - rect.top, inside: true };
  });
  canvas.addEventListener('contextmenu', (event) => event.preventDefault());

  return {
    /** The movement direction this frame, normalised, or [0, 0]. */
    direction() {
      let x = 0;
      let y = 0;
      for (const code of held) {
        const move = MOVE_KEYS[code];
        if (move) {
          x += move[0];
          y += move[1];
        }
      }
      if (x === 0 && y === 0) return [0, 0];
      const length = Math.hypot(x, y);
      return [x / length, y / length];
    },
    get firing() {
      return firing || held.has('Space');
    },
    get mouse() {
      return mouse;
    },
    /** The one-shot actions pressed since the last call; reading clears them. */
    takeActions() {
      const taken = actions;
      actions = 0;
      return taken;
    },
  };
}
