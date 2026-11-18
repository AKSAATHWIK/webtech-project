// The HTML side: score bar, overlay screens and the level picker.
(function (global) {
  'use strict';

  function UI() {
    this.overlay = document.getElementById('overlay');
    this.grid = document.getElementById('level-grid');
    this.detail = document.getElementById('level-detail');
    this.bar = document.getElementById('hud-progress');
    this.pauseBtn = document.getElementById('hud-pause');
    this.game = null;

    // <section data-screen="menu"> etc.
    this.screens = {};
    document.querySelectorAll('[data-screen]').forEach((el) => {
      this.screens[el.dataset.screen] = el;
    });

    // Any element with data-field="name" can be filled in with text('name', ...)
    this.fields = {};
    document.querySelectorAll('[data-field]').forEach((el) => {
      this.fields[el.dataset.field] = el;
    });
  }

  UI.prototype.connect = function (game) {
    this.game = game;

    // One click handler for every button: level tiles and data-action buttons.
    document.addEventListener('click', (e) => {
      const tile = e.target.closest('[data-level]');
      const button = e.target.closest('[data-action]');
      if (tile) game.action('play', Number(tile.dataset.level));
      else if (button) game.action(button.dataset.action);
    });

    // Hovering or tabbing onto a level tile shows that map behind the picker.
    const preview = (e) => {
      const tile = e.target.closest('[data-level]');
      if (tile) this.previewLevel(Number(tile.dataset.level));
    };
    this.grid.addEventListener('pointerover', preview);
    this.grid.addEventListener('focusin', preview);
    this.grid.addEventListener('pointerleave', () => this.previewLevel(game.selected));
  };

  // Sets the text of a data-field element (only touches the page if it changed).
  UI.prototype.text = function (field, value) {
    const el = this.fields[field];
    if (el && el.textContent !== String(value)) el.textContent = value;
  };

  /* ---------- score bar (called every frame) ---------- */

  UI.prototype.hud = function (info) {
    this.text('title', info.title);
    this.text('name', info.name);
    this.text('score', info.score);
    this.text('best', info.best);
    this.text('apples', info.apples);
    this.text('pause', info.paused ? 'Resume' : 'Pause');
    this.pauseBtn.disabled = !info.canPause;
    this.bar.style.transform = 'scaleX(' + Math.min(1, info.progress) + ')';
  };

  /* ---------- overlay screens ---------- */

  UI.prototype.show = function (state, game) {
    // show only the screen for this state (there is none while playing)
    Object.keys(this.screens).forEach((name) => {
      this.screens[name].hidden = name !== state;
    });
    this.overlay.hidden = state === 'playing';

    const level = game.level;
    const endless = game.mode === 'endless';

    if (state === 'menu') {
      this.text('menu-best', game.progress.endless
        ? 'Best endless score: ' + game.progress.endless
        : 'Ten levels, one endless mode.');
    }

    if (state === 'levels') {
      this.renderLevels(game);
    }

    if (state === 'ready') {
      this.text('ready-title', endless ? 'Endless' : level.title() + ' · ' + level.name);
      this.text('ready-goal', level.goal());
    }

    if (state === 'cleared') {
      const last = game.isLastLevel();
      this.text('cleared-title', last ? 'All ten levels cleared' : level.title() + ' cleared');
      this.text('cleared-score', game.score);
      this.text('cleared-note', (game.newBest ? 'New best! ' : 'Best: ' + game.bestScore() + '. ') +
        'Includes a ' + Game.CLEAR_BONUS + ' point bonus.');
      this.screens.cleared.querySelector('[data-action="next"]').hidden = last;
    }

    if (state === 'over') {
      this.text('over-score', game.score);
      this.text('over-note', (game.newBest ? 'New best score! ' : '') +
        (endless ? game.eaten + ' apples eaten.' : game.eaten + ' of ' + level.target + ' apples.'));
      this.text('over-back', endless ? 'Menu' : 'All levels');
    }

    // Focus the main button so Enter / Space work straight away.
    const main = state === 'levels'
      ? this.grid.querySelector('[data-level="' + game.selected + '"]')
      : this.screens[state] && this.screens[state].querySelector('[data-primary]');
    if (main) main.focus({ preventScroll: true });
  };

  /* ---------- level picker ---------- */

  UI.prototype.renderLevels = function (game) {
    this.grid.innerHTML = LEVELS.map((level) => {
      const n = level.number;
      const best = game.progress.best[n];
      const open = game.isUnlocked(n);
      const status = best ? best : open ? 'new' : 'locked';
      const classes = 'tile' + (best ? ' is-done' : '') + (open ? '' : ' is-locked');
      return '<button type="button" class="' + classes + '" data-level="' + n + '">' +
        '<span class="tile-num">' + n + '</span>' +
        '<span class="tile-meta">' + status + '</span></button>';
    }).join('');

    this.text('levels-total', 'Campaign total ' + game.campaignTotal());
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
    let text = n + '. ' + level.name + ' — ';
    if (!this.game.isUnlocked(n)) text += 'clear level ' + (n - 1) + ' to unlock';
    else if (best) text += 'best ' + best;
    else text += level.target + ' apples';
    this.detail.textContent = text;
  };

  global.UI = UI;
})(window);
