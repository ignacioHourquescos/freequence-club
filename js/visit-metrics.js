import { firebaseConfig, VISITS_COLLECTION } from "./firebase-config.js";

const SESSION_KEY = "fq-sesion";
const PENDING_KEY = "fq-pendientes";

let storePromise = null;
let flushing = false;
let warned = false;

function warn(error) {
  if (warned) return;
  warned = true;
  console.warn("No se pudo guardar la visita", error && error.code ? error.code : error);
}

function configReady(config) {
  return Boolean(config && config.apiKey && config.appId && config.projectId);
}

function sessionId() {
  try {
    const existing = sessionStorage.getItem(SESSION_KEY);
    if (existing) return existing;
    const id = crypto.randomUUID();
    sessionStorage.setItem(SESSION_KEY, id);
    return id;
  } catch {
    return "";
  }
}

function deviceKind() {
  const width = window.innerWidth || 0;
  if (width < 700) return "mobile";
  if (width < 1024) return "tablet";
  return "desktop";
}

function referrerHost() {
  if (!document.referrer) return "";
  try {
    const url = new URL(document.referrer);
    if (url.origin === location.origin) return "";
    return url.hostname.slice(0, 180);
  } catch {
    return "";
  }
}

function currentPath() {
  let path = location.pathname || "/";
  if (path.endsWith("/index.html")) {
    path = path.slice(0, -"/index.html".length) || "/";
  }
  return path.slice(0, 280);
}

function skippedPath() {
  const path = currentPath();
  return path === "/admin" || path.startsWith("/admin/");
}

