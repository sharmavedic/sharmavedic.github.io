// Project 02, experimental — three small looping diagrams illustrating how an
// opinion leader emerges from personal-utility-only agents, and how it then
// carries the welfare-optimal norm back out to the group. Each step is a
// self-contained, autoplaying loop (no controls, like a GIF), independent of
// the other two. Agents are small ShepherdSprite figures (js/shepherd-sprite.js)
// — the same cast used elsewhere on the page. Step 3's travelling flow stays
// a plain dot, so it reads as a signal moving between agents rather than
// another agent.
(function () {
  const NS = "http://www.w3.org/2000/svg";
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const LEADER_COLOR = "#ef4444";

  function el(tag, attrs) {
    const e = document.createElementNS(NS, tag);
    for (const k in attrs) e.setAttribute(k, attrs[k]);
    return e;
  }

  function token(name) {
    return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  }
  function mutedColor() { return token("--text-muted"); }

  function hexToRgb(hex) {
    const h = hex.trim().replace("#", "");
    const full = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
    const num = parseInt(full, 16);
    return [(num >> 16) & 255, (num >> 8) & 255, num & 255];
  }
  // Accepts either "#rrggbb" or "rgb(r, g, b)" (custom properties are stored
  // as whichever form was written in the CSS).
  function toRgbTriplet(color) {
    if (color.startsWith("#")) return hexToRgb(color);
    const m = color.match(/[\d.]+/g);
    return m ? m.slice(0, 3).map(Number) : [0, 0, 0];
  }
  function lerpColor(colorA, colorB, t) {
    const a = toRgbTriplet(colorA), b = toRgbTriplet(colorB);
    const r = Math.round(a[0] + (b[0] - a[0]) * t);
    const g = Math.round(a[1] + (b[1] - a[1]) * t);
    const bl = Math.round(a[2] + (b[2] - a[2]) * t);
    return `rgb(${r}, ${g}, ${bl})`;
  }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

  function arrowMarker(id) {
    const marker = el("marker", {
      id, viewBox: "0 0 10 10", refX: "8", refY: "5",
      markerWidth: "6", markerHeight: "6", orient: "auto-start-reverse"
    });
    marker.appendChild(el("path", { d: "M0,0 L10,5 L0,10 Z", fill: "var(--text-muted)" }));
    return marker;
  }

  // Shared across all three steps: every agent is a small ShepherdSprite
  // (js/shepherd-sprite.js — symmetric, no crook). It draws ~22 wide by 41
  // tall around its own local origin, which sits almost exactly at the
  // middle of its bounding box (top -21, bottom 20) — so translating that
  // origin to (x, y) places the figure the same way a plain circle centred
  // at (x, y) would. `r` below is the *old* circle-radius language every
  // step already used for sizing (BASE_R, growth caps, etc.) — scaleForR
  // keeps all of that math unchanged and just converts the result to a
  // sprite scale.
  const SCALE_PER_R = 0.5 / 7; // an r=7 circle's footprint <-> scale 0.5
  function scaleForR(r) { return r * SCALE_PER_R; }
  function makeAgentSprite(color, className) {
    return window.ShepherdSprite.make(color, className || "leader-agent-sprite");
  }
  function placeAgentSprite(sprite, x, y, r) {
    sprite.setAttribute("transform", `translate(${x.toFixed(2)} ${y.toFixed(2)}) scale(${scaleForR(r).toFixed(3)})`);
  }
  function setAgentColor(sprite, color) {
    sprite.setColor(color);
  }

  // ==================== Help popup ==========================================
  // Purely explanatory (no CONFIG numbers to read back, unlike the other two
  // sections' popups) — just the reward-type write-up plus a close button.
  (function helpPopup() {
    const helpBtn = document.getElementById("leaderStepsHelpBtn");
    const helpDialog = document.getElementById("leaderStepsHelp");
    const helpClose = document.getElementById("leaderStepsHelpClose");
    if (!helpBtn || !helpDialog) return;

    helpBtn.addEventListener("click", () => helpDialog.showModal());
    if (helpClose) helpClose.addEventListener("click", () => helpDialog.close());
    // Clicking the backdrop closes it: the dialog fills its own box, so any
    // click landing on the element itself came from outside the panel.
    helpDialog.addEventListener("click", (event) => {
      if (event.target === helpDialog) helpDialog.close();
    });
  })();

  // ==================== Step 1: everyone maximizes personal utility =======
  // A slim horizontal slice of a much bigger circle (arc bow) drifts past a
  // fixed centre spotlight. Whichever agent occupies that slot turns red and
  // grows briefly, then dims back down as it carries on — the position is
  // special, not any particular agent.
  (function stepOne() {
    const svg = document.querySelector(".leader-step1-svg");
    if (!svg) return;

    const W = 220, H = 140, cx = 110, cy = 66;
    const ARC_R = 260;        // small radius -> a clearly visible dome
    const SPOT_HALF = 34;     // within this many units of centre, colour/size ramp
    const SPAN_HALF = 150;    // half the wrap period; agents range over [-SPAN_HALF, SPAN_HALF)
    const BASE_R = 8.5, SPOT_R = 11;
    const NUM_AGENTS = 5;
    const MOVE_MS = 900;       // accelerate-then-decelerate glide to the next slot
    const PAUSE_MS = 380;      // brief stop once a slot is centred

    svg.setAttribute("viewBox", `0 0 ${W} ${H}`);
    const group = el("g", {});
    svg.appendChild(group);

    // Facing down from the top of a much larger circle: the centre is the
    // apex, and the row sags away (downward) toward either edge.
    function arcY(dx) { return cy + (dx * dx) / (2 * ARC_R); }

    function easeInOutCubic(t) {
      return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
    }

    // Slot spacing must divide the wrap period evenly, so that every slot
    // lands exactly on dx = 0 in turn — otherwise nothing is ever truly
    // centred for the pause to land on.
    const spacing = (2 * SPAN_HALF) / NUM_AGENTS;
    function wrapDx(v) {
      const range = 2 * SPAN_HALF;
      return ((v + SPAN_HALF) % range + range) % range - SPAN_HALF;
    }

    const agents = [];
    for (let i = 0; i < NUM_AGENTS; i++) {
      const sprite = makeAgentSprite(mutedColor(), "leader-agent-sprite");
      group.appendChild(sprite);
      agents.push({ baseDx: i * spacing, sprite });
    }

    let stepsCompleted = 0, phase = "paused", phaseTimer = 0;

    function currentShift() {
      const banked = stepsCompleted * spacing;
      if (phase === "moving") return banked + easeInOutCubic(clamp(phaseTimer / MOVE_MS, 0, 1)) * spacing;
      return banked;
    }

    function render() {
      const muted = mutedColor();
      const shift = currentShift();
      agents.forEach((a) => {
        const dx = wrapDx(a.baseDx + shift);
        const closeness = clamp(1 - Math.abs(dx) / SPOT_HALF, 0, 1);
        const fade = clamp(1 - (Math.abs(dx) - (SPAN_HALF - 22)) / 22, 0, 1);
        placeAgentSprite(a.sprite, cx + dx, arcY(dx), lerp(BASE_R, SPOT_R, closeness));
        setAgentColor(a.sprite, lerpColor(muted, LEADER_COLOR, closeness));
        a.sprite.setAttribute("opacity", fade.toFixed(2));
      });
    }

    if (reduceMotion) {
      render();   // stepsCompleted = 0, paused -> shift = 0, so one slot already sits at dx = 0
      return;
    }

    let last = performance.now();
    function loop(now) {
      const dt = now - last;
      last = now;
      phaseTimer += dt;
      if (phase === "paused") {
        if (phaseTimer >= PAUSE_MS) { phase = "moving"; phaseTimer = 0; }
      } else if (phaseTimer >= MOVE_MS) {
        stepsCompleted = (stepsCompleted + 1) % NUM_AGENTS;
        phase = "paused";
        phaseTimer = 0;
      }
      render();
      requestAnimationFrame(loop);
    }
    render();
    requestAnimationFrame(loop);
  })();

  // ==================== Step 2: identifying the leader =====================
  // Agents sit on a circle. One at a time, in random order, the others point
  // an arrow at a randomly chosen target, which slides toward the centre as
  // more arrows arrive. Once everyone points to it, hold, reset, repeat with
  // a fresh random target.
  (function stepTwo() {
    const svg = document.querySelector(".leader-step2-svg");
    if (!svg) return;

    const W = 220, H = 220, cx = 110, cy = 110, R = 82;
    const N = 8;
    const BASE_R = 8.5, LEADER_MAX_R = 13.5;
    const STAGGER_MS = 420;
    const HOLD_MS = 1200;
    const RESET_PAUSE_MS = 500;

    svg.setAttribute("viewBox", `0 0 ${W} ${H}`);
    const defs = el("defs", {});
    const markerId = "leaderArrowStep2";
    defs.appendChild(arrowMarker(markerId));
    svg.appendChild(defs);

    const arrowLayer = el("g", {});
    svg.appendChild(arrowLayer);

    const home = [], homeAngle = [];
    for (let i = 0; i < N; i++) {
      const angle = -Math.PI / 2 + i * ((2 * Math.PI) / N);
      homeAngle.push(angle);
      home.push({ x: cx + R * Math.cos(angle), y: cy + R * Math.sin(angle) });
    }
    function posAt(angle) { return { x: cx + R * Math.cos(angle), y: cy + R * Math.sin(angle) }; }

    // Pulls the arrowhead end back off the target's centre by `gap` units,
    // so it stops short of the sprite instead of running into it.
    const ARROW_GAP_MARGIN = 5;
    function pullBackEndpoint(from, to, gap) {
      const dx = to.x - from.x, dy = to.y - from.y;
      const len = Math.hypot(dx, dy) || 1;
      const t = Math.max(0, (len - gap) / len);
      return { x: from.x + dx * t, y: from.y + dy * t };
    }

    const nodes = home.map((p) => {
      const sprite = makeAgentSprite("var(--text-muted)", "leader-agent-sprite");
      placeAgentSprite(sprite, p.x, p.y, BASE_R);
      svg.appendChild(sprite);
      return sprite;
    });
    // Live position of every agent (including the moving target and the
    // redistributing others), so arrows can always find their source.
    const currentPos = home.map((p) => ({ x: p.x, y: p.y }));

    // Reveal is driven by a single continuous clock (phaseTimer over
    // REVEAL_DURATION), not by how many arrows have appeared — every
    // position/size/colour update reads that clock every frame, so nothing
    // snaps between arrow arrivals. `revealed` only tracks how many arrows
    // have been *created* so far, staggered off the same clock.
    const REVEAL_DURATION = STAGGER_MS * (N - 1);
    let targetIndex = 0, order = [], redistribute = [], revealed = 0;
    let lines = [];
    let phase = "revealing", phaseTimer = 0;

    function shuffledOthers(target) {
      const others = [];
      for (let i = 0; i < N; i++) if (i !== target) others.push(i);
      for (let i = others.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [others[i], others[j]] = [others[j], others[i]];
      }
      return others;
    }

    // Shortest signed angular distance from `from` to `to`, wrapped into
    // (-PI, PI]. homeAngle[] and the freshly-computed target angles are each
    // raw (unwrapped) radian values, so e.g. -90deg and 282deg can refer to
    // positions only 12deg apart but differ by ~372deg numerically — lerping
    // those directly sends the agent almost all the way around the circle
    // instead of the short way. Every agent's motion is (final angle - initial
    // angle) * alpha + initial angle, with that difference taken the short way.
    function angleDelta(from, to) {
      const twoPi = 2 * Math.PI;
      return ((to - from + Math.PI) % twoPi + twoPi) % twoPi - Math.PI;
    }

    // The other N-1 agents close the gap the target leaves behind, sliding
    // into a freshly evenly-spaced circle of their own (kept in their
    // existing rotational order, so nobody has to cross another agent). The
    // gap is centred exactly on the target's original angle, so the nearest
    // agent on each side ends up at +-step/2 from it — equidistant.
    function computeRedistribution(target) {
      const others = [];
      for (let i = 1; i < N; i++) others.push((target + i) % N);
      const step = (2 * Math.PI) / (N - 1);
      const startAngle = homeAngle[target] + step / 2;
      return others.map((idx, j) => {
        const fromAngle = homeAngle[idx];
        const toAngle = startAngle + j * step;
        return { idx, fromAngle, delta: angleDelta(fromAngle, toAngle) };
      });
    }

    function currentFrac() {
      if (phase === "holding" || phase === "resetting") return 1;
      return clamp(phaseTimer / REVEAL_DURATION, 0, 1);
    }

    function targetPos() {
      const frac = currentFrac();
      return { x: lerp(home[targetIndex].x, cx, frac), y: lerp(home[targetIndex].y, cy, frac) };
    }

    function updateTargetVisual() {
      const frac = currentFrac();
      const targetR = lerp(BASE_R, LEADER_MAX_R, frac);

      const pos = targetPos();
      currentPos[targetIndex] = pos;
      placeAgentSprite(nodes[targetIndex], pos.x, pos.y, targetR);
      setAgentColor(nodes[targetIndex], lerpColor(mutedColor(), LEADER_COLOR, frac));

      redistribute.forEach((r) => {
        const p = posAt(r.fromAngle + r.delta * frac);
        currentPos[r.idx] = p;
        placeAgentSprite(nodes[r.idx], p.x, p.y, BASE_R);
      });

      lines.forEach((l) => {
        const src = currentPos[l.agentIdx];
        const end = pullBackEndpoint(src, pos, targetR + ARROW_GAP_MARGIN);
        l.el.setAttribute("x1", src.x.toFixed(2));
        l.el.setAttribute("y1", src.y.toFixed(2));
        l.el.setAttribute("x2", end.x.toFixed(2));
        l.el.setAttribute("y2", end.y.toFixed(2));
      });
    }

    function resetVisual() {
      for (let i = 0; i < N; i++) {
        currentPos[i] = { x: home[i].x, y: home[i].y };
        placeAgentSprite(nodes[i], home[i].x, home[i].y, BASE_R);
      }
      setAgentColor(nodes[targetIndex], "var(--text-muted)");
      lines.forEach((l) => l.el.remove());
      lines = [];
    }

    // Only creates the arrow element at the source's *current* (already
    // continuously-interpolated) position — it does not itself move anything.
    function addArrow(agentIdx) {
      const src = currentPos[agentIdx];
      const pos = targetPos();
      const targetR = lerp(BASE_R, LEADER_MAX_R, currentFrac());
      const end = pullBackEndpoint(src, pos, targetR + ARROW_GAP_MARGIN);
      const line = el("line", {
        x1: src.x.toFixed(2), y1: src.y.toFixed(2),
        x2: end.x.toFixed(2), y2: end.y.toFixed(2),
        stroke: "var(--text-muted)", "stroke-width": 1.6,
        "marker-end": `url(#${markerId})`
      });
      arrowLayer.appendChild(line);
      lines.push({ el: line, agentIdx });
    }

    function startLoop() {
      targetIndex = Math.floor(Math.random() * N);
      order = shuffledOthers(targetIndex);
      redistribute = computeRedistribution(targetIndex);
      revealed = 0;
      phase = "revealing";
      phaseTimer = 0;
      updateTargetVisual();
    }

    if (reduceMotion) {
      targetIndex = 0;
      order = shuffledOthers(targetIndex);
      redistribute = computeRedistribution(targetIndex);
      phase = "holding";
      updateTargetVisual();
      order.forEach((idx) => {
        const src = currentPos[idx];
        const end = pullBackEndpoint(src, { x: cx, y: cy }, LEADER_MAX_R + ARROW_GAP_MARGIN);
        const line = el("line", {
          x1: src.x, y1: src.y, x2: end.x, y2: end.y,
          stroke: "var(--text-muted)", "stroke-width": 1.6, "marker-end": `url(#${markerId})`
        });
        arrowLayer.appendChild(line);
      });
      return;
    }

    startLoop();
    let last = performance.now();
    function loop(now) {
      const dt = now - last;
      last = now;
      if (phase === "revealing") {
        phaseTimer += dt;
        const wantRevealed = Math.min(N - 1, Math.floor(phaseTimer / STAGGER_MS));
        while (revealed < wantRevealed) {
          revealed++;
          addArrow(order[revealed - 1]);
        }
        updateTargetVisual();
        if (phaseTimer >= REVEAL_DURATION) {
          phaseTimer = 0;
          phase = "holding";
        }
      } else if (phase === "holding") {
        phaseTimer += dt;
        if (phaseTimer >= HOLD_MS) {
          resetVisual();
          phase = "resetting";
          phaseTimer = 0;
        }
      } else if (phase === "resetting") {
        phaseTimer += dt;
        if (phaseTimer >= RESET_PAUSE_MS) startLoop();
      }
      requestAnimationFrame(loop);
    }
    requestAnimationFrame(loop);
  })();

  // ==================== Step 3: the leader adopts the norm =================
  // Starts already converged (leader at centre, full circle, plain line
  // segments to every follower — no arrowheads, direction is carried by the
  // travelling dot, not the line). Each follower's round trip is independent:
  // the leader's dot leaves for it on its own staggered delay, and the
  // instant that dot arrives, the follower fires its own dot straight back —
  // it never waits on any other follower. A cycle ends once every follower's
  // round trip has landed back at the leader; the leader and each follower
  // grow a little on every arrival they receive. After MAX_CYCLES cycles the
  // animation holds, then resets with a fresh cycle count.
  (function stepThree() {
    const svg = document.querySelector(".leader-step3-svg");
    if (!svg) return;

    const W = 220, H = 220, cx = 110, cy = 110, R = 82;
    const N = 8;
    const BASE_LEADER_R = 12, GROWTH = 4, MAX_CYCLES = 3;
    const AGENT_R = 7, AGENT_GROWTH = 2;
    const DOT_TRAVEL_MS = 650;
    const OUTBOUND_STAGGER_MS = 560; // spreads the leader's outgoing dots so they fan out visibly
    const FOLLOWER_PAUSE_MS = 140;   // brief beat at the follower before it sends its dot back
    const HOLD_MS = 900;
    const RESET_PAUSE_MS = 500;
    const GROW_EASE_MS = 260;        // time constant for easing a radius up to its target

    svg.setAttribute("viewBox", `0 0 ${W} ${H}`);
    const lineLayer = el("g", {});
    const dotLayer = el("g", {});
    const agentLayer = el("g", {});
    // Paint order: lines, then the travelling flow dots, then the agents and
    // leader on top — so an agent always sits above a dot passing behind it.
    svg.appendChild(lineLayer);
    svg.appendChild(dotLayer);
    svg.appendChild(agentLayer);

    // N total agents = 1 leader (already converged at centre) + (N-1) others.
    // The others sit evenly spaced around the full circle — this is the state
    // Step 2 ends in (the group closes ranks once the leader moves to centre),
    // not the raw N-slot ring with the leader's old slot left as a gap.
    const ringCount = N - 1;
    const ring = [];
    for (let i = 0; i < ringCount; i++) {
      const angle = -Math.PI / 2 + i * ((2 * Math.PI) / ringCount);
      ring.push({ x: cx + R * Math.cos(angle), y: cy + R * Math.sin(angle) });
    }

    let leaderNode = null, agentNodes = [], lines = [];
    // Growth accrues per individual arrival, not per completed cycle — each
    // ring agent gets exactly one outbound arrival per cycle (AGENT_GROWTH
    // each), the leader gets ringCount inbound arrivals per cycle (GROWTH
    // split evenly across them), so after MAX_CYCLES cycles both land on the
    // same caps as before.
    //
    // An arrival only moves the *target*; the radius actually drawn eases
    // toward it every frame (see updateGrowth), so a node swells smoothly
    // instead of snapping a whole step wider the instant a dot lands.
    let leaderGrowth = 0;
    let agentGrowth = [];
    let leaderShown = 0;
    let agentShown = [];

    // The line between an agent and the leader never changes once drawn —
    // with no arrowhead, a plain segment doesn't care which end is which, so
    // it doesn't need to flip per phase the way the old arrows did.
    function buildCircle() {
      lines.forEach((l) => l.el.remove());
      lines = [];
      agentNodes.forEach((n) => n.remove());
      agentNodes = [];
      if (leaderNode) leaderNode.remove();

      leaderGrowth = 0;
      agentGrowth = new Array(ringCount).fill(0);
      leaderShown = 0;
      agentShown = new Array(ringCount).fill(0);

      for (let i = 0; i < ringCount; i++) {
        const sprite = makeAgentSprite("var(--text-muted)", "leader-agent-sprite");
        placeAgentSprite(sprite, ring[i].x, ring[i].y, AGENT_R);
        agentLayer.appendChild(sprite);
        agentNodes.push(sprite);
        const line = el("line", {
          x1: ring[i].x, y1: ring[i].y, x2: cx, y2: cy,
          stroke: "var(--text-muted)", "stroke-width": 1.6
        });
        lineLayer.appendChild(line);
        lines.push({ el: line, agentIdx: i });
      }
      leaderNode = makeAgentSprite(LEADER_COLOR, "leader-agent-sprite");
      placeAgentSprite(leaderNode, cx, cy, BASE_LEADER_R);
      agentLayer.appendChild(leaderNode);
    }

    // Called the instant a single dot finishes one leg of its trip — raises
    // the receiving node's target right away rather than waiting for anyone
    // else; updateGrowth walks the drawn radius up to it over the next few
    // frames.
    function onArrive(inward, agentIdx) {
      if (inward) {
        leaderGrowth = Math.min(leaderGrowth + GROWTH / ringCount, GROWTH * MAX_CYCLES);
      } else {
        agentGrowth[agentIdx] = Math.min(agentGrowth[agentIdx] + AGENT_GROWTH, AGENT_GROWTH * MAX_CYCLES);
      }
    }

    // Exponential ease toward the target radius, framed in dt so it runs at
    // the same speed whatever the frame rate. Snaps the last hundredth of a
    // pixel shut so a node that has finished growing stops being re-rendered.
    function updateGrowth(dt) {
      const k = 1 - Math.exp(-dt / GROW_EASE_MS);
      if (Math.abs(leaderGrowth - leaderShown) > 0.005) {
        leaderShown += (leaderGrowth - leaderShown) * k;
        if (Math.abs(leaderGrowth - leaderShown) <= 0.005) leaderShown = leaderGrowth;
        placeAgentSprite(leaderNode, cx, cy, BASE_LEADER_R + leaderShown);
      }
      for (let i = 0; i < ringCount; i++) {
        if (Math.abs(agentGrowth[i] - agentShown[i]) <= 0.005) continue;
        agentShown[i] += (agentGrowth[i] - agentShown[i]) * k;
        if (Math.abs(agentGrowth[i] - agentShown[i]) <= 0.005) agentShown[i] = agentGrowth[i];
        placeAgentSprite(agentNodes[i], ring[i].x, ring[i].y, AGENT_R + agentShown[i]);
      }
    }

    let particles = [];
    let completedTrips = 0;
    function clearParticles() {
      particles.forEach((p) => p.dot.remove());
      particles = [];
    }
    // One particle per follower, covering its whole round trip: a staggered
    // wait, then leader -> follower, a brief pause sitting at the follower,
    // then follower -> leader — still with no wait on any other follower.
    function spawnRoundTrips() {
      completedTrips = 0;
      particles = lines.map(({ agentIdx }) => ({
        agentIdx,
        stage: "delay", // delay -> outbound -> pausing -> inbound -> done
        delay: Math.random() * OUTBOUND_STAGGER_MS,
        pauseTimer: 0,
        t: 0,
        dot: el("circle", { r: 3.5, fill: LEADER_COLOR, opacity: 0 })
      }));
      particles.forEach((p) => dotLayer.appendChild(p.dot));
    }
    function updateParticles(dt) {
      particles.forEach((p) => {
        if (p.stage === "done") return;
        if (p.stage === "delay") {
          p.delay -= dt;
          if (p.delay <= 0) { p.stage = "outbound"; p.t = 0; }
          return;
        }
        if (p.stage === "pausing") {
          p.pauseTimer -= dt;
          if (p.pauseTimer <= 0) { p.stage = "inbound"; p.t = 0; }
          return; // dot stays put, already sitting at the follower
        }
        p.t = Math.min(1, p.t + dt / DOT_TRAVEL_MS);
        const a = ring[p.agentIdx];
        const outbound = p.stage === "outbound";
        const from = outbound ? { x: cx, y: cy } : a;
        const to = outbound ? a : { x: cx, y: cy };
        p.dot.setAttribute("cx", (from.x + (to.x - from.x) * p.t).toFixed(2));
        p.dot.setAttribute("cy", (from.y + (to.y - from.y) * p.t).toFixed(2));
        p.dot.setAttribute("opacity", 0.9);
        if (p.t >= 1) {
          if (outbound) {
            onArrive(false, p.agentIdx);
            // A brief pause at the follower before it sends its own dot back
            // — still not waiting on any other follower.
            p.stage = "pausing";
            p.pauseTimer = FOLLOWER_PAUSE_MS;
          } else {
            onArrive(true, p.agentIdx);
            p.stage = "done";
            p.dot.setAttribute("opacity", 0);
            completedTrips++;
          }
        }
      });
    }

    if (reduceMotion) {
      buildCircle();
      placeAgentSprite(leaderNode, cx, cy, BASE_LEADER_R + GROWTH * MAX_CYCLES);
      agentNodes.forEach((n, i) => placeAgentSprite(n, ring[i].x, ring[i].y, AGENT_R + AGENT_GROWTH * MAX_CYCLES));
      return;
    }

    buildCircle();
    let phase = "cycling", cycle = 0, phaseTimer = 0;
    spawnRoundTrips();

    let last = performance.now();
    function loop(now) {
      const dt = now - last;
      last = now;

      // Growth eases every frame regardless of phase, so a trip that lands
      // just before the last cycle ends still finishes swelling during the
      // hold rather than being cut off.
      updateGrowth(dt);

      if (phase === "cycling") {
        updateParticles(dt);
        if (completedTrips >= ringCount) {
          cycle++;
          if (cycle >= MAX_CYCLES) {
            phase = "holding";
            phaseTimer = 0;
          } else {
            spawnRoundTrips();
          }
        }
      } else if (phase === "holding") {
        phaseTimer += dt;
        if (phaseTimer >= HOLD_MS) { phase = "resetting"; phaseTimer = 0; }
      } else if (phase === "resetting") {
        phaseTimer += dt;
        if (phaseTimer >= RESET_PAUSE_MS) {
          cycle = 0;
          buildCircle();
          spawnRoundTrips();
          phase = "cycling";
          phaseTimer = 0;
        }
      }

      requestAnimationFrame(loop);
    }
    requestAnimationFrame(loop);
  })();
})();
