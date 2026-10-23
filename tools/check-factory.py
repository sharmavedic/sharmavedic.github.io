"""Check factory motion and rendering. Requires Playwright and local Chrome.

Run: python3 tools/check-factory.py
Optional: --screenshots /tmp/factory-review
"""
import argparse
import json
from pathlib import Path
import shutil
from playwright.sync_api import sync_playwright

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--screenshots', type=Path)
args = parser.parse_args()
root = Path(__file__).resolve().parents[1]
if args.screenshots:
    args.screenshots.mkdir(parents=True, exist_ok=True)

with sync_playwright() as p:
    browser = p.chromium.launch(
        executable_path=shutil.which('google-chrome') or shutil.which('chromium'),
        args=['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader',
              '--enable-unsafe-swiftshader', '--allow-file-access-from-files'],
    )
    page = browser.new_page(viewport={'width': 1440, 'height': 1000})
    errors = []
    page.on('pageerror', lambda error: errors.append(str(error)))
    page.goto((root / 'index.html').as_uri())
    page.wait_for_function('window.kineticSculpture !== undefined')
    page.get_by_role('button', name='Pause factory animation', exact=True).click()
    page.wait_for_timeout(50)
    result = page.evaluate('''() => {
      const K = window.kineticSculpture;
      let minSpacing = Infinity, maxActive = 0, totalActive = 0, maxJump = 0;
      const previous = new Map();
      for (let i = 0; i <= 4000; i++) {
        const t = i * .02, state = K.sample(t);
        const active = state.agents.filter(a => a.walking || a.holding || a.turning).length;
        maxActive = Math.max(maxActive, active); totalActive += active;
        for (const a of state.agents) {
          if (a.speed > .001) {
            const mismatch = Math.abs(Math.atan2(Math.sin(a.heading-a.direction), Math.cos(a.heading-a.direction)));
            if (mismatch > .001) throw Error(`Walking sideways: ${a.name} at ${t}`);
          }
          const c=Math.cos(a.heading), s=Math.sin(a.heading);
          const step=Math.sin(a.walkPhase*10)*Math.min(1,a.speed/.4);
          // Oriented envelopes for the existing head, torso and boot geometry.
          // Vertical clearance matters: a tabletop is above a worker's feet.
          const parts=[
            ['head',[a.p[0],.74875,a.p[1]],[.29125,.28,.274]],
            ['body',[a.p[0],.36125,a.p[1]],[.18125,.215,.13125]]
          ];
          for (const side of [-1,1]) {
            const x=side*.105,z=.0475+side*step*.09375,y=.065+Math.max(0,side*step)*.035;
            parts.push(['boot',[a.p[0]+x*c+z*s,y,a.p[1]-x*s+z*c],[.0975,.06375,.135]]);
          }
          for (const [part,point,radius] of parts) for (const box of K.layout) {
            const closest=point.map((v,j)=>Math.max(box.lo[j],Math.min(box.hi[j],v)));
            const delta=point.map((v,j)=>v-closest[j]);
            const local=[delta[0]*c-delta[2]*s,delta[1],delta[0]*s+delta[2]*c];
            if (Math.hypot(...local.map((v,j)=>v/radius[j])) < .995)
              throw Error(`Fixture collision: ${a.name}/${part} at ${t}`);
          }
          // Every carried pose must be within the arm solver's physical reach.
          if (a.holding) {
            const reach=Math.hypot(.024,a.grip[1]-.342,a.grip[2]-.062);
            if (reach>.176) throw Error(`Unreachable grip: ${a.name} at ${t}`);
          }
        }
        for(let a=0;a<state.agents.length;a++) for(let b=a+1;b<state.agents.length;b++) {
          const A=state.agents[a], B=state.agents[b];
          const spacing=Math.hypot(A.p[0]-B.p[0],A.p[1]-B.p[1]);
          minSpacing=Math.min(minSpacing,spacing);
          if(spacing<.60) throw Error(`Worker collision: ${A.name}/${B.name} at ${t}`);
        }
        for(const g of state.goods) {
          if(!g.p.every(Number.isFinite)) throw Error(`Invalid product position at ${t}`);
          const old=previous.get(g.id);
          if(old) {
            const jump=Math.hypot(...g.p.map((v,j)=>v-old.p[j]));maxJump=Math.max(maxJump,jump);
            if(jump>.15) throw Error(`Product jump: ${g.id} at ${t} (${jump})`);
          }
        }
        previous.clear();for(const g of state.goods)previous.set(g.id,g);
      }
      if(maxActive<4 || totalActive/4001<2) throw Error('Production no longer overlaps');
      return {samples:4001,minWorkerSpacing:minSpacing,maxActiveWorkers:maxActive,
        averageActiveWorkers:totalActive/4001,maxProductStep:maxJump};
    }''')
    page.get_by_role('button', name='Inspect models', exact=True).click()
    for seconds in [0, 3.3, 6, 10, 11.7, 15, 20, 25.8, 27.7, 30, 35, 39.9]:
        page.evaluate('(t) => window.kineticSculpture.render(t)', seconds)
        assert page.evaluate("document.querySelector('.kinetic-sculpture canvas').getContext('webgl').getError()") == 0
        if args.screenshots and seconds in [0, 10, 20, 30]:
            page.screenshot(path=str(args.screenshots / f'inspection-{seconds}.png'))
    page.get_by_role('button', name='Zoom in', exact=True).click()
    page.get_by_role('button', name='Reset', exact=True).click()
    page.get_by_role('button', name='Exit inspection', exact=True).click()
    page.evaluate('window.kineticSculpture.render(10)')
    if args.screenshots:
        page.screenshot(path=str(args.screenshots / 'desktop.png'))
    page.set_viewport_size({'width':390,'height':844})
    page.wait_for_timeout(100)
    page.evaluate("window.kineticSculpture.render(10);document.documentElement.style.scrollBehavior='auto';window.scrollTo(0,500)")
    page.wait_for_timeout(200)
    assert not page.evaluate('document.documentElement.scrollWidth>innerWidth')
    if args.screenshots:
        page.screenshot(path=str(args.screenshots / 'mobile.png'))
    assert not errors, errors
    browser.close()
    print(json.dumps({'passed':True,**result,'javascriptErrors':errors,'mobileOverflow':False}))
