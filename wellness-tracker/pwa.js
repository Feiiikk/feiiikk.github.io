(() => {
  if (!('serviceWorker' in navigator)) return;
  const style = document.createElement('style');
  style.textContent = '.pwa-notice{position:fixed;bottom:calc(16px + env(safe-area-inset-bottom));left:16px;right:16px;max-width:700px;margin:auto;background:#25222b;color:white;padding:14px;border-radius:14px;box-shadow:0 4px 24px #0003;z-index:10000;font:14px/1.5 -apple-system,sans-serif}.pwa-notice button{padding:9px 13px;margin:8px 8px 0 0;border:0;border-radius:8px;font:inherit;cursor:pointer;background:#eee8ff;color:#25222b}';
  document.head.append(style);
  const notice = document.createElement('aside');
  notice.className = 'pwa-notice';
  notice.setAttribute('aria-live', 'polite');
  function dismiss() { notice.remove(); }
  function show(message, label, action) {
    notice.replaceChildren(document.createTextNode(message), document.createElement('br'));
    const button = document.createElement('button');
    button.textContent = label; button.onclick = action;
    const later = document.createElement('button');
    later.textContent = '稍后'; later.onclick = dismiss;
    notice.append(button, later); document.body.append(notice);
  }
  let requestedUpdate = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (requestedUpdate) location.reload();
  });
  navigator.serviceWorker.register('./sw.js', {updateViaCache: 'none'}).then(registration => {
    const offerUpdate = () => {
      if (!registration.waiting || !navigator.serviceWorker.controller) return;
      show('新版本已准备好。请先保存当前填写的内容，再更新。', '更新并重新打开', () => {
        if (!registration.waiting) { dismiss(); return; }
        requestedUpdate = true;
        registration.waiting.postMessage({type: 'SKIP_WAITING'});
      });
    };
    offerUpdate();
    registration.addEventListener('updatefound', () => {
      const worker = registration.installing;
      if (worker) worker.addEventListener('statechange', () => {
        if (worker.state === 'installed') offerUpdate();
      });
    });
    let lastCheck = 0;
    const check = () => {
      if (document.visibilityState === 'visible' && navigator.onLine && Date.now() - lastCheck > 60000) {
        lastCheck = Date.now(); registration.update().catch(() => {});
      }
    };
    document.addEventListener('visibilitychange', check);
    window.addEventListener('online', check);
    setInterval(check, 5 * 60000);
    const standalone = window.matchMedia('(display-mode: standalone)').matches || navigator.standalone;
    if (/iPad|iPhone|iPod/.test(navigator.userAgent) && !standalone && !registration.waiting) {
      show('安装到 iPhone：在 Safari 中点“分享”，再选“添加到主屏幕”。', '知道了', dismiss);
    }
  }).catch(error => console.warn('离线功能暂未启用，请联网重新打开。', error));
})();
