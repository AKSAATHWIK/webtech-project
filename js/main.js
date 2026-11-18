// Starts everything once the page has loaded.
(function (global) {
  'use strict';

  // Lists the prototype chain of a few live objects in the sidebar.
  function showChains(game) {
    const list = document.getElementById('chains');
    if (!list) return;

    const samples = [
      game.snake,
      new GoldenApple(0, 0),
      new MovingWall(0, 0, 'h'),
      new ScorePopup(0, 0, ''),
      new EndlessLevel(),
      game.input
    ];

    samples.forEach((obj) => {
      const li = document.createElement('li');
      const chain = Utils.chainOf(obj);
      const head = document.createElement('b');
      head.textContent = chain[0];
      li.append(head, document.createTextNode(' → ' + chain.slice(1).join(' → ')));
      list.appendChild(li);
    });
  }

  function init() {
    const ui = new UI();
    const game = new Game(document.getElementById('board'), ui);
    ui.connect(game);
    game.input.bindPad(document.getElementById('pad'));
    showChains(game);
    game.start();
    global.game = game; // handy for poking at objects in the console
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})(window);
