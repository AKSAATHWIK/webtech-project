// Everything that is drawn on the board.
// Each type is a constructor function; shared methods live on its prototype.
//
//   Entity
//     Card -> BonusCard   (matching it gives extra time)
//          -> PeekCard    (matching it shows every card for a moment)
//     Particle -> ScorePopup
(function (global) {
  'use strict';

  const extend = Utils.extend;
  const FULL_CIRCLE = Math.PI * 2;

  // Draws a filled circle.
  function circle(ctx, x, y, r, colour) {
    ctx.fillStyle = colour;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, FULL_CIRCLE);
    ctx.fill();
  }

  /* ---------- Pictures on the cards ---------- */
  // A picture is an object like { text: '🐶', badge: '#f3e6d6' }.
  // Letters from other languages also have a caption: { text: 'అ', caption: 'Telugu', badge: ... }.
  // The pictures for each level are listed in levels.js.

  // Fonts that have coloured emoji on Windows, Mac and Android.
  const EMOJI_FONT = '"Segoe UI Emoji", "Apple Color Emoji", "Noto Color Emoji", sans-serif';
  // Fonts that have letters of Indian and other world languages.
  const LETTER_FONT = '"Nirmala UI", "Segoe UI", "Noto Sans", sans-serif';

  function drawPicture(ctx, picture, x, y, size) {
    circle(ctx, x, y, size * 0.62, picture.badge); // soft coloured badge
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    if (picture.caption) {
      // a letter: drawn in dark text, with the language name above the badge
      ctx.fillStyle = '#1d2a20';
      ctx.font = '700 ' + Math.round(size * 0.7) + 'px ' + LETTER_FONT;
      ctx.fillText(picture.text, x, y + size * 0.04);
      ctx.fillStyle = '#4a6052';
      ctx.font = '600 ' + Math.round(size * 0.22) + 'px system-ui, sans-serif';
      ctx.fillText(picture.caption, x, y - size * 0.86);
    } else {
      // an emoji picture
      ctx.font = Math.round(size * 0.82) + 'px ' + EMOJI_FONT;
      ctx.fillText(picture.text, x, y + size * 0.05);
    }
    ctx.textBaseline = 'alphabetic';
  }

  /* ---------- Entity: the base for everything ---------- */

  function Entity(x, y) {
    this.x = x;
    this.y = y;
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

  /* ---------- Card ---------- */

  function Card(x, y, w, h, pairId, picture) {
    Entity.call(this, x, y); // x, y is the top-left corner
    this.w = w;
    this.h = h;
    this.pairId = pairId;  // two cards with the same pairId make a pair
    this.picture = picture; // what is drawn on the face, e.g. { text: '🐶', badge: '#f3e6d6' }
    this.faceUp = false;   // turned over by the player
    this.matched = false;  // found its pair
    this.peek = false;     // shown for a moment by a PeekCard or at the start
    this.flip = 0;         // the flip animation: 0 = face down, 1 = face up
  }
  extend(Card, Entity);

  // These are on the prototype, so every card shares them. The special cards override them.
  Card.prototype.points = 100;
  Card.prototype.label = '';           // small text on the face of special cards
  Card.prototype.edge = '#d9d2c3';     // border colour of the face

  // Should the face be showing right now?
  Card.prototype.showing = function () {
    return this.faceUp || this.matched || this.peek;
  };

  // Collision detection between a point (the mouse) and this card's rectangle.
  Card.prototype.contains = function (px, py) {
    return px >= this.x && px <= this.x + this.w &&
           py >= this.y && py <= this.y + this.h;
  };

  // Turns the card over smoothly, a little each frame.
  Card.prototype.update = function (dt) {
    Entity.prototype.update.call(this, dt);
    const speed = 6; // full flips per second
    if (this.showing()) this.flip = Math.min(1, this.flip + speed * dt);
    else this.flip = Math.max(0, this.flip - speed * dt);
  };

  // Called by the game when this card's pair is found.
  Card.prototype.onMatch = function (game) {
    game.gain(this.points * game.combo, this);
  };

  Card.prototype.render = function (ctx, highlighted) {
    // The flip: squash the card's width down to nothing and back out.
    // In the first half we see the back, in the second half the face.
    const squash = Math.abs(1 - 2 * this.flip); // 1 -> 0 -> 1
    const w = this.w * squash;
    const x = this.x + (this.w - w) / 2;        // keep it centred while it shrinks
    const r = this.w * 0.1;

    // matched cards fade a little once they have finished turning over
    if (this.matched && this.flip === 1) ctx.globalAlpha = 0.55;

    // shadow
    ctx.fillStyle = 'rgba(14, 36, 16, 0.35)';
    Utils.roundRect(ctx, x + 2, this.y + 4, w, this.h, r);
    ctx.fill();

    if (this.flip < 0.5) this.drawBack(ctx, x, w, r);
    else this.drawFace(ctx, x, w, r);

    ctx.globalAlpha = 1;

    // yellow outline around the card the keyboard or mouse is on
    if (highlighted) {
      ctx.strokeStyle = '#ffd34d';
      ctx.lineWidth = 4;
      Utils.roundRect(ctx, this.x - 4, this.y - 4, this.w + 8, this.h + 8, r + 4);
      ctx.stroke();
    }
  };

  // The back of the card: dark green with a cream frame, a dotted pattern and a "?" badge.
  Card.prototype.drawBack = function (ctx, x, w, r) {
    Utils.roundRect(ctx, x, this.y, w, this.h, r);
    ctx.fillStyle = '#245c35';
    ctx.fill();

    // Move to the middle of the card and squash with the flip, so we can
    // draw everything below at normal size around (0, 0).
    ctx.save();
    ctx.translate(x + w / 2, this.y + this.h / 2);
    ctx.scale(w / this.w, 1);
    const halfW = this.w / 2;
    const halfH = this.h / 2;

    // inner frame
    const inset = this.w * 0.08;
    ctx.strokeStyle = '#e9dfc4';
    ctx.lineWidth = 2;
    Utils.roundRect(ctx, -halfW + inset, -halfH + inset, this.w - inset * 2, this.h - inset * 2, r * 0.6);
    ctx.stroke();

    // a grid of small dots inside the frame
    const spacing = this.w / 6;
    for (let dy = -halfH + spacing; dy < halfH - spacing / 2; dy += spacing) {
      for (let dx = -halfW + spacing; dx < halfW - spacing / 2; dx += spacing) {
        circle(ctx, dx, dy, this.w * 0.02, 'rgba(233, 223, 196, 0.35)');
      }
    }

    // badge with a question mark in the middle
    const size = this.w * 0.22;
    circle(ctx, 0, 0, size, '#e9dfc4');
    ctx.fillStyle = '#245c35';
    ctx.font = '800 ' + Math.round(size * 1.3) + 'px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('?', 0, size * 0.08);
    ctx.textBaseline = 'alphabetic';
    ctx.restore();
  };

  // The face of the card: cream, with the pair's picture and (for special cards) a tag.
  Card.prototype.drawFace = function (ctx, x, w, r) {
    Utils.roundRect(ctx, x, this.y, w, this.h, r);
    ctx.fillStyle = '#fffaf0';
    ctx.fill();
    ctx.strokeStyle = this.edge;
    ctx.lineWidth = 3;
    ctx.stroke();

    // squash everything with the card so the flip looks right
    ctx.save();
    ctx.translate(x + w / 2, this.y + this.h / 2);
    ctx.scale(w / this.w, 1);
    let pictureY = 0;
    if (this.label !== '') pictureY = -this.h * 0.08; // make room for the tag
    drawPicture(ctx, this.picture, 0, pictureY, this.w * 0.55);

    // a coloured tag at the bottom of special cards
    if (this.label !== '') {
      const tagW = this.w * 0.62;
      const tagH = this.h * 0.15;
      const tagY = this.h / 2 - tagH - this.h * 0.06;
      Utils.roundRect(ctx, -tagW / 2, tagY, tagW, tagH, tagH / 2);
      ctx.fillStyle = this.edge;
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.font = '700 ' + Math.round(tagH * 0.62) + 'px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(this.label, 0, tagY + tagH / 2 + 1);
      ctx.textBaseline = 'alphabetic';
    }
    ctx.restore();
  };

  /* ---------- BonusCard: matching it gives 5 extra seconds ---------- */

  function BonusCard(x, y, w, h, pairId, picture) {
    Card.call(this, x, y, w, h, pairId, picture);
  }
  extend(BonusCard, Card);

  BonusCard.prototype.points = 150;
  BonusCard.prototype.label = '+5 s';
  BonusCard.prototype.edge = '#f0b429';
  BonusCard.EXTRA_TIME = 5;

  BonusCard.prototype.onMatch = function (game) {
    Card.prototype.onMatch.call(this, game); // normal points first
    game.addTime(BonusCard.EXTRA_TIME);
  };

  /* ---------- PeekCard: matching it shows every card for a moment ---------- */

  function PeekCard(x, y, w, h, pairId, picture) {
    Card.call(this, x, y, w, h, pairId, picture);
  }
  extend(PeekCard, Card);

  PeekCard.prototype.label = 'peek';
  PeekCard.prototype.edge = '#3d9be0';
  PeekCard.PEEK_TIME = 1.2; // seconds

  PeekCard.prototype.onMatch = function (game) {
    Card.prototype.onMatch.call(this, game);
    game.peek(PeekCard.PEEK_TIME);
  };

  /* ---------- Particle: a small dot for effects ---------- */

  function Particle(x, y, colour) {
    Entity.call(this, x, y);
    // fly off in a random direction at a random speed
    const angle = Math.random() * FULL_CIRCLE;
    const speed = 60 + Math.random() * 120;
    this.vx = Math.cos(angle) * speed;
    this.vy = Math.sin(angle) * speed;
    this.maxLife = 0.5 + Math.random() * 0.4; // seconds
    this.life = this.maxLife;
    this.colour = colour;
  }
  extend(Particle, Entity);

  Particle.prototype.update = function (dt) {
    Entity.prototype.update.call(this, dt);
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    this.life -= dt;
    if (this.life <= 0) this.kill();
  };

  Particle.prototype.render = function (ctx) {
    const fade = this.life / this.maxLife; // 1 when new, 0 when gone
    ctx.globalAlpha = fade;
    circle(ctx, this.x, this.y, 1.5 + 2.5 * fade, this.colour);
    ctx.globalAlpha = 1;
  };

  /* ---------- ScorePopup: the "+100" that floats up ---------- */

  function ScorePopup(x, y, text) {
    Particle.call(this, x, y, '#ffffff');
    this.text = text;
    this.vx = 0;
    this.vy = -60; // straight up
    this.maxLife = 0.9;
    this.life = this.maxLife;
  }
  extend(ScorePopup, Particle);

  ScorePopup.prototype.render = function (ctx) {
    ctx.globalAlpha = this.life / this.maxLife;
    ctx.font = '700 22px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.strokeStyle = 'rgba(14, 36, 16, 0.7)'; // dark edge so it reads on the table
    ctx.lineWidth = 4;
    ctx.strokeText(this.text, this.x, this.y);
    ctx.fillStyle = this.colour;
    ctx.fillText(this.text, this.x, this.y);
    ctx.globalAlpha = 1;
  };

  // Share the constructors with the other files.
  global.Entity = Entity;
  global.Card = Card;
  global.BonusCard = BonusCard;
  global.PeekCard = PeekCard;
  global.Particle = Particle;
  global.ScorePopup = ScorePopup;
})(window);
