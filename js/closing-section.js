/** Shared closing band: "Me interesa saber más". */
const CHANNEL_URL = "https://www.whatsapp.com/channel/0029VbClfwB5PO155kXd952y";

function pagePrefix() {
  const script = document.querySelector('script[src*="closing-section.js"]');
  const src = script?.getAttribute("src") || "";
  return src.includes("../") ? "../" : "";
}

/**
 * Mount the shared closing section into `root`.
 * @param {HTMLElement} root
 */
export function mountClosingSection(root) {
  if (!root) return null;

  const prefix = pagePrefix();
  const section = document.createElement("section");
  section.className = "closing";
  section.id = "closing";
  section.setAttribute("aria-label", "Me interesa saber más");
  section.innerHTML = `
    <div class="wrap closingGrid">
      <div class="closingCopy">
        <h2><span>Me interesa</span><span>saber más<span class="period">.</span></span></h2>
      </div>
      <div class="closingActions">
        <a class="closingCta" href="${CHANNEL_URL}" target="_blank" rel="noopener noreferrer">Unite al canal <span aria-hidden="true">→</span></a>
        <a class="closingCta" href="${prefix}formulario/">Agendá un día de prueba <span aria-hidden="true">→</span></a>
      </div>
    </div>
    <p class="closingAddress">
      <a href="https://www.google.com/maps/search/?api=1&amp;query=Av.+del+Libertador+3192%2C+Punta+Chica" target="_blank" rel="noopener noreferrer">Av. del Libertador 3192, Punta Chica</a>
    </p>
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