function loadPending() {
  try {
    const parsed = JSON.parse(sessionStorage.getItem(PENDING_KEY) || "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function savePending(list) {
  try {
    sessionStorage.setItem(PENDING_KEY, JSON.stringify(list.slice(-20)));
  } catch {
    /* el recorrido sigue en memoria si el almacenamiento está bloqueado */
  }
}

function getStore() {
  if (!configReady(firebaseConfig)) return Promise.resolve(null);
  if (!storePromise) {
    storePromise = Promise.all([
      import("https://www.gstatic.com/firebasejs/11.6.0/firebase-app.js"),
      import("https://www.gstatic.com/firebasejs/11.6.0/firebase-firestore.js"),
    ]).then(([{ initializeApp }, firestore]) => ({
      db: firestore.getFirestore(initializeApp(firebaseConfig)),
      collection: firestore.collection,
      addDoc: firestore.addDoc,
      serverTimestamp: firestore.serverTimestamp,
    }));
  }
  return storePromise;
}

function eventPayload(partial) {
  return {
    tipo: partial.tipo,
    ruta: String(partial.ruta || currentPath()).slice(0, 280),
    titulo: String(partial.titulo ?? document.title ?? "").slice(0, 180),
    referencia: String(partial.referencia ?? "").slice(0, 180),
    dispositivo: partial.dispositivo || deviceKind(),
    idioma: String(partial.idioma || navigator.language || "").slice(0, 16),
    sesion: partial.sesion || sessionId(),
    etiqueta: String(partial.etiqueta || "").slice(0, 60),
    segundos: Math.max(0, Math.min(7200, Math.round(Number(partial.segundos) || 0))),
    orden: Math.round(Number(partial.orden) || Date.now()),
  };
}

async function writeEvent(partial) {
  const store = await getStore();
  if (!store) return;
  const data = eventPayload(partial);
  try {
    await store.addDoc(store.collection(store.db, VISITS_COLLECTION), {
      ...data,
      creado: store.serverTimestamp(),
    });
  } catch (error) {
    if (data.tipo === "pagina" && error && error.code === "permission-denied") {
      await store.addDoc(store.collection(store.db, VISITS_COLLECTION), {
        ruta: data.ruta,
        titulo: data.titulo,
        referencia: data.referencia,
        dispositivo: data.dispositivo,
        idioma: data.idioma,
        sesion: data.sesion,
        creado: store.serverTimestamp(),
      });
      return;
    }
    throw error;
  }
}

async function flush() {
  if (flushing) return;
  flushing = true;
  try {
    let pending = loadPending();
    while (pending.length) {
      const next = pending[0];
      try {
        await writeEvent(next);
      } catch (error) {
        if (error && error.code === "permission-denied") {
          pending = loadPending().filter((item) => item.id !== next.id);
          savePending(pending);
          warn(error);
          continue;
        }
        warn(error);
        break;
      }
      pending = loadPending().filter((item) => item.id !== next.id);
      savePending(pending);
    }
  } finally {
    flushing = false;
  }
}

function enqueue(partial) {
  const event = eventPayload(partial);
  event.id = crypto.randomUUID();
  const pending = loadPending();
  pending.push(event);
  savePending(pending);
  flush();
}

function shouldSkipPage(path) {
  const key = "fq-visita:" + path;
  try {
    const last = Number(sessionStorage.getItem(key) || 0);
    if (Date.now() - last < 1500) return true;
    sessionStorage.setItem(key, String(Date.now()));
  } catch {
    /* si el almacenamiento está bloqueado, igual registramos la visita */
  }
  return false;
}

function actionLabel(anchor) {
  const href = anchor.getAttribute("href") || "";
  const text = (anchor.textContent || "").replace(/\s+/g, " ").trim().toLowerCase();
  let url;
  try {
    url = new URL(href, location.href);
  } catch {
    return "";
  }
  const host = url.hostname;
  const path = url.pathname;
  if (host.includes("whatsapp") || host === "wa.me") {
    return path.includes("/channel/") ? "canal-whatsapp" : "whatsapp";
  }
  if (path.includes("/formulario")) {
    return text.includes("prueba") ? "dia-de-prueba" : "quiero-ser-miembro";
  }
  if (path.includes("/manifiesto")) return "ver-manifiesto";
  return "";
}

function trackClicks() {
  document.addEventListener(
    "click",
    (event) => {
      const anchor = event.target instanceof Element ? event.target.closest("a") : null;
      if (!anchor) return;
      const etiqueta = actionLabel(anchor);
      if (!etiqueta) return;
      enqueue({
        tipo: "click",
        etiqueta,
        referencia: "",
        titulo: (anchor.textContent || "").replace(/\s+/g, " ").trim(),
        segundos: 0,
      });
    },
    true
  );

  document.addEventListener(
    "submit",
    (event) => {
      const form = event.target;
      if (!(form instanceof HTMLFormElement) || form.id !== "member-form") return;
      if (!form.checkValidity()) return;
      enqueue({
        tipo: "click",
        etiqueta: "envio-whatsapp",
        referencia: "",
        titulo: "Seguir por WhatsApp",
        segundos: 0,
      });
    },
    true
  );
}

function trackReading() {
  const started = Date.now();
  let maxScroll = 0;
  let sent = false;

  const ratio = () => {
    const height = document.documentElement.scrollHeight - window.innerHeight;
    if (height <= 40) return 1;
    return Math.min(1, Math.max(0, (window.scrollY || 0) / height));
  };

  window.addEventListener(
    "scroll",
    () => {
      maxScroll = Math.max(maxScroll, ratio());
    },
    { passive: true }
  );

  const send = () => {
    if (sent) return;
    const segundos = Math.round((Date.now() - started) / 1000);
    if (segundos < 3) return;
    sent = true;
    enqueue({
      tipo: "tiempo",
      etiqueta: segundos >= 12 && maxScroll >= 0.45 ? "leido" : "visto",
      segundos,
      referencia: "",
    });
  };

  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") send();
  });
  window.addEventListener("pagehide", send);
}

async function recordPage() {
  const path = currentPath();
  const skip = shouldSkipPage(path);
  try {
    await flush();
    if (skip) return;
    await writeEvent({
      tipo: "pagina",
      ruta: path,
      titulo: document.title || "",
      referencia: referrerHost(),
      etiqueta: "",
      segundos: 0,
      orden: Date.now(),
    });
  } catch (error) {
    warn(error);
  }
}

if (!skippedPath()) {
  trackClicks();
  trackReading();
  recordPage();
}
