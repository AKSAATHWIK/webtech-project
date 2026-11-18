// The levels, their picture themes, and the Level / CreatorsLevel constructors.
//
// Each level says how many columns and rows of cards it has (cols x rows must be even),
// how many seconds you get, which picture theme it uses, and how many pairs are special:
//   bonus: pairs of BonusCards (+5 seconds when matched)
//   peek:  pairs of PeekCards  (show every card for a moment when matched)
(function (global) {
  'use strict';

  /* ---------- Picture themes ---------- */

  // Soft badge colours, used in turn for the pictures of a theme.
  const BADGES = ['#ffe1dc', '#dceeff', '#fff2c9', '#ece1fb', '#d9f2e3', '#ffe0ec', '#f3e6d6', '#e6eaef'];

  // Turns a list of emoji into picture objects: { text: '🐶', badge: '#ffe1dc' }.
  function makePictures(list) {
    const pictures = [];
    for (let i = 0; i < list.length; i++) {
      pictures.push({ text: list[i], badge: BADGES[i % BADGES.length] });
    }
    return pictures;
  }

  const THEMES = {
    animals: makePictures(['🐶', '🐱', '🦊', '🐼', '🐸', '🐵', '🦁', '🐧', '🐢', '🐙', '🦋', '🐘']),
    food: makePictures(['🍎', '🍇', '🍉', '🍓', '🍍', '🍒', '🍋', '🥕', '🌽', '🥦', '🥑', '🍆']),
    places: makePictures(['🗽', '🗼', '🏰', '🕌', '🗿', '⛩️', '🏯', '🗻', '🌉', '🎡', '🏟️', '⛲']),
    shapes: makePictures(['🔴', '🟦', '🔺', '⭐', '❤️', '🔷', '🟩', '🟣', '🔶', '🌙', '🟡', '⬛']),

    // A letter from each language, with the language name shown on the card.
    letters: [
      { text: 'अ', caption: 'Hindi', badge: '#ffe1dc' },
      { text: 'అ', caption: 'Telugu', badge: '#dceeff' },
      { text: 'அ', caption: 'Tamil', badge: '#fff2c9' },
      { text: 'ಕ', caption: 'Kannada', badge: '#ece1fb' },
      { text: 'അ', caption: 'Malayalam', badge: '#d9f2e3' },
      { text: 'অ', caption: 'Bengali', badge: '#ffe0ec' },
      { text: 'ਅ', caption: 'Punjabi', badge: '#f3e6d6' },
      { text: 'α', caption: 'Greek', badge: '#e6eaef' },
      { text: 'Ж', caption: 'Russian', badge: '#ffe1dc' },
      { text: 'א', caption: 'Hebrew', badge: '#dceeff' },
      { text: 'ع', caption: 'Arabic', badge: '#fff2c9' },
      { text: 'あ', caption: 'Japanese', badge: '#ece1fb' },
      { text: '한', caption: 'Korean', badge: '#d9f2e3' },
      { text: '中', caption: 'Chinese', badge: '#ffe0ec' },
      { text: 'ñ', caption: 'Spanish', badge: '#f3e6d6' },
      { text: 'ß', caption: 'German', badge: '#e6eaef' }
    ]
  };

  const LEVEL_LIST = [
    { name: 'Animals',            theme: 'animals', cols: 3, rows: 2, time: 40,  bonus: 0, peek: 0 },
    { name: 'Fruits and veggies', theme: 'food',    cols: 4, rows: 3, time: 60,  bonus: 1, peek: 0 },
    { name: 'Famous places',      theme: 'places',  cols: 4, rows: 4, time: 80,  bonus: 1, peek: 1 },
    { name: 'Shapes',             theme: 'shapes',  cols: 5, rows: 4, time: 95,  bonus: 1, peek: 1 },
    { name: 'Letters of the world', theme: 'letters', cols: 6, rows: 5, time: 130, bonus: 2, peek: 1 }
  ];

  /* ---------- Level ---------- */

  function Level(def, number) {
    this.number = number;
    this.name = def.name;
    this.theme = def.theme;
    this.cols = def.cols;
    this.rows = def.rows;
    this.time = def.time;
    this.bonus = def.bonus;
    this.peekPairs = def.peek;
    this.pairs = (def.cols * def.rows) / 2;
  }

  Level.prototype.title = function () {
    return 'Level ' + this.number;
  };

  // The text on the start screen.
  Level.prototype.goal = function () {
    let text = this.name + ': find all ' + this.pairs + ' pairs in ' + this.time + ' seconds.';
    if (this.bonus > 0) text += ' Gold cards give +5 seconds.';
    if (this.peekPairs > 0) text += ' Blue cards show every card for a moment.';
    return text;
  };

  // Called when two cards don't match. Normal levels do nothing here.
  Level.prototype.onMismatch = function () {};

  // The pictures for one game: a random choice from this level's theme,
  // one picture for each pair.
  Level.prototype.choosePictures = function () {
    const all = THEMES[this.theme].slice(); // a copy, so the theme list isn't changed
    Utils.shuffle(all);
    return all.slice(0, this.pairs);
  };

  // Lays out a fresh, shuffled set of cards inside a board of size boardW x boardH.
  Level.prototype.build = function (boardW, boardH) {
    const pictures = this.choosePictures();

    // two of each pair number, then mix them up
    const ids = [];
    for (let i = 0; i < this.pairs; i++) {
      ids.push(i);
      ids.push(i);
    }
    Utils.shuffle(ids);

    // card size: as big as fits, with cards 3 wide to 4 tall
    const gap = 12;
    const pad = 24;
    const fitW = (boardW - pad * 2 - gap * (this.cols - 1)) / this.cols;
    const fitH = (boardH - pad * 2 - gap * (this.rows - 1)) / this.rows;
    let w = fitW;
    let h = w * 4 / 3;
    if (h > fitH) {
      h = fitH;
      w = h * 3 / 4;
    }

    // centre the whole grid on the board
    const gridW = this.cols * w + (this.cols - 1) * gap;
    const gridH = this.rows * h + (this.rows - 1) * gap;
    const left = (boardW - gridW) / 2;
    const top = (boardH - gridH) / 2;

    const cards = [];
    for (let i = 0; i < ids.length; i++) {
      const col = i % this.cols;
      const row = Math.floor(i / this.cols);
      const x = left + col * (w + gap);
      const y = top + row * (h + gap);
      const id = ids[i];
      const picture = pictures[id];

      // the first pair numbers are the special cards
      let card;
      if (id < this.bonus) card = new BonusCard(x, y, w, h, id, picture);
      else if (id < this.bonus + this.peekPairs) card = new PeekCard(x, y, w, h, id, picture);
      else card = new Card(x, y, w, h, id, picture);
      cards.push(card);
    }
    return cards;
  };

  /* ---------- CreatorsLevel: the team's hardest level ---------- */
  // 36 cards with pictures from every theme mixed together,
  // and every wrong guess costs 2 seconds.

  function CreatorsLevel(number) {
    Level.call(this, { name: 'Everything mixed', theme: 'mixed', cols: 6, rows: 6, time: 150, bonus: 2, peek: 1 }, number);
  }
  Utils.extend(CreatorsLevel, Level);

  CreatorsLevel.PENALTY = 2; // seconds lost for each wrong guess

  CreatorsLevel.prototype.title = function () {
    return "Creators' level";
  };

  CreatorsLevel.prototype.goal = function () {
    return 'Our hardest level, but it can be beaten. Pictures from every level, all mixed. Find all ' +
      this.pairs + ' pairs in ' + this.time + ' seconds. Every wrong guess costs ' +
      CreatorsLevel.PENALTY + ' seconds.';
  };

  CreatorsLevel.prototype.onMismatch = function (game) {
    game.addTime(-CreatorsLevel.PENALTY);
  };

  // Overrides Level's version: picks from all the themes put together.
  CreatorsLevel.prototype.choosePictures = function () {
    let all = [];
    for (const name in THEMES) all = all.concat(THEMES[name]);
    Utils.shuffle(all);
    return all.slice(0, this.pairs);
  };

  // Turn the list into Level objects: LEVELS[0] is level 1, and so on.
  const LEVELS = [];
  for (let i = 0; i < LEVEL_LIST.length; i++) {
    LEVELS.push(new Level(LEVEL_LIST[i], i + 1));
  }
  LEVELS.push(new CreatorsLevel(LEVEL_LIST.length + 1));

  global.Level = Level;
  global.CreatorsLevel = CreatorsLevel;
  global.LEVELS = LEVELS;
})(window);
