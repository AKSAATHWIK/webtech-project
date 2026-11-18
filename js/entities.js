// Everything that appears on the board.
// Each type is a constructor function; shared methods live on its prototype.
//
//   Entity
//     Snake
//     Apple    -> GoldenApple
//     Wall     -> MovingWall
//     Portal
//     Particle -> ScorePopup
//   Skin -> StripedSkin, RainbowSkin   (snake colours, not drawn on their own)
(function (global) {
  'use strict';

  const extend = Utils.extend;
  const lerp = Utils.lerp;
  const FULL_CIRCLE = Math.PI * 2;
  const OUTLINE = 'rgba(14, 36, 16, 0.6)'; // dark edge that keeps things visible on the grass

  // Draws a filled circle.
  function circle(ctx, x, y, r, colour) {
    ctx.fillStyle = colour;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, FULL_CIRCLE);
    ctx.fill();
  }

  /* ---------- Entity: the base for everything ---------- */

  function Entity(x, y) {
    this.pos = new Vec(x, y);
    this.alive = true;
    this.age = 0; // seconds since it was created
  }

  Entity.prototype.update = function (dt) {
    this.age += dt;
  };

  Entity.prototype.render = function () {};

  Entity.prototype.kill = function () {
    this.alive = false;
  };

  // Pixel centre of the entity's grid cell.
  Entity.prototype.centre = function (cell) {
    return { x: (this.pos.x + 0.5) * cell, y: (this.pos.y + 0.5) * cell };
  };

  /* ---------- Snake ---------- */

  function Snake(x, y, dir, length) {
    Entity.call(this, x, y);
    this.dir = dir;
    this.queue = [];   // turns pressed but not used yet
    this.growth = 0;   // how many more cells to grow
    this.body = [];    // body[0] is the head
    for (let i = 0; i < length; i++) {
      this.body.push(new Vec(x - dir.x * i, y - dir.y * i));
    }
    this.prev = this.body.slice(); // where each part was one step ago
  }
  extend(Snake, Entity);

  Snake.MAX_QUEUE = 2;

  Snake.prototype.head = function () {
    return this.body[0];
  };

  // The direction the snake will be facing after its queued turns.
  Snake.prototype.nextDir = function () {
    if (this.queue.length > 0) return this.queue[this.queue.length - 1];
    return this.dir;
  };

  // Saves a turn for the next step. Reversing straight back is not allowed.
  Snake.prototype.queueTurn = function (dir) {
    const last = this.nextDir();
    if (this.queue.length >= Snake.MAX_QUEUE) return false;
    if (dir.equals(last) || dir.isOpposite(last)) return false;
    this.queue.push(dir);
    return true;
  };

  Snake.prototype.applyTurn = function () {
    if (this.queue.length > 0) this.dir = this.queue.shift();
  };

  // Is any part of the body on cell p?
  Snake.prototype.occupies = function (p) {
    for (let i = 0; i < this.body.length; i++) {
      if (this.body[i].equals(p)) return true;
    }
    return false;
  };

  // Would moving into p hit the body? The tail moves away this step,
  // so it is skipped, unless the snake is growing.
  Snake.prototype.hitsSelf = function (p) {
    let count = this.body.length;
    if (this.growth === 0) count = count - 1;
    for (let i = 0; i < count; i++) {
      if (this.body[i].equals(p)) return true;
    }
    return false;
  };

  Snake.prototype.move = function (next) {
    this.prev = this.body.slice();
    this.body.unshift(next); // new head at the front
    this.pos = next;
    if (this.growth > 0) this.growth--;
    else this.body.pop();    // remove the tail
  };

  Snake.prototype.grow = function (n) {
    this.growth += n;
  };

  Snake.prototype.die = function () {
    this.kill();
    this.prev = this.body.slice(); // stop the sliding animation
  };

  // The skin decides the colours; grey once dead. t goes 0 (head) to 1 (tail), i is the segment.
  Snake.prototype.colour = function (t, i) {
    if (!this.alive) return 'hsl(220, 8%, ' + (62 - t * 20) + '%)';
    return this.skin.colour(t, i);
  };

  // Where segment i is drawn, in pixels. alpha (0..1) is how far through the
  // current step we are, so the snake slides smoothly between cells.
  Snake.prototype.segmentPoint = function (i, cell, alpha) {
    const now = this.body[i];
    let before = this.prev[i];
    // a new segment, or one that went through a portal or an open edge, doesn't slide
    if (!before || before.distance(now) > 1) before = now;
    return {
      x: (lerp(before.x, now.x, alpha) + 0.5) * cell,
      y: (lerp(before.y, now.y, alpha) + 0.5) * cell
    };
  };

  // Draws the body as thick round lines from the tail up to the head.
  Snake.prototype.drawBody = function (ctx, cell, alpha, outline) {
    const last = this.body.length - 1;
    for (let i = last; i > 0; i--) {
      const a = this.segmentPoint(i, cell, alpha);
      const b = this.segmentPoint(i - 1, cell, alpha);
      const t = i / last;                    // 0 at the head, 1 at the tail
      const width = cell * (0.76 - t * 0.24); // thinner towards the tail

      if (outline) {
        ctx.strokeStyle = OUTLINE;
        ctx.lineWidth = width + cell * 0.14;
      } else {
        ctx.strokeStyle = this.colour(t, i);
        ctx.lineWidth = width;
      }

      // if the two parts are far apart (portal or open edge), just draw a dot,
      // not a line across the whole board
      const gap = Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      if (gap < cell * 1.5) ctx.lineTo(b.x, b.y);
      else ctx.lineTo(a.x, a.y);
      ctx.stroke();
    }
  };

  Snake.prototype.render = function (ctx, cell, alpha) {
    ctx.lineCap = 'round';
    // a dark outline first (slightly wider), then the real colours on top
    this.drawBody(ctx, cell, alpha, true);
    this.drawBody(ctx, cell, alpha, false);

    // Head
    const h = this.segmentPoint(0, cell, alpha);
    const r = cell * 0.44;
    circle(ctx, h.x, h.y, r + cell * 0.07, OUTLINE);
    circle(ctx, h.x, h.y, r, this.colour(0, 0));

    // Eyes: a little forward from the centre, one on each side.
    // (-d.y, d.x) is the direction turned 90 degrees, which points to the side.
    const d = this.dir;
    const forward = r * 0.28;
    const side = r * 0.46;
    this.drawEye(ctx, h.x + d.x * forward - d.y * side, h.y + d.y * forward + d.x * side, r);
    this.drawEye(ctx, h.x + d.x * forward + d.y * side, h.y + d.y * forward - d.x * side, r);
  };

  Snake.prototype.drawEye = function (ctx, x, y, r) {
    circle(ctx, x, y, r * 0.3, '#fff');
    if (this.alive) {
      // the pupil looks the way the snake is going
      circle(ctx, x + this.dir.x * r * 0.12, y + this.dir.y * r * 0.12, r * 0.15, '#13201a');
    }
  };

  /* ---------- Apple ---------- */

  function Apple(x, y) {
    Entity.call(this, x, y);
  }
  extend(Apple, Entity);

  // These are on the prototype, so every apple shares them. GoldenApple overrides them.
  Apple.prototype.points = 10;
  Apple.prototype.growBy = 1;
  Apple.prototype.colour = '#e8443a';
  Apple.prototype.light = '#ff8a76';
  Apple.prototype.dark = '#a8231c';
  Apple.prototype.countsToGoal = true;

  Apple.prototype.render = function (ctx, cell) {
    const c = this.centre(cell);
    // grows in quickly when it appears, then bobs gently up and down
    const r = cell * 0.4 * Math.min(1, this.age * 6);
    const y = c.y + Math.sin(this.age * 4) * cell * 0.03;
    if (r <= 0) return;

    // dark outline, round body, darker bottom half, small shine
    circle(ctx, c.x, y, r + cell * 0.07, OUTLINE);
    circle(ctx, c.x, y, r, this.colour);
    ctx.fillStyle = this.dark;
    ctx.beginPath();
    ctx.arc(c.x, y, r, 0.15 * Math.PI, 0.85 * Math.PI);
    ctx.fill();
    circle(ctx, c.x - r * 0.38, y - r * 0.35, r * 0.17, this.light);

    // stem
    ctx.strokeStyle = '#6b4226';
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(c.x, y - r * 0.75);
    ctx.lineTo(c.x + r * 0.1, y - r * 1.15);
    ctx.stroke();

    // leaf
    circle(ctx, c.x + r * 0.4, y - r * 1.0, r * 0.22, '#2e6b2a');
  };

  // Called by the game when the snake reaches this apple.
  Apple.prototype.eat = function (game) {
    game.gain(game.level.pointsFor(game, this), this.pos);
    game.snake.grow(this.growBy);
    game.burst(this.pos, this.colour, 12);
    this.kill();
  };

  /* ---------- GoldenApple: worth more, but disappears ---------- */

  function GoldenApple(x, y) {
    Apple.call(this, x, y);
    this.lifetime = 6; // seconds
  }
  extend(GoldenApple, Apple);

  GoldenApple.prototype.points = 50;
  GoldenApple.prototype.growBy = 2;
  GoldenApple.prototype.colour = '#f5b82e';
  GoldenApple.prototype.light = '#fff1b0';
  GoldenApple.prototype.dark = '#b9790a';
  GoldenApple.prototype.countsToGoal = false;

  GoldenApple.prototype.update = function (dt) {
    Apple.prototype.update.call(this, dt); // run the parent version first
    if (this.age >= this.lifetime) this.kill();
  };

  GoldenApple.prototype.render = function (ctx, cell) {
    const c = this.centre(cell);
    const timeLeft = this.lifetime - this.age;

    // a ring around it that gets shorter as time runs out
    const start = -Math.PI / 2; // the top of the circle
    const end = start + FULL_CIRCLE * (timeLeft / this.lifetime);
    ctx.lineCap = 'round';
    ctx.strokeStyle = OUTLINE;
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.arc(c.x, c.y, cell * 0.6, start, end);
    ctx.stroke();
    ctx.strokeStyle = '#ffd34d';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(c.x, c.y, cell * 0.6, start, end);
    ctx.stroke();

    // blink in the last 1.5 seconds: skip drawing on every other short moment
    if (timeLeft < 1.5 && Math.floor(this.age * 8) % 2 === 0) return;

    Apple.prototype.render.call(this, ctx, cell); // draw the apple itself
  };

  /* ---------- Wall ---------- */

  function Wall(x, y) {
    Entity.call(this, x, y);
  }
  extend(Wall, Entity);

  // Light stone blocks so they stand out clearly from the grass.
  Wall.prototype.colour = '#cbbfa9';
  Wall.prototype.light = '#e6dccb';
  Wall.prototype.shade = '#9c8f78';

  Wall.prototype.render = function (ctx, cell) {
    const x = this.pos.x * cell;
    const y = this.pos.y * cell;
    const edge = cell * 0.14;
    ctx.fillStyle = this.colour;
    ctx.fillRect(x, y, cell, cell);
    ctx.fillStyle = this.light; // lighter top edge
    ctx.fillRect(x, y, cell, edge);
    ctx.fillStyle = this.shade; // darker bottom edge
    ctx.fillRect(x, y + cell - edge, cell, edge);
  };

  /* ---------- MovingWall: slides back and forth ---------- */

  function MovingWall(x, y, axis) {
    Wall.call(this, x, y);
    if (axis === 'v') this.dir = Dir.DOWN;
    else this.dir = Dir.RIGHT;
    this.prev = this.pos;
  }
  extend(MovingWall, Wall);

  MovingWall.prototype.colour = '#f08a24';

  // Moves one cell. If the way is blocked it turns around.
  // The game decides what counts as blocked (game.moverBlocked).
  MovingWall.prototype.step = function (game) {
    this.prev = this.pos;
    let next = this.pos.add(this.dir);
    if (game.moverBlocked(next, this)) {
      this.dir = new Vec(-this.dir.x, -this.dir.y); // turn around
      next = this.pos.add(this.dir);
      if (game.moverBlocked(next, this)) return;  // stuck on both sides, stay put
    }
    this.pos = next;
  };

  MovingWall.prototype.render = function (ctx, cell, alpha) {
    // slide smoothly from the old cell to the new one
    const x = lerp(this.prev.x, this.pos.x, alpha) * cell;
    const y = lerp(this.prev.y, this.pos.y, alpha) * cell;
    const pad = cell * 0.06;
    Utils.roundRect(ctx, x + pad, y + pad, cell - pad * 2, cell - pad * 2, cell * 0.22);
    ctx.fillStyle = this.colour;
    ctx.fill();
    ctx.strokeStyle = OUTLINE;
    ctx.lineWidth = 2;
    ctx.stroke();

    // a bar showing which way it slides
    ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
    if (this.dir.x !== 0) ctx.fillRect(x + cell * 0.22, y + cell * 0.44, cell * 0.56, cell * 0.12);
    else ctx.fillRect(x + cell * 0.44, y + cell * 0.22, cell * 0.12, cell * 0.56);
  };

  /* ---------- Portal: walk into one, come out of its partner ---------- */

  function Portal(x, y, id) {
    Entity.call(this, x, y);
    this.id = id;
    this.partner = null; // the other portal with the same id, set by Level.build()
  }
  extend(Portal, Entity);

  Portal.COLOURS = ['#3d9be0', '#a874d6', '#2fb79a', '#e0668a'];

  // A small swirl: white rim, coloured ring, dark hole and three turning arms.
  Portal.prototype.render = function (ctx, cell) {
    const c = this.centre(cell);
    const colour = Portal.COLOURS[this.id - 1];

    circle(ctx, c.x, c.y, cell * 0.52, OUTLINE);
    circle(ctx, c.x, c.y, cell * 0.47, '#ffffff');
    circle(ctx, c.x, c.y, cell * 0.41, colour);
    circle(ctx, c.x, c.y, cell * 0.28, '#0b1a17');

    // three short arcs, spaced a third of a circle apart, turning with age
    ctx.strokeStyle = colour;
    ctx.lineWidth = cell * 0.07;
    ctx.lineCap = 'round';
    for (let k = 0; k < 3; k++) {
      const angle = this.age * 3 + k * (FULL_CIRCLE / 3);
      ctx.beginPath();
      ctx.arc(c.x, c.y, cell * 0.2, angle, angle + 1.4);
      ctx.stroke();
    }
    circle(ctx, c.x, c.y, cell * 0.06, '#fff');
  };

  /* ---------- Skins: how the snake is coloured ---------- */
  //   Skin -> StripedSkin
  //   Skin -> RainbowSkin

  function Skin(name, hue, sat) {
    this.name = name;
    this.hue = hue; // colour on the colour wheel, 0 to 360
    this.sat = sat; // how strong the colour is, 0 to 100
  }

  // Lighter at the head (t = 0), darker towards the tail (t = 1).
  Skin.prototype.colour = function (t, i) {
    const light = 62 - t * 22;
    return 'hsl(' + this.hue + ', ' + this.sat + '%, ' + light + '%)';
  };

  // The colour of this skin's button in the skin picker.
  Skin.prototype.swatch = function () {
    return this.colour(0.3, 0);
  };

  function StripedSkin(name, hue, sat, stripe) {
    Skin.call(this, name, hue, sat);
    this.stripe = stripe;
  }
  extend(StripedSkin, Skin);

  // Every third segment is a stripe; the rest use the normal Skin colour.
  StripedSkin.prototype.colour = function (t, i) {
    if (i % 3 === 2) return this.stripe;
    return Skin.prototype.colour.call(this, t, i);
  };

  StripedSkin.prototype.swatch = function () {
    const main = Skin.prototype.colour.call(this, 0.2, 0);
    return 'repeating-linear-gradient(90deg, ' + main + ' 0 12px, ' + this.stripe + ' 12px 18px)';
  };

  function RainbowSkin(name) {
    Skin.call(this, name, 0, 80);
  }
  extend(RainbowSkin, Skin);

  // Each segment moves 28 degrees further round the colour wheel.
  RainbowSkin.prototype.colour = function (t, i) {
    const hue = (i * 28) % 360;
    return 'hsl(' + hue + ', 80%, 60%)';
  };

  RainbowSkin.prototype.swatch = function () {
    return 'linear-gradient(90deg, red, orange, yellow, lime, deepskyblue, violet)';
  };

  Skin.LIST = [
    new Skin('Ocean', 205, 80), // default: blue stands out on the grass
    new Skin('Lime', 72, 80),
    new Skin('Grape', 272, 60),
    new Skin('Ember', 12, 78),
    new Skin('Sunny', 46, 88),
    new StripedSkin('Candy', 340, 78, '#fff1f5'),
    new StripedSkin('Tiger', 28, 92, '#8a3d0c'),
    new RainbowSkin('Rainbow')
  ];

  // Every snake uses the first skin unless the game gives it another one.
  Snake.prototype.skin = Skin.LIST[0];

  /* ---------- Particle: a small dot for effects (pixel position, not grid) ---------- */

  function Particle(x, y, colour) {
    Entity.call(this, x, y);
    // fly off in a random direction at a random speed
    const angle = Math.random() * FULL_CIRCLE;
    const speed = 50 + Math.random() * 90;
    this.vx = Math.cos(angle) * speed;
    this.vy = Math.sin(angle) * speed;
    this.maxLife = 0.4 + Math.random() * 0.4; // seconds
    this.life = this.maxLife;
    this.colour = colour;
  }
  extend(Particle, Entity);

  Particle.prototype.update = function (dt) {
    Entity.prototype.update.call(this, dt);
    this.pos.x += this.vx * dt;
    this.pos.y += this.vy * dt;
    this.life -= dt;
    if (this.life <= 0) this.kill();
  };

  Particle.prototype.render = function (ctx) {
    const fade = this.life / this.maxLife; // 1 when new, 0 when gone
    ctx.globalAlpha = fade;
    circle(ctx, this.pos.x, this.pos.y, 1 + 2 * fade, this.colour);
    ctx.globalAlpha = 1;
  };

  /* ---------- ScorePopup: the "+10" that floats up ---------- */

  function ScorePopup(x, y, text) {
    Particle.call(this, x, y, '#fff');
    this.text = text;
    this.vx = 0;
    this.vy = -55; // straight up
    this.maxLife = 0.8;
    this.life = this.maxLife;
  }
  extend(ScorePopup, Particle);

  ScorePopup.prototype.render = function (ctx, cell) {
    ctx.globalAlpha = this.life / this.maxLife;
    ctx.font = '600 ' + Math.round(cell * 0.55) + 'px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.strokeStyle = OUTLINE; // dark edge so the white text reads on the grass
    ctx.lineWidth = 3;
    ctx.strokeText(this.text, this.pos.x, this.pos.y);
    ctx.fillStyle = this.colour;
    ctx.fillText(this.text, this.pos.x, this.pos.y);
    ctx.globalAlpha = 1;
  };

  // Share the constructors with the other files.
  global.Entity = Entity;
  global.Snake = Snake;
  global.Apple = Apple;
  global.GoldenApple = GoldenApple;
  global.Wall = Wall;
  global.MovingWall = MovingWall;
  global.Portal = Portal;
  global.Particle = Particle;
  global.ScorePopup = ScorePopup;
  global.Skin = Skin;
  global.StripedSkin = StripedSkin;
  global.RainbowSkin = RainbowSkin;
})(window);
