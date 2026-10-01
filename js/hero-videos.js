(function heroVideoGrid() {
  const stage = document.querySelector(".hero");
  const host = stage && stage.querySelector(".heroVideoGrid");
  const cells = host ? Array.from(host.querySelectorAll(".heroVideoCell")) : [];
  if (!stage || !host || cells.length === 0) return;

  // Order: first → second → third → repeat
  const ORDER = [0, 1, 2].filter((i) => i < cells.length);
  const HOLD_MIN_MS = 2000;
  const HOLD_MAX_MS = 3000;

  let timer = 0;
  let active = false;
  let orderIndex = 0;
  let current = null;

  const videoOf = (cell) => cell.querySelector("video");

  const randomHold = () =>
    HOLD_MIN_MS + Math.floor(Math.random() * (HOLD_MAX_MS - HOLD_MIN_MS + 1));

  const ensureSrc = (video) => {
    if (!video?.dataset.src) return;
    if (video.getAttribute("src") === video.dataset.src) return;
    video.src = video.dataset.src;
    video.load();
  };

  const seekTo = (video, seconds) => {
    if (video._clearSeek) video._clearSeek();
    let tries = 0;
    const jump = () => {
      const dur = video.duration;
      if (!Number.isFinite(dur) || dur <= 0.4) return;
      const target = Math.min(Math.max(0, seconds), Math.max(0, dur - 0.3));
      if (Math.abs(video.currentTime - target) <= 0.35) {
        clear();
        return;
      }
      if (tries++ > 8) {
        clear();
        return;
      }
      try {
        video.currentTime = target;
      } catch (_) {
        /* ignore */
      }
    };
    const clear = () => {
      video.removeEventListener("loadedmetadata", jump);
      video.removeEventListener("loadeddata", jump);
      video.removeEventListener("playing", jump);
      video.removeEventListener("timeupdate", jump);
      if (video._clearSeek === clear) video._clearSeek = null;
    };
    video._clearSeek = clear;
    video.addEventListener("loadedmetadata", jump);
    video.addEventListener("loadeddata", jump);
    video.addEventListener("playing", jump);
    video.addEventListener("timeupdate", jump);
    jump();
  };

  const seekRandom = (video) => {
    const jump = () => {
      const dur = video.duration;
      const span = Number.isFinite(dur) && dur > 1.5 ? Math.max(0.2, dur * 0.7) : 0;
      seekTo(video, span ? Math.random() * span : 0);
    };
    if (video.readyState >= 1) jump();
    else video.addEventListener("loadedmetadata", jump, { once: true });
  };

  const stopCell = (cell) => {
    if (!cell) return;
    const video = videoOf(cell);
    if (!video) return;
    cell.classList.remove("is-playing");
    video.pause();
  };

  const playCell = (cell) => {
    const video = videoOf(cell);
    if (!video) return;
    ensureSrc(video);
    if (cells.indexOf(cell) === 0) seekTo(video, 0);
    else seekRandom(video);
    cell.classList.add("is-playing");
    host.classList.add("has-playing");
    const play = video.play();
    if (play && typeof play.catch === "function") play.catch(() => {});
  };

  const clearTimer = () => {
    if (!timer) return;
    window.clearTimeout(timer);
    timer = 0;
  };

  const schedule = () => {
    clearTimer();
    if (!active) return;
    timer = window.setTimeout(tick, randomHold());
  };

  const tick = () => {
    if (!active || ORDER.length === 0) return;

    const next = cells[ORDER[orderIndex % ORDER.length]];
    orderIndex = (orderIndex + 1) % ORDER.length;

    if (current && current !== next) stopCell(current);
    playCell(next);
    current = next;

    cells.forEach((cell) => {
      if (cell !== current) ensureSrc(videoOf(cell));
    });

    schedule();
  };

  const start = () => {
    if (active) return;
    active = true;
    orderIndex = 0;
    cells.forEach((cell) => {
      const video = videoOf(cell);
      if (!video) return;
      video.muted = true;
      video.playsInline = true;
      video.loop = true;
      ensureSrc(video);
    });
    tick();
  };

  const stop = () => {
    if (!active) return;
    active = false;
    clearTimer();
    stopCell(current);
    current = null;
    host.classList.remove("has-playing");
  };

  if ("IntersectionObserver" in window) {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) start();
        else stop();
      },
      { threshold: 0.12 }
    );
    observer.observe(stage);
  } else {
    start();
  }
})();
