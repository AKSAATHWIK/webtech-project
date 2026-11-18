// Small helpers used by the rest of the game.
(function (global) {
  'use strict';

  // Links Child.prototype to Parent.prototype so instances of Child
  // can use everything Parent defines (and override what they need).
  function extend(Child, Parent) {
    Child.prototype = Object.create(Parent.prototype);
    Child.prototype.constructor = Child;
  }

  // Returns the constructor names along an object's prototype chain,
  // for example ["GoldenApple", "Apple", "Entity", "Object"].
  function chainOf(obj) {
    const names = [];
    let proto = Object.getPrototypeOf(obj);
    while (proto !== null) {
      names.push(proto.constructor.name);
      proto = Object.getPrototypeOf(proto);
    }
    return names;
  }

  // A random item from a list.
  function pick(list) {
    const index = Math.floor(Math.random() * list.length);
    return list[index];
  }

  // A value part-way between a and b. t = 0 gives a, t = 1 gives b.
  function lerp(a, b, t) {
    return a + (b - a) * t;
  }

  // Makes a rectangle path with rounded corners of radius r.
  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  // Saving and loading progress in the browser.
  // try/catch: some private windows block localStorage, and the game should still run.
  function loadData(key, defaults) {
    try {
      const text = localStorage.getItem(key);
      if (!text) return defaults;
      const saved = JSON.parse(text);
      // start from the defaults, then copy in whatever was saved
      for (const name in saved) defaults[name] = saved[name];
      return defaults;
    } catch (e) {
      return defaults;
    }
  }

  function saveData(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (e) {
      // progress just won't be kept
    }
  }

  /* ---------- Vec: a grid position (or a direction, when used as a step) ---------- */

  function Vec(x, y) {
    this.x = x;
    this.y = y;
  }

  Vec.prototype.add = function (v) {
    return new Vec(this.x + v.x, this.y + v.y);
  };

  Vec.prototype.equals = function (v) {
    return v.x === this.x && v.y === this.y;
  };

  Vec.prototype.isOpposite = function (v) {
    return this.x === -v.x && this.y === -v.y;
  };

  // A text id like "4,10", used as a key in an object.
  Vec.prototype.key = function () {
    return this.x + ',' + this.y;
  };

  // How many steps apart two cells are (no diagonals).
  Vec.prototype.distance = function (v) {
    return Math.abs(this.x - v.x) + Math.abs(this.y - v.y);
  };

  // The four directions.
  const Dir = {
    UP: new Vec(0, -1),
    RIGHT: new Vec(1, 0),
    DOWN: new Vec(0, 1),
    LEFT: new Vec(-1, 0)
  };

  global.Utils = {
    extend: extend,
    chainOf: chainOf,
    pick: pick,
    lerp: lerp,
    roundRect: roundRect,
    loadData: loadData,
    saveData: saveData
  };
  global.Vec = Vec;
  global.Dir = Dir;
  global.DIRS = [Dir.UP, Dir.RIGHT, Dir.DOWN, Dir.LEFT];
})(window);
