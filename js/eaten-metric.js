// Project 03 — "what the chart measures", as a picture instead of a paragraph.
//
// One tile, one cow, four phases on a loop:
//
//   0 ARRIVE  the cow walks onto a full tile
//   1 GRAZE   it eats; the tile fades and a +1 counts the mouthful
//   2 LEAVE   the cow walks on off the other side
//   3 REGROW  with nobody grazing, the tile eases back to full
//
// ...then it repeats — full tile, cow in, eat, cow out, tile back to full,
// forever, like a GIF. No grid, no cast of frames: it's the same tile the
// whole time, which is the point — one mouthful is one pass through this
// loop, and cumulative grass eaten is just this, counted many times over by
// many cows.
//
// No controls, no sim/scene split, like js/leader-emergence.js. Draws the
// shared CowSprite so the animal is the one the pastures use. Colours come
// from the same grass tokens as every pasture on the page, re-read on a
// theme change.
(function () {
  const svg = document.querySelector(".metric-cycle-svg");
  if (!svg || !window.CowSprite) return;

  const NS = "http://www.w3.org/2000/svg";
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  // ---- Layout --------------------------------------------------------------
  const W = 220, H = 148;
  const TILE = 120;
  const TILE_X = 26;                          // shifted left of centre, to leave room at the
                                               // right for the +1 (tile spans 26 .. 146)
  const TILE_Y = 14;                          // tile spans 14 .. 134 — the +1 now sits beside
                                               // the tile, not above it, so this is just breathing
                                               // room off the top edge, not space to fit text into
  const TILE_CENTER_X = TILE_X + TILE / 2;
  const TILE_CENTER_Y = TILE_Y + TILE / 2;
  const WALK_OFF = 34;                        // how far off-tile the cow starts and ends
  // To the right of the tile, and nudged up from the tile's vertical centre.
  const PLUS_X = (TILE_X + TILE + W) / 2;
  const PLUS_BLOCK_CENTER_Y = TILE_CENTER_Y - 20;
  const PLUS_Y = PLUS_BLOCK_CENTER_Y - 11;
  const PLUS_LABEL_Y = PLUS_BLOCK_CENTER_Y + 11;

  // Grass levels, on the pasture's 0..5 scale: a full tile, and the same tile
  // one mouthful lighter.
  const LEVEL_FULL = 5, LEVEL_EATEN = 3, MAX_LEVEL = 5;

  // ---- Timing (ms) -----------------------------------------------------
  const WALK_MS = 650;                        // cow entering / leaving
  const BITE_AT = 220, BITE_MS = 560;         // when the tile starts fading, and for how long
  const PLUS_AT = 260, PLUS_MS = 1650;        // the +1's own life
  const PLUS_FADE_IN = 0.12, PLUS_FADE_OUT_AT = 0.75; // fraction of PLUS_MS: fades in, then
                                               // holds fully visible until here, then fades out —
                                               // the hold is what gives a viewer time to read it
  const REGROW_MS = 850;                      // tile easing back up to full
  const PAUSE = { arrive: 150, graze: 160, leave: 150, regrow: 300 };
  const PHASES = ["arrive", "graze", "leave", "regrow"];
  const PHASE_MS = [
    WALK_MS + PAUSE.arrive,
    Math.max(PLUS_AT + PLUS_MS, BITE_AT + BITE_MS) + PAUSE.graze,
    WALK_MS + PAUSE.leave,
    REGROW_MS + PAUSE.regrow
  ];

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
  svg.setAttribute("viewBox", `0 0 ${W} ${H}`);

  const defs = el("defs", {});
  svg.appendChild(defs);

  // ---- The tile --------------------------------------------------------
  let tileLevel = LEVEL_FULL;
  const tile = el("rect", {
    x: TILE_X, y: TILE_Y, width: TILE, height: TILE, rx: 10,
    fill: levelColor(tileLevel), stroke: "var(--pasture-line)", "stroke-width": 1.5
  });
  svg.appendChild(tile);

  // The cow is clipped to the tile so it can walk on/off from beyond the
  // edge without ever rendering past the frame.
  const clip = el("clipPath", { id: "metricCowClip" });
  clip.appendChild(el("rect", { x: TILE_X, y: TILE_Y, width: TILE, height: TILE, rx: 10 }));
  defs.appendChild(clip);
  const cowLayer = el("g", { "clip-path": "url(#metricCowClip)" });
  svg.appendChild(cowLayer);

  const cow = window.CowSprite.make(window.ShepherdSprite.HERDS[0], 1);
  cow.setEnergy(1);
  cowLayer.appendChild(cow.node);

  // ---- The +1 --------------------------------------------------------------
  const plus = el("text", {
    x: PLUS_X, y: PLUS_Y, "text-anchor": "middle", "font-size": "26",
    "font-weight": "700", fill: "var(--grass-full)", opacity: "0"
  });
  plus.textContent = "+1";
  svg.appendChild(plus);

  const plusLabel = el("text", {
    x: PLUS_X, y: PLUS_LABEL_Y, "text-anchor": "middle", "font-size": "15.2",
    fill: "var(--text-muted)", opacity: "0"
  });
  plusLabel.textContent = "eaten";
  svg.appendChild(plusLabel);

  // ---- Rendering -----------------------------------------------------------
  // `phase` is which of the four steps above is playing; `t` is milliseconds
  // into it.
  function setTileLevel(level) {
    if (Math.abs(level - tileLevel) > 0.001) {
      tile.setAttribute("fill", levelColor(level));
      tileLevel = level;
    }
  }

  function render(phase, t) {
    const name = PHASES[phase];

    if (name === "arrive") {
      const p = easeInOut(clamp(t / WALK_MS, 0, 1));
      const cowX = (TILE_X - WALK_OFF) + p * (TILE / 2 + WALK_OFF);
      cow.node.setAttribute("opacity", "1");
      cow.setPose(cowX, TILE_CENTER_Y + 8, 1, 0);
      cow.setGrazing(false);
      setTileLevel(LEVEL_FULL);
      plus.setAttribute("opacity", "0");
      plusLabel.setAttribute("opacity", "0");
    } else if (name === "graze") {
      const bite = clamp((t - BITE_AT) / BITE_MS, 0, 1);
      cow.node.setAttribute("opacity", "1");
      cow.setPose(TILE_CENTER_X, TILE_CENTER_Y + 8, 1, 0);
      cow.setGrazing(t > BITE_AT * 0.55);
      setTileLevel(LEVEL_FULL + (LEVEL_EATEN - LEVEL_FULL) * bite);

      const p = clamp((t - PLUS_AT) / PLUS_MS, 0, 1);
      const fade = p <= 0 ? 0
        : p < PLUS_FADE_IN ? p / PLUS_FADE_IN
        : p < PLUS_FADE_OUT_AT ? 1
        : 1 - (p - PLUS_FADE_OUT_AT) / (1 - PLUS_FADE_OUT_AT);
      plus.setAttribute("opacity", clamp(fade, 0, 1).toFixed(2));
      plusLabel.setAttribute("opacity", (clamp(fade, 0, 1) * 0.85).toFixed(2));
      plus.setAttribute("y", (PLUS_Y - p * 16).toFixed(1));
      plusLabel.setAttribute("y", (PLUS_LABEL_Y - p * 16).toFixed(1));
    } else if (name === "leave") {
      const p = easeInOut(clamp(t / WALK_MS, 0, 1));
      const cowX = TILE_CENTER_X + p * (TILE / 2 + WALK_OFF);
      cow.node.setAttribute("opacity", "1");
      cow.setPose(cowX, TILE_CENTER_Y + 8, 1, 0);
      cow.setGrazing(false);
      setTileLevel(LEVEL_EATEN);
      plus.setAttribute("opacity", "0");
      plusLabel.setAttribute("opacity", "0");
    } else {                                  // regrow
      const p = easeInOut(clamp(t / REGROW_MS, 0, 1));
      cow.node.setAttribute("opacity", "0");
      setTileLevel(LEVEL_EATEN + (LEVEL_FULL - LEVEL_EATEN) * p);
      plus.setAttribute("opacity", "0");
      plusLabel.setAttribute("opacity", "0");
    }
  }

  function repaint() {
    bare = cssVar("--grass-bare") || bare;
    full = cssVar("--grass-full") || full;
    tile.setAttribute("fill", levelColor(tileLevel));
  }
  new MutationObserver(repaint).observe(document.documentElement, {
    attributes: true, attributeFilter: ["data-theme"]
  });
  const darkQuery = window.matchMedia("(prefers-color-scheme: dark)");
  if (darkQuery.addEventListener) darkQuery.addEventListener("change", repaint);

  if (reduceMotion) {
    // Hold mid-graze, with the +1 shown, as a single illustrative frame.
    render(1, BITE_AT + BITE_MS);
    plus.setAttribute("opacity", "1");
    plusLabel.setAttribute("opacity", "0.85");
    return;
  }

  window.eatenMetric = { render, PHASE_MS, PHASES };

  let phase = 0, t = 0, last = performance.now();
  render(0, 0);
  function loop(now) {
    const dt = Math.min(now - last, 120);   // cap, so a backgrounded tab doesn't jump
    last = now;
    t += dt;
    if (t >= PHASE_MS[phase]) {
      t -= PHASE_MS[phase];
      phase = (phase + 1) % PHASES.length;
    }
    render(phase, t);
    requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);
})();
