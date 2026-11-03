// Live try-on: MediaPipe Face Landmarker (runs locally in the browser) + three.js overlay.
// Nothing from the camera leaves the device.
type Hat = { id: string; label: string; src: string; width: number; yaw?: number; offset: [number, number, number]; tilt: number; credit?: string; creditUrl?: string };

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;

export function initTryOn() {
  const { hats } = JSON.parse($('tryon-data').textContent!) as { hats: Hat[] };
  const stage = $('tryon-stage'), video = $<HTMLVideoElement>('tryon-video'), canvas = $<HTMLCanvasElement>('tryon-canvas');
  const startBtn = $<HTMLButtonElement>('tryon-start'), stopBtn = $<HTMLButtonElement>('tryon-stop');
  const fit = $<HTMLFieldSetElement>('tryon-fit'), fitJson = $('tryon-fit-json');
  const fitInputs = fit.querySelectorAll<HTMLInputElement>('input[type=range]');
  const fitVal = (n: string) => Number(fit.querySelector<HTMLInputElement>(`input[name=${n}]`)!.value);
  const showFitLabels = () => fitInputs.forEach((i) => {
    const v = Number(i.value);
    i.nextElementSibling!.textContent = i.name === 'size' || i.name === 'head' ? `${Math.round(v * 100)}%` : i.name === 'tilt' || i.name === 'yaw' ? `${v}°` : `${v} см`;
  });
  const resetFit = () => { fitInputs.forEach((i) => (i.value = i.defaultValue)); showFitLabels(); };
  const debug = location.search.includes('debug');
  fitJson.hidden = !debug;
  fit.querySelectorAll<HTMLElement>('[data-debug]').forEach((el) => (el.hidden = !debug));
  const status = $('tryon-status'), loading = $('tryon-loading'), credit = $('tryon-credit');
  const itemInput = document.querySelector<HTMLInputElement>('#form-tryon [data-item]')!;
  const picker = document.querySelectorAll<HTMLInputElement>('input[name="hat"]');

  const current = () => hats.find((h) => h.id === [...picker].find((p) => p.checked)?.value) ?? hats[0];
  const showCredit = () => {
    const h = current();
    credit.innerHTML = '';
    if (h.credit) { const a = Object.assign(document.createElement('a'), { href: h.creditUrl ?? '#', textContent: h.credit, rel: 'noopener' }); credit.append('3D-модель: ', a); }
  };
  showCredit();

  if (!navigator.mediaDevices?.getUserMedia) {
    startBtn.disabled = true;
    status.textContent = 'Цей браузер не підтримує камеру (або сторінка відкрита не через HTTPS). Ви все одно можете надіслати запит нижче.';
    return;
  }

  let stream: MediaStream | null = null;
  let stopLoop = () => {};
  let session = 0; // guards against Stop pressed while still loading

  async function start() {
    const my = ++session;
    status.textContent = '';
    startBtn.disabled = true;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } }, audio: false });
    } catch (e) {
      startBtn.disabled = false;
      const name = (e as DOMException).name;
      status.textContent = name === 'NotAllowedError'
        ? 'Доступ до камери заборонено. Дозвольте камеру в налаштуваннях браузера і спробуйте знову.'
        : name === 'NotFoundError' ? 'Камеру не знайдено.' : 'Не вдалося увімкнути камеру.';
      return;
    }
    stage.hidden = false; fit.hidden = false; loading.hidden = false; stopBtn.hidden = false; startBtn.hidden = true;
    video.srcObject = stream;
    await video.play();

    try {
      const [THREE, { GLTFLoader }, vision] = await Promise.all([
        import('three'), import('three/addons/loaders/GLTFLoader.js'), import('@mediapipe/tasks-vision'),
      ]);
      const fileset = await vision.FilesetResolver.forVisionTasks('/mediapipe');
      const landmarker = await vision.FaceLandmarker.createFromOptions(fileset, {
        baseOptions: { modelAssetPath: '/mediapipe/face_landmarker.task', delegate: 'GPU' },
        runningMode: 'VIDEO', numFaces: 1, outputFacialTransformationMatrixes: true,
      });
      if (my !== session) { landmarker.close(); return; }

      const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
      const scene = new THREE.Scene();
      // MediaPipe's face transform assumes a 63° vertical-FOV camera at the origin, in cm.
      const camera = new THREE.PerspectiveCamera(63, video.videoWidth / video.videoHeight, 1, 10000);
      scene.add(new THREE.HemisphereLight(0xffffff, 0x404040, 2.2));
      const sun = new THREE.DirectionalLight(0xffffff, 1.5); sun.position.set(0, 50, 80); scene.add(sun);

      const anchor = new THREE.Group(); anchor.matrixAutoUpdate = false; scene.add(anchor);
      // Invisible head + neck that hide the parts of the hat behind the visitor.
      // Sized from MediaPipe's canonical face (temples ±7.7, forehead z 4.5, ears z -2.4) plus ~1 cm for ears/hair.
      // shortcut: ellipsoid + cylinder, swap for a real head mesh if edges look wrong on many faces.
      const occMat = location.search.includes('debug')
        ? new THREE.MeshBasicMaterial({ color: 0x00ff88, wireframe: true })
        : new THREE.MeshBasicMaterial({ colorWrite: false });
      const head = new THREE.Mesh(new THREE.SphereGeometry(1, 32, 24), occMat);
      const HEAD = [8.6, 10, 10.2] as const;
      head.position.set(0, 3, -5);
      const neck = new THREE.Mesh(new THREE.CylinderGeometry(5.5, 6.5, 18, 24), occMat);
      neck.position.set(0, -11, -5);
      for (const m of [head, neck]) { m.renderOrder = -1; anchor.add(m); }

      const loader = new GLTFLoader();
      const cache = new Map<string, import('three').Object3D>();
      const hatHolder = new THREE.Group(); anchor.add(hatHolder);
      async function setHat(h: Hat) {
        let model = cache.get(h.id);
        if (!model) {
          const gltf = await loader.loadAsync(h.src);
          const raw = gltf.scene;
          const box = new THREE.Box3().setFromObject(raw);
          const size = box.getSize(new THREE.Vector3()), center = box.getCenter(new THREE.Vector3());
          raw.position.set(-center.x, -box.min.y, -center.z); // brim base at y=0, centered
          model = new THREE.Group(); model.add(raw);
          model.rotation.y = h.yaw ?? 0;
          model.scale.setScalar(h.width / Math.max(size.x, size.z));
          cache.set(h.id, model);
        }
        hatHolder.clear(); hatHolder.add(model);
        applyFit();
      }
      // Visitor fit tweaks are deltas on top of the hat's defaults from tryon.json.
      function applyFit() {
        const h = current(), size = fitVal('size'), dy = fitVal('dy'), dz = fitVal('dz');
        const tilt = h.tilt + (fitVal('tilt') * Math.PI) / 180;
        hatHolder.position.set(h.offset[0], h.offset[1] + dy, h.offset[2] + dz);
        const yaw = (fitVal('yaw') * Math.PI) / 180, k = fitVal('head');
        hatHolder.rotation.set(tilt, yaw, 0);
        // Head-size slider for visitors with big hair: grows the invisible head and neck.
        head.scale.set(HEAD[0] * k, HEAD[1] * k, HEAD[2] * k);
        neck.scale.set(k, 1, k);
        hatHolder.scale.setScalar(size);
        const r = (n: number, d = 1) => Math.round(n * 10 ** d) / 10 ** d;
        fitJson.textContent = `"width": ${r(h.width * size)},\n"offset": [${h.offset[0]}, ${r(h.offset[1] + dy)}, ${r(h.offset[2] + dz)}],\n"tilt": ${r(tilt, 3)},\n"yaw": ${r((h.yaw ?? 0) + yaw, 4)}\n// head size ${Math.round(k * 100)}%`;
      }
      fitInputs.forEach((i) => (i.oninput = () => { showFitLabels(); applyFit(); }));
      $('tryon-fit-reset').onclick = () => { resetFit(); applyFit(); };
      await setHat(current());
      if (my !== session) { landmarker.close(); renderer.dispose(); return; }
      picker.forEach((p) => p.onchange = () => { itemInput.value = current().label; showCredit(); resetFit(); setHat(current()); });

      const resize = () => { renderer.setPixelRatio(Math.min(devicePixelRatio, 2)); renderer.setSize(canvas.clientWidth, canvas.clientHeight, false); };
      resize(); addEventListener('resize', resize);
      loading.hidden = true;

      let lastTime = -1;
      renderer.setAnimationLoop(() => {
        if (video.readyState < 2 || video.currentTime === lastTime) return;
        lastTime = video.currentTime;
        const res = landmarker.detectForVideo(video, performance.now());
        const m = res.facialTransformationMatrixes?.[0];
        anchor.visible = !!m;
        if (m) anchor.matrix.fromArray(m.data);
        renderer.render(scene, camera);
      });

      stopLoop = () => {
        renderer.setAnimationLoop(null);
        removeEventListener('resize', resize);
        landmarker.close();
        renderer.dispose();
        cache.clear();
      };
    } catch (e) {
      console.error(e);
      stop();
      status.textContent = 'Не вдалося запустити примірку на цьому пристрої. Ви все одно можете надіслати запит нижче.';
    }
  }

  function stop() {
    session++;
    stopLoop(); stopLoop = () => {};
    stream?.getTracks().forEach((t) => t.stop());
    stream = null; video.srcObject = null;
    stage.hidden = true; fit.hidden = true; stopBtn.hidden = true; startBtn.hidden = false; startBtn.disabled = false;
  }

  startBtn.addEventListener('click', start);
  stopBtn.addEventListener('click', stop);
  addEventListener('pagehide', stop);
}
