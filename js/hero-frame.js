// Contact photo — tiny blob builders laying the picture frame brick by brick.
//
// Autoplaying, no controls, no sim/scene split, like js/leader-emergence.js
// and js/eaten-metric.js. Plays exactly once, the first time the photo
// scrolls into view — not once per visit, which read as a looping gimmick.
// The IntersectionObserver disconnects itself right after the first play.
//
// The whole animation is a pure function of one number: `render(t)`, t in 0..1
// across TOTAL seconds. Nothing else holds state. That is deliberate —
// `requestAnimationFrame` only fires about twice under headless Chrome, so a
// self-driving loop cannot be inspected mid-flight; driving `render()` by hand
// is the only way to screenshot an arbitrary beat (see CLAUDE.md).
//
// THIS IS PART ONE of the sequence: the blank square, the first three bricks
// of the bottom run, and the first brick of the left column. The rest of the
// frame — and the photo itself — are deliberately not built yet.
//
// Geometry: the photo is 300x300 and the SVG is 360x360 inset -30px, so one
// user unit is one CSS pixel and every constant below is literal pixels. The
// frame band sits at 22..34 against a photo occupying 30..330 — 8px proud of
// the photo, lapping 4px over its edge, which is where the photo's own mask
// has already feathered to near-transparent.
(function () {
  const host = document.querySelector(".hero-photo");
  if (!host) return;

  const NS = "http://www.w3.org/2000/svg";
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  // ---- Geometry -----------------------------------------------------------
  const W = 360;
  const OUT = 22, IN = 34;
  const FAR = W - OUT;              // 338
  const SPAN = FAR - OUT;           // 316
  const THICK = IN - OUT;           // 12
  const BRICK = SPAN / 4;           // 79 — "about a quarter of the frame"
  const FLOOR = FAR - THICK;        // 326 — top of the bottom run; the builders
                                    //       stand on this line, so a brick they
                                    //       set goes down at their feet

  function el(tag, attrs) {
    const e = document.createElementNS(NS, tag);
    for (const k in attrs) e.setAttribute(k, attrs[k]);
    return e;
  }
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  const lerp = (a, b, p) => a + (b - a) * p;
  // Progress through a beat that runs from a to b, as 0..1.
  const seg = (s, a, b) => clamp((s - a) / (b - a), 0, 1);
  const easeOut = (p) => 1 - Math.pow(1 - p, 3);
  const easeIn = (p) => p * p * p;
  const easeInOut = (p) => (p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2);

  // The drawing's coordinates are unchanged — the frame still lives at 22..338
  // in a 360 field — but the *view* is widened by VIEW_MARGIN on every side so
  // there is somewhere outside the frame for confetti to fly and for the
  // ladder and crane to be shoved to. Shifting the viewBox rather than
  // re-basing every constant is what keeps parts one to four untouched.
  const VIEW_MARGIN = 60;
  const svg = el("svg", {
    class: "hero-frame-svg",
    viewBox: `${-VIEW_MARGIN} ${-VIEW_MARGIN} ${W + 2 * VIEW_MARGIN} ${W + 2 * VIEW_MARGIN}`,
    "aria-hidden": "true", focusable: "false"
  });
  host.appendChild(svg);
  // The photo is the opening shot now, desaturated, instead of a blank square.
  // Set here rather than in the stylesheet so that with JS off, or under
  // reduced motion, the photo is simply itself.
  const photo = host.querySelector("img");
  if (photo) photo.style.filter = "grayscale(1)";

  // ---- Bricks --------------------------------------------------------------
  // Drawn before the workers so a brick being carried or lowered passes behind
  // the blob rather than slicing through it.
  const brickGroup = el("g", { class: "hero-frame-bricks" });
  svg.appendChild(brickGroup);

  function makeBrick(x, y, w, h) {
    const g = el("g", { opacity: "0" });
    g.appendChild(el("rect", {
      x, y, width: w, height: h, rx: 2,
      fill: "var(--hero-frame)", stroke: "var(--hero-frame-edge)", "stroke-width": 1
    }));
    brickGroup.appendChild(g);
    return { node: g, x, y, w, h };
  }

  // Bottom run, left to right — all four of it now.
  const bottom = [0, 1, 2, 3].map((i) =>
    makeBrick(OUT + i * BRICK, FLOOR, BRICK, THICK));
  // Left column, bottom upward. The first stacks on the bottom-left corner
  // brick, which is why it cannot go up until that one is set; the second
  // stacks on the first, which is why it needs a ladder.
  const leftBricks = [0, 1].map((i) =>
    makeBrick(OUT, FLOOR - (i + 1) * BRICK, THICK, BRICK));
  const leftBrick = leftBricks[0];

  // Position a brick by offsetting it from where it will finally sit, so the
  // final state is always "no transform at all".
  function poseBrick(b, dx, dy, rot, ox, oy, opacity) {
    const parts = [];
    if (dx || dy) parts.push(`translate(${dx.toFixed(2)} ${dy.toFixed(2)})`);
    if (rot) parts.push(`rotate(${rot.toFixed(2)} ${ox.toFixed(1)} ${oy.toFixed(1)})`);
    b.node.setAttribute("transform", parts.join(" "));
    b.node.setAttribute("opacity", opacity.toFixed(3));
  }

  // ---- The ladder ----------------------------------------------------------
  // Drawn with its origin at the base centre and the rails running up in -y,
  // so placing it is translate-to-the-feet plus one rotation. Carried flat at
  // rotate(90) (rails pointing right), stood up at LADDER_LEAN.
  // 172, not 118: part three nails the new beam at its joint with the existing
  // column (y 168, the midpoint of the frame's left side) and the ladder has to
  // reach it. Part two stops partway up instead — see CLIMB_P2.
  const LADDER_H = 172, LADDER_W = 16;
  const CLIMB_P2 = 0.63;        // height B works course two from
  const CLIMB_P3 = 1.0;         // height B nails the beam's joint from
  const LADDER_BASE = { x: 64, y: FLOOR };
  const LADDER_LEAN = -7.7;     // tips the top left, onto the column it serves
  const ladder = el("g", { class: "hero-ladder", opacity: "0" });
  svg.appendChild(ladder);
  [-LADDER_W / 2, LADDER_W / 2].forEach((x) => {
    ladder.appendChild(el("rect", {
      x: x - 1.6, y: -LADDER_H, width: 3.2, height: LADDER_H + 2, rx: 1.6,
      fill: "var(--hero-ladder)"
    }));
  });
  for (let r = 1; r <= 5; r++) {
    ladder.appendChild(el("rect", {
      x: -LADDER_W / 2, y: -r * (LADDER_H / 6) - 1.2,
      width: LADDER_W, height: 2.4, rx: 1.2, fill: "var(--hero-ladder)"
    }));
  }
  function poseLadder(x, y, rot, opacity) {
    ladder.setAttribute("transform",
      `translate(${x.toFixed(2)} ${y.toFixed(2)}) rotate(${rot.toFixed(2)})`);
    ladder.setAttribute("opacity", opacity.toFixed(3));
  }
  // Where a climber's feet sit at `p` of the way up, and where its hands reach.
  function ladderPoint(p) {
    const a = (LADDER_LEAN * Math.PI) / 180;
    const up = p * (LADDER_H - 26);
    return {
      x: LADDER_BASE.x - Math.sin(-a) * up,
      y: LADDER_BASE.y - Math.cos(a) * up
    };
  }

  // ---- Part three: the beam and the crane ----------------------------------
  // Two bricks joined end to end and craned up as one piece, completing the
  // left column to the top corner. The pair is rigid once joined, so both
  // halves take the SAME transform — expressed as "where is the attach point,
  // and how is the piece rotated about it". Hanging from a point near its top
  // end is what makes a flat beam swing upright on its own as it lifts, which
  // is the whole reason the lift reads as a lift.
  const BEAM_ATTACH = { x: 28, y: 30 };            // in the beam's final coords
  const BEAM_FLAT = { x: 110, y: 320, rot: -90 };  // lying on the floor
  const BEAM_LEN = 73;
  const beamBricks = [
    makeBrick(OUT, OUT, THICK, BEAM_LEN),                 // upper half standing
    makeBrick(OUT, OUT + BEAM_LEN, THICK, BEAM_LEN)       // lower half
  ];
  // Both halves are laid straight into their joined arrangement, so they share
  // ONE attach point — BEAM_FLAT — and differ only by their own rects. Giving
  // each piece its own attach was the bug that left a gap on the floor: the
  // transform is rigid-body, so the piece's position comes from its geometry,
  // not from where you point the anchor.
  //
  // Where each piece's centre lands on the floor, derived from that transform
  // rather than restated: rotating -90 about the attach maps a final y-offset
  // to an x-offset of the same size.
  const BEAM_PIECE_CX = beamBricks.map((b) =>
    BEAM_FLAT.x + ((b.y + b.h / 2) - BEAM_ATTACH.y));
  const BEAM_SEAM = BEAM_FLAT.x + ((OUT + BEAM_LEN) - BEAM_ATTACH.y);  // 175

  function poseBeamPiece(b, ax, ay, rot, opacity) {
    poseBrick(b, ax - BEAM_ATTACH.x, ay - BEAM_ATTACH.y, rot,
              BEAM_ATTACH.x, BEAM_ATTACH.y, opacity);
  }
  function poseBeam(ax, ay, rot, opacity) {
    beamBricks.forEach((b) => poseBeamPiece(b, ax, ay, rot, opacity));
  }

  // The crane. A flatbed with a mast that telescopes up and a jib that runs
  // out along the top, with a trolley and a hook on a line. A mast-and-jib
  // rather than a swinging boom because the hook then sits directly above the
  // load at every moment, which is both physically honest and far easier to
  // read at this size.
  const C_STAND_P2 = 100;   // where the hod carrier waits in part two
  const PARK_X = 286;
  const MAST_TOP = 10, MAST_X = 286;
  const JIB_END = OUT;                 // the jib reaches the column
  const crane = el("g", { class: "hero-crane", opacity: "0" });
  svg.appendChild(crane);
  const craneMast = crane.appendChild(el("rect", {
    x: MAST_X - 4, y: 296, width: 8, height: 0, rx: 2, fill: "var(--hero-hammer)"
  }));
  const craneJib = crane.appendChild(el("rect", {
    x: MAST_X, y: MAST_TOP - 3, width: 0, height: 6, rx: 3, fill: "var(--hero-hammer)"
  }));
  const craneBody = crane.appendChild(el("g"));
  craneBody.appendChild(el("rect", {
    x: PARK_X - 36, y: 296, width: 72, height: 18, rx: 4, fill: "var(--hero-vehicle)"
  }));
  craneBody.appendChild(el("rect", {
    x: PARK_X - 34, y: 284, width: 26, height: 14, rx: 3, fill: "var(--hero-vehicle-dark)"
  }));
  [PARK_X - 20, PARK_X + 20].forEach((wx) => {
    craneBody.appendChild(el("circle", { cx: wx, cy: 320, r: 6, fill: "var(--hero-worker-eye)" }));
    craneBody.appendChild(el("circle", { cx: wx, cy: 320, r: 2.4, fill: "var(--hero-hammer)" }));
  });
  const craneTrolley = crane.appendChild(el("rect", {
    x: 0, y: MAST_TOP - 6, width: 11, height: 12, rx: 2, fill: "var(--hero-vehicle-dark)"
  }));
  const craneLine = crane.appendChild(el("line", {
    stroke: "var(--hero-worker-eye)", "stroke-width": 1.2
  }));
  const craneHook = crane.appendChild(el("path", {
    d: "M 0 0 a 4 4 0 1 0 4 4", fill: "none",
    stroke: "var(--hero-hammer)", "stroke-width": 2, "stroke-linecap": "round"
  }));

  function poseCrane(dx, mastP, jibP, tx, hookY, opacity) {
    crane.setAttribute("opacity", opacity.toFixed(3));
    crane.setAttribute("transform", `translate(${dx.toFixed(2)} 0)`);
    const mastY = lerp(296, MAST_TOP, mastP);
    craneMast.setAttribute("y", mastY.toFixed(2));
    craneMast.setAttribute("height", Math.max(0, 296 - mastY).toFixed(2));
    const jibX = lerp(MAST_X, JIB_END, jibP);
    craneJib.setAttribute("x", jibX.toFixed(2));
    craneJib.setAttribute("width", Math.max(0, MAST_X - jibX).toFixed(2));
    craneJib.setAttribute("opacity", jibP > 0.01 ? "1" : "0");
    const showHook = jibP > 0.98 && hookY > MAST_TOP;
    craneTrolley.setAttribute("opacity", showHook ? "1" : "0");
    craneTrolley.setAttribute("x", (tx - 5.5).toFixed(2));
    craneLine.setAttribute("opacity", showHook ? "1" : "0");
    craneLine.setAttribute("x1", tx.toFixed(2));
    craneLine.setAttribute("x2", tx.toFixed(2));
    craneLine.setAttribute("y1", (MAST_TOP + 6).toFixed(2));
    craneLine.setAttribute("y2", (hookY - 4).toFixed(2));
    craneHook.setAttribute("opacity", showHook ? "1" : "0");
    craneHook.setAttribute("transform", `translate(${(tx - 2).toFixed(2)} ${(hookY - 4).toFixed(2)})`);
  }

  // ---- Part four: the duplicate wall, and the flyers -----------------------
  // The right-hand column is a *copy* of the left one, so it is built from the
  // same course heights rather than from fresh numbers — if the left column is
  // ever re-cut, this follows it.
  const rightColumn = leftBricks.concat(beamBricks)
    .map((b) => makeBrick(FAR - THICK, b.y, THICK, b.h));
  // The lintel that closes the square: it spans *between* the two columns,
  // because both already fill their own top corner.
  const topBrick = makeBrick(IN, OUT, SPAN - 2 * THICK, THICK);

  // Pointer. Drawn last of the scene furniture so it sits over everything, and
  // outside the crane/brick groups so nothing it drags can cover it.
  const cursor = el("g", { class: "hero-cursor", opacity: "0" });
  svg.appendChild(cursor);
  const cursorRing = cursor.appendChild(el("circle", {
    cx: 1, cy: 1, r: 4, fill: "none", stroke: "var(--hero-cursor)", "stroke-width": 2, opacity: "0"
  }));
  cursor.appendChild(el("path", {
    d: "M 0 0 L 0 17 L 4.6 12.8 L 7.4 18.6 L 10.4 17.2 L 7.6 11.6 L 13.4 11.2 Z",
    fill: "var(--hero-cursor)", stroke: "var(--hero-cursor-edge)", "stroke-width": 1.2,
    "stroke-linejoin": "round"
  }));
  function poseCursor(x, y, press, ring, opacity) {
    cursor.setAttribute("opacity", opacity.toFixed(3));
    cursor.setAttribute("transform",
      `translate(${x.toFixed(2)} ${y.toFixed(2)}) scale(${(1 - press * 0.16).toFixed(3)})`);
    cursorRing.setAttribute("opacity", ring > 0 ? (ring * 0.8).toFixed(3) : "0");
    cursorRing.setAttribute("r", (4 + (1 - ring) * 11).toFixed(2));
  }

  // ---- Part five: curtains and confetti ------------------------------------
  // The pair cover a square a little larger than the frame itself — photo,
  // frame and a margin of wall around both — rather than sitting flush with
  // the brickwork, which is what made an early cut read as curtains hung
  // *inside* a window frame instead of drawn across the whole picture.
  const CURTAIN_PAD = 24;
  const CX0 = OUT - CURTAIN_PAD, CX1 = FAR + CURTAIN_PAD;
  const CY0 = OUT - CURTAIN_PAD, CY1 = FAR + CURTAIN_PAD;
  const PANEL_W = (CX1 - CX0) / 2;
  const CURTAIN_REST = 0.07;        // how much stays gathered when fully open
  const CURTAIN_FOLDS = 9;
  // The bottom trails the top by this many seconds of travel, so the leading
  // edge reads as being *pulled* — top first, weight dragging the hem behind
  // it — rather than the whole panel sliding as one rigid sheet.
  const CURTAIN_LAG = 0.5;

  function curtainDrive(sec) {
    const shut = easeInOut(seg(sec, P5.close[0], P5.close[1]));
    const part = easeInOut(seg(sec, P5.open[0], P5.open[1]));
    return lerp(0, 1, shut) - (1 - CURTAIN_REST) * part;
  }

  function makeCurtain(side) {
    const g = el("g", { opacity: "0" });
    const pivotX = side < 0 ? CX0 : CX1;
    const dir = side < 0 ? 1 : -1;
    const base = g.appendChild(el("path", { fill: "var(--hero-curtain)" }));

    // Pleats: rounded, unevenly spaced and swaying — deterministic per fold
    // (hash(i, side + salt)) so the irregularity is organic but reproducible.
    // Most are shadow; a few, picked the same way, catch the light instead —
    // that alternation of dark and lit rounded folds is what a flat stripe
    // can't give you, and it's the difference between "red plastic" and
    // "velvet".
    const folds = [];
    for (let i = 1; i < CURTAIN_FOLDS; i++) {
      const shine = hash(i, side + 60) > 0.62;
      const node = g.appendChild(el("path", {
        fill: shine ? "var(--hero-curtain-shine)" : "var(--hero-curtain-fold)",
        opacity: shine
          ? (0.20 + hash(i, side + 70) * 0.18).toFixed(2)
          : (0.30 + hash(i, side + 40) * 0.30).toFixed(2)
      }));
      folds.push({
        node,
        frac: i / CURTAIN_FOLDS,
        jitter: (hash(i, side) - 0.5) * 4,
        fw: 3.4 + hash(i, side + 10) * 2.8,
        bow: 2.6 + hash(i, side + 20) * 2.4,
        phase: hash(i, side + 30) * Math.PI * 2
      });
    }

    svg.appendChild(g);
    return { node: g, pivotX, dir, base, folds };
  }
  const curtains = [makeCurtain(-1), makeCurtain(1)];

  // sxTop/sxBottom are both 0..1 (0.07 at rest-open) but arrive at different
  // times — see CURTAIN_LAG — which is what bows the leading edge and lets
  // the pleats slant rather than stay vertical while the panel is in motion.
  function poseCurtains(sxTop, sxBottom, t) {
    const midY = (CY0 + CY1) / 2;
    curtains.forEach((c) => {
      const edgeTopX = c.pivotX + c.dir * PANEL_W * sxTop;
      const edgeBottomX = c.pivotX + c.dir * PANEL_W * sxBottom;
      c.node.setAttribute("opacity", (sxTop > 0.001 || sxBottom > 0.001) ? "1" : "0");

      // Base panel: the leading edge is a single bowed curve between the top
      // and bottom targets, not a straight line — that bow is the drag. The
      // hem is scalloped rather than cut off flat, because a curtain has
      // weight and pools rather than ending in a straight line.
      const bulge = (edgeTopX - edgeBottomX) * 0.3;
      let d = `M ${c.pivotX.toFixed(2)} ${CY0.toFixed(2)} L ${edgeTopX.toFixed(2)} ${CY0.toFixed(2)} ` +
        `Q ${((edgeTopX + edgeBottomX) / 2 + bulge).toFixed(2)} ${midY.toFixed(2)} ${edgeBottomX.toFixed(2)} ${CY1.toFixed(2)} `;
      const scallops = 4;
      for (let i = 0; i < scallops; i++) {
        const xA = edgeBottomX + (c.pivotX - edgeBottomX) * (i / scallops);
        const xB = edgeBottomX + (c.pivotX - edgeBottomX) * ((i + 1) / scallops);
        d += `Q ${((xA + xB) / 2).toFixed(2)} ${(CY1 + 6).toFixed(2)} ${xB.toFixed(2)} ${CY1.toFixed(2)} `;
      }
      d += `L ${c.pivotX.toFixed(2)} ${CY0.toFixed(2)} Z`;
      c.base.setAttribute("d", d);

      // Each pleat's own top/bottom x follows the same lagged interpolation
      // as the panel's leading edge, at its own fraction across the width,
      // plus a slow independent sway so nine folds don't move as one plane.
      c.folds.forEach((f) => {
        const topX = c.pivotX + (edgeTopX - c.pivotX) * f.frac + f.jitter;
        const bottomX = c.pivotX + (edgeBottomX - c.pivotX) * f.frac + f.jitter;
        const sway = Math.sin(t * 1.4 + f.phase) * f.bow;
        const midX = (topX + bottomX) / 2 + sway;
        f.node.setAttribute("d",
          `M ${(topX - f.fw).toFixed(2)} ${CY0.toFixed(2)} ` +
          `Q ${(midX - f.bow).toFixed(2)} ${midY.toFixed(2)} ${(bottomX - f.fw).toFixed(2)} ${CY1.toFixed(2)} ` +
          `L ${(bottomX + f.fw).toFixed(2)} ${CY1.toFixed(2)} ` +
          `Q ${(midX + f.bow).toFixed(2)} ${midY.toFixed(2)} ${(topX + f.fw).toFixed(2)} ${CY0.toFixed(2)} Z`);
      });
    });
  }

  // Confetti. Deterministic — a hash of the piece index, not Math.random, so
  // every replay is the same and a screenshot of a given beat is reproducible.
  const CONFETTI_N = 34;
  const CONFETTI_FILL = ["--hero-hat", "--hero-vehicle", "--hero-drop",
                         "--hero-frame", "--hero-curtain", "--hero-wing"];
  function hash(i, salt) {
    const x = Math.sin(i * 127.1 + salt * 311.7) * 43758.5453;
    return x - Math.floor(x);
  }
  const confetti = [];
  for (let i = 0; i < CONFETTI_N; i++) {
    const side = i % 2 === 0 ? -1 : 1;
    confetti.push({
      side,
      x0: side < 0 ? OUT : FAR,
      y0: OUT + hash(i, 5) * 40,
      vx: side * (10 + hash(i, 1) * 34),
      vy: -(46 + hash(i, 2) * 52),
      spin: (hash(i, 3) < 0.5 ? -1 : 1) * (150 + hash(i, 4) * 420),
      node: svg.appendChild(el("rect", {
        width: 5.4, height: 3, rx: 0.6, opacity: "0",
        fill: `var(${CONFETTI_FILL[i % CONFETTI_FILL.length]})`
      }))
    });
  }
  const CONFETTI_G = 78;          // units per second squared

  function poseConfetti(t) {
    confetti.forEach((c) => {
      if (t <= 0) { c.node.setAttribute("opacity", "0"); return; }
      const lag = hash(c.vx, 7) * 0.35;      // not all at once
      const u = t - lag;
      if (u <= 0) { c.node.setAttribute("opacity", "0"); return; }
      const x = c.x0 + c.vx * u;
      const y = c.y0 + c.vy * u + 0.5 * CONFETTI_G * u * u;
      c.node.setAttribute("opacity", (1 - clamp((u - 3.2) / 1.4, 0, 1)).toFixed(3));
      c.node.setAttribute("transform",
        `translate(${x.toFixed(1)} ${y.toFixed(1)}) rotate(${(c.spin * u).toFixed(1)})`);
    });
  }

  // ---- A blob worker -------------------------------------------------------
  // Feet at the origin, body above, so positioning is a translate to where it
  // stands. The arm is its own group so a hammer can ride it.
  function makeWorker() {
    const g = el("g", { class: "hero-worker", opacity: "0" });
    const legs = [
      g.appendChild(el("rect", { x: -3.4, y: -4, width: 2.2, height: 4, rx: 1.1, fill: "var(--hero-worker-dark)" })),
      g.appendChild(el("rect", { x: 1.2, y: -4, width: 2.2, height: 4, rx: 1.1, fill: "var(--hero-worker-dark)" }))
    ];
    const body = el("g");
    g.appendChild(body);
    body.appendChild(el("ellipse", { cx: 0, cy: -9.5, rx: 6.4, ry: 6, fill: "var(--hero-worker)" }));

    const armG = el("g");
    body.appendChild(armG);
    armG.appendChild(el("rect", { x: 4.6, y: -12, width: 5.4, height: 2.2, rx: 1.1, fill: "var(--hero-worker-dark)" }));
    // Hammer: a stubby handle with a head, hidden unless it is being swung.
    const hammer = el("g", { opacity: "0" });
    armG.appendChild(hammer);
    hammer.appendChild(el("rect", { x: 9.4, y: -11.8, width: 5.6, height: 1.8, rx: 0.9, fill: "var(--hero-worker-eye)" }));
    hammer.appendChild(el("rect", { x: 14.2, y: -14.4, width: 3, height: 7, rx: 1, fill: "var(--hero-hammer)" }));

    const eyes = [
      body.appendChild(el("circle", { cx: -2.2, cy: -10.4, r: 1.05, fill: "var(--hero-worker-eye)" })),
      body.appendChild(el("circle", { cx: 1.6, cy: -10.4, r: 1.05, fill: "var(--hero-worker-eye)" }))
    ];
    // Mouth — only shown for the "phew", where it does most of the work.
    const mouth = body.appendChild(el("ellipse", {
      cx: -0.3, cy: -7.6, rx: 1.5, ry: 1.1, fill: "var(--hero-worker-eye)", opacity: "0"
    }));
    body.appendChild(el("path", { d: "M -6.2 -14.4 A 6.2 5.6 0 0 1 6.2 -14.4 Z", fill: "var(--hero-hat)" }));
    body.appendChild(el("rect", { x: -7.6, y: -14.9, width: 15.2, height: 2.1, rx: 1.05, fill: "var(--hero-hat)" }));

    // Effort puff / relief breath, drawn outside the body so it does not
    // inherit the squash.
    const puff = g.appendChild(el("g", { opacity: "0" }));
    puff.appendChild(el("ellipse", { cx: 0, cy: 0, rx: 3.4, ry: 2.2, fill: "var(--hero-puff)" }));
    puff.appendChild(el("ellipse", { cx: 4.6, cy: 0.8, rx: 2.1, ry: 1.4, fill: "var(--hero-puff)" }));
    // Strain drop, for the heavy lift.
    const drop = g.appendChild(el("path", {
      d: "M 0 -3.2 C 1.9 -1.1 2.4 0.2 2.4 1.1 A 2.4 2.4 0 0 1 -2.4 1.1 C -2.4 0.2 -1.9 -1.1 0 -3.2 Z",
      fill: "var(--hero-drop)", opacity: "0"
    }));

    // Wings, for the pair that arrive by air. Inserted *behind* the blob so
    // they read as being on its back, and hidden unless `flap` is passed.
    const wings = el("g", { opacity: "0" });
    body.insertBefore(wings, body.firstChild);
    const wingL = wings.appendChild(el("ellipse", {
      cx: -11, cy: -12, rx: 7, ry: 3.6, fill: "var(--hero-wing)"
    }));
    const wingR = wings.appendChild(el("ellipse", {
      cx: 11, cy: -12, rx: 7, ry: 3.6, fill: "var(--hero-wing)"
    }));

    svg.appendChild(g);
    return { node: g, legs, body, armG, hammer, eyes, mouth, puff, drop, wings, wingL, wingR };
  }

  const workerA = makeWorker();   // lays the bottom run
  const workerB = makeWorker();   // raises the left column, ladder and all
  const workerC = makeWorker();   // the hod carrier: passes bricks up to B
  const flyers = [makeWorker(), makeWorker()];   // the winged pair, part four

  // `walk` drives the bob/step cycle, `arm` is the arm angle in degrees
  // (0 = level, negative = raised), `lean` tilts the whole blob.
  function poseWorker(w, o) {
    const walk = o.walk || 0;
    const bob = o.still ? 0 : Math.sin(walk * Math.PI * 2) * 1.1;
    const squash = (o.squash || 1) * (o.still ? 1 : 1 + Math.sin(walk * Math.PI * 4) * 0.045);
    w.node.setAttribute("transform",
      `translate(${o.x.toFixed(2)} ${o.y.toFixed(2)}) scale(${o.facing || 1} 1)` +
      (o.lean ? ` rotate(${o.lean.toFixed(2)} 0 -8)` : ""));
    w.node.setAttribute("opacity", (o.opacity == null ? 1 : o.opacity).toFixed(3));
    w.body.setAttribute("transform",
      `translate(${(o.shift || 0).toFixed(2)} ${bob.toFixed(2)}) scale(${(1 / squash).toFixed(3)} ${squash.toFixed(3)})`);
    const step = o.still ? 0 : Math.sin(walk * Math.PI * 2) * 1.6;
    w.legs[0].setAttribute("transform", `translate(${step.toFixed(2)} 0)`);
    w.legs[1].setAttribute("transform", `translate(${(-step).toFixed(2)} 0)`);
    w.armG.setAttribute("transform", `rotate(${(o.arm || 0).toFixed(1)} 4.6 -10.9)`);
    w.hammer.setAttribute("opacity", o.hammer ? "1" : "0");
    w.mouth.setAttribute("opacity", (o.mouth || 0).toFixed(2));
    w.mouth.setAttribute("ry", (1.1 + (o.mouth || 0) * 0.8).toFixed(2));
    if (o.puff > 0) {
      w.puff.setAttribute("opacity", (o.puff * 0.75).toFixed(3));
      w.puff.setAttribute("transform",
        `translate(${(8 + o.puffOut * 9).toFixed(2)} ${(-10.5).toFixed(2)}) scale(${(0.6 + o.puffOut * 0.8).toFixed(2)})`);
    } else {
      w.puff.setAttribute("opacity", "0");
    }
    if (o.flap != null) {
      w.wings.setAttribute("opacity", "1");
      // One beat, mirrored: the far wing lags half a cycle so the pair never
      // looks like a single rigid shape.
      const beat = Math.sin(o.flap * Math.PI * 2);
      w.wingL.setAttribute("transform", `rotate(${(beat * 34).toFixed(1)} -5 -12)`);
      w.wingR.setAttribute("transform", `rotate(${(-beat * 34).toFixed(1)} 5 -12)`);
    } else {
      w.wings.setAttribute("opacity", "0");
    }
    if (o.drop > 0) {
      w.drop.setAttribute("opacity", (o.drop).toFixed(3));
      w.drop.setAttribute("transform", `translate(-7.5 ${(-16 + o.dropFall * 7).toFixed(2)})`);
    } else {
      w.drop.setAttribute("opacity", "0");
    }
  }

  // Every blob swings at the same rate, and `blows()` is how that is kept
  // true: the number of strikes comes from how long the beat is, not from a
  // literal at each call site. Hand-written counts had A hammering at ~9 blows
  // a second and B nailing at 3.5, which read as two different characters.
  const HAMMER_HZ = 9;
  const blows = (a, b) => Math.max(1, Math.round((b - a) * HAMMER_HZ));

  // A hammer swing: rises and strikes, `n` times across 0..1.
  function swing(p, n) {
    const phase = (p * n) % 1;
    // Slow lift, fast fall — the fall is the hit.
    return phase < 0.62
      ? -70 * easeInOut(phase / 0.62)
      : -70 * (1 - easeIn((phase - 0.62) / 0.38));
  }
  // True just after each strike lands, for sparks.
  function struck(p, n) {
    const phase = (p * n) % 1;
    return phase > 0.94 ? (phase - 0.94) / 0.06 : 0;
  }

  // ---- Sparks --------------------------------------------------------------
  const sparks = [0, 1, 2].map(() => svg.appendChild(el("rect", {
    width: 1.8, height: 1.8, rx: 0.9, fill: "var(--hero-hat)", opacity: "0"
  })));
  function showSparks(x, y, energy) {
    sparks.forEach((s, i) => {
      if (energy <= 0) { s.setAttribute("opacity", "0"); return; }
      const a = -0.5 - i * 0.55;
      const d = 3 + (1 - energy) * 7 + i;
      s.setAttribute("x", (x + Math.cos(a) * d).toFixed(2));
      s.setAttribute("y", (y + Math.sin(a) * d).toFixed(2));
      s.setAttribute("opacity", (energy * 0.9).toFixed(3));
    });
  }

  // ---- Timeline, in seconds ------------------------------------------------
  // Worker A runs the same cycle three times, once per bottom brick: walk on
  // carrying it overhead, set it down underfoot, hammer the left joint, walk
  // to the right end, hammer that joint, walk off for the next one.
  // The three bottom bricks run back to back; the fourth waits until the right
  // lane is clear again (see the lane note below), and then runs straight
  // through B's hand-off, which is what "A carries on with the last brick"
  // should look like.
  const A_STARTS = [0, 4.6, 9.2, 18.1];
  const A = A_STARTS.map((s) => {
    return {
      enter: s, arrive: s + 1.5, drop: s + 1.95,
      hamL: [s + 2.15, s + 2.75], stepR: [s + 2.75, s + 2.95], hamR: [s + 2.95, s + 3.55],
      leave: s + 3.55, gone: s + 4.3
    };
  });
  // Worker B starts only once A's first brick is nailed down — the left column
  // has nothing to stand on before that.
  const B = {
    enter: 3.6, arrive: 5.2,
    push: [5.2, 7.2],       // heaving it up the left edge
    wobble: [7.2, 8.6],     // it does not settle quietly
    phew: [8.6, 9.8],
    nail: [10.0, 11.6],
    done: 11.6
  };
  // Part two. The second course of the left column is out of reach from the
  // floor, so B fetches a ladder, and the brick has to come up to it: C is a
  // hod carrier, on stage only to make the hand-off. Meanwhile A is still
  // working the bottom run — its fourth cycle (13.8-18.1s) runs right through
  // B's climb, which is the point of staggering them.
  // **Everyone works on one line, so the lanes are the hard constraint.**
  // Two rules, both learned by breaking them: a blob may never walk through a
  // standing brick (reads as a bug), and the right-hand approach is
  // single-file. So the order on the right is A's third brick out by 13.5,
  // B out-and-back for the ladder 13.6-15.9, C on at 16.2, A's fourth at 18.1
  // — never two at once. B and C both come from the right for the same reason
  // A does: the left column is up now, and anything entering from the left
  // would walk straight through it.
  const B2 = {
    fetch: [13.6, 14.4],    // walks off for the ladder
    carry: [14.4, 15.9],    // comes back with it held flat
    raise: [15.9, 16.8],    // stands it against the column
    climb: [16.8, 18.3],
    take:  [18.5, 19.6],    // the brick comes up from C
    place: [19.6, 20.7],    // tilts it upright and seats it on course one
    tap:   [20.7, 21.6]
  };
  // C is a hod carrier: on stage only to make the hand-off, and it stays put
  // afterwards rather than walking off — there are more courses to come, and
  // leaving would have meant crossing A's fourth brick on the way out.
  const C = {
    enter: 16.2, arrive: 17.9,
    hand:  [18.5, 19.6]
  };
  // Part three. B comes down, B and C fetch a brick each and join them on the
  // floor, A arrives with the crane, they hook the joined beam on, it is lifted
  // and swung upright, traversed across and seated on the column — then B goes
  // back up the ladder and nails the joint.
  //
  // Lane order on the single-file right-hand approach: C and B both go out
  // together (B starts left of C and never catches it), C comes back first and
  // walks *past* to the far side, B comes back and stops short of C, then the
  // crane arrives last. Nobody overtakes anybody.
  const P3 = {
    descend: [22.6, 23.6],
    out:     [23.7, 25.0],   // C leads, B follows a beat behind
    cBack:   [25.2, 26.8],   // lays the upper half, at x 102-175
    bBack:   [27.0, 28.4],   // lays the lower half, at x 175-248
    join:    [28.6, 29.8],   // both hammer the seam
    drive:   [30.0, 31.6],
    deploy:  [31.6, 33.2],   // mast telescopes up, then the jib runs out
    lower:   [33.2, 34.1],
    hook:    [34.1, 35.2],
    lift:    [35.2, 37.6],   // swings upright as it rises
    traverse:[37.6, 38.8],   // trolley runs left, seating it on the column
    climb:   [39.0, 40.4],
    nail:    [40.4, 41.6]
  };
  // Part four. Someone off-stage takes a cursor to the left wall and drags a
  // copy of it across to the right; the blobs scatter, and the travelling wall
  // shoves the ladder and the crane off the field ahead of it. Then a winged
  // pair fly the lintel down and close the square.
  const P4 = {
    cDown:    [41.8, 42.9],   // C comes off the ladder first
    cursorIn: [42.7, 43.7],
    press:    [43.7, 44.3],
    drag:     [44.3, 47.3],
    release:  [47.3, 48.0],
    flyIn:    [48.2, 50.4],
    setTop:   [50.4, 51.6],
    flyOut:   [51.6, 52.8]
  };
  const FLEE = [44.3, 46.3];
  // Part five. Curtains sweep shut across the finished frame, hold, then draw
  // back on the photo in colour while confetti goes up outside the frame.
  const P5 = {
    close: [53.2, 55.0],
    open:  [57.0, 59.0],
    end:   62.3
  };
  const TOTAL = P5.end;   // 62.3s at PACE 1; ~40s as paced

  const HOLD_Y = -26;        // how high above its feet a worker holds a brick
  // Walk-on points, just off the frame but *inside* the SVG box: the box is
  // 360 wide against a frame spanning 22..338, so there are 22 units of wing
  // either side. Anything further out spilled over the hero text, because the
  // overlay sits above the photo and cannot be clipped by it.
  //
  // A comes from the RIGHT and B from the LEFT, and that is not decoration.
  // The bottom run is laid left to right, so the mason arriving from the
  // unbuilt side never has to cross finished work — when A walked on from the
  // left it passed straight through the left column B had just stood up.
  const ENTER_A = FAR + 12;
  const ENTER_B = -10;

  // ---- Part three ----------------------------------------------------------
  function renderPartThree(s) {
    let sparkAt = null, sparkEnergy = 0;

    // Everything already built just stands there.
    bottom.forEach((b) => poseBrick(b, 0, 0, 0, 0, 0, 1));
    leftBricks.forEach((b) => poseBrick(b, 0, 0, 0, 0, 0, 1));
    poseLadder(LADDER_BASE.x, LADDER_BASE.y, LADDER_LEAN, 1);

    const climbTop = ladderPoint(CLIMB_P2);
    const nailTop = ladderPoint(CLIMB_P3);
    const JOINT_Y = OUT + 2 * BEAM_LEN;        // 168 — beam meets the column
    const C_LAY = BEAM_PIECE_CX[0] - BEAM_LEN / 2 - 14;   // left of its piece
    const B_LAY = BEAM_PIECE_CX[1] + BEAM_LEN / 2 + 14;   // right of its
    const C_JOIN = BEAM_SEAM - 12, B_JOIN = BEAM_SEAM + 12;
    const C_HOOK = BEAM_FLAT.x - 14, B_HOOK = BEAM_FLAT.x + 14;

    // ---- The two halves, then the joined beam -----------------------------
    const lifted = s >= P3.lift[0];
    if (!lifted) {
      // Upper half: carried on by C, then lying on the floor.
      // Each half is carried on overhead and set down into place. Offsetting
      // the shared attach by (worker - the piece's own resting centre) is what
      // keeps the piece over the blob while it walks.
      [[0, P3.cBack, C_LAY], [1, P3.bBack, B_LAY]].forEach(([i, beat, stand]) => {
        const piece = beamBricks[i];
        if (s < beat[0]) { poseBeamPiece(piece, 0, 0, 0, 0); return; }
        if (s >= beat[1]) {
          poseBeamPiece(piece, BEAM_FLAT.x, BEAM_FLAT.y, BEAM_FLAT.rot, 1);
          return;
        }
        const p = easeInOut(seg(s, beat[0], beat[1]));
        const wx = lerp(ENTER_A, stand, p);
        const carry = 1 - easeInOut(clamp((p - 0.72) / 0.28, 0, 1));
        poseBeamPiece(piece,
          BEAM_FLAT.x + (wx - BEAM_PIECE_CX[i]) * carry,
          BEAM_FLAT.y - 20 * carry, BEAM_FLAT.rot, 1);
      });
    }

    // ---- The crane ---------------------------------------------------------
    let hookY = 999, trolleyX = BEAM_FLAT.x;
    if (s < P3.drive[0]) {
      poseCrane(0, 0, 0, trolleyX, 999, 0);
    } else {
      const drive = easeOut(seg(s, P3.drive[0], P3.drive[1]));
      const dx = lerp(150, 0, drive);
      // Mast first, jib second — a jib running out of a half-raised mast looks
      // like a bug rather than a machine.
      const dep = seg(s, P3.deploy[0], P3.deploy[1]);
      const mastP = easeInOut(clamp(dep / 0.62, 0, 1));
      const jibP = easeInOut(clamp((dep - 0.62) / 0.38, 0, 1));
      if (s >= P3.lower[0]) {
        const down = easeInOut(seg(s, P3.lower[0], P3.lower[1]));
        hookY = lerp(MAST_TOP + 20, BEAM_FLAT.y - 6, down);
      }
      if (s >= P3.lift[0]) {
        const up = easeInOut(seg(s, P3.lift[0], P3.lift[1]));
        hookY = lerp(BEAM_FLAT.y - 6, BEAM_ATTACH.y - 6, up);
      }
      if (s >= P3.traverse[0]) {
        hookY = BEAM_ATTACH.y - 6;
        trolleyX = lerp(BEAM_FLAT.x, BEAM_ATTACH.x, easeInOut(seg(s, P3.traverse[0], P3.traverse[1])));
      }
      poseCrane(dx, mastP, jibP, trolleyX, hookY, 1);
    }

    // The beam hangs from the hook from the moment it is lifted, and swings
    // upright on its own because it is slung near one end. The turn finishes
    // well before the top of the lift, so what the eye follows at the end is a
    // clean vertical rise rather than a spin.
    if (lifted) {
      const up = easeInOut(seg(s, P3.lift[0], P3.lift[1]));
      const turn = easeInOut(clamp(up / 0.55, 0, 1));
      poseBeam(trolleyX, hookY + 6, lerp(BEAM_FLAT.rot, 0, turn), 1);
    } else if (s >= P3.hook[0]) {
      poseBeam(BEAM_FLAT.x, BEAM_FLAT.y, BEAM_FLAT.rot, 1);
    }

    // ---- Worker A: brings the crane in and works the lever -----------------
    if (s < P3.drive[0]) {
      poseWorker(workerA, { x: ENTER_A, y: FLOOR, opacity: 0 });
    } else {
      const drive = easeOut(seg(s, P3.drive[0], P3.drive[1]));
      const ax = lerp(ENTER_A + 40, PARK_X - 48, drive);
      const working = s >= P3.deploy[0] && s < P3.traverse[1];
      poseWorker(workerA, {
        x: ax, y: FLOOR, walk: s * 2.6, still: drive >= 1, facing: -1,
        arm: working ? -60 + Math.sin(s * 5) * 30 : -14,
        opacity: easeOut(seg(s, P3.drive[0], P3.drive[0] + 0.3))
      });
    }

    // ---- Worker B ----------------------------------------------------------
    if (s < P3.descend[1]) {
      // Down the ladder.
      const p = easeInOut(seg(s, P3.descend[0], P3.descend[1]));
      const pt = ladderPoint(lerp(CLIMB_P2, 0, p));
      poseWorker(workerB, { x: pt.x, y: pt.y, walk: s * 3.6, facing: -1, arm: -70 });
    } else if (s < P3.bBack[0]) {
      // Out for a brick, a beat behind C so it never overtakes.
      const p = easeInOut(seg(s, P3.out[0] + 0.3, P3.out[1]));
      poseWorker(workerB, {
        x: lerp(LADDER_BASE.x, ENTER_A, p), y: FLOOR, walk: s * 2.6,
        arm: -12, facing: 1, opacity: 1 - easeIn(p)
      });
    } else if (s < P3.join[0]) {
      const p = easeInOut(seg(s, P3.bBack[0], P3.bBack[1]));
      poseWorker(workerB, {
        x: lerp(ENTER_A, B_LAY, p), y: FLOOR, walk: s * 2.6, still: p >= 1,
        arm: p > 0.72 ? lerp(-95, -30, (p - 0.72) / 0.28) : -95, facing: -1,
        opacity: easeOut(seg(s, P3.bBack[0], P3.bBack[0] + 0.3))
      });
    } else if (s < P3.hook[0]) {
      const p = seg(s, P3.join[0], P3.join[1]);
      const walk = easeInOut(clamp(p * 2.4, 0, 1));
      const hamming = p > 0.45 && p < 1;
      poseWorker(workerB, {
        x: lerp(B_LAY, B_JOIN, walk), y: FLOOR, walk: s * 2.6, still: hamming,
        facing: -1, arm: hamming ? swing(seg(s, P3.join[0] + 0.55, P3.join[1]), blows(P3.join[0] + 0.55, P3.join[1])) : -20,
        hammer: hamming
      });
      const hit = hamming ? struck(seg(s, P3.join[0] + 0.55, P3.join[1]), blows(P3.join[0] + 0.55, P3.join[1])) : 0;
      if (hit > 0) { sparkAt = { x: BEAM_SEAM, y: BEAM_FLAT.y - 8 }; sparkEnergy = 1 - hit; }
    } else if (s < P3.lift[0]) {
      // Hooking it on: reaches up to the hook with C on the other side.
      const p = easeInOut(seg(s, P3.hook[0], P3.hook[1]));
      poseWorker(workerB, {
        x: lerp(B_JOIN, B_HOOK, clamp(p * 1.6, 0, 1)), y: FLOOR, still: p > 0.55,
        walk: s * 2.6, facing: -1, arm: lerp(-20, -112, p)
      });
    } else {
      // Stands where it hooked on and watches it go up. **C does the nailing,
      // not B** — C is the one standing nearer the ladder, and the two cannot
      // trade places: C is left of B at the hook, so whichever of them walks
      // to the ladder's foot has to pass straight through the other.
      poseWorker(workerB, { x: B_HOOK, y: FLOOR, still: true, facing: -1, arm: -52 });
    }

    // ---- Worker C ----------------------------------------------------------
    if (s < P3.cBack[0]) {
      const p = easeInOut(seg(s, P3.out[0], P3.out[1] - 0.3));
      poseWorker(workerC, {
        x: lerp(C_STAND_P2, ENTER_A, p), y: FLOOR, walk: s * 2.6,
        arm: -12, facing: 1, opacity: 1 - easeIn(p)
      });
    } else if (s < P3.join[0]) {
      const p = easeInOut(seg(s, P3.cBack[0], P3.cBack[1]));
      poseWorker(workerC, {
        x: lerp(ENTER_A, C_LAY, p), y: FLOOR, walk: s * 2.6, still: p >= 1,
        arm: p > 0.72 ? lerp(-95, -30, (p - 0.72) / 0.28) : -95, facing: -1,
        opacity: easeOut(seg(s, P3.cBack[0], P3.cBack[0] + 0.3))
      });
    } else if (s < P3.hook[0]) {
      const p = seg(s, P3.join[0], P3.join[1]);
      const walk = easeInOut(clamp(p * 2.4, 0, 1));
      const hamming = p > 0.45 && p < 1;
      poseWorker(workerC, {
        x: lerp(C_LAY, C_JOIN, walk), y: FLOOR, walk: s * 2.6, still: hamming,
        facing: 1, arm: hamming ? swing(seg(s, P3.join[0] + 0.7, P3.join[1]), blows(P3.join[0] + 0.7, P3.join[1])) : -20,
        hammer: hamming
      });
    } else if (s < P3.lift[0]) {
      const p = easeInOut(seg(s, P3.hook[0], P3.hook[1]));
      poseWorker(workerC, {
        x: lerp(C_JOIN, C_HOOK, clamp(p * 1.6, 0, 1)), y: FLOOR, still: p > 0.55,
        walk: s * 2.6, facing: 1, arm: lerp(-20, -112, p)
      });
    } else if (s < P3.climb[0]) {
      // Crosses to the ladder's foot while the beam is still on its way up.
      const walk = easeInOut(seg(s, P3.lift[0] + 0.4, P3.lift[0] + 1.4));
      poseWorker(workerC, {
        x: lerp(C_HOOK, LADDER_BASE.x + 16, walk), y: FLOOR, walk: s * 2.6,
        still: walk >= 1, facing: -1, arm: walk >= 1 ? -52 : -20
      });
    } else if (s < P3.nail[0]) {
      const cp = seg(s, P3.climb[0], P3.climb[1]);
      if (cp < 0.2) {
        poseWorker(workerC, {
          x: lerp(LADDER_BASE.x + 16, LADDER_BASE.x, cp / 0.2), y: FLOOR,
          walk: s * 2.6, arm: -22, facing: -1
        });
      } else {
        const pt = ladderPoint(easeInOut((cp - 0.2) / 0.8) * CLIMB_P3);
        poseWorker(workerC, {
          x: pt.x, y: pt.y, walk: s * 3.6, facing: -1,
          arm: -72 + Math.sin(s * 8) * 26
        });
      }
    } else {
      // Nails the joint — the midpoint of the frame's left side.
      const p = seg(s, P3.nail[0], P3.nail[1]);
      const n = blows(P3.nail[0], P3.nail[1]);
      poseWorker(workerC, {
        x: nailTop.x, y: nailTop.y, still: true, facing: -1,
        arm: swing(p, n), hammer: true, lean: -4
      });
      const hit = struck(p, n);
      if (hit > 0 && sparkEnergy === 0) { sparkAt = { x: IN + 2, y: JOINT_Y }; sparkEnergy = 1 - hit; }
    }

    if (sparkAt) showSparks(sparkAt.x, sparkAt.y, sparkEnergy);
    else showSparks(0, 0, 0);
  }

  // ---- Part four ------------------------------------------------------------
  function renderPartFour(s) {
    // Everything already standing.
    bottom.forEach((b) => poseBrick(b, 0, 0, 0, 0, 0, 1));
    leftBricks.forEach((b) => poseBrick(b, 0, 0, 0, 0, 0, 1));
    beamBricks.forEach((b) => poseBrick(b, 0, 0, 0, 0, 0, 1));

    const GRAB = { x: OUT + THICK / 2, y: 150 };   // where the cursor takes hold
    const dragP = easeInOut(seg(s, P4.drag[0], P4.drag[1]));
    const wallX = lerp(OUT, FAR - THICK, dragP);   // left edge of the copy
    const held = s >= P4.press[1] && s < P4.release[1];

    // ---- The duplicated wall ----------------------------------------------
    // It starts exactly on top of the original, so the drag reads as pulling a
    // copy off it rather than as a new object appearing.
    if (s < P4.press[0]) {
      rightColumn.forEach((b) => poseBrick(b, 0, 0, 0, 0, 0, 0));
    } else {
      const dx = wallX - (FAR - THICK);
      const settled = s >= P4.release[0];
      rightColumn.forEach((b) => poseBrick(b, dx, 0, 0, 0, 0, settled ? 1 : 0.82));
    }

    // ---- Ladder and crane, shoved off the field ---------------------------
    // Each is pushed only once the wall's leading edge reaches it, and then
    // skids ahead *faster* than the wall — `gain` — so it looks shoved rather
    // than carried, and so it actually clears the field. At gain 1 the wall
    // only has 300 units of travel to give, which left the ladder parked half
    // in shot at the right-hand edge for the rest of the run.
    const shove = (x, lead, gain) => {
      const contact = x - lead;
      return wallX <= contact ? x : x + (wallX - contact) * gain;
    };
    const ladX = shove(LADDER_BASE.x, 26, 1.5);
    const ladTilt = LADDER_LEAN + Math.min(30, Math.max(0, ladX - LADDER_BASE.x) * 0.14);
    poseLadder(ladX, LADDER_BASE.y, ladTilt, 1);
    // The crane needs the larger gain: its jib reaches back almost to the left
    // wall, so the *body* has to travel a full frame-width past the edge
    // before the jib stops showing.
    const craneX = shove(PARK_X - 36, 120, 2.4);
    poseCrane(craneX - (PARK_X - 36), 1, 1, BEAM_ATTACH.x, MAST_TOP + 20, 1);

    // ---- The blobs, running for it ----------------------------------------
    // They leave left-to-right in the order they are standing, so nobody has
    // to overtake anybody on the way out.
    const runners = [
      { w: workerC, from: LADDER_BASE.x, lead: 0.0 },
      { w: workerB, from: BEAM_FLAT.x + 14, lead: 0.15 },   // where it hooked on
      { w: workerA, from: PARK_X - 48, lead: 0.3 }
    ];
    const cDown = easeInOut(seg(s, P4.cDown[0], P4.cDown[1]));
    runners.forEach((r, i) => {
      const p = easeIn(seg(s, FLEE[0] + r.lead, FLEE[1] + r.lead));
      const x = lerp(r.from, W + 60, p);
      if (i === 0 && s < P4.cDown[1]) {
        // C is still on the ladder when the cursor shows up.
        const pt = ladderPoint(lerp(CLIMB_P3, 0, cDown));
        poseWorker(r.w, { x: pt.x, y: pt.y, walk: s * 3.6, facing: -1, arm: -70 });
        return;
      }
      poseWorker(r.w, {
        x, y: FLOOR, walk: s * (p > 0 ? 5.2 : 2.6), facing: 1,
        // Arms up, leaning into the run.
        arm: p > 0 ? -150 : -40, lean: p > 0 ? 9 : 0,
        opacity: 1 - easeIn(clamp((x - W) / 50, 0, 1))
      });
    });

    // ---- The cursor --------------------------------------------------------
    if (s < P4.cursorIn[0]) {
      poseCursor(0, 0, 0, 0, 0);
    } else if (s < P4.press[0]) {
      const p = easeOut(seg(s, P4.cursorIn[0], P4.cursorIn[1]));
      poseCursor(lerp(W + 30, GRAB.x, p), lerp(FLOOR + 40, GRAB.y, p), 0, 0, 1);
    } else if (s < P4.drag[0]) {
      const p = seg(s, P4.press[0], P4.press[1]);
      poseCursor(GRAB.x, GRAB.y, Math.sin(p * Math.PI), p, 1);
    } else if (s < P4.release[1]) {
      poseCursor(wallX + THICK / 2, GRAB.y, 1, 0, 1);
    } else {
      const p = easeIn(seg(s, P4.release[1], P4.release[1] + 0.8));
      poseCursor(lerp(FAR - THICK / 2, W + 40, p), lerp(GRAB.y, GRAB.y + 40, p), 0, 0, 1 - p);
    }

    // ---- The lintel, flown in ----------------------------------------------
    const topCX = IN + (SPAN - 2 * THICK) / 2;
    const topCY = OUT + THICK / 2;
    if (s < P4.flyIn[0]) {
      poseBrick(topBrick, 0, 0, 0, 0, 0, 0);
      flyers.forEach((f) => poseWorker(f, { x: -60, y: -60, opacity: 0 }));
    } else {
      const inP = easeOut(seg(s, P4.flyIn[0], P4.flyIn[1]));
      const setP = easeInOut(seg(s, P4.setTop[0], P4.setTop[1]));
      const outP = easeIn(seg(s, P4.flyOut[0], P4.flyOut[1]));
      // Carried below them on the way down, then lowered the last few units.
      const carryY = lerp(-70, topCY - 26, inP);
      const y = lerp(carryY, topCY, setP);
      poseBrick(topBrick, 0, y - topCY, 0, 0, 0, 1);
      flyers.forEach((f, i) => {
        const side = i === 0 ? -1 : 1;
        const fx = topCX + side * (SPAN / 2 - 46);
        const hover = Math.sin(s * 3 + i * 1.7) * 2.2;
        // They carry it *overhead*, the same way the ground blobs carry their
        // bricks — not slung underneath them. Above it they would be off the
        // top of the box for most of the descent: there are only 22 units
        // between the frame's top and the edge of the drawing, and a blob is
        // 17 tall. Carrying it this way also puts them inside the opening,
        // where there is room for them.
        // They leave by fading out on the spot with a small drift, not by
        // flying anywhere: the square is closed now, so any real exit path
        // goes through a wall. The fade is front-loaded so they are all but
        // gone before the drift takes them near one.
        poseWorker(f, {
          x: fx + side * 30 * outP, y: y + 22 + hover - outP * 40,
          still: true, facing: side === -1 ? 1 : -1,
          arm: -95, flap: s * 5 + i * 0.5,
          opacity: 1 - easeOut(outP)
        });
      });
    }

    showSparks(0, 0, 0);
  }

  // ---- Part five ------------------------------------------------------------
  function renderPartFive(s) {
    // The frame is finished and everyone has gone; repaint it and clear the
    // stage of everything part four left posed.
    bottom.forEach((b) => poseBrick(b, 0, 0, 0, 0, 0, 1));
    leftBricks.forEach((b) => poseBrick(b, 0, 0, 0, 0, 0, 1));
    beamBricks.forEach((b) => poseBrick(b, 0, 0, 0, 0, 0, 1));
    rightColumn.forEach((b) => poseBrick(b, 0, 0, 0, 0, 0, 1));
    poseBrick(topBrick, 0, 0, 0, 0, 0, 1);
    poseLadder(0, 0, 0, 0);
    poseCrane(0, 0, 0, 0, 0, 0);
    poseCursor(0, 0, 0, 0, 0);
    [workerA, workerB, workerC].concat(flyers)
      .forEach((w) => poseWorker(w, { x: -90, y: -90, opacity: 0 }));
    showSparks(0, 0, 0);

    // The top is driven directly by the beat; the bottom is the same drive
    // evaluated CURTAIN_LAG seconds earlier, so it is always catching up to
    // where the top already is.
    poseCurtains(curtainDrive(s), curtainDrive(Math.max(s - CURTAIN_LAG, 0)), s);

    poseConfetti(s - P5.open[0]);
  }

  function render(t) {
    const s = clamp(t, 0, 1) * TOTAL;
    // Part three repaints the finished work itself and owns all three blobs,
    // so it takes over wholesale rather than interleaving with the chains
    // below — those are written as one long if/else per worker and do not
    // compose.
    // The photo desaturates for the whole build and comes back to colour as
    // the curtains draw apart. Set on every frame, from one expression, so it
    // can never disagree with where the curtains are.
    if (photo) {
      const revealed = easeInOut(seg(s, P5.open[0], P5.open[1]));
      const gray = 1 - revealed;
      photo.style.filter = gray > 0.001 ? `grayscale(${gray.toFixed(3)})` : "";
      // The soft-edged mask (see css/style.css) belongs to the building
      // phase, where the photo is one element among the blobs and bricks;
      // the finished piece gets a crisp edge instead. The swap happens the
      // moment the curtains finish *closing* — while the photo is hidden —
      // not when they finish opening: switched off only at full reveal, the
      // edge was still soft for the whole draw-back and then visibly
      // snapped crisp right as the curtains cleared it, which read as a
      // glitch rather than a reveal. Doing it behind the curtain means
      // there's nothing to see happen; by the first frame anyone can
      // actually see the photo, it's already crisp.
      const fadeOff = s >= P5.close[1];
      photo.style.maskImage = fadeOff ? "none" : "";
      photo.style.webkitMaskImage = fadeOff ? "none" : "";
    }
    if (s >= P5.close[0]) { renderPartFive(s); return; }
    if (s >= P4.cDown[0]) { renderPartFour(s); return; }
    if (s >= P3.descend[0]) { renderPartThree(s); return; }
    let sparkAt = null, sparkEnergy = 0;

    // ---- Worker A and the bottom run --------------------------------------
    let aPosed = false;
    for (let i = 0; i < A.length; i++) {
      const k = A[i], b = bottom[i];
      // Brick's resting position, and where the worker stands to set it: just
      // right of the slot so the brick drops clear of the blob.
      const slotX = b.x + b.w / 2;
      const standX = b.x + b.w + 6;
      const leftJoint = b.x + 1;
      const rightJoint = b.x + b.w - 1;

      if (s < k.enter) { poseBrick(b, 0, 0, 0, 0, 0, 0); continue; }

      if (s < k.drop) {
        // Carried on: the brick rides above the worker's head.
        const p = easeInOut(seg(s, k.enter, k.arrive));
        const wx = lerp(ENTER_A, standX, p);
        const settle = seg(s, k.arrive, k.drop);        // lowering it in
        const bx = lerp(wx - slotX, 0, easeInOut(settle));
        const by = lerp(HOLD_Y, 0, easeInOut(settle));
        poseBrick(b, bx, by, 0, 0, 0, 1);
        if (!aPosed) {
          poseWorker(workerA, {
            x: wx, y: FLOOR, walk: s * 2.6, still: settle > 0,
            arm: -95, squash: 1 + settle * 0.06, facing: -1,
            lean: settle > 0 ? -4 * Math.sin(settle * Math.PI) : 0,
            opacity: easeOut(seg(s, k.enter, k.enter + 0.3))
          });
          aPosed = true;
        }
        continue;
      }

      // Brick is down for good from here on.
      poseBrick(b, 0, 0, 0, 0, 0, 1);

      if (aPosed || s >= k.gone) continue;

      if (s < k.hamL[1]) {
        // Hammer the left joint. The worker crosses to the far end of the
        // brick, which reads as "working along it" rather than teleporting.
        const p = seg(s, k.hamL[0], k.hamL[1]);
        const wx = lerp(standX, leftJoint - 7, easeInOut(clamp(p * 2.2, 0, 1)));
        poseWorker(workerA, {
          x: wx, y: FLOOR, walk: s * 2.6, still: p > 0.45,
          arm: p > 0.45 ? swing(seg(s, k.hamL[0] + 0.27, k.hamL[1]), blows(k.hamL[0] + 0.27, k.hamL[1])) : -20,
          hammer: p > 0.45, facing: -1
        });
        const hit = p > 0.45 ? struck(seg(s, k.hamL[0] + 0.27, k.hamL[1]), blows(k.hamL[0] + 0.27, k.hamL[1])) : 0;
        if (hit > 0) { sparkAt = { x: leftJoint, y: FLOOR + 1 }; sparkEnergy = 1 - hit; }
        aPosed = true;
      } else if (s < k.hamR[1]) {
        const cross = easeInOut(seg(s, k.stepR[0], k.stepR[1]));
        const wx = lerp(leftJoint - 7, rightJoint + 7, cross);
        const hamming = s >= k.hamR[0] + 0.1;
        poseWorker(workerA, {
          x: wx, y: FLOOR, walk: s * 2.6, still: hamming && cross >= 1,
          arm: hamming ? swing(seg(s, k.hamR[0] + 0.1, k.hamR[1]), blows(k.hamR[0] + 0.1, k.hamR[1])) : -20,
          hammer: hamming, facing: 1
        });
        const hit = hamming ? struck(seg(s, k.hamR[0] + 0.1, k.hamR[1]), blows(k.hamR[0] + 0.1, k.hamR[1])) : 0;
        if (hit > 0) { sparkAt = { x: rightJoint, y: FLOOR + 1 }; sparkEnergy = 1 - hit; }
        aPosed = true;
      } else {
        // Off to fetch the next one.
        const p = easeIn(seg(s, k.leave, k.gone));
        poseWorker(workerA, {
          x: lerp(rightJoint + 7, ENTER_A, p), y: FLOOR, walk: s * 2.6,
          arm: -10, facing: 1, opacity: 1 - easeIn(p)
        });
        aPosed = true;
      }
    }
    if (!aPosed) poseWorker(workerA, { x: ENTER_A, y: FLOOR, opacity: 0 });

    // ---- Worker B and the first left-column brick --------------------------
    const bx0 = leftBrick.x + leftBrick.w / 2;
    const by0 = leftBrick.y + leftBrick.h / 2;
    const standB = IN + 12;                 // stands inside, to the right of it
    const jointX = OUT + THICK / 2;         // where it meets the corner brick
    const jointY = FLOOR;

    if (s < B.enter) {
      poseBrick(leftBrick, 0, 0, 0, 0, 0, 0);
      poseWorker(workerB, { x: ENTER_B, y: FLOOR, opacity: 0 });
    } else if (s < B.push[0]) {
      // Walks on with the brick carried FLAT overhead, like a plank. Carrying
      // it already upright read as clutter lying across the bottom-left
      // corner; the tilt to vertical is what makes the heave legible.
      const p = easeInOut(seg(s, B.enter, B.arrive));
      const wx = lerp(ENTER_B, standB, p);
      poseBrick(leftBrick, wx - bx0, FLOOR + HOLD_Y - by0, 90, bx0, by0, 1);
      poseWorker(workerB, {
        x: wx, y: FLOOR, walk: s * 2.6, arm: -95,
        opacity: easeOut(seg(s, B.enter, B.enter + 0.3))
      });
    } else if (s < B.wobble[0]) {
      // The heave. Slow, uneven, and it costs: the worker squashes down, leans
      // into it, sweats, and the brick creeps up in two shoves rather than one
      // smooth ride.
      const p = seg(s, B.push[0], B.push[1]);
      const shoved = easeInOut(p) * 0.72 + easeInOut(clamp((p - 0.45) / 0.55, 0, 1)) * 0.28;
      const tremble = (1 - p) * 0.6 * Math.sin(s * 34);
      // Swings up from flat to vertical while it climbs. The tilt finishes
      // ahead of the travel so the last of the effort is pure lift, which is
      // the part that should look hard.
      const upright = easeOut(clamp(shoved * 1.35, 0, 1));
      poseBrick(leftBrick,
        lerp(standB - bx0, 0, shoved) + tremble,
        lerp(FLOOR + HOLD_Y - by0, 0, shoved),
        lerp(90, 0, upright), bx0, by0, 1);
      poseWorker(workerB, {
        x: lerp(standB, standB - 2, shoved), y: FLOOR, still: true,
        arm: -118 + Math.sin(s * 34) * 4,
        squash: 1 - 0.10 * Math.sin(p * Math.PI), lean: -7 * Math.sin(p * Math.PI),
        drop: clamp((p - 0.25) * 3, 0, 1) * (1 - easeIn(clamp((p - 0.7) / 0.3, 0, 1))),
        dropFall: ((s - B.push[0]) * 0.8) % 1,
        mouth: 0.5 * Math.sin(p * Math.PI)
      });
    } else if (s < B.nail[0]) {
      // Seated, but not quietly: it rocks on the corner brick and damps out.
      const p = seg(s, B.wobble[0], B.wobble[1]);
      const rock = Math.sin(p * Math.PI * 6.5) * 5.5 * Math.pow(1 - p, 2.2);
      poseBrick(leftBrick, 0, 0, rock, OUT, FLOOR, 1);
      const ph = seg(s, B.phew[0], B.phew[1]);
      // Hands off, step back, and breathe out once it stops moving.
      poseWorker(workerB, {
        x: standB, y: FLOOR, still: true,
        arm: lerp(-118, -14, easeOut(clamp(p * 1.6, 0, 1))),
        squash: 1 + 0.07 * Math.sin(ph * Math.PI),
        lean: lerp(-4, 0, easeOut(clamp(p * 1.4, 0, 1))),
        mouth: ph > 0 && ph < 1 ? Math.sin(ph * Math.PI) : 0,
        puff: ph > 0 && ph < 1 ? Math.sin(ph * Math.PI) : 0,
        puffOut: ph
      });
    } else if (s < B2.fetch[0]) {
      // Nails the bottom of it into the corner brick.
      poseBrick(leftBrick, 0, 0, 0, 0, 0, 1);
      const p = seg(s, B.nail[0], B.nail[1]);
      const crouch = easeInOut(clamp(p * 3, 0, 1));
      poseWorker(workerB, {
        x: lerp(standB, IN + 8, crouch), y: FLOOR, still: true, facing: -1,
        arm: p > 0.3 ? swing(seg(s, B.nail[0] + 0.45, B.nail[1]), blows(B.nail[0] + 0.45, B.nail[1])) : -20,
        hammer: p > 0.3
      });
      const hit = p > 0.3 ? struck(seg(s, B.nail[0] + 0.45, B.nail[1]), blows(B.nail[0] + 0.45, B.nail[1])) : 0;
      if (hit > 0 && sparkEnergy === 0) { sparkAt = { x: jointX + 5, y: jointY - 2 }; sparkEnergy = 1 - hit; }
    } else {
      // ---- Part two -------------------------------------------------------
      // Course one is set and out of B's reach from here, so: fetch a ladder,
      // stand it up, climb, and take the next brick from a hod carrier rather
      // than heaving this one alone. The first course was the demonstration
      // that doing it alone is hard; this is the answer to it.
      poseBrick(leftBrick, 0, 0, 0, 0, 0, 1);
      const climbTop = ladderPoint(CLIMB_P2);

      if (s < B2.carry[0]) {
        // Off to the RIGHT, not the left: the column it just built is in the
        // way on the left, and a blob walking through a standing brick reads
        // as a bug rather than as a shortcut.
        const p = easeIn(seg(s, B2.fetch[0], B2.fetch[1]));
        poseWorker(workerB, {
          x: lerp(IN + 8, ENTER_A, p), y: FLOOR, walk: s * 2.6,
          arm: -10, facing: 1, opacity: 1 - p
        });
      } else if (s < B2.raise[0]) {
        const p = easeInOut(seg(s, B2.carry[0], B2.carry[1]));
        poseWorker(workerB, {
          x: lerp(ENTER_A, LADDER_BASE.x + 14, p), y: FLOOR, walk: s * 2.6,
          arm: -95, facing: -1,
          opacity: easeOut(seg(s, B2.carry[0], B2.carry[0] + 0.3))
        });
      } else if (s < B2.climb[0]) {
        const p = seg(s, B2.raise[0], B2.raise[1]);
        poseWorker(workerB, {
          x: LADDER_BASE.x + 14, y: FLOOR, still: true, facing: -1,
          arm: lerp(-95, -38, easeInOut(p)), lean: -6 * Math.sin(p * Math.PI)
        });
      } else if (s < B2.take[0]) {
        // Steps to the foot, then goes up. Hands alternate on the rungs.
        const cp = seg(s, B2.climb[0], B2.climb[1]);
        if (cp < 0.18) {
          poseWorker(workerB, {
            x: lerp(LADDER_BASE.x + 14, LADDER_BASE.x, cp / 0.18), y: FLOOR,
            walk: s * 2.6, arm: -22, facing: -1
          });
        } else {
          const up = easeInOut(clamp((cp - 0.18) / 0.82, 0, 1));
          const pt = ladderPoint(up * CLIMB_P2);
          poseWorker(workerB, {
            x: pt.x, y: pt.y, walk: s * 3.6, facing: -1,
            arm: -72 + Math.sin(s * 8) * 26
          });
        }
      } else if (s < B2.place[0]) {
        // Turns downhill to take the brick being passed up.
        const p = easeInOut(seg(s, B2.take[0], B2.take[1]));
        poseWorker(workerB, {
          x: climbTop.x, y: climbTop.y, still: true, facing: 1,
          arm: lerp(46, -30, p), lean: lerp(7, -2, p)
        });
      } else if (s < B2.tap[0]) {
        const p = easeInOut(seg(s, B2.place[0], B2.place[1]));
        poseWorker(workerB, {
          x: climbTop.x, y: climbTop.y, still: true, facing: -1,
          arm: lerp(-30, -88, p), lean: lerp(0, -5, p)
        });
      } else {
        const p = seg(s, B2.tap[0], B2.tap[1]);
        const n = blows(B2.tap[0], B2.tap[1]);
        poseWorker(workerB, {
          x: climbTop.x, y: climbTop.y, still: true, facing: -1,
          arm: swing(p, n), hammer: true, lean: -4
        });
        const hit = struck(p, n);
        if (hit > 0 && sparkEnergy === 0) {
          sparkAt = { x: IN + 2, y: leftBricks[1].y + leftBricks[1].h };
          sparkEnergy = 1 - hit;
        }
      }
    }

    // ---- The ladder --------------------------------------------------------
    if (s < B2.carry[0]) {
      poseLadder(0, 0, 0, 0);
    } else if (s < B2.raise[0]) {
      const p = easeInOut(seg(s, B2.carry[0], B2.carry[1]));
      const wx = lerp(ENTER_A, LADDER_BASE.x + 14, p);
      poseLadder(wx - 55, FLOOR - 30, 90,
                 easeOut(seg(s, B2.carry[0], B2.carry[0] + 0.3)));
    } else if (s < B2.climb[0]) {
      // Swings down off the shoulder and onto its feet.
      const p = easeInOut(seg(s, B2.raise[0], B2.raise[1]));
      poseLadder(lerp(LADDER_BASE.x + 14 - 55, LADDER_BASE.x, p),
                 lerp(FLOOR - 30, LADDER_BASE.y, p),
                 lerp(90, LADDER_LEAN, p), 1);
    } else {
      poseLadder(LADDER_BASE.x, LADDER_BASE.y, LADDER_LEAN, 1);
    }

    // ---- Worker C and the second course ------------------------------------
    // C walks on from the right in the gap between B returning with the ladder
    // (parked at x 78 by 15.9) and A's fourth cycle starting at 18.1, and then
    // stands at x 100 — clear of both.
    const brick2 = leftBricks[1];
    const b2cx = brick2.x + brick2.w / 2;
    const b2cy = brick2.y + brick2.h / 2;
    const C_HOLD = FLOOR + HOLD_Y;
    const topPt = ladderPoint(CLIMB_P2);
    // B takes it well out to its right, not overhead. Stood upright at the
    // overhead position the brick landed inside the ladder rails and vanished
    // behind them; out here it turns up in clear air and then slides sideways
    // into the column, which also reads more like bricklaying than juggling.
    const handX = topPt.x + 20, handY = topPt.y - 26;

    if (s < C.enter) {
      poseBrick(brick2, 0, 0, 0, 0, 0, 0);
      poseWorker(workerC, { x: ENTER_A, y: FLOOR, opacity: 0 });
    } else if (s < C.hand[0]) {
      const p = easeInOut(seg(s, C.enter, C.arrive));
      const wx = lerp(ENTER_A, C_STAND_P2, p);
      poseBrick(brick2, wx - b2cx, C_HOLD - b2cy, 90, b2cx, b2cy, 1);
      poseWorker(workerC, {
        x: wx, y: FLOOR, walk: s * 2.6, still: p >= 1, arm: -95, facing: -1,
        opacity: easeOut(seg(s, C.enter, C.enter + 0.3))
      });
    } else if (s < B2.place[0]) {
      // The hand-off. The brick turns from flat to upright *as it rises*:
      // held flat the whole way up it read as being thrown rather than
      // passed, because nothing about it changed while it travelled. The turn
      // trails the lift slightly, so it leaves C's hands flat and arrives in
      // B's already standing.
      const p = easeInOut(seg(s, C.hand[0], C.hand[1]));
      const turn = easeInOut(clamp((p - 0.15) / 0.75, 0, 1));
      poseBrick(brick2, lerp(C_STAND_P2, handX, p) - b2cx, lerp(C_HOLD, handY, p) - b2cy,
                lerp(90, 0, turn), b2cx, b2cy, 1);
      poseWorker(workerC, {
        x: C_STAND_P2, y: FLOOR, still: true, facing: -1,
        arm: lerp(-95, -138, p), squash: 1 - 0.07 * Math.sin(p * Math.PI),
        lean: -5 * Math.sin(p * Math.PI),
        mouth: 0.4 * Math.sin(p * Math.PI)
      });
    } else {
      if (s < B2.tap[0]) {
        // It arrived upright, so placing it is now a straight sideways slide
        // into the column — no arc across the opening.
        const slide = easeInOut(seg(s, B2.place[0], B2.place[1]));
        poseBrick(brick2,
          lerp(handX, b2cx, slide) - b2cx, lerp(handY, b2cy, slide) - b2cy,
          0, b2cx, b2cy, 1);
      } else {
        poseBrick(brick2, 0, 0, 0, 0, 0, 1);
      }
      // Stays on site, watching the course it just supplied go in.
      poseWorker(workerC, { x: C_STAND_P2, y: FLOOR, still: true, facing: -1, arm: -26 });
    }

    if (sparkAt) showSparks(sparkAt.x, sparkAt.y, sparkEnergy);
    else showSparks(0, 0, 0);
  }

  // ---- Playback ------------------------------------------------------------
  // One knob for the whole thing. The beats are authored in real seconds so
  // they stay readable and tweakable; PACE scales the playback without
  // touching a single timing. 0.75 would run the same choreography in ~31s.
  const PACE = 0.65;
  const DURATION = TOTAL * 1000 * PACE;
  let startedAt = null;
  let raf = 0;

  function frame(now) {
    if (startedAt === null) startedAt = now;
    const t = (now - startedAt) / DURATION;
    render(t);
    if (t < 1) raf = requestAnimationFrame(frame);
    else raf = 0;
  }

  function play() {
    cancelAnimationFrame(raf);
    startedAt = null;
    raf = requestAnimationFrame(frame);
  }

  // Part one opens on a blank square, so the photo is hidden — but by script,
  // never by stylesheet, so a reader with JS off still just gets the photo.
  //
  // Under reduced motion the overlay is dropped entirely rather than frozen at
  // t = 1: a half-built frame is a coherent *moment* in an animation and an
  // incoherent *still*, so the honest static state is the plain photo. Revisit
  // once the sequence builds the whole frame and brings the photo in.
  if (reduceMotion) {
    // The honest static state is the *finished* piece, not a frozen mid-
    // build frame — full colour, crisp edges, same as where the animation
    // would have landed. Line 70 set grayscale(1) unconditionally before
    // this check ever ran, so it has to be undone here explicitly.
    if (photo) {
      photo.style.filter = "";
      photo.style.maskImage = "none";
      photo.style.webkitMaskImage = "none";
    }
    svg.remove();
    return;
  }
  host.classList.add("hero-photo--building");

  render(0);

  // Plays once, ever — not once per scroll-into-view. A build that replays
  // every time the photo re-enters the viewport reads as a looping gimmick
  // rather than a one-off flourish; disconnecting the observer after the
  // first play is what makes "once" actually mean once, rather than "once
  // per visit while the tab happens to be in view".
  {
    if ("IntersectionObserver" in window) {
      const io = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) { play(); io.disconnect(); }
        });
      }, { threshold: 0.45 });
      io.observe(host);
    } else {
      play();
    }
  }

  window.heroFrame = { render, svg, DURATION, TOTAL };
})();
