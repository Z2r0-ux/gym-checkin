(() => {
  "use strict";
  const KEY = "gym-checkin-theme";
  const query = window.matchMedia?.("(prefers-color-scheme: dark)");
  const reducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)");
  let transition;
  let pendingMode;

  function read() {
    try {
      const mode = localStorage.getItem(KEY);
      return ["system", "light", "dark"].includes(mode) ? mode : "system";
    }
    catch { return "system"; }
  }

  function paint(mode) {
    const actual = mode === "system" ? (query?.matches ? "dark" : "light") : mode;
    document.documentElement.dataset.theme = actual;
    document.documentElement.style.colorScheme = actual;
    document.querySelector('meta[name="theme-color"]')?.setAttribute("content", actual === "light" ? "#f4f7fb" : "#0b0d12");
    const select = document.getElementById("themeSelect");
    if (select) select.value = mode;
    const button = document.getElementById("themeToggle");
    if (button) {
      button.textContent = mode === "system" ? "◐" : mode === "light" ? "☀" : "☾";
      button.title = "主题：" + ({system: "跟随系统", light: "浅色", dark: "深色"}[mode] || mode);
    }
  }

  function apply(mode) {
    pendingMode = mode;
    transition?.skipTransition();
    const actual = mode === "system" ? (query?.matches ? "dark" : "light") : mode;
    if (reducedMotion?.matches || !document.startViewTransition || document.documentElement.dataset.theme === actual) {
      paint(mode);
      return;
    }
    transition = document.startViewTransition(() => paint(pendingMode));
    // Rapid changes intentionally skip the preceding transition.
    transition.ready.catch(() => {});
  }

  function set(mode) {
    if (!["system", "light", "dark"].includes(mode)) mode = "system";
    try { localStorage.setItem(KEY, mode); } catch {}
    apply(mode);
  }

  paint(read());
  function init() {
    paint(read());
    document.getElementById("themeSelect")?.addEventListener("change", event => set(event.target.value));
    document.getElementById("themeToggle")?.addEventListener("click", () => {
      const mode = read();
      set(mode === "system" ? "light" : mode === "light" ? "dark" : "system");
    });
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init, {once: true});
  else init();
  query?.addEventListener?.("change", () => { if (read() === "system") apply("system"); });
})();
