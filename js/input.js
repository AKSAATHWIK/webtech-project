// Keyboard, mouse, swipe and on-screen pad input.
//   Emitter <- Input
(function (global) {
  'use strict';

  /* ---------- Emitter: tiny publish / subscribe ---------- */
  // on('turn', fn) saves fn under the name 'turn'.
  // emit('turn', data) calls every saved fn for 'turn' with that data.

  function Emitter() {
    this.handlers = {};
  }

  Emitter.prototype.on = function (name, fn) {
    if (!this.handlers[name]) this.handlers[name] = [];
    this.handlers[name].push(fn);
  };

  Emitter.prototype.emit = function (name, data) {
    const list = this.handlers[name];
    if (!list) return;
    for (let i = 0; i < list.length; i++) list[i](data);
  };

  /* ---------- Input ---------- */

  // Which key means which direction.
  const KEY_DIRS = {
    ArrowUp: 'UP', KeyW: 'UP',
    ArrowDown: 'DOWN', KeyS: 'DOWN',
    ArrowLeft: 'LEFT', KeyA: 'LEFT',
    ArrowRight: 'RIGHT', KeyD: 'RIGHT'
  };

  // How far a finger has to move before it counts as a swipe (in pixels).
  const SWIPE = 20;

  function Input(surface) {
    Emitter.call(this);
    this.surface = surface; // the board element
    this.touch = null;      // where the current swipe started
    this.swipeOn = true;    // the game turns this off on menu screens
    this.bind();
  }
  Utils.extend(Input, Emitter);

  // Arrow functions are used for the listeners so that `this` still means the Input.
  Input.prototype.bind = function () {
    window.addEventListener('keydown', (e) => this.onKey(e));
    this.surface.addEventListener('mousedown', (e) => this.onMouse(e));
    this.surface.addEventListener('touchstart', (e) => this.onTouchStart(e), { passive: true });
    this.surface.addEventListener('touchmove', (e) => this.onTouchMove(e), { passive: false });
    this.surface.addEventListener('touchend', () => { this.touch = null; });
  };

  Input.prototype.onKey = function (e) {
    if (e.ctrlKey || e.metaKey || e.altKey) return;

    const dir = KEY_DIRS[e.code];
    if (dir) {
      e.preventDefault();        // stop the arrow keys from scrolling the page
      if (!e.repeat) this.emit('turn', Dir[dir]); // ignore a key held down
      return;
    }
    if (e.repeat) return;

    // A focused button already handles Enter and Space by itself.
    const onButton = e.target.tagName === 'BUTTON';

    if (e.code === 'Space' && !onButton) {
      e.preventDefault();
      this.emit('space');
    } else if (e.code === 'Enter' && !onButton) {
      e.preventDefault();
      this.emit('confirm');
    } else if (e.code === 'Escape') {
      this.emit('back');
    } else if (e.code === 'KeyP') {
      this.emit('pause');
    } else if (e.code === 'KeyR') {
      this.emit('restart');
    }
  };

  // Mouse: clicking the board sends where you clicked, as 0..1 across and down.
  Input.prototype.onMouse = function (e) {
    if (e.button !== 0) return;                    // left button only
    if (e.target.closest('button')) return;        // not a click on a menu button
    const rect = this.surface.getBoundingClientRect();
    this.emit('point', {
      x: (e.clientX - rect.left) / rect.width,
      y: (e.clientY - rect.top) / rect.height
    });
  };

  Input.prototype.onTouchStart = function (e) {
    if (!this.swipeOn || e.target.closest('button')) return;
    const t = e.changedTouches[0];
    this.touch = { x: t.clientX, y: t.clientY };
  };

  // Turns as soon as the finger has moved far enough, without waiting for it
  // to lift. Starting again from the new point lets you chain turns in one swipe.
  Input.prototype.onTouchMove = function (e) {
    if (!this.touch) return;
    e.preventDefault(); // stop the page from scrolling
    const t = e.changedTouches[0];
    const dx = t.clientX - this.touch.x;
    const dy = t.clientY - this.touch.y;
    if (Math.abs(dx) < SWIPE && Math.abs(dy) < SWIPE) return;

    let dir;
    if (Math.abs(dx) > Math.abs(dy)) {
      if (dx > 0) dir = Dir.RIGHT;
      else dir = Dir.LEFT;
    } else {
      if (dy > 0) dir = Dir.DOWN;
      else dir = Dir.UP;
    }

    this.touch = { x: t.clientX, y: t.clientY };
    this.emit('turn', dir);
  };

  // On-screen arrows. pointerdown fires right away; click would wait for release.
  Input.prototype.bindPad = function (pad) {
    pad.addEventListener('pointerdown', (e) => {
      const btn = e.target.closest('[data-dir]');
      if (!btn) return;
      e.preventDefault();
      this.emit('turn', Dir[btn.dataset.dir]);
    });
  };

  global.Emitter = Emitter;
  global.Input = Input;
})(window);
