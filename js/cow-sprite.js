// Shared cow figure, used by the pasture in "The Problem" and by both pastures
// in Project 02. Lifted out of js/commons.js unchanged apart from the scale,
// which is now a parameter — Project 02 draws on smaller tiles and needs a
// smaller animal.
//
// The class names are still the `commons-*` ones because css/style.css hangs
// the grazing-head transition and the fade-out on them.
(function () {
  const NS = "http://www.w3.org/2000/svg";
  const OUTLINE = "#3f3a33";
  const COW_FED = "#f6f2e9";      // full-energy coat
  const COW_SPENT = "#c9c0ae";    // dull, drawn-out coat as energy runs out

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

  // Side-view cow drawn around a local origin, facing +x; `dir` flips it.
  function make(color, scale) {
    const SCALE = scale || 0.55;
    const g = el("g", { class: "commons-cow" });

    g.appendChild(el("path", {                          // tail
      d: "M -13 -3 C -18 -2 -19 3 -17 8",
      fill: "none", stroke: OUTLINE, "stroke-width": 1.6, "stroke-linecap": "round"
    }));
    [-8.5, -4, 4.5, 8.5].forEach((lx) => {              // legs
      g.appendChild(el("rect", { x: lx - 1.4, y: 4, width: 2.8, height: 10, rx: 1.2, fill: OUTLINE }));
    });
    const body = el("ellipse", {                        // body
      cx: 0, cy: 0, rx: 13, ry: 8,
      fill: COW_FED, stroke: OUTLINE, "stroke-width": 1.6
    });
    g.appendChild(body);
    g.appendChild(el("ellipse", { cx: -4.5, cy: 1.5, rx: 4.2, ry: 3.2, fill: OUTLINE, opacity: "0.85" }));
    g.appendChild(el("ellipse", { cx: 5, cy: -2.5, rx: 3, ry: 2.2, fill: OUTLINE, opacity: "0.85" }));

    // Blanket in the shepherd's colour, following the curve of the back.
    g.appendChild(el("path", {
      d: "M -6 -7.1 A 13 8 0 0 1 6 -7.1 L 5 -2.5 L -5 -2.5 Z",
      fill: color, opacity: "0.95"
    }));

    // Head sits in its own group so it can dip down to graze.
    const head = el("g", { class: "commons-cow-head" });
    head.appendChild(el("ellipse", { cx: 14, cy: -4, rx: 6, ry: 5, fill: COW_FED, stroke: OUTLINE, "stroke-width": 1.5 }));
    head.appendChild(el("ellipse", { cx: 18, cy: -2.2, rx: 3.4, ry: 2.6, fill: "#e5b9b0", stroke: OUTLINE, "stroke-width": 1.1 }));
    head.appendChild(el("ellipse", { cx: 10.5, cy: -8.5, rx: 2.6, ry: 1.5, fill: COW_FED, stroke: OUTLINE, "stroke-width": 1.1 }));
    head.appendChild(el("path", {                       // horns
      d: "M 13.5 -8.8 q 1.5 -3 3.6 -2.4 M 16.4 -7.6 q 2.4 -2 4.2 -0.6",
      fill: "none", stroke: OUTLINE, "stroke-width": 1.3, "stroke-linecap": "round"
    }));
    head.appendChild(el("circle", { cx: 16.2, cy: -5.4, r: 0.9, fill: OUTLINE }));
    g.appendChild(head);

    const coatParts = [body, head.children[0], head.children[2]];

    const cow = {
      color,
      node: g,
      x: 0, y: 0, dir: 1, tilt: 0,
      setPose(x, y, dir, tilt) {
        cow.x = x; cow.y = y;
        if (dir) cow.dir = dir;
        cow.tilt = tilt || 0;
        g.setAttribute("transform",
          `translate(${x.toFixed(2)} ${y.toFixed(2)}) rotate(${cow.tilt.toFixed(2)}) scale(${cow.dir * SCALE} ${SCALE})`);
      },
      // energy 1 = well fed, 0 = starved
      setEnergy(e) {
        const coat = lerpColor(COW_SPENT, COW_FED, clamp(e, 0, 1));
        coatParts.forEach((part) => part.setAttribute("fill", coat));
      },
      setGrazing(on) {
        head.setAttribute("transform", on ? "translate(2 6) rotate(22 14 -4)" : "");
      }
    };
    cow.setPose(0, 0, 1, 0);
    return cow;
  }

  window.CowSprite = { make, OUTLINE, FED: COW_FED, SPENT: COW_SPENT };
})();
