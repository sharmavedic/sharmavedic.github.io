// Project 02 — two norms, one weather.
//
// Both pastures run the model in js/pasture-model.js, from the same seed, with
// the same grass to begin with and the same sequence of seasons. The only
// difference is the norm: a mapping from the state (the season) to an action
// (how many cows each shepherd turns out).
//
//   fixed norm      s -> 2                      the status quo: a herd size
//                                               chosen once and never revisited
//   adaptive norm   drought -> 1, dry -> 2,     the per-season optimum, found
//                   fair -> 3, wet -> 4         by sweeping all 256 maps
//
// Why the season and not the grass level: a norm keyed on how much grass is
// left always acts too late. By the time the pasture reads "low" the damage
// is done, and because grass only spreads from grass, a flattened pasture
// barely recovers. Every grass-keyed norm measured came in *below* the plain
// fixed norm; every sensible season-keyed one beat it. The state worth
// conditioning on is the one that moves first.
//
// Drawing lives in js/norms.js; this file only reads and writes the scene
// through window.normsScene.
(function () {
  const scene = window.normsScene;
  if (!scene || !window.PastureModel) return;

  const CONFIG = {
    stepMs: 300,             // wall-clock length of one time step
    horizon: 600,            // steps in a full run, then it stops on the verdict
    seasonLength: 30,        // steps between weather changes and herd decisions
    regrowBase: 0.004,       // seed-bank regrowth, so a bad season is survivable
    fixedCows: 2,            // the fixed norm's one and only action
    adaptiveCows: [1, 2, 3, 4],   // the adaptive norm, indexed by season
    seasonScale: [0.5, 0.9, 1.6, 2.2],  // regrowth multiplier per season
    moveFraction: 0.55,      // share of a step spent walking, the rest standing
    sampleEvery: 1           // chart resolution, in steps. At 1 the chart and
                             // the live counters can never disagree on a
                             // paused frame, which they did at 3.
  };

  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const overlayBtn = document.getElementById("normsOverlayPlay");
  const restartBtn = document.getElementById("normsRestart");
  const ffBtn = document.getElementById("normsFf");
  const verdictEl = document.getElementById("normsVerdict");
  const helpBtn = document.getElementById("normsHelpBtn");
  const helpDialog = document.getElementById("normsHelp");
  const helpClose = document.getElementById("normsHelpClose");

  function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

  // ---- State -----------------------------------------------------------
  let models = [];       // [fixed, adaptive]
  let weather = [];      // season index per season-block
  let season = 0;
  let steps = 0;
  let playing = false;
  let speed = 8;   // runs start fast-forwarded; the button cycles round to 1x
  let finished = false;
  let stepClock = 0;
  let slots = [new Map(), new Map()];   // cow id -> { slot, count, fromSlot, fromCount }

  function normFor(which, seasonIndex) {
    return which === 0 ? CONFIG.fixedCows : CONFIG.adaptiveCows[seasonIndex];
  }

  function spawn() {
    steps = 0;
    stepClock = 0;
    finished = false;
    slots = [new Map(), new Map()];

    // One seed for both pastures: same starting grass, same dice, so any
    // difference between the two panels comes from the norm alone.
    const seed = Math.floor(Math.random() * 1e9);
    weather = [];
    for (let i = 0; i <= Math.ceil(CONFIG.horizon / CONFIG.seasonLength); i++) {
      weather.push(Math.floor(Math.random() * 4));   // p(s) uniform over 4 states
    }
    season = weather[0];

    models = [0, 1].map((which) => {
      const m = window.PastureModel.create({ seed, regrowBase: CONFIG.regrowBase });
      m.seed(normFor(which, season));
      m.setRegrowScale(CONFIG.seasonScale[season]);
      return m;
    });

    scene.panels.forEach((panel) => panel.clearCows());
    scene.setHorizon(CONFIG.horizon);
    scene.resetChart();
    scene.pushBand(0, 0, season);
    scene.setSeason(season);
    assignSlots(true);
    sync();
    drawCows(1);
    scene.pushSample(0, 0, 0);
    scene.drawChart();
    if (verdictEl) verdictEl.textContent = "";
    setPlaying(playing);
  }

  // Several cows can share a tile; fan them out around its centre so none is
  // hidden behind another.
  function assignSlots(carryFrom) {
    models.forEach((model, i) => {
      const byTile = new Map();
      model.herd.forEach((cow) => {
        const key = cow.r * scene.N + cow.c;
        if (!byTile.has(key)) byTile.set(key, []);
        byTile.get(key).push(cow);
      });
      const next = new Map();
      byTile.forEach((group) => {
        group.forEach((cow, k) => {
          const prev = slots[i].get(cow.id);
          next.set(cow.id, {
            slot: k, count: group.length,
            fromSlot: carryFrom || !prev ? k : prev.slot,
            fromCount: carryFrom || !prev ? group.length : prev.count
          });
        });
      });
      slots[i] = next;
    });
  }

  function slotOffset(slot, count) {
    if (count <= 1) return { x: 0, y: 0 };
    const radius = count === 2 ? 6 : 8;
    const angle = (2 * Math.PI * slot) / count - Math.PI / 2;
    return { x: Math.cos(angle) * radius, y: Math.sin(angle) * radius };
  }

  function cowPixel(panel, r, c, slot, count) {
    const center = panel.tileCenter(r, c);
    const off = slotOffset(slot, count);
    return { x: center.x + off.x, y: center.y + off.y };
  }

  // ---- One time step ---------------------------------------------------
  function step() {
    // A season boundary is also a decision point: the shepherds see the new
    // state and each norm picks its action.
    if (steps > 0 && steps % CONFIG.seasonLength === 0) {
      season = weather[steps / CONFIG.seasonLength];
      models.forEach((model, which) => {
        model.setRegrowScale(CONFIG.seasonScale[season]);
        model.setPerShepherd(normFor(which, season));
      });
      scene.setSeason(season);
      scene.pushBand(steps, steps, season);
    }

    models.forEach((model) => model.step());
    steps++;
    scene.extendBand(steps);

    assignSlots(false);
    sync();

    if (steps % CONFIG.sampleEvery === 0 || steps === CONFIG.horizon) {
      scene.pushSample(steps, models[0].eaten, models[1].eaten);
      scene.drawChart();
    }

    if (steps >= CONFIG.horizon) {
      finished = true;
      showVerdict();
      setPlaying(false);
    }
  }

  function sync() {
    models.forEach((model, i) => {
      const panel = scene.panels[i];
      panel.paintGrass(model.levels);
      panel.syncCows(model.herd);
      panel.setStats(Math.round(model.grassFraction() * 100), model.herd.length, model.eaten);
    });
  }

  function showVerdict() {
    if (!verdictEl) return;
    const a = models[0].eaten, b = models[1].eaten;
    const gain = a > 0 ? Math.round((b / a - 1) * 100) : 0;
    verdictEl.textContent =
      `After ${CONFIG.horizon} steps the adaptive norm has harvested ${b} to the fixed norm's ${a}` +
      (gain > 0 ? ` — ${gain}% more grass, off the same weather.` : ".");
  }

  // ---- Drawing ---------------------------------------------------------
  function drawCows(t) {
    const walk = reduceMotion ? 1 : clamp(t / CONFIG.moveFraction, 0, 1);
    const eased = walk * walk * (3 - 2 * walk);

    models.forEach((model, i) => {
      const panel = scene.panels[i];
      model.herd.forEach((cow, n) => {
        const sprite = panel.spriteFor(cow.id);
        if (!sprite) return;
        const s = slots[i].get(cow.id) || { slot: 0, count: 1, fromSlot: 0, fromCount: 1 };
        const from = cowPixel(panel, cow.fromR, cow.fromC, s.fromSlot, s.fromCount);
        const to = cowPixel(panel, cow.r, cow.c, s.slot, s.count);
        const x = from.x + (to.x - from.x) * eased;
        const y = from.y + (to.y - from.y) * eased;
        const bob = reduceMotion ? 0 : Math.sin((steps + t) * 2.4 + n) * 0.6;
        sprite.setPose(x, y + bob, cow.dir, 0);
        sprite.setEnergy(cow.energy);
        sprite.setGrazing(cow.grazing && (reduceMotion || t > 0.25));
      });
    });
  }

  // ---- Loop ------------------------------------------------------------
  function tick(dt) {
    const stepLen = CONFIG.stepMs / speed;
    if (playing) {
      stepClock += dt;
      while (stepClock >= stepLen) {
        stepClock -= stepLen;
        step();
        if (!playing) { stepClock = 0; break; }
      }
    }
    drawCows(clamp(stepClock / stepLen, 0, 1));
  }

  let lastTime = performance.now();
  function frame(now) {
    const dt = Math.min(now - lastTime, 120);
    lastTime = now;
    tick(dt);
    requestAnimationFrame(frame);
  }

  // ---- Controls --------------------------------------------------------
  const OVERLAY = {
    play:    { glyph: "▶", label: "Play both simulations" },
    pause:   { glyph: "❚❚", label: "Pause both simulations" },
    restart: { glyph: "↺", label: "Run both simulations again" }
  };

  function setPlaying(on) {
    playing = on;
    if (overlayBtn) {
      const state = finished ? "restart" : on ? "pause" : "play";
      overlayBtn.dataset.state = state;
      overlayBtn.textContent = OVERLAY[state].glyph;
      overlayBtn.setAttribute("aria-label", OVERLAY[state].label);
    }
    if (restartBtn) restartBtn.hidden = on || finished;
  }

  let wantsPlay = false;

  function restart() {
    spawn();
    wantsPlay = false;
    setPlaying(false);
  }

  const SPEEDS = [1, 3, 8];
  function setSpeed(next) {
    speed = next;
    if (!ffBtn) return;
    ffBtn.dataset.speed = String(speed);
    ffBtn.textContent = speed === 1 ? "»" : speed + "×";
    ffBtn.setAttribute("aria-label", speed === 1 ? "Fast forward" : `Fast forward, now ${speed} times speed`);
  }

  if (ffBtn) {
    ffBtn.addEventListener("click", () => {
      setSpeed(SPEEDS[(SPEEDS.indexOf(speed) + 1) % SPEEDS.length]);
    });
    setSpeed(8);
  }

  function togglePlay() {
    if (finished) { restart(); return; }
    setPlaying(!playing);
    wantsPlay = playing;
  }

  if (overlayBtn) overlayBtn.addEventListener("click", togglePlay);
  if (restartBtn) restartBtn.addEventListener("click", restart);

  // ---- Help popup ------------------------------------------------------
  // Numbers come out of CONFIG when the dialog opens, so the write-up cannot
  // drift from the model actually running.
  function fillHelp() {
    if (!helpDialog) return;
    helpDialog.querySelectorAll("[data-cfg]").forEach((el) => {
      const v = CONFIG[el.dataset.cfg];
      el.textContent = Array.isArray(v) ? v.join(" / ") : String(v);
    });
    const derived = {
      seasonSeconds: (CONFIG.seasonLength * CONFIG.stepMs / 1000).toFixed(0),
      seasons: scene.SEASONS.join(" / "),
      bitesPerStep: "0.2"
    };
    helpDialog.querySelectorAll("[data-derived]").forEach((el) => {
      el.textContent = derived[el.dataset.derived];
    });
  }

  if (helpBtn && helpDialog) {
    helpBtn.addEventListener("click", () => { fillHelp(); helpDialog.showModal(); });
    if (helpClose) helpClose.addEventListener("click", () => helpDialog.close());
    helpDialog.addEventListener("click", (event) => {
      if (event.target === helpDialog) helpDialog.close();
    });
  }

  // ---- Go --------------------------------------------------------------
  spawn();
  setPlaying(false);
  requestAnimationFrame(frame);

  const card = scene.svg.closest(".norms-visual") || scene.svg;
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

  window.normsSim = {
    CONFIG,
    get models() { return models; },
    get steps() { return steps; },
    get season() { return season; },
    step, tick, spawn, setPlaying, setSpeed
  };
})();
