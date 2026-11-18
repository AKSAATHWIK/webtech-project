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
      name: 'First bite', target: 6, speed: 135,
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
      name: 'Pillars', target: 8, speed: 128,
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
      name: 'Wraparound', target: 10, speed: 122, wrap: true,
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
      name: 'The box', target: 10, speed: 118, wrap: true,
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
      name: 'Lanes', target: 12, speed: 112,
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
      name: 'Zigzag', target: 12, speed: 108,
      map: [
        '....#.......#........',
        '....#.......#........',
        '....#.......#........',
        '....#.......#........',
        '....#.......#........',
        '....#.......#........',
        '....#.......#........',
        '....#...#...#...#....',
        '....#...#...#...#....',
        '....#...#...#...#....',
        '....#...#...#...#....',
        '....#...#...#...#....',
        '....#...#...#...#....',
        '....#...#...#...#....',
        '........#.......#....',
        '........#.......#....',
        '........#.......#....',
        '..S.....#.......#....',
        '........#.......#....',
        '........#.......#....',
        '........#.......#....'
      ]
    },
    {
      name: 'Portals', target: 12, speed: 108,
      map: [
        '..........#..........',
        '...S......#..........',
        '..........#..........',
        '..........#..........',
        '....1.....#.....2....',
        '..........#..........',
        '..........#..........',
        '..3.......#.......3..',
        '..........#..........',
        '..........#..........',
        '#####################',
        '..........#..........',
        '..........#..........',
        '..........#..........',
        '..........#..........',
        '..........#..........',
        '....2.....#.....1....',
        '..........#..........',
        '..........#..........',
        '..........#..........',
        '..........#..........'
      ]
    },
    {
      name: 'Traffic', target: 14, speed: 102,
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
      name: 'Four rooms', target: 14, speed: 98,
      map: [
        '..........#..........',
        '..........#..........',
        '...S......#..........',
        '..........#..........',
        '..........v..........',
        '.....................',
        '.....................',
        '..........#..........',
        '..........#..........',
        '..........#..........',
        '####h..#######h..####',
        '..........#..........',
        '..........#..........',
        '..........#..........',
        '..........v..........',
        '.....................',
        '.....................',
        '..........#..........',
        '..........#..........',
        '..........#..........',
        '..........#..........'
      ]
    },
    {
      name: 'Last lap', target: 16, speed: 90, wrap: true,
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
    }
  ];

  /* ---------- Level ---------- */

  function Level(def, number) {
    this.number = number;
    this.name = def.name;
    this.target = def.target;
    this.speed = def.speed;
    this.wrap = !!def.wrap;
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
    return 'Level ' + this.number;
  };

  Level.prototype.goal = function () {
    let text = 'Eat ' + this.target + ' apples.';
    if (this.wrap) text += ' The edges are open.';
    if (this.portalCells.length) text += ' Portals link matching colours.';
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

  /* ---------- EndlessLevel: no target, gets faster and fills up ---------- */

  function EndlessLevel() {
    // open edges: leave one side and come back on the other
    Level.call(this, { name: 'Endless', target: Infinity, speed: 120, wrap: true, map: [] }, 0);
  }
  Utils.extend(EndlessLevel, Level);

  EndlessLevel.WALL_EVERY = 5;

  EndlessLevel.prototype.title = function () {
    return 'Endless';
  };

  EndlessLevel.prototype.goal = function () {
    return 'No finish line and the edges are open. It speeds up as you eat, ' +
      'and a new wall drops every ' + EndlessLevel.WALL_EVERY + ' apples.';
  };

  EndlessLevel.prototype.interval = function (game) {
    return Math.max(70, this.speed - game.eaten * 2.5);
  };

  EndlessLevel.prototype.isComplete = function () {
    return false;
  };

  EndlessLevel.prototype.onEat = function (game) {
    if (game.eaten % EndlessLevel.WALL_EVERY === 0) game.dropWall();
  };

  global.Level = Level;
  global.EndlessLevel = EndlessLevel;
  global.LEVELS = MAPS.map((def, i) => new Level(def, i + 1));
})(window);
