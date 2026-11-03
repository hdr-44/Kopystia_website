// Parametric placeholder hat (units: cm). Shapes come from src/content/configurator.json,
// so options can change without touching this code; swap buildHat for GLB parts once real assets exist.
type Opt = { id: string; label: string; [k: string]: unknown };
type Config = { groups: { id: string; label: string; options: Opt[] }[] };

const HEAD_RADIUS = 9.2; // ~58 cm circumference
const OVAL = 1.15; // heads are longer front-to-back

export function selection(config: Config, form: HTMLFormElement) {
  const data = new FormData(form);
  return Object.fromEntries(config.groups.map((g) => [g.id, g.options.find((o) => o.id === data.get(g.id)) ?? g.options[0]]));
}

export function summary(config: Config, sel: Record<string, Opt>) {
  return config.groups.map((g) => `${g.label}: ${sel[g.id].label}`).join('; ');
}

export async function initConfigurator() {
  const config: Config = JSON.parse(document.getElementById('cfg-data')!.textContent!);
  const form = document.getElementById('cfg-options') as HTMLFormElement;
  const summaryEl = document.getElementById('cfg-summary')!;
  const itemInput = document.querySelector<HTMLInputElement>('#form-configurator [data-item]')!;
  const canvas = document.getElementById('hat-canvas') as HTMLCanvasElement;

  const updateText = () => {
    const s = summary(config, selection(config, form));
    summaryEl.textContent = s;
    itemInput.value = s;
  };
  updateText();
  form.addEventListener('change', updateText);

  let THREE: typeof import('three'), OrbitControls: typeof import('three/addons/controls/OrbitControls.js').OrbitControls;
  let renderer: import('three').WebGLRenderer;
  try {
    THREE = await import('three');
    ({ OrbitControls } = await import('three/addons/controls/OrbitControls.js'));
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  } catch (e) {
    console.warn('3D unavailable', e);
    canvas.hidden = true;
    document.getElementById('cfg-busy')?.remove();
    canvas.parentElement!.querySelector<HTMLElement>('.fallback')!.hidden = false;
    return;
  }

  const coarse = matchMedia('(pointer: coarse)').matches;
  renderer.toneMapping = THREE.ACESFilmicToneMapping; // AgX lifted dark felt to grey
  renderer.toneMappingExposure = 0.85;
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(35, 4 / 3, 1, 500);
  camera.position.set(0, 22, 55);
  const controls = new OrbitControls(camera, canvas);
  controls.target.set(0, 5, 0);
  controls.enableDamping = true;
  controls.minDistance = 25;
  controls.maxDistance = 120;

  // Soft studio reflections.
  const { RoomEnvironment } = await import('three/addons/environments/RoomEnvironment.js');
  const envTarget = new THREE.WebGLCubeRenderTarget(256, { type: THREE.HalfFloatType });
  const room = new RoomEnvironment();
  new THREE.CubeCamera(0.1, 100, envTarget).update(renderer, room);
  room.traverse((o) => { if (o instanceof THREE.Mesh) { o.geometry.dispose(); (o.material as import('three').Material).dispose(); } });
  scene.environment = envTarget.texture;
  scene.environmentIntensity = 0.45;
  const sun = new THREE.DirectionalLight(0xfff4e0, 1.6);
  sun.position.set(20, 40, 30);
  scene.add(sun);

  // Contact shadow: a blurred dark disc, cheap on phones (no shadow maps).
  const shadowCanvas = document.createElement('canvas');
  shadowCanvas.width = shadowCanvas.height = 128;
  const sctx = shadowCanvas.getContext('2d')!;
  const grad = sctx.createRadialGradient(64, 64, 0, 64, 64, 64);
  grad.addColorStop(0, 'rgba(0,0,0,0.55)');
  grad.addColorStop(1, 'rgba(0,0,0,0)');
  sctx.fillStyle = grad;
  sctx.fillRect(0, 0, 128, 128);
  const shadow = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(shadowCanvas), transparent: true, depthWrite: false }));
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = -0.6;
  scene.add(shadow);

  const feltNormal = feltNormalMap(THREE);
  const hat = new THREE.Group();
  scene.add(hat);

  function buildHat() {
    hat.traverse((o) => { if (o instanceof THREE.Mesh) { o.geometry.dispose(); (o.material as import('three').Material).dispose(); } });
    hat.clear();
    const s = selection(config, form) as Record<string, any>;
    const color = new THREE.Color(s.color.hex);
    const felt = new THREE.MeshPhysicalMaterial({
      color, roughness: 0.95, side: THREE.DoubleSide,
      sheen: 1, sheenRoughness: 0.6, sheenColor: color.clone().lerp(new THREE.Color(0xffffff), 0.08),
      normalMap: feltNormal, normalScale: new THREE.Vector2(0.35, 0.35),
    });
    const R = HEAD_RADIUS, h = s.crown.height as number, top = s.crown.topRadius as number, pinch = s.crown.pinch as number;

    const crownProfile = [new THREE.Vector2(R, 0), new THREE.Vector2((R + top) / 2 + 0.3, h * 0.6), new THREE.Vector2(top, h), new THREE.Vector2(top * 0.6, h + 0.2 - pinch), new THREE.Vector2(0.01, h - pinch * 1.8)];
    const crown = new THREE.LatheGeometry(crownProfile, 128, Math.PI);
    shapeCrown(crown, h, s.crown);
    hat.add(new THREE.Mesh(crown, felt));

    const w = s.brim.width as number;
    const brimProfile = [new THREE.Vector2(R, -0.2), new THREE.Vector2(R + w * 0.75, -0.3), new THREE.Vector2(R + w, 0.6), new THREE.Vector2(R + w, 0.9), new THREE.Vector2(R + w * 0.75, 0.1), new THREE.Vector2(R, 0.2)];
    const brim = new THREE.LatheGeometry(brimProfile, 128, Math.PI);
    snapBrim(brim, R, w, (s.brim.snap as number) ?? 0);
    hat.add(new THREE.Mesh(brim, felt));

    if (s.band.hex) {
      const ribbon = new THREE.MeshPhysicalMaterial({ color: s.band.hex, roughness: 0.45, sheen: 0.5, sheenRoughness: 0.4, side: THREE.DoubleSide });
      const H = 3.2, slope = (crownProfile[1].x - R) / crownProfile[1].y, rBot = R + 0.18, rTop = R + slope * H + 0.18;
      // Closed ring with a little thickness instead of a paper-thin tube.
      const bandProfile = [new THREE.Vector2(rBot - 0.18, 0), new THREE.Vector2(rBot, 0), new THREE.Vector2(rTop, H), new THREE.Vector2(rTop - 0.18, H)];
      const band = new THREE.Mesh(new THREE.LatheGeometry(bandProfile, 128, Math.PI), ribbon);
      band.position.y = 0.2;
      hat.add(band);
      // Bow on the left side (−x), as on most felt hats.
      const bow = new THREE.Group();
      const loop = new THREE.TorusGeometry(0.9, 0.32, 12, 32);
      loop.scale(1, 0.75, 0.35);
      for (const dx of [-0.85, 0.85]) {
        const m = new THREE.Mesh(loop, ribbon);
        m.position.set(dx, 0, 0);
        bow.add(m);
      }
      const knot = new THREE.Mesh(new THREE.BoxGeometry(0.6, 1.3, 0.5), ribbon);
      bow.add(knot);
      const tail = new THREE.BoxGeometry(0.55, 2.2, 0.12);
      for (const [dx, rot] of [[-0.35, 0.25], [0.35, -0.25]]) {
        const t = new THREE.Mesh(tail, ribbon);
        t.position.set(dx, -1.2, 0);
        t.rotation.z = rot;
        bow.add(t);
      }
      bow.scale.setScalar(H / 3.2);
      bow.position.set(-(rBot + rTop) / 2 - 0.25, 0.2 + H / 2, 0);
      bow.rotation.y = -Math.PI / 2;
      hat.add(bow);
    }
    hat.scale.set(1, 1, OVAL);
    const d = 2 * (R + w) * 1.25;
    shadow.scale.set(d, d * OVAL, 1);
  }

  // Render on demand: only while the camera moves (incl. damping) or options change.
  let dirty = true;
  const invalidate = () => { dirty = true; };
  controls.addEventListener('change', invalidate);

  buildHat();
  form.addEventListener('change', () => { buildHat(); invalidate(); });

  new ResizeObserver(() => {
    const { clientWidth: w, clientHeight: h } = canvas;
    renderer.setPixelRatio(Math.min(devicePixelRatio, coarse ? 1.5 : 2));
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    invalidate();
  }).observe(canvas);

  document.getElementById('cfg-busy')?.remove();
  renderer.setAnimationLoop(() => {
    controls.update();
    if (!dirty) return;
    dirty = false;
    renderer.render(scene, camera);
  });
}

