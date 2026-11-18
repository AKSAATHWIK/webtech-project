// The Game: game states, the game loop, collisions, scoring and drawing.
(function (global) {
  'use strict';

  const { pick, Store } = Utils;

  // Every screen the game can be on.
  const STATE = {
    MENU: 'menu',
    LEVELS: 'levels',
    SKINS: 'skins',     // choosing the snake's colours
    READY: 'ready',     // level loaded, waiting for the first key
    PLAYING: 'playing',
    PAUSED: 'paused',
    CLEARED: 'cleared', // level finished
    OVER: 'over'        // crashed
  };

  const SAVE_KEY = 'snake-progress-v2';
  // Kept close together so the floor stays calm and the objects on it stand out.
  const BOARD = '#447a44';     // the gaps between floor tiles
  const TILE = '#4d8b4b';      // grass tiles, two shades
  const TILE_ALT = '#51904f';
  const EDGE = '#bfe6ff'; // colour of open (wrapping) edges

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
    this.progress = Store.load(SAVE_KEY, { unlocked: 1, best: {}, endless: 0, skin: 0 });

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

    // A new turn moves the snake straight away instead of waiting for the next
    // step, so the controls never lag. The step timer then starts again from 0.
    const wasEmpty = this.snake.queue.length === 0;
    const added = this.snake.queueTurn(dir);
    if (added && wasEmpty) {
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
      case 'skins': this.showSkins(); break;
      case 'skin': this.setSkin(arg); break;
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
      case STATE.SKINS: this.setState(STATE.MENU); break;
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
    else if (this.state === STATE.LEVELS || this.state === STATE.SKINS || this.mode === 'endless') this.setState(STATE.MENU);
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

  // Skin picker: a long snake across the top of the board so you can see the colours.
  Game.prototype.showSkins = function () {
    this.mode = 'campaign';
    this.setup(LEVELS[0]);
    this.snake = new Snake(15, 6, Dir.RIGHT, 11);
    this.snake.skin = this.skin();
    this.apples = [];
    this.setState(STATE.SKINS);
  };

  Game.prototype.skin = function () {
    return Skin.LIST[this.progress.skin] || Skin.LIST[0];
  };

  Game.prototype.setSkin = function (i) {
    if (!Skin.LIST[i]) return;
    this.progress.skin = i;
    Store.save(SAVE_KEY, this.progress);
    this.snake.skin = this.skin();
    this.ui.renderSkins(this);
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
    this.snake.skin = this.skin();
    this.apples = [];
    this.particles = [];
    this.pending = [];  // Endless: walls that are about to drop in
    this.playTime = 0;  // seconds actually spent playing this attempt
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
    this.burst(this.snake.head(), Apple.prototype.colour, 26);
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
      !this.snake.occupies(p) && !this.appleAt(p) && !this.pending.some((w) => w.pos.equals(p));
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

  // A random free cell at least `gap` cells away from the snake's head.
  Game.prototype.freeCellAway = function (gap) {
    const head = this.snake.head();
    const options = this.reachableCells().filter((p) => p.distance(head) > gap);
    return options.length ? pick(options) : null;
  };

  // Endless mode: a wall flashes on a free cell for a few steps, then becomes solid.
  Game.prototype.dropWall = function () {
    const p = this.freeCellAway(4);
    if (p) this.pending.push({ pos: p, steps: Game.WARN_STEPS });
  };

  Game.WARN_STEPS = 10;

  // Counts down the flashing walls. One only lands when nothing is in its way.
  Game.prototype.landWalls = function () {
    this.pending.forEach((w) => {
      w.steps--;
      if (w.steps > 0 || this.snake.occupies(w.pos) || this.appleAt(w.pos)) return;
      const wall = new Wall(w.pos.x, w.pos.y);
      this.walls.push(wall);
      this.solid[w.pos.y * this.cols + w.pos.x] = wall;
      this.burst(w.pos, Wall.prototype.colour, 12);
      w.done = true;
    });
    this.pending = this.pending.filter((w) => !w.done);
  };

  // Endless stage 2: a pair of portals far apart from each other.
  Game.prototype.addPortals = function () {
    const a = this.freeCellAway(3);
    if (!a) return;
    const far = this.reachableCells().filter((p) => p.distance(a) >= 10 && p.distance(this.snake.head()) > 3);
    if (!far.length) return;
    const b = pick(far);
    const pa = new Portal(a.x, a.y, 1);
    const pb = new Portal(b.x, b.y, 1);
    pa.partner = pb;
    pb.partner = pa;
    this.portals.push(pa, pb);
    this.burst(a, Portal.COLOURS[0], 16);
    this.burst(b, Portal.COLOURS[0], 16);
  };

  // Endless stages 3 and 4: a moving wall.
  Game.prototype.addMover = function () {
    const p = this.freeCellAway(5);
    if (!p) return;
    this.movers.push(new MovingWall(p.x, p.y, Math.random() < 0.5 ? 'h' : 'v'));
    this.burst(p, MovingWall.prototype.colour, 16);
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
    if (this.pending.length) this.landWalls();
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
      this.playTime += dt;
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
    const every = EndlessLevel.STAGE_EVERY; // in Endless the bar fills up to the next stage
    this.ui.hud({
      title: this.level.title(),
      name: this.level.subtitle(this),
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

    // Floor: rounded tiles with thin dark gaps, in two alternating shades
    ctx.fillStyle = BOARD;
    ctx.fillRect(0, 0, this.width, this.height);
    const gap = 1.5;
    for (let y = 0; y < this.rows; y++) {
      for (let x = 0; x < this.cols; x++) {
        ctx.fillStyle = (x + y) % 2 ? TILE_ALT : TILE;
        Utils.roundRect(ctx, x * cell + gap, y * cell + gap, cell - gap * 2, cell - gap * 2, 4);
        ctx.fill();
      }
    }

    if (this.level.wrap) this.renderOpenEdges(ctx, cell);

    // Each object draws itself (they all have their own render method)
    this.walls.forEach((w) => w.render(ctx, cell));
    this.renderPending(ctx, cell);
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

  // A wall that is about to drop: a flashing outline that fills in as it gets closer.
  Game.prototype.renderPending = function (ctx, cell) {
    const flash = Math.floor(this.lastTime / 150) % 2 === 0;
    this.pending.forEach((w) => {
      const x = w.pos.x * cell;
      const y = w.pos.y * cell;
      const fill = 1 - w.steps / Game.WARN_STEPS;
      ctx.fillStyle = 'rgba(14, 36, 16, 0.45)'; // dark square so the warning shows on the grass
      ctx.fillRect(x + 1, y + 1, cell - 2, cell - 2);
      ctx.fillStyle = 'rgba(203, 191, 169, ' + (0.3 + fill * 0.6) + ')';
      ctx.fillRect(x + 5, y + 5, cell - 10, cell - 10);
      ctx.strokeStyle = flash ? '#ffd34d' : '#ffffff';
      ctx.lineWidth = 2.5;
      ctx.strokeRect(x + 2.5, y + 2.5, cell - 5, cell - 5);
    });
  };

  // Open edges get a coloured strip and small arrows pointing out, on every edge
  // cell that isn't a wall. That shows exactly where you can pass through.
  Game.prototype.renderOpenEdges = function (ctx, cell) {
    const pulse = 0.75 + Math.sin(this.lastTime / 400) * 0.2;
    const depth = cell * 0.12;
    const last = this.cols - 1;
    const edges = [
      { dir: Dir.UP, at: (i) => new Vec(i, 0) },
      { dir: Dir.DOWN, at: (i) => new Vec(i, last) },
      { dir: Dir.LEFT, at: (i) => new Vec(0, i) },
      { dir: Dir.RIGHT, at: (i) => new Vec(last, i) }
    ];

    edges.forEach((edge) => {
      const d = edge.dir;
      for (let i = 0; i <= last; i++) {
        const p = edge.at(i);
        if (this.wallAt(p)) continue;
        const x = p.x * cell;
        const y = p.y * cell;

        // thin solid strip on the outer side of the cell
        ctx.globalAlpha = pulse;
        ctx.fillStyle = EDGE;
        if (d.x === 0) ctx.fillRect(x, d.y > 0 ? y + cell - depth : y, cell, depth);
        else ctx.fillRect(d.x > 0 ? x + cell - depth : x, y, depth, cell);

        // a small arrow pointing off the board on every other cell
        if (i % 2 === 1) {
          const cx = x + cell / 2 + d.x * cell * 0.22;
          const cy = y + cell / 2 + d.y * cell * 0.22;
          const s = cell * 0.14;
          ctx.globalAlpha = pulse;
          ctx.lineCap = 'round';
          ctx.lineJoin = 'round';
          ctx.beginPath();
          ctx.moveTo(cx - d.x * s - d.y * s * 1.4, cy - d.y * s - d.x * s * 1.4);
          ctx.lineTo(cx + d.x * s, cy + d.y * s);
          ctx.lineTo(cx - d.x * s + d.y * s * 1.4, cy - d.y * s + d.x * s * 1.4);
          ctx.strokeStyle = 'rgba(14, 36, 16, 0.6)'; // dark edge first, so it reads on the grass
          ctx.lineWidth = 4.5;
          ctx.stroke();
          ctx.strokeStyle = EDGE;
          ctx.lineWidth = 2.5;
          ctx.stroke();
        }
      }
    });
    ctx.globalAlpha = 1;
  };

  global.Game = Game;
})(window);
