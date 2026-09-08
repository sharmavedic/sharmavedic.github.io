# Site notes

Personal academic site. Plain static HTML/CSS/JS — no build step, no bundler, no
npm. Scripts are IIFEs loaded with `<script>` tags in dependency order.

**There is no usable `node` on this machine.** `node` is not on `PATH`, and the
only binary on disk (`/snap/kf6-core24/*/usr/bin/node`) fails to start — its
`libnode.so.109` is missing. An earlier version of this file claimed node was
available (v22+); it isn't, so `node --check` and standalone prototype scripts
are both out. **Everything is verified by driving pages in headless Chrome**
(see *Verifying changes* at the bottom) — including pure-logic sweeps, which
run fine by loading `js/pasture-model.js` into a throwaway harness page and
dumping results into a `<pre>`. Every number in this file was measured that
way.

## Files

| File | Role |
|---|---|
| `index.html` | Home: hero, "The Problem" (pasture sim), "Project 01" (gossip sim), "Project 02" (leader-emergence diagrams), "Project 03" (three-pasture dynamics) |
| `css/style.css` | Everything. Design tokens in `:root`, dark variants in `:root[data-theme="dark"]` **and** the `prefers-color-scheme` block — edit both |
| `js/main.js` | Theme toggle, nav, reveal-on-scroll |
| `js/shepherd-sprite.js` | Shared shepherd figure, used by all three simulations plus the Project 02 diagrams. Load before the others. Symmetric left-right, no crook — dropped because it broke the symmetry and read as a stray thread at small sizes |
| `js/cow-sprite.js` | Shared cow figure, `make(color, scale)`. Extracted from `commons.js`; classes stay `commons-cow*` because the CSS hangs off them |
| `js/pasture-model.js` | **Pure** pasture dynamics, no DOM, seeded RNG → `window.PastureModel`. Back in active use for Project 03 (was otherwise only kept alive by the archived Project 02 norms visual). `setShepherdCount(shepherd, n)` targets one shepherd's herd size independently of the others — added for Project 03, where the three pastures each mix different per-shepherd policies; `setPerShepherd(n)` (uniform across all shepherds) is unchanged |
| `js/commons.js` | Pasture **scene** (drawing only) → `window.commonsScene` |
| `js/commons-sim.js` | Pasture **model + loop** → `window.commonsSim` |
| `js/shepherds.js` | Gossip **scene** (box, bouncing, tally chart) → `window.shepherdScene` |
| `js/shepherds-sim.js` | Gossip **model + protocol** → `window.shepherdsSim` |
| `js/norms.js` | Paired-pasture **scene** (two stacked pastures, weather strip, harvest chart) → `window.normsScene`. **Not currently loaded** — see Simulation 3 note below |
| `js/norms-sim.js` | Paired-pasture **driver** (seasons + the two norms) → `window.normsSim`. **Not currently loaded**, same reason |
| `js/leader-emergence.js` | Project 02's **replacement** visual (experimental) — three small autoplaying looping diagrams (no controls, no sim/scene split): personal-utility agents drifting past a fixed spotlight, an opinion leader converging from arrows, then the leader's norm flowing back out. Agents in all three steps are `ShepherdSprite` figures (needs `js/shepherd-sprite.js` loaded first), sized via a shared radius-to-scale helper; Step 3's travelling flow stays a plain dot and always renders behind the agents |
| `js/eaten-metric.js` | The 2x2 looping diagram in Project 03's `.policy-key` card — full tile → cow arrives → cow grazes and the tile fades, with a `+1` → cow leaves, paler tile stays. The focus ring **slides** between frames rather than jumping (`SLIDE_MS`), and works out where it is coming from as `(phase - 1)` in the fixed loop order, so `render(phase, t)` stays correct at any point without external state. Arrows in the gaps carry the direction, and whichever one the ring is travelling along lights up. Only the focused frame animates; the rest hold the state their step ends in. Cows are clipped to their own tile (`metricCowClipN`) so one can walk in from off the edge without appearing over the frame next door, and each faces the way it is moving. Same shape as `leader-emergence.js` (autoplaying, no controls, no sim/scene split) and draws the shared `CowSprite`. Exposes `window.eatenMetric.render(phase, t)` — with `requestAnimationFrame` stubbed, that is the only way to check a mid-animation frame headlessly |
| `js/dynamics.js` | Project 03 **scene** — three 6x6 pastures side by side plus a shared cumulative-harvest chart → `window.dynamicsScene`. Modelled on the archived `js/norms.js` (same panel/chart drawing approach) but widened to 3 columns and with the weather/season machinery dropped, since Project 03 runs on constant weather |
| `js/dynamics-sim.js` | Project 03 **driver** (the three herd-size policies + the play/pause/restart/ff/help loop) → `window.dynamicsSim`. See Simulation 4 below |
| `js/gossip.js` | **Dead.** The old abstract node-graph widget, kept but not referenced. (Confusingly reused as a filename mid-project for an early Project 01 gossip visual, later superseded by `shepherds.js`/`shepherds-sim.js` — current file content no longer matches either description, but it's still unreferenced either way) |

The scene/sim split is deliberate: scenes own SVG and never simulate, sims own
state and never touch the DOM except through the scene's published API.

## Simulation 1 — Tragedy of the commons (`#problem`)

6×6 pasture, grass level 0–5. Four shepherds down the left margin, 1–4 cows each
(slider). Per time step, each cow in random order:

- `f = grass/5`; `Q(eat) = (1 − energy) + 0.30·f`; `Q(move) = 0.75`
- `P(eat) = softmax` at temperature `0.08`, and **0 on a bare tile** (always moves)
- move = weighted pick among ≤4 neighbours, `weight = exp(2.5·f)` (greener pulls)
- then: energy −0.04; at 0 the cow starves and is removed
- then: each tile regrows one level with `p = 0.015 × (neighbours at level ≥ 3)`
  over the 8-neighbourhood — 12% interior, 7.5% edge, 4.5% corner

Run **ends** when the last cow starves; it pauses on that frame. Default is 4 cows
each (16 head), the fastest collapse.

Measured (6 runs each, 400 steps, driving the live sim headlessly): 1 cow each
holds at 89–97% grass indefinitely; 2 holds at 81–87%; 3 dies by step 213–328;
4 dies by 123–143.

**The carrying capacity is deliberately set at 2.5 cows per shepherd** — 2 is
comfortably under it and 3 is over. `regrowPerNeighbour` was raised from 0.011
to 0.015 to put it there (at 0.011, 2 cows only limped along at 44–78% grass,
which read as already-overgrazed). Sweeping total head with `setShepherdCount`
(`regrowBase: 0`, 10 seeds, 400 steps) pins it exactly: 8 head → 87% grass,
9 → 84%, **10 (= 2.5 each) → 80%, all surviving**, 11 → survives 8/10, 12 →
dies 0/10. Cumulative harvest over 600 steps peaks at the same place (10 head,
1207) and falls off a cliff above it (12 head, 542, whole herd dead). The rate
is a sharp knob: 0.016 already lets 3-each survive 4/10, which would cost
Simulation 1 its tragedy — don't nudge it without re-running that table.

**Non-obvious dynamics worth remembering:**
- Grass spreads only from grass, so *diffuse* grazing is more destructive than
  concentrated grazing — thin damage everywhere drops many tiles below the
  level-3 seeding threshold at once and kills regrowth globally.
- Because of that, adding `moveBias` (cows preferring green) made the pasture
  *healthier* at low herd sizes, not worse. Past ~3 the tragedy becomes less
  reliable again — the herd piles onto one patch and the rest regrows.

## Simulation 2 — Gossip (`#project-1`)

20 shepherds bounce around a box (screensaver-style, no inter-agent collisions).
Each holds an estimate per herd size (1–4 cows), initialised to its own fixed
private utility, and is coloured by its current top.

Every `0.56s` the closest two agents not on cooldown and within `90` units meet.
Each names its top option; both replace their estimate of that option with the
average. Bidirectional, so one interaction moves up to two options. Both then
cool down `2.6s ± 45%`.

Averaging conserves the total, so an option's estimate drifts to the population
**mean**, which ranks options exactly as total welfare does.

**Stops** when `min_i est_i(2) > max_i max_{k≠2} est_i(k)` — averages land
between their inputs, so once the ranges are disjoint the result can't be
overturned. Settles 8/8 in both populations: mixed ~61s median (109
interactions), neglect ~40s (72).

**Utility tables are FIXED literals** in `shepherds-sim.js`, not sampled — the
picture must be identical on every load. Generating shapes are documented above
each table.
- `MIXED_VIEWS`: favourites 5/5/6/4 — three cows leads the popular vote while
  two cows takes welfare 90.2 vs ~66. **Its row order is load-bearing for
  Project 03**, which reads the top pick of the first four rows as its greedy
  herd: they are ordered 4 / 4 / 3 / 2 cows = 13 head, more than the pasture
  can carry. Reordering rows is safe (the gossip scene places agents at random
  positions, and favourites/welfare are order-invariant — verified after the
  reorder: 5/5/6/4 and 90.2 vs 66.1 unchanged), but reordering *without*
  re-checking Project 03 is not.
- `NEGLECTED`: favourites 8/0/8/4 — two cows is **nobody's** first choice and
  still wins welfare 97.3 vs 74.3. Three camps that genuinely disagree.

**Non-obvious:** with *identical* cooldowns the population locked into 10
permanent couples (228 interactions, 10 distinct pairs) and stopped learning at
12/20. Cooldowns expire in the order they were set, so the first pair to free up
is often the only free pair and gets re-selected forever. `cooldownJitter` is
what fixes it — don't set it to 0.

## Simulation 3 — State-dependent norms (`#project-2`)

**Set aside, not deleted.** The visual on the live page is currently
`js/leader-emergence.js` (see Files table) — an experimental three-step
"opinion leader" animation — while this simulation is being tried as an
alternative. The markup, `js/norms.js`, and `js/norms-sim.js` are archived
intact at `archive/project2-norms-visual.html`, with restore instructions in
its header comment. Everything below still describes this simulation
correctly; it's just not what's currently on the page.

Two pastures stacked one above the other, same seed, same starting grass, same
weather. Only
the norm differs. Both run `pasture-model.js`, which is `commons-sim.js`'s rules
with the DOM taken out plus two additions: `regrowBase` (a seed bank) and
`setRegrowScale` (the season).

- state = the **season**, one of drought / dry / fair / wet, drawn uniformly
  every `seasonLength: 30` steps. It multiplies regrowth by `0.5 / 0.9 / 1.6 / 2.2`
- action = cows per shepherd, re-chosen only at a season boundary
- fixed norm → 2 always. adaptive norm → `[1, 2, 3, 4]` indexed by season
- destocking sheds the **lowest-energy** cows first
- run ends at `horizon: 600` steps and stops on a verdict

**The metric is not arbitrary.** A cow eats exactly what it burns
(`energyDrain / energyPerBite` = 0.2 levels per step), so cumulative grass eaten
*is* `0.2 x cow-steps sustained`. Always-2 sits at ~99% of its own ceiling
(8 cows x 600 steps x 0.2 = 960); the only way to beat it is to sustain more
cow-steps. That is why the chart is the right thing to plot.

Measured, 24 fresh runs to the horizon: adaptive ahead in **24/24**, median
**+29%**, range +8% to +50%. (Re-measured after `regrowPerNeighbour` went to
0.015 — at 0.011 this was 23/24, median +35%, with one drought-heavy loss where
destocking to 1 cow did not pay back inside 600 steps. The higher regrow rate
removed that loss.)

**Two findings worth not re-deriving:**

- **Collapse is absorbing, so a grass-keyed norm cannot work.** With
  `regrowBase: 0`, a flattened pasture has exactly zero regrowth forever. The
  first attempt keyed the norm on grass %, and *every* threshold set in a
  27-cell sweep came in **below** plain always-2 (best −3.5%, worst −69%): the
  opening 4-cow herd flattens the pasture before the rule can react, and no
  later destocking recovers it. The state worth conditioning on is the
  exogenous one that moves *first*. This is why the seasons exist.
- **The per-season optimum is close to, but no longer exactly, the best norm
  overall.** At `regrowPerNeighbour: 0.011` the sweep over all 256 season→herd
  maps put `[1,2,3,4]` **1st** (+91% over always-2 at a 1200-step horizon). At
  0.015 the whole map shifts up a herd size in the good seasons: sweeping herd
  size at fixed weather now gives best = 1 cow at scale 0.4–0.5, 2 at 0.6–1.0,
  3 at 1.3, **4 at 1.6+**, so with `seasonScale [0.5, 0.9, 1.6, 2.2]` the
  per-season optimum is `[1,2,4,4]`. Re-running the 256-map sweep (6 seeds,
  1200 steps) ranks `[2,2,4,4]` 1st (+42% over always-2), `[1,2,4,4]` 2nd
  (+39%), and the archived norm `[1,2,3,4]` **9th** (+27%) — still well ahead
  of always-2, which is all the archived visual claims. Overstocking still
  costs far more than understocking.
  (The "collapse is absorbing" finding above was measured at 0.011 and has not
  been re-run; the mechanism — `regrowBase: 0` makes a flat pasture dead for
  good — is unchanged.)

`pasture-model.js` reproduces `commons-sim.js` exactly — validated against the
simulation 1 balance table each time either changes. At `regrowPerNeighbour:
0.015` the model gives 1-each 89–95%, 2-each median 87%, 3-each dies ~243,
4-each dies ~118, against the live sim's 89–97% / 81–87% / 213–328 / 123–143.
If you change one, check the other still matches.

## Simulation 4 — Realistic dynamics behind Project 02 (`#project-3`)

Project 02's leader-emergence diagrams are a stylized demonstration; this is
the grounded version, framed around three reward types — personal utility,
emulation, prestige (see Project 02's write-up) — and two underlying modes,
**action** (playing a behavior of your own) and **participation** (copying
someone else's). Three 6x6 pastures run side by side, same seed and starting
grass each time (drawn fresh per run/restart, not a fixed literal — the
verdict text is computed from whichever of the three actually wins, so it
never claims an outcome that didn't happen), same grazing model as Simulation
1, only the herd-size policy differs:

- **Greedy** — shepherds 1-4 at `[4, 4, 3, 2]` cows, the actual top pick of
  the first four agents in Project 01's `MIXED_VIEWS` table (still computed
  rather than chosen — but the table is now *ordered* so that those four sum
  to 13 head, over the pasture's capacity of 10; see the `MIXED_VIEWS` note in
  Simulation 2). Nobody coordinates and nobody ever destocks by choice, so the
  herd starves out. **It then comes back**: once a shepherd has lost every cow
  and the empty pasture has regrown past that shepherd's own threshold, it
  turns its full herd out again — `restockAt: [0.5, 0.6, 0.7, 0.8]` handed out
  least-greedy-first, so 2 cows returns at 50% grass, 3 at 60%, and the two
  4-cow shepherds at 70% and 80%. The mapping is *derived from* `personalTop`
  at load (ties by index), not written down, so it follows the utility table if
  that changes. The result is a boom-bust cycle rather than one collapse: a
  typical 600-step run wipes out around step 250 and is back to full stock by
  step 590.
- **Fixed** — every shepherd fixed at 2 cows, forever. Project 02/03's
  recurring baseline norm.
- **Leader** — starts identical to Greedy. Shepherd 1 plays an adaptive rule
  from the start (`>= 70%` grass → 3 cows, else 2), re-checked every 20 steps;
  the other three start at their own personal top pick and switch, one by
  one, at steps 150 / 300 / 450, to mirror whatever shepherd 1 is currently
  doing (re-synced every reconsideration, not a one-time copy).

`regrowBase: 0.004` throughout (Project 02's seed-bank value — without it,
every policy eventually collapses to 0% grass over a 600-step horizon and the
comparison stops being interesting). Metric is the same cumulative
grass-eaten used in Simulation 3, read directly off `model.eaten` — **do not
rescale it** (an early prototype multiplied by 0.2 out of confusion with the
"0.2 grass levels per cow-step" identity below and got numbers 5x too small;
`model.eaten` is already in grass-levels, no conversion needed).

**A run is `horizon: 10000` steps** — about 4.5 minutes at the opening 8×
(`stepMs: 220`) — and then stops on its result, with play/pause turning back
into restart the way the other cards do. The line under the card is a live
standing rather than a verdict: it recomputes from `model.eaten` every step
and names who leads and by how much over the runner-up (`showStanding()`),
switching from "Step N — X leads" to "After 10,000 steps — X wins" at the end,
so it can never claim an outcome the pastures did not produce. It is not an
`aria-live` region — announcing a change every step would flood a screen
reader. `step()` returns early once `finished`, so a hand-driven call (console,
harness) cannot run past the end and leave the standing quoting a step that
never happened.

**The chart is a scrolling window, not the whole run.** It shows the last
`chartSpan: 500` steps: below 500 the axis is 0..500 and the lines grow into
it; past that the left edge is `step - 500` and the whole plot scrolls. That
also solves the memory problem for free — samples are pruned as they leave the
window (`prune()` in `js/dynamics.js`), so an endless run costs a fixed ~501
points at full per-step resolution, with no decimation. One sample from
*before* the left edge is kept so the lines reach it, and `px()` clamps it to
the axis. Verified at steps 100 / 499 / 501 / 900 / 5000 / 40000: left edge
tracks `step - 500` exactly and the point count stays at 501.

The plot itself stops at `CHART.right: 700` of 1190, not the full width — the
right third is a **stats block** (`SIDE`, `js/dynamics.js`) carrying the two
things neither the panels nor the chart show: each pasture's **harvest rate**,
computed in `drawChart()` as the slope of its own plotted line over the
visible window (`(last - first) / span * 100`, so it can never disagree with
what the reader sees), and its cumulative **starved** count, pushed from
`sync()` via `scene.setStarved()`. The rate doubles as a check on the model:
Fixed's 8 head reads exactly 160 per 100 steps, which is `8 x 0.2 x 100` — the
cow-eats-what-it-burns identity.

Line-end values sit **off** their own line rather than beside it: highest
above, lowest below, and the middle one on whichever side has the larger gap
to its neighbour (compared in *pixels*, since `py` grows downward). They are
right-anchored at the line's tip, so they stay inside the plot instead of
overhanging it as the old to-the-right placement did. The only clamp is the
lower one — an above-label is allowed to overhang the top axis, because a
series can sit right against the ceiling (peak/top reaches ~0.95 when the
`niceStep` ladder just barely rounds up) and clamping it back inside would
flip it *below* its own line, which is the one thing the rule exists to
prevent. Verified across 29 sampled frames of a 4,000-step run: the rule holds
on all of them; before the clamp was relaxed, one frame failed exactly that
way.

**The y-axis is still anchored at 0**, and the series are cumulative, so past
a few thousand steps the three lines are near-flat within a 500-step window —
separated vertically by their totals, which reads as the standings, but with
little slope and an empty lower third. Floating the baseline to the window's
minimum would fill the plot and turn it into a recent-*rate* chart; not done,
because it changes what the chart means. The ceiling is `3 * niceStep(peak/3)`
so the three grid lines read as round numbers instead of 1667 / 3333 / 5000.

**Measured (60 fresh seeds, at `regrowPerNeighbour: 0.015`, `personalTop:
[4,4,3,2]` and `greenThreshold: 0.7`; read at step 600, which is where the run
used to stop):**

| | harvest | outcome |
|---|---|---|
| Greedy | 779 | **herd wiped in 60/60 runs**, median step 252 (range 167–447), then restocks — 2.7 re-entries a run, pasture empty for 40% of all steps |
| Fixed | 968 | survives, 8 head, ~88% grass |
| Leader | 1355 | survives, 12 head, **0 cows starved in any run** |

Leader beats Fixed **60/60** (median **+40%**) and Greedy **60/60** (median
**+77%**). Both hold at a 1200-step horizon, where the greedy cycle has time
to run twice (6.4 re-entries, 26 cows starved, harvest 1466 against Leader's
2709 — median +86%) and the leader pasture still loses no cows at all. So the
leader's oscillation between 8 and 12 head is genuinely sustainable rather
than an artifact of the followers joining late, and greedy's re-entry rule
does not rescue it: restocking lifts greedy from 621 to 779 over 600 steps and
still leaves it below the plain fixed norm's 968.

**Getting Greedy to fail again took a table reorder, not a parameter.** At
`regrowPerNeighbour: 0.011` Greedy's old `[4,1,2,3]` collapsed on its own. At
0.015 that vector totals 10 head = exactly the new capacity, so Greedy
survived at 83% grass and harvested 1209 — the section lost its failure case.
Since the greedy herd is *computed* from the first four rows of
`MIXED_VIEWS`, the fix was to reorder those rows (see Simulation 2) so the
tops come out `[4,4,3,2]` = 13 head. 13 was picked over 12 deliberately: 12
head only wipes out in 53/60 runs and drags on to a median step 382, while 13
fails every time by step ~252 and dries the pasture to 2–6% grass before the
last cow goes. Nothing else about the population changed.

The greedy pasture then *regreens* over the back half of the run — 83–100%
grass at step 600 with no cows left. That is the model being honest (regrowth
resumes once nothing is eating), and it reads well: the commons only recovers
after the herd that ruined it is gone.

`greenThreshold` is 0.7, moved from 0.8. At the new capacity, 0.65 / 0.70 /
0.75 all win 60/60 against both rivals, but **only 0.70 gets through all 60
seeds at both horizons with zero starvation in the leader pasture** (0.65
loses 1.9 cows a run on average, 0.80 loses 1.7). 0.8 also drops to 59/60.

## Layout

Both sections use the same three-row grid: kicker (row 1), `<h2>` (row 2), prose
and card (row 3). Card widths derive from their contents so the drawing never
scales when padding changes:

```
--commons-card: calc(400px + rail + gap + 2*pad + 2px)   /* +2px = the card border */
--commons-col:  calc(card + 66px)                        /* 33px slack either side, so it centres */
```

Project 02's card is the same idea, with no rail. Its drawing is **480 wide on
purpose** — the same as Project 01's gossip box — so the two project cards come
out identically sized (526px) and their columns line up down the page:

```
--norms-card: calc(480px + 2*pad + 2px)     /* = --shepherds-card */
--norms-col:  calc(card + 66px)
```

The two pastures are **stacked vertically**, each with a label column down the
left holding its title, the four shepherds and three running totals
(grass / head / eaten). Play straddles the 38px gap between them so it plainly
drives both; fast forward and restart take the far corners of the pair. The "?"
sits in the card's top-right corner, the same as the pasture card's — it clears
the last weather chip by 18px. `.norms-verdict` holds `min-height: 2.8em`, two
lines, so the card is the same height before and after a run.

**Project 03 uses the same three-row grid as the others** (`.project3-layout`,
prose in a ~600px column with a card beside it) **but its simulation card
spans both columns**, because three pastures side by side need the whole page
width. The section originally had no right-hand column at all, which let the
prose run the full 1232px measure — **~171 characters a line against ~80
everywhere else**. Measure line length before judging a layout like this: the
missing card was the symptom, the unreadable measure was the defect.

The right column now holds `.policy-key`, which carries two blocks. First a
legend: the three policies with the chart's own `--opt-1..3` colours and the
same one-line descriptions the panels carry. Then **"What the chart
measures"**: one line naming the metric, and then the `js/eaten-metric.js`
diagram instead of a write-up. That is deliberate — the three paragraphs that
were there first (the cow-eats-what-it-burns identity, the cow-steps argument)
were cut as too much text, and the picture now carries it: one mouthful, one
`+1`, one tile a shade paler for good. **Do not put the paragraphs back
without asking.** The card is held to `--norms-card` so it lines up with
Projects 01 and 02's cards down the page.

`.policy-key-note` in the CSS is currently unused — the "Each runs one pasture
below…" line it styled was deleted from the markup by hand. Left in place in
case the line comes back.

The simulation card itself is sized from the container, not from a column:

```
--dynamics-card: calc(var(--max-width) - 48px)   /* = 1232px, .container's 24px padding each side */
```

The drawing inside is `card - 2*pad - 2px` = **1190 wide** (viewBox
`0 0 1190 620`), which is exactly the `dynamics-svg` viewBox width, so at full
size one user unit renders as one CSS pixel and the SVG's `font-size` values
*are* the rendered pixel sizes. They were raised to the other cards' scale
once the card widened — panel titles and stat values 16, subtitles / axis
labels 12, small labels 11, chart and side titles 13, line-end labels 12.5.
That is what forced `GRID_Y` from `PANEL_TOP + 58` to `+ 70` and `H` from 600
to 620: at 12px the panel subtitle ran into the shepherd row. That
is why widening it meant editing the layout constants in `js/dynamics.js`
(`TILE 26 -> 40`, `PANEL_W 220 -> 380`, `PANEL_X`, `CHART`, `COW_SCALE 0.32 ->
0.49`) rather than just letting a 720-wide viewBox scale up — scaling would
have blown the 9.5-12.5px labels up with everything else. Below 1280px the
canvas goes fluid (`width: 100%`) and the viewBox scales down; measured at 500
/ 760 / 900 / 1100 / 1440, no viewport overflows.

Its controls do **not** follow the other cards' corners: with the chart
filling the lower third of a 600-tall drawing, the bottom-right corner is
inside the plot. Fast forward and restart stack in the right-hand margin of
the third panel instead (`--corner-x: 96%`, `--ff-y: 5%`, `--restart-y: 15%`),
which is clear of that panel's grid — the grid ends at x 1110 of 1190.

All three of the *other* sections collapse to one column at the same
breakpoint, `900px`.

`--max-width: 1280px` is the page measure — *raising* it makes the side margins
smaller.

Project 01's card spans rows 2–3 (aligned to the heading, +12px). Its third row
**must stay `1fr`**: with all-auto rows a spanning item's height is split across
the rows it spans, so any change in the card's height shoved the prose down by
half that amount.

Controls are shared classes on a `.sim-canvas`, aimed per card with custom
properties (`--play-x`, `--corner-x`, `--ff-y`, `--restart-y`): `.sim-play-btn`,
`.sim-restart-btn`, `.sim-ff-btn`, plus `.sim-help-btn` / `.sim-help` for the
"?" popups. Both sims: start paused, pause visible only on canvas hover, restart
leaves the run paused, and fast-forward cycles 1× → 3× → 8×. **Simulations 1
and 2 open at 3×, Project 03 opens at 8×** (`let speed = N` plus the matching
`setSpeed(N)` at wire-up — both are needed, since the initial value stands if
the button is missing). The archived `norms-sim.js` still opens at 8×; it is
not on the page, so nothing was decided about it either way.

Help popups read their numbers out of `CONFIG` at open time (`data-cfg`,
`data-derived`), so the explanations can't drift from the models.

## Type floor in the cards

**Nothing inside a card renders below 15.2px (`0.95rem`).** That number is the
size of the taglines ("The pasture goes bare due to overgrazing") — and note
that it is *not* what `.commons-visual-tagline` declares: that rule says
`0.82rem`, but `.card p, .card ul { font-size: 0.95rem }` is (0,1,1) against
its (0,1,0) and wins. Several other card rules are shadowed the same way
(`.shepherds-visual-tagline`, `.shepherds-progress`, `.norms-verdict`,
`.dynamics-verdict`), so **read computed sizes, not declarations**, before
concluding anything about card type. The audit that found the real offenders
walks every leaf element under `.commons-visual, .shepherds-visual,
.leader-steps, .dynamics-visual` and reports `getComputedStyle(e).fontSize`
below the reference.

What actually had to move: `.commons-readout`, `.commons-stat-label`,
`.leader-step-label`, `.btn-chip`, `.sim-help-btn` (24px -> 26px circle to hold
the bigger glyph) and the `.sim-ff-btn` speed label, plus SVG text in
`js/commons.js` (9 -> 15.2), `js/shepherds.js` (10 / 11.5 / 14 -> 15.2) and
`js/dynamics.js` (11 / 12 / 12.5 / 13 / 14 -> 15.2; 16 kept as the emphasis
size). SVG `font-size` is in user units, and all four scenes render at scale
1.000 at full page width, so those numbers are literal pixels — verified by
comparing `getBoundingClientRect().width` to each viewBox width.

Knock-on geometry, all of it forced by the taller type: the gossip chart grew
`CH` 156 -> 176 (its two label rows would have been clipped), the dynamics
drawing grew `H` 620 -> **720** with `CHART.left` 58 -> 76 (six-digit y-labels
at 15.2px need the margin), and the dynamics fast-forward/restart buttons moved
from `--ff-y: 5%` to `18%` because the third panel's subtitle now reaches
almost to the panel's right edge and they sat on top of it. `js/norms.js` is
**not** updated — it is archived and not loaded, so its sizes could not be
checked against a rendered card.

**Project 03's vertical rhythm was re-cut after that.** At the bigger type the
bands were 1-4 units apart, ink to ink — measured, not guessed, by reading
every `text` bbox in the first panel's column and diffing consecutive extents.
Grid bottom to the stat value was **2**, value to its label **1**, the chart
title to the top gridline label **1**, the x-axis number to "time step" **2**.
Every gap is now 8-16 units (`GRID_Y: PANEL_TOP + 96`, `statsY: + 32` with the
label at `+ 26`, chart/side titles at `top - 28`, axis labels at `bottom + 22`
and `+ 50`, side rows on a 48 pitch), and `H` went 640 -> 720 to hold it. The
panel's accent rule also moved to `PANEL_TOP + 24`: at `+ 20` it sat 2 units
under the title's descenders and read as an underline rather than a marker.
Card padding went 18/16 -> 22/20 and `.dynamics-verdict`'s top margin 10 ->
18px to match. Re-measure the same way before changing any of it.

## Gotchas already paid for

- `* { margin: 0 }` in the reset also kills the `margin: auto` a modal `<dialog>`
  centres itself with — `.sim-help` sets it back explicitly.
- SVG elements with a CSS `transition` on `fill` must be **created with** their
  colour, or the first paint animates up from black (the pasture flashed dark).
- Same class of bug: an SVG element appended without coordinates renders at the
  origin for one frame. `placeLink()` positions links/halos at creation.
- The vertical slider is the horizontal one rotated −90°. A rotated element keeps
  its *unrotated* layout box, so it must be `position: absolute` or its 180px
  width drives the rail wide and squeezes the drawing.
- Chart palette: option colours are validated (see below). Teal and amber had to
  step down in dark mode — they were above the dark lightness band.
- **An undefined custom property is silent in light mode and black in dark
  mode.** `js/norms.js` used `var(--text-primary)` / `var(--text-secondary)`,
  which have never existed — the palette only has `--text` and `--text-muted`.
  An unresolved `var()` leaves SVG `fill` at its initial value, black, which
  looks close enough to `--text` (#16171a) on a light card to pass unnoticed
  and is invisible on a dark one. There is a one-liner to audit this: collect
  every `var(--x)` across `js/` and `css/`, diff against the names actually
  defined in `:root`. All 33 in use are defined as of now.
- **The single-column media queries did not actually work.** They reset the
  cards with `.problem-layout > * { grid-column: auto }` (specificity 0,1,0),
  but the base rules are `.problem-layout > .commons-visual` (0,2,0) — so
  `grid-column: 2` survived, created an *implicit* second column, and left the
  prose in a ~50px sliver with the card overflowing the viewport. Every child
  now has to be named explicitly in the media query. This affected all three
  sections and made the whole site unusable on a phone.
- Paired with that: a `1fr` track never shrinks below its content's min-content
  width, so the collapsed layouts use `minmax(0, 1fr)` and `min-width: 0`.
- The chart sampled every 3 steps while the stat readouts updated every step,
  so a paused frame showed 447 in one place and 446 in the other.
  `sampleEvery: 1` — 600 points is nothing for a polyline.
- Text in charts wears text tokens, never a series colour (the "welfare-optimal"
  annotation was in `--accent`, which collided with option 3's amber).

## Verifying changes

No node (see the top of this file), so: write a harness page into the scratch
dir that pulls the real card markup out of `index.html`, loads the real CSS/JS,
drives the sim, and writes results into a `<pre>`; then
`google-chrome --headless=new --dump-dom` and scrape it. Screenshots via
`--screenshot`. Model-only sweeps use the same trick with just
`js/pasture-model.js` loaded and no markup at all — that is how the balance
tables and the norm sweeps here were run, at a few thousand 600-step runs a
minute. Pass `--allow-file-access-from-files` so the `file://` scripts load.

Headless quirks that will mislead you:
- **`requestAnimationFrame` fires ~twice**, so animation loops never advance.
  Both sims expose a hand-drivable step (`commonsSim.tick(dt)`,
  `shepherdScene.advance(dt)`) — use those.
- **CSS transitions never advance**, so mid-transition colours get captured.
  Disable them in the harness (`transition: none !important`).
- **Minimum window width is 500px** — a smaller `--window-size` still lays out at
  500 and just crops the screenshot, which looks exactly like overflow.
- `.reveal` sections are `opacity: 0` until scrolled into view; force them
  visible in harnesses.

Palette validator (used for the chart colours):
`python3 /tmp/claude-1000/bundled-skills/*/dataviz/scripts/validate_palette.py "<hexes>" --mode dark --surface "#17171d"`

## Open threads

- The pasture card is aligned to its *first paragraph*; Project 01's is aligned to
  its *heading* +12px. Deliberate (asked for separately), but they don't match.
- Project 01's `separation()` stop is hardcoded to option 2. Generalising it to
  "some option's min beats every other option's max" was offered, not done.
- Card body text on `education.html` / `experience.html` has no line-length cap;
  bullets run ~140 characters at the current page width. Flagged, not fixed.
- All three sections say "(see right)" in the prose, but below 900px the card
  stacks *underneath*. Pre-existing in the first two; copied into the third.
- The pasture card and Project 02 both put "?" in the card's top-right corner;
  Project 01 keeps its "?" in the row of mode chips under the chart, because it
  was moved there by explicit request. Two of three match; left as is.
- The four herd colours live in `ShepherdSprite.HERDS` so the two pastures
  cannot drift. They stay at the light-mode `--opt-1..4` values in both themes
  on purpose — a shepherd's identity should not change with the lights. The
  gossip scene, by contrast, reads `--opt-N` live, because there the colour
  means "current favourite" rather than "which shepherd".
- Project 02's framing has moved on from state-dependent norms to three reward
  types — personal utility, emulation, prestige (an agent is always in exactly
  one mode, which determines which of the three it's currently earning).
  Reputation is a property of a *behavior* (how much welfare it generates for
  the group), not of an agent. Emulation reward is proportional to the
  reputation of the behavior copied; prestige reward is proportional to the
  total benefit conferred on followers. The three-step animation is the
  illustration: personal-utility-only agents (Step 1) discover a
  high-reputation behavior and switch to emulating it (Step 2), and the agent
  being copied switches to prestige mode and starts optimizing for its
  followers' benefit instead of its own — landing on the welfare-optimal norm,
  which then reaches everyone else through their emulation (Step 3). The
  `.section-head` prose and the `leaderStepsHelp` dialog (on the `.leader-steps`
  card's own "?", wired in `js/leader-emergence.js`) both describe this; keep
  them in sync if the reward model changes again.
- Project 02's card height vs. the prose length was flagged as a possible
  mismatch before the prose was rewritten; re-check once the reward-types
  framing settles.
