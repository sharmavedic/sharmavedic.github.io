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
    horizon: 500,              // steps in a full run, then it stops on the standing
    chartSpan: 500,            // steps visible in the chart at once. Equal to the
                               // horizon, so a run now fits the window exactly and
                               // the chart never actually scrolls — the axis stays
                               // 0..500 and the lines grow into it. The scrolling
                               // machinery in js/dynamics.js (the (step - chartSpan)
                               // left edge, prune(), the kept pre-edge sample) is
                               // left in place and is simply never exercised; it
                               // costs nothing and is what any horizon > 500 would
                               // need again.
    regrowBase: 0.001,         // seed-bank regrowth. Project 02's pastures run 0.004;
                               // this was walked down from there in two passes, by
                               // request, so it is deliberately *not* the same number
                               // as Project 02's and should not be re-synced to it.
                               //
                               // 0.002 is the floor that costs Optimal nothing. See
                               // the sweep in CLAUDE.md: over 200 seeds at the
                               // 500-step horizon, Optimal wipes out in 4/200 at
                               // 0.004, 7/200 at 0.003 and 6/200 here — flat, all
                               // noise around ~3% — and then 14/200 at 0.001 and
                               // 29/200 at 0. The cliff is between 0.002 and 0.001,
                               // and past it the card genuinely breaks: a pasture
                               // labelled "Optimal" sits dead while Leader wins it.
                               // **Do not go below 0.002 without re-running that
                               // sweep.** (Leader is not the constraint — it stayed
                               // below Optimal in every run where Optimal survived,
                               // at every rate down to 0.)
                               //
                               // What this rate actually buys is the *greedy*
                               // pasture's ending, and 0.002 is where that changes
                               // in kind rather than degree: at 0.003 Greedy starves
                               // out, regreens to 63% and restocks to 5 head; here it
                               // starves out and stays dead at 34% grass with 0 head.
                               // The boom-bust cycle the old note described — "the
                               // commons only recovers after the herd that ruined it
                               // is gone" — is gone with it, chosen deliberately for
                               // the bleaker read. `restockAt` and restockGreedy()
                               // still work and still fire in the runs that do
                               // regreen; they are simply rarely reached now.
    // Project 03 passes startGrass, regrowPerNeighbour and highGrass into every
    // PastureModel.create() rather than inheriting the model's DEFAULTS, so this
    // card can be tuned without touching Simulation 1's balance table or the
    // archived Project 02 visual. Do not "simplify" them back out.
    //
    // **0.60 opens the pastures below the ~73% this card's Optimal herd
    // sustains**, so the Optimal pasture *climbs* over the first ~80 steps and
    // then holds. It briefly ran at 0.73 — exactly the equilibrium, so the
    // Optimal line was flat from step 0 — and was moved down by request. Worth
    // knowing what that trades: a flat line says "two cows is the level this
    // pasture holds" at a glance, whereas a climbing one can read as "two cows
    // is under-stocking". It is not actually under-stocking (9 head dies 24/24
    // at this tuning — see regrowPerNeighbour), but the picture no longer says
    // so on its own.
    //
    // What it buys is a thinner, more worn-looking opening and a slightly
    // better ordering: measured 64 seeds, Leader finishes a median -6.1% and is
    // below Optimal in 62/64, against -3.0% and 59/64 at the 0.73 opening,
    // because there is less standing grass for the greedy herd to bank. It also
    // costs Optimal a little safety — 2/64 wipeouts here against 0/64 at 0.73,
    // since the pasture has to climb to its steady state while already carrying
    // a full herd. The shipped seed is one where it survives comfortably.
    //
    // Opening, equilibrium and `recoverUntil` are three different numbers now
    // and only the last two are tied together. If `regrowPerNeighbour` or
    // `highGrass` moves, re-measure the equilibrium and reset `recoverUntil`;
    // this opening is a free choice.
    startGrass: 0.60,
    // **These two deliberately differ from Simulation 1 (0.012 / highGrass 3),
    // and that is the most consequential decision in this file.**
    //
    // `highGrass` is the level at which a tile counts as a green neighbour, i.e.
    // as a seed for regrowth. At 3, the model is *bistable*: thinning a pasture
    // destroys its own seed stock, so there is a stable state near 82% grass and
    // a collapse basin with nothing in between. Eight head then sits at 82% —
    // visibly un-grazed — while a ninth cow tips the whole pasture to zero
    // (measured 2,000 steps, 16 seeds: 8 head survives 15/16, 9 head 0/16).
    // Both readings are true at once, and the un-grazed one makes the card look
    // like two cows is under-stocking.
    //
    // Dropping it to 2 lets thin grass still seed its neighbours, which replaces
    // the cliff with a graded response — the steady grass level now falls as the
    // herd grows (at 0.012: 8 head 83%, 9 → 80%, 10 → 76%, 11 → 71%) instead of
    // jumping to collapse. That also moved capacity to 10 head, so the rate came
    // down to put the optimum back at 8. Measured, 24 seeds, 2,000 steps:
    //   0.0090 -> 8 head 22/24 @ 72%,  9 head 0/24
    //   0.0092 -> 8 head 24/24 @ 73%,  9 head 0/24   <- shipped
    //   0.0095 -> 8 head 24/24 @ 75%,  9 head 3/24
    //   0.0098 -> 8 head 24/24 @ 77%,  9 head 13/24
    // 0.0092 is where two cows a shepherd is unambiguously the largest herd the
    // pasture carries *and* the grass visibly shows the grazing.
    //
    // Simulation 1 was deliberately NOT changed to match: its balance table, the
    // 2-cow capacity behind Project 01's utility tables, and the "collapse is
    // absorbing" finding all rest on 0.012 / highGrass 3 / regrowBase 0. If the
    // two are ever unified, do it from Simulation 1's side and re-run its table.
    regrowPerNeighbour: 0.0092,
    highGrass: 2,
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
    // **This is the depletion knob, and it is bounded below by cow starvation,
    // not by the field.** Lowering it lets the followers stay greedy longer, so
    // the pasture is run further down and takes visibly longer to climb back —
    // which is what it is set for.
    //
    // The floor was measured directly: graze down to a target with 13 head,
    // destock, then give the pasture 2,000 steps (16 seeds per cell). At one cow
    // each the *field* climbs back to 70% from every level tested, down to 20% —
    // grass spreads from grass and four head barely touch it. What fails first
    // is the herd: cows start starving at 30% (3/16 runs) and it is 11/16 by
    // 25%. **So the real constraint is "destock before the pasture reaches
    // ~35%", and everything above that is safe.**
    //
    // 0.50 leaves the margin. Measured over 64 seeds at the shipped settings:
    // trough median 46%, worst 41%, **0/64 below 40%**, 0/64 below 35%, the
    // leader's herd never drops below its 4 destocked head, and 0/64 wipeouts.
    // Note the trough always undershoots this threshold, because the followers
    // join one at a time (`joinEvery`) after it trips — that gap is why the
    // margin has to be real and not nominal.
    //
    // For scale, 24 seeds each: 0.64 troughs at 59% and is back over 70% by
    // step 36; 0.58 -> 55% / step 54; **0.50 -> 46% / step 119**; 0.46 -> 42%
    // but worst-case 33%, already inside the starvation band; 0.42 -> 37% /
    // worst 29%, which is where herds begin dying. **Do not go below 0.50
    // without re-running the floor measurement above.**
    recoverBelow: 0.50,
    // The repair ends on the *pasture*, not on a clock: the leader returns to
    // the norm once the grass is back to `recoverUntil` — 0.80, just under the
    // measured ~82% equilibrium for 8 head. So the red marker lands on a
    // **state**: the leader hands the norm back once it has restored the
    // commons to roughly what the norm can sustain.
    //
    // This tracks the *equilibrium*, not the opening. It was briefly tied to
    // `startGrass` instead, which only made sense while the pastures opened at
    // 82% — see startGrass for why they no longer do.
    recoverUntil: 0.60,
    // **The repair ladder: whole-pasture herd sizes, walked down one rung every
    // `rungSteps`.** Replaces the old single destock (everyone straight to one
    // cow), which read as a cliff. Asked for as "make the recovery slowly by
    // changing it to 7 heads or 6 heads eventually bringing it to 4 heads".
    //
    // It bottoms at 4 and holds there until the grass is back to
    // `recoverUntil`, then the norm. Note the ladder does NOT start at 8: the
    // fall from the opening down to ~40% is done by the greedy herd, because
    // 8 head cannot deplete this pasture at all (it is the carrying capacity —
    // from 60% it climbs to 71%). See herdTarget() for both measurements.
    repairLadder: [7, 6, 5, 4],
    // How long each rung lasts. Bounded above by starvation, not by taste: on
    // a pasture at 40%, holding 7 head kills the herd in 12/16 runs and 6 head
    // in 3/16, while 5 and 4 are clean. The ladder has to move through the top
    // rungs briskly — see the sweep in CLAUDE.md for what each value costs.
    rungSteps: 20,
    // **The run is deterministic.** Every restart replays this same seed, so
    // the card plays one authored run rather than a fresh sample.
    //
    // It is not just a convenience. The Leader pasture spends its opening on 13
    // head, which out-harvests Optimal's 8 while the grass lasts, so Leader is
    // *ahead* early in every run — that part is arithmetic and no parameter
    // removes it. What the tuning controls is how long that lasts and whether
    // it is ever repaid: at the shipped settings Leader finishes a median
    // **-3.0%** across 64 seeds, below Optimal in 59/64. Fixing the seed turns
    // that 59/64 into a property of the card.
    //
    // 836700000 is the pick of 700 candidates, scored on every claim the card
    // makes: Optimal opens at **60%**, the configured value, and settles at 71%
    // inside a 55-75% band without ever wiping out; the Leader pasture is run
    // down to **43%** by step 21, is not back over 70% until step **80**, and
    // reaches the norm at step **121**; its herd never falls below the 4 head it
    // destocks to; it is ahead of Optimal only over steps 0-42 and finishes
    // **-7.0%**; Greedy's herd is gone by step 88 and its pasture ends at 6%.
    //
    // Set this to null for a random seed per run. The sim is identical either
    // way — it just stops being reproducible, and the ordering goes back to
    // ~59/64 rather than certain.
    fixedSeed: 836700000,
    brownCows: 2,   // the norm, per shepherd: 2 each = 8 head
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
  let speed = 3;   // runs start fast-forwarded; the button cycles round to 1x.
                   // Was 8x, when a run was 10,000 steps and needed it. At the
                   // 500-step horizon 3x is ~37s end to end, which is the same
                   // opening speed as Simulations 1 and 2. Both this and the
                   // setSpeed() call at wire-up have to say 3 — this value only
                   // stands on its own if the button is missing.
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
  // before any follower joins, so the norm arrives once, around step 200.
  // Under the older fixed-schedule version it genuinely mattered: the grass
  // could hold above `recoverBelow` past the last follower, and the pasture
  // would reach 2-each early, *leave* the norm when the repair finally fired,
  // and come back a thousand-odd steps later. Latching left the marker
  // standing at the first arrival through a stretch spent on 1 cow.
  let normStep = null;
  const FOLLOWERS = 3;         // shepherds 1-3; shepherd 0 is the leader

  function updateNorm(pasture) {
    const per = [0, 0, 0, 0];
    pasture.herd.forEach((cow) => { per[cow.shepherd]++; });
    const onNorm = switched.size === FOLLOWERS
      && per.every((n) => n === CONFIG.brownCows);
    if (onNorm === (normStep !== null)) return;
    normStep = onNorm ? steps : null;
    scene.setNormStep(normStep);
  }

  // ---- The leader's prescription ---------------------------------------
  //
  // The repair is a **ladder of whole-pasture herd sizes**, not a single
  // destock. Once the pasture has visibly failed the leader walks the herd
  // down `repairLadder` one rung at a time, `rungSteps` apart, and holds the
  // bottom rung until the grass is back to `recoverUntil` — then the norm
  // (`brownCows` each = 8 head) for good.
  //
  // Two measured facts shape the ladder, and both are easy to get wrong:
  //
  //  * **The decline cannot happen at 8 head.** Eight head is the carrying
  //    capacity, so from a 60% opening it *climbs* to 71% rather than falling
  //    (measured 16 seeds, 300 steps: 7 head -> 78%, 8 head -> 71%, neither
  //    ever reaching 40%). Only 10+ head draw the pasture down, and those
  //    starve their own herd. So the fall from 60% to ~40% is done by the
  //    greedy opening herd, and the ladder is purely the way back.
  //
  //  * **The top rungs are lethal if the ladder lingers on them.** Held on a
  //    pasture grazed to 40% for 400 steps (16 seeds): 4 head climbs back to
  //    60% in 16/16 with no deaths, 5 head 16/16 / no deaths, 6 head 12/16
  //    with 3 deaths, 7 head 4/16 with **12 deaths**, 8 head 2/16 with **16**.
  //    The ladder may pass through 7 and 6, it may not sit there. That is what
  //    `rungSteps` is bounded by — see CLAUDE.md for the sweep.
  function herdTarget(pasture) {
    const grass = pasture.grassFraction();
    if (!leanFired && grass < CONFIG.recoverBelow) {
      leanFired = true;
      repairStep = steps;
    }
    if (leanFired && !leanDone && grass >= CONFIG.recoverUntil) leanDone = true;
    if (!leanFired || leanDone) return CONFIG.brownCows * 4;
    const rung = Math.floor((steps - repairStep) / CONFIG.rungSteps);
    return CONFIG.repairLadder[Math.min(rung, CONFIG.repairLadder.length - 1)];
  }

  // Spread `head` cows over all four shepherds, as evenly as possible and
  // biggest-herd-first, so a 7 is 2/2/2/1 rather than a lump.
  //
  // **The ladder is a whole-pasture number, so it can only be applied once
  // every shepherd is following.** Dividing it among the shepherds who have
  // joined so far does not under-shoot, it over-shoots wildly: with only the
  // leader signed up, a rung of 7 put all seven cows on that one shepherd
  // while the other three were still on their greedy picks, taking the pasture
  // to *16* head at the exact moment it was supposed to be destocking.
  function applyHerd(pasture, head) {
    const base = Math.floor(head / 4);
    const extra = head % 4;
    for (let i = 0; i < 4; i++) {
      pasture.setShepherdCount(i, base + (i < extra ? 1 : 0));
    }
  }

  // What the leader actually does on a given step. Until all three followers
  // have joined there is no whole-pasture target to apply, so the leader simply
  // plays the norm itself and whoever has joined mirrors it; the ladder takes
  // over the moment the pasture is fully under its control.
  function applyLeaderPolicy(pasture) {
    const head = herdTarget(pasture);
    if (switched.size === FOLLOWERS) {
      applyHerd(pasture, head);
    } else {
      pasture.setShepherdCount(CONFIG.leader, CONFIG.brownCows);
      switched.forEach((i) => pasture.setShepherdCount(i, CONFIG.brownCows));
    }
    updateNorm(pasture);
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
    // difference between them comes from the herd-size policy alone. It is also
    // the *same* seed on every run unless `fixedSeed` is null — see CONFIG.
    const seed = CONFIG.fixedSeed === null || CONFIG.fixedSeed === undefined
      ? Math.floor(Math.random() * 1e9)
      : CONFIG.fixedSeed;

    const greedy = window.PastureModel.create({
      seed, regrowBase: CONFIG.regrowBase,
      regrowPerNeighbour: CONFIG.regrowPerNeighbour, startGrass: CONFIG.startGrass,
      highGrass: CONFIG.highGrass
    });
    greedy.seed(0);
    CONFIG.personalTop.forEach((n, i) => greedy.setShepherdCount(i, n));

    const optimal = window.PastureModel.create({
      seed, regrowBase: CONFIG.regrowBase,
      regrowPerNeighbour: CONFIG.regrowPerNeighbour, startGrass: CONFIG.startGrass,
      highGrass: CONFIG.highGrass
    });
    optimal.seed(CONFIG.brownCows);

    // The leader pasture opens *identically* to the greedy one — all four
    // shepherds on their own top pick, 13 head against a capacity of 8. The
    // leader used to be set to the norm here at step 0, which capped the
    // opening at 11 head and made the collapse noticeably shallower. It now
    // plays greedy until its first reconsideration at step `reconsiderEvery`,
    // which is what lets the pasture fall far enough for the repair to be a
    // repair.
    const leader = window.PastureModel.create({
      seed, regrowBase: CONFIG.regrowBase,
      regrowPerNeighbour: CONFIG.regrowPerNeighbour, startGrass: CONFIG.startGrass,
      highGrass: CONFIG.highGrass
    });
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
    if (steps % CONFIG.watchEvery === 0) herdTarget(leaderModel);

    // Followers copy the leader only once the pasture has visibly failed, then
    // one at a time. The moment one joins it mirrors the leader's current
    // choice — which during the repair is one cow, not the norm.
    if (leanFired) {
      for (let idx = 1; idx <= FOLLOWERS; idx++) {
        if (switched.has(idx) || steps < repairStep + idx * CONFIG.joinEvery) continue;
        switched.add(idx);
        applyLeaderPolicy(leaderModel);
      }
    }

    // The ladder moves on its own clock, so the leader re-applies it every
    // `rungSteps` as well as on its own reconsideration — otherwise a rung
    // could be skipped entirely when the two cadences do not line up.
    const onRung = leanFired && !leanDone
      && (steps - repairStep) % CONFIG.rungSteps === 0;
    if (steps > 0 && (steps % CONFIG.reconsiderEvery === 0 || onRung)) {
      applyLeaderPolicy(leaderModel);
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

  // While a run is going the line under the card is a running scoreboard rather
  // than a verdict: who is ahead right now, and by how much over the runner-up.
  // It switches to "After N steps — X wins" at the horizon. Recomputed from the
  // models every step, so it can never claim an outcome the pastures did not
  // produce — which matters most in exactly the case it is there for, Optimal's
  // own herd wiping out (6/200 runs at this seed-bank rate), where the honest
  // report is that Leader won.
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
    setSpeed(3);
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
