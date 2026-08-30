// Project 02 — paired-pasture scene (drawing only).
//
// Two pastures stacked one above the other under a shared weather strip, each
// with its norm, its shepherds and its running totals in a label column down
// the left, and a cumulative-harvest chart across the bottom. Both pastures
// get the same season sequence and the same starting grass; the only thing
// that differs is the norm each is playing, which is the whole point.
//
// Holds no dynamics. js/norms-sim.js owns the models and drives this through
// the API published on `window.normsScene` at the bottom.
(function () {
  const svg = document.querySelector(".norms-svg");
  if (!svg) return;

  const NS = "http://www.w3.org/2000/svg";

  // ---- Layout ----------------------------------------------------------
  // The drawing is 480 wide, the same as the gossip box in Project 01, so the
  // two project cards come out identical and their columns line up.
  const N = 6, LEVELS = 6, TILE = 38;
  const GRID = N * TILE;                 // 228
  const W = 480, H = 700;
  const PASTURE_X = 238;                 // 238 .. 466
  const PANEL_Y = [46, 312];             // pasture tops, 38px of gap between
  const DIVIDER_Y = 293;                 // halfway down that gap
  const LABEL_X = 14;                    // label column, 14 .. 230
  const COW_SCALE = 0.45;
  const SHEPHERD_SCALE = 0.5;
  const CHART = { left: 46, right: 468, top: 580, bottom: 662 };

  const HERD_COLORS = window.ShepherdSprite.HERDS;

  // Seasons are ordered, not categorical, so they wear the pasture's own
  // bare -> lush ramp rather than four unrelated hues.
  const SEASONS = ["drought", "dry", "fair", "wet"];

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
  // The season ramp reuses the grass scale, evenly spaced across it.
  function seasonColor(i, bare, full) {
    return levelColor(i * ((LEVELS - 1) / (SEASONS.length - 1)), bare, full);
  }

  svg.setAttribute("viewBox", `0 0 ${W} ${H}`);
  Array.from(svg.children).forEach((child) => {
    if (child.nodeName !== "title" && child.nodeName !== "desc") child.remove();
  });

  // Everything that carries a CSS transition on `fill` is born with its colour
  // already set — otherwise the first paint animates up from black and the
  // card flashes dark on load.
  let bare = cssVar("--grass-bare") || "#ffffff";
  let full = cssVar("--grass-full") || "#15803d";
  const ACCENT_VARS = ["--norm-fixed", "--norm-adaptive"];
  let accents = ACCENT_VARS.map((v) => cssVar(v) || "#6366f1");

  // ---- Weather strip ---------------------------------------------------
  const strip = el("g", { class: "norms-weather" });
  svg.appendChild(strip);

  const CHIP_W = 98, CHIP_H = 24, CHIP_GAP = 8;
  const chipTotal = SEASONS.length * CHIP_W + (SEASONS.length - 1) * CHIP_GAP;
  const chipX0 = (W - chipTotal) / 2;
  const chips = SEASONS.map((name, i) => {
    const x = chipX0 + i * (CHIP_W + CHIP_GAP);
    const box = el("rect", {
      x, y: 2, width: CHIP_W, height: CHIP_H, rx: 12,
      fill: "none", stroke: "var(--border)", "stroke-width": 1, opacity: "0.5"
    });
    const swatch = el("rect", {
      x: x + 10, y: 9, width: 11, height: 10, rx: 2,
      fill: seasonColor(i, bare, full),
      stroke: "var(--pasture-line)", "stroke-width": 1
    });
    const label = el("text", { x: x + 28, y: 18, "font-size": "11", fill: "var(--text-muted)" });
    label.textContent = name;
    strip.appendChild(box);
    strip.appendChild(swatch);
    strip.appendChild(label);
    return { box, swatch, label, index: i };
  });

  function setSeason(index) {
    chips.forEach((chip) => {
      const on = chip.index === index;
      chip.box.setAttribute("stroke", on ? "var(--text)" : "var(--border)");
      chip.box.setAttribute("stroke-width", on ? "2" : "1");
      chip.box.setAttribute("opacity", on ? "1" : "0.5");
      chip.label.setAttribute("fill", on ? "var(--text)" : "var(--text-muted)");
      chip.label.setAttribute("font-weight", on ? "600" : "400");
    });
  }

  // ---- Panels ----------------------------------------------------------
  // Three running totals per pasture, as a small value/label table so they
  // read like the stat row under the pasture in "The Problem".
  const STAT_KEYS = ["grass", "head", "eaten"];

  function makePanel(slot, title, subtitle) {
    const y0 = PANEL_Y[slot];
    const g = el("g", { class: "norms-panel" });
    svg.appendChild(g);

    const head = el("text", {
      x: LABEL_X, y: y0 + 14, "font-size": "13", "font-weight": "600",
      fill: "var(--text)"
    });
    head.textContent = title;
    g.appendChild(head);

    // A short rule in the panel's own colour, so its chart line can be read
    // back to the pasture without relying on the words alone.
    const rule = el("rect", {
      x: LABEL_X, y: y0 + 20, width: 52, height: 2, rx: 1, fill: accents[slot]
    });
    g.appendChild(rule);

    const sub = el("text", {
      x: LABEL_X, y: y0 + 38, "font-size": "10.5", fill: "var(--text-muted)"
    });
    sub.textContent = subtitle;
    g.appendChild(sub);

    // The same four shepherds stand with every pasture on the page.
    HERD_COLORS.forEach((color, i) => {
      const fig = window.ShepherdSprite.make(color, "norms-shepherd");
      fig.setAttribute("transform",
        `translate(${LABEL_X + 18 + i * 48} ${y0 + 84}) scale(${SHEPHERD_SCALE})`);
      g.appendChild(fig);
    });

    const stats = STAT_KEYS.map((key, i) => {
      const y = y0 + 130 + i * 20;
      const value = el("text", {
        x: LABEL_X + 46, y, "text-anchor": "end", "font-size": "12.5",
        "font-weight": "600", fill: "var(--text)"
      });
      value.textContent = "–";
      const label = el("text", {
        x: LABEL_X + 54, y, "font-size": "10.5", fill: "var(--text-muted)"
      });
      label.textContent = key;
      g.appendChild(value);
      g.appendChild(label);
      return value;
    });

    const tiles = [];
    const tileGroup = el("g", { class: "norms-pasture" });
    g.appendChild(tileGroup);
    for (let r = 0; r < N; r++) {
      const row = [];
      for (let c = 0; c < N; c++) {
        const rect = el("rect", {
          x: PASTURE_X + c * TILE + 1, y: y0 + r * TILE + 1,
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
      x: PASTURE_X - 4, y: y0 - 4, width: GRID + 8, height: GRID + 8, rx: 6,
      fill: "none", stroke: "var(--text-muted)", "stroke-width": 2, opacity: "0.55"
    }));

    const cowGroup = el("g", { class: "norms-cows" });
    g.appendChild(cowGroup);

    const sprites = new Map();   // model cow id -> sprite

    return {
      slot, rule,
      tileCenter(r, c) {
        return { x: PASTURE_X + c * TILE + TILE / 2, y: y0 + r * TILE + TILE / 2 };
      },
      paintGrass(levels) {
        for (let r = 0; r < N; r++) {
          for (let c = 0; c < N; c++) {
            tiles[r][c].setAttribute("fill", levelColor(levels[r][c], bare, full));
          }
        }
      },
      // Bring the sprite set in line with the model's herd: new cows get a
      // figure, departed ones fade out and are dropped.
      syncCows(herd) {
        const live = new Set();
        herd.forEach((cow) => {
          live.add(cow.id);
          if (!sprites.has(cow.id)) {
            const sprite = window.CowSprite.make(HERD_COLORS[cow.shepherd % 4], COW_SCALE);
            const at = this.tileCenter(cow.r, cow.c);
            sprite.setPose(at.x, at.y, cow.dir, 0);   // never render at the origin
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
    makePanel(0, "Fixed norm", "2 cows each, every season"),
    makePanel(1, "Adaptive norm", "1 / 2 / 3 / 4 by season")
  ];

  // A hairline between the two runs, so they read as two simulations rather
  // than one tall picture.
  svg.appendChild(el("line", {
    x1: LABEL_X, y1: DIVIDER_Y, x2: PASTURE_X + GRID, y2: DIVIDER_Y,
    stroke: "var(--border)", "stroke-width": 1, opacity: "0.7"
  }));

  // ---- Harvest chart ---------------------------------------------------
  const chartGroup = el("g", { class: "norms-chart" });
  svg.appendChild(chartGroup);

  const bandGroup = el("g", { class: "norms-bands" });
  chartGroup.appendChild(bandGroup);

  const chartTitle = el("text", {
    x: CHART.left, y: CHART.top - 14, "font-size": "11",
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
      x: CHART.left - 6, y: CHART.bottom, "text-anchor": "end",
      "font-size": "9.5", fill: "var(--text-muted)"
    });
    t.textContent = "";
    gridLabels.push(chartGroup.appendChild(t));
  }

  chartGroup.appendChild(el("line", {
    x1: CHART.left, y1: CHART.bottom, x2: CHART.right, y2: CHART.bottom,
    stroke: "var(--text-muted)", "stroke-width": 1, opacity: "0.8"
  }));

  const xZero = el("text", {
    x: CHART.left, y: CHART.bottom + 13, "text-anchor": "middle",
    "font-size": "9.5", fill: "var(--text-muted)"
  });
  xZero.textContent = "0";
  chartGroup.appendChild(xZero);

  const xNow = el("text", {
    x: CHART.left, y: CHART.bottom + 13, "text-anchor": "middle",
    "font-size": "9.5", fill: "var(--text-muted)"
  });
  xNow.textContent = "";
  chartGroup.appendChild(xNow);

  const xLabel = el("text", {
    x: (CHART.left + CHART.right) / 2, y: CHART.bottom + 26, "text-anchor": "middle",
    "font-size": "9.5", fill: "var(--text-muted)"
  });
  xLabel.textContent = "time step";
  chartGroup.appendChild(xLabel);

  const lines = panels.map((panel) =>
    chartGroup.appendChild(el("polyline", {
      points: "", fill: "none", stroke: accents[panel.slot],
      "stroke-width": 2, "stroke-linejoin": "round", "stroke-linecap": "round"
    })));

  // Direct labels riding the end of each line, so identity is never carried
  // by colour alone.
  const endLabels = panels.map((panel) => {
    const t = el("text", {
      x: CHART.left, y: CHART.bottom, "font-size": "10", "font-weight": "600",
      fill: accents[panel.slot], "text-anchor": "start"
    });
    t.textContent = "";
    return chartGroup.appendChild(t);
  });

  let history = [];          // { step, a, b }
  let bands = [];            // { from, to, season }
  let xSpan = 600;           // the sim sets this to its horizon, so the axis
                             // never rescales mid-run

  function niceMax(v) {
    if (v <= 0) return 10;
    const pow = Math.pow(10, Math.floor(Math.log10(v)));
    const n = v / pow;
    const step = n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10;
    return step * pow;
  }

  function drawChart() {
    const lastStep = history.length ? history[history.length - 1].step : 0;
    // Floor the scale so an unplayed chart reads 33/67/100 rather than the
    // 0/7/13/20 a bare `Math.max` produces.
    let top = 90;
    history.forEach((h) => { top = Math.max(top, h.a, h.b); });
    top = niceMax(top * 1.1);

    const px = (step) => CHART.left + (step / xSpan) * (CHART.right - CHART.left);
    const py = (v) => CHART.bottom - (v / top) * (CHART.bottom - CHART.top);

    gridLines.forEach((line, i) => {
      const v = (top * (i + 1)) / 3;
      const y = py(v);
      line.setAttribute("y1", y.toFixed(1));
      line.setAttribute("y2", y.toFixed(1));
      gridLabels[i].setAttribute("y", (y + 3).toFixed(1));
      gridLabels[i].textContent = String(Math.round(v));
    });

    bandGroup.replaceChildren();
    bands.forEach((band) => {
      const x1 = px(band.from), x2 = px(Math.min(band.to, lastStep));
      if (x2 <= x1) return;
      bandGroup.appendChild(el("rect", {
        x: x1.toFixed(1), y: CHART.top, width: (x2 - x1).toFixed(1),
        height: CHART.bottom - CHART.top,
        fill: seasonColor(band.season, bare, full), opacity: "0.30"
      }));
    });

    xNow.textContent = lastStep > 20 ? String(lastStep) : "";
    xNow.setAttribute("x", px(lastStep).toFixed(1));

    ["a", "b"].forEach((key, i) => {
      lines[i].setAttribute("points",
        history.map((h) => `${px(h.step).toFixed(1)},${py(h[key]).toFixed(1)}`).join(" "));
      const last = history[history.length - 1];
      if (!last) { endLabels[i].textContent = ""; return; }
      endLabels[i].textContent = String(Math.round(last[key]));
      const lx = clamp(px(last.step) + 6, CHART.left, CHART.right - 26);
      let ly = py(last[key]) + 3.5;
      // Nudge the two labels apart when the lines are on top of each other.
      const other = i === 0 ? last.b : last.a;
      if (Math.abs(py(last[key]) - py(other)) < 11) ly += last[key] >= other ? -5 : 7;
      endLabels[i].setAttribute("x", lx.toFixed(1));
      endLabels[i].setAttribute("y", ly.toFixed(1));
    });
  }

  // ---- Painting --------------------------------------------------------
  // Colours all come from the stylesheet, so a theme flip is a repaint rather
  // than a reload.
  function paint() {
    bare = cssVar("--grass-bare") || "#ffffff";
    full = cssVar("--grass-full") || "#15803d";
    accents = ACCENT_VARS.map((v, i) => cssVar(v) || accents[i]);

    chips.forEach((chip, i) => chip.swatch.setAttribute("fill", seasonColor(i, bare, full)));
    panels.forEach((panel, i) => {
      panel.rule.setAttribute("fill", accents[i]);
      lines[i].setAttribute("stroke", accents[i]);
      endLabels[i].setAttribute("fill", accents[i]);
    });
    drawChart();
  }

  new MutationObserver(paint).observe(document.documentElement, {
    attributes: true, attributeFilter: ["data-theme"]
  });
  const darkQuery = window.matchMedia("(prefers-color-scheme: dark)");
  if (darkQuery.addEventListener) darkQuery.addEventListener("change", paint);

  setSeason(0);

  window.normsScene = {
    svg, N, LEVELS, TILE, W, H, panels, SEASONS, HERD_COLORS,
    setSeason,
    setHorizon(n) { xSpan = n; },
    resetChart() { history = []; bands = []; drawChart(); },
    pushSample(step, a, b) { history.push({ step, a, b }); },
    pushBand(from, to, season) { bands.push({ from, to, season }); },
    extendBand(to) { if (bands.length) bands[bands.length - 1].to = to; },
    drawChart,
    paint
  };
})();
