// Project 01 model — private utilities over herd sizes.
//
// Each shepherd has run their own pasture for years and formed a view of how
// many cows it can carry. Their utility for each herd size is what that
// experience taught them, and it is private: nobody can see anyone else's.
//
// Both populations below are FIXED tables rather than fresh draws, so the
// picture is the same on every visit and the numbers can be edited by hand.
// They were generated once from the shapes described with each, then checked
// against the properties that make them worth showing.
//
// The toggle under the chart switches between them. In both, two cows is the
// size that maximises welfare summed across all twenty shepherds — the answer
// the group ought to reach.
//
// The gossip protocol itself is not here yet; this only decides what each
// shepherd believes, which is what colours them and fills the chart.
(function () {
  const scene = window.shepherdScene;
  if (!scene) return;

  const OPTIONS = [1, 2, 3, 4];
  const OPTIMUM = 2;

  // Mixed views: one shared shape — more cows is better until the pasture
  // dries up — around {1: 3.5, 2: 4.1, 3: 3.7, 4: 2.7}, plus N(0, 1.5) for the
  // noise of local experience. Deliberately shallow, so private experience
  // scatters people across all four sizes. In this table three cows actually
  // leads the popular vote (6 shepherds to 5) while two cows takes the welfare
  // sum, 90.2 against 66.1 — the group's best answer is not its loudest one.
  const MIXED_VIEWS = [
    { 1: 3.11, 2: 4.76, 3: 3.06, 4: 4.86 },
    { 1: 5.34, 2: 3.94, 3: 4.00, 4: 1.87 },
    { 1: 3.76, 2: 7.43, 3: 2.06, 4: 3.24 },
    { 1: 1.99, 2: 4.18, 3: 4.22, 4: 4.05 },
    { 1: 4.34, 2: 2.66, 3: 2.13, 4: 3.36 },
    { 1: 1.04, 2: 5.55, 3: 2.73, 4: 3.76 },
    { 1: 3.27, 2: 4.01, 3: 3.31, 4: 4.89 },
    { 1: 3.32, 2: 4.06, 3: 4.17, 4: 2.26 },
    { 1: 4.99, 2: 4.41, 3: 1.63, 4: 0.42 },
    { 1: 1.53, 2: 2.92, 3: 4.90, 4: 4.12 },
    { 1: 5.78, 2: 5.06, 3: 1.04, 4: 4.42 },
    { 1: 3.13, 2: 8.41, 3: 4.74, 4: 2.43 },
    { 1: 3.02, 2: 2.41, 3: 3.45, 4: 3.67 },
    { 1: 5.29, 2: 2.99, 3: 1.31, 4: 2.67 },
    { 1: 3.06, 2: 4.15, 3: 4.17, 4: 3.70 },
    { 1: 2.97, 2: 1.97, 3: 3.80, 4: 3.47 },
    { 1: -0.05, 2: 6.73, 3: 2.78, 4: 1.62 },
    { 1: 3.29, 2: 3.68, 3: 5.29, 4: 2.63 },
    { 1: 3.09, 2: 4.31, 3: 3.18, 4: 5.26 },
    { 1: 3.72, 2: 6.56, 3: 4.13, 4: 2.61 }
  ];
  // Option neglect: three camps whose first choices genuinely differ, around
  // {1: 6.0, 2: 5.0, 3: 1.5, 4: 0.5} for eight small-herd shepherds,
  // {1: 1.0, 2: 5.0, 3: 6.0, 4: 2.0} for eight large-herd ones and
  // {1: 0.5, 2: 4.6, 3: 3.0, 4: 5.2} for the four boldest, each with N(0, 0.3).
  // Two cows tops nobody's own list — it is everybody's solid second — and it
  // still wins the welfare sum, 97.3 against 74.3. That is the case the paper
  // is about: the best answer for the group is one no individual is arguing
  // for, so listening to first preferences alone can never surface it.
  const NEGLECTED = [
    { 1: 5.55, 2: 4.59, 3: 1.24, 4: 0.56 },
    { 1: 6.03, 2: 4.95, 3: 2.09, 4: 0.61 },
    { 1: 5.52, 2: 5.33, 3: 1.62, 4: 0.39 },
    { 1: 6.47, 2: 5.07, 3: 1.92, 4: 0.37 },
    { 1: 6.05, 2: 5.00, 3: 1.53, 4: 0.55 },
    { 1: 6.04, 2: 5.09, 3: 1.43, 4: 0.56 },
    { 1: 5.78, 2: 5.19, 3: 0.96, 4: 0.28 },
    { 1: 5.53, 2: 4.90, 3: 1.33, 4: 0.75 },
    { 1: 0.65, 2: 5.24, 3: 6.33, 4: 2.06 },
    { 1: 1.08, 2: 4.95, 3: 5.85, 4: 2.01 },
    { 1: 1.22, 2: 4.42, 3: 6.47, 4: 2.06 },
    { 1: 0.55, 2: 4.79, 3: 6.19, 4: 2.16 },
    { 1: 1.04, 2: 4.92, 3: 6.57, 4: 2.27 },
    { 1: 1.07, 2: 5.11, 3: 5.88, 4: 2.02 },
    { 1: 0.78, 2: 5.52, 3: 6.77, 4: 2.83 },
    { 1: 0.59, 2: 4.88, 3: 5.95, 4: 1.72 },
    { 1: -0.06, 2: 4.54, 3: 2.83, 4: 5.32 },
    { 1: 0.68, 2: 4.42, 3: 2.93, 4: 5.22 },
    { 1: 0.70, 2: 4.32, 3: 3.18, 4: 4.72 },
    { 1: 0.32, 2: 4.09, 3: 3.28, 4: 5.57 }
  ];

  const POPULATIONS = { mixed: MIXED_VIEWS, neglect: NEGLECTED };

  // ---- Protocol ---------------------------------------------------------
  // The shepherds walk in continuous time but only look around on a fixed
  // interval. At each check the closest two who are not on cooldown meet,
  // exchange the option each currently rates highest, and average their two
  // estimates of it — bidirectionally, so one interaction can move two options.
  // Averaging is a consensus operation: an option's estimate converges to the
  // population mean utility for it, which ranks options exactly as total
  // welfare does. Neither shepherd ever sees anyone else's full table.
  const CONFIG = {
    tickSeconds: 0.56,       // one time step, matching the pasture simulation
    cooldownSeconds: 2.6,    // a shepherd is busy for roughly this long after an interaction
    cooldownJitter: 0.45,    // +/- this fraction, so cooldowns do not expire in lockstep
    maxDistance: 90,         // no interaction if the closest free pair is further apart
    linkSeconds: 0.8         // how long the interaction line lingers
  };

  const readoutEl = document.getElementById("shepherdsReadout");
  const progressEl = document.getElementById("shepherdsProgress");
  const modeButtons = Array.from(document.querySelectorAll("[data-shepherd-mode]"));

  function argmax(values) {
    return OPTIONS.reduce((best, k) => (values[k] > values[best] ? k : best), OPTIONS[0]);
  }

  function welfare(table) {
    const totals = {};
    OPTIONS.forEach((k) => {
      totals[k] = table.reduce((sum, u) => sum + u[k], 0);
    });
    return totals;
  }

  let mode = "mixed";
  let utilities = POPULATIONS.mixed;
  let totals = {};
  let state = [];          // one entry per shepherd: estimates, top, cooldown
  let interactions = 0;
  let clock = 0;
  let finished = false;    // every shepherd now names the same herd size

  function reset() {
    utilities = POPULATIONS[mode];
    totals = welfare(utilities);
    interactions = 0;
    clock = 0;
    finished = false;
    if (scene.clearLinks) scene.clearLinks();
    if (scene.scatter) scene.scatter();
    // Every shepherd starts believing exactly what its own pasture taught it.
    state = utilities.map((u) => {
      const est = {};
      OPTIONS.forEach((k) => { est[k] = u[k]; });
      return { est, top: argmax(est), cool: 0 };
    });
    paint();
  }

  // The run is over once the optimum has separated: the lowest estimate anyone
  // holds for two cows is above the highest estimate anyone holds for anything
  // else. That is stronger than "everybody currently agrees" — an average of
  // two values always lands between them, so once the two ranges are disjoint
  // no future interaction can bring them back together, and no shepherd can be
  // talked out of it.
  function separation() {
    let lowestOptimum = Infinity;
    let highestOther = -Infinity;
    state.forEach((agent) => {
      lowestOptimum = Math.min(lowestOptimum, agent.est[OPTIMUM]);
      OPTIONS.forEach((k) => {
        if (k !== OPTIMUM) highestOther = Math.max(highestOther, agent.est[k]);
      });
    });
    return { lowestOptimum, highestOther, settled: lowestOptimum > highestOther };
  }

  function consensus() {
    return separation().settled ? OPTIMUM : null;
  }

  function paint() {
    scene.setFavourites(state.map((agent) => agent.top));

    const backing = state.filter((agent) => agent.top === OPTIMUM).length;
    const agreed = consensus();
    if (progressEl) {
      progressEl.textContent = agreed !== null
        ? `Settled on ${agreed} cows after ${interactions} interactions`
        : `${interactions} interaction${interactions === 1 ? "" : "s"} · ${backing} of ${state.length} now back two cows`;
    }
    if (readoutEl) {
      readoutEl.textContent = mode === "neglect"
        ? "Nobody starts out wanting two cows — some swear by one, the rest by three or four. It " +
          "is everybody's second choice, and still the welfare-optimal size."
        : "Each shepherd holds a private view of what a pasture can carry. Three cows leads the " +
          "vote at the start, but two cows maximises welfare across the group.";
    }

    modeButtons.forEach((btn) => {
      btn.setAttribute("aria-pressed", String(btn.dataset.shepherdMode === mode));
    });
  }

  // The closest pair of shepherds who are both free to talk.
  function closestFreePair() {
    const free = [];
    state.forEach((agent, i) => { if (agent.cool <= 0) free.push(i); });
    if (free.length < 2) return null;

    let best = null;
    for (let a = 0; a < free.length; a++) {
      for (let b = a + 1; b < free.length; b++) {
        const p = scene.agents[free[a]], q = scene.agents[free[b]];
        const d = Math.hypot(p.x - q.x, p.y - q.y);
        if (!best || d < best.d) best = { i: free[a], j: free[b], d };
      }
    }
    return best && best.d <= CONFIG.maxDistance ? best : null;
  }

  function cooldownFor() {
    const spread = 1 + (Math.random() * 2 - 1) * CONFIG.cooldownJitter;
    return CONFIG.cooldownSeconds * spread;
  }

  function meet(i, j) {
    const a = state[i], b = state[j];
    const ka = a.top, kb = b.top;

    const shared = (k) => {
      const mean = (a.est[k] + b.est[k]) / 2;
      a.est[k] = mean;
      b.est[k] = mean;
    };

    shared(ka);
    if (kb !== ka) shared(kb);     // both name an option; the same one is one average

    a.top = argmax(a.est);
    b.top = argmax(b.est);
    // Jittered, because identical cooldowns expire in the order they were set:
    // the pair that met first becomes free first, is often the only free pair,
    // and re-meets forever. That locks the population into fixed couples who
    // have nothing left to tell each other.
    a.cool = cooldownFor();
    b.cool = cooldownFor();
    interactions++;

    scene.flashLink(i, j, CONFIG.linkSeconds);
    paint();
  }

  function tick(dt) {
    state.forEach((agent) => { if (agent.cool > 0) agent.cool -= dt; });

    clock += dt;
    if (clock < CONFIG.tickSeconds) return;
    clock -= CONFIG.tickSeconds;

    const pair = closestFreePair();
    if (pair) meet(pair.i, pair.j);

    if (!finished && consensus() !== null) {
      finished = true;
      setPlaying(false);       // stop on the frame they agreed
    }
  }

  // ---- Controls ---------------------------------------------------------
  // Same set as the pasture: play and pause over the box, restart in the
  // bottom-right corner, fast forward in the top-right.
  const playBtn = document.getElementById("shepherdsPlay");
  const restartBtn = document.getElementById("shepherdsRestart");
  const ffBtn = document.getElementById("shepherdsFf");

  const FACES = {
    play: { glyph: "▶", label: "Play the simulation" },
    pause: { glyph: "❚❚", label: "Pause the simulation" },
    restart: { glyph: "↺", label: "Run the simulation again" }
  };
  const SPEEDS = [1, 3, 8];
  let speed = 1;
  let wantsPlay = false;

  function setPlaying(on) {
    scene.setPlaying(on);
    if (playBtn) {
      const key = finished ? "restart" : on ? "pause" : "play";
      playBtn.dataset.state = key;
      playBtn.textContent = FACES[key].glyph;
      playBtn.setAttribute("aria-label", FACES[key].label);
    }
    // Same as the pasture: nothing to see while it runs, and once it has
    // settled the centre button does the job — so the corner restart only
    // offers itself on a paused run in progress.
    if (restartBtn) restartBtn.hidden = on || finished;
  }

  function setSpeed(next) {
    speed = next;
    scene.setSpeed(speed);
    if (!ffBtn) return;
    ffBtn.dataset.speed = String(speed);
    ffBtn.textContent = speed === 1 ? "\u00bb" : speed + "\u00d7";
    ffBtn.setAttribute("aria-label",
      speed === 1 ? "Fast forward" : `Fast forward, now ${speed} times speed`);
  }

  if (playBtn) {
    playBtn.addEventListener("click", () => {
      if (finished) {          // the run has settled: play means run it again
        reset();
        setPlaying(false);
        wantsPlay = false;
        return;
      }
      setPlaying(!scene.playing);
      wantsPlay = scene.playing;
    });
  }
  if (restartBtn) restartBtn.addEventListener("click", () => { reset(); setPlaying(false); wantsPlay = false; });
  if (ffBtn) {
    ffBtn.addEventListener("click", () => {
      setSpeed(SPEEDS[(SPEEDS.indexOf(speed) + 1) % SPEEDS.length]);
    });
  }

  modeButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
      mode = btn.dataset.shepherdMode;
      reset();
      setPlaying(false);
      wantsPlay = false;
    });
  });

  // ---- Help popup ------------------------------------------------------
  // The numbers in the write-up are read out of CONFIG and the live population
  // when the dialog opens, so the explanation cannot drift from the model.
  const helpBtn = document.getElementById("shepherdsHelpBtn");
  const helpDialog = document.getElementById("shepherdsHelp");
  const helpClose = document.getElementById("shepherdsHelpClose");

  function trimNum(n) { return String(Math.round(n * 1000) / 1000); }

  function fillHelp() {
    if (!helpDialog) return;
    helpDialog.querySelectorAll("[data-cfg]").forEach((el) => {
      el.textContent = trimNum(CONFIG[el.dataset.cfg]);
    });
    const derived = {
      jitterPct: "\u00b1" + Math.round(CONFIG.cooldownJitter * 100) + "%",
      welfare: OPTIONS.map((k) => `${k} ${k === 1 ? "cow" : "cows"} ${totals[k].toFixed(1)}`).join(", ")
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
    helpDialog.addEventListener("click", (event) => {
      if (event.target === helpDialog) helpDialog.close();
    });
  }

  reset();
  setPlaying(false);
  setSpeed(1);
  scene.onTick(tick);

  // Suspend a running simulation while it is scrolled out of view, and pick it
  // up on return. This never starts one the reader has not started.
  const card = scene.svg.closest(".shepherds-visual") || scene.svg;
  if ("IntersectionObserver" in window) {
    new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          if (wantsPlay && !finished) setPlaying(true);
        } else if (scene.playing) {
          setPlaying(false);
        }
      });
    }, { threshold: 0.25 }).observe(card);
  }

  window.shepherdsSim = {
    OPTIONS, OPTIMUM, POPULATIONS, CONFIG,
    get mode() { return mode; },
    get utilities() { return utilities; },
    get favourite() { return state.map((a) => a.top); },
    get state() { return state; },
    get totals() { return totals; },
    get interactions() { return interactions; },
    get finished() { return finished; },
    consensus,
    setMode(next) { mode = next; reset(); },
    reset, tick, welfare, argmax
  };
})();
