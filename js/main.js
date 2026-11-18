// Starts everything once the page has loaded.
(function () {
  'use strict';

  // Lists the prototype chain of a few real objects in the sidebar,
  // e.g. "GoldenApple → Apple → Entity → Object".
  function showChains(game) {
    const list = document.getElementById('chains');
    const samples = [
      game.snake,
      new GoldenApple(0, 0),
      new MovingWall(0, 0, 'h'),
      new ScorePopup(0, 0, ''),
      new EndlessLevel(),
      Skin.LIST[5], // a StripedSkin
      game.input
    ];

    for (let i = 0; i < samples.length; i++) {
      const names = Utils.chainOf(samples[i]);
      const li = document.createElement('li');
      li.innerHTML = '<b>' + names[0] + '</b> → ' + names.slice(1).join(' → ');
      list.appendChild(li);
    }
  }

  function init() {
    const ui = new UI();
    const game = new Game(document.getElementById('board'), ui);
    ui.connect(game);
    game.input.bindPad(document.getElementById('pad'));
    showChains(game);
    game.start();
    window.game = game; // handy for trying things in the browser console
  }

  // The scripts are at the end of <body>, so the page is ready when this runs.
  init();
})();
