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
  const N = 6, LEVELS = 6, TILE = 26;
  const GRID = N * TILE;                    // 156
  const W = 720, H = 512;
  const PANEL_W = 220;
  const PANEL_X = [10, 250, 490];           // panel left edges
  const PANEL_TOP = 8;
  const GRID_Y = PANEL_TOP + 58;            // room above for title/subtitle/shepherds
  const COW_SCALE = 0.32;
  const SHEPHERD_SCALE = 0.36;
  const CHART = { left: 46, right: 690, top: 372, bottom: 452 };

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
      x: x0 + PANEL_W / 2, y: PANEL_TOP + 12, "text-anchor": "middle",
      "font-size": "12.5", "font-weight": "600", fill: "var(--text)"
    });
    head.textContent = title;
    g.appendChild(head);

    const rule = el("rect", {
      x: x0 + PANEL_W / 2 - 20, y: PANEL_TOP + 18, width: 40, height: 2, rx: 1,
      fill: accents[slot]
    });
    g.appendChild(rule);

    const sub = el("text", {
      x: x0 + PANEL_W / 2, y: PANEL_TOP + 32, "text-anchor": "middle",
      "font-size": "9.5", fill: "var(--text-muted)"
    });
    sub.textContent = subtitle;
    g.appendChild(sub);

    // Four shepherds in a compact row above the grid.
    const shepherdY = GRID_Y - 16;
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
    const statsY = GRID_Y + GRID + 18;
    const stats = STAT_KEYS.map((key, i) => {
      const cx = x0 + PANEL_W * (i + 0.5) / 3;
      const value = el("text", {
        x: cx, y: statsY, "text-anchor": "middle", "font-size": "12.5",
        "font-weight": "600", fill: "var(--text)"
      });
      value.textContent = "–";
      const label = el("text", {
        x: cx, y: statsY + 13, "text-anchor": "middle", "font-size": "9",
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

  // ---- Harvest chart -------------------------------------------------------
  const chartGroup = el("g", { class: "dynamics-chart" });
  svg.appendChild(chartGroup);

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

  const endLabels = panels.map((panel) => {
    const t = el("text", {
      x: CHART.left, y: CHART.bottom, "font-size": "10", "font-weight": "600",
      fill: accents[panel.slot], "text-anchor": "start"
    });
    t.textContent = "";
    return chartGroup.appendChild(t);
  });

  let history = [];   // { step, values: [a, b, c] }
  let xSpan = 600;

  function niceMax(v) {
    if (v <= 0) return 10;
    const pow = Math.pow(10, Math.floor(Math.log10(v)));
    const n = v / pow;
    const step = n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10;
    return step * pow;
  }

  function drawChart() {
    const lastStep = history.length ? history[history.length - 1].step : 0;
    let top = 90;
    history.forEach((h) => { h.values.forEach((v) => { top = Math.max(top, v); }); });
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

    xNow.textContent = lastStep > 20 ? String(lastStep) : "";
    xNow.setAttribute("x", px(lastStep).toFixed(1));

    const placedY = [];
    panels.forEach((panel, i) => {
      lines[i].setAttribute("points",
        history.map((h) => `${px(h.step).toFixed(1)},${py(h.values[i]).toFixed(1)}`).join(" "));
      const last = history[history.length - 1];
      if (!last) { endLabels[i].textContent = ""; return; }
      endLabels[i].textContent = String(Math.round(last.values[i]));
      const lx = clamp(px(last.step) + 6, CHART.left, CHART.right - 26);
      let ly = py(last.values[i]) + 3.5;
      // Nudge labels apart when two or more lines end up close together.
      while (placedY.some((y) => Math.abs(y - ly) < 11)) ly += 11;
      placedY.push(ly);
      endLabels[i].setAttribute("x", lx.toFixed(1));
      endLabels[i].setAttribute("y", ly.toFixed(1));
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
    setHorizon(n) { xSpan = n; },
    resetChart() { history = []; drawChart(); },
    pushSample(step, values) { history.push({ step, values }); },
    drawChart,
    paint
  };
})();
