(function () {
  if (window.__AI_CHATBOT_WIDGET__) return;
  window.__AI_CHATBOT_WIDGET__ = true;

  var script = document.currentScript;
  var src = script && script.src ? script.src : '';
  var baseUrl = src ? new URL(src).origin : window.location.origin;
  var businessId = script && script.getAttribute('data-business-id');
  var businessSlug = script && script.getAttribute('data-business-slug');

  var button = document.createElement('button');
  button.type = 'button';
  button.setAttribute('aria-label', 'Open AI customer support');
  button.innerHTML = '💬';
  button.style.cssText = 'position:fixed;right:22px;bottom:22px;width:58px;height:58px;border:0;border-radius:50%;background:#172033;color:#fff;font-size:25px;line-height:1;box-shadow:0 10px 30px rgba(0,0,0,.22);cursor:pointer;z-index:2147483646;display:grid;place-items:center;';

  var frame = document.createElement('iframe');
  frame.title = 'AI Customer Support Chat';
  frame.setAttribute('aria-hidden', 'true');
  frame.style.cssText = 'position:fixed;right:22px;bottom:92px;width:390px;height:500px;border:0;border-radius:24px;background:transparent;box-shadow:0 20px 60px rgba(0,0,0,.18);z-index:2147483645;display:none;overflow:hidden;';

  var params = new URLSearchParams();
  params.set('embed', '1');
  if (businessId) params.set('businessId', businessId);
  if (businessSlug) params.set('businessSlug', businessSlug);
  frame.src = baseUrl + '/?' + params.toString();

  function toggle() {
    var open = frame.style.display !== 'none';
    frame.style.display = open ? 'none' : 'block';
    frame.setAttribute('aria-hidden', open ? 'true' : 'false');
    button.innerHTML = open ? '💬' : '×';
  }

  button.addEventListener('click', toggle);
  document.body.appendChild(frame);
  document.body.appendChild(button);

  function resize() {
    if (window.innerWidth <= 520) {
      frame.style.right = '10px';
      frame.style.left = '10px';
      frame.style.bottom = '82px';
      frame.style.width = 'calc(100vw - 20px)';
      frame.style.height = 'min(500px, calc(100vh - 100px))';
      button.style.right = '14px';
      button.style.bottom = '14px';
    } else {
      frame.style.right = '22px';
      frame.style.left = 'auto';
      frame.style.bottom = '92px';
      frame.style.width = '390px';
      frame.style.height = '500px';
      button.style.right = '22px';
      button.style.bottom = '22px';
    }
  }

  window.addEventListener('resize', resize);
  resize();
})();
