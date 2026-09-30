// Project 03 — the realistic dynamics behind Project 02's story.
//
// Three pastures, same seed, same starting grass, constant weather. Only the
// herd-size policy differs:
//
//   greedy   each shepherd fixed at its own personal-utility-maximizing herd
//            size, forever — the top pick of shepherds 0-3 from Project 01's
//            MIXED_VIEWS table, computed once: 4, 1, 2, 3
//   optimal  every shepherd at 2 cows, forever — the welfare-optimal norm and
//            the most the pasture carries indefinitely; drawn dashed, as the
//            target the other two are read against
//   leader   shepherd 0 knows the norm and plays it; the other three start at
//            their own personal top (same as "greedy") and switch, one by one
//            on a schedule, to mirror whatever shepherd 0 is currently doing
//
// The leader stands in for reputation and emulation from Project 02. It does
// not out-perform the norm — it cannot, since 2 cows is the optimum — it pays
// to reach it: the greedy opening grazes the pasture down before anyone is
// following, so the leader's first prescription is a repair (1 cow until the
// grass returns) and the harvest given up during it is never recovered. That
// is why Leader tracks parallel to, and permanently below, Optimal. A follower
// that has switched re-checks the leader's current choice on the same cadence
// the leader itself reconsiders on, so it keeps tracking the leader rather
// than freezing on a one-time copy.
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
    // Followers do not join on a clock. They start copying the leader once the
    // pasture has visibly failed — the repair firing is the trigger — and then
    // come in one at a time, `joinEvery` steps apart.
    //
    // This replaced a fixed `switchAt: {1:60, 2:120, 3:180}` schedule, and the
    // reason is measurable rather than stylistic. Depletion speed varies by
    // seed, so a clock cannot be in the right place twice: at 60/120/180 the
    // herd was already destocked before the grass fell far (the pasture
    // bottomed at a median 65%, and the repair never fired at all in 6 of 24
    // runs), while every slower schedule tried — 90/180/270, 120/240/360,
    // 180/360/540 — bought a deeper median of only a few points and paid for it
    // with a 1-in-5 chance of tipping the pasture into the absorbing 0% state.
    // Triggering on the pasture instead pins the depth to `recoverBelow`.
    joinEvery: 5,
    // How often the leader looks at the grass. NOT the same as
    // `reconsiderEvery`, which is how often it acts. At the greedy opening of
    // 13 head the pasture loses roughly a percentage point of grass per step,
    // so a 20-step blind spot lets it fall 20 points past the level the leader
    // meant to act at — which is the difference between a recoverable pasture
    // and a dead one.
    watchEvery: 5,
    restockAt: [0.5, 0.6, 0.7, 0.8],  // grass a starved-out greedy shepherd waits for
                                      // before turning its cows back out, least
                                      // greedy first — see restockThreshold below
    reconsiderEvery: 20,       // steps between the leader re-checking the pasture
    // The leader's norm is 2 cows — the welfare-optimal one, the same as the
    // Optimal pasture. What separates the two is the damage already done before
    // anyone was following: the herd opens on its greedy picks (13 head against
    // a capacity of 8), and by the time the followers arrive the pasture has
    // been grazed down. So the first thing the leader prescribes is not the
    // norm but a repair — `leanCows` until the grass comes back — and only then
    // the norm itself.
    //
    // That repair is why Leader finishes *below* Optimal and stays there. The
    // lost harvest is real and never recovered: the two run parallel afterwards,
    // separated by what the greedy opening cost. Adapting to the grass is a
    // cost here, not an edge — which is the whole point, since at capacity 2
    // there is nothing above the norm for an adaptive rule to find.
    // Grass fraction that triggers the repair — and, because the followers key
    // off the same event, the depth of the collapse the card actually shows.
    // Raising it makes the pasture's dip shallower, lowering it deeper.
    //
    // 0.55 is the floor that is still safe *at the 0.7 opening*. The binding
    // constraint is that the recoverable level depends on how many cows are
    // left eating: measured by grazing 13 head down to a target and then
    // destocking, 4 head (1 each) climbs back from 40% in 13/16 runs and from
    // 34% in 9/16, but 8 head (2 each) cannot recover from 50% at all —
    // 0/16. So the repair has to catch the pasture *before* the followers
    // settle on two cows, and still leave enough for four head to work with.
    //
    // This number moves with `startGrass`, because a lower opening is less
    // buffer between the trigger and the floor: at the old 0.8 opening 0.52
    // was safe (0/40 wipeouts) and that same 0.52 fails 1/32 at 0.7. Swept
    // over 32 seeds at the 0.7 opening, 0.55 bottoms out at a median 50%
    // (worst 41%) with 0/32 pastures hitting zero and no cows starved; 0.52
    // is 1/32, 0.48 is 3/32 and 0.45 is 16/32. **Re-sweep this if
    // `startGrass` changes again.**
    recoverBelow: 0.55,
    // The repair ends on the *pasture*, not on a clock: the leader returns to
    // the norm once the grass is back to `recoverUntil` — but never before
    // `minRepairSteps` have passed.
    //
    // The floor is there because the gap between Leader and Optimal simply is
    // the length of the repair, at about 1% of final harvest per 200 steps.
    // On the grass rule alone the repair lasts ~100 steps and the gap
    // collapses to -0.09%, at which point Leader actually *beats* Optimal in
    // 9 of 24 seeds and the section's whole claim breaks. Measured at the
    // 0.7 opening: hold 400 gives -1.8% with Leader below Optimal in 32/32.
    // Note the grass threshold is not the real knob — 0.70 and 0.80 measure
    // identically, because four head crosses both within ~100 steps.
    recoverUntil: 0.80,
    minRepairSteps: 400,
    leanCows: 1, brownCows: 2,
    moveFraction: 0.55,
    sampleEvery: 1
  };
  // Order here is the on-screen order, left to right, and every models[] index
  // below follows it: Optimal sits last because it is the target the other two
  // are read against, not a competitor in the middle of the row.
  const LABELS = ["Greedy", "Leader", "Optimal"];

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
  let models = [];          // [greedy, leader, optimal] — matches LABELS/panels
  let switched = new Set(); // follower shepherd indices that have joined the leader, in the "leader" pasture
  let steps = 0;
  let playing = false;
  let finished = false;
  let speed = 8;   // runs start fast-forwarded; the button cycles round to 1x
  let stepClock = 0;
  let slots = [new Map(), new Map(), new Map()];

  // The repair fires at most once a run: once the leader has seen the pasture
  // down and nursed it back, it knows the norm and simply plays it. A rule that
  // could re-trigger would flap instead of converge — with the steady state at
  // ~83% grass, a threshold anywhere near it has the leader oscillating between
  // 1 and 2 cows forever, which measured 10% below Optimal but never settled.
  let leanFired = false;       // whether the repair has started
  let leanDone = false;        // whether it has finished — once true, never again
  let repairStep = -1;         // step it fired on — the followers' join clock
  // The step the leader pasture settled on the norm — every shepherd on
  // `brownCows`, which needs all three followers joined *and* the repair not
  // running. It is recorded when the count is actually applied, never derived
  // from the repair step plus the hold, so the marker can't point at a step
  // the pasture did not do this on.
  //
  // It is cleared and re-set rather than latched, because reaching the norm is
  // not always permanent the first time. As tuned the repair always fires
  // before any follower joins, so the norm arrives once, around step 440.
  // Under the older fixed-schedule version it genuinely mattered: the grass
  // could hold above `recoverBelow` past the last follower, and the pasture
  // would reach 2-each early, *leave* the norm when the repair finally fired,
  // and come back a thousand-odd steps later. Latching left the marker
  // standing at the first arrival through a stretch spent on 1 cow.
  let normStep = null;
  const FOLLOWERS = 3;         // shepherds 1-3; shepherd 0 is the leader

  function updateNorm(target) {
    const onNorm = target === CONFIG.brownCows && switched.size === FOLLOWERS;
    if (onNorm === (normStep !== null)) return;
    normStep = onNorm ? steps : null;
    scene.setNormStep(normStep);
  }

  function leaderTarget(pasture) {
    const grass = pasture.grassFraction();
    if (!leanFired && grass < CONFIG.recoverBelow) {
      leanFired = true;
      repairStep = steps;
    }
    // Ends on the grass coming back, not on a timer — but not before
    // `minRepairSteps`, which is what keeps a visible gap on the chart. Both
    // latches are one-way, so the pasture converges instead of flapping.
    if (leanFired && !leanDone && grass >= CONFIG.recoverUntil
        && steps >= repairStep + CONFIG.minRepairSteps) {
      leanDone = true;
    }
    return leanFired && !leanDone ? CONFIG.leanCows : CONFIG.brownCows;
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
    leanFired = false;         // the repair is per-run, so restart must re-arm it
    leanDone = false;
    repairStep = -1;
    normStep = null;           // resetChart() clears the scene's copy
    slots = [new Map(), new Map(), new Map()];

    // One seed for all three pastures: same starting grass, same dice, so any
    // difference between them comes from the herd-size policy alone.
    const seed = Math.floor(Math.random() * 1e9);

    const greedy = window.PastureModel.create({ seed, regrowBase: CONFIG.regrowBase });
    greedy.seed(0);
    CONFIG.personalTop.forEach((n, i) => greedy.setShepherdCount(i, n));

    const optimal = window.PastureModel.create({ seed, regrowBase: CONFIG.regrowBase });
    optimal.seed(CONFIG.brownCows);

    // The leader pasture opens *identically* to the greedy one — all four
    // shepherds on their own top pick, 13 head against a capacity of 8. The
    // leader used to be set to the norm here at step 0, which capped the
    // opening at 11 head and made the collapse noticeably shallower. It now
    // plays greedy until its first reconsideration at step `reconsiderEvery`,
    // which is what lets the pasture fall far enough for the repair to be a
    // repair.
    const leader = window.PastureModel.create({ seed, regrowBase: CONFIG.regrowBase });
    leader.seed(0);
    CONFIG.personalTop.forEach((n, i) => leader.setShepherdCount(i, n));

    models = [greedy, leader, optimal];

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

    const leaderModel = models[1];

    restockGreedy(models[0]);

    // The leader *looks* on this cadence; it only *acts* on reconsider steps
    // below. Sensing has to be the faster of the two — see CONFIG.watchEvery.
    if (steps % CONFIG.watchEvery === 0) leaderTarget(leaderModel);

    // Followers copy the leader only once the pasture has visibly failed, then
    // one at a time. The moment one joins it mirrors the leader's current
    // choice — which during the repair is one cow, not the norm.
    if (leanFired) {
      for (let idx = 1; idx <= FOLLOWERS; idx++) {
        if (switched.has(idx) || steps < repairStep + idx * CONFIG.joinEvery) continue;
        switched.add(idx);
        const target = leaderTarget(leaderModel);
        leaderModel.setShepherdCount(idx, target);
        updateNorm(target);
      }
    }

    if (steps > 0 && steps % CONFIG.reconsiderEvery === 0) {
      const target = leaderTarget(leaderModel);
      leaderModel.setShepherdCount(CONFIG.leader, target);
      switched.forEach((idx) => leaderModel.setShepherdCount(idx, target));
      updateNorm(target);
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
    scene.setStats(models.map((m) => ({
      grass: Math.round(m.grassFraction() * 100),
      head: m.herd.length,
      eaten: m.eaten
    })));
    models.forEach((model, i) => {
      const panel = scene.panels[i];
      panel.paintGrass(model.levels);
      panel.syncCows(model.herd);
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
    const tally = `greedy ${num(eaten[0])} · leader ${num(eaten[1])} · optimal ${num(eaten[2])}`;
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
    const ratio = runnerUp.v > 0 ? best / runnerUp.v - 1 : null;
    // Leader converging onto Optimal is the expected end state, and the two
    // finish within a fraction of a percent of each other. Exact equality
    // essentially never happens, so without a tolerance the line would read
    // "Leader leads, 0% ahead of Optimal" — which states a lead and then denies
    // it. Anything under 1% is reported as level instead.
    if (ratio !== null && ratio < 0.01) {
      verdictEl.textContent =
        `${when} — ${LABELS[winner]} and ${LABELS[runnerUp.i]} are level (${tally}).`;
      return;
    }
    const gain = ratio === null ? null : Math.round(ratio * 100);
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
      recoverPct: Math.round(CONFIG.recoverBelow * 100) + "%",
      recoverUntilPct: Math.round(CONFIG.recoverUntil * 100) + "%",
      leaderLabel: "shepherd " + (CONFIG.leader + 1),
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
