document.documentElement.classList.add("reveal-ready");

(function scrollNav() {
  const nav = document.querySelector(".nav");
  if (!nav) return;
  if (nav.hasAttribute("data-nav-always")) {
    nav.classList.add("is-visible");
    return;
  }

  const SHOW_AT = 24;
  let ticking = false;

  const update = () => {
    ticking = false;
    const y = window.scrollY || document.documentElement.scrollTop || 0;
    nav.classList.toggle("is-visible", y > SHOW_AT);
  };

  const onScroll = () => {
    if (ticking) return;
    ticking = true;
    window.requestAnimationFrame(update);
  };

  window.addEventListener("scroll", onScroll, { passive: true });
  update();
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
