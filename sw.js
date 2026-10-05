const CACHE = "vikingo-colocacion-v6";
const ASSETS = ["./", "./index.html", "./manifest.json", "./Favicon%20verde.png", "./xlsx.full.min.js"];
const TIMEOUT_MS = 3000;

// Precarga tolerante: si un archivo falta (404), no se cae toda la instalación.
self.addEventListener("install", (e) => {
  e.waitUntil(
    caches.open(CACHE).then((c) =>
      Promise.allSettled(ASSETS.map((a) => c.add(a)))
    )
  );
  self.skipWaiting();
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Red primero: con señal siempre trae la versión publicada; sin señal (o si la
// red tarda más de TIMEOUT_MS) responde con la copia guardada.
function redPrimero(request) {
  return new Promise((resolve) => {
    let respondido = false;
    const responder = (r) => {
      if (!respondido && r) { respondido = true; resolve(r); }
    };

    const timer = setTimeout(() => {
      caches.match(request).then(responder);
    }, TIMEOUT_MS);

    fetch(request, { cache: "no-cache" })
      .then((resp) => {
        clearTimeout(timer);
        if (resp && resp.status === 200) {
          const copia = resp.clone();
          caches.open(CACHE).then((c) => c.put(request, copia));
        }
        responder(resp);
      })
      .catch(() => {
        clearTimeout(timer);
        caches.match(request).then((cached) => {
          if (!respondido) { respondido = true; resolve(cached || Response.error()); }
        });
      });
  });
}

self.addEventListener("fetch", (e) => {
  if (e.request.method !== "GET") return;
  const url = new URL(e.request.url);

  // El catálogo nunca se sirve de caché salvo que no haya internet.
  if (url.pathname.endsWith("/catalogo.json")) {
    e.respondWith(
      fetch(e.request, { cache: "no-store" }).catch(() => caches.match(e.request))
    );
    return;
  }

  // Solo manejamos lo que vive en nuestro propio sitio.
  if (url.origin !== self.location.origin) return;

  e.respondWith(redPrimero(e.request));
});
