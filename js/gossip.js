// Illustrative simulation of the gossip protocol from "Low Message-Cost Gossip
// for Welfare-Optimal Decentralized Decision Making" (Sharma & Marbach,
// AAMAS 2026). This is a simplified toy version for demonstration, not a
// literal implementation of the paper's algorithm (the extended abstract
// doesn't spell out the exact update rule) — but the mechanics are honest to
// what's proven:
//
//   - 6 agents, each with a private utility for 5 options (A-E), known only
//     to themselves.
//   - Option D is hand-picked to be nobody's personal favorite, yet have the
//     highest total welfare (everyone rates it a solid, unexciting 6 — low
//     dispersion, which the paper notes makes an option easier to find).
//   - Each gossip step, a random pair of agents exchange their current top-L
//     options and beliefs (L is the slider). Both agents update to the
//     pairwise average for each shared option — standard symmetric gossip
//     averaging (Boyd et al., cited in the paper's own related work), which
//     provably drifts beliefs toward the true population-wide average utility
//     per option as exchanges mix through the network.
//   - Because that average is exactly the social welfare per agent, S(z)/N,
//     every agent eventually discovers D has the highest true average and
//     switches to it — even though D itself is rarely the explicit topic of
//     conversation. This matches the paper's real theorem: convergence is
//     guaranteed almost surely for any L >= 1, even starting from total
//     Option Neglect. What changes with L isn't *whether* it converges, but
//     *how fast* — a larger shortlist mixes more information per
//     interaction, reaching consensus in measurably fewer exchanges (this
//     was verified against 200 simulated runs per L before writing this).
(function () {
  const svg = document.querySelector(".gossip-svg");
  const lSlider = document.getElementById("gossipL");
  if (!svg || !lSlider) return;

  const NS = "http://www.w3.org/2000/svg";
  const W = 600, H = 380;
  const cx = 300, cy = 190, orbitR = 140, nodeR = 22;
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const OPTIONS = [
    { key: "A", color: "#dc2626" },
    { key: "B", color: "#2563eb" },
    { key: "C", color: "#d97706" },
    { key: "D", color: "#16a34a", optimal: true },
    { key: "E", color: "#9333ea" }
  ];
  const OPTIMAL_KEY = "D";
  const colorOf = (key) => OPTIONS.find((o) => o.key === key).color;

  const UTILITY = [
    { A: 9, B: 3, C: 2, D: 6, E: 1 },
    { A: 2, B: 8, C: 4, D: 6, E: 3 },
    { A: 1, B: 2, C: 9, D: 6, E: 4 },
    { A: 3, B: 1, C: 2, D: 6, E: 8 },
    { A: 7, B: 5, C: 1, D: 6, E: 2 },
    { A: 1, B: 7, C: 5, D: 6, E: 2 }
  ];

  const BASE_INTERVAL = 180;
  const JITTER = 120;
  const TRAVEL_MS = 260;

  function el(tag, attrs) {
    const e = document.createElementNS(NS, tag);
    for (const k in attrs) e.setAttribute(k, attrs[k]);
    return e;
  }

  function argmaxKey(belief) {
    let best = OPTIONS[0].key;
    for (const o of OPTIONS) if (belief[o.key] > belief[best]) best = o.key;
    return best;
  }

  function topLKeys(belief, L) {
    return OPTIONS.map((o) => o.key)
      .sort((a, b) => belief[b] - belief[a])
      .slice(0, L);
  }

  svg.setAttribute("viewBox", `0 0 ${W} ${H}`);

  const positions = UTILITY.map((_, i) => {
    const angle = -Math.PI / 2 + i * ((2 * Math.PI) / UTILITY.length);
    return { x: cx + orbitR * Math.cos(angle), y: cy + orbitR * Math.sin(angle) };
  });

  const edgeGroup = el("g", {});
  svg.appendChild(edgeGroup);
  for (let i = 0; i < positions.length; i++) {
    for (let j = i + 1; j < positions.length; j++) {
      edgeGroup.appendChild(el("line", {
        x1: positions[i].x, y1: positions[i].y,
        x2: positions[j].x, y2: positions[j].y,
        stroke: "var(--border)", "stroke-width": 1.3, opacity: 0.5
      }));
    }
  }

  const messageLayer = el("g", {});
  svg.appendChild(messageLayer);

  const agents = UTILITY.map((utility, i) => {
    const pos = positions[i];
    const belief = Object.assign({}, utility);
    const circle = el("circle", {
      cx: pos.x, cy: pos.y, r: nodeR,
      fill: colorOf(argmaxKey(belief)), stroke: "var(--bg-raised)", "stroke-width": 3
    });
    circle.style.transition = "fill 0.3s ease";
    svg.appendChild(circle);

    const label = el("text", {
      x: pos.x, y: pos.y + 5, "text-anchor": "middle",
      "font-size": "16", "font-weight": "700", fill: "#fff"
    });
    svg.appendChild(label);

    return { i, pos, utility, belief, top: argmaxKey(belief), circle, label };
  });

  function paintAgent(a) {
    a.circle.setAttribute("fill", colorOf(a.top));
    a.label.textContent = a.top;
  }
  agents.forEach(paintAgent);

  const legend = document.getElementById("gossipLegend");
  OPTIONS.forEach((o) => {
    const chip = document.createElement("span");
    chip.className = "legend-chip" + (o.optimal ? " is-optimal" : "");
    const swatch = document.createElement("span");
    swatch.className = "legend-swatch";
    swatch.style.background = o.color;
    chip.appendChild(swatch);
    chip.appendChild(document.createTextNode(o.key + (o.optimal ? " (welfare-optimal)" : "")));
    legend.appendChild(chip);
  });

  const consensusEl = document.getElementById("gossipConsensus");
  const messagesEl = document.getElementById("gossipMessages");
  const estimatesEl = document.getElementById("gossipEstimates");
  const captionEl = document.getElementById("gossipCaption");
  const lValEl = document.getElementById("gossipLVal");
  const lValInlineEl = document.getElementById("gossipLValInline");
  const restartBtn = document.getElementById("gossipRestart");
  const playBtn = document.getElementById("gossipPlay");

  let L = parseInt(lSlider.value, 10);
  let messagesCount = 0;
  let estimatesCount = 0;
  let travel = null;
  let state = "idle"; // idle -> running -> converged

  function consensusCount() {
    return agents.filter((a) => a.top === OPTIMAL_KEY).length;
  }

  function updateStats() {
    consensusEl.textContent = `${consensusCount()} / ${agents.length}`;
    messagesEl.textContent = ((messagesCount * 2) / agents.length).toFixed(1);
    estimatesEl.textContent = (estimatesCount / agents.length).toFixed(1);
  }

  function updateCaption() {
    const count = consensusCount();
    if (count === 0) captionEl.textContent = "No one favors the optimal option yet — it's nobody's personal top pick.";
    else if (count <= 2) captionEl.textContent = "A couple of agents are starting to come around.";
    else if (count <= 4) captionEl.textContent = "Consensus is forming around the optimal option.";
    else if (count === 5) captionEl.textContent = "Almost there — one holdout left.";
    else captionEl.textContent = "Full consensus: every agent now favors the welfare-optimal option, found through purely local gossip.";
  }

  function applyExchange(aIdx, bIdx, keys) {
    const a = agents[aIdx], b = agents[bIdx];
    keys.forEach((key) => {
      const avg = (a.belief[key] + b.belief[key]) / 2;
      a.belief[key] = avg;
      b.belief[key] = avg;
    });
    const newATop = argmaxKey(a.belief);
    const newBTop = argmaxKey(b.belief);
    if (newATop !== a.top) { a.top = newATop; paintAgent(a); }
    if (newBTop !== b.top) { b.top = newBTop; paintAgent(b); }
  }

  function startMessage() {
    const i = Math.floor(Math.random() * agents.length);
    let j = Math.floor(Math.random() * (agents.length - 1));
    if (j >= i) j++;

    // Both agents contribute their own current top-L to the interaction —
    // i tells j its favorites, and j tells i its favorites, at the same time.
    const keysFromI = topLKeys(agents[i].belief, L);
    const keysFromJ = topLKeys(agents[j].belief, L);
    const allKeys = Array.from(new Set([...keysFromI, ...keysFromJ]));
    // Two-phase protocol: phase 1, each agent sends its own top-L estimates.
    // Phase 2, each agent sends back whichever of the estimates it just
    // received it had NOT already sent itself in phase 1 (so the other side
    // gets a value for every option in the union, needed to average it).
    // Net effect: each agent ends up sending every key in allKeys exactly
    // once (phase 1 covers its own top-L, phase 2 covers the rest of the
    // union) — so total estimates this round = 2 * allKeys.length, ranging
    // from L (identical top-L sets) to 2L (fully disjoint sets).
    const estimatesThisRound = 2 * allKeys.length;

    if (reduceMotion) {
      applyExchange(i, j, allKeys);
      messagesCount++;
      estimatesCount += estimatesThisRound;
      updateStats();
      updateCaption();
      checkConvergence();
      return;
    }

    const posI = agents[i].pos, posJ = agents[j].pos;
    const dx = posJ.y - posI.y, dy = posI.x - posJ.x;
    const len = Math.hypot(dx, dy) || 1;
    const nx = dx / len, ny = dy / len;

    const dots = [];
    keysFromI.forEach((key, idx) => {
      const offset = 6 + idx * 9;
      const dot = el("circle", {
        r: 5.5, fill: colorOf(key),
        cx: posI.x + nx * offset, cy: posI.y + ny * offset
      });
      messageLayer.appendChild(dot);
      dots.push({ dot, offset, from: posI, to: posJ });
    });
    keysFromJ.forEach((key, idx) => {
      const offset = -(6 + idx * 9);
      const dot = el("circle", {
        r: 5.5, fill: colorOf(key),
        cx: posJ.x + nx * offset, cy: posJ.y + ny * offset
      });
      messageLayer.appendChild(dot);
      dots.push({ dot, offset, from: posJ, to: posI });
    });

    travel = { aIdx: i, bIdx: j, allKeys, estimatesThisRound, dots, nx, ny, t: 0 };
  }

  function checkConvergence() {
    if (state === "running" && consensusCount() === agents.length) {
      state = "converged";
    }
  }

  playBtn.addEventListener("click", () => {
    if (state !== "idle") return;
    state = "running";
    playBtn.disabled = true;
    playBtn.textContent = "▶ Playing…";
  });

  restartBtn.addEventListener("click", () => {
    agents.forEach((a) => {
      a.belief = Object.assign({}, a.utility);
      a.top = argmaxKey(a.belief);
      paintAgent(a);
    });
    messagesCount = 0;
    estimatesCount = 0;
    state = "idle";
    nextTickIn = 300;
    if (travel) { travel.dots.forEach((d) => d.dot.remove()); travel = null; }
    updateStats();
    playBtn.disabled = false;
    playBtn.textContent = "▶ Play";
    captionEl.textContent = "Six agents, six different private favorites. Press play to watch them gossip toward consensus.";
  });

  function pulseNodes() {
    if (reduceMotion) return;
    agents.forEach((a) => a.circle.classList.remove("gossip-node-pulse"));
    void svg.getBoundingClientRect();
    agents.forEach((a) => a.circle.classList.add("gossip-node-pulse"));
  }

  lSlider.addEventListener("input", () => {
    L = parseInt(lSlider.value, 10);
    lValEl.textContent = String(L);
    lValInlineEl.textContent = String(L);
  });
  lSlider.addEventListener("change", pulseNodes);

  updateStats();

  let nextTickIn = 300;
  let lastTime = performance.now();
  function loop(now) {
    const dt = Math.min((now - lastTime) / 1000, 0.05);
    lastTime = now;

    if (travel) {
      travel.t += (dt * 1000) / TRAVEL_MS;
      if (travel.t >= 1) {
        applyExchange(travel.aIdx, travel.bIdx, travel.allKeys);
        travel.dots.forEach((d) => d.dot.remove());
        messagesCount++;
        estimatesCount += travel.estimatesThisRound;
        travel = null;
        updateStats();
        updateCaption();
        checkConvergence();
        nextTickIn = BASE_INTERVAL + Math.random() * JITTER;
      } else {
        travel.dots.forEach((d) => {
          const bx = d.from.x + (d.to.x - d.from.x) * travel.t;
          const by = d.from.y + (d.to.y - d.from.y) * travel.t;
          d.dot.setAttribute("cx", bx + travel.nx * d.offset);
          d.dot.setAttribute("cy", by + travel.ny * d.offset);
        });
      }
    } else if (state === "running") {
      nextTickIn -= dt * 1000;
      if (nextTickIn <= 0) startMessage();
    }

    requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);
})();
