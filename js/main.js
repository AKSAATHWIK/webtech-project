// Starts everything once the page has loaded.
(function () {
  'use strict';

  function init() {
    const ui = new UI();
    const game = new Game(document.getElementById('board'), ui);
    ui.connect(game);
    game.start();
    window.game = game; // handy for trying things in the browser console
  }

  // The scripts are at the end of <body>, so the page is ready when this runs.
  init();
})();
