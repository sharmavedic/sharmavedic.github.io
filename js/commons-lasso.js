// Simulation 1's slider gets its own tiny blob interruption: one blob walks
// in from the right, lassoes the herd-size thumb and tries to drag it down
// toward fewer cows, calls in a second when it can't, and the pair give up
// and leave if nobody helps them — but if the visitor drags the slider down
// themselves while the rope is on, the blobs celebrate and run off instead.
// Autoplaying, no controls, like js/hero-frame.js, and — same as that file —
// plays exactly once, the first time the card scrolls into view.
//
// The blob figure itself is the hero photo's builder, copied wholesale (same
// leg/body/arm/eye geometry, same single throwing arm) rather than invented
// fresh, so it reads as the same character showing up in a second place on
// the page — with a cowboy hat standing in for the hard hat, since here it's
// wrangling a slider instead of laying bricks.
//
// Unlike every other decorative piece on the site, its subject (the native
// range thumb) has a real screen position that depends on live page layout
// and can be moved by the visitor mid-animation. That rules out the fixed-
// viewBox `render(t)` pattern the other scenes use: there is no way to author
// "where the thumb is" as a constant. Instead this drives a small state
// machine off real elapsed time, recomputing the thumb's screen position
// every frame from `input.getBoundingClientRect()` and `input.value`, and
// reacts to genuine `input` events for the celebrate branch.
(function () {
  const rail = document.querySelector(".commons-rail");
  const input = document.getElementById("commonsHerd");
  const stage = document.querySelector(".commons-stage");
  if (!rail || !input || !stage) return;
  const railEnds = rail.querySelectorAll(".commons-rail-end");
  const bottomLabel = railEnds[railEnds.length - 1];
  if (!bottomLabel) return;
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

  const NS = "http://www.w3.org/2000/svg";
  function el(tag, attrs) {
    const e = document.createElementNS(NS, tag);
    for (const k in attrs) e.setAttribute(k, attrs[k]);
    return e;
  }
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  const lerp = (a, b, p) => a + (b - a) * p;
  const seg = (s, a, b) => clamp((s - a) / (b - a), 0, 1);
  const easeInOut = (p) => (p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2);
  const easeOut = (p) => 1 - Math.pow(1 - p, 3);

  // The native thumb's on-screen centre. The slider is a horizontal input
  // rotated -90deg in CSS, so getBoundingClientRect() already reports the
  // rotated (visually vertical) box — min (value 1) lands at the bottom of
  // that box, max (value 4) at the top, matching the "1 cow"/"4 cows" labels
  // either end of the rail.
  function thumbClientPos() {
    const r = input.getBoundingClientRect();
    const v = parseFloat(input.value);
    const t = (v - parseFloat(input.min)) / (parseFloat(input.max) - parseFloat(input.min));
    // The thumb's *centre* doesn't travel the whole track — like any range
    // input, half its own width is reserved at each end so it never hangs
    // off the edge. Using the raw rect edges here put the lasso loop up to
    // a whole radius off from the real thumb at the top and bottom of the
    // travel; insetting by THUMB_R is what makes it land exactly on it.
    const top = r.top + THUMB_R, bottom = r.bottom - THUMB_R;
    return { x: r.left + r.width / 2, y: bottom - t * (bottom - top) };
  }

  // The rendered thumb is a 20px circle (see .commons-slider::-webkit-
  // slider-thumb), box-sizing: border-box, so its radius is 10 regardless of
  // the 3px border. LOOP_R sits just outside that, snug rather than loose.
  const THUMB_R = 10;
  const LOOP_R = 11.5;

  let overlay = null, svg = null, raf = 0;
  let phase = "idle", phaseStart = 0;
  let blobA = null, blobB = null, rope = null;
  let lastValue = parseFloat(input.value);
  let played = false;

  function buildOverlay() {
    overlay = document.createElement("div");
    overlay.setAttribute("aria-hidden", "true");
    overlay.style.cssText = "position:fixed; left:0; top:0; width:0; height:0; pointer-events:none; z-index:3;";
    svg = el("svg", { style: "position:fixed; overflow:visible;" });
    overlay.appendChild(svg);
    document.body.appendChild(overlay);
    rope = svg.appendChild(el("path", {
      fill: "none", stroke: "var(--commons-rope)", "stroke-width": 1.6,
      "stroke-linecap": "round", opacity: "0"
    }));
    // A true circle, not an ellipse — a lassoed circular thumb wants a loop
    // that is actually circular, not an oval that only roughly covers it.
    const loop = svg.appendChild(el("circle", {
      r: LOOP_R, fill: "none", stroke: "var(--commons-rope)", "stroke-width": 1.6, opacity: "0"
    }));
    rope.loopNode = loop;
  }

  // The hero photo's builder blob, geometry copied exactly (legs, body,
  // single throwing arm, eyes, mouth) so it is recognisably the same
  // character — with a wide-brimmed, pinch-crowned hat in place of the hard
  // hat, since there is no construction going on here.
  function makeBlob() {
    const g = svg.appendChild(el("g", { opacity: "0" }));
    const legs = [
      g.appendChild(el("rect", { x: -3.4, y: -4, width: 2.2, height: 4, rx: 1.1, fill: "var(--commons-blob-dark)" })),
      g.appendChild(el("rect", { x: 1.2, y: -4, width: 2.2, height: 4, rx: 1.1, fill: "var(--commons-blob-dark)" }))
    ];
    const body = g.appendChild(el("g"));
    body.appendChild(el("ellipse", { cx: 0, cy: -9.5, rx: 6.4, ry: 6, fill: "var(--commons-blob)" }));

    const armG = el("g");
    body.appendChild(armG);
    armG.appendChild(el("rect", { x: 4.6, y: -12, width: 5.4, height: 2.2, rx: 1.1, fill: "var(--commons-blob-dark)" }));

    // Wrapped in their own group so a tired blob's eyes can be flattened
    // toward half-shut without having to fight each circle's own cy.
    const eyeGroup = body.appendChild(el("g"));
    const eyes = [
      eyeGroup.appendChild(el("circle", { cx: -2.2, cy: -10.4, r: 1.05, fill: "var(--commons-blob-eye)" })),
      eyeGroup.appendChild(el("circle", { cx: 1.6, cy: -10.4, r: 1.05, fill: "var(--commons-blob-eye)" }))
    ];
    // Strained ">  <" eyes for a hard pull — vertices angled in toward the
    // centre, the universal cartoon "putting everything into it" look.
    // Swapped in over the round eyes rather than replacing them, so the
    // strain can fade in and out with how hard the tug currently is.
    const eyeStrain = [
      body.appendChild(el("path", {
        d: "M -3.3 -11.3 L -1.1 -10.4 L -3.3 -9.5", fill: "none",
        stroke: "var(--commons-blob-eye)", "stroke-width": 1, "stroke-linecap": "round",
        "stroke-linejoin": "round", opacity: "0"
      })),
      body.appendChild(el("path", {
        d: "M 2.8 -11.3 L 0.6 -10.4 L 2.8 -9.5", fill: "none",
        stroke: "var(--commons-blob-eye)", "stroke-width": 1, "stroke-linecap": "round",
        "stroke-linejoin": "round", opacity: "0"
      }))
    ];
    const mouth = body.appendChild(el("ellipse", {
      cx: -0.3, cy: -7.6, rx: 1.5, ry: 1.1, fill: "var(--commons-blob-eye)", opacity: "0"
    }));

    // Cowboy hat: a wide, faintly curved brim plus a pinched, rounded crown —
    // the hero hat's flat brim rect and low dome would read as a hard hat
    // however it's coloured, so the shape itself has to change, not just the
    // fill.
    body.appendChild(el("ellipse", { cx: 0, cy: -14.6, rx: 8.6, ry: 1.9, fill: "var(--commons-hat)" }));
    body.appendChild(el("path", {
      d: "M -4.2 -14.6 C -4.7 -19.4 -2.5 -21.6 0 -21.6 C 2.5 -21.6 4.7 -19.4 4.2 -14.6 Z",
      fill: "var(--commons-hat)"
    }));
    body.appendChild(el("path", {
      d: "M 0 -21.4 L 0 -18.8", stroke: "var(--commons-hat-fold)", "stroke-width": 0.9, "stroke-linecap": "round"
    }));

    const exclaim = g.appendChild(el("text", {
      x: 0, y: -27, "text-anchor": "middle", "font-size": "8", "font-weight": "700",
      fill: "var(--commons-rope)", opacity: "0"
    }));
    exclaim.textContent = "!";
    return { node: g, legs, body, armG, eyeGroup, eyes, eyeStrain, mouth, exclaim };
  }

  // `arm` rotates the one throwing/gripping arm to point at a live target —
  // computed fresh every frame, which is what keeps the grip looking right
  // even while the thumb is moving under the visitor's own hand. `lean`
  // rotates the *whole figure* around its own feet (the node's local
  // origin), which is what sells straining against something without
  // sliding the feet across the ground — a tug-of-war lean, not a shove.
  function poseBlob(b, o) {
    const walk = o.walk || 0;
    const bob = o.still ? 0 : Math.sin(walk * Math.PI * 2) * 1.0;
    const lean = o.lean || 0;
    b.node.setAttribute("transform",
      `translate(${o.x.toFixed(2)} ${o.y.toFixed(2)})` + (lean ? ` rotate(${lean.toFixed(2)})` : ""));
    b.node.setAttribute("opacity", (o.opacity == null ? 1 : o.opacity).toFixed(3));
    // `heave` breathes the body in and out (a post-effort pant, not the walk
    // bob) by scaling it vertically around its own centre rather than the
    // node origin — scaling from (0,0) would also slide the whole body up
    // and down, which reads as bouncing rather than a heaving chest.
    const heave = o.heave || 0;
    const heaveScale = 1 + heave * 0.07;
    b.body.setAttribute("transform",
      `translate(0 ${bob.toFixed(2)}) translate(0 -9.5) scale(1 ${heaveScale.toFixed(3)}) translate(0 9.5)`);
    const step = o.still ? 0 : Math.sin(walk * Math.PI * 2) * 1.6;
    b.legs[0].setAttribute("transform", `translate(${step.toFixed(2)} 0)`);
    b.legs[1].setAttribute("transform", `translate(${(-step).toFixed(2)} 0)`);
    b.armG.setAttribute("transform", `rotate(${(o.arm || 0).toFixed(1)} 4.6 -10.9)`);
    // `tired` flattens the eyes toward half-shut, scaled around their own
    // cy so they sink rather than sliding down the face. `pant` swaps the
    // mouth from the flat smile curve to an open "o", sized with the same
    // heave so it visibly huffs in time with the chest.
    const tired = o.tired || 0;
    b.eyeGroup.setAttribute("transform",
      `translate(0 -10.4) scale(1 ${(1 - tired * 0.62).toFixed(2)}) translate(0 10.4)`);
    if (o.pant) {
      b.mouth.setAttribute("opacity", "1");
      b.mouth.setAttribute("rx", "1.3");
      b.mouth.setAttribute("ry", (1.0 + Math.abs(heave) * 0.55).toFixed(2));
    } else {
      b.mouth.setAttribute("opacity", o.smile ? "1" : "0");
      b.mouth.setAttribute("rx", "1.5");
      b.mouth.setAttribute("ry", "1.1");
    }
    const strain = o.strain || 0;
    b.eyes[0].setAttribute("opacity", (1 - strain).toFixed(2));
    b.eyes[1].setAttribute("opacity", (1 - strain).toFixed(2));
    b.eyeStrain[0].setAttribute("opacity", strain.toFixed(2));
    b.eyeStrain[1].setAttribute("opacity", strain.toFixed(2));
    b.exclaim.setAttribute("opacity", (o.exclaim || 0).toFixed(2));
    b.exclaim.setAttribute("y", (-27 - (o.exclaim || 0) * 4).toFixed(2));
  }

  // The throwing hand's position, in local (overlay) coordinates, given the
  // blob's own position, its arm's current angle, and how far it's leaning —
  // the lean rotates the arm along with the rest of the figure, so the rope
  // has to follow it to stay attached to the hand rather than drifting off.
  function handPoint(x, y, armDeg, leanDeg) {
    const armRad = armDeg * Math.PI / 180;
    const localX = 4.6 + Math.cos(armRad) * 8;
    const localY = -10.9 + Math.sin(armRad) * 8;
    const leanRad = (leanDeg || 0) * Math.PI / 180;
    const rx = localX * Math.cos(leanRad) - localY * Math.sin(leanRad);
    const ry = localX * Math.sin(leanRad) + localY * Math.cos(leanRad);
    return { x: x + rx, y: y + ry };
  }

  // The arm angle that points the shoulder straight at the thumb, in
  // degrees (0 = right, -90 = up). Computed fresh from wherever the blob and
  // the thumb currently are, rather than a fixed constant, which is what
  // keeps the rope looking properly aimed even though the blob stands off to
  // one side of the track rather than directly under it.
  function aimArm(x, y, tx, ty) {
    const shoulder = { x: x + 4.6, y: y - 10.9 };
    return Math.atan2(ty - shoulder.y, tx - shoulder.x) * 180 / Math.PI;
  }

  // The unit direction from the thumb to (x, y) — "away from the thumb" —
  // used to lean a straining blob backward along the rope's own line rather
  // than in some unrelated direction.
  function awayFromThumb(x, y, tx, ty) {
    const dx = x - tx, dy = y - ty;
    const len = Math.hypot(dx, dy) || 1;
    return { x: dx / len, y: dy / len };
  }

  // How far a blob leans (degrees, around its own feet) when straining flat
  // out against `dir`. Only a fraction of the way toward fully aligned with
  // `dir` — a full lean would tip the figure over — and clamped, since a
  // shallow rope angle can otherwise ask for more lean than reads as natural.
  function leanTowards(dir) {
    const raw = Math.atan2(dir.x, -dir.y) * 180 / Math.PI;
    return clamp(raw * 0.5, -20, 20);
  }

  // A tug cycle that oscillates for the first `holdFrac` of the beat, then
  // holds at full amplitude for the rest — several real tugs, then one
  // sustained hard pull before whatever happens next (a call for help, or
  // letting go). The frequency (4.5 cycles) is chosen so the oscillating
  // part always ends exactly on a peak, which is what keeps the handoff into
  // the hold from visibly jumping.
  function tugWave(p, holdFrac, amplitude) {
    if (p < holdFrac) return Math.sin(seg(p, 0, holdFrac) * Math.PI * 4.5) * amplitude;
    return amplitude;
  }

  // Arm angles for the states that aren't aimed at anything in particular.
  const ARM_REST = 62;   // hanging down-forward while walking
  const ARM_WAVE = -55;  // base angle for the call-for-help wave

  const DUR = {
    walkInA: 900, throw: 500, pullA: 2000, callHelp: 900,
    walkInB: 900, pullBoth: 2400, giveUp: 900, wheeze: 1300,
    celebrate: 1300, exit: 700
  };
  const HOLD_FRAC = 0.65;  // fraction of pullA/pullBoth spent oscillating before the hold
  const STAND_DX = 8;      // stand point: this far right of the "1 cow each" label
  const STAND_DY = 6;      // and this far above its top edge
  const STAND_B_DX = 17;   // blob B stands further right and slightly lower
  const NUDGE_MAX = 4;     // px the thumb itself visibly dips on the hardest pull

  // Nudges just the thumb, not the track it rides on — a --thumb-nudge
  // custom property that css/style.css's ::-webkit-slider-thumb /
  // ::-moz-range-thumb rules read, rather than a transform on the whole
  // <input>. Custom properties inherit into pseudo-elements, so setting it
  // here is enough; the sign/axis math for why this reads as "down" lives in
  // that stylesheet comment.
  function nudgeThumb(px) {
    if (px > 0.05) input.style.setProperty("--thumb-nudge", px.toFixed(2) + "px");
    else input.style.removeProperty("--thumb-nudge");
  }

  function elapsed(now) { return now - phaseStart; }
  function enter(next, now) { phase = next; phaseStart = now; }

  function startSequence() {
    if (played) return;
    played = true;
    buildOverlay();
    blobA = makeBlob();
    enter("walkInA", performance.now());
    input.addEventListener("input", onUserInput);
    raf = requestAnimationFrame(tick);
  }

  // Only reacts once the rope is actually on the thumb, and only to the
  // visitor genuinely lowering the herd size — an increase, or a drag before
  // the lasso lands, isn't "helping" and gets no reaction.
  function onUserInput() {
    const v = parseFloat(input.value);
    const engaged = ["throw", "pullA", "callHelp", "walkInB", "pullBoth"].indexOf(phase) !== -1;
    if (engaged && v < lastValue) enter("celebrate", performance.now());
    lastValue = v;
  }

  function cleanup() {
    input.removeEventListener("input", onUserInput);
    input.style.removeProperty("--thumb-nudge");
    if (overlay) overlay.remove();
    overlay = svg = rope = blobA = blobB = null;
  }

  function tick(now) {
    const rs = stage.getBoundingClientRect();
    svg.setAttribute("width", rs.width);
    svg.setAttribute("height", rs.height);
    svg.setAttribute("viewBox", `0 0 ${rs.width} ${rs.height}`);
    svg.style.left = rs.left + "px";
    svg.style.top = rs.top + "px";

    const thumb = thumbClientPos();
    const tx = thumb.x - rs.left, ty = thumb.y - rs.top;

    // Both blobs' stand points are anchored to the "1 cow each" label, not
    // to the thumb — they walk up to a fixed spot beside the bottom of the
    // rail and stay there, throwing a rope that reaches wherever the thumb
    // currently is. Recomputed every frame (the label doesn't move, but this
    // keeps it simple and cheap).
    const lr = bottomLabel.getBoundingClientRect();
    const standAX = lr.right - rs.left + STAND_DX;
    const standAY = lr.top - rs.top - STAND_DY;
    const standBX = standAX + STAND_B_DX;
    const standBY = standAY + 4;
    const offRight = rs.width + 30;

    const t = elapsed(now);

    // Default: no nudge. pullA/pullBoth/giveUp override this below when
    // there's an actual strain to show.
    nudgeThumb(0);

    if (phase === "walkInA") {
      const p = easeInOut(seg(t, 0, DUR.walkInA));
      poseBlob(blobA, { x: lerp(offRight, standAX, p), y: standAY, walk: t / 260, arm: ARM_REST });
      rope.setAttribute("opacity", "0");
      rope.loopNode.setAttribute("opacity", "0");
      if (p >= 1) enter("throw", now);

    } else if (phase === "throw") {
      const p = easeOut(seg(t, 0, DUR.throw));
      const arm = lerp(ARM_REST, aimArm(standAX, standAY, tx, ty), p);
      poseBlob(blobA, { x: standAX, y: standAY, still: true, arm });
      const hand = handPoint(standAX, standAY, arm);
      rope.setAttribute("d", `M ${hand.x.toFixed(2)} ${hand.y.toFixed(2)} L ${tx.toFixed(2)} ${ty.toFixed(2)}`);
      rope.setAttribute("opacity", p.toFixed(2));
      // The loop itself closes in over the last part of the throw — it
      // starts wide of the thumb and cinches down to a snug fit, which is
      // what makes it read as a lasso landing rather than a ring that just
      // appears already fitted.
      if (p >= 0.55) {
        const closeP = easeOut((p - 0.55) / 0.45);
        rope.loopNode.setAttribute("cx", tx.toFixed(2));
        rope.loopNode.setAttribute("cy", ty.toFixed(2));
        rope.loopNode.setAttribute("r", lerp(THUMB_R + 16, LOOP_R, closeP).toFixed(2));
        rope.loopNode.setAttribute("opacity", Math.min(1, closeP * 1.6).toFixed(2));
      }
      if (p >= 1) enter("pullA", now);

    } else if (phase === "pullA") {
      const p = seg(t, 0, DUR.pullA);
      const tug = tugWave(p, HOLD_FRAC, 4);
      const strain = clamp(tug / 4, 0, 1);
      // The thumb's cosmetic nudge only moves the pseudo-element (see
      // nudgeThumb), not the box thumbClientPos() reads from — so the rope
      // has to add that same offset itself, or it stays aimed at the
      // thumb's un-nudged position while the visible thumb dips beneath it.
      const tyN = ty + strain * NUDGE_MAX;
      const dir = awayFromThumb(standAX, standAY, tx, tyN);
      const lean = leanTowards(dir) * strain;
      const arm = aimArm(standAX, standAY, tx, tyN) + tug * 3;
      poseBlob(blobA, { x: standAX, y: standAY, still: true, arm, lean, strain });
      drawSingleRope(standAX, standAY, tx, tyN, arm, lean);
      nudgeThumb(strain * NUDGE_MAX);
      if (p >= 1) enter("callHelp", now);

    } else if (phase === "callHelp") {
      const p = seg(t, 0, DUR.callHelp);
      const bounce = Math.abs(Math.sin(p * Math.PI * 3));
      const wave = ARM_WAVE + Math.sin(p * Math.PI * 6) * 35;
      poseBlob(blobA, { x: standAX, y: standAY, still: true, arm: wave, exclaim: p < 0.85 ? bounce : 0 });
      // The gripping hand let go to wave, so the rope hangs slack off the
      // loop rather than reaching it — it isn't being pulled right now.
      rope.setAttribute("d", `M ${tx.toFixed(2)} ${ty.toFixed(2)} L ${tx.toFixed(2)} ${(ty + 16).toFixed(2)}`);
      rope.setAttribute("opacity", "1");
      rope.loopNode.setAttribute("cx", tx.toFixed(2));
      rope.loopNode.setAttribute("cy", ty.toFixed(2));
      rope.loopNode.setAttribute("r", LOOP_R);
      rope.loopNode.setAttribute("opacity", "1");
      if (p >= 1) {
        blobB = makeBlob();
        enter("walkInB", now);
      }

    } else if (phase === "walkInB") {
      const p = easeInOut(seg(t, 0, DUR.walkInB));
      poseBlob(blobB, { x: lerp(offRight, standBX, p), y: standBY, walk: t / 260, arm: ARM_REST });
      const armA = aimArm(standAX, standAY, tx, ty);
      poseBlob(blobA, { x: standAX, y: standAY, still: true, arm: armA });
      drawSingleRope(standAX, standAY, tx, ty, armA);
      if (p >= 1) enter("pullBoth", now);

    } else if (phase === "pullBoth") {
      const p = seg(t, 0, DUR.pullBoth);
      const tug = tugWave(p, HOLD_FRAC, 5);
      const strain = clamp(tug / 5, 0, 1);
      const tyN = ty + strain * NUDGE_MAX;
      const dirA = awayFromThumb(standAX, standAY, tx, tyN);
      const dirB = awayFromThumb(standBX, standBY, tx, tyN);
      const leanA = leanTowards(dirA) * strain, leanB = leanTowards(dirB) * strain;
      const armA = aimArm(standAX, standAY, tx, tyN) + tug * 3;
      const armB = aimArm(standBX, standBY, tx, tyN) + tug * 3;
      poseBlob(blobA, { x: standAX, y: standAY, still: true, arm: armA, lean: leanA, strain });
      poseBlob(blobB, { x: standBX, y: standBY, still: true, arm: armB, lean: leanB, strain });
      const handA = handPoint(standAX, standAY, armA, leanA);
      const handB = handPoint(standBX, standBY, armB, leanB);
      rope.setAttribute("d",
        `M ${handB.x.toFixed(2)} ${handB.y.toFixed(2)} ` +
        `L ${handA.x.toFixed(2)} ${handA.y.toFixed(2)} L ${tx.toFixed(2)} ${tyN.toFixed(2)}`);
      rope.setAttribute("opacity", "1");
      rope.loopNode.setAttribute("cx", tx.toFixed(2));
      rope.loopNode.setAttribute("cy", tyN.toFixed(2));
      rope.loopNode.setAttribute("r", LOOP_R);
      rope.loopNode.setAttribute("opacity", "1");
      nudgeThumb(strain * NUDGE_MAX);
      if (p >= 1) enter("giveUp", now);

    } else if (phase === "giveUp") {
      const p = seg(t, 0, DUR.giveUp);
      rope.setAttribute("opacity", (1 - p).toFixed(2));
      rope.loopNode.setAttribute("opacity", (1 - p).toFixed(2));
      const slump = easeOut(p);
      const dirA = awayFromThumb(standAX, standAY, tx, ty);
      const dirB = awayFromThumb(standBX, standBY, tx, ty);
      // They were holding at full strain right up until this phase starts
      // (see HOLD_FRAC), so relaxing eases the lean and strain from their
      // maximum back to neutral, rather than from wherever a mid-oscillation
      // value happened to be.
      poseBlob(blobA, {
        x: standAX, y: standAY, still: true, strain: 1 - slump,
        lean: lerp(leanTowards(dirA), 0, slump),
        arm: lerp(aimArm(standAX, standAY, tx, ty), ARM_REST, slump)
      });
      poseBlob(blobB, {
        x: standBX, y: standBY, still: true, strain: 1 - slump,
        lean: lerp(leanTowards(dirB), 0, slump),
        arm: lerp(aimArm(standBX, standBY, tx, ty), ARM_REST, slump)
      });
      nudgeThumb(lerp(NUDGE_MAX, 0, slump));
      if (p >= 1) enter("wheeze", now);

    } else if (phase === "wheeze") {
      // Beaten, not just done: a beat of heavy breathing and a drooped,
      // downcast slump before they turn and walk off — asked for directly,
      // "a wheeze / give up / looking down sort of animation before they
      // leave". `intensity` ramps the droop and panting in, holds them, then
      // eases back to neutral right before "leave" picks the walk back up,
      // so nothing snaps between poses.
      const p = seg(t, 0, DUR.wheeze);
      const intensity = p < 0.15 ? easeOut(seg(p, 0, 0.15))
        : p > 0.8 ? 1 - easeInOut(seg(p, 0.8, 1))
        : 1;
      const heave = Math.sin(p * Math.PI * 2 * 2.6) * intensity;
      const droop = 9 * intensity;
      poseBlob(blobA, { x: standAX, y: standAY, still: true, arm: ARM_REST, lean: droop, heave, tired: intensity, pant: intensity > 0.05 });
      poseBlob(blobB, { x: standBX, y: standBY, still: true, arm: ARM_REST, lean: droop, heave, tired: intensity, pant: intensity > 0.05 });
      if (p >= 1) enter("leave", now);

    } else if (phase === "leave") {
      const p = easeInOut(seg(t, 0, 900));
      poseBlob(blobA, { x: lerp(standAX, offRight, p), y: standAY, walk: t / 260, arm: ARM_REST, opacity: 1 - Math.max(0, p - 0.7) / 0.3 });
      poseBlob(blobB, { x: lerp(standBX, offRight, p), y: standBY, walk: t / 220, arm: ARM_REST, opacity: 1 - Math.max(0, p - 0.7) / 0.3 });
      if (p >= 1) { cleanup(); return; }

    } else if (phase === "celebrate") {
      const p = seg(t, 0, DUR.celebrate);
      rope.setAttribute("opacity", Math.max(0, 1 - p * 6).toFixed(2));
      rope.loopNode.setAttribute("opacity", Math.max(0, 1 - p * 6).toFixed(2));
      const jump = Math.abs(Math.sin(p * Math.PI * 5)) * 9;
      const wave = -125 + Math.sin(p * Math.PI * 5) * 20;
      poseBlob(blobA, { x: standAX, y: standAY - jump, still: true, arm: wave, smile: true });
      if (blobB) poseBlob(blobB, { x: standBX, y: standBY - jump, still: true, arm: wave, smile: true });
      if (p >= 1) enter("exit", now);

    } else if (phase === "exit") {
      const p = easeInOut(seg(t, 0, DUR.exit));
      poseBlob(blobA, { x: lerp(standAX, offRight, p), y: standAY, walk: t / 200, arm: ARM_REST, smile: true, opacity: 1 - Math.max(0, p - 0.7) / 0.3 });
      if (blobB) poseBlob(blobB, { x: lerp(standBX, offRight, p), y: standBY, walk: t / 180, arm: ARM_REST, smile: true, opacity: 1 - Math.max(0, p - 0.7) / 0.3 });
      if (p >= 1) { cleanup(); return; }
    }

    raf = requestAnimationFrame(tick);
  }

  function drawSingleRope(bx, by, tx, ty, armDeg, leanDeg) {
    const hand = handPoint(bx, by, armDeg, leanDeg);
    rope.setAttribute("d", `M ${hand.x.toFixed(2)} ${hand.y.toFixed(2)} L ${tx.toFixed(2)} ${ty.toFixed(2)}`);
    rope.setAttribute("opacity", "1");
    rope.loopNode.setAttribute("cx", tx.toFixed(2));
    rope.loopNode.setAttribute("cy", ty.toFixed(2));
    rope.loopNode.setAttribute("r", LOOP_R);
    rope.loopNode.setAttribute("opacity", "1");
  }

  if ("IntersectionObserver" in window) {
    const io = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) { startSequence(); io.disconnect(); }
      });
    }, { threshold: 0.5 });
    io.observe(rail);
  } else {
    startSequence();
  }
})();
