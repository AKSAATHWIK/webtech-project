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

  const { extend, lerp, roundRect } = Utils;
  const TAU = Math.PI * 2;
  const OUTLINE = 'rgba(14, 36, 16, 0.6)'; // dark edge that keeps things visible on the grass

  // Draws a filled circle.
  function circle(ctx, x, y, r, colour) {
    ctx.fillStyle = colour;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, TAU);
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
    this.body = [];
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
    return this.queue.length ? this.queue[this.queue.length - 1] : this.dir;
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
    if (this.queue.length) this.dir = this.queue.shift();
  };

  Snake.prototype.occupies = function (p) {
    return this.body.some((part) => part.equals(p));
  };

  // Would moving into p hit the body? The tail moves away unless we are growing.
  Snake.prototype.hitsSelf = function (p) {
    const parts = this.growth > 0 ? this.body : this.body.slice(0, -1);
    return parts.some((part) => part.equals(p));
  };

  Snake.prototype.move = function (next) {
    this.prev = this.body.slice();
    this.body.unshift(next);
    this.pos = next;
    if (this.growth > 0) this.growth--;
    else this.body.pop();
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

  // alpha (0..1) is how far we are through the current step, so the snake slides smoothly.
  Snake.prototype.render = function (ctx, cell, alpha) {
    const points = this.body.map((cur, i) => {
      let from = this.prev[i] || cur;
      if (from.distance(cur) > 1) from = cur; // went through a portal or an open edge
      return {
        x: (lerp(from.x, cur.x, alpha) + 0.5) * cell,
        y: (lerp(from.y, cur.y, alpha) + 0.5) * cell
      };
    });

    // Body: thick round lines from the tail up to the head.
    // The first pass is a dark outline (slightly wider), so every skin stands
    // out on the green floor. The second pass is the real colours.
    ctx.lineCap = 'round';
    const edge = cell * 0.14;
    for (const pass of ['outline', 'body']) {
      for (let i = points.length - 1; i > 0; i--) {
        const a = points[i];
        const b = points[i - 1];
        const t = i / (points.length - 1);
        const width = cell * (0.76 - t * 0.24);
        ctx.strokeStyle = pass === 'outline' ? OUTLINE : this.colour(t, i);
        ctx.lineWidth = pass === 'outline' ? width + edge : width;
        // don't draw a line across the board when the body is split by a portal
        const end = Math.abs(a.x - b.x) + Math.abs(a.y - b.y) < cell * 1.5 ? b : a;
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(end.x, end.y);
        ctx.stroke();
      }
    }

    // Head
    const h = points[0];
    const d = this.dir;
    const r = cell * 0.44;
    circle(ctx, h.x, h.y, r + edge / 2, OUTLINE);
    circle(ctx, h.x, h.y, r, this.colour(0, 0));

    // Eyes, one on each side of the head
    for (const side of [-1, 1]) {
      const ex = h.x + d.x * r * 0.28 - d.y * r * 0.46 * side;
      const ey = h.y + d.y * r * 0.28 + d.x * r * 0.46 * side;
      circle(ctx, ex, ey, r * 0.3, '#fff');
      if (this.alive) circle(ctx, ex + d.x * r * 0.12, ey + d.y * r * 0.12, r * 0.15, '#13201a');
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
    // quick "pop in" when it appears, then a gentle bob
    const r = cell * 0.4 * Math.min(1, this.age * 6);
    const y = c.y + Math.sin(this.age * 4) * cell * 0.03;
    if (r <= 0) return;

    // dark outline, then a flat body with a darker lower half and a small shine
    circle(ctx, c.x, y, r + cell * 0.07, OUTLINE);
    circle(ctx, c.x, y, r, this.colour);
    ctx.fillStyle = this.dark;
    ctx.beginPath();
    ctx.arc(c.x, y, r, 0.15 * Math.PI, 0.85 * Math.PI);
    ctx.fill();
    circle(ctx, c.x - r * 0.38, y - r * 0.35, r * 0.17, this.light);

    // stem and leaf
    ctx.strokeStyle = '#6b4226';
    ctx.lineWidth = Math.max(1.5, r * 0.14);
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(c.x, y - r * 0.75);
    ctx.lineTo(c.x + r * 0.1, y - r * 1.15);
    ctx.stroke();
    // dark green leaf with an outline, so it shows on the grass
    ctx.beginPath();
    ctx.ellipse(c.x + r * 0.42, y - r * 1.02, r * 0.36, r * 0.17, -0.5, 0, TAU);
    ctx.fillStyle = '#2e6b2a';
    ctx.fill();
    ctx.strokeStyle = OUTLINE;
    ctx.lineWidth = 1;
    ctx.stroke();
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

    // ring that shrinks as time runs out
    // (a dark ring underneath so the gold one shows on the grass)
    const end = -Math.PI / 2 + TAU * (timeLeft / this.lifetime);
    ctx.lineCap = 'round';
    ctx.strokeStyle = OUTLINE;
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.arc(c.x, c.y, cell * 0.6, -Math.PI / 2, end);
    ctx.stroke();
    ctx.strokeStyle = '#ffd34d';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(c.x, c.y, cell * 0.6, -Math.PI / 2, end);
    ctx.stroke();

    // blink in the last 1.5 seconds
    const blinkOff = timeLeft < 1.5 && Math.floor(this.age * 8) % 2 === 0;
    if (blinkOff) return;
    Apple.prototype.render.call(this, ctx, cell);

    // a small twinkle that turns around the apple
    const a = this.age * 2.5;
    const sx = c.x + Math.cos(a) * cell * 0.42;
    const sy = c.y + Math.sin(a) * cell * 0.42;
    const s = cell * 0.12;
    ctx.fillStyle = '#fff8d6';
    ctx.beginPath();
    ctx.moveTo(sx, sy - s);
    ctx.lineTo(sx + s * 0.3, sy - s * 0.3);
    ctx.lineTo(sx + s, sy);
    ctx.lineTo(sx + s * 0.3, sy + s * 0.3);
    ctx.lineTo(sx, sy + s);
    ctx.lineTo(sx - s * 0.3, sy + s * 0.3);
    ctx.lineTo(sx - s, sy);
    ctx.lineTo(sx - s * 0.3, sy - s * 0.3);
    ctx.closePath();
    ctx.fill();
  };

  /* ---------- Wall ---------- */

  function Wall(x, y) {
    Entity.call(this, x, y);
  }
  extend(Wall, Entity);

  // Light stone blocks so they stand out clearly from the dark floor.
  Wall.prototype.colour = '#cbbfa9';
  Wall.prototype.light = '#e6dccb';
  Wall.prototype.shade = '#9c8f78';

  Wall.prototype.render = function (ctx, cell) {
    const x = this.pos.x * cell;
    const y = this.pos.y * cell;
    const edge = Math.max(2, cell * 0.14);
    ctx.fillStyle = this.colour;
    ctx.fillRect(x, y, cell, cell);
    ctx.fillStyle = this.light; // lit top edge
    ctx.fillRect(x, y, cell, edge);
    ctx.fillStyle = this.shade; // shadow on the bottom edge
    ctx.fillRect(x, y + cell - edge, cell, edge);
  };

  /* ---------- MovingWall: slides back and forth ---------- */

  function MovingWall(x, y, axis) {
    Wall.call(this, x, y);
    this.dir = axis === 'v' ? Dir.DOWN : Dir.RIGHT;
    this.prev = this.pos;
  }
  extend(MovingWall, Wall);

  MovingWall.prototype.colour = '#f08a24';

  // Moves one cell. If the way is blocked it turns around.
  MovingWall.prototype.step = function (isBlocked) {
    this.prev = this.pos;
    let next = this.pos.add(this.dir);
    if (isBlocked(next, this)) {
      this.dir = new Vec(-this.dir.x, -this.dir.y);
      next = this.pos.add(this.dir);
      if (isBlocked(next, this)) return; // stuck on both sides, stay put
    }
    this.pos = next;
  };

  MovingWall.prototype.render = function (ctx, cell, alpha) {
    const x = lerp(this.prev.x, this.pos.x, alpha) * cell;
    const y = lerp(this.prev.y, this.pos.y, alpha) * cell;
    const pad = cell * 0.06;
    roundRect(ctx, x + pad, y + pad, cell - pad * 2, cell - pad * 2, cell * 0.22);
    ctx.fillStyle = this.colour;
    ctx.fill();
    ctx.strokeStyle = OUTLINE;
    ctx.lineWidth = 2;
    ctx.stroke();
    // an arrow-ish bar showing which way it slides
    ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
    if (this.dir.x !== 0) ctx.fillRect(x + cell * 0.22, y + cell * 0.44, cell * 0.56, cell * 0.12);
    else ctx.fillRect(x + cell * 0.44, y + cell * 0.22, cell * 0.12, cell * 0.56);
  };

  /* ---------- Portal: walk into one, come out of its partner ---------- */

  function Portal(x, y, id) {
    Entity.call(this, x, y);
    this.id = id;
    this.partner = null; // set by Level.build()
  }
  extend(Portal, Entity);

  Portal.COLOURS = ['#3d9be0', '#a874d6', '#2fb79a', '#e0668a'];

  // A small swirl: coloured ring, dark hole, turning arms inside.
  Portal.prototype.render = function (ctx, cell) {
    const c = this.centre(cell);
    const colour = Portal.COLOURS[this.id - 1];
    const spin = this.age * 3;

    circle(ctx, c.x, c.y, cell * 0.52, OUTLINE);
    circle(ctx, c.x, c.y, cell * 0.47, '#ffffff'); // white rim so it pops off the grass
    circle(ctx, c.x, c.y, cell * 0.41, colour);
    circle(ctx, c.x, c.y, cell * 0.28, '#0b1a17');

    ctx.strokeStyle = colour;
    ctx.lineWidth = cell * 0.07;
    ctx.lineCap = 'round';
    for (let k = 0; k < 3; k++) {
      const a = spin + k * TAU / 3;
      ctx.beginPath();
      ctx.arc(c.x, c.y, cell * 0.2, a, a + 1.4);
      ctx.stroke();
    }
    circle(ctx, c.x, c.y, cell * 0.06, '#fff');
  };

  /* ---------- Skins: how the snake is coloured ---------- */
  //   Skin -> StripedSkin
  //   Skin -> RainbowSkin

  function Skin(name, hue, sat) {
    this.name = name;
    this.hue = hue;
    this.sat = sat;
  }

  // Lighter at the head, darker towards the tail.
  Skin.prototype.colour = function (t) {
    return 'hsl(' + this.hue + ', ' + this.sat + '%, ' + (62 - t * 22) + '%)';
  };

  // CSS background for the button in the skin picker.
  Skin.prototype.swatch = function () {
    return this.colour(0.3);
  };

  function StripedSkin(name, hue, sat, stripe) {
    Skin.call(this, name, hue, sat);
    this.stripe = stripe;
  }
  extend(StripedSkin, Skin);

  // Every third segment is a stripe; the rest use the normal Skin colour.
  StripedSkin.prototype.colour = function (t, i) {
    return i % 3 === 2 ? this.stripe : Skin.prototype.colour.call(this, t);
  };

  StripedSkin.prototype.swatch = function () {
    const a = Skin.prototype.colour.call(this, 0.2);
    return 'repeating-linear-gradient(90deg, ' + a + ' 0 12px, ' + this.stripe + ' 12px 18px)';
  };

  function RainbowSkin(name) {
    Skin.call(this, name, 0, 80);
  }
  extend(RainbowSkin, Skin);

  RainbowSkin.prototype.colour = function (t, i) {
    return 'hsl(' + ((i || 0) * 28 % 360) + ', 80%, 60%)';
  };

  RainbowSkin.prototype.swatch = function () {
    // hard colour bands, one per segment colour
    const bands = [0, 1, 2, 3, 4, 5].map((i) =>
      this.colour(0, i * 2) + ' ' + (i * 16.66) + '% ' + ((i + 1) * 16.66) + '%');
    return 'linear-gradient(90deg, ' + bands.join(', ') + ')';
  };

  Skin.LIST = [
    new Skin('Ocean', 205, 80),   // default: blue stands out on the grass
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
    const angle = Math.random() * TAU;
    const speed = 50 + Math.random() * 90;
    this.vx = Math.cos(angle) * speed;
    this.vy = Math.sin(angle) * speed;
    this.life = this.maxLife = 0.4 + Math.random() * 0.4;
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
    const fade = this.life / this.maxLife;
    ctx.globalAlpha = fade;
    circle(ctx, this.pos.x, this.pos.y, 1 + 2 * fade, this.colour);
    ctx.globalAlpha = 1;
  };

  /* ---------- ScorePopup: the "+10" that floats up ---------- */

  function ScorePopup(x, y, text) {
    Particle.call(this, x, y, '#fff');
    this.text = text;
    this.vx = 0;
    this.vy = -55;
    this.life = this.maxLife = 0.8;
  }
  extend(ScorePopup, Particle);

  ScorePopup.prototype.render = function (ctx, cell) {
    ctx.globalAlpha = this.life / this.maxLife;
    ctx.font = '600 ' + Math.round(cell * 0.55) + 'px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = OUTLINE; // dark edge so white text reads on the grass
    ctx.lineWidth = 3;
    ctx.strokeText(this.text, this.pos.x, this.pos.y);
    ctx.fillStyle = this.colour;
    ctx.fillText(this.text, this.pos.x, this.pos.y);
    ctx.globalAlpha = 1;
  };

  Object.assign(global, {
    Entity, Snake, Apple, GoldenApple, Wall, MovingWall, Portal, Particle, ScorePopup,
    Skin, StripedSkin, RainbowSkin
  });
})(window);
