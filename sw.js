/* 网络优先 Service Worker：在线时永远优先拿服务器最新文件（修改秒生效）；
   安装时预缓存核心资源 + 离线/断网时兜底走缓存（PWA「添加到主屏幕」二次打开秒开） */
var CACHE = "moyun-v4";
var ASSETS = ["index.html", "style.css", "app.life.fixed.js", "manifest.json"];

/* 核心文件：在线时必须拿到服务器最新版，绝不优先读缓存（保证更新即时生效） */
var CORE_RE = /\/(index\.html|app\.life\.fixed\.js|style\.css|manifest\.json|sw\.js)(\?|$)/;

/* 安装时清理所有旧缓存 */
function clearOldCaches() {
  return caches.keys().then(function (keys) {
    return Promise.all(keys.filter(function (k) { return k !== CACHE; }).map(function (k) { return caches.delete(k); }));
  });
}
/* 预缓存核心资源（仅作离线/断网兜底，在线时仍走网络优先） */
function precache() {
  return caches.open(CACHE).then(function (c) {
    return Promise.all(ASSETS.map(function (a) {
      return fetch(a).then(function (r) { return c.put(a, r.clone()); }).catch(function () {});
    }));
  });
}

self.addEventListener("install", function (e) {
  self.skipWaiting();
  e.waitUntil(Promise.all([clearOldCaches(), precache()]));
});

self.addEventListener("activate", function (e) {
  self.clients.claim();
  e.waitUntil(clearOldCaches());
});

self.addEventListener("fetch", function (e) {
  if (e.request.method !== "GET") return;
  var url = new URL(e.request.url);
  if (CORE_RE.test(url.pathname)) {
    /* 核心文件：在线去服务器拿最新；断网/失败时兜底用预缓存副本，避免白屏 */
    e.respondWith(
      fetch(e.request, { cache: "no-store" }).catch(function () {
        return caches.match(e.request).then(function (r) { return r || caches.match("index.html"); });
      })
    );
    return;
  }
  /* 其余资源：网络优先 + 兜底缓存 */
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
