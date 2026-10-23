// A satin-enamel miniature factory with an uncertain purpose. Native WebGL, local assets only.
// Deterministic machines and little workers share a clock, not a simulation.
(function () {
  const host = document.querySelector('.kinetic-sculpture');
  if (!host) return;
  const canvas = host.querySelector('canvas');
  const button = host.querySelector('button');
  const gl = canvas.getContext('webgl', { antialias: true, alpha: true });
  if (!gl) return; // The static illustration underneath remains visible.

  const vertex = `
    attribute vec3 position, normal, skin;
    uniform mat4 model, viewProjection, lightProjection;
    uniform mat3 normalMatrix;
    uniform vec3 suitPose;
    uniform float rounding;
    uniform mat4 leftUpper, leftLower, leftHand, rightUpper, rightLower, rightHand;
    varying vec3 N, P, localP;
    varying vec4 shadowPosition;
    void main() {
      vec3 p = position;
      localP = position;
      vec3 n = normal;
      if (rounding > 0.0) {
        p = mix(p, normalize(p), rounding);
        n = normalize(mix(n, normalize(p), rounding));
      }
      if (skin.x > 0.0) {
        mat4 upper = skin.z < 0.0 ? leftUpper : rightUpper;
        mat4 lower = skin.z < 0.0 ? leftLower : rightLower;
        mat4 hand = skin.z < 0.0 ? leftHand : rightHand;
        float wrist = 1.0 - smoothstep(.185, .225, position.y);
        // Dual-quaternion skinning preserves volume through wrist twists and
        // elbow bends. Each packed bone stores rotation and dual translation.
        vec4 weights = vec4(1.0-skin.x, skin.x*(1.0-skin.y),
          skin.x*skin.y*(1.0-wrist), skin.x*skin.y*wrist);
        float ls = dot(upper[0],lower[0]) < 0.0 ? -1.0 : 1.0;
        float hs = dot(upper[0],hand[0]) < 0.0 ? -1.0 : 1.0;
        vec4 q = vec4(0.0,0.0,0.0,weights.x) + upper[0]*weights.y
          + lower[0]*(weights.z*ls) + hand[0]*(weights.w*hs);
        vec4 d = upper[1]*weights.y + lower[1]*(weights.z*ls) + hand[1]*(weights.w*hs);
        float magnitude = max(length(q), .00001);
        q /= magnitude; d /= magnitude;
        d -= q * dot(q,d);
        vec3 translation = 2.0*(q.w*d.xyz-d.w*q.xyz+cross(q.xyz,d.xyz));
        p += 2.0*cross(q.xyz,cross(q.xyz,p)+q.w*p)+translation;
        n = normalize(n+2.0*cross(q.xyz,cross(q.xyz,n)+q.w*n));
      }
      float leg = (1.0 - smoothstep(.08, .20, position.y)) * (1.0 - skin.x);
      p.y += leg * max(0.0, sign(p.x) * suitPose.x) * .028;
      p.z += leg * sign(p.x) * suitPose.x * .075;
      vec4 world = model * vec4(p, 1.0);
      P = world.xyz;
      N = normalize(normalMatrix * n);
      // Offset the receiver along its normal to avoid faceted self-shadow acne.
      shadowPosition = lightProjection * (world + vec4(N * .018, 0.0));
      gl_Position = viewProjection * world;
    }`;
  const fragment = `
    precision highp float;
    uniform vec3 color, eye;
    uniform sampler2D shadowMap;
    uniform float gloss, ground, glass, suit;
    varying vec3 N, P, localP;
    varying vec4 shadowPosition;
    float depth(vec4 v) { return dot(v, vec4(1.0/16777216.0, 1.0/65536.0, 1.0/256.0, 1.0)); }
    void main() {
      vec3 n = normalize(N), l = normalize(vec3(-3.0, 7.0, 5.0));
      if (glass > .5) {
        vec3 view = normalize(eye - P);
        float fresnel = pow(1.0 - abs(dot(n, view)), 3.0);
        float reflection = pow(max(dot(n, normalize(l + view)), 0.0), 100.0);
        float softbox = smoothstep(.96, .988, dot(n, normalize(vec3(-.10, .60, .90))));
        gl_FragColor = vec4(mix(vec3(.65, .82, .91), vec3(1.0), max(reflection, softbox)),
          .065 + fresnel * .38 + reflection * .5 + softbox * .32);
        return;
      }
      vec3 uv = shadowPosition.xyz / shadowPosition.w * .5 + .5;
      float shadow = 0.0;
      float bias = max(.00065, .0018 * (1.0 - dot(n, l)));
      for (int x=-2; x<=2; x++) for (int y=-2; y<=2; y++) {
        float d = depth(texture2D(shadowMap, uv.xy + vec2(float(x), float(y)) * .0015));
        shadow += uv.z - bias > d ? 0.0 : 1.0;
      }
      shadow /= 25.0;
      if (uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0) shadow = 1.0;
      if (ground > .5) {
        // A transparent shadow catcher lets CSS own the background in both themes.
        float fade = 1.0 - smoothstep(8.0, 12.0, length(P.xz));
        gl_FragColor = vec4(.025, .028, .035, (1.0 - shadow) * .25 * fade);
        return;
      }
      float diffuse = max(dot(n, l), 0.0);
      vec3 halfVector = normalize(l + normalize(eye - P));
      // Broad studio reflections give enamel a soft sheen rather than plastic glare.
      float highlight = max(dot(n, halfVector), 0.0);
      float specular = (pow(highlight, max(12.0, gloss * .65)) * .16
        + pow(highlight, 9.0) * .055) * shadow;
      vec3 material = color;
      if (suit > .5) {
        // Subtle woven cuffs and boot soles are part of the continuous surface.
        float cuff = (1.0 - smoothstep(.011, .016, abs(localP.y - .194))) * smoothstep(.17, .20, abs(localP.x));
        float sole = 1.0 - smoothstep(-.025, -.016, localP.y);
        material = mix(material, vec3(.65, .73, .77), max(cuff * .7, sole));
      }
      // Very fine moulded grain, kept below the contrast of the form itself.
      float grain = fract(sin(dot(P, vec3(127.1, 311.7, 74.7))) * 43758.5453);
      material *= .992 + grain * .016;
      vec3 base = pow(material, vec3(2.2));
      float sky = n.y * .5 + .5;
      vec3 ambient = mix(vec3(.18, .22, .28), vec3(.48, .54, .60), sky);
      // Shadows also dim ambient light: seams and undersides no longer look luminous.
      ambient *= mix(.60, 1.0, shadow);
      vec3 lit = base * (ambient + vec3(1.0, .87, .74) * diffuse * shadow * .85)
        + vec3(1.0, .94, .87) * specular;
      lit += base * vec3(.055, .075, .095) * max(-n.y, 0.0);
      gl_FragColor = vec4(pow(lit, vec3(1.0 / 2.2)), 1.0);
    }`;
  const depthFragment = `
    precision highp float;
    void main() {
      vec4 v = fract(gl_FragCoord.z * vec4(16777216.0, 65536.0, 256.0, 1.0));
      gl_FragColor = v - v.xxyz * vec4(0.0, 1.0/256.0, 1.0/256.0, 1.0/256.0);
    }`;

  function program(v, f) {
    const p = gl.createProgram();
    [[gl.VERTEX_SHADER, v], [gl.FRAGMENT_SHADER, f]].forEach(([type, source]) => {
      const s = gl.createShader(type);
      gl.shaderSource(s, source); gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw Error(gl.getShaderInfoLog(s));
      gl.attachShader(p, s);
    });
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw Error(gl.getProgramInfoLog(p));
    const uniforms = {};
    ['model', 'viewProjection', 'lightProjection', 'normalMatrix', 'color', 'eye', 'gloss', 'ground', 'shadowMap', 'glass', 'suitPose', 'suit', 'rounding', 'leftUpper', 'leftLower', 'leftHand', 'rightUpper', 'rightLower', 'rightHand'].forEach(k => uniforms[k] = gl.getUniformLocation(p, k));
    return { p, uniforms, position: gl.getAttribLocation(p, 'position'), normal: gl.getAttribLocation(p, 'normal'), skin: gl.getAttribLocation(p, 'skin') };
  }

  // Column-major matrices, with separate normal transforms for stretched clay shapes.
  const I = () => [1,0,0,0, 0,1,0,0, 0,0,1,0, 0,0,0,1];
  function multiply(a, b) {
    const out = new Array(16).fill(0);
    for (let c=0;c<4;c++) for (let r=0;r<4;r++) for (let k=0;k<4;k++) out[c*4+r] += a[k*4+r]*b[c*4+k];
    return out;
  }
  function move(x,y,z) { const m=I(); m[12]=x; m[13]=y; m[14]=z; return m; }
  function scale(x,y=x,z=x) { const m=I(); m[0]=x; m[5]=y; m[10]=z; return m; }
  function rotate(axis,a) {
    const c=Math.cos(a), s=Math.sin(a);
    return axis==='x' ? [1,0,0,0, 0,c,s,0, 0,-s,c,0, 0,0,0,1] : axis==='y' ? [c,0,-s,0, 0,1,0,0, s,0,c,0, 0,0,0,1] : [c,s,0,0, -s,c,0,0, 0,0,1,0, 0,0,0,1];
  }
  const chain = (...matrices) => matrices.reduce(multiply, I());
  const sub = (a,b) => a.map((v,i)=>v-b[i]);
  const dot = (a,b) => a.reduce((s,v,i)=>s+v*b[i],0);
  const cross = (a,b) => [a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
  const unit = a => { const n=Math.hypot(...a); return a.map(v=>v/n); };
  function lookAt(eye, target) {
    const z=unit(sub(eye,target)), x=unit(cross([0,1,0],z)), y=cross(z,x);
    return [x[0],y[0],z[0],0, x[1],y[1],z[1],0, x[2],y[2],z[2],0, -dot(x,eye),-dot(y,eye),-dot(z,eye),1];
  }
  function ortho(w,h,n,f) { return [2/w,0,0,0, 0,2/h,0,0, 0,0,-2/(f-n),0, 0,0,-(f+n)/(f-n),1]; }
  function normals(m) {
    const a=m.slice(0,3), b=m.slice(4,7), c=m.slice(8,11);
    const bc=cross(b,c), ca=cross(c,a), ab=cross(a,b), d=dot(a,bc);
    return [...bc,...ca,...ab].map(v=>v/d);
  }

  function mesh(surface, nu, nv) {
    const data=[];
    for(let u=0;u<nu;u++) for(let v=0;v<nv;v++) {
      [[u,v],[u+1,v],[u+1,v+1],[u,v],[u+1,v+1],[u,v+1]].forEach(([a,b])=>data.push(...surface(a/nu,b/nv)));
    }
    const buffer=gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER,buffer);
    gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(data),gl.STATIC_DRAW);
    return {buffer,count:data.length/6};
  }
  const TAU=Math.PI*2;
  const sphere = mesh((u,v)=>{
    const a=u*TAU, b=v*Math.PI, x=Math.cos(a)*Math.sin(b), y=Math.cos(b), z=Math.sin(a)*Math.sin(b);
    return [x,y,z,x,y,z];
  },24,16);
  function torus(radius,tube) {
    return mesh((u,v)=>{
      const a=u*TAU,b=v*TAU, c=Math.cos(b), s=Math.sin(b);
      return [(radius+tube*c)*Math.cos(a),(radius+tube*c)*Math.sin(a),tube*s,c*Math.cos(a),c*Math.sin(a),s];
    },64,12);
  }
  // A lathed, bevelled puck: clean highlights around each edge.
  function puck(radius,height,bevel=.045) {
    const profile=[[0,0],[radius-bevel,0],[radius,.035],[radius,height-bevel],[radius-bevel,height],[0,height]];
    return mesh((u,v)=>{
      const j=Math.min(profile.length-2,Math.floor(v*(profile.length-1)));
      const t=v*(profile.length-1)-j, [r0,y0]=profile[j], [r1,y1]=profile[j+1];
      const r=r0+(r1-r0)*t,y=y0+(y1-y0)*t,a=u*TAU;
      const n=unit([y1-y0, r0-r1,0]);
      return [r*Math.cos(a),y,r*Math.sin(a),n[0]*Math.cos(a),n[1],n[0]*Math.sin(a)];
    },48,profile.length-1);
  }
  const floor = mesh((u,v)=>[(u-.5)*200,0,(v-.5)*200,0,1,0],1,1);
  const cylinder=puck(1,1,.035), hoop=torus(1,.095), thinHoop=torus(1,.035);
  const white=[.89,.94,.97], blue=[.30,.57,.73], blueDark=[.20,.36,.48];
  const gold=[1.0,.66,.43], ink=[.14,.24,.32], muted=[.64,.77,.83], red=[.91,.48,.32];
  // Dimension-specific rounded boxes keep bevels the same physical size even
  // on long rails. Scaling a single rounded cube would stretch its corners.
  const roundedBoxes=new Map();
  function roundedBox(w,h,d) {
    const key=[w,h,d].join(',');
    if(roundedBoxes.has(key))return roundedBoxes.get(key);
    const half=[w/2,h/2,d/2], r=Math.min(.065,Math.min(w,h,d)*.22);
    const inner=half.map(v=>v-r), data=[];
    for(let axis=0;axis<3;axis++)for(const sign of [-1,1]) {
      const u=(axis+1)%3,v=(axis+2)%3;
      // Place samples at both sides of each bevel as well as within its arc.
      const samples=i=>[-half[i],-half[i]+r*.3,-half[i]+r,
        half[i]-r,half[i]-r*.3,half[i]];
      const us=samples(u),vs=samples(v);
      const point=(a,b)=>{
        const q=[0,0,0];q[axis]=sign*half[axis];q[u]=us[a];q[v]=vs[b];
        const core=q.map((x,i)=>Math.max(-inner[i],Math.min(inner[i],x)));
        const n=unit(sub(q,core));
        return [...core.map((x,i)=>x+r*n[i]),...n];
      };
      for(let a=0;a<5;a++)for(let b=0;b<5;b++) {
        const corners=[[a,b],[a+1,b],[a+1,b+1],[a,b+1]];
        (sign>0?[0,1,2,0,2,3]:[0,2,1,0,3,2]).forEach(i=>data.push(...point(...corners[i])));
      }
    }
    const buffer=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,buffer);
    gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(data),gl.STATIC_DRAW);
    const result={buffer,count:data.length/6};roundedBoxes.set(key,result);return result;
  }
  // Factory X is horizontal in the default view; Z runs into the workshop.
  const factoryRoot=rotate('y',Math.atan2(5.2,7.7));
  let objects=[];
  const add=(mesh,model,color=white,gloss=38,extra={})=>objects.push({mesh,model:chain(factoryRoot,model),color,gloss,...extra});
  const box=(x,y,z,w,h,d,color=white)=>add(roundedBox(w,h,d),move(x,y,z),color,38,{bounds:{lo:[x-w/2,y-h/2,z-d/2],hi:[x+w/2,y+h/2,z+d/2]}});
  const ball=(x,y,z,r,color=white)=>add(sphere,chain(move(x,y,z),scale(r)),color);
  const drum=(x,y,z,r,h,color=white)=>add(cylinder,chain(move(x,y,z),scale(r,h,r)),color);
  function pipe(a,b,r=.07,color=white) {
    const delta=sub(b,a), y=unit(delta);
    const x=Math.abs(y[1])>.99?[1,0,0]:unit(cross([0,1,0],y)), z=cross(x,y);
    const basis=[...x,0,...y,0,...z,0,0,0,0,1];
    add(cylinder,chain(move(...a),basis,scale(r,Math.hypot(...delta),r)),color);
  }
  function plumbing(points,r=.075,color=white) {
    for(let i=1;i<points.length;i++)pipe(points[i-1],points[i],r,color);
    points.slice(1,-1).forEach(p=>ball(...p,r*1.08,color));
  }
  const ring=(x,y,z,r,color=white,rx=0)=>add(hoop,chain(move(x,y,z),rotate('x',rx),scale(r)),color);
  function quarter(t,delay=0) {
    const x=Math.max(0,t-delay)/4.2, step=Math.floor(x), f=x-step;
    const u=Math.max(0,Math.min(1,(f-.20)/.40));
    return (step+u*u*u*(u*(u*6-15)+10))*Math.PI/2;
  }
  const ease=u=>{u=Math.max(0,Math.min(1,u));return u*u*(3-2*u);};
  const cycle=(t,length,offset=0)=>((t+offset)%length)/length;

  function buildFactory() {
    add(floor,I(),white,8);
    // Main processor: a squat housing, inspection window, hopper and exhaust.
    box(3.65,.12,-.8,1.95,.24,1.50);
    box(2.91,.88,-.8,.17,1.38,1.45,gold);
    box(3.65,.88,-1.46,1.65,1.38,.13,gold);
    box(4.39,1.20,-.8,.17,.74,1.45,gold);
    box(4.39,.32,-.8,.17,.25,1.45,gold);
    for(const x of [3.02,4.28])box(x,.88,-.055,.40,1.38,.10,gold);
    box(3.65,1.29,-.055,.86,.56,.10,gold);
    box(3.65,.25,-.055,.86,.13,.10,gold);
    box(3.65,.65,-1.1,1.10,.74,.035,blueDark);
    ring(3.65,.65,.02,.30);
    box(3.65,1.63,-.8,1.85,.14,1.64,white);
    drum(3.65,1.70,-.8,.57,.18,muted);
    add(sphere,chain(move(3.65,1.88,-.8),scale(.56,.26,.56)));
    drum(3.65,1.9,-.8,.29,.53);
    drum(3.65,2.40,-.8,.35,.10,gold);
    plumbing([[4.30,1.3,-1.1],[4.75,1.3,-1.1],[4.75,2.65,-1.1],[4.40,2.65,-1.1]],.095);
    for(let i=0;i<5;i++)box(4.50,.85+i*.12,-.60,.05,.045,.55,muted);
    // Panel trim, recessed vents and fasteners make the housing feel manufactured.
    for(const x of [3.00,4.30])box(x,.88,-.025,.035,1.04,.05,white);
    for(const y of [.36,1.40])box(3.65,y,-.025,1.34,.035,.05,white);
    for(let i=0;i<4;i++)box(3.16+i*.14,.34,-.015,.075,.055,.025,blueDark);
    for(const x of [3.0,4.3])for(const y of [.37,1.39])ball(x,y,.007,.023,muted);
    // Three indicator lamps and a lever invite the operator's endless inspection.
    box(4.25,.50,.065,.35,.22,.10,blueDark);
    for(let i=0;i<3;i++)ball(4.14+i*.10,.52,.13,.03,i===1?blue:gold);

    // Conveyor, with real rollers, feet, guard rails, and a connected press.
    box(1.575,.30,1.25,4.15,.15,.92,blueDark);
    for(const z of [.75,1.75])box(1.575,.36,z,4.25,.19,.09);
    for(const x of [-.20,1.3,3.1]) {
      for(const z of [.85,1.65])box(x,.15,z,.10,.30,.10);
    }
    for(let i=0;i<17;i++)pipe([-.27+i*.24,.41,.82],[-.27+i*.24,.41,1.68],.055,muted);
    // Four grounded columns sit outside the belt, leaving the press visible.
    for(const x of [1.20,2.55])for(const z of [.60,1.95]) {
      box(x,1.17,z,.14,2.15,.14,blue);
      box(x,.045,z,.30,.09,.28);
    }
    for(const z of [.60,1.95])box(1.875,2.28,z,1.77,.23,.20,gold);
    for(const x of [1.20,2.55])box(x,2.28,1.27,.20,.23,1.55,gold);
    box(1.875,2.28,1.27,1.77,.23,.40,gold);
    drum(1.875,2.39,1.27,.23,.24,blue);
    pipe([1.875,2.26,1.27],[1.875,1.38,1.27],.065,gold);

    // Silo and a climbing pipe bridge, visibly feeding the main processor.
    drum(.80,.04,-1.20,.61,.16);
    drum(.80,.20,-1.20,.46,1.50,blue);
    add(sphere,chain(move(.80,1.70,-1.20),scale(.46,.24,.46)));
    for(const y of [.45,1.45])ring(.80,y,-1.20,.47,muted,Math.PI/2);
    plumbing([[.80,1.82,-1.20],[.80,2.62,-1.20],[2.65,2.62,-1.20],[2.65,1.85,-1.20],[3.25,1.85,-1.20]],.10);
    ring(1.48,2.63,-1.20,.17,blue,Math.PI/2);
    // Quiet peripheral infrastructure reaches behind the text, almost like a watermark.
    plumbing([[-6,.10,3.15],[-3.9,.10,3.15],[-3.9,.10,-2.6],[-.6,.10,-2.6],[-.6,1.3,-2.6],[.8,1.3,-2.6],[.8,1.3,-1.5]],.095);
    plumbing([[-6,.18,-2.9],[-3.5,.18,-2.9],[-3.5,2.8,-2.9],[-1.1,2.8,-2.9],[-1.1,.35,-2.9]],.09);
    drum(-4.55,.04,-1.5,.58,.18);
    drum(-4.55,.22,-1.5,.43,1.25);
    add(sphere,chain(move(-4.55,1.47,-1.5),scale(.43,.21,.43)));
    ring(-3.9,.42,2.95,.24,blue);
    // Narrow docking surfaces leave space for boots and reaching hands.
    box(-.85,.14,1.325,.07,.28,.07,blueDark);
    box(-.85,.285,1.325,.52,.03,.35,muted);
    box(.05,.425,1.55,.48,.08,.50,muted);
    box(3.45,.425,1.55,.48,.08,.70,muted);
    // The sphere exits a side aperture onto a supported, open L-shaped chute.
    box(5.10,.405,-.60,1.42,.10,.40,muted);
    for(const z of [-.84,-.36])box(5.10,.54,z,1.42,.18,.045,white);
    box(5.70,.405,0,.40,.10,1.30,muted);
    for(const x of [5.47,5.93])box(x,.54,0,.045,.18,1.04,white);
    // Inspection, sorting and remoulding stations.
    drum(5.70,.04,2.55,.055,.36,blueDark);
    drum(5.70,.40,2.55,.10,.055,muted);
    box(5.30,.21,3.20,.035,.42,.06,blueDark);
    box(5.175,.405,3.20,.25,.03,.06,muted);
    box(5.05,.435,3.20,.22,.03,.12,muted);
    for(const x of [-.975,-.325])box(x,.30,3.05,.10,.60,.65,blue);
    box(-.65,.30,2.76,.75,.60,.08,blue);
    box(-.65,.16,3.35,.55,.30,.06,blue);
    box(-.65,.50,2.85,.55,.40,.04,blueDark);
    box(-.65,.42,3.05,.55,.06,.50,muted);
    box(-.65,.42,3.43,.28,.06,.16,muted);
    box(3.65,.43,-.30,.80,.05,.70,muted);
    box(3.65,.5295,-.025,.44,.05,.32,muted);
    // Controls sit within arm's reach, rather than above the workers' helmets.
    box(.90,.26,2.08,.18,.52,.12,blueDark);
    box(4.80,.26,-1.55,.18,.52,.12,blueDark);

  }
  buildFactory();
  const fixedObjects=objects.slice();

  // A single smooth-union surface forms the suit, sleeves, mittens and boots.
  // Extract it once; the vertex shader bends the shared mesh for every worker.
  const suitMesh=(()=>{
    const smooth=(a,b,k=.026)=>{
      const h=Math.max(k-Math.abs(a-b),0)/k;
      return Math.min(a,b)-h*h*k*.25;
    };
    const ellipsoid=(p,c,r)=>(Math.hypot(...p.map((v,i)=>(v-c[i])/r[i]))-1)*Math.min(...r);
    const capsule=(p,a,b,r,endRadius=r)=>{
      const ab=sub(b,a), ap=sub(p,a), h=Math.max(0,Math.min(1,dot(ap,ab)/dot(ab,ab)));
      return Math.hypot(...ap.map((v,i)=>v-ab[i]*h))-(r+(endRadius-r)*h);
    };
    function bodyField(p) {
      let d=ellipsoid(p,[0,.245,0],[.145,.172,.105]);
      d=smooth(d,ellipsoid(p,[0,.155,0],[.133,.080,.100]));
      for(const s of [-1,1]) {
        d=smooth(d,capsule(p,[s*.073,.150,0],[s*.084,.025,.006],.065));
        d=smooth(d,ellipsoid(p,[s*.084,.008,.038],[.078,.051,.108]),.022);
      }
      return d;
    }
    function armField(p,s) {
        let d=capsule(p,[s*.108,.319,0],[s*.176,.265,0],.048);
        // A tapered sleeve avoids swollen overlaps between rounded segments.
        d=smooth(d,capsule(p,[s*.176,.265,0],[s*.231,.194,.008],.048,.037),.006);
        // Tapered wrist, rolled cuff, and a flattened padded mitten.
        d=smooth(d,capsule(p,[s*.228,.202,.006],[s*.240,.172,.013],.041),.008);
        d=smooth(d,ellipsoid(p,[s*.231,.194,.008],[.049,.018,.045]),.006);
        d=smooth(d,ellipsoid(p,[s*.254,.137,.022],[.052,.057,.044]),.012);
        // The thumb sits on the radial edge, near the wrist rather than the
        // fingertips. Wrist rotation brings it forward at rest and up in a grip.
        d=smooth(d,capsule(p,[s*.282,.157,.030],[s*.310,.127,.037],.022),.009);
      return d;
    }
    // Join sleeves at the shoulders without joining a nearby thumb to the hip.
    const shoulderBlend=p=>.003+.023*ease((p[1]-.20)/.10);
    const field=p=>smooth(smooth(bodyField(p),armField(p,-1),shoulderBlend(p)),armField(p,1),shoulderBlend(p));
    const nx=48,ny=42,nz=28, points=[],values=[],data=[];
    const at=(x,y,z)=>(x*(ny+1)+y)*(nz+1)+z;
    for(let x=0;x<=nx;x++)for(let y=0;y<=ny;y++)for(let z=0;z<=nz;z++) {
      const p=[-.345+x/nx*.69,-.06+y/ny*.49,-.15+z/nz*.32];
      points.push(p); values.push(field(p));
    }
    const tetrahedra=[[0,5,1,6],[0,1,2,6],[0,2,3,6],[0,3,7,6],[0,7,4,6],[0,4,5,6]];
    const corners=[[0,0,0],[1,0,0],[1,1,0],[0,1,0],[0,0,1],[1,0,1],[1,1,1],[0,1,1]];
    const edges=[[0,1],[0,2],[0,3],[1,2],[1,3],[2,3]];
    function vertex(p) {
      const e=.0005;
      const n=unit([0,1,2].map(i=>{
        const a=p.slice(),b=p.slice();a[i]+=e;b[i]-=e;return field(a)-field(b);
      }));
      const body=bodyField(p), arm=armField(p,Math.sign(p[0])||1);
      // Geometry-derived weights keep boots/torso out of the arm rig, and the
      // entire glove follows one bone instead of stretching individual fingers.
      const blend=shoulderBlend(p);
      const weight=arm<body&&p[1]<.22?1:ease((body-arm+blend)/(2*blend));
      const forearm=1-ease((p[1]-.225)/.070);
      return [...p,...n,weight,forearm,Math.sign(p[0])];
    }
    for(let x=0;x<nx;x++)for(let y=0;y<ny;y++)for(let z=0;z<nz;z++) {
      const ids=corners.map(c=>at(x+c[0],y+c[1],z+c[2]));
      if(ids.every(i=>values[i]>=0)||ids.every(i=>values[i]<0))continue;
      for(const tet of tetrahedra) {
        const ids4=tet.map(i=>ids[i]), hits=[];
        for(const [a,b] of edges) {
          const ia=ids4[a],ib=ids4[b],va=values[ia],vb=values[ib];
          if((va<0)===(vb<0))continue;
          const u=va/(va-vb);
          hits.push(points[ia].map((v,i)=>v+(points[ib][i]-v)*u));
        }
        if(hits.length<3)continue;
        // Put each tetrahedron's planar intersection in angular order.
        const center=[0,1,2].map(i=>hits.reduce((s,p)=>s+p[i],0)/hits.length);
        const axis=unit(sub(hits[0],center)), normal=unit(cross(sub(hits[1],hits[0]),sub(hits[2],hits[0])));
        const other=cross(normal,axis);
        hits.sort((a,b)=>Math.atan2(dot(sub(a,center),other),dot(sub(a,center),axis))-Math.atan2(dot(sub(b,center),other),dot(sub(b,center),axis)));
        const verts=hits.map(vertex);
        for(let i=1;i<verts.length-1;i++)data.push(...verts[0],...verts[i],...verts[i+1]);
      }
    }
    const buffer=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,buffer);
    gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(data),gl.STATIC_DRAW);
    return {buffer,count:data.length/9,stride:36};
  })();
  // Matching shell and lens meet at one opening; the face sits behind that rim.
  function helmetSurface(start,end) {
    return mesh((u,v)=>{
      const a=u*TAU,b=start+(end-start)*v;
      const n=[Math.sin(b)*Math.cos(a),Math.sin(b)*Math.sin(a),Math.cos(b)];
      return [...n,...n];
    },48,28);
  }
  const helmetShell=helmetSurface(1.0,Math.PI), helmetGlass=helmetSurface(0,1.0);
  const characterSphere=mesh((u,v)=>{
    const a=u*TAU,b=v*Math.PI,n=[Math.cos(a)*Math.sin(b),Math.cos(b),Math.sin(a)*Math.sin(b)];
    return [...n,...n];
  },48,32);
  const suitTrim=[.57,.67,.72], peach=[.96,.65,.48], lining=[.26,.37,.44];
  // Rounded rectangular equipment rather than spherical beads.
  const equipment=mesh((u,v)=>{
    const a=u*TAU,b=v*Math.PI,n=[Math.cos(a)*Math.sin(b),Math.cos(b),Math.sin(a)*Math.sin(b)];
    const power=x=>Math.sign(x)*Math.pow(Math.abs(x),.38);
    const p=n.map(power), normal=unit(p.map(x=>Math.sign(x)*Math.pow(Math.abs(x),2/.38-1)));
    return [...p,...normal];
  },32,24);
  const parcelPosition=[0,.255,.205];
  function boneFrame(direction,front) {
    const y=unit(direction), z=unit(front.map((v,i)=>v-y[i]*dot(front,y))), x=cross(y,z);
    return [...x,0,...y,0,...z,0,0,0,0,1];
  }
  function boneRotation(from,to,front=[0,0,1]) {
    const rest=boneFrame(from,[0,0,1]), posed=boneFrame(to,front);
    const inverse=[rest[0],rest[4],rest[8],0,rest[1],rest[5],rest[9],0,rest[2],rest[6],rest[10],0,0,0,0,1];
    return chain(posed,inverse);
  }
  function armBones(s,step,carrying,shrug,grip=parcelPosition) {
    const shoulder=[s*.108,.319,0], elbow=[s*.176,.265,0], palm=[s*.254,.137,.022];
    const wrist=[s*.231,.194,.008];
    // Relaxed palms face the thighs: fingers hang down, thumbs face forward.
    // The sculpted bind pose has spread arms; the standing pose should not.
    // Put the elbow almost directly below the shoulder, then let the forearm
    // fall beside the hip with enough clearance for the glove.
    const upper=sub(elbow,shoulder), lower=sub(wrist,elbow);
    const a=Math.hypot(...upper), b=Math.hypot(...lower);
    const restingShoulder=[s*.168,.319,.005];
    const restingElbow=[s*.178,.319-Math.sqrt(a*a-.010*.010),.005];
    const restingWrist=[s*.203,restingElbow[1]-Math.sqrt(b*b-.025*.025-.012*.012),.017];
    const swing=chain(move(...restingShoulder),rotate('x',s*step*.18),move(...restingShoulder.map(v=>-v)));
    const restingBones=[
      chain(swing,move(...restingShoulder),boneRotation(upper,sub(restingElbow,restingShoulder)),move(...shoulder.map(v=>-v))),
      chain(swing,move(...restingElbow),boneRotation(lower,sub(restingWrist,restingElbow)),move(...elbow.map(v=>-v))),
      chain(swing,move(...restingWrist),rotate('y',-s*Math.PI/2),move(...wrist.map(v=>-v)))
    ];
    if(!carrying && shrug<.001) {
      return restingBones;
    }
    // Solve to the wrist, so the sleeve and glove meet at the same joint even
    // when the hand turns. The palm retains its intended contact with the ball.
    const handRotation=[0,s,0,0, 0,0,-1,0, -s,0,0,0, 0,0,0,1];
    const offset=sub(palm,wrist);
    const rotatedOffset=[0,1,2].map(i=>handRotation[i]*offset[0]+handRotation[i+4]*offset[1]+handRotation[i+8]*offset[2]);
    const gesture=ease(shrug);
    const goal=carrying?[s*.130,grip[1],grip[2]].map((v,i)=>v-rotatedOffset[i]):restingWrist.map((v,i)=>v+([s*.240,.265,.075][i]-v)*gesture);
    // All poses share this shoulder anchor; only rotations and wrist targets move.
    const delta=sub(goal,restingShoulder), direction=unit(delta);
    const distance=Math.min(a+b-.001,Math.max(Math.abs(a-b)+.001,Math.hypot(...delta)));
    const reach=(a*a-b*b+distance*distance)/(2*distance);
    const bend=Math.sqrt(Math.max(0,a*a-reach*reach));
    // Let elbows hang below the shoulders, with just enough outward clearance
    // for the padded suit, instead of pushing the upper arms sideways.
    const restDirection=unit(sub(restingElbow,restingShoulder));
    const raisedDirection=unit([s*.70,-.55,-.08]);
    const elbowPreference=carrying?raisedDirection:restDirection.map((v,i)=>v+(raisedDirection[i]-v)*gesture);
    const bendDirection=unit(elbowPreference.map((v,i)=>v-direction[i]*dot(elbowPreference,direction)));
    const joint=restingShoulder.map((v,i)=>v+direction[i]*reach+bendDirection[i]*bend);
    const wristGoal=restingShoulder.map((v,i)=>v+direction[i]*distance);
    const upperMatrix=chain(move(...restingShoulder),boneRotation(upper,sub(joint,restingShoulder)),move(...shoulder.map(v=>-v)));
    const palmNormal=carrying?[-s,0,0]:[0,gesture,1-.7*gesture];
    const lowerMatrix=chain(move(...joint),boneRotation(lower,sub(wristGoal,joint),palmNormal),move(...elbow.map(v=>-v)));
    // Holding palms face each other, fingers wrap forward, thumbs sit on top.
    const wristRotation=carrying?handRotation:chain(rotate('x',-gesture*.95),rotate('y',-s*Math.PI/2));
    const handMatrix=chain(move(...wristGoal),wristRotation,move(...wrist.map(v=>-v)));
    return [upperMatrix,lowerMatrix,handMatrix];
  }
  // Pack a rigid transform into a unit dual quaternion for the skinning shader.
  function packBone(m) {
    const trace=m[0]+m[5]+m[10];
    let x,y,z,w,k;
    if(trace>0) {
      k=Math.sqrt(trace+1)*2; w=k/4; x=(m[6]-m[9])/k; y=(m[8]-m[2])/k; z=(m[1]-m[4])/k;
    } else if(m[0]>m[5]&&m[0]>m[10]) {
      k=Math.sqrt(1+m[0]-m[5]-m[10])*2; w=(m[6]-m[9])/k; x=k/4; y=(m[4]+m[1])/k; z=(m[8]+m[2])/k;
    } else if(m[5]>m[10]) {
      k=Math.sqrt(1+m[5]-m[0]-m[10])*2; w=(m[8]-m[2])/k; x=(m[4]+m[1])/k; y=k/4; z=(m[9]+m[6])/k;
    } else {
      k=Math.sqrt(1+m[10]-m[0]-m[5])*2; w=(m[1]-m[4])/k; x=(m[8]+m[2])/k; y=(m[9]+m[6])/k; z=k/4;
    }
    const length=Math.hypot(x,y,z,w)*(w<0?-1:1);
    x/=length; y/=length; z/=length; w/=length;
    const [tx,ty,tz]=m.slice(12,15);
    return [x,y,z,w, .5*(tx*w+ty*z-tz*y),.5*(-tx*z+ty*w+tz*x),.5*(tx*y-ty*x+tz*w),-.5*(tx*x+ty*y+tz*z), 0,0,0,0,0,0,0,0];
  }
  function astronaut(x,z,t,{y=0,heading=0,walking=false,carrying=false,shrug=0,look=0,cargo=null,badge=blue,grip=parcelPosition,walkPhase=t,walkAmount=1}={}) {
    const step=walking?Math.sin(walkPhase*10)*walkAmount:0, bob=0;
    const root=chain(move(x,y+.055+bob,z),rotate('y',heading),scale(1.25));
    const part=(geometry,position,size,color=white,gloss=24)=>add(geometry,chain(root,move(...position),scale(...size)),color,gloss);
    add(suitMesh,root,white,18,{pose:[step,0,0],bones:[...armBones(-1,step,carrying,shrug,grip),...armBones(1,step,carrying,shrug,grip)].map(packBone)});
    part(equipment,[0,.273,-.124],[.099,.116,.042],suitTrim);
    part(equipment,[0,.278,-.151],[.086,.101,.030]);
    // A compact panel follows the suit's front rather than floating above it.
    part(equipment,[0,.268,.100],[.076,.060,.016],suitTrim);
    part(equipment,[0,.272,.115],[.066,.050,.009]);
    part(sphere,[-.032,.281,.127],[.018,.018,.008],blueDark);
    part(equipment,[.025,.287,.127],[.018,.009,.004],badge);
    part(sphere,[.030,.249,.127],[.009,.009,.005],gold);
    add(thinHoop,chain(root,move(0,.375,0),rotate('x',Math.PI/2),scale(.146,.123,.44)),suitTrim);
    // Smaller head movements keep the collar connected during a glance.
    const head=chain(root,move(0,.555,0),rotate('y',-heading*.18+look*.15),rotate('z',Math.sin(t*1.4)*.025));
    const face=(geometry,position,size,color,gloss=30)=>add(geometry===sphere?characterSphere:geometry,chain(head,move(...position),scale(...size)),color,gloss);
    face(helmetShell,[0,0,0],[.233,.224,.219],white,48);
    face(helmetShell,[0,0,0],[.224,.215,.210],lining);
    face(thinHoop,[0,0,.118],[.198,.190,.32],suitTrim,48);
    face(thinHoop,[0,0,.121],[.190,.182,.22],lining);
    // The entire head, including the eyes, is inside the shell and glass dome.
    face(sphere,[0,-.020,-.012],[.151,.145,.120],peach,18);
    for(const s of [-1,1]) {
      face(sphere,[s*.054+look*.006,-.014,.102],[.013,.017,.007],ink,12);
      face(sphere,[s*.091,-.047,.081],[.025,.013,.004],[.95,.53,.43],12);
      const socket=chain(head,move(s*.227,-.025,-.025),rotate('z',s*-Math.PI/2));
      add(cylinder,chain(socket,scale(.055,.013,.055)),suitTrim);
      add(cylinder,chain(socket,move(0,.012,0),scale(.045,.014,.045)),white);
    }
    face(sphere,[0,-.056,.106],[.015,.004,.003],[.56,.31,.25],12);
    face(helmetGlass,[0,0,0],[.233,.224,.219],[.7,.86,.96],100);
    objects[objects.length-1].glass=true;
    if(cargo) {
      const geometry=cargo==='cube'?roundedBox(.22,.22,.22):cargo==='puck'?cylinder:sphere;
      const size=cargo==='cube'?[1,1,1]:cargo==='puck'?[.13,.08,.13]:[.13,.13,.13];
      part(geometry,parcelPosition,size,blue,38);
    }
    // World-space grip position lets loading/unloading meet the worker's hands.
    return [x+Math.sin(heading)*grip[2]*1.25,y+.055+bob+grip[1]*1.25,z+Math.cos(heading)*grip[2]*1.25];
  }

  // A new batch starts every 20 seconds; three stages work concurrently.
  // Tracks share one clock and explicitly turn before walking. Products use
  // the same sampled hands as the rig, never independent courier trajectories.
  const batchSeconds=20, warmup=60;
  const between=(v,a,b)=>v>=a&&v<b;
  const mod=(v,n)=>((v%n)+n)%n;
  const mixPoint=(a,b,u)=>a.map((v,i)=>v+(b[i]-v)*ease(u));
  const angleDelta=(a,b)=>Math.atan2(Math.sin(b-a),Math.cos(b-a));
  const carryGrip=[0,.44,.16];
  const gripAt=(y,reach=.25)=>[0,(y-.055)/1.25,reach/1.25];
  function track(home,heading) {
    let p=home,h=heading;
    const spans=[];
    const api={
      turn(start,end,target) {
        spans.push({start,end,a:p,b:p,h0:h,h1:h+angleDelta(h,target)});
        h+=angleDelta(h,target);return api;
      },
      walk(start,end,target) {
        const direction=Math.atan2(target[0]-p[0],target[1]-p[1]);
        const turnTime=Math.abs(angleDelta(h,direction))>.01?.35:0;
        if(turnTime)api.turn(start,start+turnTime,direction);
        spans.push({start:start+turnTime,end,a:p,b:target,h0:h,h1:h});p=target;return api;
      },
      sample(q) {
        let pos=home,yaw=heading,distance=0;
        for(const v of spans) {
          if(q<v.start)break;
          const u=Math.min(1,(q-v.start)/(v.end-v.start));
          pos=mixPoint(v.a,v.b,u);yaw=v.h0+(v.h1-v.h0)*ease(u);
          const length=Math.hypot(v.b[0]-v.a[0],v.b[1]-v.a[1]);
          distance+=length*ease(u);
          if(q<v.end)return {p:pos,heading:yaw,walking:length>0,walkPhase:distance,turning:Math.abs(v.h1-v.h0)>.01,
            speed:length*6*u*(1-u)/(v.end-v.start),direction:length?Math.atan2(v.b[0]-v.a[0],v.b[1]-v.a[1]):yaw};
        }
        return {p:pos,heading:yaw,walking:false,walkPhase:distance,speed:0,direction:yaw};
      }
    };return api;
  }
  const loaderTrack=track([-.85,1.70],Math.PI)
    .walk(1.5,2.5,[-.85,2.05]).walk(2.5,4.1,[.05,2.05])
    .walk(4.1,4.85,[.05,2.00])
    .walk(6.3,7,[.05,2.05]).walk(7,8.5,[-.85,2.05])
    .walk(8.5,9.5,[-.85,1.70]);
  const transferTrack=track([3.45,2.10],Math.PI)
    .walk(17.5,19.5,[4.20,2.10]).walk(19.5,22,[4.95,.40])
    .walk(22,24,[3.65,.40]).walk(24,24.9,[3.65,.35])
    .walk(27.3,28.2,[3.65,.40]).walk(28.2,30,[4.95,.40])
    .walk(30,32.5,[4.20,2.10]).walk(32.5,34.5,[3.45,2.10]).turn(34.5,34.85,Math.PI);
  const inspectorTrack=track([5.70,.85],Math.PI)
    .walk(35.5,37.8,[5.70,2.30]).turn(37.8,38.1,0)
    .walk(40.8,42,[5.05,2.30]).walk(42,43.4,[5.05,2.95]).turn(43.4,43.75,0)
    .walk(45,46,[5.70,2.95]).walk(46,47,[6.35,3.20]).walk(47,49,[6.35,.85])
    .walk(49,50.2,[5.70,.85]).turn(50.2,50.55,Math.PI);
  const dispatchTrack=track([3.47,3.80],Math.PI/2)
    .walk(40,41,[3.47,4.45]).walk(41,43,[5.05,4.45])
    .walk(43,44.5,[5.05,3.45]).turn(44.5,44.85,Math.PI)
    .walk(46,46.8,[5.60,3.45]).walk(46.8,47.5,[5.60,2.90])
    .walk(47.5,48.7,[3.64,2.90]).walk(48.7,49.6,[3.64,3.80]).turn(49.6,49.95,Math.PI/2)
    .walk(50.6,51.3,[3.47,3.80]).turn(51.3,51.65,Math.PI/2)
    .walk(51.65,53.7,[6.72,3.80])
    .walk(54,55.5,[7.88,3.80]).turn(55.5,56,-Math.PI/2)
    .walk(56,59.5,[4.63,3.80]).walk(59.5,60.4,[4.55,3.30])
    .walk(60.4,61.8,[3.47,3.30]).walk(61.8,62.8,[3.47,3.80]).turn(62.8,63.15,Math.PI/2);
  const recyclerTrack=track([-.65,3.70],Math.PI)
    .walk(40,42,[5.05,4.55]).walk(42,44.5,[5.05,3.45]).turn(44.5,44.85,Math.PI)
    .walk(46,47.2,[5.05,4.55]).walk(47.2,51,[-.65,4.55])
    .walk(51,52.5,[-.65,3.70]).turn(52.5,52.85,Math.PI)
    .walk(56.5,58,[-2.15,3.70]).walk(58,61,[-2.15,.95])
    .walk(61,62.2,[-.85,.95]).turn(62.2,62.55,0)
    .walk(64,65,[-2.15,.95]).walk(65,68,[-2.15,3.70])
    .walk(68,69.5,[-.65,3.70]).turn(69.5,69.85,Math.PI);
  const later=(path,delay)=>({sample:q=>path.sample(q-delay)});
  function gripKeys(q,keys) {
    let result=keys[0][1];
    for(let i=1;i<keys.length;i++) {
      if(q<keys[i][0])return mixPoint(result,keys[i][1],(q-keys[i-1][0])/(keys[i][0]-keys[i-1][0]));
      result=keys[i][1];
    }return result;
  }
  function handOf(a) {
    return [a.p[0]+Math.sin(a.heading)*a.grip[2]*1.25,.055+a.grip[1]*1.25,a.p[1]+Math.cos(a.heading)*a.grip[2]*1.25];
  }
  function worker(name,path,q,grip,holding,badge) {
    const a={name,q,...path.sample(q),grip,holding,badge};a.hand=handOf(a);return a;
  }
  function production(t) {
    const clock=Math.max(0,t)+warmup;
    return {batch:Math.floor(clock/batchSeconds),phase:mod(clock,batchSeconds),clock};
  }
  function sampleFactory(t) {
    const {clock}=production(t), local=start=>start+mod(clock-start,20);
    const l=local(0),tr=local(16),ins=local(34),d=42+mod(clock-42,40),r=42+mod(clock-62,40);
    const loader=worker('loader',loaderTrack,l,gripKeys(l,[[0,gripAt(.43)],[1,gripAt(.43)],[1.5,carryGrip],[4.85,carryGrip],[5.6,gripAt(.595)],[6.1,gripAt(.595)],[6.3,carryGrip]]),between(l,0,6.3),gold);
    const transfer=worker('transfer',transferTrack,tr,gripKeys(tr,[[16,gripAt(.5105,.25)],[16.6,gripAt(.5105,.25)],[17.5,carryGrip],[24.9,carryGrip],[25.8,gripAt(.60,.25)],[26.6,gripAt(.60,.25)],[27.3,carryGrip]]),between(tr,16,27.3),muted);
    const inspector=worker('inspector',inspectorTrack,ins,gripKeys(ins,[[34,gripAt(.60)],[34.8,gripAt(.60)],[35.5,carryGrip],[37.8,carryGrip],[38.5,gripAt(.60)],[40,gripAt(.60)],[40.8,carryGrip],[43.75,carryGrip],[44.5,gripAt(.60)],[45,carryGrip]]),between(ins,34,38.5)||between(ins,40,45),blue);
    const dispatcher=worker('dispatch',later(dispatchTrack,2),d,gripKeys(d-2,[[43,carryGrip],[44.85,gripAt(.60)],[45.5,gripAt(.60)],[46,carryGrip],[49.95,carryGrip],[50.4,gripAt(.565)],[50.6,gripAt(.565)],[51.65,gripAt(.52,.25)],[54,gripAt(.52,.25)],[56.5,gripAt(.52,.25)],[61,gripAt(.52,.25)],[62,carryGrip]]),(between(d,46.85,52.6)||between(d,53.65,55.7)||between(d,58.35,61.5)),[.35,.78,.53]);
    const recycler=worker('recycler',later(recyclerTrack,2),r,gripKeys(r-2,[[40,carryGrip],[44.85,gripAt(.60)],[45.5,gripAt(.60)],[46,carryGrip],[52.85,carryGrip],[53.5,gripAt(.595)],[55,gripAt(.595)],[56,gripAt(.58)],[56.5,carryGrip],[62.55,carryGrip],[63.2,gripAt(.43)],[63.8,gripAt(.43)],[64,carryGrip]]),between(r,46.85,56)||between(r,57,66),red);
    const stationary=(name,p,heading,q,active,badge)=>worker(name,track(p,heading),q,gripAt(.55),active,badge);
    const agents=[loader,stationary('press',[.90,2.33],Math.PI,local(10),between(local(10),10,16),red),transfer,
      stationary('chamber',[4.80,-1.80],0,local(28),between(local(28),28,36),gold),inspector,dispatcher,recycler];
    const goods=[];
    const push=(id,kind,p,extra={})=>goods.push({id,kind,p,...extra});
    const slide=(a,b,q,start,end)=>mixPoint(a,b,(q-start)/(end-start));
    for(let id=Math.floor((clock-80)/20);id<=Math.floor(clock/20);id++) {
      const q=clock-id*20,reject=mod(id,2)===1;
      if(q<0||q>=80)continue;
      if(q<1)push(id,'cube',slide([-.85,.43,1.45],loader.hand,q,0,1));
      else if(q<5.6)push(id,'cube',loader.hand);
      else if(q<6)push(id,'cube',[.05,.595,1.75]);
      else if(q<7)push(id,'cube',slide([.05,.595,1.75],[.05,.595,1.25],q,6,7));
      else if(q<10)push(id,'cube',slide([.05,.595,1.25],[1.875,.595,1.25],q,7,10));
      else if(q<13) {
        const flat=ease((q-11.2)/.9);push(id,'cube',[1.875,.465+.13*(1-flat*.65),1.25],{flat});
      } else if(q<15)push(id,'cube',slide([1.875,.5105,1.25],[3.45,.5105,1.25],q,13,15),{flat:1});
      else if(q<16)push(id,'cube',slide([3.45,.5105,1.25],[3.45,.5105,1.85],q,15,16),{flat:1});
      else if(q<16.6)push(id,'cube',slide([3.45,.5105,1.85],transfer.hand,q,16,16.6),{flat:1});
      else if(q<25.8)push(id,'cube',transfer.hand,{flat:1});
      else if(q<26.6)push(id,'cube',slide([3.65,.60,.10],[3.65,.60,-.45],q,25.8,26.6),{flat:1});
      else if(q<28)push(id,'cube',slide([3.65,.60,-.45],[3.65,.5005,-.45],q,26.6,27.2),{flat:1});
      else if(q<32)push(id,'forming',[3.65,.455+.0455+.0995*ease((q-28.5)/3),-.45],{form:ease((q-28.5)/3),reject});
      else if(q<32.6)push(id,'sphere',slide([3.65,.60,-.45],[4.6,.60,-.60],q,32,32.6),{reject});
      else if(q<33.2)push(id,'sphere',slide([4.6,.60,-.60],[5.7,.60,-.60],q,32.6,33.2),{reject});
      else if(q<34)push(id,'sphere',slide([5.7,.60,-.60],[5.7,.60,.60],q,33.2,34),{reject});
      else if(q<34.8)push(id,'sphere',slide([5.7,.60,.60],inspector.hand,q,34,34.8),{reject});
      else if(q<38.5)push(id,'sphere',inspector.hand,{reject});
      else if(q<40)push(id,'sphere',[5.7,.60,2.55],{reject,spin:(q-38.5)*3});
      else if(q<40.8)push(id,'sphere',inspector.hand,{reject});
      else if(q<44.5)push(id,'sphere',inspector.hand,{reject});
      else if(q<47.5)push(id,'sphere',slide([5.05,.60,3.2],reject?recycler.hand:dispatcher.hand,q,46.85,47.5),{reject});
      else if(!reject) {
        if(q<52.4)push(id,'sphere',dispatcher.hand);
        else if(q<58)push(id,'sphere',[cartPosition(d)-.16,.565,3.80]);
      } else {
        if(q<55.5)push(id,'sphere',recycler.hand,{reject});
        else if(q<56)push(id,'sphere',slide([-.65,.595,3.45],[-.65,.595,3.05],q,55.5,56),{reject});
        else if(q<57) {const form=ease((q-56)/.8);push(id,'rework',[-.65,.595-.015*form,3.05],{form});}
        else if(q<58)push(id,'cube',slide([-.65,.58,3.05],recycler.hand,q,57,58));
        else if(q<65.2)push(id,'cube',recycler.hand);
        else if(q<66)push(id,'cube',[-.85,.43,1.20]);
        else push(id,'cube',slide([-.85,.43,1.20],[-.85,.43,1.45],q,66,67));
      }
    }
    return {clock,agents,goods,pressQ:local(10),transferQ:tr,chamberQ:local(28),inspectorQ:ins,dispatchQ:d,recyclerQ:r};
  }
  function cartPosition(q) {
    q-=2;
    if(q<51.65)return 4.05;
    if(q<53.7)return 4.05+3.25*ease((q-51.65)/(53.7-51.65));
    if(q<56)return 7.30;
    if(q<59.5)return 7.30-3.25*ease((q-56)/(59.5-56));
    return 4.05;
  }
  const formingGeometry=mesh((u,v)=>{
    const a=u*TAU,b=v*Math.PI,n=[Math.cos(a)*Math.sin(b),Math.cos(b),Math.sin(a)*Math.sin(b)];
    const p=n.map(x=>Math.sign(x)*Math.pow(Math.abs(x),.18));
    const normal=unit(p.map(x=>Math.sign(x)*Math.pow(Math.abs(x),2/.18-1)));
    return [...p,...normal];
  },36,24);
  function item(g) {
    if(g.kind==='rework') {
      add(formingGeometry,chain(move(...g.p),scale(.11+.02*g.form,.145-.015*g.form,.175-.045*g.form)),blue,38,{rounding:1-g.form});return;
    }
    if(g.kind==='cube')add(roundedBox(.26,.26,.26),chain(move(...g.p),scale(1+(g.flat||0)*.30,1-(g.flat||0)*.65,1+(g.flat||0)*.30)),blue);
    else if(g.kind==='forming')add(formingGeometry,chain(move(...g.p),scale(.169-.024*g.form,.0455+.0995*g.form,.169-.024*g.form)),blue,38,{rounding:g.form});
    else add(sphere,chain(move(...g.p),rotate('y',g.spin||0),scale(g.reject?.11:.145,.145,g.reject?.175:.145)),blue);
  }
  function trolley(x,z) {
    box(x,.38,z,.45,.08,.46);
    for(const dx of [-.10,.10])for(const dz of [-.16,.16])
      add(cylinder,chain(move(x+dx,.10,z+dz),rotate('x',Math.PI/2),scale(.085,.055,.085)),blueDark);
    // Handles on both ends allow the worker to walk facing the return direction.
    for(const dx of [-.10,.10])for(const dz of [-.16,.16])pipe([x+dx,.10,z+dz],[x+dx,.38,z+dz],.018,muted);
    for(const side of [-1,1]) {
      for(const dz of [-.19,.19])pipe([x+side*.33,.20,z+dz],[x+side*.33,.52,z+dz],.025);
      pipe([x+side*.33,.52,z-.19],[x+side*.33,.52,z+.19],.025);
    }
  }
  function scene(t) {
    objects=fixedObjects.slice();
    const state=sampleFactory(t),q=state.pressQ;
    const approach=ease((q-10)/1.2),squeeze=ease((q-11.2)/.9),release=ease((q-12.2)/.8);
    const bottom=1.68-(.955*approach+.169*squeeze)*(1-release);
    box(1.875,bottom+.09,1.27,.74,.18,.60);
    pipe([1.875,2.32,1.27],[1.875,bottom+.14,1.27],.070,gold);
    ball(.90,.55,2.08,.042,between(q,10,13)?gold:muted);
    // The front hatch is open for insertion; spheres leave through the side port.
    const aperture=mod(state.clock-24,20);
    const open=ease(aperture/.7)*(1-ease((aperture-3.8)/.7));
    box(3.65,.65+open*.90,.10,.82,.70,.045,blueDark);
    for(let i=0;i<4;i++)ball(4.80,.40+i*.055,-1.48,.020,state.chamberQ>=28+i&&state.chamberQ<34?gold:muted);
    const inspectionBusy=between(state.inspectorQ,38.5,40);
    const inspected=state.goods.find(g=>g.spin!==undefined);
    ball(5.90,.46,2.55,.032,inspectionBusy?(inspected?.reject?red:[.35,.78,.53]):muted);
    if(between(state.recyclerQ,56,57.5)) {
      const contact=.74-.03*ease((state.recyclerQ-56)/.8);
      const bottom=.82-(.82-contact)*ease((state.recyclerQ-56)/.2)*(1-ease((state.recyclerQ-57)/.5));
      box(-.65,bottom+.06,3.05,.50,.12,.40);
      ball(-.65,.52,3.47,.028,gold);
    }
    trolley(cartPosition(state.dispatchQ),3.80);
    for(const a of state.agents)astronaut(...a.p,t,{heading:a.heading,walking:a.walking,walkPhase:a.walkPhase,walkAmount:Math.min(1,a.speed/.4),carrying:a.holding,grip:a.grip,badge:a.badge});
    for(const g of state.goods)item(g);
  }
  let main, depthPass, shadowBuffer, shadowTexture;
  try {
    main=program(vertex,fragment); depthPass=program(vertex,depthFragment);
    shadowTexture=gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D,shadowTexture);
    gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,2048,2048,0,gl.RGBA,gl.UNSIGNED_BYTE,null);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
    shadowBuffer=gl.createFramebuffer(); gl.bindFramebuffer(gl.FRAMEBUFFER,shadowBuffer);
    gl.framebufferTexture2D(gl.FRAMEBUFFER,gl.COLOR_ATTACHMENT0,gl.TEXTURE_2D,shadowTexture,0);
    const depth=gl.createRenderbuffer(); gl.bindRenderbuffer(gl.RENDERBUFFER,depth);
    gl.renderbufferStorage(gl.RENDERBUFFER,gl.DEPTH_COMPONENT16,2048,2048);
    gl.framebufferRenderbuffer(gl.FRAMEBUFFER,gl.DEPTH_ATTACHMENT,gl.RENDERBUFFER,depth);
    if(gl.checkFramebufferStatus(gl.FRAMEBUFFER)!==gl.FRAMEBUFFER_COMPLETE) throw Error('Shadow buffer unavailable');
  } catch(error) { console.warn('Sculpture fallback:',error); return; }

  const lightVP=chain(ortho(18,18,.1,40),lookAt([-4,10,7],[0,1,0]));
  const camera=[5.2,6.8,7.7];
  const cameraRadius=Math.hypot(camera[0],camera[1]-1.55,camera[2]);
  const homeYaw=Math.atan2(camera[0],camera[2]);
  const homePitch=Math.atan2(camera[1]-1.55,Math.hypot(camera[0],camera[2]));
  const aim={x:0,y:0}, tilt={x:0,y:0};
  // Temporary model inspection; independent of the normal cursor camera.
  const inspection={active:false,zoom:1,pan:[0,0,0],drag:null};
  let viewFrame=null;
  function cameraMoving() { return Math.abs(aim.x-tilt.x)+Math.abs(aim.y-tilt.y)>.0001; }
  function updateCamera(dt) {
    const ease=1-Math.exp(-7*dt);
    tilt.x+=(aim.x-tilt.x)*ease;
    tilt.y+=(aim.y-tilt.y)*ease;
    if(!cameraMoving()) { tilt.x=aim.x; tilt.y=aim.y; }
    const yaw=homeYaw+tilt.x*.24, pitch=homePitch-tilt.y*.13;
    camera[0]=cameraRadius*Math.cos(pitch)*Math.sin(yaw);
    camera[1]=1.55+cameraRadius*Math.sin(pitch);
    camera[2]=cameraRadius*Math.cos(pitch)*Math.cos(yaw);
  }
  let width=1,height=1;
  function drawPass(shader,vp,shadow,eye=camera) {
    gl.useProgram(shader.p);
    gl.uniformMatrix4fv(shader.uniforms.viewProjection,false,vp);
    gl.uniformMatrix4fv(shader.uniforms.lightProjection,false,lightVP);
    gl.uniform3fv(shader.uniforms.eye,eye);
    gl.uniform1i(shader.uniforms.shadowMap,0);
    const distance=o=>Math.hypot(o.model[12]-eye[0],o.model[13]-eye[1],o.model[14]-eye[2]);
    const ordered=shadow?objects:objects.filter(o=>!o.glass).concat(objects.filter(o=>o.glass).sort((a,b)=>distance(b)-distance(a)));
    for(const o of ordered) {
      if(shadow && (o.mesh===floor||o.glass)) continue;
      gl.depthMask(!o.glass);
      gl.bindBuffer(gl.ARRAY_BUFFER,o.mesh.buffer);
      gl.enableVertexAttribArray(shader.position);
      const stride=o.mesh.stride||24;
      gl.vertexAttribPointer(shader.position,3,gl.FLOAT,false,stride,0);
      if(shader.normal>=0) { gl.enableVertexAttribArray(shader.normal); gl.vertexAttribPointer(shader.normal,3,gl.FLOAT,false,stride,12); }
      if(shader.skin>=0) {
        if(o.bones) {
          gl.enableVertexAttribArray(shader.skin); gl.vertexAttribPointer(shader.skin,3,gl.FLOAT,false,stride,24);
          ['leftUpper','leftLower','leftHand','rightUpper','rightLower','rightHand'].forEach((name,i)=>gl.uniformMatrix4fv(shader.uniforms[name],false,o.bones[i]));
        } else { gl.disableVertexAttribArray(shader.skin); gl.vertexAttrib3f(shader.skin,0,0,0); }
      }
      gl.uniformMatrix4fv(shader.uniforms.model,false,o.model);
      gl.uniform3fv(shader.uniforms.suitPose,o.pose||[0,0,0]);
      gl.uniform1f(shader.uniforms.rounding,o.rounding||0);
      if(!shadow)gl.uniformMatrix3fv(shader.uniforms.normalMatrix,false,normals(o.model));
      gl.uniform3fv(shader.uniforms.color,o.color);
      gl.uniform1f(shader.uniforms.gloss,o.gloss);
      gl.uniform1f(shader.uniforms.ground,o.mesh===floor?1:0);
      gl.uniform1f(shader.uniforms.glass,o.glass?1:0);
      gl.uniform1f(shader.uniforms.suit,o.mesh===suitMesh?1:0);
      gl.drawArrays(gl.TRIANGLES,0,o.mesh.count);
    }
    gl.depthMask(true);
  }
  function render(t) {
    scene(t);
    gl.enable(gl.DEPTH_TEST);
    gl.disable(gl.BLEND);
    gl.bindFramebuffer(gl.FRAMEBUFFER,shadowBuffer); gl.viewport(0,0,2048,2048);
    gl.clearColor(1,1,1,1); gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);
    gl.enable(gl.POLYGON_OFFSET_FILL); gl.polygonOffset(1.5,2);
    drawPass(depthPass,lightVP,true);
    gl.disable(gl.POLYGON_OFFSET_FILL);
    gl.bindFramebuffer(gl.FRAMEBUFFER,null); gl.viewport(0,0,width,height);
    gl.clearColor(0,0,0,0); gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);
    gl.enable(gl.BLEND);
    gl.blendFuncSeparate(gl.SRC_ALPHA,gl.ONE_MINUS_SRC_ALPHA,gl.ONE,gl.ONE_MINUS_SRC_ALPHA);
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D,shadowTexture);
    const mobile=host.clientWidth<=720;
    const viewHeight=(mobile?Math.max(7.0,7.5*height/width):Math.max(7.3,12.6*height/width))/inspection.zoom;
    // On phones, reframe the working half of the factory beneath the text.
    const baseTarget=mobile?[2.20*Math.cos(homeYaw),1.1,-2.20*Math.sin(homeYaw)]:[0,1.1,0];
    const baseEye=mobile?[camera[0]+baseTarget[0],camera[1],camera[2]+baseTarget[2]]:camera;
    const target=baseTarget.map((v,i)=>v+inspection.pan[i]);
    const eye=baseEye.map((v,i)=>v+inspection.pan[i]);
    const forward=unit(sub(eye,target)), right=unit(cross([0,1,0],forward));
    viewFrame={viewHeight,right,up:cross(forward,right)};
    drawPass(main,chain(ortho(viewHeight*width/height,viewHeight,.1,40),lookAt(eye,target)),false,eye);
  }
  const reduced=window.matchMedia('(prefers-reduced-motion: reduce)');
  let paused=reduced.matches, visible=true, lost=false, time=0, last=0, raf=0;
  function tick(now) {
    raf=0;
    if(!visible||document.hidden||lost||(paused&&!cameraMoving())) { last=0; return; }
    const elapsed=last?(now-last)/1000:1/60;
    const dt=Math.min(elapsed,.06);
    if(!paused&&last) time+=dt;
    updateCamera(elapsed);
    last=now; render(time);
    if(!paused||cameraMoving()) raf=requestAnimationFrame(tick);
    else last=0;
  }
  function resume() { if(!raf) { last=0; raf=requestAnimationFrame(tick); } }
  const hero=host.closest('.hero');
  function resetAim() { aim.x=0; aim.y=0; resume(); }
  hero.addEventListener('pointermove',event=>{
    if(inspection.active||reduced.matches||event.pointerType==='touch') return;
    const x=Math.max(-1,Math.min(1,(event.clientX/window.innerWidth-.75)*2));
    const y=Math.max(-1,Math.min(1,event.clientY/window.innerHeight*2-1));
    // Radial easing around the right half's center (75% across, 50% down).
    // Keep the same maximum orbit without reversing direction at the perimeter.
    const radius=Math.hypot(x,y);
    const gain=radius>0?Math.atan(2*radius)/(radius*Math.atan(2)):2/Math.atan(2);
    aim.x=x*gain;
    aim.y=y*gain;
    resume();
  });
  hero.addEventListener('pointerleave',resetAim);
  hero.addEventListener('pointercancel',resetAim);
  window.addEventListener('blur',resetAim);
  function updateButton() {
    button.setAttribute('aria-label',paused?'Play factory animation':'Pause factory animation');
    button.setAttribute('aria-pressed',String(paused));
    button.dataset.paused=String(paused);
  }
  button.addEventListener('click',()=>{ paused=!paused; updateButton(); resume(); });
  const inspector=host.querySelector('.sculpture-inspector');
  function endDrag() {
    if(inspection.drag && canvas.hasPointerCapture(inspection.drag.id))canvas.releasePointerCapture(inspection.drag.id);
    inspection.drag=null;
    host.classList.remove('is-dragging');
  }
  function setInspection(active) {
    endDrag();
    inspection.active=active; inspection.zoom=1; inspection.pan=[0,0,0];
    aim.x=aim.y=tilt.x=tilt.y=0; updateCamera(0);
    host.classList.toggle('is-inspecting',active);
    if(inspector) {
      inspector.querySelector('.sculpture-inspector-tools').hidden=!active;
      const toggle=inspector.querySelector('[data-inspect="toggle"]');
      toggle.textContent=active?'Exit inspection':'Inspect models';
      toggle.setAttribute('aria-pressed',String(active));
      if(active) { canvas.tabIndex=0; canvas.focus({preventScroll:true}); }
      else { canvas.removeAttribute('tabindex'); toggle.focus({preventScroll:true}); }
    }
    if(!lost)render(time);
  }
  function zoomAt(factor,clientX,clientY) {
    if(!inspection.active||!viewFrame)return;
    const bounds=canvas.getBoundingClientRect(), old=inspection.zoom;
    inspection.zoom=Math.max(1,Math.min(12,old*factor));
    const x=clientX==null?0:(clientX-bounds.left)/bounds.width-.5;
    const y=clientY==null?0:.5-(clientY-bounds.top)/bounds.height;
    const delta=viewFrame.viewHeight*(1-old/inspection.zoom);
    inspection.pan=inspection.pan.map((v,i)=>v+delta*(x*bounds.width/bounds.height*viewFrame.right[i]+y*viewFrame.up[i]));
    render(time);
  }
  if(inspector) {
    inspector.hidden=false;
    inspector.addEventListener('click',event=>{
      const action=event.target.closest('button')?.dataset.inspect;
      if(action==='toggle')setInspection(!inspection.active);
      if(action==='in')zoomAt(1.4);
      if(action==='out')zoomAt(1/1.4);
      if(action==='reset') { inspection.zoom=1; inspection.pan=[0,0,0]; render(time); }
    });
  }
  canvas.addEventListener('wheel',event=>{
    if(!inspection.active)return;
    event.preventDefault();
    const pixels=event.deltaY*(event.deltaMode===1?16:event.deltaMode===2?canvas.clientHeight:1);
    zoomAt(Math.exp(-Math.max(-300,Math.min(300,pixels))*.0025),event.clientX,event.clientY);
  },{passive:false});
  canvas.addEventListener('pointerdown',event=>{
    if(!inspection.active||event.button!==0||inspection.drag)return;
    event.preventDefault(); canvas.focus({preventScroll:true});
    inspection.drag={id:event.pointerId,x:event.clientX,y:event.clientY};
    canvas.setPointerCapture(event.pointerId); host.classList.add('is-dragging');
  });
  canvas.addEventListener('pointermove',event=>{
    const drag=inspection.drag;
    if(!drag||drag.id!==event.pointerId||!viewFrame)return;
    const dx=event.clientX-drag.x,dy=event.clientY-drag.y;
    const units=viewFrame.viewHeight/canvas.clientHeight;
    inspection.pan=inspection.pan.map((v,i)=>v+units*(-dx*viewFrame.right[i]+dy*viewFrame.up[i]));
    drag.x=event.clientX; drag.y=event.clientY;
    render(time);
  });
  canvas.addEventListener('pointerup',endDrag);
  canvas.addEventListener('pointercancel',endDrag);
  canvas.addEventListener('lostpointercapture',endDrag);
  window.addEventListener('blur',endDrag);
  host.addEventListener('keydown',event=>{
    if(!inspection.active)return;
    if(event.key==='Escape') { event.preventDefault(); setInspection(false); return; }
    if(event.target!==canvas)return;
    if(['+','=','-','0','ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(event.key))event.preventDefault();
    if(event.key==='+'||event.key==='=')zoomAt(1.4);
    if(event.key==='-')zoomAt(1/1.4);
    if(event.key==='0') { inspection.zoom=1; inspection.pan=[0,0,0]; render(time); }
    const dx=event.key==='ArrowLeft'?-1:event.key==='ArrowRight'?1:0;
    const dy=event.key==='ArrowUp'?1:event.key==='ArrowDown'?-1:0;
    if(dx||dy) {
      inspection.pan=inspection.pan.map((v,i)=>v+viewFrame.viewHeight*.08*(dx*viewFrame.right[i]+dy*viewFrame.up[i]));
      render(time);
    }
  });
  reduced.addEventListener('change',()=>{
    paused=reduced.matches;
    if(reduced.matches) {
      aim.x=aim.y=tilt.x=tilt.y=0;
      updateCamera(0); render(time);
    }
    updateButton(); resume();
  });
  document.addEventListener('visibilitychange',resume);
  new IntersectionObserver(entries=>{ visible=entries[0].isIntersecting; resume(); },{threshold:0}).observe(host);
  new ResizeObserver(()=>{
    const dpr=Math.min(window.devicePixelRatio||1,1.5);
    width=canvas.width=Math.round(host.clientWidth*dpr);
    height=canvas.height=Math.round(host.clientHeight*dpr);
    render(time);
  }).observe(host);
  canvas.addEventListener('webglcontextlost',event=>{
    event.preventDefault(); lost=true; cancelAnimationFrame(raf); raf=0;
    if(inspection.active)setInspection(false);
    if(inspector)inspector.hidden=true;
    host.classList.remove('is-rendered'); button.hidden=true;
  });
  updateButton(); render(0);
  host.classList.add('is-rendered'); button.hidden=false; resume();
  // Deterministic frames for visual review, without waiting through the loop.
  window.kineticSculpture={render,quarter,production,sample:sampleFactory,layout:fixedObjects.filter(o=>o.bounds).map(o=>o.bounds)};
})();
