import { createPointsWaves, CLOSING_WAVES } from "./points-waves.js?v=25";

/** Single source of truth for the closing frame copy. */
export const CLOSING_COPY = {
  eyebrow: "FREEquence CLUB",
  titleHtml: "Acá puedo<br>ser yo.",
};

/**
 * Mount the shared "Acá puedo ser yo" closing section into `root`.
 * @param {HTMLElement} root
 */
export function mountClosingSection(root) {
  if (!root) return null;

  const section = document.createElement("section");
  section.className = "closing";
  section.id = "closing";
  section.innerHTML = `
    <div class="closingCanvas" id="closingWaves" aria-hidden="true"></div>
    <div class="wrap">
      <div class="sectionLabel">${CLOSING_COPY.eyebrow}</div>
      <h2>${CLOSING_COPY.titleHtml}</h2>
    </div>
  `;

  root.replaceWith(section);

  const host = section.querySelector("#closingWaves");
  let waves = null;

  const isMobile = () => window.matchMedia("(max-width: 900px)").matches;

  const ensure = () => {
    if (waves) return waves;
    const mobile = isMobile();
    // Pointer follow feels wrong once the canvas is CSS-rotated on mobile.
    // Keep the white “yo” point toward the camera so it reads among the
    // first / largest dots of the crest instead of mid-depth.
    waves = createPointsWaves(host, {
      ...CLOSING_WAVES,
      followPointer: !mobile,
      highlightIy: Math.floor(CLOSING_WAVES.amountY * 0.82),
    });
    // Re-measure after mobile CSS swap (100vh × 100vw + rotate)
    window.dispatchEvent(new Event("resize"));
    return waves;
  };

  const observer = new IntersectionObserver(
    ([entry]) => {
      if (entry.isIntersecting) {
        ensure().resume();
      } else if (waves) {
        waves.pause();
      }
    },
    { threshold: 0.12 }
  );

  observer.observe(section);
  return { section, observer };
}

/** Auto-mount when a `[data-closing-section]` placeholder is present. */
export function autoMountClosingSection() {
  const root = document.querySelector("[data-closing-section]");
  if (!root) return null;
  return mountClosingSection(root);
}

autoMountClosingSection();
