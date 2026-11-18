// Small helpers used by the rest of the game.
(function (global) {
  'use strict';

  // Links Child.prototype to Parent.prototype so instances of Child
  // can use everything Parent defines (and override what they need).
  function extend(Child, Parent) {
    Child.prototype = Object.create(Parent.prototype);
    Child.prototype.constructor = Child;
  }

  // Mixes a list into a random order (the Fisher-Yates shuffle):
  // go from the end, and swap each item with a random one before it.
  function shuffle(list) {
    for (let i = list.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      const temp = list[i];
      list[i] = list[j];
      list[j] = temp;
    }
    return list;
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

  global.Utils = {
    extend: extend,
    shuffle: shuffle,
    roundRect: roundRect,
    loadData: loadData,
    saveData: saveData
  };
})(window);
