// The HTML side: score bar, overlay screens, level picker and skin picker.
(function (global) {
  'use strict';

  // HTML for one icon from the <svg> icon set in index.html.
  function icon(name) {
    return '<svg class="icon"><use href="#i-' + name + '"/></svg>';
  }

  function UI() {
    this.overlay = document.getElementById('overlay');
    this.grid = document.getElementById('level-grid');
    this.skinGrid = document.getElementById('skin-grid');
    this.detail = document.getElementById('level-detail');
    this.bar = document.getElementById('hud-progress');
    this.pauseBtn = document.getElementById('hud-pause');
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
      const skin = e.target.closest('[data-skin]');
      const button = e.target.closest('[data-action]');
      if (tile) game.action('play', Number(tile.dataset.level));
      else if (skin) game.action('skin', Number(skin.dataset.skin));
      else if (button) game.action(button.dataset.action);
    });

    // Moving the mouse over a level tile shows that map behind the picker.
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

  /* ---------- score bar (called every frame) ---------- */

  UI.prototype.hud = function (info) {
    this.text('title', info.title);
    this.text('name', info.name);
    this.text('score', info.score);
    this.text('best', info.best);
    this.text('apples', info.apples);
    if (info.paused) this.text('pause', 'Resume');
    else this.text('pause', 'Pause');
    this.pauseBtn.disabled = !info.canPause;
    this.bar.style.width = Math.min(100, info.progress * 100) + '%';
  };

  /* ---------- overlay screens ---------- */

  UI.prototype.show = function (state, game) {
    // show only the screen for this state (there is none while playing)
    for (const name in this.screens) {
      this.screens[name].hidden = name !== state;
    }
    this.overlay.hidden = state === 'playing';

    const level = game.level;
    const endless = game.mode === 'endless';

    if (state === 'menu') {
      if (game.progress.endless > 0) this.text('menu-best', 'Best endless score: ' + game.progress.endless);
      else this.text('menu-best', 'Ten levels, a creators’ level and endless mode.');
    }

    if (state === 'levels') this.renderLevels(game);
    if (state === 'skins') this.renderSkins(game);

    if (state === 'ready') {
      if (endless) this.text('ready-title', 'Endless');
      else this.text('ready-title', level.title() + ' · ' + level.name);
      this.text('ready-goal', level.goal());
    }

    if (state === 'cleared') {
      const last = game.isLastLevel();
      if (last) this.text('cleared-title', 'You beat the creators’ level!');
      else this.text('cleared-title', level.title() + ' cleared');
      this.text('cleared-score', game.score);

      let note = 'Best: ' + game.bestScore() + '. ';
      if (game.newBest) note = 'New best! ';
      this.text('cleared-note', note + 'Includes a ' + Game.CLEAR_BONUS + ' point bonus.');
      this.screens.cleared.querySelector('[data-action="next"]').hidden = last;
    }

    if (state === 'over') {
      this.text('over-score', game.score);
      let note = '';
      if (game.newBest) note = 'New best score! ';
      if (endless) note += game.eaten + ' apples eaten.';
      else note += game.eaten + ' of ' + level.target + ' apples.';
      this.text('over-note', note);
      if (endless) this.text('over-back', 'Menu');
      else this.text('over-back', 'All levels');
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

      let classes = 'tile';
      if (best) classes += ' is-done';
      if (!open) classes += ' is-locked';
      if (level.creators) classes += ' is-creators';

      let label = n;
      if (level.creators) label = icon('star') + ' ' + level.title();

      let status = 'new';
      if (best) status = icon('check') + best;
      else if (!open) status = icon('lock');

      html += '<button type="button" class="' + classes + '" data-level="' + n + '">' +
        '<span class="tile-num">' + label + '</span>' +
        '<span class="tile-meta">' + status + '</span></button>';
    }
    this.grid.innerHTML = html;

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
    if (level.creators) text = level.name + ' — ';

    if (!this.game.isUnlocked(n)) text += 'clear level ' + (n - 1) + ' to unlock';
    else if (best) text += 'best ' + best;
    else text += level.target + ' apples';
    this.detail.textContent = text;
  };

  /* ---------- skin picker ---------- */

  UI.prototype.renderSkins = function (game) {
    const current = game.skin();
    let html = '';
    for (let i = 0; i < Skin.LIST.length; i++) {
      const skin = Skin.LIST[i];
      let classes = 'skin';
      if (skin === current) classes += ' is-on';
      html += '<button type="button" class="' + classes + '" data-skin="' + i + '">' +
        '<span class="skin-bar" style="background:' + skin.swatch() + '"></span>' +
        '<span class="skin-name">' + skin.name + '</span></button>';
    }
    this.skinGrid.innerHTML = html;
    this.text('skin-name', current.name);
  };

  global.UI = UI;
})(window);
