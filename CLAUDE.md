# Site notes

Personal academic site. Plain static HTML/CSS/JS — no build step, no bundler, no
npm. Scripts are IIFEs loaded with `<script>` tags in dependency order.

**`node` is available** (v22+) — use `node --check some-file.js` to catch syntax
errors, and feel free to prototype a sim's pure logic (no DOM) as a standalone
script before wiring it into the page; that's how several of the numbers below
were sanity-checked. For anything that touches the DOM, verification is still
done by driving pages in headless Chrome (see *Verifying changes* at the
bottom) — that workflow is how the rest of the numbers in this file were
measured. (This corrects an earlier claim in this file that node wasn't
available on this machine — it is.)

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
- then: each tile regrows one level with `p = 0.011 × (neighbours at level ≥ 3)`
  over the 8-neighbourhood — 8.8% interior, 5.5% edge, 3.3% corner

Run **ends** when the last cow starves; it pauses on that frame. Default is 4 cows
each (16 head), the fastest collapse.

Measured (5 runs each, 400 steps): 1 cow each holds at 92–93% grass indefinitely;
2 survives at 44–78%; 3 dies by step 148–213; 4 dies by 98–118.

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
  two cows takes welfare 90.2 vs ~66.
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

Measured, 24 fresh runs to the horizon: adaptive ahead in **23/24**, median
**+35%**, range −2% to +75%. The one loss was a drought-heavy draw where
destocking to 1 cow does not pay back inside 600 steps — the adaptive pasture
finished much greener (86% vs 51%) but behind on harvest. Lengthening the
horizon or skewing p(s) away from drought would remove it; left as is because
it is honest.

**Two findings worth not re-deriving:**

- **Collapse is absorbing, so a grass-keyed norm cannot work.** With
  `regrowBase: 0`, a flattened pasture has exactly zero regrowth forever. The
  first attempt keyed the norm on grass %, and *every* threshold set in a
  27-cell sweep came in **below** plain always-2 (best −3.5%, worst −69%): the
  opening 4-cow herd flattens the pasture before the rule can react, and no
  later destocking recovers it. The state worth conditioning on is the
  exogenous one that moves *first*. This is why the seasons exist.
- **The per-season optimum is also the best norm overall.** Sweeping all 256
  season→herd maps at 10 seeds, `[1,2,3,4]` ranks **1st** (+91% over always-2 at
  a 1200-step horizon). Holding weather fixed and sweeping herd size gives a
  clean monotone map — best is 1 cow at scale 0.4–0.6, 2 at 0.8–1.0, 3 at
  1.3–1.6, 4 at 2.0+ — and overstocking costs far more than understocking
  (at scale 1.0: 3 cows harvests 369 vs 2 cows' 647).

`pasture-model.js` reproduces `commons-sim.js` exactly — validated against the
simulation 1 balance table before anything was built on it (1-each 89–95%,
2-each 47–75%, 3-each dies 143–178, 4-each dies 98–103). If you change one,
check the other still matches.

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

- **Greedy** — shepherds 1-4 fixed forever at `[4, 1, 2, 3]` cows, the actual
  top pick of the first four agents in Project 01's `MIXED_VIEWS` table
  (computed, not chosen — those four happen to top out at all four different
  herd sizes). Nobody coordinates.
- **Fixed** — every shepherd fixed at 2 cows, forever. Project 02/03's
  recurring baseline norm.
- **Leader** — starts identical to Greedy. Shepherd 1 plays an adaptive rule
  from the start (`>= 80%` grass → 3 cows, else 2), re-checked every 20 steps;
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

**Measured (60 fresh seeds, horizon 600):** Leader beats Greedy in 59/60
runs — the robust, reliable result, and the one the section is actually
making the case for. Leader beats Fixed in only ~21/40 to 26/60 runs
depending on the exact threshold tried (roughly a coin flip at the `80%`
threshold used on the page); average margin against Fixed is close to zero
either way. A 27-point sweep over threshold (0.6-0.95) and reconsideration
interval (10/15/20/25/30 steps) found no combination that reliably beats
Fixed the way the original per-season `[1,2,3,4]` norm in Simulation 3 beat
always-2 (23/24, +35% median) — a single binary 2-or-3 rule keyed on a noisy
grass reading is a cruder instrument than four herd sizes keyed on an
exogenous season draw. This is left as the honest result rather than tuned
away: the section's real claim is "greedy uncoordinated behavior is bad, and
emulating a leader fixes that," not "this particular leader rule beats every
fixed norm."

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

All three sections collapse to one column at the same breakpoint, `900px`.

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
leaves the run paused, fast-forward cycles 1× → 3× → 8×.

Help popups read their numbers out of `CONFIG` at open time (`data-cfg`,
`data-derived`), so the explanations can't drift from the models.

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

No node, so: write a harness page into the scratch dir that pulls the real card
markup out of `index.html`, loads the real CSS/JS, drives the sim, and writes
results into a `<pre>`; then `google-chrome --headless=new --dump-dom` and scrape
it. Screenshots via `--screenshot`.

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
