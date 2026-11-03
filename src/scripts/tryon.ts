// Live try-on: MediaPipe Face Landmarker (runs locally in the browser) + three.js overlay.
// Nothing from the camera leaves the device.
type Hat = { id: string; label: string; src: string; width: number; offset: [number, number, number]; tilt: number; credit?: string; creditUrl?: string };

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;

export function initTryOn() {
  const { hats } = JSON.parse($('tryon-data').textContent!) as { hats: Hat[] };
  const stage = $('tryon-stage'), video = $<HTMLVideoElement>('tryon-video'), canvas = $<HTMLCanvasElement>('tryon-canvas');
  const startBtn = $<HTMLButtonElement>('tryon-start'), stopBtn = $<HTMLButtonElement>('tryon-stop');
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
    stage.hidden = false; loading.hidden = false; stopBtn.hidden = false; startBtn.hidden = true;
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
      // Invisible head that hides the back of the hat behind the visitor's head.
      // shortcut: ellipsoid occluder, swap for a real head mesh if edges look wrong on many faces.
      const occluder = new THREE.Mesh(new THREE.SphereGeometry(1, 32, 24), new THREE.MeshBasicMaterial({ colorWrite: false }));
      occluder.scale.set(7.8, 10.5, 10); occluder.position.set(0, 1.5, -6); occluder.renderOrder = -1;
      anchor.add(occluder);

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
          model.scale.setScalar(h.width / Math.max(size.x, size.z));
          cache.set(h.id, model);
        }
        hatHolder.clear(); hatHolder.add(model);
        hatHolder.position.set(...h.offset); hatHolder.rotation.set(h.tilt, 0, 0);
      }
      await setHat(current());
      if (my !== session) { landmarker.close(); renderer.dispose(); return; }
      picker.forEach((p) => p.onchange = () => { itemInput.value = current().label; showCredit(); setHat(current()); });

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
    stage.hidden = true; stopBtn.hidden = true; startBtn.hidden = false; startBtn.disabled = false;
  }

  startBtn.addEventListener('click', start);
  stopBtn.addEventListener('click', stop);
  addEventListener('pagehide', stop);
}
