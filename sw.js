/* 网络优先 Service Worker：永远优先拿服务器最新文件，避免旧缓存让修改“不生效” */
var CACHE = "moyun-v3";
var ASSETS = ["index.html", "style.css", "app.js", "manifest.json"];

/* 核心文件：每次都必须拿到服务器最新版，绝不缓存，绕过一切 HTTP/SW 层缓存 */
var CORE_RE = /\/(index\.html|app\.js|style\.css|manifest\.json|sw\.js)(\?|$)/;

/* 安装时清理所有旧缓存 */
function clearOldCaches() {
  return caches.keys().then(function (keys) {
    return Promise.all(keys.filter(function (k) { return k !== CACHE; }).map(function (k) { return caches.delete(k); }));
  });
}

self.addEventListener("install", function (e) {
  self.skipWaiting();
  e.waitUntil(clearOldCaches());
});

self.addEventListener("activate", function (e) {
  self.clients.claim();
  e.waitUntil(clearOldCaches());
});

self.addEventListener("fetch", function (e) {
  if (e.request.method !== "GET") return;
  var url = new URL(e.request.url);
  if (CORE_RE.test(url.pathname)) {
    /* 核心文件：去 HTTP 缓存拿最新 */
    e.respondWith(fetch(e.request, { cache: "no-store" }).catch(function () { return fetch(e.request); }));
    return;
  }
  /* 其余资源：网络优先 + 兜底缓存（不缓存核心文件） */
  e.respondWith(
    fetch(e.request)
      .then(function (res) {
        var copy = res.clone();
        caches.open(CACHE).then(function (c) { c.put(e.request, copy).catch(function () {}); });
        return res;
      })
      .catch(function () { return caches.match(e.request).then(function (r) { return r || caches.match("index.html"); }); })
  );
});
