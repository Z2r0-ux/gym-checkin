const CACHE="gym-checkin-v7";
const ASSETS=[
  "./",
  "./index.html",
  "./styles.css",
  "./cloud.css",
  "./app.js",
  "./cloud-sync.js",
  "./data/profile.js",
  "./data/program.js",
  "./data/supabase-config.js",
  "./manifest.webmanifest",
  "./icon-192.png",
  "./icon-512.png",
  "./apple-touch-icon.png"
];

self.addEventListener("install",e=>{
  e.waitUntil(caches.open(CACHE).then(c=>c.addAll(ASSETS)).then(()=>self.skipWaiting()));
});

self.addEventListener("activate",e=>{
  e.waitUntil(
    caches.keys()
      .then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k))))
      .then(()=>self.clients.claim())
  );
});

self.addEventListener("fetch",e=>{
  if(e.request.method!=="GET") return;
  const url=new URL(e.request.url);
  if(url.origin!==self.location.origin) return;

  e.respondWith(
    caches.match(e.request).then(cached=>cached||fetch(e.request).then(resp=>{
      const copy=resp.clone();
      caches.open(CACHE).then(c=>c.put(e.request,copy));
      return resp;
    }).catch(()=>{
      if(e.request.mode==="navigate") return caches.match("./index.html");
      return caches.match(e.request);
    }))
  );
});
