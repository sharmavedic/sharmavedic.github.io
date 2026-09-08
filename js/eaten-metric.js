// Project 03 — "what the chart measures", as a picture instead of a paragraph.
//
// Four frames in a clockwise loop, laid out 2x2, showing where one unit of
// "grass eaten" comes from:
//
//   top-left      a full tile                       -> top-right   a cow arrives
//   bottom-left   the cow has gone, the tile        <- bottom-right the cow grazes,
//                 stays paler                                       the tile fades, +1
//
// A focus ring moves around the four in that order and the unfocused frames
// dim, so the eye is told which frame is playing; arrows in the gaps carry the
// direction. Only the focused frame animates — the other three hold the state
// their step ends in, which is what makes it read as a storyboard rather than
// four things happening at once.
//
// Same shape as js/leader-emergence.js: a small autoplaying looping diagram
// with no controls and no sim/scene split, drawing the shared CowSprite so the
// animal is the one the pastures use. Colours come from the same grass tokens
// as every pasture on the page, re-read on a theme change.
(function () {
  const svg = document.querySelector(".metric-cycle-svg");
  if (!svg || !window.CowSprite) return;

  const NS = "http://www.w3.org/2000/svg";
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  // ---- Layout --------------------------------------------------------------
  const TILE = 100, GAP = 22;
  const X0 = 8, Y0 = 16;
  const COL = [X0, X0 + TILE + GAP];          // 8, 130
  const ROW = [Y0, Y0 + TILE + GAP];          // 16, 138
  // Frames in play order, clockwise from the top-left.
  const FRAMES = [
    { col: 0, row: 0 },   // 0: full tile
    { col: 1, row: 0 },   // 1: cow arrives
    { col: 1, row: 1 },   // 2: cow grazes, tile fades, +1
    { col: 0, row: 1 }    // 3: cow leaves, paler tile stays
  ];
  const PLUS_X = COL[1] + TILE + 46;          // right of the bottom-right frame
  const PLUS_Y = ROW[1] + TILE / 2 + 6;

  // Grass levels, on the pasture's 0..5 scale: a full tile, and the same tile
  // one mouthful lighter.
  const LEVEL_FULL = 5, LEVEL_EATEN = 3, MAX_LEVEL = 5;

  // ---- Timing --------------------------------------------------------------
  const PHASE_MS = [1000, 1250, 1500, 1250];  // per frame, in play order
  const SLIDE_MS = 340;                       // focus ring travelling to this frame
  const WALK_MS = 620;                        // cow entering / leaving
  const WALK_OFF = 30;                        // how far off-tile the cow starts and ends
  const BITE_AT = 380, BITE_MS = 520;         // when the tile starts fading, and for how long
  const PLUS_AT = 420, PLUS_MS = 950;         // the +1's own life, inside frame 2

  function el(tag, attrs) {
    const e = document.createElementNS(NS, tag);
    for (const k in attrs) e.setAttribute(k, attrs[k]);
    return e;
  }
  function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }
  function cssVar(name) {
    return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  }
  function hexToRgb(hex) {
    const h = hex.trim().replace("#", "");
    const full = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
    const num = parseInt(full, 16);
    return [(num >> 16) & 255, (num >> 8) & 255, num & 255];
  }
  function lerpColor(hexA, hexB, t) {
    const a = hexToRgb(hexA), b = hexToRgb(hexB);
    const m = (i) => Math.round(a[i] + (b[i] - a[i]) * clamp(t, 0, 1));
    return `rgb(${m(0)}, ${m(1)}, ${m(2)})`;
  }
  function easeInOut(t) {
    return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
  }

  let bare = cssVar("--grass-bare") || "#ffffff";
  let full = cssVar("--grass-full") || "#15803d";
  function levelColor(level) { return lerpColor(bare, full, clamp(level, 0, MAX_LEVEL) / MAX_LEVEL); }

  Array.from(svg.children).forEach((child) => {
    if (child.nodeName !== "title" && child.nodeName !== "desc") child.remove();
  });

  // ---- Arrowhead -----------------------------------------------------------
  const defs = el("defs", {});
  const marker = el("marker", {
    id: "metricCycleArrow", viewBox: "0 0 10 10", refX: "8.5", refY: "5",
    markerWidth: "6", markerHeight: "6", orient: "auto-start-reverse"
  });
  marker.appendChild(el("path", { d: "M0,0 L10,5 L0,10 Z", fill: "var(--text-muted)" }));
  defs.appendChild(marker);
  svg.appendChild(defs);

  // ---- Frames --------------------------------------------------------------
  // Tiles are created with their colour already set: an SVG element that gets a
  // CSS fill transition and no starting colour animates up from black on its
  // first paint (the same bug the pasture hit).
  const frames = FRAMES.map((spec, i) => {
    const x = COL[spec.col], y = ROW[spec.row];
    const g = el("g", { class: "metric-frame" });
    svg.appendChild(g);

    const tile = el("rect", {
      x, y, width: TILE, height: TILE, rx: 10,
      fill: levelColor(i >= 2 ? LEVEL_EATEN : LEVEL_FULL),
      stroke: "var(--pasture-line)", "stroke-width": 1.5
    });
    g.appendChild(tile);

    // Each cow is clipped to its own tile, so it can walk in from beyond the
    // edge without ever being drawn over the frame next door.
    const clip = el("clipPath", { id: "metricCowClip" + i });
    clip.appendChild(el("rect", { x, y, width: TILE, height: TILE, rx: 10 }));
    defs.appendChild(clip);
    const cowLayer = el("g", { "clip-path": "url(#metricCowClip" + i + ")" });
    g.appendChild(cowLayer);

    // One cow per frame, so a frame's own animation never has to hand an
    // element over to the next one.
    const cow = window.CowSprite.make(window.ShepherdSprite.HERDS[0], 1);
    cow.setPose(x + TILE / 2, y + TILE / 2 + 8, 1, 0);
    cow.setEnergy(1);
    cowLayer.appendChild(cow.node);

    return { g, tile, cow, x, y, level: i >= 2 ? LEVEL_EATEN : LEVEL_FULL };
  });

  // ---- Focus ring ----------------------------------------------------------
  const focus = el("rect", {
    x: COL[0] - 6, y: ROW[0] - 6, width: TILE + 12, height: TILE + 12, rx: 14,
    fill: "none", stroke: "var(--primary)", "stroke-width": 3, opacity: "1"
  });
  svg.appendChild(focus);

  // ---- Arrows --------------------------------------------------------------
  // One per hop, living in the gap it crosses, pointing the way the loop runs.
  const MID_X = [COL[0] + TILE / 2, COL[1] + TILE / 2];
  const MID_Y = [ROW[0] + TILE / 2, ROW[1] + TILE / 2];
  const ARROWS = [
    { x1: COL[0] + TILE + 4, y1: MID_Y[0], x2: COL[1] - 4, y2: MID_Y[0] },          // 0 -> 1
    { x1: MID_X[1], y1: ROW[0] + TILE + 4, x2: MID_X[1], y2: ROW[1] - 4 },          // 1 -> 2
    { x1: COL[1] - 4, y1: MID_Y[1], x2: COL[0] + TILE + 4, y2: MID_Y[1] },          // 2 -> 3
    { x1: MID_X[0], y1: ROW[1] - 4, x2: MID_X[0], y2: ROW[0] + TILE + 4 }           // 3 -> 0
  ];
  const arrows = ARROWS.map((a) => {
    const line = el("line", {
      x1: a.x1, y1: a.y1, x2: a.x2, y2: a.y2,
      stroke: "var(--text-muted)", "stroke-width": 2.4, "stroke-linecap": "round",
      "marker-end": "url(#metricCycleArrow)", opacity: "0.4"
    });
    svg.appendChild(line);
    return line;
  });

  // ---- The +1 --------------------------------------------------------------
  const plus = el("text", {
    x: PLUS_X, y: PLUS_Y, "text-anchor": "middle", "font-size": "26",
    "font-weight": "700", fill: "var(--grass-full)", opacity: "0"
  });
  plus.textContent = "+1";
  svg.appendChild(plus);

  const plusLabel = el("text", {
    x: PLUS_X, y: PLUS_Y + 24, "text-anchor": "middle", "font-size": "15.2",
    fill: "var(--text-muted)", opacity: "0"
  });
  plusLabel.textContent = "eaten";
  svg.appendChild(plusLabel);

  // ---- Rendering -----------------------------------------------------------
  // `phase` is which frame is playing; `t` is milliseconds into it.
  function render(phase, t) {
    frames.forEach((f, i) => {
      const active = i === phase;

      // Defaults: the state this frame's step ends in.
      let level = i >= 2 ? LEVEL_EATEN : LEVEL_FULL;
      let cowX = f.x + TILE / 2;
      let cowShown = i === 1 || i === 2;
      let grazing = i === 2;
      let facing = 1;                                // +1 faces right, -1 faces left

      if (active && i === 1) {                       // walks on from the left, facing right
        const p = easeInOut(clamp(t / WALK_MS, 0, 1));
        cowX = f.x - WALK_OFF + p * (TILE / 2 + WALK_OFF);
        cowShown = true;
        grazing = false;
      } else if (active && i === 2) {                // it grazes; the tile fades
        const bite = clamp((t - BITE_AT) / BITE_MS, 0, 1);
        level = LEVEL_FULL + (LEVEL_EATEN - LEVEL_FULL) * bite;
        grazing = t > BITE_AT * 0.55;
      } else if (active && i === 3) {                // walks off to the left, facing left
        const p = easeInOut(clamp(t / WALK_MS, 0, 1));
        cowX = f.x + TILE / 2 - p * (TILE / 2 + WALK_OFF);
        cowShown = true;
        grazing = false;
        facing = -1;
      }

      if (Math.abs(level - f.level) > 0.001) {
        f.tile.setAttribute("fill", levelColor(level));
        f.level = level;
      }
      f.cow.node.setAttribute("opacity", cowShown ? "1" : "0");
      f.cow.setPose(cowX, f.y + TILE / 2 + 8, facing, 0);
      f.cow.setGrazing(grazing);
    });

    const from = FRAMES[(phase + FRAMES.length - 1) % FRAMES.length];
    const to = FRAMES[phase];
    const slide = easeInOut(clamp(t / SLIDE_MS, 0, 1));
    focus.setAttribute("x", (COL[from.col] + (COL[to.col] - COL[from.col]) * slide - 6).toFixed(1));
    focus.setAttribute("y", (ROW[from.row] + (ROW[to.row] - ROW[from.row]) * slide - 6).toFixed(1));

    // Whichever arrow the ring is on brightens: the one it is travelling along
    // while it slides, then the one it will leave by.
    const lit = slide < 1 ? (phase + FRAMES.length - 1) % FRAMES.length : phase;
    arrows.forEach((line, i) => line.setAttribute("opacity", i === lit ? "1" : "0.4"));

    // The +1 rides frame 2 only: it fades up as the mouthful is taken, drifts,
    // and is gone before the focus moves on.
    if (phase === 2) {
      const p = clamp((t - PLUS_AT) / PLUS_MS, 0, 1);
      const fade = p <= 0 ? 0 : p < 0.25 ? p / 0.25 : 1 - (p - 0.25) / 0.75;
      plus.setAttribute("opacity", clamp(fade, 0, 1).toFixed(2));
      plusLabel.setAttribute("opacity", (clamp(fade, 0, 1) * 0.85).toFixed(2));
      plus.setAttribute("y", (PLUS_Y - p * 16).toFixed(1));
      plusLabel.setAttribute("y", (PLUS_Y + 24 - p * 16).toFixed(1));
    } else {
      plus.setAttribute("opacity", "0");
      plusLabel.setAttribute("opacity", "0");
    }
  }

  function repaint() {
    bare = cssVar("--grass-bare") || bare;
    full = cssVar("--grass-full") || full;
    frames.forEach((f) => { f.tile.setAttribute("fill", levelColor(f.level)); });
  }
  new MutationObserver(repaint).observe(document.documentElement, {
    attributes: true, attributeFilter: ["data-theme"]
  });
  const darkQuery = window.matchMedia("(prefers-color-scheme: dark)");
  if (darkQuery.addEventListener) darkQuery.addEventListener("change", repaint);

  if (reduceMotion) {
    // Hold the frame the +1 belongs to, with every end state shown.
    render(2, BITE_AT + BITE_MS);
    plus.setAttribute("opacity", "1");
    plusLabel.setAttribute("opacity", "0.85");
    return;
  }

  window.eatenMetric = { render, PHASE_MS, FRAMES };

  let phase = 0, t = 0, last = performance.now();
  render(0, 0);
  function loop(now) {
    const dt = Math.min(now - last, 120);   // cap, so a backgrounded tab doesn't jump
    last = now;
    t += dt;
    if (t >= PHASE_MS[phase]) {
      t -= PHASE_MS[phase];
      phase = (phase + 1) % FRAMES.length;
    }
    render(phase, t);
    requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);
})();
