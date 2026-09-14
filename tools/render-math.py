#!/usr/bin/env python3
"""Render the site's display math to inline-able SVG.

There is no TeX on this machine and no build step on the site, so this uses
matplotlib's built-in mathtext (a LaTeX subset, no TeX install needed) and is
run BY HAND when a formula changes — the SVG it emits is pasted into the page.

Why SVG rather than a PNG: the glyphs come out as <path> defs with no fill of
their own, so a single fill="currentColor" on the root makes the formula take
the page's text colour. That is what lets one asset serve both light and dark
mode. A raster image would need two files and would still be soft on retina.

Why inline rather than <img src="...svg">: an <img> renders in an isolated
document, where currentColor resolves against nothing and the theming is lost.

Usage:  python3 tools/render-math.py           # writes tools/math-out/*.svg
"""
import re, pathlib
import matplotlib
matplotlib.use("Agg")
matplotlib.rcParams["svg.fonttype"] = "path"       # no webfont dependency
matplotlib.rcParams["mathtext.fontset"] = "stix"   # Times-like, conventional for math
import matplotlib.pyplot as plt

# name -> (latex, plain-text equivalent for screen readers)
#
# Notation is the write-up's: A = {1..N} the agents, pi_i the behaviour agent i
# plays, U_i(pi) the utility i receives when behaviour pi is performed, F_i the
# set of agents currently following i. Keep these in step with the prose in
# index.html — the symbols are introduced there and used here.
FORMULAS = {
    "personal": (
        r"$P_i \;=\; U_i(\pi_i)$",
        "P sub i equals U sub i of pi sub i",
    ),
    "emulation": (
        r"$E_i \;=\; \gamma \sum_{j \in A} U_j(\pi_i)$",
        "E sub i equals gamma times the sum over all agents j in A of U sub j of pi sub i",
    ),
    "prestige": (
        r"$G_i \;=\; \kappa \sum_{j \in F_i} U_j(\pi_i)$",
        "G sub i equals kappa times the sum over followers j in F sub i of U sub j of pi sub i",
    ),
}

FONTSIZE = 15
# em per viewBox unit. The viewBox is in points; this converts to a size that
# sits a touch above the 16px body text, as display math should.
UNIT_EM = 0.075


def render(expr: str) -> str:
    fig = plt.figure(figsize=(0.01, 0.01))
    fig.text(0, 0, expr, fontsize=FONTSIZE)
    buf = pathlib.Path("/tmp/_math.svg")
    fig.savefig(buf, format="svg", bbox_inches="tight", pad_inches=0.02, transparent=True)
    plt.close(fig)
    return buf.read_text()


def clean(svg: str, title: str) -> str:
    # Drop the XML prologue, DOCTYPE and RDF metadata block — none of it is
    # meaningful once the SVG is inlined into an HTML document.
    svg = re.sub(r"<\?xml.*?\?>\s*", "", svg, flags=re.S)
    svg = re.sub(r"<!DOCTYPE.*?>\s*", "", svg, flags=re.S)
    svg = re.sub(r"<metadata>.*?</metadata>\s*", "", svg, flags=re.S)
    # matplotlib emits a transparent background rect; it serves no purpose here.
    svg = re.sub(r'<g id="patch_1">.*?</g>\s*', "", svg, flags=re.S)
    # pt units on width/height would fight the page's sizing, so drop them — but
    # the size cannot simply be left to a fixed CSS height either. Every formula
    # here is drawn at the same FONTSIZE, so the glyphs already match; what
    # differs is the box, because a summation with limits above and below is
    # nearly twice as tall as a one-line expression (30.3 vs 17.4 units). Pin
    # them all to one CSS height and the tall ones get scaled down, which shrinks
    # their glyphs and makes the three formulas visibly different sizes. So emit
    # a height proportional to each box's own height: equal glyph size, unequal
    # boxes, which is what display math is meant to look like.
    m = re.search(r'viewBox="([^"]+)"', svg)
    vb = m.group(1)
    w, h = float(vb.split()[2]), float(vb.split()[3])
    svg = re.sub(
        r"<svg[^>]*>",
        f'<svg class="math" viewBox="{vb}" style="height:{h * UNIT_EM:.3f}em" '
        f'fill="currentColor" role="img" aria-label="{title}" '
        f'xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink">',
        svg, count=1)
    svg = re.sub(r"\s*<style[^>]*>.*?</style>\s*", "", svg, flags=re.S)
    return re.sub(r"\n\s*\n", "\n", svg).strip()


out = pathlib.Path(__file__).parent / "math-out"
out.mkdir(exist_ok=True)
for name, (expr, alt) in FORMULAS.items():
    svg = clean(render(expr), alt)
    (out / f"{name}.svg").write_text(svg + "\n")
    print(f"{name:12s} {len(svg):6d} bytes")
