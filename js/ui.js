// The HTML side: score bar, overlay screens and the level picker.
(function (global) {
  'use strict';

  // HTML for one icon from the <svg> icon set in index.html.
  function icon(name) {
    return '<svg class="icon"><use href="#i-' + name + '"/></svg>';
  }

  function UI() {
    this.overlay = document.getElementById('overlay');
    this.grid = document.getElementById('level-grid');
    this.detail = document.getElementById('level-detail');
    this.bar = document.getElementById('hud-progress');
    this.pauseBtn = document.getElementById('hud-pause');
    this.timeBox = document.getElementById('hud-time');
    this.game = null;

    // Every <section data-screen="..."> by name, e.g. this.screens.menu
    this.screens = {};
    const screenEls = document.querySelectorAll('[data-screen]');
    for (let i = 0; i < screenEls.length; i++) {
      this.screens[screenEls[i].dataset.screen] = screenEls[i];
    }

    // Every element with data-field="..." by name, filled in with text(name, value)
    this.fields = {};
    const fieldEls = document.querySelectorAll('[data-field]');
    for (let i = 0; i < fieldEls.length; i++) {
      this.fields[fieldEls[i].dataset.field] = fieldEls[i];
    }
  }

  UI.prototype.connect = function (game) {
    this.game = game;

    // One click handler for every button on the page.
    // closest() finds the button even if you clicked the icon inside it.
    document.addEventListener('click', (e) => {
      const tile = e.target.closest('[data-level]');
      const button = e.target.closest('[data-action]');
      if (tile) game.action('play', Number(tile.dataset.level));
      else if (button) game.action(button.dataset.action);
    });

    // Moving the mouse over a level tile shows that layout behind the picker.
    this.grid.addEventListener('mouseover', (e) => {
      const tile = e.target.closest('[data-level]');
      if (tile) this.previewLevel(Number(tile.dataset.level));
    });
  };

  // Sets the text of a data-field element (only touches the page if it changed).
  UI.prototype.text = function (field, value) {
    const el = this.fields[field];
    if (el && el.textContent !== String(value)) el.textContent = value;
  };

  /* ---------- full screen ---------- */

  // The browser's Fullscreen API: show just the game (.app) on the whole screen.
  UI.prototype.toggleFullscreen = function () {
    const app = document.querySelector('.app');
    if (document.fullscreenElement) document.exitFullscreen();
    else if (app.requestFullscreen) app.requestFullscreen();
  };

  /* ---------- score bar (called every frame) ---------- */

  UI.prototype.hud = function (info) {
    this.text('title', info.title);
    this.text('name', info.name);
    this.text('pairs', info.pairs);
    this.text('moves', info.moves);
    this.text('time', info.time);
    this.text('score', info.score);
    this.text('best', info.best);
    if (info.paused) this.text('pause', 'Resume');
    else this.text('pause', 'Pause');
    if (document.fullscreenElement) this.text('fullscreen', 'Exit full screen');
    else this.text('fullscreen', 'Full screen');
    this.pauseBtn.disabled = !info.canPause;
    this.bar.style.width = Math.min(100, info.progress * 100) + '%';
    // the time turns red in the last 10 seconds
    if (info.timeLow) this.timeBox.classList.add('is-low');
    else this.timeBox.classList.remove('is-low');
  };

  /* ---------- overlay screens ---------- */

  UI.prototype.show = function (state, game) {
    // show only the screen for this state (there is none while playing)
    for (const name in this.screens) {
      this.screens[name].hidden = name !== state;
    }
    this.overlay.hidden = state === 'playing';

    const level = game.level;

    if (state === 'menu') {
      const total = game.campaignTotal();
      if (total > 0) this.text('menu-best', 'Total of your best scores: ' + total);
      else this.text('menu-best', 'Animals, food, places, shapes, letters, and a creators’ level.');
    }

    if (state === 'levels') this.renderLevels(game);

    if (state === 'ready') {
      this.text('ready-title', level.title() + ' · ' + level.name);
      this.text('ready-goal', level.goal());
    }

    if (state === 'cleared') {
      const last = game.isLastLevel();
      if (last) this.text('cleared-title', 'You beat the creators’ level!');
      else this.text('cleared-title', level.title() + ' cleared');
      this.text('cleared-score', game.score);

      let note = 'Best: ' + game.bestScore() + '. ';
      if (game.newBest) note = 'New best! ';
      note += game.moves + ' moves, ' + game.timeBonus + ' points time bonus.';
      this.text('cleared-note', note);
      this.screens.cleared.querySelector('[data-action="next"]').hidden = last;
    }

    if (state === 'over') {
      this.text('over-score', game.score);
      this.text('over-note', 'You found ' + game.matches + ' of ' + level.pairs + ' pairs.');
    }

    // Put keyboard focus on the main button so Enter and Space work straight away.
    let main = null;
    if (state === 'levels') main = this.grid.querySelector('[data-level="' + game.selected + '"]');
    else if (this.screens[state]) main = this.screens[state].querySelector('[data-primary]');
    if (main) main.focus({ preventScroll: true });
  };

  /* ---------- level picker ---------- */

  UI.prototype.renderLevels = function (game) {
    let html = '';
    for (let i = 0; i < LEVELS.length; i++) {
      const level = LEVELS[i];
      const n = level.number;
      const best = game.progress.best[n];
      const open = game.isUnlocked(n);
      const creators = level instanceof CreatorsLevel;

      let classes = 'tile';
      if (best) classes += ' is-done';
      if (!open) classes += ' is-locked';
      if (creators) classes += ' is-creators';

      let label = n;
      if (creators) label = icon('star') + ' ' + level.title();

      let status = level.cols + ' × ' + level.rows;
      if (best) status = icon('check') + best;
      else if (!open) status = icon('lock');

      html += '<button type="button" class="' + classes + '" data-level="' + n + '">' +
        '<span class="tile-num">' + label + '</span>' +
        '<span class="tile-meta">' + status + '</span></button>';
    }
    this.grid.innerHTML = html;

    this.text('levels-total', 'Total ' + game.campaignTotal());
    this.describeLevel(game.selected);
  };

  UI.prototype.previewLevel = function (n) {
    if (this.game.state !== 'levels') return;
    this.game.action('preview', n);
    this.describeLevel(n);
  };

  // The line of text under the tiles.
  UI.prototype.describeLevel = function (n) {
    const level = LEVELS[n - 1];
    const best = this.game.progress.best[n];
    let text = level.title() + ': ' + level.name + ' — ';
    if (level instanceof CreatorsLevel) text = level.title() + ' — ';

    if (!this.game.isUnlocked(n)) text += 'clear level ' + (n - 1) + ' to unlock';
    else if (best) text += 'best ' + best;
    else text += level.pairs + ' pairs, ' + level.time + ' seconds';
    this.detail.textContent = text;
  };

  global.UI = UI;
})(window);
