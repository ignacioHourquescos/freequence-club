(function experienceStage() {
  const stage = document.querySelector(".experienceStage");
  const host = stage && stage.querySelector(".experienceStageVideos");
  const videos = host ? Array.from(host.querySelectorAll("video")) : [];
  if (!stage || videos.length === 0) return;

  const HOLD_MS = 3000;
  let index = 0;
  let timer = 0;
  let active = false;

  const ensureSrc = (video) => {
    if (!video.dataset.src) return;
    if (video.getAttribute("src") === video.dataset.src) return;
    video.src = video.dataset.src;
    video.load();
  };

  const seekStart = (video) => {
    const reset = () => {
      try {
        video.currentTime = 0;
      } catch (_) {
        /* ignore */
      }
    };
    if (video.readyState >= 1) reset();
    else video.addEventListener("loadedmetadata", reset, { once: true });
  };

  const playAt = (i) => {
    videos.forEach((video, n) => {
      if (n === i) {
        ensureSrc(video);
        seekStart(video);
        video.classList.add("is-active");
        const play = video.play();
        if (play && typeof play.catch === "function") play.catch(() => {});
      } else {
        video.classList.remove("is-active");
        video.pause();
      }
    });

    const nextVideo = videos[(i + 1) % videos.length];
    if (nextVideo) ensureSrc(nextVideo);
  };

  const next = () => {
    index = (index + 1) % videos.length;
    playAt(index);
  };

  const clearTimer = () => {
    if (!timer) return;
    window.clearInterval(timer);
    timer = 0;
  };

  const start = () => {
    if (active) return;
    active = true;
    playAt(index);
    clearTimer();
    if (videos.length > 1) {
      timer = window.setInterval(next, HOLD_MS);
    }
  };

  const stop = () => {
    if (!active) return;
    active = false;
    clearTimer();
    videos.forEach((video) => video.pause());
  };

  videos.forEach((video) => {
    video.muted = true;
    video.playsInline = true;
    video.removeAttribute("loop");
    video.loop = false;
  });

  if ("IntersectionObserver" in window) {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) start();
        else stop();
      },
      { threshold: 0.15 }
    );
    observer.observe(stage);
  } else {
    start();
  }
})();