// Lathe seams start at phi = π so they sit at the back.
// Fedora front pinch, long top dent. Front of the hat faces +z (the camera).
function shapeCrown(geo: import('three').BufferGeometry, h: number, o: Record<string, any>) {
  const depth = (o.pinchDepth as number) ?? 0, ang = (o.pinchAngle as number) ?? 0, stretch = (o.dentStretch as number) ?? 1;
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
    const r = Math.hypot(x, z), a = Math.atan2(x, z);
    let k = 1;
    if (depth && r > 0.1) {
      // Two dents at ±ang from the front, strongest near the top.
      const f = Math.exp(-(((Math.abs(a) - ang) / 0.32) ** 2)) * Math.max(0, (y - h * 0.35) / (h * 0.65)) ** 1.5;
      k = Math.max(0.4, 1 - (depth * f) / r);
    }
    // Stretch the dent (the inner top surface) front-to-back.
    const e = y > h * 0.7 && r < (o.topRadius as number) * 0.9 ? Math.sqrt(1 + (stretch - 1) * 0.3) : 1;
    pos.setXYZ(i, (x * k) / e, y, z * k * e);
  }
  smoothNormals(geo);
}

// Recompute normals after deforming a lathe, then average the duplicated seam column so no crease shows.
function smoothNormals(geo: import('three').BufferGeometry) {
  geo.computeVertexNormals();
  const n = geo.attributes.normal, rows = (geo as any).parameters.points.length, last = n.count - rows;
  for (let j = 0; j < rows; j++) {
    const x = n.getX(j) + n.getX(last + j), y = n.getY(j) + n.getY(last + j), z = n.getZ(j) + n.getZ(last + j), l = Math.hypot(x, y, z) || 1;
    n.setXYZ(j, x / l, y / l, z / l);
    n.setXYZ(last + j, x / l, y / l, z / l);
  }
}

