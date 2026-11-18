// The Game: game states, the game loop, collisions, scoring and drawing.
(function (global) {
  'use strict';

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

  // Board colours. The two tile shades are close so the floor stays calm.
  const BOARD = '#447a44';    // the gaps between floor tiles
  const TILE = '#4d8b4b';     // grass tiles, two shades
  const TILE_ALT = '#51904f';
  const EDGE = '#bfe6ff';     // open (wrapping) edges

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

    // Saved between visits: highest unlocked level, best scores and chosen skin.
    this.progress = Utils.loadData(SAVE_KEY, { unlocked: 1, best: {}, endless: 0, skin: 0 });

    this.mode = 'campaign'; // or 'endless'
    this.selected = 1;      // level highlighted in the level picker
    this.state = null;

    this.lastTime = 0;    // time of the previous frame
    this.stateTime = 0;   // seconds since the state last changed
    this.accumulator = 0; // time collected towards the next step

    this.input = new Input(canvas.parentElement);
    this.bindInput();

    // Arrow function so `this` still means the game inside the listener.
    window.addEventListener('resize', () => this.resize());

    this.setup(LEVELS[0]);
    this.resize();
    this.setState(STATE.MENU);
  }

  Game.CLEAR_BONUS = 100;
  Game.WARN_STEPS = 10; // how long a falling wall flashes before it lands

  /* ---------- canvas size ---------- */

  // Makes the canvas match its size on screen so it stays sharp.
  Game.prototype.resize = function () {
    const pixels = window.devicePixelRatio || 1;
    let size = Math.round(this.canvas.clientWidth * pixels);
    if (size === 0) size = this.width;
    this.canvas.width = size;
    this.canvas.height = size;
    this.scale = size / this.width;
  };

  /* ---------- input ---------- */

  // Tells the Input which game method to call for each kind of event.
  Game.prototype.bindInput = function () {
    this.input.on('turn', (dir) => this.turn(dir));
    this.input.on('point', (p) => this.turnTowards(p));
    this.input.on('confirm', () => this.confirm());
    this.input.on('back', () => this.back());
    this.input.on('pause', () => this.togglePause());
    this.input.on('space', () => this.space());
    this.input.on('restart', () => {
      if (this.state !== STATE.MENU && this.state !== STATE.LEVELS) this.restart();
    });

    // Pause when the player switches to another window or tab.
    window.addEventListener('blur', () => {
      if (this.state === STATE.PLAYING) this.setState(STATE.PAUSED);
    });
  };

  Game.prototype.turn = function (dir) {
    // On the start screen, the first key starts the level.
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
    const dx = p.x * this.cols - (head.x + 0.5); // how far right of the head
    const dy = p.y * this.rows - (head.y + 0.5); // how far below the head

    if (this.snake.nextDir().x !== 0) {
      // moving left or right: a click above turns up, below turns down
      if (dy < 0) this.turn(Dir.UP);
      else this.turn(Dir.DOWN);
    } else {
      // moving up or down: a click to the left turns left, to the right turns right
      if (dx < 0) this.turn(Dir.LEFT);
      else this.turn(Dir.RIGHT);
    }
  };

  // Called by the buttons on the overlay screens (their data-action).
  Game.prototype.action = function (name, arg) {
    if (name === 'campaign' || name === 'levels') this.showLevels();
    else if (name === 'endless') this.startEndless();
    else if (name === 'skins') this.showSkins();
    else if (name === 'skin') this.setSkin(arg);
    else if (name === 'menu') this.setState(STATE.MENU);
    else if (name === 'play') this.startLevel(arg);
    else if (name === 'preview') this.preview(arg);
    else if (name === 'pause' || name === 'resume') this.togglePause();
    else if (name === 'restart') this.restart();
    else if (name === 'next') this.nextLevel();
    else if (name === 'back') this.back();
  };

  // Enter key
  Game.prototype.confirm = function () {
    const s = this.state;
    // the short wait (stateTime) stops a held key from skipping the result screen
    if (s === STATE.MENU) this.showLevels();
    else if (s === STATE.SKINS) this.setState(STATE.MENU);
    else if (s === STATE.LEVELS) this.startLevel(this.selected);
    else if (s === STATE.READY) this.begin();
    else if (s === STATE.PAUSED) this.togglePause();
    else if (s === STATE.CLEARED && this.stateTime > 0.25) this.nextLevel();
    else if (s === STATE.OVER && this.stateTime > 0.25) this.restart();
  };

  // Space bar: pause while playing, otherwise the same as Enter.
  Game.prototype.space = function () {
    if (this.state === STATE.PLAYING || this.state === STATE.PAUSED) this.togglePause();
    else this.confirm();
  };

  // Escape key
  Game.prototype.back = function () {
    const s = this.state;
    if (s === STATE.PLAYING || s === STATE.PAUSED) this.togglePause();
    else if (s === STATE.LEVELS || s === STATE.SKINS || this.mode === 'endless') this.setState(STATE.MENU);
    else if (s !== STATE.MENU) this.showLevels();
  };

  /* ---------- switching states and levels ---------- */

  Game.prototype.setState = function (state) {
    this.state = state;
    this.stateTime = 0;
    // swiping only steers the snake on the start screen and while playing
    this.input.swipeOn = state === STATE.READY || state === STATE.PLAYING;
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

  // The skin the player chose.
  Game.prototype.skin = function () {
    const chosen = Skin.LIST[this.progress.skin];
    if (chosen) return chosen;
    return Skin.LIST[0];
  };

  Game.prototype.setSkin = function (i) {
    this.progress.skin = i;
    Utils.saveData(SAVE_KEY, this.progress);
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
    // unlock the next level
    if (this.level.number === this.progress.unlocked && !this.isLastLevel()) {
      this.progress.unlocked++;
    }
    Utils.saveData(SAVE_KEY, this.progress);
    this.burst(this.snake.head(), '#ffffff', 24);
    this.setState(STATE.CLEARED);
  };

  /* ---------- scores ---------- */

  Game.prototype.bestScore = function () {
    if (this.mode === 'endless') return this.progress.endless;
    const best = this.progress.best[this.level.number];
    if (best) return best;
    return 0;
  };

  Game.prototype.saveBest = function () {
    if (this.score <= this.bestScore()) return;
    if (this.mode === 'endless') this.progress.endless = this.score;
    else this.progress.best[this.level.number] = this.score;
    this.newBest = true;
    Utils.saveData(SAVE_KEY, this.progress);
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

  /* ---------- what is on a cell ---------- */

  Game.prototype.inBounds = function (p) {
    return p.x >= 0 && p.y >= 0 && p.x < this.cols && p.y < this.rows;
  };

  Game.prototype.wallAt = function (p) {
    return this.solid[p.y * this.cols + p.x];
  };

  // These return the thing on cell p, or null if there is nothing there.
  Game.prototype.moverAt = function (p) {
    for (let i = 0; i < this.movers.length; i++) {
      if (this.movers[i].pos.equals(p)) return this.movers[i];
    }
    return null;
  };

  Game.prototype.portalAt = function (p) {
    for (let i = 0; i < this.portals.length; i++) {
      if (this.portals[i].pos.equals(p)) return this.portals[i];
    }
    return null;
  };

  Game.prototype.appleAt = function (p) {
    for (let i = 0; i < this.apples.length; i++) {
      if (this.apples[i].alive && this.apples[i].pos.equals(p)) return this.apples[i];
    }
    return null;
  };

  Game.prototype.pendingAt = function (p) {
    for (let i = 0; i < this.pending.length; i++) {
      if (this.pending[i].pos.equals(p)) return this.pending[i];
    }
    return null;
  };

  // Is the cell completely empty?
  Game.prototype.isFree = function (p) {
    if (this.wallAt(p) || this.moverAt(p) || this.portalAt(p)) return false;
    if (this.appleAt(p) || this.pendingAt(p)) return false;
    if (this.snake.occupies(p)) return false;
    return true;
  };

  // The cell you land on when moving one step from `from` in `dir`.
  // Handles open edges and portals. Returns null for "off the board".
  Game.prototype.stepFrom = function (from, dir) {
    let p = from.add(dir);
    if (!this.inBounds(p)) {
      if (!this.level.wrap) return null;  // walled edge: crash
      // open edge: come back on the other side
      p = new Vec((p.x + this.cols) % this.cols, (p.y + this.rows) % this.rows);
    }
    const portal = this.portalAt(p);
    if (portal) return portal.partner.pos; // come out of the other portal
    return p;
  };

  // All free cells the snake can reach. It works like spreading paint from the
  // snake's head (a flood fill): visit a cell, then its four neighbours, and so on.
  // This way an apple never appears somewhere the snake can't get to.
  Game.prototype.reachableCells = function () {
    const seen = {};       // cells already visited, by key "x,y"
    const toVisit = [this.snake.head()];
    const free = [];
    seen[this.snake.head().key()] = true;

    for (let i = 0; i < toVisit.length; i++) {
      for (let d = 0; d < DIRS.length; d++) {
        const next = this.stepFrom(toVisit[i], DIRS[d]);
        if (next === null || seen[next.key()] || this.wallAt(next)) continue;
        seen[next.key()] = true;
        toVisit.push(next);
        if (this.isFree(next)) free.push(next);
      }
    }
    return free;
  };

  // A random free cell that is more than `gap` cells away from the snake's head.
  Game.prototype.freeCellAway = function (gap) {
    const head = this.snake.head();
    const cells = this.reachableCells();
    const options = [];
    for (let i = 0; i < cells.length; i++) {
      if (cells[i].distance(head) > gap) options.push(cells[i]);
    }
    if (options.length === 0) return null;
    return Utils.pick(options);
  };

  /* ---------- apples, walls and effects ---------- */

  // Works with any apple constructor: spawn(Apple) or spawn(GoldenApple).
  Game.prototype.spawn = function (AppleType) {
    const free = this.reachableCells();
    if (free.length === 0) return;
    const p = Utils.pick(free);
    this.apples.push(new AppleType(p.x, p.y));
  };

  Game.prototype.hasGolden = function () {
    for (let i = 0; i < this.apples.length; i++) {
      if (this.apples[i] instanceof GoldenApple) return true;
    }
    return false;
  };

  // Endless mode: a wall flashes on a free cell for a few steps, then becomes solid.
  Game.prototype.dropWall = function () {
    const p = this.freeCellAway(4);
    if (p) this.pending.push({ pos: p, steps: Game.WARN_STEPS });
  };

  // Counts down the flashing walls. One only lands when nothing is on its cell.
  Game.prototype.landWalls = function () {
    const stillWaiting = [];
    for (let i = 0; i < this.pending.length; i++) {
      const w = this.pending[i];
      w.steps--;
      if (w.steps > 0 || this.snake.occupies(w.pos) || this.appleAt(w.pos)) {
        stillWaiting.push(w);
      } else {
        const wall = new Wall(w.pos.x, w.pos.y);
        this.walls.push(wall);
        this.solid[w.pos.y * this.cols + w.pos.x] = wall;
        this.burst(w.pos, Wall.prototype.colour, 12);
      }
    }
    this.pending = stillWaiting;
  };

  // Endless stage 2: a pair of linked portals.
  Game.prototype.addPortals = function () {
    const a = this.freeCellAway(3);
    const b = this.freeCellAway(3);
    if (!a || !b || a.distance(b) < 6) return; // need two different cells, not too close
    const first = new Portal(a.x, a.y, 1);
    const second = new Portal(b.x, b.y, 1);
    first.partner = second;
    second.partner = first;
    this.portals.push(first);
    this.portals.push(second);
    this.burst(a, Portal.COLOURS[0], 16);
    this.burst(b, Portal.COLOURS[0], 16);
  };

  // Endless stages 3 and 4: a moving wall.
  Game.prototype.addMover = function () {
    const p = this.freeCellAway(5);
    if (!p) return;
    let axis = 'h';
    if (Math.random() < 0.5) axis = 'v';
    this.movers.push(new MovingWall(p.x, p.y, axis));
    this.burst(p, MovingWall.prototype.colour, 16);
  };

  Game.prototype.gain = function (points, pos) {
    this.score += points;
    this.particles.push(new ScorePopup((pos.x + 0.5) * this.cell, pos.y * this.cell, '+' + points));
  };

  // A little explosion of dots on a cell.
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
    if (next === null || this.wallAt(next) || this.moverAt(next) || snake.hitsSelf(next)) {
      this.crash();
      return;
    }
    snake.move(next);

    const apple = this.appleAt(next);
    if (apple) this.eatApple(apple);
    if (this.state !== STATE.PLAYING) return; // the level may have just ended

    // moving walls go at half the snake's speed
    if (this.steps % 2 === 0) this.stepMovers();
    if (this.pending.length > 0) this.landWalls();
  };

  Game.prototype.eatApple = function (apple) {
    apple.eat(this); // Apple and GoldenApple each know what to do
    this.removeDead();
    if (!apple.countsToGoal) return;

    this.eaten++;
    this.level.onEat(this);
    if (this.level.isComplete(this)) {
      this.clear();
      return;
    }
    this.spawn(Apple);
    // sometimes a golden apple appears too
    if (!this.hasGolden() && Math.random() < 0.25) this.spawn(GoldenApple);
    this.interval = this.level.interval(this) / 1000;
  };

  Game.prototype.stepMovers = function () {
    for (let i = 0; i < this.movers.length; i++) this.movers[i].step(this);
  };

  // Called by MovingWall.step(): can a moving wall go onto cell p?
  // It never slides into the snake or the cell the snake is about to enter.
  Game.prototype.moverBlocked = function (p, mover) {
    if (!this.inBounds(p)) return true;
    if (this.wallAt(p) || this.portalAt(p) || this.appleAt(p)) return true;
    if (this.snake.occupies(p)) return true;
    const ahead = this.stepFrom(this.snake.head(), this.snake.nextDir());
    if (ahead && ahead.equals(p)) return true;
    const other = this.moverAt(p);
    if (other && other !== mover) return true;
    return false;
  };

  // Removes eaten apples and finished particles from their lists.
  Game.prototype.removeDead = function () {
    const apples = [];
    for (let i = 0; i < this.apples.length; i++) {
      if (this.apples[i].alive) apples.push(this.apples[i]);
    }
    this.apples = apples;

    const particles = [];
    for (let i = 0; i < this.particles.length; i++) {
      if (this.particles[i].alive) particles.push(this.particles[i]);
    }
    this.particles = particles;
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

    // The snake moves in fixed steps; frames in between just animate it.
    if (this.state === STATE.PLAYING) {
      this.accumulator += dt;
      this.playTime += dt;
      while (this.accumulator >= this.interval && this.state === STATE.PLAYING) {
        this.accumulator -= this.interval;
        this.tick();
      }
    }

    // Animations (apple pop-in, portal spin, golden apple timer, particles)
    if (this.state !== STATE.PAUSED) {
      this.snake.update(dt);
      for (let i = 0; i < this.apples.length; i++) this.apples[i].update(dt);
      for (let i = 0; i < this.portals.length; i++) this.portals[i].update(dt);
      for (let i = 0; i < this.particles.length; i++) this.particles[i].update(dt);
      this.removeDead();
    }

    this.flash = Math.max(0, this.flash - dt * 2.5);
    this.updateHud();
  };

  Game.prototype.updateHud = function () {
    let apples = this.eaten + ' / ' + this.level.target;
    let progress = this.eaten / this.level.target;
    if (this.mode === 'endless') {
      // in Endless the bar fills up to the next stage
      apples = String(this.eaten);
      progress = (this.eaten % EndlessLevel.STAGE_EVERY) / EndlessLevel.STAGE_EVERY;
    }
    this.ui.hud({
      title: this.level.title(),
      name: this.level.subtitle(this),
      score: this.score,
      best: this.bestScore(),
      apples: apples,
      progress: progress,
      canPause: this.state === STATE.PLAYING || this.state === STATE.PAUSED,
      paused: this.state === STATE.PAUSED
    });
  };

  /* ---------- drawing ---------- */

  Game.prototype.render = function () {
    const ctx = this.ctx;
    const cell = this.cell;

    // How far through the current step we are (0..1), for smooth movement.
    let alpha = 1;
    let moverAlpha = 1;
    if (this.state === STATE.PLAYING || this.state === STATE.PAUSED) {
      alpha = Math.min(1, this.accumulator / this.interval);
      // moving walls take two steps per cell
      moverAlpha = ((this.steps % 2) + alpha) / 2;
    }

    // Draw in board units; the canvas scales them to real pixels.
    ctx.setTransform(this.scale, 0, 0, this.scale, 0, 0);

    this.renderFloor(ctx, cell);
    if (this.level.wrap) this.renderOpenEdges(ctx, cell);

    // Each object draws itself (they all have their own render method)
    for (let i = 0; i < this.walls.length; i++) this.walls[i].render(ctx, cell);
    this.renderPending(ctx, cell);
    for (let i = 0; i < this.portals.length; i++) this.portals[i].render(ctx, cell);
    for (let i = 0; i < this.movers.length; i++) this.movers[i].render(ctx, cell, moverAlpha);
    for (let i = 0; i < this.apples.length; i++) this.apples[i].render(ctx, cell);
    this.snake.render(ctx, cell, alpha);
    for (let i = 0; i < this.particles.length; i++) this.particles[i].render(ctx, cell);

    // Red flash after a crash
    if (this.flash > 0) {
      ctx.fillStyle = 'rgba(224, 72, 62, ' + this.flash * 0.35 + ')';
      ctx.fillRect(0, 0, this.width, this.height);
    }
  };

  // Floor: rounded grass tiles with thin gaps, in two alternating shades.
  Game.prototype.renderFloor = function (ctx, cell) {
    ctx.fillStyle = BOARD;
    ctx.fillRect(0, 0, this.width, this.height);
    const gap = 1.5;
    for (let y = 0; y < this.rows; y++) {
      for (let x = 0; x < this.cols; x++) {
        if ((x + y) % 2 === 0) ctx.fillStyle = TILE;
        else ctx.fillStyle = TILE_ALT;
        Utils.roundRect(ctx, x * cell + gap, y * cell + gap, cell - gap * 2, cell - gap * 2, 4);
        ctx.fill();
      }
    }
  };

  // A wall that is about to drop: a dark square with a flashing border.
  Game.prototype.renderPending = function (ctx, cell) {
    const flashOn = Math.floor(this.lastTime / 150) % 2 === 0;
    for (let i = 0; i < this.pending.length; i++) {
      const x = this.pending[i].pos.x * cell;
      const y = this.pending[i].pos.y * cell;
      ctx.fillStyle = 'rgba(14, 36, 16, 0.45)';
      ctx.fillRect(x + 1, y + 1, cell - 2, cell - 2);
      ctx.fillStyle = Wall.prototype.colour;
      ctx.fillRect(x + 6, y + 6, cell - 12, cell - 12);
      if (flashOn) ctx.strokeStyle = '#ffd34d';
      else ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2.5;
      ctx.strokeRect(x + 2.5, y + 2.5, cell - 5, cell - 5);
    }
  };

  // Open edges: a light strip along every edge cell that isn't a wall,
  // so you can see exactly where you can pass through to the other side.
  Game.prototype.renderOpenEdges = function (ctx, cell) {
    const last = this.cols - 1;
    const strip = cell * 0.2;
    ctx.fillStyle = EDGE;
    for (let i = 0; i <= last; i++) {
      if (!this.wallAt(new Vec(i, 0))) ctx.fillRect(i * cell, 0, cell, strip);                         // top
      if (!this.wallAt(new Vec(i, last))) ctx.fillRect(i * cell, this.height - strip, cell, strip);    // bottom
      if (!this.wallAt(new Vec(0, i))) ctx.fillRect(0, i * cell, strip, cell);                         // left
      if (!this.wallAt(new Vec(last, i))) ctx.fillRect(this.width - strip, i * cell, strip, cell);     // right
    }
  };

  global.Game = Game;
})(window);
