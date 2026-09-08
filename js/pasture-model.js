// Pasture model — the grazing dynamics of the tragedy-of-the-commons pasture,
// with no drawing and no DOM at all.
//
// js/commons-sim.js keeps its own copy of these rules wired straight into the
// scene. This file exists because Project 02 runs *two* pastures side by side
// and has to be able to run thousands of them headlessly while tuning, so the
// model needed to come apart from the picture. The rules are identical:
//
//   for each cow (in random order):
//       f = grass[tile] / (LEVELS - 1)
//       Q(eat)  = (1 - energy) + grassWeight * f
//       P(eat)  = 1 / (1 + exp((moveValue - Q(eat)) / temperature)),  0 if f == 0
//       eat  -> grass -= 1, energy += energyPerBite, eaten += 1
//       move -> neighbour drawn with weight exp(moveBias * f_neighbour)
//   every cow: energy -= energyDrain; at 0 it starves and leaves the herd
//   every tile: +1 level with probability regrowPerNeighbour * (high-grass
//               neighbours among its 8), from a snapshot taken before any of
//               this step's regrowth is applied
//
// What Project 02 adds on top is `setPerShepherd(n)`: shepherds may take cows
// off the pasture or turn fresh ones out between steps. That is the action a
// norm chooses, so the model has to support it; the pasture itself does not
// care where the cows came from.
(function () {
  const DEFAULTS = {
    N: 6,                      // pasture is N x N tiles
    LEVELS: 6,                 // grass levels 0 (bare) .. LEVELS-1 (lush)
    shepherds: 4,
    energyStart: 0.5,
    energyDrain: 0.04,
    energyPerBite: 0.2,
    grassWeight: 0.3,
    moveValue: 0.75,
    temperature: 0.08,
    moveBias: 2.5,
    regrowPerNeighbour: 0.015,
    regrowBase: 0,           // seed-bank: chance a tile gains a level with no
                             // green neighbour at all. At 0 a flattened pasture
                             // is dead for good, which is simulation 1's whole
                             // point; Project 02 needs it small but non-zero so
                             // a bad season is survivable rather than terminal.
    highGrass: 3
  };

  // Small deterministic PRNG. Both pastures in a comparison are seeded the
  // same way, so a difference between them is the norm and not the dice.
  function mulberry32(seed) {
    let a = seed >>> 0;
    return function () {
      a = (a + 0x6d2b79f5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

  function create(options) {
    const cfg = Object.assign({}, DEFAULTS, options || {});
    const { N, LEVELS } = cfg;
    const MAX_LEVEL = LEVELS - 1;
    const random = cfg.random || mulberry32(cfg.seed == null ? 1 : cfg.seed);
    // The season scales how fast grass comes back. Everything else about the
    // pasture is unchanged by the weather.
    let regrowScale = 1;
    const randInt = (n) => Math.floor(random() * n);

    const levels = [];
    for (let r = 0; r < N; r++) levels.push(new Array(N).fill(MAX_LEVEL));

    let herd = [];
    let nextId = 0;
    let steps = 0;
    let eaten = 0;      // cumulative grass levels removed by grazing
    let starved = 0;
    let bought = 0;     // cows turned out onto the pasture after the start
    let sold = 0;       // cows taken off it again

    // Events from the step just run, so a scene can animate what happened
    // without re-deriving it.
    let lastRemoved = [];
    let lastAdded = [];

    function grassTotal() {
      let sum = 0;
      for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) sum += levels[r][c];
      return sum;
    }
    function grassMax() { return N * N * MAX_LEVEL; }
    function grassFraction() { return grassTotal() / grassMax(); }

    function newCow(shepherd) {
      return {
        id: nextId++,
        shepherd,
        r: randInt(N),
        c: randInt(N),
        fromR: 0, fromC: 0,
        energy: cfg.energyStart,
        grazing: false,
        dir: random() < 0.5 ? 1 : -1
      };
    }

    function seed(perShepherd) {
      for (let r = 0; r < N; r++) {
        for (let c = 0; c < N; c++) levels[r][c] = random() < 0.3 ? MAX_LEVEL - 1 : MAX_LEVEL;
      }
      herd = [];
      nextId = 0;
      steps = 0; eaten = 0; starved = 0; bought = 0; sold = 0;
      lastRemoved = []; lastAdded = [];
      for (let s = 0; s < cfg.shepherds; s++) {
        for (let i = 0; i < perShepherd; i++) herd.push(newCow(s));
      }
      herd.forEach((cow) => { cow.fromR = cow.r; cow.fromC = cow.c; });
    }

    // The action a norm picks: every shepherd ends the call holding exactly
    // `n` head. Destocking sheds the weakest cows first, which is both the
    // obvious husbandry choice and the reason an adapting shepherd loses far
    // fewer animals to starvation than a fixed one.
    function setPerShepherd(n) {
      const added = [], removed = [];
      for (let s = 0; s < cfg.shepherds; s++) {
        const mine = herd.filter((cow) => cow.shepherd === s);
        if (mine.length < n) {
          for (let i = mine.length; i < n; i++) {
            const cow = newCow(s);
            cow.fromR = cow.r; cow.fromC = cow.c;
            herd.push(cow);
            added.push(cow);
            bought++;
          }
        } else if (mine.length > n) {
          mine.sort((a, b) => a.energy - b.energy);
          const cull = mine.slice(0, mine.length - n);
          cull.forEach((cow) => { removed.push(cow); sold++; });
          herd = herd.filter((cow) => !cull.includes(cow));
        }
      }
      lastAdded = added;
      lastRemoved = lastRemoved.concat(removed);
      return { added, removed };
    }

    // Like setPerShepherd, but targets one shepherd only — for pastures where
    // different shepherds follow different herd-size policies at once (Project
    // 03's greedy/fixed/leader comparison). Destocking still sheds the
    // weakest cows first.
    function setShepherdCount(shepherd, n) {
      const mine = herd.filter((cow) => cow.shepherd === shepherd);
      const added = [], removed = [];
      if (mine.length < n) {
        for (let i = mine.length; i < n; i++) {
          const cow = newCow(shepherd);
          cow.fromR = cow.r; cow.fromC = cow.c;
          herd.push(cow);
          added.push(cow);
          bought++;
        }
      } else if (mine.length > n) {
        mine.sort((a, b) => a.energy - b.energy);
        const cull = mine.slice(0, mine.length - n);
        cull.forEach((cow) => { removed.push(cow); sold++; });
        herd = herd.filter((cow) => !cull.includes(cow));
      }
      lastAdded = lastAdded.concat(added);
      lastRemoved = lastRemoved.concat(removed);
      return { added, removed };
    }

    function eatProbability(energy, fertility) {
      if (fertility <= 0) return 0;
      const qEat = (1 - energy) + cfg.grassWeight * fertility;
      return 1 / (1 + Math.exp((cfg.moveValue - qEat) / cfg.temperature));
    }

    function pickWeighted(items, weightOf) {
      const weights = items.map(weightOf);
      let roll = random() * weights.reduce((sum, w) => sum + w, 0);
      for (let i = 0; i < items.length; i++) {
        roll -= weights[i];
        if (roll <= 0) return items[i];
      }
      return items[items.length - 1];
    }

    function greenNeighbours(r, c) {
      let count = 0;
      for (let dr = -1; dr <= 1; dr++) {
        for (let dc = -1; dc <= 1; dc++) {
          if (dr === 0 && dc === 0) continue;
          const nr = r + dr, nc = c + dc;
          if (nr < 0 || nr >= N || nc < 0 || nc >= N) continue;
          if (levels[nr][nc] >= cfg.highGrass) count++;
        }
      }
      return count;
    }

    function step() {
      lastRemoved = [];
      lastAdded = [];

      const order = herd.slice();
      for (let i = order.length - 1; i > 0; i--) {
        const j = randInt(i + 1);
        [order[i], order[j]] = [order[j], order[i]];
      }

      order.forEach((cow) => {
        cow.fromR = cow.r;
        cow.fromC = cow.c;
        cow.grazing = false;

        const level = levels[cow.r][cow.c];
        if (random() < eatProbability(cow.energy, level / MAX_LEVEL)) {
          levels[cow.r][cow.c] = level - 1;
          cow.energy = clamp(cow.energy + cfg.energyPerBite, 0, 1);
          cow.grazing = true;
          eaten++;
        } else {
          const moves = [];
          if (cow.r > 0) moves.push([-1, 0]);
          if (cow.r < N - 1) moves.push([1, 0]);
          if (cow.c > 0) moves.push([0, -1]);
          if (cow.c < N - 1) moves.push([0, 1]);
          const [dr, dc] = pickWeighted(moves, ([mr, mc]) =>
            Math.exp(cfg.moveBias * (levels[cow.r + mr][cow.c + mc] / MAX_LEVEL)));
          cow.r += dr;
          cow.c += dc;
          if (dc !== 0) cow.dir = dc > 0 ? 1 : -1;
        }
      });

      const dead = [];
      herd.forEach((cow) => {
        cow.energy = clamp(cow.energy - cfg.energyDrain, 0, 1);
        if (cow.energy <= 0) dead.push(cow);
      });
      if (dead.length) {
        herd = herd.filter((cow) => !dead.includes(cow));
        starved += dead.length;
        lastRemoved = lastRemoved.concat(dead);
      }

      // Snapshot first: a tile that regrows this step must not seed its
      // neighbours until the next one.
      const regrown = [];
      for (let r = 0; r < N; r++) {
        for (let c = 0; c < N; c++) {
          const p = (cfg.regrowBase + cfg.regrowPerNeighbour * greenNeighbours(r, c)) * regrowScale;
          if (random() < p) regrown.push([r, c]);
        }
      }
      regrown.forEach(([r, c]) => { levels[r][c] = clamp(levels[r][c] + 1, 0, MAX_LEVEL); });

      steps++;
    }

    return {
      cfg, levels, N, LEVELS, MAX_LEVEL,
      get herd() { return herd; },
      get steps() { return steps; },
      get eaten() { return eaten; },
      get starved() { return starved; },
      get bought() { return bought; },
      get sold() { return sold; },
      get lastRemoved() { return lastRemoved; },
      get lastAdded() { return lastAdded; },
      perShepherd() { return herd.length / cfg.shepherds; },
      grassTotal, grassMax, grassFraction,
      get regrowScale() { return regrowScale; },
      setRegrowScale(x) { regrowScale = x; },
      seed, setPerShepherd, setShepherdCount, step, eatProbability, random
    };
  }

  window.PastureModel = { create, DEFAULTS, mulberry32 };
})();
