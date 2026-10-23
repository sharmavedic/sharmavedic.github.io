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
| `js/hero-frame.js` | The contact-page photo's **blob builders** — tiny blobs that build a frame around `assets/headshot.jpg`, close red curtains over the finished picture, and open them on the photo in colour with confetti. Autoplaying, no controls, no sim/scene split, like `leader-emergence.js`. Plays **exactly once**, the first time the photo scrolls into view — the `IntersectionObserver` disconnects itself right after, so leaving and returning does not replay it. The entire animation is a pure function of one number — `window.heroFrame.render(t)`, t in 0..1 — which is the only way to inspect a mid-build frame headlessly |
| `js/kinetic-sculpture.js` | Native WebGL satin-enamel factory. Overlapping batches enter every 20 seconds; the scene starts with work already in progress. Cubes flatten under the press, pass through an open chamber aperture, form into spheres and leave on a supported side chute. Seven workers load, operate, transfer, inspect, dispatch and recycle. Turn-then-walk tracks derive facing and stride from travel, with separate docking points and return aisles. Product positions share the rig's reachable grip targets. Accepted spheres leave on a trolley whose motion matches its driver; rejects visibly remould into cubes and return to the supply rack. Keeps cursor tilt, inspection, pause, reduced motion, visibility suspension and SVG fallback. `window.kineticSculpture.render(seconds)` supports frame checks; `.sample(seconds)` and `.layout` support motion/clearance checks in `tools/check-factory.py`. |
| `js/commons-lasso.js` | Simulation 1's own tiny blob — the hero photo's builder in a **cowboy hat**, **lassoing the herd-size slider**. Walks in horizontally from the right, stopping just above and a little right of the "1 cow each" label, throws a rope around the real `<input>` thumb, struggles to drag it down, calls in a second blob, and the pair wheeze, slump and leave (back the way they came) if nobody helps — but if the visitor actually drags the slider down themselves while the rope is on, both blobs celebrate and run off instead. Plays once, first scroll into view, same as `hero-frame.js`. Unlike every other decorative scene on the site it is **not** a pure `render(t)` function: its subject is a real form control whose screen position depends on live layout and can move under the visitor's own hand mid-animation, so it drives a small state machine off real elapsed time and recomputes the thumb's position every frame from `getBoundingClientRect()` — see the section below |
| `js/agents-truck.js` | The **"Building it into agents"** heading (`#agentsHeading`, the Problem section's third `<h3>`) arrives **towed behind a truck**. A blob drives in from off-screen with the real heading hitched to the truck's back, parks, hops out, unhooks it, hops back in and drives off, leaving the heading exactly where it always would have sat. Same blob family, own tokens, plays once — but unlike `commons-lasso.js`'s live form control, the heading's position is measured exactly **once**, before any transform is ever applied to it, and every frame after that only ever offsets from that captured value — see the section below for why that's safe here and wouldn't be for the slider |
| `js/eaten-metric.js` | The looping diagram in Project 03's `.policy-key` card — one tile, one cow, four phases on repeat: **arrive** (cow walks onto a full tile), **graze** (it eats; the tile fades and a `+1` counts the mouthful), **leave** (cow walks on off the other side), **regrow** (with nobody grazing, the tile eases back to full) — then it loops. Went through two earlier shapes first: a static 2x2 grid with a focus ring moving between frames, then a sliding single-lane filmstrip (Project 02 Step 1-style, one frame visible at a time). Both read as a diagram of four *states*; asked to look like one continuous thing happening to one tile instead, which this is — no grid, no clipping, no multiple frame groups, just one tile and one cow cycling through `render(phase, t)`. The cow is clipped to the tile (`metricCowClip`) so it can walk on/off from beyond the edge without rendering past the frame. Autoplaying, no controls, no sim/scene split, like `leader-emergence.js`, and draws the shared `CowSprite`. Exposes `window.eatenMetric.render(phase, t)` — with `requestAnimationFrame` stubbed, that is the only way to check a mid-animation frame headlessly |
| `js/dynamics.js` | Project 03 **scene** — three 6x6 pastures side by side plus a shared cumulative-harvest chart → `window.dynamicsScene`. Modelled on the archived `js/norms.js` (same panel/chart drawing approach) but widened to 3 columns and with the weather/season machinery dropped, since Project 03 runs on constant weather |
| `js/dynamics-sim.js` | Project 03 **driver** (the three herd-size policies + the play/pause/restart/ff/help loop) → `window.dynamicsSim`. See Simulation 4 below |
| `js/gossip.js` | **Dead.** The old abstract node-graph widget, kept but not referenced. (Confusingly reused as a filename mid-project for an early Project 01 gossip visual, later superseded by `shepherds.js`/`shepherds-sim.js` — current file content no longer matches either description, but it's still unreferenced either way) |

The scene/sim split is deliberate: scenes own SVG and never simulate, sims own
state and never touch the DOM except through the scene's published API.

The factory uses a pale-blue, slate and peach enamel palette, dimension-cached
rounded box meshes (constant physical bevels), subtle procedural surface grain,
warm studio highlights and blue ambient fill. The visible workshop deck and
floor markings were removed because they flickered; only the transparent shadow
catcher remains beneath the machinery. Shadows use a 25-tap filter; panel trim, vents and fasteners give the processor a manufactured
finish. Keep the box cache bounded: animated parcels deform one fixed-size mesh
rather than caching new dimensions every frame.

Factory motion is sampled independently of rendering. Batch ages, worker routes,
hand targets and machine timings share the same clock. Keep pickup/delivery poses
within the arm solver's reach, give turns clearance as well as straight walking,
and keep return routes out of the conveyor and sorting docks. The press supports
straddle the conveyor; the forming chamber and remoulder have hollow interiors.
Docking shelves leave room for boots; the sorting shelf uses a cantilever support.
The trolley is loaded from its side, then pushed from an end. Its return driver
walks facing the return direction. The front hatch stays open until the transfer
worker has withdrawn. The full worker choreography repeats every 40 seconds.
`python3 tools/check-factory.py` checks facing, worker spacing, fixture clearance,
reachable hands, product continuity, overlapping work, WebGL and mobile overflow.
It needs Playwright and local Chrome; `--screenshots /tmp/factory-review` captures
review frames without adding image artifacts to the repository.

The home factory's camera follows mouse/pen position across the hero, with
bounded yaw/pitch and frame-rate-independent easing. A radial arctangent curve
increases sensitivity around 75% of the viewport width and 50% of its height
(the right half's center), and tapers it toward the edges.
Leaving the hero or
blurring the window returns it to its original angle. Camera motion still
works while the mechanism is paused; touch and reduced motion disable it.

Temporary **Inspect models** controls on the home factory enable cursor-anchored
wheel zoom (up to 12×), pointer/touch drag to pan, and +/−/Reset buttons.
Inspection removes the text mask and freezes cursor tilt. The animation's pause
button still works independently. On the focused canvas, +/− zoom, arrow keys
pan, 0 resets, and Escape exits; exiting restores the normal home view.

The astronauts' arms use shoulder/elbow/wrist bones with geometry-derived skin weights.
Each glove follows its wrist as one rigid shape; holding poses solve for palm
positions around the parcel, keep the palms parallel and facing inward, and place
the thumbs on top of the grip. At rest, palms face the thighs, fingers hang down,
and thumbs face forward. Only the shoulder region blends into the torso.
The arm solver targets the wrist joint; glove rotations pivot at the cuff,
with the desired palm position converted to a wrist target for carrying.
Elbows favor a downward bend with modest outward clearance, keeping upper arms
closer to the torso while preserving the wrist targets and hand orientation.
Standing/walking use a separate relaxed pose with upper arms about 7° from
vertical and hands beside the hips; gestures blend out of that pose smoothly.
Resting, carrying, and raised poses share one fixed shoulder anchor. Gestures
interpolate wrist targets and solve the joints, never interpolate bone matrices.
The shader uses dual-quaternion skinning to preserve sleeve volume through
twists; `packBone` stores real/dual quaternions in the first two columns of each
bone uniform. Tapered forearms and fitted cuffs avoid inflated segment joins.
Do not translate glove
vertices independently or use broad X/Y masks for arm weights: those stretched
the thumbs, pinched the sleeves, and also moved the outer edges of the boots.

## Simulation 1 — Tragedy of the commons (`#problem`)

6×6 pasture, grass level 0–5. Four shepherds down the left margin, 1–4 cows each
(slider). Per time step, each cow in random order:

- `f = grass/5`; `Q(eat) = (1 − energy) + 0.30·f`; `Q(move) = 0.75`
- `P(eat) = softmax` at temperature `0.08`, and **0 on a bare tile** (always moves)
- move = weighted pick among ≤4 neighbours, `weight = exp(2.5·f)` (greener pulls)
- then: energy −0.04; at 0 the cow starves and is removed
- then: each tile regrows one level with `p = 0.012 × (neighbours at level ≥ 3)`
  over the 8-neighbourhood — 9.6% interior, 6% edge, 3.6% corner

Run **ends** when the last cow starves; it pauses on that frame. Default is 4 cows
each (16 head), the fastest collapse.

Measured (6 runs each, 400 steps, driving the live sim headlessly): 1 cow each
survives 6/6; **2 each survives 6/6**; 3 each dies by step 157–227; 4 dies by
92–117.

**The death is permanent, and the tagline says so.** Simulation 1 has no
`regrowBase`, so grass only ever spreads *from* grass — once every tile is
under `highGrass: 3` there is no seed left anywhere and regrowth is exactly
zero, forever. Measured at the default 16 head over 30 seeds: the herd is wiped
at median step 133, leaving median **0% grass and 0 of 36 tiles** at or above
the threshold; letting each dead pasture then sit for **20,000 further steps
with no cows on it at all, 0/30 recovered a single level**. This is the
Simulation 1 counterpart of the "collapse is absorbing" finding in Simulation 3
(which was measured on `pasture-model.js` at 0.011) — same mechanism, now
confirmed on the live sim (measured at 0.015, unchanged in kind at 0.012 —
the mechanism is `regrowBase: 0`, not the rate). Note Project 03's greedy
pasture carries a small seed bank (`regrowBase: 0.001`), so it *can* regreen
after its herd dies where Simulation 1's never can — but at that rate it does
not get far inside a 500-step run, ending around 13-43% grass with no cows.
Same mechanism, different setting, no contradiction.

That measurement is what picks the tagline word. It reads "The pasture goes
**barren** due to overgrazing": *barren* means incapable of producing, which is
exactly the absorbing state, and it is land vocabulary rather than organism
vocabulary. Rejected along the way — "goes bare" (sounds like something a
season fixes), "dies" (accurate, but suits an organism more than a place), and
"withers", which is the tempting one and the wrong one: withering is *drying
out*, with the plant still present and shrivelled, whereas here the grass is
eaten away to bare earth (`--grass-bare` is literally commented "bare earth").
Keep drought vocabulary reserved for Project 03, which actually has drought
seasons; the pasture card's failure is consumption, not weather.

**The carrying capacity is deliberately set at exactly 2 cows per shepherd**,
and `regrowPerNeighbour` is **0.012** to put it there. This is load-bearing for
the whole site: Project 01's utility tables call two cows welfare-optimal, and
Project 03 now *labels* its two-cow pasture "Optimal". If the pasture could
actually carry more than 2, that label would be a lie and the section would
invite exactly the question it is meant to answer — "why not just let each
shepherd adapt to the grass?".

Swept over rate x head (8 seeds, 600 steps, `setShepherdCount`, harvest =
`model.eaten`), the peak sits where the largest reliably-surviving herd is:

| rate | peak at `regrowBase: 0` | peak at `regrowBase: 0.004` |
|---|---|---|
| 0.011 | 8 head | 8 head, but wipes out in >=1 of 8 seeds |
| **0.012** | **8 head, ~95% surviving (38/40), ~78% grass** | **8 head, 83% grass** |
| 0.013 | 9 head | 9 head |
| 0.015 (old) | 11 head | 11 head |

At 0.012 the cliff is immediately above 8: 9 head survives only **13/40**
(`regrowBase: 0`) and 10 head **0/20**. Note 8 head is ~95%, not 100% — an
earlier note here said 20/20, which was a 20-seed sample of the same ~95%
band, not a real difference. It reads the same on the page either way, but do
not treat a single wipeout at 2-each as a regression. 9 head does post a higher raw harvest
in the runs where it lives, which is the honest shape of overshoot — it pays
right up until it kills the herd — but it is not a herd size anyone would
choose, and no *uniform* norm reaches it anyway (a norm everyone plays gives
4/8/12/16 head, never 9).

The rate is a sharp knob in both directions: 0.013 moves the optimum to 9 and
0.011 makes 8 itself unsafe. **Do not nudge it without re-running that sweep
and the Simulation 4 table below** — the "Optimal" label depends on it.

**Pastures do not open full.** A pasture that opens perfect reads as pristine
rather than as a going concern, and hands every policy a free buffer before
its choices start to matter. There is a symmetric one-level jitter so the grid
is not a flat block of one colour, which costs the mean nothing.

**The two cards are deliberately on different openings now:**

| | opens at | set in |
|---|---|---|
| Simulation 1 (`#problem`) | **80%** | `resetGrass` in `js/commons-sim.js` (it does not use the model) |
| Project 03's three pastures | **60%** | `startGrass` in **`js/dynamics-sim.js`**'s own `CONFIG`, passed into `create()` |

Project 03 opens at **0.60**, below the ~73% its Optimal herd sustains, so that
card's Optimal pasture climbs over its first ~80 steps and then holds. It ran
briefly at 0.73 — exactly the equilibrium, giving a flat Optimal line from step
0 — and was moved down by request; see "The opening" in Simulation 4 for what
that trades. Note the opening is also no longer taken from
`js/pasture-model.js`'s `DEFAULTS` (still 0.7 there, which now only affects the
archived Project 02 visual); Project 03 passes its own.
Simulation 1 was **left at 0.8 on
purpose**: measured over 40 seeds at 600 steps with no seed bank, its
2-cows-each herd survives **35/40 at a 0.7 opening against 38/40 at 0.8**, and
that card's whole claim is that two cows each is the size the pasture carries.
Paying 3 seeds off the headline balance for an opening nobody is comparing
across sections is a bad trade. If the two are ever unified, re-run Simulation
1's balance table first.

**Opening lower does not deepen a collapse.** This is the counter-intuitive
part and it is measured: the level a grazed-out pasture can still climb back
from is a property of the model (~40% with four head on it, see the recovery
table in Simulation 4), not of where it started. So a lower opening only
shortens the fall into that floor — Project 03's Leader dip went from
80%→46% (a 34-point fall) to 70%→50% (a 20-point fall) — while costing the
buffer that keeps the overshoot safe, which is why `recoverBelow` had to rise
from 0.52 to 0.55. If the goal is a more dramatic collapse, a *higher* opening
is the lever, not a lower one. The excursion up to 0.82 bore this out from the
other side: the dip stayed ~51% (it is pinned by `recoverBelow`) and only the
fall into it got longer.

**The trap this exposed:** `pasture-model.js` initialised grass in *two*
places — `create()` and `seed()` — and `seed()` carried its own hardcoded fill
(30% of tiles one level down, ~94%). Project 03 seeds all three of its
pastures after creating them, so `startGrass` looked applied and silently was
not; the live card still opened at 93% while every harness measured 80%. Both
now call the same `startingLevel()`. **If you add another way to reset the
grid, route it through that helper.**

Knock-on: the lower opening cost Project 03's leader its buffer. That was
handled with a faster `switchAt` at the time; the schedule has since been
replaced entirely by crisis-driven following — see Simulation 4.

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
never claims an outcome that didn't happen). The grazing *rules* are Simulation
1's, but **the regrowth is tuned differently here** (`regrowPerNeighbour:
0.0092`, `highGrass: 2` against Simulation 1's 0.012 / 3) — see "Why this card
does not share Simulation 1's regrowth" below. Only the herd-size policy
differs between the three pastures:

- **Greedy** — shepherds 1-4 at `[4, 4, 3, 2]` cows, the actual top pick of
  the first four agents in Project 01's `MIXED_VIEWS` table (still computed
  rather than chosen — but the table is now *ordered* so that those four sum
  to 13 head, over the pasture's capacity of 10; see the `MIXED_VIEWS` note in
  Simulation 2). Nobody coordinates and nobody ever destocks by choice, so the
  herd starves out — in **200/200** runs, at a median step **108**.

  **It can come back, and at the current seed-bank rate it mostly doesn't.**
  The restocking rule is still there and still correct: once a shepherd has
  lost every cow and the empty pasture has regrown past that shepherd's own
  threshold, it turns its full herd out again — `restockAt: [0.5, 0.6, 0.7,
  0.8]` handed out least-greedy-first, so 2 cows returns at 50% grass, 3 at
  60%, and the two 4-cow shepherds at 70% and 80%. The mapping is *derived
  from* `personalTop` at load (ties by index), not written down, so it follows
  the utility table if that changes.

  What changed is the rate it feeds on. At `regrowBase: 0.004` this produced a
  genuine boom-bust cycle — wipe out around step 250, back to full stock by
  step 590 — and that was the described behaviour for a long time. At the
  current **0.001** the grass does not climb back fast enough to reach even the
  lowest threshold inside 500 steps: the shipped run ends at **13% grass with 0
  head**. So the card now shows a collapse that stays collapsed, chosen
  deliberately (see the `regrowBase` sweep below) over the recovery reading.
  The restock path is not dead code — it still fires in the tail of runs that
  regreen faster — but it is no longer what a typical run looks like, and any
  copy or caption describing Greedy as cycling is now wrong.
- **Optimal** — every shepherd at 2 cows, forever. Was called *Fixed* and
  framed as a baseline; it is now named for what it is, the welfare-optimal
  norm and the most the pasture carries indefinitely (see Simulation 1's
  capacity sweep). **Its chart line is dashed** (`OPTIMAL_SLOT = 2` in
  `js/dynamics.js`, and the legend swatch in `index.html` uses
  `.policy-key-rule--dashed`), because it is the target the other two are read
  against rather than a third competitor. **It sits last in the row**, for the
  same reason — a target belongs at the end of the sequence, not in the middle
  of it. The on-screen order is therefore **Greedy, Leader, Optimal**, and that
  order is the single source of truth: `LABELS`, the `models` array, the
  `makePanel` calls, the side-stats names, the standing's tally string and the
  legend in `index.html` all follow it, and `models[1]` is the leader pasture.
  Reordering means moving all of them together — `leaderModel = models[1]` is
  the one that fails silently if missed, since the sim would happily drive the
  wrong pasture. Series colour follows *slot*, not policy, so the swap also
  moved Optimal from teal (`--opt-2`) to amber (`--opt-3`) and Leader the other
  way; the legend's inline `var(--opt-N)` values have to be moved to match. The rename was asked for precisely
  so the section stops inviting "why can't each shepherd just adapt to the
  grass?" — at capacity 2 there is nothing for adapting to find.
- **Leader** — opens *identically* to Greedy: all four shepherds on their own
  personal top pick, 13 head against a capacity of 8. Shepherd 1 knows the
  welfare-optimal norm and drops to 2 at its first reconsideration, but one
  shepherd destocking barely slows the collapse. The other three follow it
  only once the pasture has visibly failed, then one at a time `joinEvery: 5`
  steps apart, mirroring whatever shepherd 1 is currently doing (re-synced
  every reconsideration, not a one-time copy).

  **Leader finishes below Optimal, and that is the point.** By the time the
  followers arrive the pasture is grazed down to around 50%. The leader's
  first instruction is therefore a repair, not the norm: once grass falls
  under `recoverBelow: 0.50` it calls for `leanCows: 1`, and holds there until
  the grass is back to `recoverUntil: 0.80` — just under the measured ~82%
  equilibrium for eight head — then returns to 2 for good. So the red marker
  lands on a **state**: the leader hands the norm back once it has restored the
  commons to roughly what the norm can sustain. There is no `minRepairSteps`
  floor any more — it is **0**, and the grass threshold is the whole rule. The
  harvest given up
  during the repair is never won back, so the two lines run parallel
  afterwards, permanently apart. Adapting to the grass is what the damage
  *costs* here; it is not a way to beat the norm. That is what makes the
  section answer "why can't each shepherd just adapt to the grass?" instead of
  inviting it.

  **Followers are triggered by the pasture, not by a clock** (`joinEvery` +
  `leanFired`, replacing a `switchAt: {1:60, 2:120, 3:180}` schedule). This is
  the one to understand before touching any of it, because a clock *cannot* be
  made to work here: depletion speed varies by seed, so a fixed schedule is
  never in the right place twice. Measured — at 60/120/180 the herd destocked
  before the grass fell far (pasture bottomed at a median **65%**, and the
  repair never fired at all in 6 of 24 runs, leaving Leader level with
  Optimal); every slower schedule tried (90/180/270, 120/240/360, 180/360/540,
  250/500/750) bought only a few points of extra median depth and paid with a
  **1-in-5** chance of tipping the pasture into the absorbing 0% state, which
  costs ~3,400 starved cows and a **-88%** finish. Triggering on the pasture
  pins the depth to `recoverBelow` instead of to the dice.

  **The recoverable floor depends on how many cows are still eating, and that
  is what sets every number here.** Re-measured under the current tuning
  (`regrowPerNeighbour: 0.0092`, `highGrass: 2`, `regrowBase: 0.001`) by grazing
  13 head down to a target, destocking, and giving the pasture 2,000 steps —
  16 seeds per cell, "recovered" = back to 70%:

  | grass at destock | **4 head** (1 each) recovers / herd dies | **8 head** (2 each) recovers / herd dies |
  |---|---|---|
  | 60% | 16/16 / 0 | 13/16 / 1 |
  | 55% | 16/16 / 0 | 12/16 / 5 |
  | 50% | 16/16 / 0 | 15/16 / **11** |
  | 45% | 16/16 / 0 | 16/16 / 15 |
  | 40% | 16/16 / 0 | 16/16 / 15 |
  | 35% | 16/16 / **0** | 16/16 / 16 |
  | 30% | 16/16 / **3** | 16/16 / 16 |
  | 25% | 16/16 / **11** | 16/16 / 16 |

  **The binding constraint is the herd, not the field** — and that inverts the
  old reading of this table. At one cow each the *pasture* climbs back to 70%
  from every level tested, down to 20%: four head barely touch it and
  `highGrass: 2` means thin grass still seeds. What fails is the cows, who start
  starving at 30% and are mostly gone by 25%. So the rule is **destock before
  the pasture reaches ~35%**, with everything above that safe for the field.
  The 8-head column is why the followers go to *one* cow on joining rather than
  straight to the norm: at two cows each the herd dies from 50% down.

  Three further design points, all measured, all easy to get wrong:
  - **The repair fires at most once a run** (`leanFired` in
    `js/dynamics-sim.js`). A re-triggerable threshold does not converge, it
    flaps: the steady state is ~83% grass, so any threshold near it has the
    leader oscillating between 1 and 2 cows forever. That variant measured 10%
    below Optimal but never settled, which reads as a broken policy rather than
    a learned one.
  - **The repair is a ladder, not a single destock** (`repairLadder: [7, 6, 5,
    4]`, `rungSteps: 20`). Once all three followers have joined, the leader
    walks the *whole pasture* down one rung every 20 steps and holds the bottom
    rung until the grass is back to `recoverUntil: 0.60`, then the norm. Asked
    for as "make the recovery slowly by changing it to 7 heads or 6 heads
    eventually bringing it to 4 heads until the 60% is reached then go to 8".

    Two measured facts bound it, and both were arrived at the hard way:

    * **The decline cannot be done at 8 head.** Eight head is the carrying
      capacity, so from a 60% opening it *climbs* to 71% rather than falling —
      measured 16 seeds over 300 steps: 6 head → 83%, 7 → 78%, 8 → 71%, none
      of them ever reaching 40%. Only 10+ head draw the pasture down, and 10-13
      head wipe out their own herd every time. So the fall from 60% to ~40% is
      done by the greedy opening herd, and the ladder is purely the way back.
      "Hold ~8 head while the pasture declines" is not a tuning problem, it is
      arithmetic.
    * **The top rungs are lethal if the ladder sits on them.** Held on a
      pasture grazed to 40% for 400 steps (16 seeds), reaching 60% again: 4
      head 16/16 with 0 deaths, 5 head 16/16 / 0, 6 head 12/16 / **3 deaths**,
      7 head 4/16 / **12 deaths**, 8 head 2/16 / **16**. The ladder may pass
      through 7 and 6; it may not linger. `rungSteps: 20` is what keeps the
      descent brisk enough.

    **`recoverBelow: 0.50` is the depletion knob** — the followers stay greedy
    until it trips, so lowering it means a longer greedy phase and a deeper
    trough. Measured across 24 seeds, trough and the step the pasture is back
    over 70%: 0.64 → 59% / step 36; 0.58 → 55% / 54; **0.50 → 46% / 119**;
    0.46 → 42% but worst-case 33%; 0.42 → 37% / worst 29%, which is where herds
    start dying.

    **The ladder costs robustness, and that is the open risk in this card.** A
    gentler destock leaves more cows eating, so the repair is cheaper and the
    Leader/Optimal gap narrows: measured over 64 random seeds, Leader finishes
    a median **−1.0%** and is below Optimal in only **41/64**, against −6.1%
    and 62/64 with the old single destock. There is also a tail where the
    pasture goes over the edge — **2/64** leader herds die and 2/64 Optimal
    herds do. `fixedSeed` is what keeps the shipped run clear of all of it, but
    **this configuration is materially more fragile than the one it replaced**,
    and unfixing the seed is no longer safe without re-tuning.
  - **`watchEvery: 5` is not `reconsiderEvery: 20`.** The leader *looks* every
    5 steps and *acts* every 20. They have to be separate: at the greedy
    opening of 13 head the pasture loses roughly **one percentage point of
    grass per step**, so a 20-step blind spot lets it fall 20 points past the
    level the leader meant to act at — which, against the table above, is the
    difference between a recoverable pasture and a dead one. This single change
    is what took the repair from firing in 9-15 of 24 runs to **24/24**.

  **Why this card does not share Simulation 1's regrowth.** Project 03 runs
  `regrowPerNeighbour: 0.0092` and `highGrass: 2`, against Simulation 1's 0.012
  and 3. This is the most consequential thing in the section and it was arrived
  at by being wrong twice, so the reasoning matters.

  *The symptom.* With Simulation 1's numbers, the Optimal pasture (8 head)
  settles at **82%** grass and stays there. On a card that opens lower, you
  watch it *climb* — and that is a tell, not a cosmetic issue: a pasture that
  accumulates grass under a herd is not being grazed at capacity, so two cows a
  shepherd would not actually be the welfare-optimal norm, and the "Optimal"
  label would be a lie. Measured at 0.012 / highGrass 3, 2,000 steps, 16 seeds:
  8 head harvests **3208** and survives 15/16; 9 head harvests 1077 and
  survives **0/16**.

  *Why that looks contradictory and isn't.* The old model is **bistable**:
  regrowth is proportional to green *neighbours* above `highGrass`, so a thinned
  pasture loses its own seed stock and crashes. There is a stable state near 82%
  and a collapse basin, with nothing in between — a ninth cow does not settle
  the pasture at 70%, it tips the whole thing to zero. So 8 head genuinely was
  the largest sustainable herd, while *also* leaving the pasture visibly
  un-grazed. Both readings were true at once.

  *The fix is `highGrass`, not the rate.* Dropping the seeding threshold from 3
  to 2 lets thin grass still seed its neighbours, which replaces the cliff with
  a **graded** response — the steady grass level now falls as the herd grows
  instead of jumping to collapse. Measured at 0.012 / highGrass 2: 8 head →
  83%, 9 → 80%, 10 → 76%, 11 → 71% (8/16), 12 → dies. That is a pasture that
  can be held at an intermediate level, which is what the card needs; it also
  moved capacity to 10 head, so the rate had to come down to put the optimum
  back at 8. Measured, 24 seeds, 2,000 steps, `highGrass: 2`:

  | `regrowPerNeighbour` | 8 head | 9 head | 10 head |
  |---|---|---|---|
  | 0.0090 | 22/24 @ 72% | 0/24 | 0/24 |
  | **0.0092** | **24/24 @ 73%** | **0/24** | **0/24** |
  | 0.0095 | 24/24 @ 75% | 3/24 | 0/24 |
  | 0.0098 | 24/24 @ 77% | 13/24 | 0/24 |
  | 0.0100 | 24/24 @ 78% | 20/24 | 0/24 |

  **0.0092 is the point where two cows a shepherd is unambiguously the largest
  sustainable herd *and* sits on a visibly grazed pasture (73%).** Nine head
  dies in 24 of 24 runs. `startGrass` is then set to that same 73% so Optimal
  opens at its own steady state and the line is flat. **The three numbers move
  together** — change the rate and you must re-measure the equilibrium and reset
  both `startGrass` and `recoverUntil`.

  *What this costs:* Project 03's dynamics are no longer numerically identical
  to Simulation 1's, so the help dialog no longer claims they are (it says the
  rules are the same and the regrowth is tuned differently). Simulation 1 was
  deliberately **not** changed to match: its own balance table, the 2-cow
  carrying capacity behind Project 01's utility tables, and the "collapse is
  absorbing" finding all rest on 0.012 / highGrass 3 / `regrowBase: 0`, and
  re-running all of that is a separate job. **If the two are ever unified, do it
  from Simulation 1's side and re-run its balance table first.**

  **The one thing no parameter fixes: Leader is ahead early.** It opens with 13
  head against Optimal's 8 on an identical pasture, so it out-harvests Optimal
  until the damage bites — that is arithmetic. What the tuning controls is how
  long that lasts and whether it is ever repaid. The repair thresholds were
  gridded for exactly this (24 seeds, measured at the 0.73 opening; the
  numbers shift a little at the 0.60 opening but the ranking does not):

  | `recoverBelow` / `recoverUntil` | Leader final | below Optimal | ahead for | norm lands |
  |---|---|---|---|---|
  | 0.55 / 0.73 | −0.1% | 13/24 | 128 steps | 121 |
  | 0.60 / 0.80 | −2.5% | 21/24 | 57 steps | 101 |
  | 0.64 / 0.80 | −2.7% | 24/24 | 47 steps | 81 |
  | **0.50 / 0.80** | **−3.0%** | **59/64** | **135 steps** | **181** |

  **0.50 / 0.80 is shipped.** 0.64 was briefly used, as the only cell below
  Optimal in *every* seed, but its dip was shallow (59%) and the pasture was
  back over 70% by step 36 — the collapse barely registered. Deepening it to
  0.50 costs a little certainty (59/64 rather than 24/24, recovered by the
  fixed seed) and lengthens the early lead to ~135 steps, in exchange for a
  trough of 46% and a recovery that takes until step 119. Note `recoverUntil:
  0.80` sits *above* the 73% steady state — with only four head on it the
  pasture overshoots, and waiting for that overshoot is part of what makes the
  repair cost anything.

  **`fixedSeed: 836700000`** then turns 62/64 into certainty. It is the pick of
  700 candidates: Optimal opens at 60% — the configured value — and settles at
  71% inside a 55-75% band without wiping out; the Leader pasture is run down to
  43% by step 21, is not back over 70% until step 80, and reaches the norm at
  step 121; its herd never falls below its four destocked head; it is ahead of
  Optimal only over steps 0-42 and finishes −7.0%; Greedy's herd is gone by step
  88 and its pasture ends at 6%.

  The historical version of this constraint, kept because it explains the
  shape of the code: at the old 10,000-step horizon the gap between Leader and
  Optimal genuinely *was* the length of the repair, at about 1% of final
  harvest per 200 steps, so `minRepairSteps` existed to buy that gap. Measured
  then, 24 seeds at the full horizon:

  | repair length | red line lands | Leader vs Optimal | below Optimal |
  |---|---|---|---|
  | grass rule only (~100) | step 200 | −0.09% | **15/24** |
  | +200 hold | step 300 | −0.6% | 24/24 |
  | +400 hold | step 500 | −1.8% | 24/24 |
  | +1200 hold | step 1300 | −5.6% | 24/24 |

  `minRepairSteps` is kept in `CONFIG` at 0 rather than deleted, because that
  is the knob a longer horizon would need back.

**Eight head sits at ~73% grass under this card's tuning**, and that number is
measured, not chosen: see "Why this card does not share Simulation 1's
regrowth" above for how `regrowPerNeighbour: 0.0092` / `highGrass: 2` was
arrived at and why `startGrass` and `recoverUntil` are positioned against it.
The short version: at that tuning 8 head survives 24/24 and holds the pasture
at 73%, 9 head dies 24/24, so two cows a shepherd is the largest sustainable
herd *and* the pasture visibly shows the grazing.

`startGrass`, `regrowPerNeighbour` and `highGrass` are all passed into
`PastureModel.create()` from Project 03's own `CONFIG` rather than inherited
from the model's `DEFAULTS`, specifically so this card can be tuned without
touching Simulation 1's balance table or the archived Project 02 visual. Do not
simplify them back out.

Note the realised opening is a **draw**, not `startGrass` itself: the grid
carries a one-level jitter, so a given seed can open a few points off the
configured mean (the shipped seed opens 72% against a configured 0.73). There
is no systematic bias, but it is why `fixedSeed` is picked on its *measured*
behaviour rather than trusted to the config.

`regrowBase: 0.001` throughout — a seed bank is needed at all because without
one every policy eventually collapses to 0% grass and the comparison stops
being interesting. It sat at Project 02's own 0.004 and was walked down from
there in stages by request, so it is **no longer the same number as Project
02's** and should not be re-synced to it by tidying.

**The sweep that set it was run under the old regrowth tuning** (0.012 /
`highGrass: 3`), where the binding constraint was Optimal's own wipeout rate —
flat at ~3% down to 0.002, then 7% at 0.001 and 14.5% at 0, which is a card
that shows a dead pasture labelled "Optimal" about one run in seven:

| `regrowBase` (at 0.012 / highGrass 3) | Optimal wiped | Greedy final grass |
|---|---|---|
| 0.004 | 4/200 (2%) | 67% |
| 0.003 | 7/200 (3.5%) | 63% |
| 0.002 | 6/200 (3%) | 34% |
| 0.001 | 14/200 (7%) | 9% |
| 0 | 29/200 (14.5%) | 0% |

**Under the current tuning that constraint is gone**, which is what allowed the
drop to 0.001. With `highGrass: 2` the pasture is no longer bistable, so
Optimal does not tip into collapse: measured 24 seeds at 0.0092 / highGrass 2,
Optimal wiped **0/24** at every seed-bank rate from 0.002 down to 0. What the
rate now controls is purely the *greedy* pasture's ending — 0.002 lets it
regreen to 64% and restock to 9 head, 0.001 leaves it at 43% with no cows, and
0 leaves it at 0%. 0.001 is the setting that keeps the herd dead (the bleaker
read, chosen earlier) while leaving Optimal's line the flattest of the three.

Note this is a *different knob* from `regrowPerNeighbour` (0.012, in
`js/pasture-model.js`), which is shared with Simulation 1 and sets the
carrying capacity the whole site's "Optimal" label depends on. `regrowBase` is
spontaneous regrowth on a bare tile and is Project 03's alone; changing it does
not touch the capacity sweep. Do not confuse them.

Metric is the same cumulative
grass-eaten used in Simulation 3, read directly off `model.eaten` — **do not
rescale it** (an early prototype multiplied by 0.2 out of confusion with the
"0.2 grass levels per cow-step" identity below and got numbers 5x too small;
`model.eaten` is already in grass-levels, no conversion needed).

**A run is `horizon: 500` steps** — about 37s at the opening 3× (`stepMs: 220`)
— and then stops on its result, with play/pause turning back into restart the
way the other cards do. It was `10000` steps at 8× (~4.5 minutes) until both
were cut by request; the whole run now fits the chart's 500-step window, so the
collapse, the repair, the red marker and the finish are all readable in one
frame without waiting. The line under the card is a live
standing rather than a verdict: it recomputes from `model.eaten` every step
and names who leads and by how much over the runner-up (`showStanding()`),
switching from "Step N — X leads" to "After 500 steps — X wins" at the end,
so it can never claim an outcome the pastures did not produce. It is not an
`aria-live` region — announcing a change every step would flood a screen
reader. `step()` returns early once `finished`, so a hand-driven call (console,
harness) cannot run past the end and leave the standing quoting a step that
never happened.

**A red dashed vertical marks the step the Leader pasture settled on the
welfare-optimal norm** — every shepherd on 2 cows — captioned "Leader reaches
the optimal norm". The word *optimal* is load-bearing: the pasture passes
through another whole-herd setting on the way (everyone on one cow during the
repair), so "the norm" alone would not say which one. It is
`normMark` / `normLabel` in `js/dynamics.js`, driven by `scene.setNormStep()`
from `updateNorm()` in the sim, and it wears `--danger`, which is legal here
because it is not a series colour (the rule this card keeps is that nothing
borrows `--opt-N` except the thing that owns it).

Three things about it are load-bearing:

- **It is observed, never predicted.** `updateNorm()` runs where the herd
  counts are actually applied — the follower-join block and the reconsider
  block — so the marker cannot stand at a step the pasture did not do this on.
  Deriving it from the repair step + the hold would be close but not exact,
  since the count only lands on the next reconsideration.
- **It clears and re-sets rather than latching.** The repair now fires in
  every run before any follower joins, so in practice the norm arrives once, at
  a median step **~201** (range 181-281), just after the repair's minimum hold
  ends. The
  clear/re-set
  path is kept because it costs nothing and the ordering is not guaranteed by
  construction — under the old fixed `switchAt` schedule it genuinely mattered,
  with 3 of 12 runs reaching 2-each at step 180 and one of those then *leaving*
  the norm when the repair fired late (set@180, clear@800, set@2000). A latched
  marker sat at 180 through a stretch the pasture spent on one cow.
- **It is only visible while that step is inside the 500-step window**, and it
  is deliberately not clamped to the axis when it scrolls off — a marker pinned
  to the left edge would claim the norm was reached at a step it wasn't. At the
  current `horizon: 500` the window never scrolls, so the marker lands around
  step 200 and simply stays for the rest of the run; that clamp-refusal only
  mattered when a 10,000-step run scrolled it off after ~500 steps. Keep it
  anyway — it is what makes any longer horizon honest again.

The caption is what forced `CHART.top` down 10 units (412 -> 422, `H` 662 ->
672) with the titles at `TITLE_DY: 48` and the caption at `NORM_LABEL_DY: 12`:
there are two label rows above the plot now, and at the old `top - 28` /
`top - 8` their boxes cleared each other by 2 units against this card's 8-16
rhythm. Measured after the move: 18 units. The caption is 285 units
wide against a 460-unit plot, so there is a band in the middle where neither
side of the line has room for it: it is anchored `start` and **clamped to the
plot**, not flipped. An earlier flip-only rule ran it out to x **-43**, well
past the axis, once the string grew from "the norm" to "the optimal norm".
Verified over 60 sampled frames of a sweep: x stays inside 106.8..536.0 against
a plot of 76..536.

**The chart is a scrolling window whose scrolling is currently never
exercised.** `chartSpan: 500` now equals `horizon: 500`, so the axis stays
0..500 for a whole run and the three lines simply grow across it — which is the
point of the shorter horizon. The side block's title says "**Across** 500
steps" rather than "Last", for exactly that reason.

The scrolling machinery is deliberately left in place: below `chartSpan` the
axis is 0..500 and the lines grow into it; past it the left edge would be
`step - 500` and the plot would scroll, pruning samples as they leave the
window (`prune()` in `js/dynamics.js`) so an endless run costs a fixed ~501
points at full per-step resolution with no decimation, keeping one sample from
*before* the left edge so the lines reach it, with `px()` clamping it to the
axis. Verified back when it ran, at steps 100 / 499 / 501 / 900 / 5000 /
40000: left edge tracked `step - 500` exactly and the point count stayed at
501. It costs nothing dormant and is what any horizon above 500 needs back, so
do not delete it as dead code — but do not trust it untested either, since
nothing on the page exercises it now.

The plot stops at `CHART.right: 536` of 1000, not the full width — the right
third is a **stats table** (`SIDE`, `js/dynamics.js`), one row per policy and
four columns: **rate** (`eaten/100`), **grass**, **head**, **eaten**. The rate
is computed in `drawChart()` as the slope of that pasture's own plotted line
over the visible window (`(last - first) / span * 100`), so it can never
disagree with what the reader sees; the other three are pushed every step from
`sync()` via `scene.setStats([{grass, head, eaten}, ...])`. The rate doubles as
a check on the model: Optimal's 8 head reads exactly 160 per 100 steps, which
is `8 x 0.2 x 100` — the cow-eats-what-it-burns identity.

**grass / head / eaten used to sit in a row under each pasture** and moved into
this table by request, with **starved dropped** at the same time. Three
knock-ons, all of them measured rather than guessed:

- Panels now end at the grid, so the whole chart/side block moved **up 48
  units** (`CHART.top` 470 -> 422) and `H` went **720 -> 672**. The `viewBox`
  literal in `index.html` has to match — `js/dynamics.js` overwrites it at
  load, so a stale one only shows as a flash before the script runs.
- `.dynamics-canvas`'s button positions are percentages of that height, so all
  three were rescaled to keep their absolute positions (224 / 130 / 194 units):
  `--play-y` 31% -> 33.33%, `--ff-y` 18% -> 19.35%, `--restart-y` 27% ->
  28.87%. **Any further change to `H` has to redo this arithmetic.**
- Four value columns need more width than two did, so the plot gave up a
  further 44 units: `SIDE` is now 390 wide (rule 576, 600..990) against 346.
  Column right edges are `COLS` in `js/dynamics.js` — rate 786, grass 852, head
  910, eaten 990. `eaten` has the widest slot because it *was* the only
  five-digit value on the card back at the 10,000-step horizon; at 500 steps it
  peaks around 800, so every slot is now roomier than it needs to be — the safe
  direction, and what a longer horizon would want back. `rate` is the second
  widest because `eaten/100` is the long
  header. Measured at step 4,000: no pair of strings in the block overlaps, the
  longest name ("Optimal", ending 667.5) clears the leftmost header by 40.8,
  and `STAT_PITCH` — which spaced the old under-panel readouts — is gone.

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

**The shipped run, measured** (`startGrass: 0.60`,
`regrowPerNeighbour: 0.0092`, `highGrass: 2`, `regrowBase: 0.001`,
`personalTop: [4,4,3,2]`, `recoverBelow: 0.50`, `recoverUntil: 0.60`,
`repairLadder: [7,6,5,4]`, `rungSteps: 20`, `joinEvery: 5`, `watchEvery: 5`,
`fixedSeed: 836700000`, `horizon: 500`). The card plays this one run, so these
are its actual numbers:

| | harvest | vs Optimal | grass at end | head at end |
|---|---|---|---|---|
| Greedy | 170 | **−79%** | 6% | **0** |
| Leader | 765 | **−5.0%** | ~70% | 8 |
| Optimal | 805 | — | 71% | 8 |

The Leader pasture, sampled every 10 steps (head / grass):

```
0:13h/60%  10:13h/51%  20:11h/44%  30:8h/42%  40:6h/44%  50:6h/45%
60:5h/44%  70:5h/45%   80:4h/54%   90:4h/55%  100:4h/59%  110:4h/67%
120:4h/73% 130:8h/67%  ... holds at 8 head, ~70%, for the rest of the run
```

So: the greedy herd takes it from **60% to 42%** by step 30; the ladder walks
11 → 8 → 6 → 5 → 4 head; the pasture is back over 60% at step **102**; the norm
(8 head) lands at step **121**, which is where the red marker sits. The herd
never drops below the four head it destocks to. Optimal opens 60% and settles
at 71%; Greedy's herd is gone by step 88 and its pasture ends at 6%.

Because the seed is fixed, **`Optimal > Leader > Greedy` is a fact about the
card, not a probability** — there is no flake rate to quote any more. What
follows describes what happens if `fixedSeed` is set back to null.

**Optimal's old flake is gone, and the regrowth tuning is why.** Under
Simulation 1's bistable numbers (0.012 / `highGrass: 3`) the Optimal pasture
sat right on the capacity cliff and wiped out in roughly 1 run in 30 — 6/200 at
the 0.7 opening, 4/200 at `regrowBase: 0.004`. At `highGrass: 2` there is no
cliff to fall off: measured **0/24 wipeouts** across every random-seed sweep at
0.0092, at every seed-bank rate down to 0, and with the pasture opening at its
own steady state rather than climbing to it. If it ever does go, the standing
line correctly reports Leader winning, because it is computed from
`model.eaten` rather than asserted.

**The ordering is the claim.** Optimal on top because 2 cows is the optimum and
nothing can beat it; Leader below it by the cost of its greedy opening, running
parallel once it has converged; Greedy far below, flat on the floor after its
herd starves. An
earlier cut had Leader *ahead* of Optimal by 0.3% — harvest banked while its
followers were still greedy — which made the label "Optimal" a lie and is
exactly what the repair rule was introduced to fix. The 0.82 opening broke it
the same way and far more visibly (+1.2%, Leader leading the whole run), which
is what the trade-off passage above is about. Note that Leader being ahead for
the first ~40 steps is **not** that failure: it has 13 head against 8 and can
hardly be otherwise. The claim is about where the run *ends* and about the
lead never being repaid. **If a change ever puts
Leader back above Optimal, the section has broken, whatever the numbers say.**

Greedy is the only failure case left, and it is a clean one: at the 500-step
horizon it takes **73%** less harvest than Optimal, wipes its herd out in every
run by a median step 103, and ends with a third of its grass and no cows at all.

**Getting Greedy to fail again took a table reorder, not a parameter.** At
`regrowPerNeighbour: 0.011` Greedy's old `[4,1,2,3]` collapsed on its own. At
0.015 that vector totals 10 head = exactly the new capacity, so Greedy
survived at 83% grass and harvested 1209 — the section lost its failure case.
Since the greedy herd is *computed* from the first four rows of
`MIXED_VIEWS`, the fix was to reorder those rows (see Simulation 2) so the
tops come out `[4,4,3,2]` = 13 head. 13 was picked over 12 deliberately: 12
head only wipes out in 53/60 runs and drags on to a median step 382, while 13
fails every time by step ~252 and dries the pasture to 2–6% grass before the
last cow goes. Nothing else about the population changed. (Those figures are
from 0.015. At 0.012 the margin is far wider — capacity is 8 and the greedy
herd is 13 — so the reorder is no longer what makes Greedy fail; it would now
fail at 12 head too. The reordered table is kept because Project 01's utility
tables have to stay fixed anyway, and `[4,4,3,2]` is what they say.)

**The greedy pasture used to regreen over the back half of the run** — 83–100%
grass at step 600 with no cows left, at `regrowBase: 0.004` and a 600-step
horizon. That read well: the commons only recovers after the herd that ruined
it is gone. It is no longer what happens. At the current `regrowBase: 0.001`
and `horizon: 500` the run ends at **13% grass with no cows**, because
regrowth resumes but has neither the rate nor the time to get anywhere. The
mechanism is unchanged and still honest; only the setting moved. Kept here
because it is the reading to restore if the seed bank ever goes back up.

`greenThreshold` is 0.7 and **now does nothing** — `greenCows` and
`brownCows` are both 2, so the leader plays 2 whatever the grass reads. The
tuning that chose 0.7 over 0.65/0.75/0.8 was done when `greenCows` was 3 and
is no longer live; it is kept above only as the record of why 0.7 is the
number sitting in `CONFIG` if the rule is ever switched back on.

## Contact photo (`js/hero-frame.js`)

**A sequence authored beat by beat to a spec, in parts.** Five parts, 62.3s of
beats played at `PACE: 0.65` = **~40s**. It is finished as a piece: the photo
opens desaturated, the frame is built around it, curtains close over it and
draw back on the photo in colour with confetti outside the frame. **Plays
exactly once** — the `IntersectionObserver` in the playback section at the
bottom of the file disconnects itself right after the first `play()`, so
scrolling the photo out of view and back does not restart it. An earlier cut
replayed on every scroll-into-view, which read as a looping gimmick rather
than a one-off flourish.

*Part one (0-13.5s)* — opens on a blank transparent square with a thin
boundary. Blob A walks on with a brick a quarter of the frame wide, sets it
bottom-left, hammers both ends, repeats twice. Once A's first brick is nailed,
blob B walks on with a vertical brick carried flat, heaves it upright onto the
corner brick with visible effort, lets it rock and damp out, blows a relieved
"phew", and nails its base.

*Part two (13.6-22.4s)* — course two of the left column is out of reach, so B
fetches a ladder, stands it against the column and climbs. Blob C, a hod
carrier, passes the next brick up; B takes it out to its right, and it turns
from flat to upright **as it rises** before sliding sideways into the column.
A runs its fourth and last bottom brick through that hand-off.

*Part three (22.6-41.6s)* — B comes down; B and C fetch a brick each and lay
them end to end on the floor, then hammer the seam to join them. A arrives
with a crane truck, telescopes its mast up and runs the jib out; B and C hook
the joined beam on; it is lifted, swings upright on the way up, traverses left
and seats on the column, completing the left side to the top corner. C goes up
the ladder and nails the joint at y 168 — the midpoint of the frame's left
side.

**The beam is a rigid pair.** Both halves take the *same* transform, expressed
as "where is the attach point, and how is the piece rotated about it"
(`BEAM_ATTACH`, `poseBeam`). Giving each half its own attach point is what left
a gap on the floor: the transform is rigid-body, so a piece's position comes
from its own geometry, not from where you aim the anchor. `BEAM_PIECE_CX` is
*derived* from that transform rather than restated — rotating -90 about the
attach maps a final y-offset to an x-offset of the same size.

**The crane is a mast-and-jib, not a swinging boom.** The hook then sits
directly above the load at every moment, which is both physically honest and
far easier to read at this size; a boom long enough to reach from a parked
truck to the top-left corner would have been longer than the frame is tall.
Mast telescopes first, jib runs out second — a jib growing out of a
half-raised mast looks like a bug rather than a machine. Hanging the beam from
a point near its *top end* is what makes it swing upright on its own as it
lifts, which is the whole reason the lift reads as a lift.

*Part four (41.8-52.8s)* — a cursor flies in, presses on the left wall and
drags a **copy** of it across to the right; the blobs run for it, and the
travelling wall shoves the ladder and the crane off the field ahead of itself.
Then two winged blobs fly the lintel down and close the square.

**The right column is built from the left column's own courses**
(`leftBricks.concat(beamBricks).map(...)`), not from fresh numbers, so it stays
a copy if the left side is ever re-cut. It starts the drag sitting exactly on
top of the original at 82% opacity — that is what makes it read as pulling a
duplicate off rather than as a new object appearing.

**Pushed things need a `gain`, not just a lead.** `shove(x, lead, gain)` moves
an object only once the wall's leading edge reaches it, and then skids it ahead
*faster* than the wall. At gain 1 the wall has only ~300 units of travel to
give, which parked the ladder half in shot at the right-hand edge for the rest
of the run. The crane needs the bigger gain (1.9 against the ladder's 1.5)
because its jib reaches back almost to the left wall, so the body has to travel
a full frame-width past the edge before the jib stops showing.

**The flyers carry the lintel overhead, like every other blob carries a
brick.** Slinging it above them put them off the top of the drawing for most of
the descent — there are only 22 units between the frame's top and the edge of
the box, and a blob is 17 tall. Carrying it this way also puts them inside the
opening, where there is room. They leave by fading on the spot with a small
drift rather than flying off: the square is closed by then, so any real exit
path goes through a wall, and the fade is front-loaded so they are all but gone
before the drift takes them near one.

*Part five (53.2-62.3s)* — red curtains sweep shut across the finished frame,
**hold closed for 2s** (`P5.close` ends 55.0, `P5.open` now starts 57.0 — was
0.7s, asked to be "a little longer"), then draw back while the photo comes
from grayscale to colour and confetti fires up outside the frame from the two
top corners. The hold length is the gap between `close[1]` and `open[0]`
alone — `open`'s own duration and the confetti runway after it are unchanged,
just shifted later by the same amount, which is why `open` and `TOTAL` both
moved by +1.3s rather than only `open[0]`.

**The photo is the opening shot, not a blank square**, desaturated via
`photo.style.filter` set from `render()` on every frame — one expression tied
to the curtain beat, so the colour can never disagree with where the curtains
are. Set from **script, not the stylesheet**: with JS off, or under reduced
motion (where the overlay is removed outright), the photo must simply be
itself, in colour. There is no `.hero-photo--building` rule any more.

**The view is wider than the drawing.** Coordinates are unchanged — the frame
still lives at 22..338 in a 360 field — but the `viewBox` is inset by
`VIEW_MARGIN: 60` on every side so there is somewhere outside the frame for
confetti to fly and for the ladder and crane to be shoved to. Widening the
*view* rather than re-basing every constant is what kept parts one to four
untouched; re-basing would have meant re-deriving `LADDER_BASE`, `PARK_X`,
`BEAM_FLAT`, `MAST_TOP` and a dozen crane body offsets.

That widening costs one thing: between the hero's 720px breakpoint and about
1100px the photo sits near the content's right edge, and the overhang pushed
the page into a horizontal scroll (measured: 31px at 1000, 52px at 900).
`.hero` therefore carries **`overflow-x: clip`** — `clip` and not `hidden`,
because `hidden` on one axis forces the other to `auto` and would make the
hero a scroll container. Confetti is cut off at the content edge at those
widths, which is the right degradation. **Re-measure scrollWidth at 900 and
1000 if `VIEW_MARGIN` ever grows again.**

**Curtains cover a square a little larger than the frame, not flush with it.**
Each panel spans `CX0..CX1` / `CY0..CY1`, which pad `OUT..FAR` out by
`CURTAIN_PAD: 24` on every side — first cut flush with the brickwork (and,
before that, hung only in the frame's opening), both of which left a sliver
of frame or wall showing at a fully-closed beat and read as "curtains behind
a window" rather than "curtains drawn across the whole picture".

**There is no wrapping scale transform — every panel is rebuilt from scratch
each frame**, because the geometry it needs (see next) can't be expressed as
one uniform scale. `poseCurtains(sxTop, sxBottom, t)` takes two closedness
values, not one: `sxTop` drives the top edge directly, `sxBottom` is the same
`curtainDrive()` curve evaluated `CURTAIN_LAG` (0.5s) *earlier*, so the top of
each panel is always further along than the bottom. The leading edge is a
single `Q` curve between the two resulting x-positions rather than a straight
line, which is what bows it into the V-shape visible mid-motion — asked for
as "move the top part, the bottom should flow behind" — and every pleat
follows the same lagged interpolation at its own fraction across the panel's
width, so the whole fold pattern slants together instead of the panel
appearing to slide as one rigid sheet with a separately-animated print on it.
The hem is still scalloped (quadratic arcs along the bottom, `CY1`) rather
than cut off flat, because a curtain has weight and pools.

**Colour is velvet, not flat red — a dark base, a near-black shadow fold, and
a warm pink-red `--hero-curtain-shine` fold**, with `hash(i, side + 60)`
picking roughly 40% of each panel's nine pleats to render in the shine colour
instead of the shadow one. A single fold colour read as "red plastic"; the
alternation of dark and lit rounded pleats is what reads as fabric catching
the light. Width, bow depth, spacing jitter, shine-or-shadow pick and opacity
per pleat all come from `hash(i, side + salt)` — deterministic, not
`Math.random`, for the same replay guarantee as the confetti below — which is
what keeps nine folds from reading as one repeated stamp. The bow itself
sways on `Math.sin(t * 1.4 + phase)`, still driven by the raw seconds value
rather than by closedness, so the sway keeps moving through the held-shut
beat rather than freezing solid once a panel stops travelling.

**Confetti is deterministic** — a hash of the piece index, never
`Math.random` — so a replay is identical and a screenshot of a given beat is
reproducible. Simple ballistics (`CONFETTI_G`) from the frame's two top
corners, outward and up, then falling through the margin.

**Hammer speed is a rate, not a count.** `blows(a, b)` derives the number of
strikes from the length of the beat at a single `HAMMER_HZ`. Hand-written
per-site counts had A hammering at ~9 blows a second and B nailing at 3.5,
which read as two different characters rather than two blobs doing the same
job. Never write a literal swing count.

**C does the final nailing, not B.** At the hook C stands left of B, and the
two cannot trade places: whichever walks to the ladder's foot passes straight
through the other. Handing the job to whoever is already nearer the ladder is
the fix; re-timing it is not, and two attempts at staggering both failed.

The photo is 300x300 and the SVG is 360x360 inset -30px, so one user unit is
one CSS pixel and every constant in the file is literal pixels — the same trick
the simulation scenes use. `.hero-photo` needs `position: relative` to anchor
it, and the overlay is `pointer-events: none`.

Geometry: frame band at 22..34 against a photo at 30..330, brick = SPAN/4 = 79,
`FLOOR` = 326. **The builders stand on `FLOOR`**, which is the top of the bottom
run, so a brick they set goes down at their feet and the left column stacks up
from the corner brick they are standing on.

**Everyone works on one line (`FLOOR`), so lanes are the hard constraint** —
and this is where every bug in this file has come from. Two rules:

1. **A blob may never walk through a standing brick.** It reads as a bug, not
   as a shortcut. In part one A entered from the left and walked straight
   through the column B had just stood up; in part two B's ladder trip did the
   same thing. Both now use the right-hand approach.
2. **The right-hand approach is single file.** Only one blob may be travelling
   it at a time, which is what fixes the *timings*: A's third brick is clear by
   13.5, B goes out and back for the ladder 13.6-15.9, C walks on at 16.2, A's
   fourth brick starts at 18.1. That is also why `A_STARTS` is an explicit
   array (`[0, 4.6, 9.2, 18.1]`) rather than `i * CYCLE` — the fourth cycle has
   to wait for the lane, and it then runs right through B's hand-off, which is
   what "A carries on with the last brick" is supposed to look like.

**There is a headless audit for exactly this** and it must be re-run after any
re-timing: sample `render()` every 0.05s across the whole run, and check (a) no
two visible blobs are within 11 units in x and 12 in y, and (b) no blob box
overlaps a *placed* column brick. Both currently report **none**. Eyeballing a
contact sheet will not catch a 0.2s pass-through — the audit caught three that
screenshots did not, and it also surfaced a `ReferenceError` living in a part
two branch that the part three diagnostics never entered, because it walks the
whole timeline rather than the beats you happen to think about.

A companion audit worth re-running when tokens change: collect every
`var(--x)` across `js/` and `css/` and diff against the names defined in the
palette blocks. An undefined custom property is silent in light mode and
**black** in dark. It caught the crane truck rendering black because an edit
threw before writing and the light block never got `--hero-vehicle`. Note it
reports `--rule-color` as undefined; that one is a false positive, set inline
on the element in `index.html`.

Other things that are load-bearing, each of which was wrong first:

- **Entry points sit inside the SVG box** (`ENTER_A`/`ENTER_B`, +12 / -10
  against a frame spanning 22..338 in a 360 box). The overlay sits above the
  photo and so cannot be clipped by it; walking on from -40 painted blobs and
  bricks over the hero text. The SVG is `overflow: hidden` for the same reason.
- **Bricks are carried flat and turned upright at the last moment.** Carried
  already-upright the first one read as clutter lying across the bottom-left
  corner, and the heave had nothing to show. In part one the tilt finishes
  ahead of the travel so the last of the effort is pure lift.
- **On the ladder, B takes the brick out to its right, not overhead.** Stood
  upright at an overhead hand position the brick landed *inside the ladder
  rails* and disappeared behind them (bricks are drawn before the ladder).
  Out at `topPt.x + 20` it turns up in clear air and then slides sideways into
  the column — which also reads more like bricklaying than juggling. The turn
  and the slide overlap only slightly (turn over the first 45%, slide from
  35%); doing both together swung it through a wide arc across the opening.
- **The ladder's origin is its base centre with rails running up in -y**, so
  placing it is one translate plus one rotation: `rotate(90)` carried flat,
  `LADDER_LEAN` (-7.7°) stood up. `ladderPoint(p)` returns where a climber's
  feet sit at p of the way up, and is the single source of B's position for
  the whole climb — do not re-derive it.
- **Reduced motion removes the overlay outright** rather than freezing it at
  t = 1. A half-built frame is a coherent *moment* and an incoherent *still*,
  so the honest static state is the *finished* photo — full colour, crisp
  edges — not a frozen mid-build frame and not the grayscale opening shot
  either. That took an explicit reset: `photo.style.filter` is set to
  grayscale unconditionally near the top of the file, before the reduced-
  motion check ever runs, so the reduced-motion branch has to clear it (and
  the mask, next) back to nothing itself rather than assume it was never set.
- **The edge fade is for the build, not the finished piece — and the swap
  to crisp happens behind the closed curtain, not at full reveal.**
  `.hero-photo img`'s mask (see Gotchas) feathers the photo's edges so it
  blends with the blobs and bricks being assembled around it; the finished
  piece gets a crisp square edge instead. `render()` toggles
  `photo.style.maskImage` / `webkitMaskImage` to `"none"` at `s >=
  P5.close[1]` — the instant the curtains finish *closing*, while the photo
  is fully hidden — not tied to `revealed`/the colour transition the way a
  first cut had it. That first cut left the edge soft for the entire
  draw-back and only snapped crisp on the very last frame of the reveal,
  which read as a glitch happening in full view rather than a clean
  discovery; doing the swap while nothing is visible means there is no
  moment for a visitor to catch it happening at all.

Colours are its own tokens (`--hero-frame`, `--hero-frame-edge`,
`--hero-worker`, `--hero-worker-dark`, `--hero-worker-eye`, `--hero-hat`,
`--hero-hammer`, `--hero-puff`, `--hero-drop`, `--hero-ladder`,
`--hero-curtain`, `--hero-curtain-fold`, `--hero-curtain-shine`,
`--hero-outline`) across all
three palette blocks — the rule that nothing wears a series colour (`--opt-N`)
but the series that owns it applies to decoration too. The eye dot *lightens*
in dark mode; a near-black dot on a dark-mode grey blob disappears.
`--hero-outline` was asked for as "thin white": white is invisible on the light
page ground (#f7f7f8), so light mode uses the lightest neutral that still reads
as a drawn line and dark mode gets the white.

Timeline lives in `A` (four brick cycles off `A_STARTS`), `B` (the first
heave), `B2` (ladder, climb, take, place, tap), `C` (the hand-off), `P3` (the
crane act) and `P4` (the drag and the flyers), in **seconds**, with `TOTAL` derived and `render(t)`
taking 0..1 across it. `PACE` scales playback without touching a single beat; it is
**0.65**, so 61s of authored beats play in ~40s. Author in real seconds and
let `PACE` do the compression — never re-time the beats to change the length. Parts three, four and five are separate
`renderPartThree()` / `renderPartFour()` / `renderPartFive()` that the main
`render()` early-returns into, newest first: each repaints the finished work itself and
owns all the blobs, and the part one/two chains are one long if/else per worker
that do not compose.
Authoring in seconds and deriving the normalised time is what makes the beats
tweakable; do not invert that.

**Headless traps, both already paid for:**
- Screenshotting a hand-driven frame on the real page needs
  `requestAnimationFrame` stubbed *before* `js/main.js` in the markup.
  Otherwise playback starts, rAF fires its ~2 headless ticks, and your
  `render(x)` is silently overwritten by a callback at t≈0 — which looks
  exactly like the animation failing to draw.
- Give the screenshot window real room. The frame's bottom run sits at page
  y≈336-348 in these harnesses; a 390px-tall window clips it and the montage
  reads as "the bottom bricks never appear". Verify positions with
  `getBoundingClientRect` before believing a screenshot.

## Simulation 1's slider blob (`js/commons-lasso.js`)

A second, independent decorative animation, triggered by the same "photo
scrolls into view, plays once" pattern as `hero-frame.js` (its own
`IntersectionObserver`, disconnected right after first play — the two do not
share state). One blob lassoes the herd-size slider's real thumb and tries to
drag it toward fewer cows; when it can't, it calls in a second blob; the pair
wheeze, slump and leave if nobody helps. If the visitor drags the slider down
themselves while the rope is attached, both blobs celebrate and run off
instead.

**This is deliberately not a pure `render(t)` function, unlike every other
scene on the site.** Its subject — the native `<input type=range>` thumb — has
a real screen position that depends on live page layout and can be moved by
the visitor mid-animation; there is no way to author "where the thumb is" as
a timeline constant the way a brick's position can be. So it drives a small
state machine off real elapsed time (`performance.now()`), and every frame it
re-reads `input.getBoundingClientRect()` and `input.value` to find the
thumb's live position — which is also what lets the celebrate branch simply
work: nothing has to be told the thumb moved, the next `tick()` just sees it.

**The blob is the hero photo's builder, copied wholesale, not a new
character.** `makeBlob()` reuses `hero-frame.js`'s exact leg/body/arm/eye
numbers (same `cy: -9.5, rx: 6.4, ry: 6` body, same single arm pivoting at
`4.6 -10.9`), asked for explicitly after a first cut invented its own
slightly-different proportions — reusing the real numbers is what makes it
read as the same character turning up a second time on the page rather than
a lookalike. The one swap is the hat: a wide brim ellipse plus a pinched
dome path stand in for the hard hat's flat rect and low dome, because here
the blob is wrangling a slider, not laying bricks — colour alone couldn't
have sold that, the silhouette had to change. Its own tokens,
`--commons-hat`/`--commons-hat-fold`, not `--hero-hat`, for the same reason
the body tokens are `--commons-blob*` and not `--hero-worker*` — nothing
borrows a token from a scene it isn't part of, even when the drawing is a
literal copy.

**The stand point is anchored to the "1 cow each" label, not to the thumb —
entry is horizontal, the rope does the reaching.** Two earlier cuts tied the
blob's position to the thumb directly: one stood it beside the thumb and had
it enter sideways, the other stood it below the thumb and had it walk up from
the bottom of the card. Both moved the *blob* to wherever the thumb happened
to be, which is backwards — asked for explicitly as "come in horizontally
... stop a little to the right of the 1 cow each text": the blob walks in
from the right (`offRight`, `stage width + 30`) along a fixed height just
above that label (`STAND_DX`/`STAND_DY` past its `getBoundingClientRect()`)
and *stays there* for the whole scene, however far the thumb travels. The
rope is what reaches the thumb, not the blob's feet — which is also why the
rope reads as "slightly off vertical": the stand point is offset to the
right of the track by construction (the label sits in the same narrow rail
column as the track, a little wider), so the line from hand to thumb is never
purely vertical even before anyone pulls on it. Leaving reverses the same
horizontal lane back out to the right, so entry and exit match.

**The arm angle is computed from real geometry (`aimArm()`), not a fixed
constant, because the blob no longer sits directly under or beside its
target.** A fixed "point straight up" angle was fine when the blob's stand
position tracked the thumb's own x; once the stand point is fixed and the
thumb can be anywhere on the track, the arm has to aim wherever the thumb
actually is. `aimArm(x, y, tx, ty)` is a plain `atan2` from the shoulder to
the live thumb position, recomputed every frame the same as the hand point
already was — this is also what keeps the arm aimed correctly if the
visitor drags the thumb to a new spot mid-pull.

**Straining is a lean, not a slide.** The first cut moved a pulling blob's
whole `(x, y)` a few units along `awayFromThumb()`, which read as the figure
sliding across the ground rather than pulling against something — asked
directly not to do that ("don't move their whole body, but rather slant
them"). `poseBlob()`'s `lean` now rotates the *entire figure* around its own
feet (the node's local origin, `translate(x, y) rotate(lean)` — rotate runs
second so it turns around the already-translated point), which keeps the
feet planted exactly on the stand point while the body tips back along the
rope's line. `leanTowards(dir)` derives the angle from `awayFromThumb()`'s
own direction vector (`atan2(dir.x, -dir.y)`, "up" as the zero reference,
clamped to ±20°) scaled to only 50% of full alignment — a blob fully
rotated to match the rope's angle reads as falling over, not straining.
`handPoint()` had to learn about `lean` too: the arm rotates *with* the
figure, so the hand's final position needs the lean applied on top of the
arm's own rotation, or the rope would visibly detach from the hand the
moment a blob leans.

**Effort shows on the face: round eyes swap for angled `>` `<` ones,
scaled by how hard the current tug actually is.** `eyeStrain` is a second
pair of chevron paths layered under the normal round eyes, vertices pointing
inward toward the centre — the universal "straining" cartoon read. Driven by
`o.strain` (0..1) in `poseBlob()`, which fades the round eyes out as the
chevrons fade in, so it's one continuous cross-fade rather than a hard swap:
a blob resting between tugs has ordinary eyes, a blob at the peak of a pull
has fully angled ones.

**The thumb itself dips a few pixels on the hardest pulls — just the thumb,
not the track it rides on.** Asked for directly — "make the [thumb] go
slightly down when they pull on it", then refined to "just the slider circle
thing, not the entire base". The only safe way to move it at all without
touching the actual herd-size value (which would silently change what the
visible simulation is doing) is a cosmetic nudge; the first cut applied that
nudge as a transform on the whole `<input>`, which moved the track along
with the thumb since the track *is* the input's own box. The fix lives in
`css/style.css`: `.commons-slider::-webkit-slider-thumb` /
`::-moz-range-thumb` read a `--thumb-nudge` custom property
(`transform: translateX(calc(-1 * var(--thumb-nudge, 0px)))`), and
`nudgeThumb(px)` in the JS does nothing but
`input.style.setProperty("--thumb-nudge", ...)`. Custom properties inherit
into pseudo-elements, so setting it on the `<input>` is enough to reach a
part of the DOM script has no direct handle to. The axis is still
`translateX`, not `translateY`: the thumb pseudo-element lives inside the
same pre-rotation local frame as the whole slider (rotated -90deg as a unit,
see Layout), so a local X offset is what becomes a screen-space *downward*
nudge once that rotation is applied — the same maths as the first cut, just
scoped to one pseudo-element's transform instead of the input's own.
Verified directly in a headless harness: `input.getBoundingClientRect().top`
now stays exactly put (127 before and during a pull hold) while
`--thumb-nudge` reads `4px` at the hold's peak, confirming the track itself
no longer moves.

**The rope has to add the same nudge itself, since `thumbClientPos()` can't
see it.** `getBoundingClientRect()` on the `<input>` reports the *track's*
box, which the fix above deliberately stops moving — so during a pull,
`tyN = ty + strain * NUDGE_MAX` is computed alongside the nudge and used for
every piece of thumb-relative geometry that frame (`aimArm`, `awayFromThumb`,
the rope's own endpoint, the loop's centre), rather than the raw `ty`. Miss
this and the rope stays aimed at the thumb's resting position while the
thumb itself visibly dips a few pixels below it.

**Pulling oscillates, then holds at full strain, before whatever happens
next** — asked for as "hold the pulling pose longer before the let go".
`tugWave(p, holdFrac, amplitude)` runs a normal sine for the first
`HOLD_FRAC` (0.65) of the beat and then pins the value at `amplitude` for
the rest: several real tugs, then one sustained hard pull, rather than an
even oscillation cut off arbitrarily. The oscillating part runs exactly 4.5
cycles so it always lands on a peak right as the hold begins — an integer
cycle count would let the hold pick up mid-swing, visible as a jump.
`giveUp` eases `lean` and `strain` back to neutral from that same held
maximum (`leanTowards(dir)` and `1`) rather than from an arbitrary
in-progress tug value, since the hold guarantees that's genuinely where they
were a moment before letting go.

**There's a `wheeze` phase between `giveUp` and `leave`** — asked for
directly, "a wheeze / give up / looking down sort of animation before they
leave". `giveUp` already relaxes the rope and the straining pose; `wheeze`
is the beat of visibly being beaten that follows it, before the walk cycle
picks back up. Three things layer together, all driven by one `intensity`
value that ramps in over the first 15% of the beat, holds, then eases back
out over the last 20% (so nothing snaps against `giveUp` before it or
`leave` after it):
- `lean` holds a gentle constant forward droop (9°, not derived from the
  rope direction this time — they've already let go, so there's no rope
  line left to lean along) for the downcast, looking-down half of the ask.
- `heave` oscillates a sine (2.6 cycles across the beat) through a new
  `poseBlob()` parameter that scales the body vertically *around its own
  centre* (`translate(0 -9.5) scale(1 s) translate(0 9.5)`, not around the
  node origin — scaling from the feet would also slide the body up and down
  bodily, which reads as bouncing rather than a heaving chest) for the
  wheeze itself.
- `tired` flattens `eyeGroup` (the two round eyes, now wrapped together
  specifically so they can be rescaled as one unit) toward half-shut the
  same way, anchored on their own `cy` so they sink in place rather than
  sliding down the face; `pant` swaps the mouth from the flat smile curve to
  an open "o" sized off the same `heave` value, so it visibly huffs in time
  with the chest instead of just sitting open.

**The slider is a horizontal `<input>` rotated -90deg in CSS** (see the
Layout section for why), and `getBoundingClientRect()` reports the box
*after* that rotation — min (value 1) lands at the bottom, max (value 4) at
the top, matching the "1 cow"/"4 cows" labels either end of the rail. That is
most of the trick in `thumbClientPos()`: no need to know anything about the
rotation, only to read the transformed rect and interpolate value fraction
against its height.

**The interpolation has to inset by the thumb's own radius, or the lasso
loop lands off-centre at either end of the track.** A range thumb's *centre*
never reaches the raw edges of its track — like any such input, half the
thumb's own width is reserved at each end so it can't hang off — so the
first cut (`r.bottom - t * r.height`) put the loop up to a whole `THUMB_R`
(10) off the real thumb at value 1 and value 4, tightening only in the
middle of the travel. `thumbClientPos()` now insets both ends by `THUMB_R`
before interpolating (`bottom - t * (bottom - top)` against the *inset*
`top`/`bottom`), which is what "perfectly wraps" the thumb at every value,
not just near the middle — verified by screenshotting the loop against the
thumb at value 4 (the default) and confirming they're concentric.

**The loop itself closes in, rather than fading in already fitted.** During
`throw`, `rope.loopNode`'s radius eases from `THUMB_R + 16` down to `LOOP_R`
(11.5, just outside the real 10px thumb) over the back half of the beat —
asked for as "it should perfectly wrap around the circle", which reads as
the rope actually landing and cinching down, not a ring that simply appears
pre-sized. It's a real `<circle>`, not the ellipse the first cut used, since
a lassoed circular thumb wants a loop that is actually circular.

**The overlay is `position: fixed` on `document.body`, not a child of the
card.** A scene positioned relative to the card would be clipped by anything
the card or its ancestors set `overflow: hidden` on, and would need scroll-
offset math to place correctly. Fixed positioning sidesteps both: every frame
recomputes the stage's `getBoundingClientRect()` (viewport-relative, exactly
what `position: fixed` wants) and repaints the `<svg>` at that rect, so the
overlay tracks the card through scrolling for free, with `pointer-events:
none` throughout so it can never eat a click on the real slider.

**"Pulling" moves the blob, never the real thumb.** Faking a few pixels of
give on the actual `<input>` would mean fighting the browser's own thumb
rendering and risks it visually fighting a real drag if the visitor grabs it
at the same moment. Instead the blob's own stance steps back and leans during
`pullA`/`pullBoth`, stretching the rope taut between a live-computed hand
point and the live thumb position — the struggle reads through the blob's
body language, not through the control moving.

**The celebrate branch only arms once the rope is on, and only for an actual
decrease.** `onUserInput()` checks `phase` against the engaged states
(`throw` through `pullBoth`) and compares the new value against the last seen
one — an increase, or any drag before the lasso lands, is ignored. Verified
with a headless harness that stubs `performance.now()`/`requestAnimationFrame`
onto a hand-advanced fake clock and shims `IntersectionObserver` to fire
immediately: the no-interaction path runs the full give-up-and-leave sequence
and cleans up (overlay removed, listener detached) with zero thrown errors;
dispatching a genuine decreasing `input` event mid-`pullA` switches to
celebrate and cleans up correctly; dispatching a non-decreasing one does not
and the sequence runs its full course instead.

Colours are `--commons-blob`, `--commons-blob-dark`, `--commons-blob-eye`,
`--commons-rope`, `--commons-hat` and `--commons-hat-fold`, defined across
all three palette blocks like every other decorative token on the site.

## The "Building it into agents" truck (`js/agents-truck.js`)

A blob drives a truck in with the Problem section's third heading —
`#agentsHeading`, "Building it into agents" — hitched to the back, parks,
gets out, unhooks it, and drives off. Plays once, first scroll into view,
same pattern as every other decorative scene on the site.

**The heading's position is re-measured every frame, and the animation's own
transform is subtracted back out** (`naturalRect()`, using `appliedDx`).
A first cut captured it *once* in `startSequence()`, on the reasoning that a
heading in the document's own flow has no live input moving it the way the
herd slider's thumb does. That reasoning was wrong, and the bug it caused is
worth remembering: **`getBoundingClientRect()` is viewport-relative, and so
is the `position: fixed` overlay** — so the moment the visitor *scrolled*,
the cached rect described where the text used to be, and the truck stayed
pinned to that spot while the words slid away underneath it. Scrolling moves
an element in exactly the coordinate space this animation draws in, even
though nothing about the document changed.

The thing that made caching look necessary — that re-measuring an element
you've already transformed reports its *transformed* position, not its
natural one — is real, but it's solved by tracking the offset you applied
and subtracting it, not by refusing to measure. `setHeadingDx()` is the only
writer of `heading.style.transform`, and it records what it wrote, so
`naturalRect()` can always recover the untransformed box. That single change
makes the scene robust to scrolling, resizing and reflow at once.

**Every moving part must be re-posed every frame, including the ones that
aren't moving.** The same bug had a second half: `poseTruck()` was only
called from the `enter` and `driveOff` phases, so through the whole middle of
the sequence (settle, hop out, walk back, unhook, walk forward, hop in — ~5
of the 8.8 seconds) the truck simply kept whatever transform `enter`'s last
frame gave it. Even with live measurement it would still have sat there while
the page scrolled, and worse, the *blob* — which is re-posed every frame —
would have walked off and left it behind. `tick()` now applies the parked
pose and redraws the tow line unconditionally at the top, and the two moving
phases overwrite it. Verified by reflowing the heading mid-run at several
phases and checking the truck's gap to the text stays exactly `GAP` and its
vertical offset exactly 0.

**Measure the text, not the element.** `#agentsHeading` is an `<h3>` — a
block, so its own `getBoundingClientRect()` is the full width of the prose
column (measured: 620 wide, right edge 660) while the words stop at 204.
Keying the truck off that parked it ~470px past the end of the text, alone in
the empty half of the line. `measureTextRect()` puts a `Range` over the
heading's contents instead, which reports the glyphs' real box — also tighter
vertically (20 tall against the block's 28.7, which includes the line box's
leading), so the truck lands *on* the line of text rather than low beneath it.

**Hiding happens inside the `IntersectionObserver` callback, not
unconditionally at script load — and the observer's `rootMargin` is what
keeps that from being a visible pop.** `hero-frame.js` and
`commons-lasso.js` both get away with hiding their subject the instant the
script runs, because their subjects (an image, a slider that already has
sensible content) are never *only* meaningful text with nothing to fall back
to. Hiding `#agentsHeading` unconditionally at load and relying on the
observer to reveal it would mean: if the observer ever fails to fire for any
reason, real content disappears permanently. So the hide is inside
`startSequence()`, fired by the observer — but with `rootMargin: "0px 0px
300px 0px"` and `threshold: 0`, which extends the trigger zone 300px past
the real viewport bottom. The callback fires while the heading is still
below the fold, so there's nothing on screen to pop invisible, and the
worst-case failure mode if something goes wrong is "never gets the
entrance," not "the text vanishes and never comes back."

**The tow offset (truck hitch to text's right edge) is a single constant for
the whole beat, which is what "attached" actually has to mean.** Both the
truck's rest position and the heading's translateX are derived from the same
`restTruckX()` (`naturalRect.right + GAP`), so during the drive-in the
distance between the truck's hitch point and the text's current right edge
never changes — they move as one rigid unit, arriving together. The tow line
itself (`hitchLine`, a straight rod rather than the lasso's sagging rope,
since a truck hitch is rigid) is drawn fresh every frame from the truck's
hitch point to the text's live right edge, which costs nothing extra since
both positions are already being computed for the pose anyway.

**The overlay is viewport-sized and works entirely in `getBoundingClientRect()`
/ `position: fixed` coordinates, with no intermediate "stage" rect the way
`commons-lasso.js` has one.** That file's overlay is sized to a specific
card's bounding box because everything in it (the slider, both blobs) stays
within that card. Here the truck has to travel from off-screen left, past
the heading, off-screen right — further than any single container — so the
overlay simply covers the whole viewport (`inset: 0`, `viewBox` updated on
resize) and every position is a plain client coordinate, matching what
`getBoundingClientRect()` already returns with no translation step needed.

**That viewBox must come from `documentElement.clientWidth/clientHeight`,
not `window.innerWidth/innerHeight`.** `innerWidth` *includes* the
scrollbar; the 100%-sized overlay the viewBox maps onto does not. Using it
made the viewBox 15px wider than the box it painted into, and the default
`preserveAspectRatio: xMidYMid meet` silently scaled the whole scene down
~1.7% and offset it — enough to put the truck visibly off the text line even
though every coordinate being computed was correct. Symptom to recognise: a
`<g>`'s `getBoundingClientRect()` disagreeing with the `translate()` in its
own transform attribute (measured 1265.9 against a transform of 1278).

Colours are `--agents-truck`, `--agents-truck-dark`, `--agents-truck-window`,
`--agents-blob`, `--agents-blob-dark`, `--agents-blob-eye` and
`--agents-hitch` — a green truck, deliberately, for variety against the
hero's red-orange crane and the pasture card's warm rope/hat tones; own
tokens for the blob for the same reason `commons-lasso.js`'s do, even though
the figure is the same family drawn the same way.

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
spans both columns**, because three pastures side by side need more width than
one column gives. The section originally had no right-hand column at all, which let the
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

The simulation card is sized from its drawing, like every other card:

```
--dynamics-card: calc(1000px + 2 * var(--dynamics-pad) + 2px)   /* = 1042px */
```

It used to be `calc(var(--max-width) - 48px)` — the full 1232px page measure —
which made it both wider than it needed to be and impossible to centre on the
content above. **It is centred on the prose + key block, not on the
container.** Those are not the same axis: the key card is centred in its own
column, so the block above stops `--key-slack` (33px, half the column's spare
width) short of the grid's right edge, and a container-centred card sits 16.5px
right of everything above it. The fix is an explicit left margin with the right
one left to soak up the remainder:

```
width: min(var(--dynamics-card), 100% - var(--key-slack));
margin-left: calc((100% - var(--key-slack) - min(var(--dynamics-card), 100% - var(--key-slack))) / 2);
margin-right: auto;
```

That degrades on its own — once the row is narrower than the card, the width
collapses to the block's width and the left margin falls to 0, lining both
edges up with the block instead. Measured at 1440 / 1280 / 1150 / 1000 / 900 /
500: centre offset is **0.00px** at every one.

The drawing inside is `card - 2*pad - 2px` = **1000 wide** (viewBox
`0 0 1000 720`), which is exactly the `dynamics-svg` viewBox width, so at full
size one user unit renders as one CSS pixel and the SVG's `font-size` values
*are* the rendered pixel sizes. They were raised to the other cards' scale
once the card widened — panel titles and stat values 16, subtitles / axis
labels 12, small labels 11, chart and side titles 13, line-end labels 12.5.
That is what forced `GRID_Y` from `PANEL_TOP + 58` to `+ 70` and `H` from 600
to 620: at 12px the panel subtitle ran into the shepherd row. That is why **resizing it means editing the layout constants in
`js/dynamics.js`** (`TILE`, `PANEL_W`, `PANEL_X`, `CHART`, `SIDE`,
`COW_SCALE`) rather than letting the viewBox scale — scaling moves the type
with it and drops it under the 15.2px floor. `PANEL_W` went 380 -> **316** to
narrow the card: the widest thing a panel must hold is its subtitle, and
"Follow the highest-reputation behaviour" measures **304.8px** at the floor
size, so 316 leaves **5.2px either side**. That was ~10px until the site's
spelling was normalised to British -our: one extra letter in that one string
cost ~10px of panel slack, because this subtitle is the binding constraint on
`PANEL_W`. It still fits, but there is now very little room — **re-measure this
string before any wording change to the Leader panel's subtitle**, and treat
adding a word to it as a `PANEL_W` change. The other floor is the side block's note,
"Harvest rate is the slope of each line above." at 336px, which `SIDE`'s 390
of width still has to clear. **Measure the strings before choosing new widths** —
a `getBBox()` sweep over every `text` in the drawing takes one harness run.
Below ~1130px the canvas goes fluid (`width: 100%`) and the viewBox scales
down; measured at 500 / 885 / 985 / 1135 / 1265 / 1425, no viewport
overflows.

Its controls do **not** follow the other cards' corners: with the chart
filling the lower third of the drawing, the bottom-right corner is inside the
plot. Fast forward and restart stack in the right-hand margin of the third
panel instead (`--corner-x: 97.6%`, `--ff-y: 18%`, `--restart-y: 27%`), which
is clear of that panel's grid — the grid ends at x 952 of 1000, and a 34px
button centred at 976 spans 959..993. That margin is only 48 units wide now,
so `--corner-x` has to move with `PANEL_W`.

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
leaves the run paused, and fast-forward cycles 1× → 3× → 8×. **All three open
at 3×** — Project 03 opened at 8× while a run was 10,000 steps and was brought
into line with the others when the horizon dropped to 500, where 3× is ~37s end
to end (`let speed = N` plus the matching
`setSpeed(N)` at wire-up — both are needed, since the initial value stands if
the button is missing). The archived `norms-sim.js` still opens at 8×; it is
not on the page, so nothing was decided about it either way.

Help popups read their numbers out of `CONFIG` at open time (`data-cfg`,
`data-derived`), so the explanations can't drift from the models.

## Type floor in the cards

**Nothing inside a card renders below 15.2px (`0.95rem`).** That number is the
size of the taglines ("The pasture goes barren due to overgrazing") — and note
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
Every gap is now 8-16 units (`GRID_Y: PANEL_TOP + 96`, chart/side titles at
`top - 28`, axis labels at `bottom + 22` and `+ 50`, side rows on a 48 pitch),
and `H` went 640 -> 720 to hold it (and back to 662 once the under-panel
readouts moved into the side table — see above). The
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
- `--danger` (`#b91c1c` light, `#f87171` dark) is the semantic alarm colour. It
  started as `.tagline-danger`'s alone — the one word in a tagline that carries
  the outcome — and now also draws Project 03's norm marker (the red dashed
  vertical and its caption). Both uses are "this is the moment that matters",
  not "this is series N". It is deliberately **not** `--opt-4`, even though that pink was the
  only red-ish token already defined: `--opt-4` is a *series* colour (shepherd
  4's cloak, the fixed norm), and the rule that text never wears a series colour
  applies here too. 6.47:1 on the light card and 6.12:1 on the dark one, both
  ahead of the muted text it sits inside. Like every other token it is defined
  in all three palette blocks — miss one and you get the silent/black failure
  two bullets down.
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
