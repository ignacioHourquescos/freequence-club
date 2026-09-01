/** Single source of truth for the closing frame copy. */
export const CLOSING_COPY = {
  eyebrow: "FREEquence CLUB",
  titleHtml: "Acá puedo<br>ser yo.",
};

/**
 * Mount the shared "Acá puedo ser yo" closing section into `root`.
 * Dots animation is temporarily disabled — copy only.
 * @param {HTMLElement} root
 */
export function mountClosingSection(root) {
  if (!root) return null;

  const section = document.createElement("section");
  section.className = "closing";
  section.id = "closing";
  section.innerHTML = `
    <div class="wrap">
      <div class="sectionLabel">${CLOSING_COPY.eyebrow}</div>
      <h2>${CLOSING_COPY.titleHtml}</h2>
    </div>
  `;

  root.replaceWith(section);
  return { section, observer: null };
}

/** Auto-mount when a `[data-closing-section]` placeholder is present. */
export function autoMountClosingSection() {
  const root = document.querySelector("[data-closing-section]");
  if (!root) return null;
  return mountClosingSection(root);
}

autoMountClosingSection();
