// The Game: game states, the game loop, matching cards, scoring and drawing.
(function (global) {
  'use strict';

  // Every screen the game can be on.
  const STATE = {
    MENU: 'menu',
    LEVELS: 'levels',
    READY: 'ready',     // level laid out, waiting for the player to start
    PLAYING: 'playing',
    PAUSED: 'paused',
    CLEARED: 'cleared', // all pairs found
    OVER: 'over'        // time ran out
  };

  const SAVE_KEY = 'memory-progress-v1';
  const TABLE = '#3d7543';      // the green table
  const TABLE_EDGE = '#356a3b';

  function Game(canvas, ui) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.ui = ui;

    // We draw on an 800 x 600 board (4:3) and scale it to the canvas size on screen.
    this.width = 800;
    this.height = 600;
    this.scale = 1;

    // Saved between visits: highest unlocked level and best scores.
    this.progress = Utils.loadData(SAVE_KEY, { unlocked: 1, best: {} });

    this.selected = 1;  // level highlighted in the level picker
    this.state = null;
    this.lastTime = 0;  // time of the previous frame
    this.stateTime = 0; // seconds since the state last changed

    this.input = new Input(canvas.parentElement);
    this.bindInput();

    // Arrow function so `this` still means the game inside the listener.
    window.addEventListener('resize', () => this.resize());

    this.setup(LEVELS[0]);
    this.resize();
    this.setState(STATE.MENU);
  }

  Game.START_PEEK = 1.5;   // seconds you see every card when a level starts
  Game.HIDE_DELAY = 0.8;   // seconds two wrong cards stay up before turning back
  Game.MAX_COMBO = 5;
  Game.TIME_BONUS = 10;    // points for every second left when you clear a level

  /* ---------- canvas size ---------- */

  // Makes the canvas match its size on screen so it stays sharp.
  Game.prototype.resize = function () {
    const pixels = window.devicePixelRatio || 1;
    let w = Math.round(this.canvas.clientWidth * pixels);
    if (w === 0) w = this.width;
    this.canvas.width = w;
    this.canvas.height = Math.round(w * this.height / this.width); // keep 4:3
    this.scale = w / this.width;
  };

  /* ---------- input ---------- */

  // Tells the Input which game method to call for each kind of event.
  Game.prototype.bindInput = function () {
    this.input.on('flip', () => this.confirm());
    this.input.on('move', (step) => this.moveCursor(step));
    this.input.on('click', (p) => this.click(p));
    this.input.on('hover', (p) => this.hover(p));
    this.input.on('back', () => this.back());
    this.input.on('pause', () => this.togglePause());
    this.input.on('fullscreen', () => this.ui.toggleFullscreen());
    this.input.on('restart', () => {
      if (this.state !== STATE.MENU && this.state !== STATE.LEVELS) this.restart();
    });

    // Pause when the player switches to another window or tab.
    window.addEventListener('blur', () => {
      if (this.state === STATE.PLAYING) this.setState(STATE.PAUSED);
    });
  };

  // Enter or Space
  Game.prototype.confirm = function () {
    const s = this.state;
    // the short wait (stateTime) stops a held key from skipping the result screen
    if (s === STATE.MENU) this.showLevels();
    else if (s === STATE.LEVELS) this.startLevel(this.selected);
    else if (s === STATE.READY) this.begin();
    else if (s === STATE.PLAYING) this.flipCard(this.cards[this.cursor]);
    else if (s === STATE.PAUSED) this.togglePause();
    else if (s === STATE.CLEARED && this.stateTime > 0.25) this.nextLevel();
    else if (s === STATE.OVER && this.stateTime > 0.25) this.restart();
  };

  // Escape
  Game.prototype.back = function () {
    const s = this.state;
    if (s === STATE.PLAYING || s === STATE.PAUSED) this.togglePause();
    else if (s === STATE.LEVELS) this.setState(STATE.MENU);
    else if (s !== STATE.MENU) this.showLevels();
  };

  // Arrow keys move the yellow outline from card to card.
  Game.prototype.moveCursor = function (step) {
    if (this.state !== STATE.PLAYING && this.state !== STATE.READY) return;
    const cols = this.level.cols;
    let col = this.cursor % cols;
    let row = Math.floor(this.cursor / cols);
    col += step.x;
    row += step.y;
    // stay inside the grid
    if (col < 0) col = 0;
    if (col >= cols) col = cols - 1;
    if (row < 0) row = 0;
    if (row >= this.level.rows) row = this.level.rows - 1;
    this.cursor = row * cols + col;
  };

  // Which card is at point p (p is a fraction of the board)? Returns its index, or -1.
  Game.prototype.cardAt = function (p) {
    const x = p.x * this.width;
    const y = p.y * this.height;
    for (let i = 0; i < this.cards.length; i++) {
      if (this.cards[i].contains(x, y)) return i;
    }
    return -1;
  };

  Game.prototype.hover = function (p) {
    if (this.state !== STATE.PLAYING && this.state !== STATE.READY) return;
    const i = this.cardAt(p);
    if (i !== -1) this.cursor = i;
  };

  Game.prototype.click = function (p) {
    if (this.state === STATE.READY) {
      this.begin();
      return;
    }
    if (this.state !== STATE.PLAYING) return;
    const i = this.cardAt(p);
    if (i === -1) return;
    this.cursor = i;
    this.flipCard(this.cards[i]);
  };

  // Called by the buttons on the overlay screens (their data-action).
  Game.prototype.action = function (name, arg) {
    if (name === 'campaign' || name === 'levels') this.showLevels();
    else if (name === 'menu') this.setState(STATE.MENU);
    else if (name === 'play') this.startLevel(arg);
    else if (name === 'preview') this.preview(arg);
    else if (name === 'pause' || name === 'resume') this.togglePause();
    else if (name === 'restart') this.restart();
    else if (name === 'next') this.nextLevel();
    else if (name === 'back') this.back();
    else if (name === 'fullscreen') this.ui.toggleFullscreen();
  };

  /* ---------- switching states and levels ---------- */

  Game.prototype.setState = function (state) {
    this.state = state;
    this.stateTime = 0;
    this.ui.show(state, this);
  };

  Game.prototype.togglePause = function () {
    if (this.state === STATE.PLAYING) this.setState(STATE.PAUSED);
    else if (this.state === STATE.PAUSED) this.setState(STATE.PLAYING);
  };

  Game.prototype.showLevels = function () {
    this.selected = this.progress.unlocked;
    this.setup(LEVELS[this.selected - 1]);
    this.setState(STATE.LEVELS);
  };

  // Shows a level's layout behind the level picker.
  Game.prototype.preview = function (n) {
    if (this.state !== STATE.LEVELS) return;
    if (this.level !== LEVELS[n - 1]) this.setup(LEVELS[n - 1]);
    if (this.isUnlocked(n)) this.selected = n;
  };

  Game.prototype.isUnlocked = function (n) {
    return n <= this.progress.unlocked;
  };

  Game.prototype.isLastLevel = function () {
    return this.level.number === LEVELS.length;
  };

  Game.prototype.startLevel = function (n) {
    if (!this.isUnlocked(n)) return;
    this.setup(LEVELS[n - 1]);
    this.setState(STATE.READY);
  };

  Game.prototype.restart = function () {
    this.startLevel(this.level.number);
  };

  Game.prototype.nextLevel = function () {
    if (this.isLastLevel()) this.showLevels();
    else this.startLevel(this.level.number + 1);
  };

  // Lays out a fresh, shuffled copy of the level.
  Game.prototype.setup = function (level) {
    this.level = level;
    this.cards = level.build(this.width, this.height);
    this.open = [];         // the cards turned over this turn (0, 1 or 2)
    this.particles = [];
    this.cursor = 0;        // index of the card with the yellow outline
    this.timeLeft = level.time;
    this.hideTimer = 0;     // counts down while two wrong cards are showing
    this.peekTimer = 0;     // counts down while every card is showing
    this.score = 0;
    this.matches = 0;
    this.moves = 0;
    this.combo = 0;         // matches in a row
    this.newBest = false;
    this.flash = 0;
  };

  // Start playing: first show every card for a moment so you can remember some.
  Game.prototype.begin = function () {
    this.setState(STATE.PLAYING);
    this.peek(Game.START_PEEK);
  };

  /* ---------- the rules ---------- */

  // Cards can't be turned while two wrong cards or a peek are showing.
  Game.prototype.isBusy = function () {
    return this.hideTimer > 0 || this.peekTimer > 0;
  };

  Game.prototype.flipCard = function (card) {
    if (this.isBusy()) return;
    if (card.faceUp || card.matched) return;
    card.faceUp = true;
    this.open.push(card);
    if (this.open.length === 2) this.checkPair();
  };

  // Two cards are up: are they a pair?
  Game.prototype.checkPair = function () {
    const a = this.open[0];
    const b = this.open[1];
    this.moves++;

    if (a.pairId === b.pairId) {
      a.matched = true;
      b.matched = true;
      this.combo = Math.min(this.combo + 1, Game.MAX_COMBO);
      a.onMatch(this); // Card, BonusCard and PeekCard each know what to do
      this.burst(a, '#ffffff', 10);
      this.burst(b, '#ffffff', 10);
      this.matches++;
      this.open = [];
      if (this.matches === this.level.pairs) this.clear();
    } else {
      this.combo = 0;
      this.level.onMismatch(this); // the creators' level takes away time here
      this.hideTimer = Game.HIDE_DELAY;
      this.flash = 0.25;
    }
  };

  // Turns the two wrong cards face down again.
  Game.prototype.hideOpenCards = function () {
    for (let i = 0; i < this.open.length; i++) this.open[i].faceUp = false;
    this.open = [];
  };

  // Shows every card that isn't matched yet, for `seconds`.
  Game.prototype.peek = function (seconds) {
    this.peekTimer = seconds;
    for (let i = 0; i < this.cards.length; i++) {
      if (!this.cards[i].matched) this.cards[i].peek = true;
    }
  };

  Game.prototype.endPeek = function () {
    for (let i = 0; i < this.cards.length; i++) this.cards[i].peek = false;
  };

  // Adds (or with a minus number, takes away) seconds from the clock.
  Game.prototype.addTime = function (seconds) {
    this.timeLeft = Math.max(0, this.timeLeft + seconds);
    let text = seconds + ' s';
    if (seconds > 0) text = '+' + seconds + ' s';
    this.particles.push(new ScorePopup(this.width / 2, 60, text));
  };

  Game.prototype.gain = function (points, card) {
    this.score += points;
    let text = '+' + points;
    if (this.combo > 1) text += '  x' + this.combo;
    this.particles.push(new ScorePopup(card.x + card.w / 2, card.y + card.h / 2, text));
  };

  // A little explosion of dots from the middle of a card.
  Game.prototype.burst = function (card, colour, count) {
    const x = card.x + card.w / 2;
    const y = card.y + card.h / 2;
    for (let i = 0; i < count; i++) this.particles.push(new Particle(x, y, colour));
  };

  // All pairs found.
  Game.prototype.clear = function () {
    this.timeBonus = Math.ceil(this.timeLeft) * Game.TIME_BONUS;
    this.score += this.timeBonus;
    this.saveBest();
    // unlock the next level
    if (this.level.number === this.progress.unlocked && !this.isLastLevel()) {
      this.progress.unlocked++;
    }
    Utils.saveData(SAVE_KEY, this.progress);
    this.setState(STATE.CLEARED);
  };

  // The clock ran out.
  Game.prototype.timeUp = function () {
    this.timeLeft = 0;
    this.flash = 0.5;
    // show where every card was
    for (let i = 0; i < this.cards.length; i++) this.cards[i].faceUp = true;
    this.setState(STATE.OVER);
  };

  /* ---------- scores ---------- */

  Game.prototype.bestScore = function () {
    const best = this.progress.best[this.level.number];
    if (best) return best;
    return 0;
  };

  Game.prototype.saveBest = function () {
    if (this.score <= this.bestScore()) return;
    this.progress.best[this.level.number] = this.score;
    this.newBest = true;
  };

  // All the level best scores added up.
  Game.prototype.campaignTotal = function () {
    let total = 0;
    for (let i = 0; i < LEVELS.length; i++) {
      const best = this.progress.best[LEVELS[i].number];
      if (best) total += best;
    }
    return total;
  };

  /* ---------- game loop ---------- */

  Game.prototype.start = function () {
    requestAnimationFrame((now) => this.loop(now));
  };

  // Runs every frame (about 60 times a second): update, then draw.
  Game.prototype.loop = function (now) {
    let dt = 0; // seconds since the last frame
    if (this.lastTime > 0) dt = Math.min((now - this.lastTime) / 1000, 0.1);
    this.lastTime = now;
    this.update(dt);
    this.render();
    requestAnimationFrame((time) => this.loop(time));
  };

  Game.prototype.update = function (dt) {
    this.stateTime += dt;

    if (this.state === STATE.PLAYING) {
      // the clock only runs while you can actually play
      if (this.peekTimer > 0) {
        this.peekTimer -= dt;
        if (this.peekTimer <= 0) this.endPeek();
      } else {
        this.timeLeft -= dt;
        if (this.timeLeft <= 0) this.timeUp();
      }

      if (this.hideTimer > 0) {
        this.hideTimer -= dt;
        if (this.hideTimer <= 0) this.hideOpenCards();
      }
    }

    // Animations (card flips, particles)
    if (this.state !== STATE.PAUSED) {
      for (let i = 0; i < this.cards.length; i++) this.cards[i].update(dt);
      for (let i = 0; i < this.particles.length; i++) this.particles[i].update(dt);
      this.removeDeadParticles();
    }

    this.flash = Math.max(0, this.flash - dt * 2);
    this.updateHud();
  };

  Game.prototype.removeDeadParticles = function () {
    const alive = [];
    for (let i = 0; i < this.particles.length; i++) {
      if (this.particles[i].alive) alive.push(this.particles[i]);
    }
    this.particles = alive;
  };

  Game.prototype.updateHud = function () {
    this.ui.hud({
      title: this.level.title(),
      name: this.level.name,
      pairs: this.matches + ' / ' + this.level.pairs,
      moves: this.moves,
      time: Math.ceil(this.timeLeft),
      timeLow: this.state === STATE.PLAYING && this.timeLeft < 10,
      score: this.score,
      best: this.bestScore(),
      progress: this.matches / this.level.pairs,
      canPause: this.state === STATE.PLAYING || this.state === STATE.PAUSED,
      paused: this.state === STATE.PAUSED
    });
  };

  /* ---------- drawing ---------- */

  Game.prototype.render = function () {
    const ctx = this.ctx;

    // Draw in board units; the canvas scales them to real pixels.
    ctx.setTransform(this.scale, 0, 0, this.scale, 0, 0);

    // the table
    ctx.fillStyle = TABLE_EDGE;
    ctx.fillRect(0, 0, this.width, this.height);
    ctx.fillStyle = TABLE;
    Utils.roundRect(ctx, 8, 8, this.width - 16, this.height - 16, 14);
    ctx.fill();

    // Each card draws itself. The highlighted one gets a yellow outline.
    const showCursor = this.state === STATE.PLAYING || this.state === STATE.READY;
    for (let i = 0; i < this.cards.length; i++) {
      this.cards[i].render(ctx, showCursor && i === this.cursor);
    }
    for (let i = 0; i < this.particles.length; i++) this.particles[i].render(ctx);

    // red flash after a wrong guess or when time runs out
    if (this.flash > 0) {
      ctx.fillStyle = 'rgba(224, 72, 62, ' + this.flash * 0.4 + ')';
      ctx.fillRect(0, 0, this.width, this.height);
    }
  };

  global.Game = Game;
})(window);
