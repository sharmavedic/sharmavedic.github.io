// Tragedy of the Commons — grazing dynamics and animation loop.
//
// The model, one time step:
//
//   for each cow (in random order):
//       f = grass[tile] / (LEVELS - 1)                   fertility, in [0, 1]
//       Q(eat)  = (1 - energy) + w * f                   hunger, plus what the tile is worth
//       Q(move) = MOVE_VALUE                             fixed value of walking on
//       P(eat)  = softmax(Q) = 1 / (1 + exp((Q_move - Q_eat) / tau)),  0 if f == 0
//       eat  -> grass[tile] -= 1, energy += EAT_ENERGY
//       move -> step to an in-bounds neighbour (at most 4), drawn with
//               weight exp(MOVE_BIAS * f_neighbour): greener ground pulls
//               harder, but nothing is ever guaranteed
//   every cow: energy -= DRAIN; at energy <= 0 the cow starves and is removed
//   every tile: regrows one level with probability
//       REGROW_PER_NEIGHBOUR * (number of its 8 neighbours holding high grass)
//
// Regrowth is the part that bites. Grass only spreads from grass, so a tile
// ringed by lush neighbours recovers at 12% a step while a tile in a grazed-out
// patch recovers at nothing. Edge tiles cap at 7.5% and corners at 4.5%, simply
// because they have fewer neighbours to seed them. Graze a region flat and it
// stays flat — the pasture loses the ability to heal itself, and the cows
// standing on it run out of energy and die.
//
// Drawing lives in js/commons.js; this file only reads and writes the scene
// through window.commonsScene.
(function () {
  const scene = window.commonsScene;
  if (!scene) return;

  const CONFIG = {
    cowsPerShepherd: 4,      // adjustable — UI slider below, 1..4
    stepMs: 560,             // wall-clock length of one time step
    energyStart: 0.5,        // cows spawn on half a tank
    energyDrain: 0.04,       // energy spent per time step, whatever the cow does
    energyPerBite: 0.20,     // energy recovered from one mouthful
    grassWeight: 0.30,       // w: how much the tile's quality adds to the value of eating
    moveValue: 0.75,         // Q(move): the fixed opportunity value of walking on
    temperature: 0.08,       // tau: -> 0 is a hard threshold, large is a coin flip
    moveBias: 2.5,           // pull toward greener neighbours; 0 is a blind random walk
    regrowPerNeighbour: 0.015, // per adjacent tile holding high grass, per step
    highGrass: 3,            // a neighbour at this level or above counts as high grass
    moveFraction: 0.55       // share of a step spent walking, the rest standing
  };

  const { N, LEVELS } = scene;
  const MAX_LEVEL = LEVELS - 1;
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const stepEl = document.getElementById("commonsStep");
  const grassEl = document.getElementById("commonsGrass");
  const aliveEl = document.getElementById("commonsAlive");
  const herdSlider = document.getElementById("commonsHerd");
  const herdReadout = document.getElementById("commonsHerdReadout");
  const overlayBtn = document.getElementById("commonsOverlayPlay");
  const restartBtn = document.getElementById("commonsRestart");
  const ffBtn = document.getElementById("commonsFf");

  // ---- Help popup ------------------------------------------------------
  // Every number in the write-up is read back out of CONFIG when the dialog
  // opens, so the explanation can never drift from the model being run.
  const helpBtn = document.getElementById("commonsHelpBtn");
  const helpDialog = document.getElementById("commonsHelp");
  const helpClose = document.getElementById("commonsHelpClose");

  function trimNum(n) {
    return String(Math.round(n * 1000) / 1000);
  }

  function fillHelp() {
    if (!helpDialog) return;
    helpDialog.querySelectorAll("[data-cfg]").forEach((el) => {
      el.textContent = trimNum(CONFIG[el.dataset.cfg]);
    });
    const pct = (neighbours) => trimNum(CONFIG.regrowPerNeighbour * neighbours * 100) + "%";
    const derived = {
      mealGap: trimNum(Math.round(CONFIG.energyPerBite / CONFIG.energyDrain)),
      interior: pct(8),
      edge: pct(5),
      corner: pct(3)
    };
    helpDialog.querySelectorAll("[data-derived]").forEach((el) => {
      el.textContent = derived[el.dataset.derived];
    });
  }

  if (helpBtn && helpDialog) {
    helpBtn.addEventListener("click", () => {
      fillHelp();
      helpDialog.showModal();
    });
    if (helpClose) helpClose.addEventListener("click", () => helpDialog.close());
    // Clicking the backdrop closes it: the dialog fills its own box, so any
    // click landing on the element itself came from outside the panel.
    helpDialog.addEventListener("click", (event) => {
      if (event.target === helpDialog) helpDialog.close();
    });
  }

  function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }
  function randInt(n) { return Math.floor(Math.random() * n); }

  // ---- State -----------------------------------------------------------
  let herd = [];        // living cows, 1:1 with the scene's cow sprites
  let herdStart = 0;    // how many were turned out to begin with
  let steps = 0;
  let playing = false;
  let speed = 3;        // fast-forward multiplier on CONFIG.stepMs. Runs open at 3x
                        // here and in the gossip sim; only Project 03 opens at 8x
  let finished = false; // the last cow has starved; the run is over
  let stepClock = 0;    // ms accumulated toward the next step

  function spawn() {
    steps = 0;
    stepClock = 0;
    finished = false;
    scene.resetGrass(() => (Math.random() < 0.3 ? MAX_LEVEL - 1 : MAX_LEVEL));

    const sprites = scene.setHerdSize(CONFIG.cowsPerShepherd);
    herd = sprites.map((sprite) => ({
      sprite,
      r: randInt(N),          // cows spawn on a random tile
      c: randInt(N),
      fromR: 0, fromC: 0,     // tile it is walking out of, for tweening
      energy: CONFIG.energyStart,
      grazing: false,
      dir: Math.random() < 0.5 ? 1 : -1,
      slot: 0, slotCount: 1,
      fromSlot: 0, fromSlotCount: 1
    }));
    herdStart = herd.length;
    herd.forEach((cow) => { cow.fromR = cow.r; cow.fromC = cow.c; });
    assignSlots();
    herd.forEach((cow) => { cow.fromSlot = cow.slot; cow.fromSlotCount = cow.slotCount; });
    drawCows(1);
    updateStats();
    setPlaying(playing);
  }

  // Several cows can share a tile; fan them out around its centre so none
  // is hidden behind another.
  function assignSlots() {
    const byTile = new Map();
    herd.forEach((cow) => {
      const key = cow.r * N + cow.c;
      if (!byTile.has(key)) byTile.set(key, []);
      byTile.get(key).push(cow);
    });
    byTile.forEach((group) => {
      group.forEach((cow, i) => {
        cow.slot = i;
        cow.slotCount = group.length;
      });
    });
  }

  function slotOffset(slot, count) {
    if (count <= 1) return { x: 0, y: 0 };
    const radius = count === 2 ? 8 : 10;
    const angle = (2 * Math.PI * slot) / count - Math.PI / 2;
    return { x: Math.cos(angle) * radius, y: Math.sin(angle) * radius };
  }

  function cowPixel(r, c, slot, slotCount) {
    const center = scene.tileCenter(r, c);
    const off = slotOffset(slot, slotCount);
    return { x: center.x + off.x, y: center.y + off.y };
  }

  // Eat or move, as a softmax over the two action values. Hunger drives the
  // decision and tile quality only tips it, so a cow near empty eats whatever
  // it is standing on, while a well-fed one walks past all but the best grass.
  function eatProbability(energy, fertility) {
    if (fertility <= 0) return 0;            // a bare patch is never eaten
    const qEat = (1 - energy) + CONFIG.grassWeight * fertility;
    return 1 / (1 + Math.exp((CONFIG.moveValue - qEat) / CONFIG.temperature));
  }

  // Draw one item, each weighted by weightOf(item).
  function pickWeighted(items, weightOf) {
    const weights = items.map(weightOf);
    let roll = Math.random() * weights.reduce((sum, w) => sum + w, 0);
    for (let i = 0; i < items.length; i++) {
      roll -= weights[i];
      if (roll <= 0) return items[i];
    }
    return items[items.length - 1];
  }

  // How many of the eight tiles around (r, c) still hold high grass. Tiles on
  // the edge have 5 neighbours and corners only 3, so they seed more slowly.
  function greenNeighbours(r, c) {
    let count = 0;
    for (let dr = -1; dr <= 1; dr++) {
      for (let dc = -1; dc <= 1; dc++) {
        if (dr === 0 && dc === 0) continue;
        const nr = r + dr, nc = c + dc;
        if (nr < 0 || nr >= N || nc < 0 || nc >= N) continue;
        if (scene.getGrassLevel(nr, nc) >= CONFIG.highGrass) count++;
      }
    }
    return count;
  }

  // ---- One time step ---------------------------------------------------
  function step() {
    const order = herd.slice();
    for (let i = order.length - 1; i > 0; i--) {   // act in random order
      const j = randInt(i + 1);
      [order[i], order[j]] = [order[j], order[i]];
    }

    order.forEach((cow) => {
      cow.fromR = cow.r;
      cow.fromC = cow.c;
      cow.fromSlot = cow.slot;
      cow.fromSlotCount = cow.slotCount;
      cow.grazing = false;

      const level = scene.getGrassLevel(cow.r, cow.c);
      const pEat = eatProbability(cow.energy, level / MAX_LEVEL);

      if (Math.random() < pEat) {
        scene.setGrassLevel(cow.r, cow.c, level - 1);
        cow.energy = clamp(cow.energy + CONFIG.energyPerBite, 0, 1);
        cow.grazing = true;
      } else {
        const moves = [];
        if (cow.r > 0) moves.push([-1, 0]);
        if (cow.r < N - 1) moves.push([1, 0]);
        if (cow.c > 0) moves.push([0, -1]);
        if (cow.c < N - 1) moves.push([0, 1]);

        // Greener neighbours pull harder. Weights are exponential in the
        // neighbour's fertility, so at moveBias = 0 every direction is equally
        // likely and the cow wanders blind; raising it makes the herd drift
        // toward whatever grass is left without ever committing outright.
        const [dr, dc] = pickWeighted(moves, ([mr, mc]) =>
          Math.exp(CONFIG.moveBias * (scene.getGrassLevel(cow.r + mr, cow.c + mc) / MAX_LEVEL)));

        cow.r += dr;
        cow.c += dc;
        if (dc !== 0) cow.dir = dc > 0 ? 1 : -1;
      }
    });

    // Living costs energy; a cow that hits zero has starved and leaves the herd.
    const starved = [];
    herd.forEach((cow) => {
      cow.energy = clamp(cow.energy - CONFIG.energyDrain, 0, 1);
      if (cow.energy <= 0) starved.push(cow);
    });
    starved.forEach((cow) => {
      herd = herd.filter((c) => c !== cow);
      scene.removeCow(cow.sprite);
    });

    // Nothing left to simulate once the herd is gone — stop on the final frame
    // rather than animating an empty pasture back to green.
    if (herd.length === 0 && herdStart > 0) {
      finished = true;
      setPlaying(false);
    }

    // Grass spreads from grass: a tile's chance to gain a level is set by how
    // many of its eight neighbours are still holding high grass.
    const regrown = [];
    for (let r = 0; r < N; r++) {
      for (let c = 0; c < N; c++) {
        if (Math.random() < CONFIG.regrowPerNeighbour * greenNeighbours(r, c)) regrown.push([r, c]);
      }
    }
    regrown.forEach(([r, c]) => scene.setGrassLevel(r, c, scene.getGrassLevel(r, c) + 1));

    assignSlots();
    steps++;
    scene.paint();
    updateStats();
  }

  // ---- Drawing ---------------------------------------------------------
  // t is progress through the current step, 0..1.
  function drawCows(t) {
    const walk = reduceMotion ? 1 : clamp(t / CONFIG.moveFraction, 0, 1);
    const eased = walk * walk * (3 - 2 * walk);

    herd.forEach((cow, i) => {
      const from = cowPixel(cow.fromR, cow.fromC, cow.fromSlot, cow.fromSlotCount);
      const to = cowPixel(cow.r, cow.c, cow.slot, cow.slotCount);
      const x = from.x + (to.x - from.x) * eased;
      const y = from.y + (to.y - from.y) * eased;
      const bob = reduceMotion ? 0 : Math.sin((steps + t) * 2.4 + i) * 0.8;
      cow.sprite.setPose(x, y + bob, cow.dir, 0);
      cow.sprite.setEnergy(cow.energy);
      cow.sprite.setGrazing(cow.grazing && (reduceMotion || t > 0.25));
    });
  }

  function updateStats() {
    const grassPct = Math.round((scene.totalGrass() / scene.maxGrass()) * 100);

    if (stepEl) stepEl.textContent = String(steps);
    if (grassEl) grassEl.textContent = grassPct + "%";
    if (aliveEl) aliveEl.textContent = `${herd.length} / ${herdStart}`;
  }


  // ---- Loop ------------------------------------------------------------
  // Advance the clock by dt milliseconds and redraw. Split out from the rAF
  // callback so the simulation can also be driven by hand from the console.
  function tick(dt) {
    const stepLen = CONFIG.stepMs / speed;
    if (playing) {
      stepClock += dt;
      while (stepClock >= stepLen) {
        stepClock -= stepLen;
        step();
        if (!playing) { stepClock = 0; break; }   // the run ended mid-catch-up
      }
    }
    drawCows(clamp(stepClock / stepLen, 0, 1));
  }

  let lastTime = performance.now();
  function frame(now) {
    const dt = Math.min(now - lastTime, 120);   // cap, so a backgrounded tab doesn't fast-forward
    lastTime = now;
    tick(dt);
    requestAnimationFrame(frame);
  }

  const OVERLAY = {
    play:    { glyph: "▶", label: "Play the simulation" },
    pause:   { glyph: "❚❚", label: "Pause the simulation" },
    restart: { glyph: "↺", label: "Run the simulation again" }
  };

  function setPlaying(on) {
    playing = on;
    // One button over the pasture, wearing whichever face fits the state. CSS
    // hides the pause face until the pointer is over the grid.
    if (overlayBtn) {
      const state = finished ? "restart" : on ? "pause" : "play";
      overlayBtn.dataset.state = state;
      overlayBtn.textContent = OVERLAY[state].glyph;
      overlayBtn.setAttribute("aria-label", OVERLAY[state].label);
    }

    // The corner restart is only useful mid-run: while it plays there is
    // nothing to reset to, and once it ends the centre button does the job.
    if (restartBtn) restartBtn.hidden = on || finished;
  }

  // ---- Controls --------------------------------------------------------
  function updateHerdReadout() {
    if (!herdReadout) return;
    const per = CONFIG.cowsPerShepherd;
    const total = per * scene.shepherds.length;
    herdReadout.textContent =
      `${per} ${per === 1 ? "cow" : "cows"} per shepherd — ${total} head grazing one shared pasture`;
  }

  if (herdSlider) {
    herdSlider.value = String(CONFIG.cowsPerShepherd);
    herdSlider.addEventListener("input", () => {
      CONFIG.cowsPerShepherd = parseInt(herdSlider.value, 10);
      updateHerdReadout();
      spawn();
    });
  }
  updateHerdReadout();

  // The pasture waits for the reader: nothing runs until they press play, and
  // scrolling away and back never starts it on its own.
  let wantsPlay = false;

  // Restarting deals a fresh pasture but leaves it standing still, the same as
  // a first load — the reader presses play when they are ready to watch.
  function restart() {
    spawn();
    wantsPlay = false;
    setPlaying(false);
  }

  // Fast forward cycles through the speeds rather than toggling, so one button
  // covers "a bit quicker" and "just show me how it ends".
  const SPEEDS = [1, 3, 8];

  function setSpeed(next) {
    speed = next;
    if (!ffBtn) return;
    ffBtn.dataset.speed = String(speed);
    ffBtn.textContent = speed === 1 ? "»" : speed + "\u00d7";
    ffBtn.setAttribute("aria-label", speed === 1 ? "Fast forward" : `Fast forward, now ${speed} times speed`);
  }

  if (ffBtn) {
    ffBtn.addEventListener("click", () => {
      setSpeed(SPEEDS[(SPEEDS.indexOf(speed) + 1) % SPEEDS.length]);
    });
    setSpeed(3);
  }

  function togglePlay() {
    if (finished) {            // the run is over: the button is a restart
      restart();
      return;
    }
    setPlaying(!playing);
    wantsPlay = playing;
  }

  if (overlayBtn) overlayBtn.addEventListener("click", togglePlay);
  if (restartBtn) restartBtn.addEventListener("click", restart);

  // ---- Go --------------------------------------------------------------
  spawn();
  setPlaying(false);           // sits paused until the reader presses play
  requestAnimationFrame(frame);

  // Suspend a running simulation while it is scrolled out of view and pick it
  // up again on return. This never starts one that was not already running.
  const card = scene.svg.closest(".commons-visual") || scene.svg;
  if ("IntersectionObserver" in window) {
    new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          if (wantsPlay && !finished) setPlaying(true);
        } else if (playing) {
          setPlaying(false);
        }
      });
    }, { threshold: 0.25 }).observe(card);
  }

  // Tunables and state, for poking at from the console.
  window.commonsSim = { CONFIG, get herd() { return herd; }, step, tick, spawn, setPlaying, setSpeed, eatProbability };
})();
