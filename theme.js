(()=>{"use strict";
const KEY="gym-checkin-theme",query=window.matchMedia?.("(prefers-color-scheme: dark)");
function read(){try{return localStorage.getItem(KEY)||"system"}catch{return"system"}}
function paint(mode){const actual=mode==="system"?(query?.matches?"dark":"light"):mode;
 document.documentElement.dataset.theme=actual;document.documentElement.style.colorScheme=actual;
 const meta=document.querySelector('meta[name="theme-color"]');meta?.setAttribute("content",actual==="light"?"#f4f7fb":"#0b0d12");
 const sel=document.getElementById("themeSelect");if(sel)sel.value=mode;
 const btn=document.getElementById("themeToggle");if(btn){btn.textContent=mode==="system"?"◐":mode==="light"?"☀":"☾";btn.title="主题："+({system:"跟随系统",light:"浅色",dark:"深色"}[mode]||mode)}
}
function set(mode){if(!["system","light","dark"].includes(mode))mode="system";try{localStorage.setItem(KEY,mode)}catch{}paint(mode)}
paint(read());
function init(){paint(read());document.getElementById("themeSelect")?.addEventListener("change",e=>set(e.target.value));document.getElementById("themeToggle")?.addEventListener("click",()=>{const m=read();set(m==="system"?"light":m==="light"?"dark":"system")})}
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",init,{once:true});else init();
query?.addEventListener?.("change",()=>{if(read()==="system")paint("system")});
})();