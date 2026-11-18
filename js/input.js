// Keyboard, mouse and touch input.
//   Emitter <- Input
(function (global) {
  'use strict';

  /* ---------- Emitter: tiny publish / subscribe ---------- */
  // on('flip', fn) saves fn under the name 'flip'.
  // emit('flip', data) calls every saved fn for 'flip' with that data.

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

  function Input(surface) {
    Emitter.call(this);
    this.surface = surface; // the board element
    this.bind();
  }
  Utils.extend(Input, Emitter);

  // Arrow functions are used for the listeners so that `this` still means the Input.
  Input.prototype.bind = function () {
    window.addEventListener('keydown', (e) => this.onKey(e));
    this.surface.addEventListener('mousemove', (e) => this.emit('hover', this.boardPoint(e)));
    this.surface.addEventListener('mousedown', (e) => this.onMouseDown(e));
    this.surface.addEventListener('touchstart', (e) => this.onTouch(e), { passive: false });
  };

  // Where the mouse or finger is, as a fraction of the board (0..1 across and down).
  Input.prototype.boardPoint = function (e) {
    const rect = this.surface.getBoundingClientRect();
    return {
      x: (e.clientX - rect.left) / rect.width,
      y: (e.clientY - rect.top) / rect.height
    };
  };

  Input.prototype.onMouseDown = function (e) {
    if (e.button !== 0) return;              // left button only
    if (e.target.closest('button')) return;  // not a click on a menu button
    this.emit('click', this.boardPoint(e));
  };

  // A tap on a phone works like a click.
  Input.prototype.onTouch = function (e) {
    if (e.target.closest('button')) return;
    e.preventDefault(); // stop the phone from also sending a mouse click
    this.emit('click', this.boardPoint(e.changedTouches[0]));
  };

  Input.prototype.onKey = function (e) {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    if (e.repeat) return; // ignore a key held down

    // A focused button already handles Enter and Space by itself.
    const onButton = e.target.tagName === 'BUTTON';
    const key = e.code;

    if (key === 'ArrowUp' || key === 'KeyW') {
      e.preventDefault();
      this.emit('move', { x: 0, y: -1 });
    } else if (key === 'ArrowDown' || key === 'KeyS') {
      e.preventDefault();
      this.emit('move', { x: 0, y: 1 });
    } else if (key === 'ArrowLeft' || key === 'KeyA') {
      e.preventDefault();
      this.emit('move', { x: -1, y: 0 });
    } else if (key === 'ArrowRight' || key === 'KeyD') {
      e.preventDefault();
      this.emit('move', { x: 1, y: 0 });
    } else if ((key === 'Enter' || key === 'Space') && !onButton) {
      e.preventDefault();
      this.emit('flip');
    } else if (key === 'Escape') {
      this.emit('back');
    } else if (key === 'KeyP') {
      this.emit('pause');
    } else if (key === 'KeyR') {
      this.emit('restart');
    } else if (key === 'KeyF') {
      this.emit('fullscreen');
    }
  };

  global.Emitter = Emitter;
  global.Input = Input;
})(window);
