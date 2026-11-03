/*
 * Kopytsia opening loader — full-screen overlay that plays kopytsia-loader.gif once.
 * Include as the FIRST element inside <body> (synchronous, so it runs before the page paints much):
 *   <script src="/loader/kopytsia-loader.js" data-src="/loader/kopytsia-loader.gif"></script>
 * Rules: skipped for reduced-motion users, on repeat visits in the same tab session, and when the
 * page finishes loading before the overlay would appear. Once shown, it always clears by MAX_MS.
 */
(function () {
  var APPEAR_DELAY = 150; // ms; if the page is ready by then, never show the overlay
  var PLAY_MS = 2050;     // GIF animation length + a short hold on the final pose
  var MAX_MS = 3500;      // hard cap: dismiss even if the GIF or the page never finishes
  var FADE_MS = 450;
  var BG = '#131415';     // keep in sync with CONFIG["background"] in generate.py

  var src = document.currentScript.getAttribute('data-src') || 'kopytsia-loader.gif';
  var pageReady = document.readyState === 'complete';
  var el = null, played = false, capTimer;

  function hide() {
    if (!el) return;
    var node = el;
    el = null;
    clearTimeout(capTimer);
    node.style.opacity = '0';
    setTimeout(function () { node.remove(); }, FADE_MS);
  }

  function maybeHide() { if (played && pageReady) hide(); }

  function show(fresh) {
    if (el) return;
    played = false;
    el = document.createElement('div');
    el.setAttribute('role', 'status');
    el.setAttribute('aria-label', 'Завантаження');
    el.style.cssText = 'position:fixed;inset:0;z-index:2147483647;display:flex;align-items:center;' +
      'justify-content:center;background:' + BG + ';transition:opacity ' + FADE_MS + 'ms ease';
    var img = new Image();
    img.alt = '';
    img.style.cssText = 'width:min(78vw,62vh,440px);height:auto';
    img.onload = function () { setTimeout(function () { played = true; maybeHide(); }, PLAY_MS); };
    img.onerror = function () { played = true; maybeHide(); };
    // A fresh URL restarts the one-shot GIF on replay; the first entry uses the cacheable URL.
    img.src = fresh ? src + (src.indexOf('?') < 0 ? '?' : '&') + 'r=' + Date.now() : src;
    el.appendChild(img);
    document.body.appendChild(el);
    capTimer = setTimeout(hide, MAX_MS);
  }

  window.addEventListener('load', function () { pageReady = true; maybeHide(); });
  window.KopytsiaLoader = { replay: function () { pageReady = true; show(true); } };

  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  try {
    if (sessionStorage.getItem('kopytsia-loader-seen')) return;
    sessionStorage.setItem('kopytsia-loader-seen', '1');
  } catch (e) { /* storage blocked: just show it */ }

  setTimeout(function () { if (!pageReady) show(false); }, APPEAR_DELAY);
})();
