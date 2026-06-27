const CACHE_NAME = 'mypay-v3';

// ONLY cache true static assets that never change between deploys.
// NEVER cache '/' (index.html) or any JS/CSS — these are Vite-generated
// and their URLs change on every server restart. Caching them causes the
// splash screen to get permanently stuck because the SW serves stale HTML
// that references JS files that no longer exist on the server.
const STATIC_ASSETS = [
  '/manifest.json',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/icons/maskable-512.png',
  '/icons/apple-touch-icon.png',
];

// Install: cache only true static files (not HTML, not JS)
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS))
  );
  self.skipWaiting();
});

// Activate: clean old caches, then force-reload all open pages so they get
// fresh HTML from the network instead of whatever the old SW had cached.
self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      // 1. Delete all old caches
      const keys = await caches.keys();
      await Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
      );

      // 2. Take control of all open pages immediately
      await self.clients.claim();

      // 3. Force reload every open window so they get fresh HTML (not the
      //    stale cached version the old SW may have served)
      const clients = await self.clients.matchAll({ type: 'window' });
      for (const client of clients) {
        // navigate() reloads the page under the new SW context
        if ('navigate' in client) {
          client.navigate(client.url);
        }
      }
    })()
  );
});

// Fetch strategy
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests
  if (request.method !== 'GET') return;

  // API calls — network first, offline JSON fallback
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(
      fetch(request).catch(() =>
        new Response(JSON.stringify({ error: 'Offline' }), {
          status: 503,
          headers: { 'Content-Type': 'application/json' },
        })
      )
    );
    return;
  }

  // JS and CSS — ALWAYS network first, NEVER cache.
  // Vite generates these with changing hashes/transforms; caching them
  // causes splash-screen lockup after any server restart or deploy.
  if (url.pathname.match(/\.(js|css|ts|tsx|mjs)$/)) {
    event.respondWith(fetch(request));
    return;
  }

  // True static assets (icons, fonts, images) — cache first
  if (url.pathname.match(/\.(png|svg|ico|jpg|jpeg|webp|woff2?|ttf|eot)$/)) {
    event.respondWith(
      caches.match(request).then(
        (cached) =>
          cached ||
          fetch(request).then((res) => {
            const clone = res.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
            return res;
          })
      )
    );
    return;
  }

  // HTML navigation — ALWAYS network first, NEVER write HTML to cache.
  // Cached HTML + mismatched Vite JS = permanent splash lockup.
  event.respondWith(
    fetch(request).catch(() =>
      // Offline fallback: try cached root, then bare message
      caches.match('/icons/icon-192.png').then(
        () =>
          new Response(
            `<!DOCTYPE html><html><head><meta charset="UTF-8">
            <meta name="viewport" content="width=device-width,initial-scale=1">
            <title>MyPay — Offline</title>
            <style>body{font-family:sans-serif;display:flex;flex-direction:column;
            align-items:center;justify-content:center;height:100vh;margin:0;
            background:#0f172a;color:white;text-align:center;}
            h1{font-size:1.5rem;margin-bottom:.5rem;}
            p{color:rgba(255,255,255,.6);font-size:.9rem;}</style></head>
            <body><h1>MyPay</h1><p>You're offline. Please check your connection.</p></body></html>`,
            { headers: { 'Content-Type': 'text/html' } }
          )
      )
    )
  );
});
