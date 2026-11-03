const CACHE="gym-checkin-v20";
const ASSETS=[
  "./",
  "./index.html",
  "./styles.css",
  "./theme.css",
  "./glass.css",
  "./theme.js",
  "./cloud.css",
  "./app.js",
  "./exercise-library.js",
  "./cloud-sync.js",
  "./agent-data.js",
  "./agent.js",
  "./api/v1/manifest.json",
  "./api/v1/plan.json",
  "./docs/agent-api.md",
  "./llms.txt",
  "./data/profile.js",
  "./data/exercises.js",
  "./data/program.js",
  "./data/supabase-config.js",
  "./manifest.webmanifest",
  "./icon-192.png",
  "./icon-512.png",
  "./apple-touch-icon.png"
];

self.addEventListener("install",e=>{
  // A new cache version must fetch fresh assets, including theme CSS and JS.
  const requests=ASSETS.map(asset=>new Request(asset,{cache:"reload"}));
  e.waitUntil(caches.open(CACHE).then(c=>c.addAll(requests)).then(()=>self.skipWaiting()));
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
