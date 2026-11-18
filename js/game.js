// The Game: game states, the game loop, collisions, scoring and drawing.
(function (global) {
  'use strict';

  const { pick, Store } = Utils;

  // Every screen the game can be on.
  const STATE = {
    MENU: 'menu',
    LEVELS: 'levels',
    READY: 'ready',     // level loaded, waiting for the first key
    PLAYING: 'playing',
    PAUSED: 'paused',
    CLEARED: 'cleared', // level finished
    OVER: 'over'        // crashed
  };

  const SAVE_KEY = 'snake-progress-v2';
  const BOARD = '#1e2429';
  const BOARD_ALT = '#222930';

  function Game(canvas, ui) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.ui = ui;

    // The board is 21 x 21 cells. We draw in "cell units" of 24px and
    // scale the whole drawing to whatever size the canvas is on screen.
    this.cell = 24;
    this.cols = 21;
    this.rows = 21;
    this.width = this.cols * this.cell;
    this.height = this.rows * this.cell;
    this.scale = 1;

    // Saved between visits: highest unlocked level and best scores.
    this.progress = Store.load(SAVE_KEY, { unlocked: 1, best: {}, endless: 0 });

    this.mode = 'campaign'; // or 'endless'
    this.selected = 1;      // level highlighted in the level picker
    this.state = null;

    this.lastTime = 0;    // time of the previous frame
    this.stateTime = 0;   // seconds since the state last changed
    this.accumulator = 0; // time collected towards the next step

    this.input = new Input(canvas.parentElement);
    this.input.swipeEnabled = () => this.state === STATE.READY || this.state === STATE.PLAYING;
    this.bindInput();

    this.loop = this.loop.bind(this);
    global.addEventListener('resize', () => this.resize());

    this.setup(LEVELS[0]);
    this.resize();
    this.setState(STATE.MENU);
  }

  // A turn pressed after this much of a step is applied at once (less input lag).
  Game.EARLY_STEP = 0.35;

  /* ---------- canvas size ---------- */

  // Makes the canvas match its size on screen so it stays sharp.
  Game.prototype.resize = function () {
    const size = Math.round(this.canvas.clientWidth * (global.devicePixelRatio || 1)) || this.width;
    this.canvas.width = size;
    this.canvas.height = size;
    this.scale = size / this.width;
  };

  /* ---------- input ---------- */

  Game.prototype.bindInput = function () {
    const input = this.input;
    input.on('turn', (dir) => this.turn(dir));
    input.on('point', (p) => this.turnTowards(p));
    input.on('confirm', () => this.confirm());
    input.on('back', () => this.back());
    input.on('pause', () => this.togglePause());
    input.on('space', () => {
      if (this.state === STATE.PLAYING || this.state === STATE.PAUSED) this.togglePause();
      else this.confirm();
    });
    input.on('restart', () => {
      if (this.state !== STATE.MENU && this.state !== STATE.LEVELS) this.restart();
    });

    // Pause when the player switches to another window or tab.
    global.addEventListener('blur', () => {
      if (this.state === STATE.PLAYING) this.setState(STATE.PAUSED);
    });
  };

  Game.prototype.turn = function (dir) {
    if (this.state === STATE.READY) {
      if (!dir.isOpposite(this.snake.dir)) this.snake.queueTurn(dir);
      this.begin();
      return;
    }
    if (this.state !== STATE.PLAYING) return;

    const wasEmpty = this.snake.queue.length === 0;
    const added = this.snake.queueTurn(dir);
    // If the snake is already part-way to the next cell, step now instead of waiting.
    if (added && wasEmpty && this.accumulator >= this.interval * Game.EARLY_STEP) {
      this.accumulator = 0;
      this.tick();
    }
  };

  // Mouse steering: turn towards the side of the snake's head that was clicked.
  // p is the click position as a fraction of the board (0..1).
  Game.prototype.turnTowards = function (p) {
    if (this.state !== STATE.READY && this.state !== STATE.PLAYING) return;
    const head = this.snake.head();
    const dx = p.x * this.cols - (head.x + 0.5);
    const dy = p.y * this.rows - (head.y + 0.5);
    const goingSideways = this.snake.nextDir().x !== 0;
    if (goingSideways) this.turn(dy < 0 ? Dir.UP : Dir.DOWN);
    else this.turn(dx < 0 ? Dir.LEFT : Dir.RIGHT);
  };

  // Called by the buttons on the overlay screens.
  Game.prototype.action = function (name, arg) {
    switch (name) {
      case 'campaign':
      case 'levels': this.showLevels(); break;
      case 'endless': this.startEndless(); break;
      case 'menu': this.setState(STATE.MENU); break;
      case 'play': this.startLevel(arg); break;
      case 'preview': this.preview(arg); break;
      case 'pause':
      case 'resume': this.togglePause(); break;
      case 'restart': this.restart(); break;
      case 'next': this.nextLevel(); break;
      case 'back': this.back(); break;
    }
  };

  // Enter key
  Game.prototype.confirm = function () {
    switch (this.state) {
      case STATE.MENU: this.showLevels(); break;
      case STATE.LEVELS: this.startLevel(this.selected); break;
      case STATE.READY: this.begin(); break;
      case STATE.PAUSED: this.togglePause(); break;
      // the short wait stops a held key from skipping the result screen
      case STATE.CLEARED: if (this.stateTime > 0.25) this.nextLevel(); break;
      case STATE.OVER: if (this.stateTime > 0.25) this.restart(); break;
    }
  };

  // Escape key
  Game.prototype.back = function () {
    if (this.state === STATE.PLAYING || this.state === STATE.PAUSED) this.togglePause();
    else if (this.state === STATE.LEVELS || this.mode === 'endless') this.setState(STATE.MENU);
    else if (this.state !== STATE.MENU) this.showLevels();
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
    this.mode = 'campaign';
    this.selected = this.progress.unlocked;
    this.setup(LEVELS[this.selected - 1]);
    this.setState(STATE.LEVELS);
  };

  // Shows a level's map behind the level picker.
  Game.prototype.preview = function (n) {
    if (this.state !== STATE.LEVELS) return;
    if (this.level !== LEVELS[n - 1]) this.setup(LEVELS[n - 1]);
    if (this.isUnlocked(n)) this.selected = n;
  };

  Game.prototype.isUnlocked = function (n) {
    return n <= this.progress.unlocked;
  };

  Game.prototype.isLastLevel = function () {
    return this.mode === 'campaign' && this.level.number === LEVELS.length;
  };

  Game.prototype.startLevel = function (n) {
    if (!this.isUnlocked(n)) return;
    this.mode = 'campaign';
    this.setup(LEVELS[n - 1]);
    this.setState(STATE.READY);
  };

  Game.prototype.startEndless = function () {
    this.mode = 'endless';
    this.setup(new EndlessLevel());
    this.setState(STATE.READY);
  };

  Game.prototype.restart = function () {
    if (this.mode === 'endless') this.startEndless();
    else this.startLevel(this.level.number);
  };

  Game.prototype.nextLevel = function () {
    if (this.isLastLevel()) this.showLevels();
    else this.startLevel(this.level.number + 1);
  };

  // Puts a fresh copy of the level on the board.
  Game.prototype.setup = function (level) {
    const built = level.build();
    this.level = level;
    this.walls = built.walls;
    this.solid = built.solid; // solid[y * cols + x] is the wall at that cell, or null
    this.movers = built.movers;
    this.portals = built.portals;
    this.snake = new Snake(level.start.x, level.start.y, level.dir, 3);
    this.apples = [];
    this.particles = [];
    this.score = 0;
    this.eaten = 0;
    this.newBest = false;
    this.flash = 0;
    this.steps = 0;
    this.accumulator = 0;
    this.interval = level.interval(this) / 1000; // seconds per step
    this.spawn(Apple);
  };

  // The first key press moves the snake straight away.
  Game.prototype.begin = function () {
    this.setState(STATE.PLAYING);
    this.accumulator = 0;
    this.tick();
  };

  Game.prototype.crash = function () {
    this.snake.die();
    this.flash = 0.5;
    this.burst(this.snake.head(), '#e0483e', 26);
    if (this.mode === 'endless') this.saveBest();
    this.setState(STATE.OVER);
  };

  Game.prototype.clear = function () {
    this.score += Game.CLEAR_BONUS;
    this.saveBest();
    if (this.level.number === this.progress.unlocked && !this.isLastLevel()) {
      this.progress.unlocked++;
    }
    Store.save(SAVE_KEY, this.progress);
    this.burst(this.snake.head(), '#ffffff', 24);
    this.setState(STATE.CLEARED);
  };

  Game.CLEAR_BONUS = 100;

  /* ---------- scores ---------- */

  Game.prototype.bestScore = function () {
    if (this.mode === 'endless') return this.progress.endless;
    return this.progress.best[this.level.number] || 0;
  };

  Game.prototype.saveBest = function () {
    if (this.score <= this.bestScore()) return;
    if (this.mode === 'endless') this.progress.endless = this.score;
    else this.progress.best[this.level.number] = this.score;
    this.newBest = true;
    Store.save(SAVE_KEY, this.progress);
  };

  Game.prototype.campaignTotal = function () {
    let total = 0;
    LEVELS.forEach((level) => { total += this.progress.best[level.number] || 0; });
    return total;
  };

  /* ---------- what is on a cell ---------- */

  Game.prototype.inBounds = function (p) {
    return p.x >= 0 && p.y >= 0 && p.x < this.cols && p.y < this.rows;
  };

  Game.prototype.wallAt = function (p) {
    return this.solid[p.y * this.cols + p.x];
  };

  Game.prototype.moverAt = function (p) {
    return this.movers.find((m) => m.pos.equals(p));
  };

  Game.prototype.portalAt = function (p) {
    return this.portals.find((m) => m.pos.equals(p));
  };

  Game.prototype.appleAt = function (p) {
    return this.apples.find((a) => a.alive && a.pos.equals(p));
  };

  Game.prototype.isFree = function (p) {
    return !this.wallAt(p) && !this.portalAt(p) && !this.moverAt(p) &&
      !this.snake.occupies(p) && !this.appleAt(p);
  };

  // The cell you land on when moving one step from `from` in `dir`.
  // Handles open edges and portals. Returns null for "off the board".
  Game.prototype.stepFrom = function (from, dir) {
    let p = from.add(dir);
    if (!this.inBounds(p)) {
      if (!this.level.wrap) return null;
      p = new Vec((p.x + this.cols) % this.cols, (p.y + this.rows) % this.rows);
    }
    const portal = this.portalAt(p);
    return portal ? portal.partner.pos : p;
  };

  // All free cells the snake can reach (a flood fill from its head),
  // so an apple never appears somewhere the snake can't get to.
  Game.prototype.reachableCells = function () {
    const seen = {};
    const queue = [this.snake.head()];
    const free = [];
    seen[this.snake.head().key()] = true;

    for (let i = 0; i < queue.length; i++) {
      DIRS.forEach((dir) => {
        const next = this.stepFrom(queue[i], dir);
        if (!next || seen[next.key()] || this.wallAt(next)) return;
        seen[next.key()] = true;
        queue.push(next);
        if (this.isFree(next)) free.push(next);
      });
    }
    return free;
  };

  /* ---------- apples, walls and effects ---------- */

  // Works with any apple constructor: spawn(Apple) or spawn(GoldenApple).
  Game.prototype.spawn = function (AppleType) {
    const free = this.reachableCells();
    if (!free.length) return;
    const p = pick(free);
    this.apples.push(new AppleType(p.x, p.y));
  };

  Game.prototype.hasGolden = function () {
    return this.apples.some((a) => a instanceof GoldenApple);
  };

  // Endless mode: add a wall on a free cell that is not too close to the snake.
  Game.prototype.dropWall = function () {
    const head = this.snake.head();
    const options = this.reachableCells().filter((p) => p.distance(head) > 4);
    if (!options.length) return;
    const p = pick(options);
    const wall = new Wall(p.x, p.y);
    this.walls.push(wall);
    this.solid[p.y * this.cols + p.x] = wall;
    this.burst(p, '#9aa4ae', 12);
  };

  Game.prototype.gain = function (points, pos) {
    this.score += points;
    this.particles.push(new ScorePopup((pos.x + 0.5) * this.cell, pos.y * this.cell, '+' + points));
  };

  Game.prototype.burst = function (pos, colour, count) {
    const x = (pos.x + 0.5) * this.cell;
    const y = (pos.y + 0.5) * this.cell;
    for (let i = 0; i < count; i++) this.particles.push(new Particle(x, y, colour));
  };

  /* ---------- one step of the game ---------- */

  Game.prototype.tick = function () {
    const snake = this.snake;
    this.steps++;
    snake.applyTurn();

    // Collision detection: edge, wall, moving wall or own body
    const next = this.stepFrom(snake.head(), snake.dir);
    if (!next || this.wallAt(next) || this.moverAt(next) || snake.hitsSelf(next)) {
      this.crash();
      return;
    }
    snake.move(next);

    const apple = this.appleAt(next);
    if (apple) this.eatApple(apple);
    if (this.state !== STATE.PLAYING) return;

    // moving walls go at half the snake's speed
    if (this.steps % 2 === 0) this.stepMovers();
  };

  Game.prototype.eatApple = function (apple) {
    apple.eat(this); // Apple and GoldenApple each know what to do
    this.apples = this.apples.filter((a) => a.alive);
    if (!apple.countsToGoal) return;

    this.eaten++;
    this.level.onEat(this);
    if (this.level.isComplete(this)) {
      this.clear();
      return;
    }
    this.spawn(Apple);
    if (!this.hasGolden() && Math.random() < 0.25) this.spawn(GoldenApple);
    this.interval = this.level.interval(this) / 1000;
  };

  // Moving walls never slide into the snake or the cell it is about to enter.
  Game.prototype.stepMovers = function () {
    const ahead = this.stepFrom(this.snake.head(), this.snake.nextDir());
    const isBlocked = (p, self) =>
      !this.inBounds(p) || this.wallAt(p) || this.portalAt(p) || this.appleAt(p) ||
      this.snake.occupies(p) || (ahead && p.equals(ahead)) ||
      this.movers.some((m) => m !== self && m.pos.equals(p));
    this.movers.forEach((m) => m.step(isBlocked));
  };

  /* ---------- game loop ---------- */

  Game.prototype.start = function () {
    global.requestAnimationFrame(this.loop);
  };

  // Runs every frame: update, then draw.
  Game.prototype.loop = function (now) {
    const dt = this.lastTime ? Math.min((now - this.lastTime) / 1000, 0.1) : 0;
    this.lastTime = now;
    this.update(dt);
    this.render();
    global.requestAnimationFrame(this.loop);
  };

  Game.prototype.update = function (dt) {
    this.stateTime += dt;

    // The snake moves in fixed steps; frames in between just animate it.
    if (this.state === STATE.PLAYING) {
      this.accumulator += dt;
      while (this.accumulator >= this.interval && this.state === STATE.PLAYING) {
        this.accumulator -= this.interval;
        this.tick();
      }
    }

    if (this.state !== STATE.PAUSED) {
      const all = [this.snake].concat(this.apples, this.portals, this.particles);
      all.forEach((thing) => thing.update(dt));
      this.apples = this.apples.filter((a) => a.alive);
      this.particles = this.particles.filter((p) => p.alive);
    }

    this.flash = Math.max(0, this.flash - dt * 2.5);
    this.updateHud();
  };

  Game.prototype.updateHud = function () {
    const endless = this.mode === 'endless';
    const every = EndlessLevel.WALL_EVERY;
    this.ui.hud({
      title: this.level.title(),
      name: endless ? 'No finish line' : this.level.name,
      score: this.score,
      best: this.bestScore(),
      apples: endless ? String(this.eaten) : this.eaten + ' / ' + this.level.target,
      progress: endless ? (this.eaten % every) / every : this.eaten / this.level.target,
      canPause: this.state === STATE.PLAYING || this.state === STATE.PAUSED,
      paused: this.state === STATE.PAUSED
    });
  };

  /* ---------- drawing ---------- */

  Game.prototype.render = function () {
    const ctx = this.ctx;
    const cell = this.cell;

    // How far through the current step we are (0..1), for smooth movement.
    const moving = this.state === STATE.PLAYING || this.state === STATE.PAUSED;
    const alpha = moving ? Math.min(1, this.accumulator / this.interval) : 1;
    const moverAlpha = moving ? ((this.steps % 2) + alpha) / 2 : 1;

    ctx.setTransform(this.scale, 0, 0, this.scale, 0, 0);

    // Checkerboard floor
    ctx.fillStyle = BOARD;
    ctx.fillRect(0, 0, this.width, this.height);
    ctx.fillStyle = BOARD_ALT;
    for (let y = 0; y < this.rows; y++) {
      for (let x = y % 2; x < this.cols; x += 2) ctx.fillRect(x * cell, y * cell, cell, cell);
    }

    // Dashed border means the edges are open
    if (this.level.wrap) {
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
      ctx.lineWidth = 2;
      ctx.setLineDash([cell * 0.4, cell * 0.3]);
      ctx.strokeRect(1, 1, this.width - 2, this.height - 2);
      ctx.setLineDash([]);
    }

    // Each object draws itself (they all have their own render method)
    this.walls.forEach((w) => w.render(ctx, cell));
    this.portals.forEach((p) => p.render(ctx, cell));
    this.movers.forEach((m) => m.render(ctx, cell, moverAlpha));
    this.apples.forEach((a) => a.render(ctx, cell));
    this.snake.render(ctx, cell, alpha);
    this.particles.forEach((p) => p.render(ctx, cell));

    // Red flash after a crash
    if (this.flash > 0) {
      ctx.fillStyle = 'rgba(224, 72, 62, ' + this.flash * 0.35 + ')';
      ctx.fillRect(0, 0, this.width, this.height);
    }
  };

  global.Game = Game;
})(window);
