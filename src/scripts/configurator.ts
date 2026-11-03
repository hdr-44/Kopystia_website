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
    canvas.parentElement!.querySelector<HTMLElement>('.fallback')!.hidden = false;
    return;
  }

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(35, 4 / 3, 1, 500);
  camera.position.set(0, 22, 55);
  const controls = new OrbitControls(camera, canvas);
  controls.target.set(0, 5, 0);
  controls.enableDamping = true;
  controls.minDistance = 25;
  controls.maxDistance = 120;
  scene.add(new THREE.HemisphereLight(0xfff4e0, 0x504538, 2.4));
  const sun = new THREE.DirectionalLight(0xffffff, 3);
  sun.position.set(20, 40, 30);
  scene.add(sun);

  const hat = new THREE.Group();
  scene.add(hat);

  function buildHat() {
    hat.traverse((o) => { if (o instanceof THREE.Mesh) { o.geometry.dispose(); (o.material as import('three').Material).dispose(); } });
    hat.clear();
    const s = selection(config, form) as Record<string, any>;
    const felt = new THREE.MeshStandardMaterial({ color: s.color.hex, roughness: 0.9, side: THREE.DoubleSide });
    const R = HEAD_RADIUS, h = s.crown.height as number, top = s.crown.topRadius as number, pinch = s.crown.pinch as number;

    const crown = [new THREE.Vector2(R, 0), new THREE.Vector2((R + top) / 2 + 0.3, h * 0.6), new THREE.Vector2(top, h), new THREE.Vector2(top * 0.6, h + 0.2 - pinch), new THREE.Vector2(0.01, h - pinch * 1.8)];
    hat.add(new THREE.Mesh(new THREE.LatheGeometry(crown, 96), felt));

    const w = s.brim.width as number;
    const brim = [new THREE.Vector2(R, -0.2), new THREE.Vector2(R + w * 0.75, -0.3), new THREE.Vector2(R + w, 0.6), new THREE.Vector2(R + w, 0.9), new THREE.Vector2(R + w * 0.75, 0.1), new THREE.Vector2(R, 0.2)];
    hat.add(new THREE.Mesh(new THREE.LatheGeometry(brim, 96), felt));

    if (s.band.hex) {
      const bandTop = R + (top - R) * (3.2 / h) + 0.15;
      const band = new THREE.Mesh(new THREE.CylinderGeometry(bandTop, R + 0.15, 3.2, 96, 1, true), new THREE.MeshStandardMaterial({ color: s.band.hex, roughness: 0.6, side: THREE.DoubleSide }));
      band.position.y = 1.6 + 0.2;
      hat.add(band);
    }
    hat.scale.set(1, 1, OVAL);
  }
  buildHat();
  form.addEventListener('change', buildHat);

  new ResizeObserver(() => {
    const { clientWidth: w, clientHeight: h } = canvas;
    renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }).observe(canvas);

  renderer.setAnimationLoop(() => { controls.update(); renderer.render(scene, camera); });
}
