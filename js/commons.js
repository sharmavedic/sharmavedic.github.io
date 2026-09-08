// Tragedy of the Commons — pasture scene (drawing only).
//
// This file owns the picture: a 6x6 pasture of grass tiles on a discrete
// bare -> lush scale, four shepherds standing one to a side, and the cow
// sprites belonging to each of them. It holds no dynamics at all — the
// grazing model and the animation loop live in js/commons-sim.js and drive
// this scene through the API published on `window.commonsScene` (bottom).
(function () {
  const svg = document.querySelector(".commons-svg");
  if (!svg) return;

  const NS = "http://www.w3.org/2000/svg";

  // ---- Layout ----------------------------------------------------------
  const N = 6;                    // pasture is N x N tiles
  const LEVELS = 6;               // grass levels 0 (bare) .. LEVELS-1 (lush)
  const TILE = 46;
  const GRID = N * TILE;
  // All four shepherds stand in a column down the left, which leaves the
  // pasture sitting right of centre in the drawing — that offset is what
  // makes it look centred in the card, since the control rail takes up the
  // matching space on the far side.
  const W = 400, H = 324;
  const GX = 104;                 // pasture left edge
  const GY = 32;                  // pasture top edge, below the legend
  const COW_SCALE = 0.55;
  const SHEPHERD_SCALE = 0.85;

  // One shepherd per herd, each with their own colour. Cows wear their
  // shepherd's colour so you can tell whose herd is eating what.
  const HERD_NAMES = ["first", "second", "third", "fourth"];
  const SIDES = window.ShepherdSprite.HERDS.map((color, i) => ({
    id: "H" + (i + 1), color, name: HERD_NAMES[i]
  }));

  // Evenly spaced down the left margin, one per herd.
  const SHEPHERD_X = 52;
  const SHEPHERD_POS = {};
  SIDES.forEach((side, i) => {
    SHEPHERD_POS[side.id] = { x: SHEPHERD_X, y: GY + (GRID * (i + 0.5)) / SIDES.length };
  });

  // ---- Helpers ---------------------------------------------------------
  function el(tag, attrs) {
    const e = document.createElementNS(NS, tag);
    for (const k in attrs) e.setAttribute(k, attrs[k]);
    return e;
  }

  function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

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

  function cssVar(name) {
    return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  }

  // The grass scale is discrete: LEVELS fixed shades, no in-between values.
  function levelColor(level, bare, full) {
    const step = clamp(Math.round(level), 0, LEVELS - 1);
    return lerpColor(bare, full, step / (LEVELS - 1));
  }

  // ---- Canvas ----------------------------------------------------------
  svg.setAttribute("viewBox", `0 0 ${W} ${H}`);
  // Keep <title>/<desc> for screen readers, drop anything else already there.
  Array.from(svg.children).forEach((child) => {
    if (child.nodeName !== "title" && child.nodeName !== "desc") child.remove();
  });

  // ---- Pasture ---------------------------------------------------------
  const levels = [];
  for (let r = 0; r < N; r++) levels.push(new Array(N).fill(LEVELS - 1));

  const pastureGroup = el("g", { class: "commons-pasture" });
  svg.appendChild(pastureGroup);

  // Tiles carry a CSS transition on `fill`, so they must be born with their
  // colour already set — otherwise the first paint animates up from the SVG
  // default black and the pasture flashes dark on load.
  const initialBare = cssVar("--grass-bare") || "#ffffff";
  const initialFull = cssVar("--grass-full") || "#15803d";

  const tiles = [];
  for (let r = 0; r < N; r++) {
    const row = [];
    for (let c = 0; c < N; c++) {
      const rect = el("rect", {
        x: GX + c * TILE + 1,
        y: GY + r * TILE + 1,
        width: TILE - 2,
        height: TILE - 2,
        rx: 4,
        fill: levelColor(levels[r][c], initialBare, initialFull),
        stroke: "var(--pasture-line)",
        "stroke-width": 1
      });
      pastureGroup.appendChild(rect);
      row.push(rect);
    }
    tiles.push(row);
  }

  pastureGroup.appendChild(el("rect", {            // fence
    x: GX - 5, y: GY - 5, width: GRID + 10, height: GRID + 10,
    rx: 8, fill: "none",
    stroke: "var(--text-muted)", "stroke-width": 2, opacity: "0.55"
  }));

  // ---- Legend ----------------------------------------------------------
  // One swatch per grass level, so the discrete scale is explicit.
  const legend = el("g", { class: "commons-legend" });
  const LGY = 8, SW = 11, SH = 9;
  const LEG_W = LEVELS * (SW + 1) - 1;
  const LGX = GX + GRID / 2 - LEG_W / 2;   // centred over the pasture
  const legendSwatches = [];
  for (let i = 0; i < LEVELS; i++) {
    const sw = el("rect", {
      x: LGX + i * (SW + 1), y: LGY, width: SW, height: SH, rx: 2,
      fill: levelColor(i, initialBare, initialFull),
      stroke: "var(--pasture-line)", "stroke-width": 1
    });
    legend.appendChild(sw);
    legendSwatches.push(sw);
  }
  // Labels sit either side of the strip rather than under it, so the whole
  // legend is one shallow band above the grid.
  [["bare", LGX - 6, "end"], ["lush", LGX + LEG_W + 6, "start"]].forEach(([word, x, anchor]) => {
    const t = el("text", {
      x, y: LGY + SH - 1, "text-anchor": anchor,
      // 15.2 is the card type floor (see css .commons-visual-tagline's
      // effective size); the strip is shallower than the label, so the label
      // straddles it rather than sitting inside it.
      "font-size": "15.2", "letter-spacing": "0.4", fill: "var(--text-muted)"
    });
    t.textContent = word;
    legend.appendChild(t);
  });
  svg.appendChild(legend);

  // ---- Figures ---------------------------------------------------------
  // Cow figure, from the sprite shared with Project 02's paired pastures.
  function makeCow(color) {
    return window.CowSprite.make(color, COW_SCALE);
  }

  // Shepherd figure, from the sprite shared with the gossip scene.
  function makeShepherd(pos, color) {
    const g = window.ShepherdSprite.make(color, "commons-shepherd");
    g.setAttribute("transform", `translate(${pos.x} ${pos.y}) scale(${SHEPHERD_SCALE})`);
    return g;
  }

  const shepherdGroup = el("g", { class: "commons-shepherds" });
  svg.appendChild(shepherdGroup);
  const cowGroup = el("g", { class: "commons-cows" });
  svg.appendChild(cowGroup);

  const shepherds = SIDES.map((side) => {
    const pos = SHEPHERD_POS[side.id];
    shepherdGroup.appendChild(makeShepherd(pos, side.color));
    return { id: side.id, name: side.name, color: side.color, x: pos.x, y: pos.y, cows: [] };
  });

  let cows = [];

  // A cow that runs out of energy fades off the pasture and is gone; the
  // node is kept around only long enough for the fade to play.
  function removeCow(cow) {
    cows = cows.filter((c) => c !== cow);
    if (cow.shepherd) cow.shepherd.cows = cow.shepherd.cows.filter((c) => c !== cow);
    cow.node.classList.add("commons-cow-gone");
    setTimeout(() => cow.node.remove(), 600);
  }

  // Rebuild every herd at `perShepherd` head. Returns the flat cow list;
  // the caller decides where they stand.
  function setHerdSize(perShepherd) {
    cowGroup.replaceChildren();
    cows = [];
    shepherds.forEach((shepherd) => {
      shepherd.cows = [];
      for (let i = 0; i < perShepherd; i++) {
        const cow = makeCow(shepherd.color);
        cow.shepherd = shepherd;
        cowGroup.appendChild(cow.node);
        shepherd.cows.push(cow);
        cows.push(cow);
      }
    });
    return cows;
  }

  // ---- Painting --------------------------------------------------------
  function paint() {
    const bare = cssVar("--grass-bare") || "#ffffff";
    const full = cssVar("--grass-full") || "#14532d";
    for (let r = 0; r < N; r++) {
      for (let c = 0; c < N; c++) {
        tiles[r][c].setAttribute("fill", levelColor(levels[r][c], bare, full));
      }
    }
    legendSwatches.forEach((sw, i) => sw.setAttribute("fill", levelColor(i, bare, full)));
  }

  paint();

  // Repaint when the theme flips (button toggle or OS-level change).
  new MutationObserver(paint).observe(document.documentElement, {
    attributes: true, attributeFilter: ["data-theme"]
  });
  const darkQuery = window.matchMedia("(prefers-color-scheme: dark)");
  if (darkQuery.addEventListener) darkQuery.addEventListener("change", paint);

  // ---- API for the simulation -----------------------------------------
  window.commonsScene = {
    svg, N, LEVELS, TILE, GX, GY, W, H,
    shepherds,
    get cows() { return cows; },
    setHerdSize,
    removeCow,
    tileCenter(r, c) { return { x: GX + c * TILE + TILE / 2, y: GY + r * TILE + TILE / 2 }; },
    getGrassLevel(r, c) { return levels[r][c]; },
    setGrassLevel(r, c, v) { levels[r][c] = clamp(Math.round(v), 0, LEVELS - 1); },
    resetGrass(fn) {
      for (let r = 0; r < N; r++) {
        for (let c = 0; c < N; c++) levels[r][c] = clamp(Math.round(fn ? fn(r, c) : LEVELS - 1), 0, LEVELS - 1);
      }
      paint();
    },
    totalGrass() {
      let sum = 0;
      for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) sum += levels[r][c];
      return sum;
    },
    maxGrass() { return N * N * (LEVELS - 1); },
    paint
  };
})();
