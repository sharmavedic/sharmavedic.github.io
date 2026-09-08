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
  const W = 1190, H = 720;
  const PANEL_W = 380;
  const PANEL_X = [10, 405, 800];           // panel left edges, 15 apart
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
  const CHART = { left: 76, right: 700, top: 470, bottom: 646 };
  // The stats block fills the width the plot gave up, to the right of a rule.
  const SIDE = { rule: 748, left: 772, right: 1180, top: CHART.top };

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
  const STAT_KEYS = ["grass", "head", "eaten"];

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

    // One compact stat row under the grid: grass% · head · eaten.
    const statsY = GRID_Y + GRID + 32;
    const stats = STAT_KEYS.map((key, i) => {
      const cx = x0 + PANEL_W * (i + 0.5) / 3;
      const value = el("text", {
        x: cx, y: statsY, "text-anchor": "middle", "font-size": "16",
        "font-weight": "600", fill: "var(--text)"
      });
      value.textContent = "–";
      const label = el("text", {
        x: cx, y: statsY + 26, "text-anchor": "middle", "font-size": "15.2",
        fill: "var(--text-muted)"
      });
      label.textContent = key;
      g.appendChild(value);
      g.appendChild(label);
      return value;
    });

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
      },
      setStats(grassPct, head, eaten) {
        stats[0].textContent = grassPct + "%";
        stats[1].textContent = String(head);
        stats[2].textContent = String(eaten);
      }
    };
  }

  const panels = [
    makePanel(0, "Greedy", "Everyone plays their own top pick"),
    makePanel(1, "Fixed", "Two cows, every shepherd"),
    makePanel(2, "Leader", "Follow the highest-reputation behavior")
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
    x: CHART.left, y: CHART.top - 28, "font-size": "15.2",
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

  const lines = panels.map((panel) =>
    chartGroup.appendChild(el("polyline", {
      points: "", fill: "none", stroke: accents[panel.slot],
      "stroke-width": 2, "stroke-linejoin": "round", "stroke-linecap": "round"
    })));

  const endLabels = panels.map((panel) => {
    const t = el("text", {
      x: CHART.left, y: CHART.bottom, "font-size": "15.2", "font-weight": "600",
      fill: accents[panel.slot], "text-anchor": "end"
    });
    t.textContent = "";
    return chartGroup.appendChild(t);
  });

  // ---- Side stats ----------------------------------------------------------
  // Three rows, one per policy, in the space the narrowed plot freed. They
  // carry what the panels and the chart do *not*: how fast each pasture is
  // harvesting right now (the slope of its line over the visible window, which
  // is hard to read off near-flat cumulative curves) and how many cows it has
  // lost since the run began.
  const sideGroup = el("g", { class: "dynamics-side" });
  svg.appendChild(sideGroup);

  sideGroup.appendChild(el("line", {
    x1: SIDE.rule, y1: SIDE.top - 8, x2: SIDE.rule, y2: CHART.bottom,
    stroke: "var(--border)", "stroke-width": 1
  }));

  const sideTitle = el("text", {
    x: SIDE.left, y: SIDE.top - 28, "font-size": "15.2",
    "font-weight": "600", fill: "var(--text-muted)"
  });
  sideTitle.textContent = `Last ${START_SPAN} steps`;
  sideGroup.appendChild(sideTitle);

  const RATE_X = SIDE.right - 130, STARVED_X = SIDE.right;
  [[RATE_X, "eaten / 100 steps"], [STARVED_X, "starved"]].forEach(([x, label]) => {
    const t = el("text", {
      x, y: SIDE.top + 20, "text-anchor": "end", "font-size": "15.2",
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
    name.textContent = ["Greedy", "Fixed", "Leader"][i];
    const rate = el("text", {
      x: RATE_X, y, "text-anchor": "end", "font-size": "16",
      "font-weight": "600", fill: "var(--text)"
    });
    rate.textContent = "–";
    const starved = el("text", {
      x: STARVED_X, y, "text-anchor": "end", "font-size": "16",
      "font-weight": "600", fill: "var(--text)"
    });
    starved.textContent = "–";
    [name, rate, starved].forEach((t) => sideGroup.appendChild(t));
    sideGroup.appendChild(el("line", {
      x1: SIDE.left, y1: y + 18, x2: SIDE.right, y2: y + 18,
      stroke: "var(--border)", "stroke-width": 1, opacity: "0.6"
    }));
    return { name, rate, starved };
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
    setStarved(counts) {
      sideRows.forEach((row, i) => { row.starved.textContent = String(counts[i]); });
    },
    resetChart() { history = []; xSpan = START_SPAN; drawChart(); },
    pushSample(step, values) {
      history.push({ step, values });
      prune(step);
    },
    drawChart,
    paint
  };
})();
