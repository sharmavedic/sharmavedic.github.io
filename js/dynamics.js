// Project 03 — three-pasture scene (drawing only).
//
// Three independent 6x6 pastures side by side, each running a different
// herd-size policy, all from the same seed and starting grass so any
// difference between them comes from the policy alone. A shared cumulative
// harvest chart runs across the bottom, one line per pasture.
//
// Modelled closely on js/norms.js (Project 02's archived two-pasture scene,
// stacked vertically with a weather strip) — this is the same idea widened to
// three columns and with the weather/season machinery dropped, since Project
// 03 runs on constant weather.
//
// Holds no dynamics. js/dynamics-sim.js owns the models and drives this
// through the API published on `window.dynamicsScene` at the bottom.
(function () {
  const svg = document.querySelector(".dynamics-svg");
  if (!svg) return;

  const NS = "http://www.w3.org/2000/svg";

  // ---- Layout ------------------------------------------------------------
  // The card spans the page measure (see --dynamics-card), so the drawing is
  // 1190 units wide and one unit renders as one CSS pixel at full width. That
  // matters: the type sizes below are in user units, so widening by changing
  // these constants keeps the labels at the size they were designed at, where
  // scaling a narrower viewBox up would have blown them up with everything
  // else.
  const N = 6, LEVELS = 6, TILE = 40;
  const GRID = N * TILE;                    // 240
  const W = 1000, H = 672;
  // 380 was wider than anything in a panel needed: the widest thing a panel has
  // to hold is its subtitle, and "Follow the highest-reputation behaviour" is
  // 295px at the 15.2px type floor. 316 gives that ~10px either side, and the
  // 190 units saved come straight off the card's width.
  const PANEL_W = 316;
  const PANEL_X = [10, 342, 674];           // panel left edges, 16 apart
  const PANEL_TOP = 8;
  const GRID_Y = PANEL_TOP + 96;            // room above for title/subtitle/shepherds.
                                            // Was 58 at the old type sizes and 70
                                            // after they went up; both left every
                                            // band in this column 1-4 units apart,
                                            // which read as cramped. The whole
                                            // column is now spaced on ~12-16 unit
                                            // gaps between one band's ink and the
                                            // next's.
  const COW_SCALE = 0.49;                   // 0.32 was tuned to TILE 26
  const SHEPHERD_SCALE = 0.42;
  // Two label rows sit above the plot now — the chart title, then the norm
  // marker's caption — so the titles moved up to `top - 48` and the plot down
  // 10 units to open a proper gap between them. At `top - 28` / `top - 8` the
  // two boxes cleared each other by 2 units, against the 8-16 this card's
  // vertical rhythm is cut to.
  const CHART = { left: 76, right: 536, top: 422, bottom: 598 };
  const TITLE_DY = 48;        // title baseline above CHART.top
  const NORM_LABEL_DY = 12;   // marker caption baseline above CHART.top
  // The stats block fills the width the plot gave up, to the right of a rule.
  // It used to be 346 wide and carry two columns (rate, starved); it now holds
  // five — the policy name plus rate / grass / head / eaten — because the three
  // readouts that sat under each pasture moved in here, so the plot gave up a
  // further 44 units and the block went to 390. Its other floor is still the
  // note along the bottom, 336px at 15.2.
  const SIDE = { rule: 576, left: 600, right: 990, top: CHART.top };

  const HERD_COLORS = window.ShepherdSprite.HERDS;
  const ACCENT_VARS = ["--opt-1", "--opt-2", "--opt-3"];

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
  function levelColor(level, bare, full) {
    return lerpColor(bare, full, clamp(Math.round(level), 0, LEVELS - 1) / (LEVELS - 1));
  }

  svg.setAttribute("viewBox", `0 0 ${W} ${H}`);
  Array.from(svg.children).forEach((child) => {
    if (child.nodeName !== "title" && child.nodeName !== "desc") child.remove();
  });

  // Everything that carries a CSS transition on `fill` is born with its colour
  // already set — otherwise the first paint animates up from black.
  let bare = cssVar("--grass-bare") || "#ffffff";
  let full = cssVar("--grass-full") || "#15803d";
  let accents = ACCENT_VARS.map((v) => cssVar(v) || "#6366f1");

  // ---- Panels --------------------------------------------------------------
  // Panels carry no readouts of their own. grass / head / eaten used to sit in
  // a row under each grid; they are columns of the side table now, so the three
  // pastures can be compared down a column instead of across 700 units of
  // drawing.
  function makePanel(slot, title, subtitle) {
    const x0 = PANEL_X[slot];
    const g = el("g", { class: "dynamics-panel" });
    svg.appendChild(g);

    const head = el("text", {
      x: x0 + PANEL_W / 2, y: PANEL_TOP + 14, "text-anchor": "middle",
      "font-size": "16", "font-weight": "600", fill: "var(--text)"
    });
    head.textContent = title;
    g.appendChild(head);

    const rule = el("rect", {
      x: x0 + PANEL_W / 2 - 20, y: PANEL_TOP + 24, width: 40, height: 2, rx: 1,
      fill: accents[slot]
    });
    g.appendChild(rule);

    const sub = el("text", {
      x: x0 + PANEL_W / 2, y: PANEL_TOP + 46, "text-anchor": "middle",
      "font-size": "15.2", fill: "var(--text-muted)"
    });
    sub.textContent = subtitle;
    g.appendChild(sub);

    // Four shepherds in a compact row above the grid.
    const shepherdY = GRID_Y - 24;
    const shepherdGap = PANEL_W / 5;
    HERD_COLORS.forEach((color, i) => {
      const fig = window.ShepherdSprite.make(color, "dynamics-shepherd");
      fig.setAttribute("transform",
        `translate(${x0 + shepherdGap * (i + 1)} ${shepherdY}) scale(${SHEPHERD_SCALE})`);
      g.appendChild(fig);
    });

    const gridX = x0 + (PANEL_W - GRID) / 2;
    const tiles = [];
    const tileGroup = el("g", { class: "dynamics-pasture" });
    g.appendChild(tileGroup);
    for (let r = 0; r < N; r++) {
      const row = [];
      for (let c = 0; c < N; c++) {
        const rect = el("rect", {
          x: gridX + c * TILE + 1, y: GRID_Y + r * TILE + 1,
          width: TILE - 2, height: TILE - 2, rx: 3,
          fill: levelColor(LEVELS - 1, bare, full),
          stroke: "var(--pasture-line)", "stroke-width": 1
        });
        tileGroup.appendChild(rect);
        row.push(rect);
      }
      tiles.push(row);
    }
    tileGroup.appendChild(el("rect", {
      x: gridX - 3, y: GRID_Y - 3, width: GRID + 6, height: GRID + 6, rx: 6,
      fill: "none", stroke: "var(--text-muted)", "stroke-width": 1.5, opacity: "0.55"
    }));

    const cowGroup = el("g", { class: "dynamics-cows" });
    g.appendChild(cowGroup);

    const sprites = new Map();

    return {
      slot, rule,
      tileCenter(r, c) {
        return { x: gridX + c * TILE + TILE / 2, y: GRID_Y + r * TILE + TILE / 2 };
      },
      paintGrass(levels) {
        for (let r = 0; r < N; r++) {
          for (let c = 0; c < N; c++) {
            tiles[r][c].setAttribute("fill", levelColor(levels[r][c], bare, full));
          }
        }
      },
      syncCows(herd) {
        const live = new Set();
        herd.forEach((cow) => {
          live.add(cow.id);
          if (!sprites.has(cow.id)) {
            const sprite = window.CowSprite.make(HERD_COLORS[cow.shepherd % 4], COW_SCALE);
            const at = this.tileCenter(cow.r, cow.c);
            sprite.setPose(at.x, at.y, cow.dir, 0);
            sprite.setEnergy(cow.energy);
            cowGroup.appendChild(sprite.node);
            sprites.set(cow.id, sprite);
          }
        });
        sprites.forEach((sprite, id) => {
          if (live.has(id)) return;
          sprites.delete(id);
          sprite.node.classList.add("commons-cow-gone");
          setTimeout(() => sprite.node.remove(), 600);
        });
      },
      spriteFor(id) { return sprites.get(id); },
      clearCows() {
        sprites.clear();
        cowGroup.replaceChildren();
      }
    };
  }

  const panels = [
    makePanel(0, "Greedy", "Everyone plays their own top pick"),
    makePanel(1, "Leader", "Follow the highest-reputation behaviour"),
    makePanel(2, "Optimal", "Two cows, every shepherd")
  ];

  // The chart is a fixed-width window onto an endless run: it always shows
  // SPAN steps, so once the run passes SPAN the left edge becomes
  // (current step - SPAN) and the whole thing scrolls. Before that the window
  // is 0..SPAN and the lines grow into it.
  const START_SPAN = 500;

  // ---- Harvest chart -------------------------------------------------------
  const chartGroup = el("g", { class: "dynamics-chart" });
  svg.appendChild(chartGroup);

  const chartTitle = el("text", {
    x: CHART.left, y: CHART.top - TITLE_DY, "font-size": "15.2",
    "font-weight": "600", fill: "var(--text-muted)"
  });
  chartTitle.textContent = "Grass eaten (cumulative)";
  chartGroup.appendChild(chartTitle);

  const gridLines = [], gridLabels = [];
  for (let i = 0; i < 3; i++) {
    gridLines.push(chartGroup.appendChild(el("line", {
      x1: CHART.left, y1: CHART.bottom, x2: CHART.right, y2: CHART.bottom,
      stroke: "var(--border)", "stroke-width": 1, opacity: "0.5"
    })));
    const t = el("text", {
      x: CHART.left - 8, y: CHART.bottom, "text-anchor": "end",
      "font-size": "15.2", fill: "var(--text-muted)"
    });
    t.textContent = "";
    gridLabels.push(chartGroup.appendChild(t));
  }

  chartGroup.appendChild(el("line", {
    x1: CHART.left, y1: CHART.bottom, x2: CHART.right, y2: CHART.bottom,
    stroke: "var(--text-muted)", "stroke-width": 1, opacity: "0.8"
  }));

  const xZero = el("text", {
    x: CHART.left, y: CHART.bottom + 22, "text-anchor": "middle",
    "font-size": "15.2", fill: "var(--text-muted)"
  });
  xZero.textContent = "0";
  chartGroup.appendChild(xZero);

  const xNow = el("text", {
    x: CHART.left, y: CHART.bottom + 22, "text-anchor": "middle",
    "font-size": "15.2", fill: "var(--text-muted)"
  });
  xNow.textContent = "";
  chartGroup.appendChild(xNow);

  const xLabel = el("text", {
    x: (CHART.left + CHART.right) / 2, y: CHART.bottom + 50, "text-anchor": "middle",
    "font-size": "15.2", fill: "var(--text-muted)"
  });
  xLabel.textContent = "time step";
  chartGroup.appendChild(xLabel);

  // The step at which the Leader pasture first has every shepherd on the norm.
  // Declared before the series so the polylines draw over it rather than under,
  // and so it reads as an annotation on the plot rather than a fourth line. It
  // wears `--danger` — the same alarm red as the pasture card's tagline — which
  // is safe here because it is not a series colour: the rule this card keeps is
  // that nothing borrows `--opt-N` except the thing that owns it.
  const normMark = chartGroup.appendChild(el("line", {
    x1: CHART.left, y1: CHART.top, x2: CHART.left, y2: CHART.bottom,
    stroke: "var(--danger)", "stroke-width": 1.5, "stroke-dasharray": "4 4",
    opacity: "0.85"
  }));
  const normLabel = chartGroup.appendChild(el("text", {
    x: CHART.left, y: CHART.top - NORM_LABEL_DY, "font-size": "15.2", "font-weight": "600",
    fill: "var(--danger)"
  }));
  // "the optimal norm", not "the norm": the pasture passes through other
  // whole-herd settings on the way (everyone on one cow during the repair),
  // and the marker is specifically the welfare-optimal one — the same two cows
  // the Optimal pasture plays all run.
  normLabel.textContent = "Leader reaches the optimal norm";
  let normStep = null;
  let normLabelW = 0;   // measured once; the string never changes

  // Slot 1 is the Optimal pasture, and its line is dashed on purpose: it is the
  // target the other two are measured against rather than another competitor,
  // and a dashed rule is the conventional way to draw a reference level. The
  // legend swatch in index.html is dashed to match.
  const OPTIMAL_SLOT = 2;
  const lines = panels.map((panel) => {
    const attrs = {
      points: "", fill: "none", stroke: accents[panel.slot],
      "stroke-width": 2, "stroke-linejoin": "round", "stroke-linecap": "round"
    };
    if (panel.slot === OPTIMAL_SLOT) {
      attrs["stroke-dasharray"] = "7 5";
      attrs["stroke-linecap"] = "butt";   // round caps smear a 5px gap shut
    }
    return chartGroup.appendChild(el("polyline", attrs));
  });

  const endLabels = panels.map((panel) => {
    const t = el("text", {
      x: CHART.left, y: CHART.bottom, "font-size": "15.2", "font-weight": "600",
      fill: accents[panel.slot], "text-anchor": "end"
    });
    t.textContent = "";
    return chartGroup.appendChild(t);
  });

  // ---- Side stats ----------------------------------------------------------
  // Three rows, one per policy, in the space the narrowed plot freed — the
  // card's one place where the pastures are read against each other rather
  // than side by side. `rate` is the slope of each line over the visible
  // window (hard to read off near-flat cumulative curves); grass / head /
  // eaten are the live readouts that used to sit under each grid.
  const sideGroup = el("g", { class: "dynamics-side" });
  svg.appendChild(sideGroup);

  sideGroup.appendChild(el("line", {
    x1: SIDE.rule, y1: SIDE.top - 8, x2: SIDE.rule, y2: CHART.bottom,
    stroke: "var(--border)", "stroke-width": 1
  }));

  const sideTitle = el("text", {
    x: SIDE.left, y: SIDE.top - TITLE_DY, "font-size": "15.2",
    "font-weight": "600", fill: "var(--text-muted)"
  });
  sideTitle.textContent = `Last ${START_SPAN} steps`;
  sideGroup.appendChild(sideTitle);

  // Right-anchored column edges, laid out from the right. `eaten` gets the
  // widest slot because it is the only five-digit value on the card
  // ("16,019"); `rate` gets the second widest because its header is the long
  // one. Widen any of these and check the name column still clears the
  // leftmost value — "Optimal" ends ~664.
  const COLS = { rate: 786, grass: 852, head: 910, eaten: 990 };
  [["rate", "eaten/100"], ["grass", "grass"], ["head", "head"], ["eaten", "eaten"]]
    .forEach(([key, label]) => {
      const t = el("text", {
        x: COLS[key], y: SIDE.top + 20, "text-anchor": "end", "font-size": "15.2",
        fill: "var(--text-muted)"
      });
      t.textContent = label;
      sideGroup.appendChild(t);
    });

  const sideRows = panels.map((panel, i) => {
    const y = SIDE.top + 60 + i * 48;
    const name = el("text", {
      x: SIDE.left, y, "font-size": "15.2", "font-weight": "600",
      fill: accents[i]
    });
    name.textContent = ["Greedy", "Leader", "Optimal"][i];
    const cells = {};
    ["rate", "grass", "head", "eaten"].forEach((key) => {
      const t = el("text", {
        x: COLS[key], y, "text-anchor": "end", "font-size": "16",
        "font-weight": "600", fill: "var(--text)"
      });
      t.textContent = "–";
      cells[key] = t;
    });
    [name, cells.rate, cells.grass, cells.head, cells.eaten]
      .forEach((t) => sideGroup.appendChild(t));
    sideGroup.appendChild(el("line", {
      x1: SIDE.left, y1: y + 18, x2: SIDE.right, y2: y + 18,
      stroke: "var(--border)", "stroke-width": 1, opacity: "0.6"
    }));
    return { name, ...cells };
  });

  const sideNote = el("text", {
    x: SIDE.left, y: CHART.bottom + 22, "font-size": "15.2", fill: "var(--text-muted)"
  });
  sideNote.textContent = "Harvest rate is the slope of each line above.";
  sideGroup.appendChild(sideNote);

  let history = [];   // { step, values: [a, b, c] } for the visible window only
  let xSpan = START_SPAN;

  // Because the window is fixed-width, samples that scroll off the left are
  // dropped on the way in — so an endless run costs a bounded ~xSpan points at
  // full per-step resolution, with no decimation and no growth. One sample
  // from *before* the left edge is kept so the lines reach it rather than
  // starting a step short.
  function prune(lastStep) {
    const xMin = Math.max(0, lastStep - xSpan);
    while (history.length > 1 && history[1].step <= xMin) history.shift();
  }

  // Three grid lines split the plot into thirds, so the axis top has to be
  // three nice steps rather than one nice number — otherwise the labels come
  // out as 1667 / 3333 / 5000. Rounding the *step* instead keeps them round
  // and stops the ceiling running away from the data (5000 for a 1989 peak
  // squashed every line into the bottom third).
  function niceStep(v) {
    if (v <= 0) return 10;
    const pow = Math.pow(10, Math.floor(Math.log10(v)));
    const n = v / pow;
    const step = n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10;
    return step * pow;
  }
  function niceMax(v) { return 3 * niceStep(v / 3); }

  function drawChart() {
    const points = history;
    const lastStep = points.length ? points[points.length - 1].step : 0;
    const xMin = Math.max(0, lastStep - xSpan);
    let top = 90;
    points.forEach((h) => { h.values.forEach((v) => { top = Math.max(top, v); }); });
    top = niceMax(top * 1.05);

    // The one sample kept from before the window would land left of the plot,
    // so x is clamped to the axis rather than allowed outside it.
    const px = (step) =>
      clamp(CHART.left + ((step - xMin) / xSpan) * (CHART.right - CHART.left),
            CHART.left, CHART.right);
    const py = (v) => CHART.bottom - (v / top) * (CHART.bottom - CHART.top);

    gridLines.forEach((line, i) => {
      const v = (top * (i + 1)) / 3;
      const y = py(v);
      line.setAttribute("y1", y.toFixed(1));
      line.setAttribute("y2", y.toFixed(1));
      gridLabels[i].setAttribute("y", (y + 3).toFixed(1));
      gridLabels[i].textContent = String(Math.round(v));
    });

    // Both ends of the axis move once the window starts scrolling.
    xZero.textContent = String(xMin);
    xNow.textContent = lastStep > 20 ? String(lastStep) : "";
    xNow.setAttribute("x", px(lastStep).toFixed(1));

    // Each line's value sits off its own tip rather than beside it: the top
    // line's above, the bottom line's below, and the middle one on whichever
    // side has the larger gap to its neighbour — so a label never lands in the
    // narrow space between two lines when there is a wide space on the other
    // side of one of them.
    const last = points[points.length - 1];
    const above = [false, false, false];
    if (last) {
      const rank = [0, 1, 2].sort((a, b) => last.values[b] - last.values[a]);
      const [hi, mid, lo] = rank.map((i) => py(last.values[i]));
      above[rank[0]] = true;
      above[rank[2]] = false;
      above[rank[1]] = mid - hi >= lo - mid;   // py grows downward
    }

    panels.forEach((panel, i) => {
      lines[i].setAttribute("points",
        points.map((h) => `${px(h.step).toFixed(1)},${py(h.values[i]).toFixed(1)}`).join(" "));
      if (!last) { endLabels[i].textContent = ""; return; }
      endLabels[i].textContent = String(Math.round(last.values[i]));
      const lx = clamp(px(last.step), CHART.left + 34, CHART.right);
      // Only the lower bound really guards anything: a value can sit right up
      // against the ceiling, and clamping that label back *inside* the plot
      // would flip it below its own line — which is what the rule above exists
      // to prevent. Above-the-line labels are allowed to overhang the axis.
      const ly = clamp(py(last.values[i]) + (above[i] ? -9 : 20),
                       CHART.top - 9, CHART.bottom - 2);
      endLabels[i].setAttribute("x", lx.toFixed(1));
      endLabels[i].setAttribute("y", ly.toFixed(1));
    });

    // The marker is a point in time, and the chart is a 500-step window onto a
    // 10,000-step run — so it is only on screen while that moment is still
    // inside the window, and scrolls off the left like everything else. It is
    // never clamped to the edge: a marker pinned to the axis would claim the
    // norm was reached at a step it wasn't.
    const showNorm = normStep != null && normStep >= xMin && normStep <= lastStep;
    normMark.style.display = showNorm ? "" : "none";
    normLabel.style.display = showNorm ? "" : "none";
    if (showNorm) {
      const mx = px(normStep);
      normMark.setAttribute("x1", mx.toFixed(1));
      normMark.setAttribute("x2", mx.toFixed(1));
      if (!normLabelW) normLabelW = normLabel.getComputedTextLength() || 285;
      // The caption sits beside the line where it can, but the plot's edges
      // win: at 285 units against a 460-unit plot there is a band in the
      // middle where neither side of the line has room, so it is clamped to
      // the plot rather than flipped. Anchoring left and clamping the start
      // keeps the whole box inside on both edges — an earlier flip-only rule
      // ran the caption out to x -43, well past the axis.
      normLabel.setAttribute("text-anchor", "start");
      normLabel.setAttribute("x",
        clamp(mx + 6, CHART.left, CHART.right - normLabelW).toFixed(1));
    }

    const first = points[0];
    const span = first && last ? last.step - first.step : 0;
    sideRows.forEach((row, i) => {
      row.rate.textContent = span > 0
        ? Math.round(((last.values[i] - first.values[i]) / span) * 100).toLocaleString()
        : "–";
    });
  }

  // ---- Painting --------------------------------------------------------
  function paint() {
    bare = cssVar("--grass-bare") || "#ffffff";
    full = cssVar("--grass-full") || "#15803d";
    accents = ACCENT_VARS.map((v, i) => cssVar(v) || accents[i]);

    panels.forEach((panel, i) => {
      panel.rule.setAttribute("fill", accents[i]);
      lines[i].setAttribute("stroke", accents[i]);
      endLabels[i].setAttribute("fill", accents[i]);
      sideRows[i].name.setAttribute("fill", accents[i]);
    });
    drawChart();
  }

  new MutationObserver(paint).observe(document.documentElement, {
    attributes: true, attributeFilter: ["data-theme"]
  });
  const darkQuery = window.matchMedia("(prefers-color-scheme: dark)");
  if (darkQuery.addEventListener) darkQuery.addEventListener("change", paint);

  window.dynamicsScene = {
    svg, N, LEVELS, TILE, W, H, panels, HERD_COLORS,
    setHorizon(n) {
      xSpan = n;
      sideTitle.textContent = `Last ${n} steps`;
    },
    // One call per step, from the sim's sync(). `rate` is not here — it is
    // derived from the plotted line in drawChart(), so it can never disagree
    // with what the reader sees.
    setStats(rows) {
      sideRows.forEach((row, i) => {
        row.grass.textContent = rows[i].grass + "%";
        row.head.textContent = String(rows[i].head);
        row.eaten.textContent = rows[i].eaten.toLocaleString();
      });
    },
    // null until the sim sees it happen — never predicted from the schedule,
    // so the marker cannot sit at a step the pasture did not reach the norm on.
    setNormStep(step) { normStep = step; },
    resetChart() { history = []; xSpan = START_SPAN; normStep = null; drawChart(); },
    pushSample(step, values) {
      history.push({ step, values });
      prune(step);
    },
    drawChart,
    paint
  };
})();
