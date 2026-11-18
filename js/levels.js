// Level layouts and the Level / EndlessLevel constructors.
//
// Every map is 21 x 21. Legend:
//   .  empty           #  wall
//   S  snake start     h  wall sliding left/right    v  wall sliding up/down
//   1-4  portals (the two cells with the same number are linked)
//
// `speed` is milliseconds per step, so smaller is faster.
// `wrap` means the board edges are open: leave one side, come back on the other.
(function (global) {
  'use strict';

  const SIZE = 21;

  const MAPS = [
    {
      name: 'First bite', target: 5, speed: 150,
      map: [
        '.....................',
        '.....................',
        '.....................',
        '.....................',
        '.....................',
        '.....................',
        '.....................',
        '.....................',
        '.....................',
        '.....................',
        '....S................',
        '.....................',
        '.....................',
        '.....................',
        '.....................',
        '.....................',
        '.....................',
        '.....................',
        '.....................',
        '.....................',
        '.....................'
      ]
    },
    {
      name: 'Pillars', target: 6, speed: 145,
      map: [
        '.....................',
        '.....................',
        '.....................',
        '.....................',
        '....##.........##....',
        '....##.........##....',
        '.....................',
        '.....................',
        '.....................',
        '.........###.........',
        '....S....###.........',
        '.........###.........',
        '.....................',
        '.....................',
        '.....................',
        '....##.........##....',
        '....##.........##....',
        '.....................',
        '.....................',
        '.....................',
        '.....................'
      ]
    },
    {
      name: 'Wraparound', target: 8, speed: 140, wrap: true,
      map: [
        '.....................',
        '.....................',
        '.....................',
        '.....................',
        '.....................',
        '.....................',
        '.....................',
        '..........#..........',
        '..........#..........',
        '..........#..........',
        '...S...#######.......',
        '..........#..........',
        '..........#..........',
        '..........#..........',
        '.....................',
        '.....................',
        '.....................',
        '.....................',
        '.....................',
        '.....................',
        '.....................'
      ]
    },
    {
      name: 'The box', target: 8, speed: 136, wrap: true,
      map: [
        '#########...#########',
        '#...................#',
        '#...................#',
        '#...................#',
        '#...................#',
        '#....###.....###....#',
        '#...................#',
        '#...................#',
        '#...................#',
        '.....................',
        '...S.................',
        '.....................',
        '#...................#',
        '#...................#',
        '#...................#',
        '#....###.....###....#',
        '#...................#',
        '#...................#',
        '#...................#',
        '#...................#',
        '#########...#########'
      ]
    },
    {
      name: 'Lanes', target: 10, speed: 132,
      map: [
        '.....................',
        '.....................',
        '.....................',
        '..#################..',
        '.....................',
        '.....................',
        '.....................',
        '..#######...#######..',
        '.....................',
        '.....................',
        '...S.................',
        '.....................',
        '.....................',
        '..#######...#######..',
        '.....................',
        '.....................',
        '.....................',
        '..#################..',
        '.....................',
        '.....................',
        '.....................'
      ]
    },
    {
      name: 'Zigzag', target: 10, speed: 130,
      map: [
        '.....................',
        '.....................',
        '.....#.........#.....',
        '.....#.........#.....',
        '.....#.........#.....',
        '.....#.........#.....',
        '.....#....#....#.....',
        '.....#....#....#.....',
        '.....#....#....#.....',
        '.....#....#....#.....',
        '..S..#....#....#.....',
        '.....#....#....#.....',
        '.....#....#....#.....',
        '..........#..........',
        '..........#..........',
        '..........#..........',
        '..........#..........',
        '..........#..........',
        '.....................',
        '.....................',
        '.....................'
      ]
    },
    {
      // Portals are shortcuts here, not the only way round.
      name: 'Portals', target: 8, speed: 128,
      map: [
        '.....................',
        '.....................',
        '.....................',
        '..........#..........',
        '..........#..........',
        '....1.....#.....2....',
        '..........#..........',
        '..........#..........',
        '.....................',
        '.....................',
        '...S.................',
        '.....................',
        '.....................',
        '..........#..........',
        '..........#..........',
        '....2.....#.....1....',
        '..........#..........',
        '..........#..........',
        '.....................',
        '.....................',
        '.....................'
      ]
    },
    {
      name: 'Traffic', target: 10, speed: 125,
      map: [
        '.....................',
        '.....................',
        '..h..................',
        '.....................',
        '.....................',
        '.....#.........#.....',
        '.....#.........#.....',
        '.....#....v....#.....',
        '.....#.........#.....',
        '.....................',
        '..S..................',
        '.....................',
        '.....#.........#.....',
        '.....#....v....#.....',
        '.....#.........#.....',
        '.....#.........#.....',
        '.....................',
        '.....................',
        '..................h..',
        '.....................',
        '.....................'
      ]
    },
    {
      name: 'Four rooms', target: 12, speed: 120,
      map: [
        '..........#..........',
        '..........#..........',
        '..........#..........',
        '..........v..........',
        '.....................',
        '...S.................',
        '.....................',
        '..........#..........',
        '..........#..........',
        '..........#..........',
        '###h....#####h....###',
        '..........#..........',
        '..........#..........',
        '..........#..........',
        '..........v..........',
        '.....................',
        '.....................',
        '.....................',
        '..........#..........',
        '..........#..........',
        '..........#..........'
      ]
    },
    {
      name: 'Last lap', target: 12, speed: 115, wrap: true,
      map: [
        '########.....########',
        '#...................#',
        '#..1.............2..#',
        '#...................#',
        '#.....h.............#',
        '#...................#',
        '#.....###.....###...#',
        '#...................#',
        '.....................',
        '.....................',
        '...S.......v.........',
        '.....................',
        '.....................',
        '#...................#',
        '#.....###.....###...#',
        '#...................#',
        '#.............h.....#',
        '#...................#',
        '#..2.............1..#',
        '#...................#',
        '########.....########'
      ]
    },
    {
      // Made by the team: the hardest one, with everything at once.
      // Every corridor is at least 3 cells wide, so it is tough but fair.
      name: "Creators' level", title: "Creators' level", creators: true,
      target: 15, speed: 105, wrap: true,
      map: [
        '#####...#####...#####',
        '#...................#',
        '#..1.............2..#',
        '#.......h...........#',
        '#...###.......###...#',
        '#...#...........#...#',
        '....#.....v.....#....',
        '....#...........#....',
        '#.......#####.......#',
        '#...................#',
        '#..S................#',
        '#...................#',
        '#.......#####.......#',
        '....#...........#....',
        '....#.....v.....#....',
        '#...#...........#...#',
        '#...###.......###...#',
        '#...........h.......#',
        '#..2.............1..#',
        '#...................#',
        '#####...#####...#####'
      ]
    }
  ];

  /* ---------- Level ---------- */

  function Level(def, number) {
    this.number = number;
    this.name = def.name;
    this.target = def.target;
    this.speed = def.speed;
    this.wrap = !!def.wrap;
    this.customTitle = def.title || null; // shown instead of "Level 11"
    this.creators = !!def.creators;
    this.cols = SIZE;
    this.rows = SIZE;
    this.parse(def.map || []);
  }

  Level.prototype.parse = function (rows) {
    this.start = new Vec(3, 10);
    this.dir = Dir.RIGHT;
    this.wallCells = [];
    this.moverCells = [];
    this.portalCells = [];

    for (let y = 0; y < this.rows; y++) {
      const row = rows[y] || '';
      if (rows[y] !== undefined && row.length !== this.cols) {
        console.warn(this.name + ': row ' + y + ' is ' + row.length + ' wide, expected ' + this.cols);
      }
      for (let x = 0; x < this.cols; x++) {
        const ch = row[x] || '.';
        if (ch === '#') this.wallCells.push(new Vec(x, y));
        else if (ch === 'S') this.start = new Vec(x, y);
        else if (ch === 'h' || ch === 'v') this.moverCells.push({ x, y, axis: ch });
        else if (ch >= '1' && ch <= '4') this.portalCells.push({ x, y, id: Number(ch) });
      }
    }
  };

  // Creates fresh objects for a new attempt, so nothing carries over from the last one.
  Level.prototype.build = function () {
    const walls = this.wallCells.map((p) => new Wall(p.x, p.y));
    const movers = this.moverCells.map((m) => new MovingWall(m.x, m.y, m.axis));
    const portals = this.portalCells.map((p) => new Portal(p.x, p.y, p.id));

    // quick lookup: solid[y * cols + x] is the wall on that cell (or null)
    const solid = new Array(this.cols * this.rows).fill(null);
    walls.forEach((w) => { solid[w.pos.y * this.cols + w.pos.x] = w; });

    // link each portal to the other one with the same number
    portals.forEach((p) => {
      p.partner = portals.find((other) => other !== p && other.id === p.id);
    });

    return { walls, solid, movers, portals };
  };

  Level.prototype.title = function () {
    return this.customTitle || 'Level ' + this.number;
  };

  // The second line of the score bar.
  Level.prototype.subtitle = function () {
    return this.creators ? 'Made by the team · the hardest one' : this.name;
  };

  Level.prototype.goal = function () {
    let text = this.creators ? 'Our hardest level, but it can be beaten. ' : '';
    text += 'Eat ' + this.target + ' apples.';
    if (this.wrap) text += ' Glowing edges are open: go through to the other side.';
    if (this.portalCells.length) text += ' Portals take you to the one of the same colour.';
    if (this.moverCells.length) text += ' Orange walls move.';
    return text;
  };

  Level.prototype.interval = function () {
    return this.speed;
  };

  Level.prototype.isComplete = function (game) {
    return game.eaten >= this.target;
  };

  // Called after each regular apple. Endless mode uses it to add walls.
  Level.prototype.onEat = function () {};

  // Points for eating an apple. Endless mode adds a combo on top.
  Level.prototype.pointsFor = function (game, apple) {
    return apple.points;
  };

  /* ---------- EndlessLevel: no target, gets faster and changes as you go ---------- */
  //
  //  - eat apples quickly one after another for a combo (up to x5 points)
  //  - every 5 apples a wall drops in (it flashes first, so you can move away)
  //  - every 10 apples a new stage starts: stage 2 adds portals, 3 and 4 add moving walls

  function EndlessLevel() {
    // open edges: leave one side and come back on the other
    Level.call(this, { name: 'Endless', target: Infinity, speed: 135, wrap: true, map: [] }, 0);
    this.combo = 0;
    this.lastEat = -Infinity; // play time of the last apple
  }
  Utils.extend(EndlessLevel, Level);

  EndlessLevel.WALL_EVERY = 5;
  EndlessLevel.STAGE_EVERY = 10;
  EndlessLevel.COMBO_TIME = 4; // seconds between apples to keep a combo
  EndlessLevel.MAX_COMBO = 5;

  EndlessLevel.prototype.title = function () {
    return 'Endless';
  };

  EndlessLevel.prototype.stage = function (game) {
    return 1 + Math.floor(game.eaten / EndlessLevel.STAGE_EVERY);
  };

  // The combo still running right now (1 if it has run out).
  EndlessLevel.prototype.liveCombo = function (game) {
    return game.playTime - this.lastEat <= EndlessLevel.COMBO_TIME ? this.combo : 1;
  };

  EndlessLevel.prototype.subtitle = function (game) {
    const combo = this.liveCombo(game);
    return 'Stage ' + this.stage(game) + (combo > 1 ? ' · combo x' + combo : '');
  };

  EndlessLevel.prototype.goal = function () {
    return 'Every edge is open and there is no finish line. Eat apples quickly for a combo. ' +
      'Walls drop in as you go, and each stage adds something new.';
  };

  EndlessLevel.prototype.pointsFor = function (game, apple) {
    const quick = game.playTime - this.lastEat <= EndlessLevel.COMBO_TIME;
    this.combo = quick ? Math.min(this.combo + 1, EndlessLevel.MAX_COMBO) : 1;
    this.lastEat = game.playTime;
    return apple.points * this.combo;
  };

  EndlessLevel.prototype.interval = function (game) {
    return Math.max(80, this.speed - game.eaten * 2);
  };

  EndlessLevel.prototype.isComplete = function () {
    return false;
  };

  EndlessLevel.prototype.onEat = function (game) {
    const n = game.eaten;
    if (n % EndlessLevel.WALL_EVERY === 0) game.dropWall();
    if (n === EndlessLevel.STAGE_EVERY) game.addPortals();
    if (n === EndlessLevel.STAGE_EVERY * 2 || n === EndlessLevel.STAGE_EVERY * 3) game.addMover();
  };

  global.Level = Level;
  global.EndlessLevel = EndlessLevel;
  global.LEVELS = MAPS.map((def, i) => new Level(def, i + 1));
})(window);
