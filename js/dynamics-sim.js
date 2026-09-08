// Project 03 — the realistic dynamics behind Project 02's story.
//
// Three pastures, same seed, same starting grass, constant weather. Only the
// herd-size policy differs:
//
//   greedy   each shepherd fixed at its own personal-utility-maximizing herd
//            size, forever — the top pick of shepherds 0-3 from Project 01's
//            MIXED_VIEWS table, computed once: 4, 1, 2, 3
//   fixed    every shepherd fixed at 2 cows, forever — Project 02's baseline
//   leader   shepherd 0 plays an adaptive rule (greenness-based, see below)
//            from the start; the other three start at their own personal top
//            (same as "greedy") and switch, one by one on a schedule, to
//            mirror whatever shepherd 0 is currently doing
//
// The leader's rule stands in for reputation and emulation from Project 02:
// >= 80% grass is a "reputable" state worth turning out 3 cows into, anything
// less calls for 2. A follower that has switched re-checks the leader's
// current choice on the same cadence the leader itself reconsiders on, so it
// keeps tracking the leader rather than freezing on a one-time copy.
//
// Drawing lives in js/dynamics.js; this file only reads and writes the scene
// through window.dynamicsScene.
(function () {
  const scene = window.dynamicsScene;
  if (!scene || !window.PastureModel) return;

  const CONFIG = {
    stepMs: 220,               // wall-clock length of one time step
    horizon: 10000,            // steps in a full run, then it stops on the standing
    chartSpan: 500,            // steps visible in the chart at once. The run is far
                               // longer than the window, so past this the chart
                               // scrolls: the x-axis reads (step - chartSpan) .. step
    regrowBase: 0.004,         // seed-bank regrowth, matching Project 02's pastures
    personalTop: [4, 4, 3, 2], // shepherds 0-3's own top pick, from Project 01
    leader: 0,                 // which shepherd plays the adaptive rule throughout
    switchAt: { 1: 150, 2: 300, 3: 450 },  // step at which each follower joins
    restockAt: [0.5, 0.6, 0.7, 0.8],  // grass a starved-out greedy shepherd waits for
                                      // before turning its cows back out, least
                                      // greedy first — see restockThreshold below
    reconsiderEvery: 20,       // steps between the leader re-checking greenness
    greenThreshold: 0.7,       // grass fraction at/above which the leader turns out 3
    greenCows: 3, brownCows: 2,
    moveFraction: 0.55,
    sampleEvery: 1
  };
  const LABELS = ["Greedy", "Fixed", "Leader"];

  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const overlayBtn = document.getElementById("dynamicsOverlayPlay");
  const restartBtn = document.getElementById("dynamicsRestart");
  const ffBtn = document.getElementById("dynamicsFf");
  const verdictEl = document.getElementById("dynamicsVerdict");
  const helpBtn = document.getElementById("dynamicsHelpBtn");
  const helpDialog = document.getElementById("dynamicsHelp");
  const helpClose = document.getElementById("dynamicsHelpClose");

  function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

  // ---- State -----------------------------------------------------------
  let models = [];          // [greedy, fixed, leader]
  let switched = new Set(); // follower shepherd indices that have joined the leader, in the "leader" pasture
  let steps = 0;
  let playing = false;
  let finished = false;
  let speed = 8;   // runs start fast-forwarded; the button cycles round to 1x
  let stepClock = 0;
  let slots = [new Map(), new Map(), new Map()];

  function leaderTarget(pasture) {
    return pasture.grassFraction() >= CONFIG.greenThreshold ? CONFIG.greenCows : CONFIG.brownCows;
  }

  // The greedy pasture starves its herd out and then, with nothing eating it,
  // grows back. These are the thresholds at which each greedy shepherd turns
  // its cows out again: `restockAt` handed out least-greedy-first, so the
  // shepherd running the smallest herd is back at 50% grass and the biggest
  // waits for 80%. Derived from personalTop rather than written down, so it
  // survives a change to Project 01's utility table (ties broken by index).
  const restockThreshold = [];
  CONFIG.personalTop
    .map((n, i) => ({ i, n }))
    .sort((a, b) => a.n - b.n || a.i - b.i)
    .forEach((entry, rank) => { restockThreshold[entry.i] = CONFIG.restockAt[rank]; });

  // A greedy shepherd is "out" only once every one of its cows has starved —
  // it never destocks by choice, which is the whole point of the pasture.
  function restockGreedy(pasture) {
    const grass = pasture.grassFraction();
    const alive = [0, 0, 0, 0];
    pasture.herd.forEach((cow) => { alive[cow.shepherd]++; });
    CONFIG.personalTop.forEach((n, i) => {
      if (alive[i] === 0 && grass >= restockThreshold[i]) pasture.setShepherdCount(i, n);
    });
  }

  function spawn() {
    steps = 0;
    stepClock = 0;
    finished = false;
    switched = new Set();
    slots = [new Map(), new Map(), new Map()];

    // One seed for all three pastures: same starting grass, same dice, so any
    // difference between them comes from the herd-size policy alone.
    const seed = Math.floor(Math.random() * 1e9);

    const greedy = window.PastureModel.create({ seed, regrowBase: CONFIG.regrowBase });
    greedy.seed(0);
    CONFIG.personalTop.forEach((n, i) => greedy.setShepherdCount(i, n));

    const fixed = window.PastureModel.create({ seed, regrowBase: CONFIG.regrowBase });
    fixed.seed(CONFIG.brownCows);

    const leader = window.PastureModel.create({ seed, regrowBase: CONFIG.regrowBase });
    leader.seed(0);
    CONFIG.personalTop.forEach((n, i) => leader.setShepherdCount(i, n));
    leader.setShepherdCount(CONFIG.leader, leaderTarget(leader));

    models = [greedy, fixed, leader];

    scene.panels.forEach((panel) => panel.clearCows());
    scene.setHorizon(CONFIG.chartSpan);
    scene.resetChart();
    assignSlots(true);
    sync();
    drawCows(1);
    scene.pushSample(0, [0, 0, 0]);
    scene.drawChart();
    showStanding();
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
    const radius = count === 2 ? 5 : 7;
    const angle = (2 * Math.PI * slot) / count - Math.PI / 2;
    return { x: Math.cos(angle) * radius, y: Math.sin(angle) * radius };
  }

  function cowPixel(panel, r, c, slot, count) {
    const center = panel.tileCenter(r, c);
    const off = slotOffset(slot, count);
    return { x: center.x + off.x, y: center.y + off.y };
  }

  // ---- One time step -----------------------------------------------------
  function step() {
    // The loop already stops calling this at the horizon, since setPlaying(false)
    // fires there — but a hand-driven step (the console, a harness) would run
    // straight past the end and leave the standing quoting a step that never
    // happened. Cheaper to make the end of the run mean it.
    if (finished) return;

    const leaderModel = models[2];

    restockGreedy(models[0]);

    // Followers join on schedule, whether or not this is a reconsider step —
    // the moment they join they immediately mirror the leader's last choice.
    Object.keys(CONFIG.switchAt).forEach((key) => {
      const idx = Number(key);
      if (!switched.has(idx) && steps >= CONFIG.switchAt[idx]) {
        switched.add(idx);
        leaderModel.setShepherdCount(idx, leaderTarget(leaderModel));
      }
    });

    if (steps > 0 && steps % CONFIG.reconsiderEvery === 0) {
      const target = leaderTarget(leaderModel);
      leaderModel.setShepherdCount(CONFIG.leader, target);
      switched.forEach((idx) => leaderModel.setShepherdCount(idx, target));
    }

    models.forEach((model) => model.step());
    steps++;

    assignSlots(false);
    sync();

    if (steps % CONFIG.sampleEvery === 0) {
      scene.pushSample(steps, models.map((m) => m.eaten));
      scene.drawChart();
    }

    if (steps >= CONFIG.horizon) {
      finished = true;
      setPlaying(false);
    }
    showStanding();
  }

  function sync() {
    scene.setStarved(models.map((m) => m.starved));
    models.forEach((model, i) => {
      const panel = scene.panels[i];
      panel.paintGrass(model.levels);
      panel.syncCows(model.herd);
      panel.setStats(Math.round(model.grassFraction() * 100), model.herd.length, model.eaten);
    });
  }

  // The run never ends, so the line under the card is a running scoreboard
  // rather than a verdict: who is ahead right now, and by how much over the
  // runner-up. Recomputed from the models every step, so it can never claim
  // an outcome the pastures did not produce.
  const num = (n) => n.toLocaleString();

  function showStanding() {
    if (!verdictEl) return;
    const eaten = models.map((m) => m.eaten);
    const tally = `greedy ${num(eaten[0])} · fixed ${num(eaten[1])} · leader ${num(eaten[2])}`;
    const when = finished ? `After ${num(CONFIG.horizon)} steps` : `Step ${num(steps)}`;
    const best = Math.max(...eaten);
    if (best === 0) {
      verdictEl.textContent = `${when} — nothing eaten yet.`;
      return;
    }
    const leaders = eaten.map((v, i) => (v === best ? i : -1)).filter((i) => i >= 0);
    if (leaders.length > 1) {
      verdictEl.textContent =
        `${when} — ${leaders.map((i) => LABELS[i]).join(" and ")} level (${tally}).`;
      return;
    }
    const winner = leaders[0];
    const runnerUp = eaten
      .map((v, i) => ({ v, i }))
      .filter((e) => e.i !== winner)
      .sort((a, b) => b.v - a.v)[0];
    const gain = runnerUp.v > 0 ? Math.round((best / runnerUp.v - 1) * 100) : null;
    verdictEl.textContent =
      `${when} — ${LABELS[winner]} ${finished ? "wins" : "leads"}` +
      (gain === null || gain === 0 ? "" : `, ${gain}% ahead of ${LABELS[runnerUp.i]}`) +
      ` (${tally}).`;
  }

  // ---- Drawing -----------------------------------------------------------
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
        const bob = reduceMotion ? 0 : Math.sin((steps + t) * 2.4 + n) * 0.5;
        sprite.setPose(x, y + bob, cow.dir, 0);
        sprite.setEnergy(cow.energy);
        sprite.setGrazing(cow.grazing && (reduceMotion || t > 0.25));
      });
    });
  }

  // ---- Loop ----------------------------------------------------------------
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

  // ---- Controls ------------------------------------------------------------
  const OVERLAY = {
    play:    { glyph: "▶", label: "Play all three simulations" },
    pause:   { glyph: "❚❚", label: "Pause all three simulations" },
    restart: { glyph: "↺", label: "Run all three simulations again" }
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

  // ---- Help popup ----------------------------------------------------------
  function fillHelp() {
    if (!helpDialog) return;
    helpDialog.querySelectorAll("[data-cfg]").forEach((el) => {
      const v = CONFIG[el.dataset.cfg];
      // Thousands get a separator so the popup's horizon matches the standing
      // line under the card, which is written with toLocaleString.
      el.textContent = Array.isArray(v) ? v.join(" / ")
        : typeof v === "number" && v >= 10000 ? v.toLocaleString()
        : String(v);
    });
    const derived = {
      greenPct: Math.round(CONFIG.greenThreshold * 100) + "%",
      leaderLabel: "shepherd " + (CONFIG.leader + 1),
      switchSteps: Object.values(CONFIG.switchAt).join(" / "),
      // "shepherd 4 (2 cows) at 50%, shepherd 3 (3 cows) at 60%, ..." — read
      // off the same derivation the sim runs on, so it cannot drift from it.
      restockList: CONFIG.personalTop
        .map((n, i) => ({ i, n }))
        .sort((a, b) => a.n - b.n || a.i - b.i)
        .map((e, rank) => "shepherd " + (e.i + 1) + " (" + e.n + " cows) at " +
             Math.round(CONFIG.restockAt[rank] * 100) + "%")
        .join(", ")
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

  const card = scene.svg.closest(".dynamics-visual") || scene.svg;
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

  window.dynamicsSim = {
    CONFIG,
    get models() { return models; },
    get steps() { return steps; },
    step, tick, spawn, setPlaying, setSpeed
  };
})();
