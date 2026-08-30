// Project 01 scene — shepherds from many pastures, mingling.
//
// Twenty shepherds drift around a box, bouncing off the walls like a
// screensaver, with no collisions between them. Each one is coloured by the
// herd size it currently believes is right, so the mix of colours in the box
// is the state of opinion across the whole population.
//
// Drawing only: the utilities and, later, the gossip protocol live in
// js/shepherds-sim.js and drive this through window.shepherdScene.
(function () {
  const svg = document.querySelector(".shepherds-svg");
  if (!svg || !window.ShepherdSprite) return;

  const NS = "http://www.w3.org/2000/svg";
  const W = 480, H = 280;
  const AGENTS = 20;
  const SCALE = 0.62;
  const SPEED = 24;            // units per second
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  // Room to keep a whole figure inside the wall it just bounced off.
  const E = window.ShepherdSprite.EXTENT;
  const PAD = {
    left: -E.left * SCALE + 4,
    right: E.right * SCALE + 4,
    top: -E.top * SCALE + 4,
    bottom: E.bottom * SCALE + 4
  };

  function el(tag, attrs) {
    const e = document.createElementNS(NS, tag);
    for (const k in attrs) e.setAttribute(k, attrs[k]);
    return e;
  }

  svg.setAttribute("viewBox", `0 0 ${W} ${H}`);
  Array.from(svg.children).forEach((child) => {
    if (child.nodeName !== "title" && child.nodeName !== "desc") child.remove();
  });

  // ---- The box ---------------------------------------------------------
  svg.appendChild(el("rect", {
    x: 1, y: 1, width: W - 2, height: H - 2, rx: 10,
    fill: "var(--bg-alt)", stroke: "var(--border)", "stroke-width": 2
  }));

  // ---- The shepherds ---------------------------------------------------
  const linkLayer = el("g", { class: "shepherds-links" });
  svg.appendChild(linkLayer);

  const group = el("g", { class: "shepherds-crowd" });
  svg.appendChild(group);

  // A direction well away from the axes, so nobody tracks along a wall.
  function randomizePosition(agent) {
    const quadrant = Math.floor(Math.random() * 4);
    const angle = (quadrant * Math.PI) / 2 + 0.35 + Math.random() * (Math.PI / 2 - 0.7);
    agent.x = PAD.left + Math.random() * (W - PAD.left - PAD.right);
    agent.y = PAD.top + Math.random() * (H - PAD.top - PAD.bottom);
    agent.vx = Math.cos(angle) * SPEED;
    agent.vy = Math.sin(angle) * SPEED;
    agent.dir = Math.cos(angle) >= 0 ? 1 : -1;
  }

  const agents = [];
  for (let i = 0; i < AGENTS; i++) {
    const node = window.ShepherdSprite.make("#6366f1", "shepherds-figure");
    group.appendChild(node);
    const agent = { node, x: 0, y: 0, vx: 0, vy: 0, dir: 1 };
    randomizePosition(agent);
    agents.push(agent);
  }

  function place(agent) {
    agent.node.setAttribute(
      "transform",
      `translate(${agent.x.toFixed(2)} ${agent.y.toFixed(2)}) scale(${agent.dir * SCALE} ${SCALE})`
    );
  }

  agents.forEach(place);

  // Scatters everyone to a fresh random spot, for a restart to jumble.
  function scatter() {
    agents.forEach((agent) => {
      randomizePosition(agent);
      place(agent);
    });
  }

  // ---- Bounce ----------------------------------------------------------
  // Constant speed, reflect off the four walls, no agent-to-agent collisions.
  function step(dt) {
    agents.forEach((agent) => {
      agent.x += agent.vx * dt;
      agent.y += agent.vy * dt;

      if (agent.x < PAD.left) { agent.x = PAD.left; agent.vx = -agent.vx; }
      else if (agent.x > W - PAD.right) { agent.x = W - PAD.right; agent.vx = -agent.vx; }

      if (agent.y < PAD.top) { agent.y = PAD.top; agent.vy = -agent.vy; }
      else if (agent.y > H - PAD.bottom) { agent.y = H - PAD.bottom; agent.vy = -agent.vy; }

      agent.dir = agent.vx >= 0 ? 1 : -1;   // face the way they are walking
      place(agent);
    });
  }

  // ---- Meeting lines ---------------------------------------------------
  // A line drawn while two shepherds are talking. Both keep walking, so it
  // tracks them for its lifetime rather than being drawn once and left behind.
  const links = [];

  // Position a link and its halos on the pair as they are right now. Called on
  // creation as well as every frame: an un-positioned circle defaults to the
  // origin, which would flash in the corner for a frame before its first move.
  function placeLink(link) {
    const fade = (1 - link.age / link.life).toFixed(3);
    link.node.setAttribute("x1", link.a.x.toFixed(2));
    link.node.setAttribute("y1", link.a.y.toFixed(2));
    link.node.setAttribute("x2", link.b.x.toFixed(2));
    link.node.setAttribute("y2", link.b.y.toFixed(2));
    link.node.setAttribute("opacity", fade);
    [link.a, link.b].forEach((agent, n) => {
      link.rings[n].setAttribute("cx", agent.x.toFixed(2));
      link.rings[n].setAttribute("cy", agent.y.toFixed(2));
      link.rings[n].setAttribute("opacity", fade);
    });
  }

  function flashLink(i, j, seconds) {
    const ring = () => el("circle", { class: "shepherds-ring", r: 15 });
    const link = {
      a: agents[i], b: agents[j],
      life: seconds || 0.8, age: 0,
      node: el("line", { class: "shepherds-link", "stroke-linecap": "round" }),
      rings: [ring(), ring()]                 // a halo round each of the pair
    };
    placeLink(link);
    linkLayer.appendChild(link.node);
    link.rings.forEach((r) => linkLayer.appendChild(r));
    links.push(link);
  }

  function updateLinks(dt) {
    for (let i = links.length - 1; i >= 0; i--) {
      const link = links[i];
      link.age += dt;
      if (link.age >= link.life) {
        link.node.remove();
        link.rings.forEach((r) => r.remove());
        links.splice(i, 1);
        continue;
      }
      placeLink(link);
    }
  }

  // ---- Loop ------------------------------------------------------------
  // Anything that needs the clock registers here, so movement, meeting lines
  // and the protocol all advance off the same frame.
  const tickers = [];

  // One frame of everything. Split out from the rAF callback so the scene can
  // also be driven by hand from the console or a test.
  function advance(dt) {
    if (!reduceMotion) step(dt);
    updateLinks(dt);
    tickers.forEach((fn) => fn(dt));
  }

  let playing = false;         // waits for the reader, like the pasture does
  let speed = 1;               // fast-forward multiplier

  let lastTime = performance.now();
  function frame(now) {
    const dt = Math.min((now - lastTime) / 1000, 0.05);
    lastTime = now;
    if (playing) advance(dt * speed);
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);

  // ---- Tally chart -----------------------------------------------------
  // One bar per herd size, on a fixed 0-AGENTS scale so the bars stay
  // comparable as opinion moves rather than rescaling under their own feet.
  const chart = document.querySelector(".shepherds-chart");
  const OPTIONS = [1, 2, 3, 4];
  const CW = 480, CH = 156;
  const PLOT_TOP = 26, BASE_Y = 120;      // baseline of the bars
  const BAR_W = 52, BAR_GAP = 32;
  const GROUP_W = OPTIONS.length * BAR_W + (OPTIONS.length - 1) * BAR_GAP;
  const GROUP_X = (CW - GROUP_W) / 2;

  function optionColor(k) {
    return getComputedStyle(document.documentElement).getPropertyValue(`--opt-${k}`).trim();
  }

  function barX(i) { return GROUP_X + i * (BAR_W + BAR_GAP); }

  // Rounded at the data end, square where it meets the baseline.
  function barPath(x, count) {
    const h = (count / AGENTS) * (BASE_Y - PLOT_TOP);
    if (h <= 0) return "";
    const y = BASE_Y - h;
    const r = Math.min(4, h);
    return `M ${x} ${BASE_Y} L ${x} ${y + r} Q ${x} ${y} ${x + r} ${y}` +
           ` L ${x + BAR_W - r} ${y} Q ${x + BAR_W} ${y} ${x + BAR_W} ${y + r}` +
           ` L ${x + BAR_W} ${BASE_Y} Z`;
  }

  const bars = [], barLabels = [];

  if (chart) {
    chart.setAttribute("viewBox", `0 0 ${CW} ${CH}`);
    Array.from(chart.children).forEach((child) => {
      if (child.nodeName !== "title" && child.nodeName !== "desc") child.remove();
    });

    chart.appendChild(el("line", {
      x1: GROUP_X - 18, y1: BASE_Y, x2: GROUP_X + GROUP_W + 18, y2: BASE_Y,
      stroke: "var(--border)", "stroke-width": 1
    }));

    OPTIONS.forEach((k, i) => {
      const bar = el("path", { class: "shepherds-bar", d: "", fill: optionColor(k) });
      chart.appendChild(bar);
      bars.push(bar);

      const count = el("text", {                     // value, in text ink
        x: barX(i) + BAR_W / 2, y: 0, "text-anchor": "middle",
        "font-size": "14", "font-weight": "700", fill: "var(--text)"
      });
      chart.appendChild(count);
      barLabels.push(count);

      const name = el("text", {                      // category, under the bar
        x: barX(i) + BAR_W / 2, y: BASE_Y + 18, "text-anchor": "middle",
        "font-size": "11.5", fill: "var(--text-muted)"
      });
      name.textContent = `${k} ${k === 1 ? "cow" : "cows"}`;
      chart.appendChild(name);

      if (k === 2) {                                 // the welfare optimum
        const note = el("text", {
          x: barX(i) + BAR_W / 2, y: BASE_Y + 33, "text-anchor": "middle",
          // text ink, not the accent: amber is already option 3's bar colour
          "font-size": "10", "font-weight": "600", fill: "var(--text-muted)"
        });
        note.textContent = "welfare-optimal";
        chart.appendChild(note);
      }
    });
  }

  let tally = OPTIONS.map(() => 0);

  function renderTally(counts) {
    if (counts) tally = OPTIONS.map((k) => counts[k] || 0);
    if (!chart) return;
    OPTIONS.forEach((k, i) => {
      const count = tally[i];
      bars[i].setAttribute("d", barPath(barX(i), count));
      bars[i].setAttribute("fill", optionColor(k));
      const h = (count / AGENTS) * (BASE_Y - PLOT_TOP);
      barLabels[i].setAttribute("y", BASE_Y - h - 8);
      barLabels[i].textContent = String(count);
    });
  }

  // ---- API for the simulation ------------------------------------------
  let favourites = [];

  function paint() {
    favourites.forEach((k, i) => agents[i].node.setColor(optionColor(k)));
    renderTally(null);
  }

  // Both the cloaks and the bars are themed, so a theme flip has to repaint.
  new MutationObserver(paint).observe(document.documentElement, {
    attributes: true, attributeFilter: ["data-theme"]
  });
  const darkQuery = window.matchMedia("(prefers-color-scheme: dark)");
  if (darkQuery.addEventListener) darkQuery.addEventListener("change", paint);

  window.shepherdScene = {
    svg, chart, W, H, AGENTS, OPTIONS,
    agents,
    optionColor,
    onTick(fn) { tickers.push(fn); },
    flashLink,
    advance,
    scatter,
    clearLinks() {
      while (links.length) {
        const link = links.pop();
        link.node.remove();
        link.rings.forEach((r) => r.remove());
      }
    },
    get playing() { return playing; },
    setPlaying(on) { playing = on; },
    setSpeed(n) { speed = n; },
    setFavourites(next) {
      favourites = next.slice();
      const counts = {};
      OPTIONS.forEach((k) => { counts[k] = favourites.filter((f) => f === k).length; });
      renderTally(counts);
      paint();
    },
    step
  };
})();
