// Keyboard, mouse, swipe and on-screen pad input.
//   Emitter <- Input
(function (global) {
  'use strict';

  /* ---------- Emitter: tiny publish / subscribe ---------- */

  function Emitter() {
    this.handlers = {};
  }

  Emitter.prototype.on = function (name, fn) {
    (this.handlers[name] = this.handlers[name] || []).push(fn);
    return this;
  };

  Emitter.prototype.emit = function (name, data) {
    const list = this.handlers[name];
    if (list) list.forEach((fn) => fn(data));
  };

  /* ---------- Input ---------- */

  const KEY_DIRS = {
    ArrowUp: 'UP', KeyW: 'UP',
    ArrowDown: 'DOWN', KeyS: 'DOWN',
    ArrowLeft: 'LEFT', KeyA: 'LEFT',
    ArrowRight: 'RIGHT', KeyD: 'RIGHT'
  };

  function Input(surface) {
    Emitter.call(this);
    this.surface = surface;
    this.touch = null;
    this.swipeEnabled = () => true; // the game replaces this
    this.bind();
  }
  Utils.extend(Input, Emitter);

  // How far a finger has to travel before it counts as a swipe (CSS px).
  Input.SWIPE = 20;

  Input.prototype.bind = function () {
    window.addEventListener('keydown', (e) => this.onKey(e));

    const s = this.surface;
    s.addEventListener('touchstart', (e) => this.onTouchStart(e), { passive: true });
    s.addEventListener('touchmove', (e) => this.onTouchMove(e), { passive: false });
    s.addEventListener('touchend', () => { this.touch = null; });
    s.addEventListener('touchcancel', () => { this.touch = null; });

    // Mouse: clicking the board sends where you clicked, as 0..1 across and down.
    s.addEventListener('mousedown', (e) => {
      if (e.button !== 0 || e.target.closest('button')) return;
      const rect = s.getBoundingClientRect();
      this.emit('point', {
        x: (e.clientX - rect.left) / rect.width,
        y: (e.clientY - rect.top) / rect.height
      });
    });
  };

  Input.prototype.onKey = function (e) {
    if (e.ctrlKey || e.metaKey || e.altKey) return;

    const dir = KEY_DIRS[e.code];
    if (dir) {
      e.preventDefault();
      // React on the key going down, never on auto-repeat.
      if (!e.repeat) this.emit('turn', Dir[dir]);
      return;
    }
    if (e.repeat) return;

    // A focused button already handles Enter/Space itself.
    const onButton = e.target instanceof Element && e.target.closest('button');

    switch (e.code) {
      case 'Space':
        if (onButton) return;
        e.preventDefault();
        this.emit('space');
        break;
      case 'Enter':
      case 'NumpadEnter':
        if (onButton) return;
        e.preventDefault();
        this.emit('confirm');
        break;
      case 'Escape':
        this.emit('back');
        break;
      case 'KeyP':
        this.emit('pause');
        break;
      case 'KeyR':
        this.emit('restart');
        break;
    }
  };

  Input.prototype.onTouchStart = function (e) {
    if (!this.swipeEnabled() || e.target.closest('button')) return;
    const t = e.changedTouches[0];
    this.touch = { x: t.clientX, y: t.clientY };
  };

  // Turns as soon as the finger has moved far enough, without waiting for it
  // to lift. Resetting the origin lets you chain turns in one gesture.
  Input.prototype.onTouchMove = function (e) {
    if (!this.touch) return;
    e.preventDefault();
    const t = e.changedTouches[0];
    const dx = t.clientX - this.touch.x;
    const dy = t.clientY - this.touch.y;
    if (Math.max(Math.abs(dx), Math.abs(dy)) < Input.SWIPE) return;

    let dir;
    if (Math.abs(dx) > Math.abs(dy)) dir = dx > 0 ? Dir.RIGHT : Dir.LEFT;
    else dir = dy > 0 ? Dir.DOWN : Dir.UP;

    this.touch = { x: t.clientX, y: t.clientY };
    this.emit('turn', dir);
  };

  // On-screen arrows. pointerdown fires right away; click would wait for release.
  Input.prototype.bindPad = function (pad) {
    if (!pad) return;
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
