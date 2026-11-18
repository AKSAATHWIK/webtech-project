// Small helpers used by the rest of the game.
(function (global) {
  'use strict';

  // Links Child.prototype to Parent.prototype so instances of Child
  // can use everything Parent defines (and override what they need).
  function extend(Child, Parent) {
    Child.prototype = Object.create(Parent.prototype);
    Child.prototype.constructor = Child;
  }

  // Returns the constructor names along an object's prototype chain.
  function chainOf(obj) {
    const names = [];
    let proto = Object.getPrototypeOf(obj);
    while (proto) {
      const own = Object.prototype.hasOwnProperty.call(proto, 'constructor');
      names.push(own ? proto.constructor.name : '?');
      proto = Object.getPrototypeOf(proto);
    }
    return names;
  }

  function randInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  function pick(list) {
    return list[Math.floor(Math.random() * list.length)];
  }

  function lerp(a, b, t) {
    return a + (b - a) * t;
  }

  // Rounded rectangle path. `r` can be one radius or [tl, tr, br, bl].
  function roundRect(ctx, x, y, w, h, r) {
    const c = Array.isArray(r) ? r : [r, r, r, r];
    ctx.beginPath();
    ctx.moveTo(x + c[0], y);
    ctx.arcTo(x + w, y, x + w, y + h, c[1]);
    ctx.arcTo(x + w, y + h, x, y + h, c[2]);
    ctx.arcTo(x, y + h, x, y, c[3]);
    ctx.arcTo(x, y, x + w, y, c[0]);
    ctx.closePath();
  }

  // localStorage throws in some private windows, so never let it crash the game.
  const Store = {
    load(key, fallback) {
      try {
        const raw = localStorage.getItem(key);
        return raw ? Object.assign({}, fallback, JSON.parse(raw)) : fallback;
      } catch (e) {
        return fallback;
      }
    },
    save(key, value) {
      try {
        localStorage.setItem(key, JSON.stringify(value));
      } catch (e) {
        /* progress just won't be kept */
      }
    }
  };

  // A grid position (or a direction, when used as a step).
  function Vec(x, y) {
    this.x = x;
    this.y = y;
  }

  Vec.prototype.add = function (v) {
    return new Vec(this.x + v.x, this.y + v.y);
  };

  Vec.prototype.equals = function (v) {
    return !!v && v.x === this.x && v.y === this.y;
  };

  Vec.prototype.isOpposite = function (v) {
    return this.x === -v.x && this.y === -v.y;
  };

  Vec.prototype.clone = function () {
    return new Vec(this.x, this.y);
  };

  // A text id like "4,10", handy as an object key.
  Vec.prototype.key = function () {
    return this.x + ',' + this.y;
  };

  Vec.prototype.distance = function (v) {
    return Math.abs(this.x - v.x) + Math.abs(this.y - v.y);
  };

  const Dir = {
    UP: Object.freeze(new Vec(0, -1)),
    RIGHT: Object.freeze(new Vec(1, 0)),
    DOWN: Object.freeze(new Vec(0, 1)),
    LEFT: Object.freeze(new Vec(-1, 0))
  };
  Object.freeze(Dir);

  global.Utils = { extend, chainOf, randInt, pick, lerp, roundRect, Store };
  global.Vec = Vec;
  global.Dir = Dir;
  global.DIRS = [Dir.UP, Dir.RIGHT, Dir.DOWN, Dir.LEFT];
})(window);
