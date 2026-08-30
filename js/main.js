document.documentElement.classList.add("reveal-ready");

(function heroNarrative() {
  const hero = document.querySelector(".hero");
  const selfTitle = document.querySelector(".heroTitle--self");
  const othersTitle = document.querySelector(".heroTitle--others");
  const microLogo = document.querySelector(".hero .microLogo");
  if (!hero || !selfTitle || !othersTitle || !microLogo) return;

  const ease = "cubic-bezier(0.45, 0.05, 0.15, 1)";
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const slide = reduce ? 28 : 72;
  const animations = [];
  const timers = [];
  let expandFrame = 0;

  const later = (fn, ms) => {
    timers.push(window.setTimeout(fn, ms));
  };

  const setSide = (pct) => {
    hero.style.setProperty("--hero-side", `${pct}%`);
  };

  const cancelAll = () => {
    timers.splice(0).forEach((id) => window.clearTimeout(id));
    animations.splice(0).forEach((anim) => {
      try {
        anim.cancel();
      } catch (_) {
        /* ignore */
      }
    });
    if (expandFrame) {
      cancelAnimationFrame(expandFrame);
      expandFrame = 0;
    }
  };

  const paint = (el, opacity, transform) => {
    el.style.opacity = String(opacity);
    if (transform != null) el.style.transform = transform;
  };

  const run = (el, keyframes, options) => {
    if (!el) return null;
    if (typeof el.animate !== "function") {
      const last = keyframes[keyframes.length - 1] || {};
      paint(el, last.opacity ?? 1, last.transform ?? "none");
      return null;
    }
    const anim = el.animate(keyframes, { ...options, fill: "forwards" });
    animations.push(anim);
    anim.finished
      .then(() => {
        const last = keyframes[keyframes.length - 1] || {};
        paint(el, last.opacity ?? 1, last.transform ?? "none");
        anim.cancel();
      })
      .catch(() => {});
    return anim;
  };

  const expandBlue = (duration) => {
    hero.classList.add("is-expanded");
    const start = 25;
    const end = 50;
    const started = performance.now();

    const tick = (now) => {
      const t = Math.min(1, (now - started) / duration);
      const eased = t * t * (3 - 2 * t);
      setSide(start + (end - start) * eased);
      if (t < 1) {
        expandFrame = requestAnimationFrame(tick);
      } else {
        expandFrame = 0;
        setSide(end);
      }
    };

    expandFrame = requestAnimationFrame(tick);
  };

  const play = () => {
    cancelAll();
    hero.classList.remove("is-ready", "is-expanded", "is-copy-in");
    hero.classList.add("is-logo-in");
    othersTitle.setAttribute("aria-hidden", "true");

    // Instant opening hold: large logo centered, titles hidden, blue at 25%.
    setSide(25);
    paint(microLogo, 1, "none");
    paint(selfTitle, 0, `translate3d(-${slide}px, 0, 0)`);
    paint(othersTitle, 0, `translate3d(-${slide}px, 0, 0)`);

    // Longer holds so each composition can breathe.
    const tStart = reduce ? 1200 : 2000; // logo alone
    const dSelf = reduce ? 800 : 1200; // Sintonizá slide
    const tSelf = tStart;
    const holdAfterSelf = reduce ? 500 : 900; // pause on Sintonizá before blue moves
    const tExpand = tSelf + dSelf + holdAfterSelf;
    const dExpand = reduce ? 1100 : 1600; // blue 25% → 50%
    const tOthers = tExpand + (reduce ? 250 : 400);
    const dOthers = reduce ? 900 : 1300; // Sincronizá slide

    // 1) Logo settles into the small eyebrow; Sintonizá slides in under it.
    later(() => {
      paint(microLogo, 1, "none");
      hero.classList.add("is-copy-in");
      run(
        selfTitle,
        [
          { opacity: 0, transform: `translate3d(-${slide}px, 0, 0)` },
          { opacity: 1, transform: "translate3d(0, 0, 0)" },
        ],
        { duration: dSelf, easing: ease }
      );
    }, tSelf);

    // 2) Blue expands, then Sincronizá con otros.
    later(() => expandBlue(dExpand), tExpand);

    later(() => {
      othersTitle.removeAttribute("aria-hidden");
      run(
        othersTitle,
        [
          { opacity: 0, transform: `translate3d(-${slide}px, 0, 0)` },
          { opacity: 1, transform: "translate3d(0, 0, 0)" },
        ],
        { duration: dOthers, easing: ease }
      );
    }, tOthers);

    later(() => {
      paint(microLogo, 1, "none");
      hero.classList.add("is-ready");
    }, tOthers + dOthers + 40);
  };

  const start = () => {
    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(play);
    });
  };

  const boot = () => {
    let started = false;
    const go = () => {
      if (started) return;
      started = true;
      start();
    };
    if (document.fonts?.ready) {
      document.fonts.ready.then(go);
      window.setTimeout(go, 120);
    } else {
      go();
    }
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot, { once: true });
  } else {
    boot();
  }

  window.addEventListener("pageshow", (event) => {
    if (event.persisted) boot();
  });
})();

const sections = document.querySelectorAll(".reveal-section");

function reveal(section) {
  section.classList.add("is-visible");
}

const observer = new IntersectionObserver(
  (entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        reveal(entry.target);
        observer.unobserve(entry.target);
      }
    });
  },
  { threshold: 0, rootMargin: "0px 0px -12% 0px" }
);

sections.forEach((section) => {
  const rect = section.getBoundingClientRect();
  const inView = rect.top < window.innerHeight * 0.92 && rect.bottom > 0;
  if (inView) {
    reveal(section);
  } else {
    observer.observe(section);
  }
});

document.querySelectorAll('a[href^="#"]').forEach((link) => {
  link.addEventListener("click", () => {
    const id = link.getAttribute("href")?.slice(1);
    if (!id) return;
    const target = document.getElementById(id);
    if (!target) return;
    const section = target.closest(".reveal-section") || target;
    window.setTimeout(() => reveal(section), 80);
  });
});
