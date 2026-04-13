import { noact } from './utils/noact.js';

let animationId = null, buttonState, axesState, gp, pt, dt, bState, aState, y0, x0, y1, x1;
let mouse;
const HELD_DURATION = 50;
const DEADZONE = 0.01; // 1% deadzone

class InputHandler {
  _listeners = new Map();

  addEventListener(index, event, callback) {
    this._listeners.set(`${index}$${event}`, callback);
  }
  removeEventListener(index, event) {
    this._listeners.delete(`${index}$${event}`);
  }

  trigger(index, event, value = null) {
    const func = this._listeners.get(`${index}$${event}`);
    if (func) func(value); // preserve `this`
  }
  clearAll() {
    this._listeners = new Map();
  }
};

const buttonHandler = new InputHandler();
const axesHandler = new InputHandler();

let c = 0; // TEST LOGGING

function deadzone(val) {
  const aVal = Math.abs(val);
  return aVal > DEADZONE ? val : 0;
}

function inputLoop(ts) { // polls inputs at roughly the user's display refresh rate
  [gp] = navigator.getGamepads();
  if (!gp.connected) return;

  pt ??= ts - 16; // init assuming 60Hz
  dt = ts - pt;
  pt = ts;

  gp.buttons.forEach((b, i) => {
    bState = buttonState[i];
    if (b.value && !bState) { // button pressed
      buttonState[i] = 1;
      buttonHandler.trigger(i, 'pressed');
    } else if (!b.value && bState) { // button released
      buttonState[i] = 0;
      buttonHandler.trigger(i, 'released');
    } else if (b.value && bState) { // button held
      ++buttonState[i];
      if (bState === HELD_DURATION) buttonHandler.trigger(i, 'held');
    }
  });

  [x0, y0, x1, y1] = gp.axes;
  [[x0, y0], [x1, y1]].forEach((s, i) => {
    aState = axesState[i];

    if (s[0] !== aState[0] || s[1] !== aState[1]) {
      axesHandler.trigger(i, 'move', s);
      axesState[i] = s;
    }

    s.forEach((a, j) => { // individual axis handlers
      if (deadzone(a)) axesHandler.trigger(`${i}:${j}`, 'active', a);
    });
    if (s.some(a => deadzone(a))) axesHandler.trigger(i, 'active', s);
  });

  if (!(c++ % 200)) { // TEST LOGGING
    console.log(buttonState);
    console.log(...axesState);
    console.log(dt);
  }

  animationId = requestAnimationFrame(inputLoop);
};

class GamepadMouse {
  static _states = ['point', 'grab', 'open'];

  _spritePath() {
    return browser.runtime.getURL(`icons/mouse/${this._state}${this.index}.png`);
  }

  _onResize() {
    this._windowWidth = window.innerWidth;
    this._windowHeight = window.innerHeight;
  }

  _clampY(val) {
    return Math.max(0, Math.min(this._windowHeight, val));
  }
  _clampX(val) {
    return Math.max(0, Math.min(this._windowWidth, val));
  }

  _swapState(state) {
    if (!GamepadMouse._states.includes(state)) return;
    this._state = state;
    this._sprite.src = this._spritePath();
  }

  highlight() {
    if (this._highlighted) this._highlighted.removeAttribute('data-gp-mouse-highlighted');
    const { x, y } = this.cursor.getBoundingClientRect();
    const highlighted = document.elementFromPoint(x + 4, y - 1)?.closest('button,a'); // ofset to better suit the visual pointer & so that elementFromPoint() doesn't just always select the cursor itself
    if (highlighted) {
      if (highlighted === this._highlighted) highlighted.click();
      highlighted.setAttribute('data-gp-mouse-highlighted', '');
      this._highlighted = highlighted;
    }
  }

  move([mx, my]) {
    /*
      design thoughts: ideally, one should be able to move the "mouse" horizontally
      across the screen in about a second at full tilt
   
      so as a baseline we'd want to move the cursor at a speed of [screen width]/[refresh rate] pixels at input magnitude 1.0
      thus, the pixels moved should be ([magnitude] * [screen width])/[refresh rate]
   
      but the actual input polling rate differs slightly from the refresh rate, so we'll want to sample dt instead 
    */

    const f = 1000 / dt;

    const dy = (my * this._windowHeight) / f;
    const dx = (mx * this._windowWidth) / f;
    const { y, x } = this.cursor.getBoundingClientRect();

    this.cursor.style.top = this._clampY(dy + y) + 'px';
    this.cursor.style.left = this._clampX(dx + x) + 'px';
  }

  constructor(index = 0) {
    this.index = index;
    this.uuid = crypto.randomUUID();
    this._state = 'point';
    this._windowWidth = window.innerWidth;
    this._windowHeight = window.innerHeight;

    this._sprite = noact({
      className: 'gp-mouse-sprite',
      src: this._spritePath('point')
    });
    this.cursor = noact({
      className: 'gp-mouse-cursor',
      style: 'top:0;left:0;',
      children: this._sprite
    });

    document.body.append(this.cursor);
    window.addEventListener('resize', this._onResize);
  }
}

function cScroll([y, x]) {
  const f = 1000 / dt;
  const dy = (4 * y * window.innerHeight) / f;
  const dx = (4 * x * window.innerWidth) / f;
  window.scrollBy(dx, dy);
}

/* 
  we have to init handles through this function because the window doesn't have access to
  navigator.getGamepads() until a gamepad connection occurs
  
  this handler is called after the first gamepad input has been made, will need to do some
  future weatherproofing to manage cases where a user has multiple gamepads connected
  and/or connects/disconnects gamepads while the script is active
*/
function onGamepadConnected(event) {
  gp = navigator.getGamepads()[event.gamepad.index];
  console.log(`Gamepad '${gp.id}' connected`, gp);
  // init state
  buttonState = gp.buttons.map(b => Math.ceil(b.value));
  [y0, x0, y1, x1] = gp.axes; // assuming twin sticks (DOUBLE CHECK THAT THIS IS THE ACTUAL AXIS ORDER)
  axesState = [[y0, x0], [y1, x1]];

  requestAnimationFrame(inputLoop);

  axesHandler.addEventListener(0, 'active', mouse.move.bind(mouse));
  axesHandler.addEventListener(1, 'active', cScroll);
  buttonHandler.addEventListener(1, 'pressed', mouse.highlight.bind(mouse));
}

export const main = async () => {
  window.addEventListener('gamepadconnected', onGamepadConnected);
  mouse = new GamepadMouse();
};

export const clean = async () => {
  window.removeEventListener('gamepadconnected', onGamepadConnected);
  cancelAnimationFrame(animationId); // thankfully doesn't throw errors if the frame id is still null
  buttonHandler.clearAll();
  axesHandler.clearAll();
};