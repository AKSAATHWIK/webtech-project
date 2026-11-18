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
    this.wrap = def.wrap === true;
    this.creators = def.creators === true;
    this.customTitle = def.title; // shown instead of "Level 11" (undefined for most levels)
    this.cols = SIZE;
    this.rows = SIZE;
    this.parse(def.map);
  }

  // Reads the map one character at a time and remembers where everything is.
  Level.prototype.parse = function (rows) {
    this.start = new Vec(3, 10);
    this.dir = Dir.RIGHT;
    this.wallCells = [];
    this.moverCells = [];
    this.portalCells = [];

    for (let y = 0; y < rows.length; y++) {
      for (let x = 0; x < rows[y].length; x++) {
        const ch = rows[y][x];
        if (ch === '#') this.wallCells.push(new Vec(x, y));
        else if (ch === 'S') this.start = new Vec(x, y);
        else if (ch === 'h' || ch === 'v') this.moverCells.push({ x: x, y: y, axis: ch });
        else if (ch >= '1' && ch <= '4') this.portalCells.push({ x: x, y: y, id: Number(ch) });
      }
    }
  };

  // Creates fresh objects for a new attempt, so nothing carries over from the last one.
  Level.prototype.build = function () {
    const walls = [];
    const movers = [];
    const portals = [];

    // quick lookup: solid[y * cols + x] is the wall on that cell (or null)
    const solid = [];
    for (let i = 0; i < this.cols * this.rows; i++) solid.push(null);

    for (let i = 0; i < this.wallCells.length; i++) {
      const p = this.wallCells[i];
      const wall = new Wall(p.x, p.y);
      walls.push(wall);
      solid[p.y * this.cols + p.x] = wall;
    }

    for (let i = 0; i < this.moverCells.length; i++) {
      const m = this.moverCells[i];
      movers.push(new MovingWall(m.x, m.y, m.axis));
    }

    for (let i = 0; i < this.portalCells.length; i++) {
      const p = this.portalCells[i];
      portals.push(new Portal(p.x, p.y, p.id));
    }

    // link each portal to the other one with the same number
    for (let i = 0; i < portals.length; i++) {
      for (let j = 0; j < portals.length; j++) {
        if (i !== j && portals[i].id === portals[j].id) portals[i].partner = portals[j];
      }
    }

    return { walls: walls, solid: solid, movers: movers, portals: portals };
  };

  Level.prototype.title = function () {
    if (this.customTitle) return this.customTitle;
    return 'Level ' + this.number;
  };

  // The second line of the score bar.
  Level.prototype.subtitle = function () {
    if (this.creators) return 'Made by the team · the hardest one';
    return this.name;
  };

  // The text on the start screen.
  Level.prototype.goal = function () {
    let text = 'Eat ' + this.target + ' apples.';
    if (this.creators) text = 'Our hardest level, but it can be beaten. ' + text;
    if (this.wrap) text += ' Glowing edges are open: go through to the other side.';
    if (this.portalCells.length > 0) text += ' Portals take you to the one of the same colour.';
    if (this.moverCells.length > 0) text += ' Orange walls move.';
    return text;
  };

  // Milliseconds per step.
  Level.prototype.interval = function () {
    return this.speed;
  };

  Level.prototype.isComplete = function (game) {
    return game.eaten >= this.target;
  };

  // Called after each regular apple. Normal levels do nothing here.
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
    // an empty map with open edges
    Level.call(this, { name: 'Endless', target: 0, speed: 135, wrap: true, map: [] }, 0);
    this.combo = 0;
    this.lastEat = -100; // play time of the last apple (long ago at the start)
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

  // Is the last apple recent enough to keep the combo going?
  EndlessLevel.prototype.comboRunning = function (game) {
    return game.playTime - this.lastEat <= EndlessLevel.COMBO_TIME;
  };

  EndlessLevel.prototype.subtitle = function (game) {
    let text = 'Stage ' + this.stage(game);
    if (this.comboRunning(game) && this.combo > 1) text += ' · combo x' + this.combo;
    return text;
  };

  EndlessLevel.prototype.goal = function () {
    return 'Every edge is open and there is no finish line. Eat apples quickly for a combo. ' +
      'Walls drop in as you go, and each stage adds something new.';
  };

  EndlessLevel.prototype.pointsFor = function (game, apple) {
    if (this.comboRunning(game)) {
      this.combo = Math.min(this.combo + 1, EndlessLevel.MAX_COMBO);
    } else {
      this.combo = 1;
    }
    this.lastEat = game.playTime;
    return apple.points * this.combo;
  };

  // Gets a little faster with every apple, but never faster than 80 ms per step.
  EndlessLevel.prototype.interval = function (game) {
    return Math.max(80, this.speed - game.eaten * 2);
  };

  EndlessLevel.prototype.isComplete = function () {
    return false;
  };

  EndlessLevel.prototype.onEat = function (game) {
    const n = game.eaten;
    if (n % EndlessLevel.WALL_EVERY === 0) game.dropWall();
    if (n === 10) game.addPortals();
    if (n === 20 || n === 30) game.addMover();
  };

  // Turn every map into a Level object: LEVELS[0] is level 1, and so on.
  const LEVELS = [];
  for (let i = 0; i < MAPS.length; i++) {
    LEVELS.push(new Level(MAPS[i], i + 1));
  }

  global.Level = Level;
  global.EndlessLevel = EndlessLevel;
  global.LEVELS = LEVELS;
})(window);