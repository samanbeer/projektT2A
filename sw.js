const CACHE_NAME = 'dashboard-v13'; // Změň číslo při každé úpravě kódu!
const urlsToCache = [
  './',
  './index.html',
  './style.css?v=12', // Musí odpovídat verzi v HTML
  './script.js?v=12', // Musí odpovídat verzi v HTML
  './files/background.png',
  './files/favicon.png',
  'https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap'
];

// 1. INSTALACE: Uložíme vše do cache
self.addEventListener('install', event => {
  // Okamžitě převezme kontrolu, nečeká na zavření tabu
  self.skipWaiting();
  
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('SW: Ukládám soubory do cache');
        return cache.addAll(urlsToCache);
      })
  );
});

// 2. AKTIVACE: Smažeme staré cache
self.addEventListener('activate', event => {
  // Okamžitě začne ovládat všechny otevřené taby
  event.waitUntil(clients.claim());
  
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== CACHE_NAME) {
            console.log('SW: Mažu starou cache', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});

// 3. FETCH: Strategie "Cache First, then Network" (Nejrychlejší)
self.addEventListener('fetch', event => {
  // Ignorujeme API volání (počasí, pingy, favicons) - ty chceme vždy čerstvé
  if (event.request.url.includes('api.open-meteo.com') || 
      event.request.url.includes('google.com/s2/favicons') ||
      event.request.url.includes('favicon.ico')) {
    return; // Necháme projít na síť
  }

  event.respondWith(
    caches.match(event.request)
      .then(response => {
        // 1. Pokud je v cache, vrať to HNED (0ms)
        if (response) {
          return response;
        }
        // 2. Pokud není, stáhni to ze sítě
        return fetch(event.request).then(
          function(response) {
            // Kontrola platnosti odpovědi
            if(!response || response.status !== 200 || response.type !== 'basic') {
              return response;
            }
            // Naklonujeme odpověď a uložíme ji do cache pro příště
            var responseToCache = response.clone();
            caches.open(CACHE_NAME)
              .then(function(cache) {
                cache.put(event.request, responseToCache);
              });
            return response;
          }
        );
      })
  );
});