// Brim dips at the front and lifts at the back, growing towards the edge.
function snapBrim(geo: import('three').BufferGeometry, R: number, w: number, snap: number) {
  if (!snap) return;
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), z = pos.getZ(i);
    const t = (Math.hypot(x, z) - R) / w;
    pos.setY(i, pos.getY(i) - snap * Math.cos(Math.atan2(x, z)) * t * t);
  }
  smoothNormals(geo);
}

// shortcut: procedural fibre normal map; replace with a scanned felt swatch when the owner provides one.
function feltNormalMap(THREE: typeof import('three')) {
  const N = 256, hgt = new Float32Array(N * N);
  for (let i = 0; i < hgt.length; i++) hgt[i] = Math.random();
  const img = new ImageData(N, N);
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const at = (u: number, v: number) => hgt[((v + N) % N) * N + ((u + N) % N)];
    const dx = at(x + 1, y) - at(x - 1, y), dy = at(x, y + 1) - at(x, y - 1);
    const len = Math.hypot(dx, dy, 1), j = (y * N + x) * 4;
    img.data[j] = (-dx / len * 0.5 + 0.5) * 255;
    img.data[j + 1] = (-dy / len * 0.5 + 0.5) * 255;
    img.data[j + 2] = (1 / len * 0.5 + 0.5) * 255;
    img.data[j + 3] = 255;
  }
  const c = document.createElement('canvas');
  c.width = c.height = N;
  c.getContext('2d')!.putImageData(img, 0, 0);
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(6, 6);
  return tex;
}
