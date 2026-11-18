// Everything that appears on the board.
// Each type is a constructor function; shared methods live on its prototype.
//
//   Entity
//     Snake
//     Apple    -> GoldenApple
//     Wall     -> MovingWall
//     Portal
//     Particle -> ScorePopup
(function (global) {
  'use strict';

  const { extend, lerp, roundRect } = Utils;
  const TAU = Math.PI * 2;

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

  // Green and lighter at the head, grey once dead. t goes 0 (head) to 1 (tail).
  Snake.prototype.colour = function (t) {
    const light = 60 - t * 20;
    return this.alive ? 'hsl(124, 42%, ' + light + '%)' : 'hsl(210, 7%, ' + light + '%)';
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

    // Body: thick round lines from the tail up to the head
    ctx.lineCap = 'round';
    for (let i = points.length - 1; i > 0; i--) {
      const a = points[i];
      const b = points[i - 1];
      const t = i / (points.length - 1);
      ctx.strokeStyle = this.colour(t);
      ctx.lineWidth = cell * (0.74 - t * 0.24);
      // don't draw a line across the board when the body is split by a portal
      const end = Math.abs(a.x - b.x) + Math.abs(a.y - b.y) < cell * 1.5 ? b : a;
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(end.x, end.y);
      ctx.stroke();
    }

    // Head
    const h = points[0];
    const d = this.dir;
    const r = cell * 0.42;
    circle(ctx, h.x, h.y, r, this.colour(0));

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
  Apple.prototype.colour = '#e0483e';
  Apple.prototype.countsToGoal = true;

  Apple.prototype.render = function (ctx, cell) {
    const c = this.centre(cell);
    const r = cell * 0.33 * Math.min(1, this.age * 6); // quick "pop in" when it appears

    circle(ctx, c.x, c.y, r, this.colour);

    // leaf
    ctx.fillStyle = '#74b85f';
    ctx.beginPath();
    ctx.ellipse(c.x + r * 0.4, c.y - r * 1.05, r * 0.36, r * 0.15, -0.5, 0, TAU);
    ctx.fill();
  };

  // Called by the game when the snake reaches this apple.
  Apple.prototype.eat = function (game) {
    game.gain(this.points, this.pos);
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
  GoldenApple.prototype.colour = '#f0b429';
  GoldenApple.prototype.countsToGoal = false;

  GoldenApple.prototype.update = function (dt) {
    Apple.prototype.update.call(this, dt); // run the parent version first
    if (this.age >= this.lifetime) this.kill();
  };

  GoldenApple.prototype.render = function (ctx, cell) {
    const c = this.centre(cell);
    const timeLeft = this.lifetime - this.age;

    // ring that shrinks as time runs out
    ctx.strokeStyle = 'rgba(240, 180, 41, 0.55)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(c.x, c.y, cell * 0.55, -Math.PI / 2, -Math.PI / 2 + TAU * (timeLeft / this.lifetime));
    ctx.stroke();

    // blink in the last 1.5 seconds
    const blinkOff = timeLeft < 1.5 && Math.floor(this.age * 8) % 2 === 0;
    if (!blinkOff) Apple.prototype.render.call(this, ctx, cell);
  };

  /* ---------- Wall ---------- */

  function Wall(x, y) {
    Entity.call(this, x, y);
  }
  extend(Wall, Entity);

  Wall.prototype.colour = '#4c5661';

  Wall.prototype.render = function (ctx, cell) {
    ctx.fillStyle = this.colour;
    // +0.5 so neighbouring walls overlap slightly and join without gaps
    ctx.fillRect(this.pos.x * cell, this.pos.y * cell, cell + 0.5, cell + 0.5);
  };

  /* ---------- MovingWall: slides back and forth ---------- */

  function MovingWall(x, y, axis) {
    Wall.call(this, x, y);
    this.dir = axis === 'v' ? Dir.DOWN : Dir.RIGHT;
    this.prev = this.pos;
  }
  extend(MovingWall, Wall);

  MovingWall.prototype.colour = '#d9822b';

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
    ctx.fillStyle = this.colour;
    roundRect(ctx, x + pad, y + pad, cell - pad * 2, cell - pad * 2, cell * 0.22);
    ctx.fill();
  };

  /* ---------- Portal: walk into one, come out of its partner ---------- */

  function Portal(x, y, id) {
    Entity.call(this, x, y);
    this.id = id;
    this.partner = null; // set by Level.build()
  }
  extend(Portal, Entity);

  Portal.COLOURS = ['#4aa3df', '#b07cd8', '#3fbfa0', '#e8708f'];

  Portal.prototype.render = function (ctx, cell) {
    const c = this.centre(cell);
    const colour = Portal.COLOURS[this.id - 1];
    const spin = this.age * 2;

    ctx.strokeStyle = colour;
    ctx.lineWidth = cell * 0.1;
    ctx.beginPath();
    ctx.arc(c.x, c.y, cell * 0.4, spin, spin + Math.PI * 1.4);
    ctx.stroke();

    ctx.globalAlpha = 0.3;
    circle(ctx, c.x, c.y, cell * 0.25, colour);
    ctx.globalAlpha = 1;
  };

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
    ctx.fillStyle = this.colour;
    ctx.fillText(this.text, this.pos.x, this.pos.y);
    ctx.globalAlpha = 1;
  };

  Object.assign(global, {
    Entity, Snake, Apple, GoldenApple, Wall, MovingWall, Portal, Particle, ScorePopup
  });
})(window);
