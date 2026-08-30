// The shepherd figure, shared by the pasture scene (js/commons.js), the
// gossip scene (js/shepherds.js), and the Project 02 diagrams
// (js/leader-emergence.js) so the same cast appears everywhere.
//
// Drawn around a local origin, facing forward, symmetric left-right, roughly
// 22 wide by 41 tall at scale 1: x from -11 to 11 and y from -21 (top of the
// hood) to 20 (hem of the cloak). Used to include a crook, dropped because it
// broke the left-right symmetry and read as a stray thread off the head at
// small sizes.
window.ShepherdSprite = (function () {
  const NS = "http://www.w3.org/2000/svg";
  const OUTLINE = "#3f3a33";
  const SKIN = "#e8c9a8";

  const EXTENT = { left: -11, right: 11, top: -21, bottom: 20 };

  function el(tag, attrs) {
    const e = document.createElementNS(NS, tag);
    for (const k in attrs) e.setAttribute(k, attrs[k]);
    return e;
  }

  // Hooded figure, cloak in its own colour.
  function make(color, className) {
    const g = el("g", { class: className || "shepherd-figure" });
    const cloak = el("path", {                          // cloak
      d: "M 0 -8 L 11 20 L -11 20 Z",
      fill: color, stroke: OUTLINE, "stroke-width": 1.4, "stroke-linejoin": "round"
    });
    g.appendChild(cloak);
    g.appendChild(el("circle", { cx: 0, cy: -14, r: 6.5, fill: SKIN, stroke: OUTLINE, "stroke-width": 1.4 }));
    const hood = el("path", {                           // hood
      d: "M -7 -14 a 7 7 0 0 1 14 0 z",
      fill: color, opacity: "0.9"
    });
    g.appendChild(hood);

    // Recolouring is a live operation for the gossip scene, where a shepherd's
    // colour tracks whichever herd size it currently favours.
    g.setColor = (next) => {
      cloak.setAttribute("fill", next);
      hood.setAttribute("fill", next);
    };
    return g;
  }

  // The four herds' colours, in one place so the pasture in "The Problem" and
  // the paired pastures in Project 02 can never drift apart. These are the
  // light-mode values of --opt-1..4; the cloaks and blankets keep them in both
  // themes, because a shepherd's identity should not change when the lights go
  // out.
  const HERDS = ["#6366f1", "#e0a021", "#14b8a6", "#e05a8a"];

  return { make, EXTENT, OUTLINE, HERDS };
})();
