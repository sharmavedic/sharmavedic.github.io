// "Building it into agents" arrives towed behind a tiny truck: a blob drives
// in from off-screen with the heading hitched to the back, parks, hops out,
// unhooks it, and drives off — leaving the real heading text sitting exactly
// where it always would have. Autoplaying, no controls, plays exactly once
// on first scroll into view, same pattern as js/hero-frame.js and
// js/commons-lasso.js.
//
// Like js/commons-lasso.js, this is not a pure render(t) scene: its subject
// is a real heading in the document's own flow, not a fixed drawing. Unlike
// that file, though, there is no live control to track — the heading's
// natural position is measured once, up front, before any transform is
// ever applied to it, and every subsequent frame only ever offsets from that
// captured value. That is what keeps this simple: the animation never needs
// to re-measure the heading (and, unlike the slider thumb, nothing else on
// the page can move it out from under the animation).
(function () {
  const heading = document.getElementById("agentsHeading");
  if (!heading) return;
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
  const easeIn = (p) => p * p * p;

  // How far to the right of the text's own right edge the truck's hitch
  // point rests, once parked.
  const GAP = 14;
  // The truck's own local geometry, in units with (0, 0) at the hitch point
  // (ground level, at the back) — deliberately the same reference point the
  // tow line and the text's attach point both key off, so "attached to the
  // back of the truck" is one number, not two things kept in sync by hand.
  const WHEEL_R = 5;
  const CAB_W = 16, CAB_H = 20;
  const BED_W = 26, BED_H = 15;
  const TRUCK_FRONT = 2 + BED_W + CAB_W; // rightmost extent, local x

  let overlay = null, svg = null, raf = 0;
  let phase = "idle", phaseStart = 0;
  let truck = null, blob = null;
  let played = false;
  // Where the heading's text would sit with no transform on it, in viewport
  // coordinates — refreshed every frame, see naturalRect() below.
  let nat = null;
  // The translateX currently applied to the heading by this animation. The
  // only reason it's tracked is so naturalRect() can subtract it back out.
  let appliedDx = 0;

  // The rect of the rendered words, not of the element. An <h3> is a block:
  // its own getBoundingClientRect() is the full width of the prose column
  // (measured: 620 wide, right edge at 660) while the words themselves stop
  // at 204 — so keying the truck off the element's rect parked it ~470px
  // past the end of the text, floating alone in the empty right-hand half of
  // the line. A Range over the heading's contents reports the glyphs' real
  // box, which is what the truck is supposed to be towing. It's also tighter
  // vertically (20 tall against the block's 28.7, which includes the line
  // box's leading), so it puts the truck on the text's line rather than
  // sitting low under it.
  function measureTextRect() {
    const range = document.createRange();
    range.selectNodeContents(heading);
    return range.getBoundingClientRect();
  }

  // The heading's *untransformed* position, in the viewport coordinates the
  // fixed overlay draws in — re-derived every frame rather than cached once.
  //
  // Caching it was a real bug: getBoundingClientRect() is viewport-relative,
  // and so is the position:fixed overlay, so the instant the visitor
  // scrolled, the cached rect described where the text *used to be* and the
  // truck stayed pinned to the old spot while the words slid away under it.
  // Re-measuring live fixes scrolling, resizing and reflow in one go — the
  // only thing that has to be undone is this animation's own transform,
  // which is exactly what appliedDx is for. (A scroll listener plus stored
  // document-space coordinates would also fix the scrolling specifically,
  // but would still drift on any reflow.)
  function naturalRect() {
    const live = measureTextRect();
    return {
      left: live.left - appliedDx,
      right: live.right - appliedDx,
      top: live.top,
      bottom: live.bottom,
      width: live.width,
      height: live.height
    };
  }

  function setHeadingDx(dx) {
    appliedDx = dx;
    heading.style.transform = `translateX(${dx.toFixed(2)}px)`;
  }

  function buildOverlay() {
    overlay = document.createElement("div");
    overlay.setAttribute("aria-hidden", "true");
    overlay.style.cssText = "position:fixed; inset:0; pointer-events:none; z-index:4;";
    svg = el("svg", { style: "width:100%; height:100%; display:block; overflow:visible;" });
    overlay.appendChild(svg);
    document.body.appendChild(overlay);
    resizeSvg();
  }

  // clientWidth/clientHeight, not innerWidth/innerHeight: the former exclude
  // the scrollbar, and so does the 100%-sized overlay this viewBox is mapped
  // onto. Using innerWidth made the viewBox wider than the box it painted
  // into, so preserveAspectRatio quietly scaled everything down ~1.7% and
  // shifted it — small, but enough to put the truck visibly off the text.
  function resizeSvg() {
    const d = document.documentElement;
    svg.setAttribute("viewBox", `0 0 ${d.clientWidth} ${d.clientHeight}`);
  }

  // The tow line — truck hitch to the text's attach point. A straight rod,
  // not a rope: rigidly attached is the whole point, so it shouldn't sag or
  // wobble the way the lasso's actual rope does.
  let hitchLine = null;

  function makeTruck() {
    const g = svg.appendChild(el("g", { opacity: "0" }));
    // Wheels first, so the body's corners sit visually in front of them.
    const wheels = [10, 2 + BED_W + CAB_W / 2].map((cx) => {
      const wg = g.appendChild(el("g", { transform: `translate(${cx} 0)` }));
      wg.appendChild(el("circle", { r: WHEEL_R, fill: "var(--agents-truck-dark)" }));
      const spoke = wg.appendChild(el("line", {
        x1: -WHEEL_R + 1.2, y1: 0, x2: WHEEL_R - 1.2, y2: 0,
        stroke: "var(--agents-truck-window)", "stroke-width": 1.1, "stroke-linecap": "round"
      }));
      return { g: wg, spoke };
    });
    g.appendChild(el("rect", { x: 2, y: -BED_H, width: BED_W, height: BED_H, rx: 2, fill: "var(--agents-truck)" }));
    const cabX = 2 + BED_W;
    g.appendChild(el("rect", { x: cabX, y: -CAB_H, width: CAB_W, height: CAB_H, rx: 3, fill: "var(--agents-truck)" }));
    g.appendChild(el("rect", {
      x: cabX + 3, y: -CAB_H + 4, width: CAB_W - 8, height: 9, rx: 1.5, fill: "var(--agents-truck-window)"
    }));
    // Hitch: a small ball at the local origin with a short stub connecting
    // it to the bed, so the tow line has something to visibly terminate at
    // rather than starting from thin air.
    g.appendChild(el("line", { x1: 0, y1: -3, x2: 2, y2: -3, stroke: "var(--agents-truck-dark)", "stroke-width": 1.6 }));
    g.appendChild(el("circle", { cx: 0, cy: -3, r: 1.8, fill: "var(--agents-truck-dark)" }));
    svg.appendChild(hitchLine = el("path", {
      fill: "none", stroke: "var(--agents-hitch)", "stroke-width": 1.6, "stroke-linecap": "round", opacity: "0"
    }));
    return { node: g, wheels, cabX };
  }

  // Same blob family as js/hero-frame.js and js/commons-lasso.js (legs,
  // body, one throwing/gesturing arm, eyes) — no hat this time, since there
  // is nothing here to mark it as a specific trade the way a hard hat or a
  // cowboy hat does.
  function makeBlob() {
    const g = svg.appendChild(el("g", { opacity: "0" }));
    const legs = [
      g.appendChild(el("rect", { x: -3.4, y: -4, width: 2.2, height: 4, rx: 1.1, fill: "var(--agents-blob-dark)" })),
      g.appendChild(el("rect", { x: 1.2, y: -4, width: 2.2, height: 4, rx: 1.1, fill: "var(--agents-blob-dark)" }))
    ];
    const body = g.appendChild(el("g"));
    body.appendChild(el("ellipse", { cx: 0, cy: -9.5, rx: 6.4, ry: 6, fill: "var(--agents-blob)" }));
    const armG = el("g");
    body.appendChild(armG);
    armG.appendChild(el("rect", { x: 4.6, y: -12, width: 5.4, height: 2.2, rx: 1.1, fill: "var(--agents-blob-dark)" }));
    body.appendChild(el("circle", { cx: -2.2, cy: -10.4, r: 1.05, fill: "var(--agents-blob-eye)" }));
    body.appendChild(el("circle", { cx: 1.6, cy: -10.4, r: 1.05, fill: "var(--agents-blob-eye)" }));
    return { node: g, legs, body, armG };
  }

  function poseBlob(b, o) {
    const walk = o.walk || 0;
    const bob = o.still ? 0 : Math.sin(walk * Math.PI * 2) * 1.0;
    const squash = o.squash || 1;
    b.node.setAttribute("transform",
      `translate(${o.x.toFixed(2)} ${o.y.toFixed(2)}) scale(${(o.scale == null ? 1 : o.scale).toFixed(3)})`);
    b.node.setAttribute("opacity", (o.opacity == null ? 1 : o.opacity).toFixed(3));
    b.body.setAttribute("transform",
      `translate(0 ${bob.toFixed(2)}) scale(${(1 / squash).toFixed(3)} ${squash.toFixed(3)})`);
    const step = o.still ? 0 : Math.sin(walk * Math.PI * 2) * 1.6;
    b.legs[0].setAttribute("transform", `translate(${step.toFixed(2)} 0)`);
    b.legs[1].setAttribute("transform", `translate(${(-step).toFixed(2)} 0)`);
    b.armG.setAttribute("transform", `rotate(${(o.arm || 0).toFixed(1)} 4.6 -10.9)`);
  }

  const DUR = {
    enter: 2800, settle: 450, hopOut: 600, walkBack: 850,
    unhook: 1000, walkFwd: 850, hopIn: 500, driveOff: 1700
  };

  function elapsed(now) { return now - phaseStart; }
  function enter(next, now) { phase = next; phaseStart = now; }

  function startSequence() {
    if (played) return;
    played = true;
    buildOverlay();
    truck = makeTruck();
    blob = makeBlob();
    // Hidden here, not before — this callback fires while the heading is
    // still below the fold (see the rootMargin on the observer), so there's
    // nothing visible to pop. Hiding it earlier, unconditionally at load,
    // would risk the opposite failure: if the observer never fires for any
    // reason, the heading would stay invisible forever instead of just
    // never getting its entrance.
    heading.style.opacity = "0";
    heading.style.willChange = "transform";

    window.addEventListener("resize", resizeSvg);
    enter("enter", performance.now());
    raf = requestAnimationFrame(tick);
  }

  function cleanup() {
    window.removeEventListener("resize", resizeSvg);
    heading.style.transform = "";
    heading.style.opacity = "";
    heading.style.willChange = "";
    appliedDx = 0;
    hitched = true;
    if (overlay) overlay.remove();
    overlay = svg = truck = blob = hitchLine = null;
  }

  // The rest position, in viewport coordinates: the truck's hitch sits GAP
  // past the last letter, with its wheels on the text's own baseline, so the
  // whole vehicle occupies the same band of the line as the words it towed
  // in rather than driving along underneath them. All three read `nat`,
  // which tick() refreshes at the top of every frame.
  function restTruckX() { return nat.right + GAP; }
  function truckY() { return nat.bottom; }
  function textMidY() { return nat.top + nat.height / 2; }

  function poseTruck(truckX, wheelTurn) {
    truck.node.setAttribute("transform", `translate(${truckX.toFixed(2)} ${truckY().toFixed(2)})`);
    truck.wheels.forEach((w) => w.spoke.setAttribute("transform", `rotate(${wheelTurn.toFixed(1)})`));
  }

  // Whether the text is still on the tow line. Latched off during `unhook`
  // and never re-set, so the line stays gone for the rest of the run.
  let hitched = true;

  function drawHitch(truckX) {
    hitchLine.setAttribute("opacity", hitched ? "1" : "0");
    if (!hitched) return;
    hitchLine.setAttribute("d",
      `M ${truckX.toFixed(2)} ${(truckY() - 3).toFixed(2)} L ${(truckX - GAP).toFixed(2)} ${textMidY().toFixed(2)}`);
  }

  function tick(now) {
    const t = elapsed(now);
    // Re-derived every frame so the whole scene tracks the heading through
    // scrolling and reflow, rather than being pinned to wherever it happened
    // to be when the animation started.
    nat = naturalRect();
    const restX = restTruckX();

    // Parked pose, applied every frame in every phase. The moving phases
    // (`enter`, `driveOff`) overwrite it below with their own position.
    // Without this the truck kept whatever transform `enter`'s last frame
    // left it with and sat there in viewport coordinates while the page
    // scrolled out from under it — the blob, which *is* re-posed every
    // frame, would walk off and leave the truck behind.
    poseTruck(restX, restX * 7);
    drawHitch(restX);

    if (phase === "enter") {
      const p = easeInOut(seg(t, 0, DUR.enter));
      // Both start far enough off-screen left that neither is visible at
      // p = 0, and arrive rigidly together — the offset between them
      // (textWidth + GAP) never changes during the tow, which is what
      // "attached to the back" actually means in practice.
      const startX = -(nat.width + GAP + TRUCK_FRONT + 80);
      const truckX = lerp(startX, restX, p);
      heading.style.opacity = "1";
      setHeadingDx((truckX - GAP) - nat.right);
      truck.node.setAttribute("opacity", "1");
      poseTruck(truckX, truckX * 7);
      drawHitch(truckX);
      if (p >= 1) enter("settle", now);

    } else if (phase === "settle") {
      // Nothing moves — a small comedic beat between arriving and the
      // driver actually getting out.
      if (elapsed(now) >= DUR.settle) enter("hopOut", now);

    } else if (phase === "hopOut") {
      const p = easeOut(seg(t, 0, DUR.hopOut));
      const cabX = restX + truck.cabX + 5;
      poseBlob(blob, {
        x: cabX, y: truckY() - CAB_H * p, still: true, scale: p, opacity: p
      });
      if (p >= 1) enter("walkBack", now);

    } else if (phase === "walkBack") {
      const p = easeInOut(seg(t, 0, DUR.walkBack));
      const cabX = restX + truck.cabX + 5;
      const hitchX = restX + 4;
      poseBlob(blob, { x: lerp(cabX, hitchX, p), y: truckY(), walk: t / 330, arm: -10 });
      if (p >= 1) enter("unhook", now);

    } else if (phase === "unhook") {
      const p = seg(t, 0, DUR.unhook);
      const hitchX = restX + 4;
      // A crouch-and-tug: squash down to reach the hitch, a couple of tugs
      // on the arm, then the line lets go.
      const crouch = Math.sin(clamp(p / 0.4, 0, 1) * Math.PI);
      const tug = p > 0.35 && p < 0.75 ? Math.sin(seg(p, 0.35, 0.75) * Math.PI * 3) * 14 : 0;
      poseBlob(blob, { x: hitchX, y: truckY(), still: true, squash: 1 - crouch * 0.22, arm: -60 + tug });
      // Latched rather than recomputed per frame, so the line stays off for
      // every phase after this one.
      if (p >= 0.72 && hitched) { hitched = false; drawHitch(restX); }
      if (p >= 1) enter("walkFwd", now);

    } else if (phase === "walkFwd") {
      const p = easeInOut(seg(t, 0, DUR.walkFwd));
      const cabX = restX + truck.cabX + 5;
      const hitchX = restX + 4;
      poseBlob(blob, { x: lerp(hitchX, cabX, p), y: truckY(), walk: t / 330, arm: -10 });
      if (p >= 1) enter("hopIn", now);

    } else if (phase === "hopIn") {
      const p = easeIn(seg(t, 0, DUR.hopIn));
      const cabX = restX + truck.cabX + 5;
      poseBlob(blob, { x: cabX, y: truckY() - CAB_H * p, still: true, scale: 1 - p, opacity: 1 - p });
      if (p >= 1) enter("driveOff", now);

    } else if (phase === "driveOff") {
      const p = easeIn(seg(t, 0, DUR.driveOff));
      const endX = window.innerWidth + TRUCK_FRONT + 40;
      const truckX = lerp(restX, endX, p);
      poseTruck(truckX, truckX * 7);
      truck.node.setAttribute("opacity", (1 - Math.max(0, p - 0.85) / 0.15).toFixed(3));
      if (p >= 1) { cleanup(); return; }
    }

    raf = requestAnimationFrame(tick);
  }

  if ("IntersectionObserver" in window) {
    // rootMargin extends the trigger zone 300px past the real viewport
    // bottom, so this fires while the heading is still below the fold —
    // there's room for the truck to already be mid-drive by the time the
    // visitor actually scrolls it into view, rather than the text popping
    // hidden right as they're looking at it.
    const io = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) { startSequence(); io.disconnect(); }
      });
    }, { rootMargin: "0px 0px 300px 0px", threshold: 0 });
    io.observe(heading);
  } else {
    startSequence();
  }
})();
