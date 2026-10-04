import { firebaseConfig, VISITS_COLLECTION } from "./firebase-config.js";

const PASSWORD_HASH = "331dc279ba0355ec5323858cabc4fe65e19f89cb87449d33f4b744e6d8bb4d07";
const AUTH_KEY = "fq-admin";
const ZONE = "America/Argentina/Buenos_Aires";

const ACTION_LABELS = {
  "ver-manifiesto": "Ver manifiesto",
  "quiero-ser-miembro": "Quiero ser miembro",
  "dia-de-prueba": "Día de prueba",
  "canal-whatsapp": "Canal de WhatsApp",
  whatsapp: "WhatsApp",
  "envio-whatsapp": "Envió por WhatsApp",
};

const app = document.getElementById("app");

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text != null) node.textContent = text;
  return node;
}

async function passwordMatches(password) {
  const bytes = new TextEncoder().encode(password);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  const hex = [...new Uint8Array(digest)].map((value) => value.toString(16).padStart(2, "0")).join("");
  return hex === PASSWORD_HASH;
}

function authed() {
  try {
    return sessionStorage.getItem(AUTH_KEY) === "1";
  } catch {
    return false;
  }
}

function setAuthed(value) {
  try {
    if (value) sessionStorage.setItem(AUTH_KEY, "1");
    else sessionStorage.removeItem(AUTH_KEY);
  } catch {
    /* la sesión de admin queda solo en memoria */
  }
}

function pageName(ruta) {
  let path = String(ruta || "/");
  if (path.endsWith("/index.html")) path = path.slice(0, -"/index.html".length) || "/";
  if (path === "index.html" || path === "/index.html") path = "/";
  if (path === "/" || path === "") return "Inicio";
  if (path.includes("/manifiesto")) return "Manifiesto";
  if (path.includes("/formulario")) return "Quiero ser miembro";
  if (path.includes("/preguntas")) return "Preguntas";
  if (path.includes("/hero2")) return "Hero";
  return path;
}

function dayKey(date) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function dayBits(key) {
  const [year, month, day] = key.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day, 15));
  const dayText = new Intl.DateTimeFormat("es-AR", { timeZone: ZONE, day: "numeric" }).format(date);
  const monthText = new Intl.DateTimeFormat("es-AR", { timeZone: ZONE, month: "short" })
    .format(date)
    .replace(".", "");
  return { day: dayText, month: monthText };
}

function clockLabel(date) {
  return new Intl.DateTimeFormat("es-AR", {
    timeZone: ZONE,
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function deviceLabel(value) {
  if (value === "mobile") return "celular";
  if (value === "tablet") return "tablet";
  return "escritorio";
}

function isPage(event) {
  return event.tipo === "pagina" || !event.tipo;
}

function isMemberClick(event) {
  return event.tipo === "click" && (event.etiqueta === "quiero-ser-miembro" || event.etiqueta === "dia-de-prueba");
}

function readManifesto(events) {
  return events.some(
    (event) =>
      String(event.ruta).includes("/manifiesto") &&
      event.tipo === "tiempo" &&
      (event.etiqueta === "leido" || event.segundos >= 12)
  );
}

function openedManifesto(events) {
  return events.some((event) => isPage(event) && String(event.ruta).includes("/manifiesto"));
}

function normalize(doc) {
  const data = doc.data();
  const date = data.creado && typeof data.creado.toDate === "function" ? data.creado.toDate() : null;
  return {
    id: doc.id,
    tipo: data.tipo || "pagina",
    ruta: data.ruta || "",
    titulo: data.titulo || "",
    etiqueta: data.etiqueta || "",
    segundos: Number(data.segundos) || 0,
    dispositivo: data.dispositivo || "",
    sesion: data.sesion || "",
    referencia: data.referencia || "",
    date,
    orden: Number(data.orden) || (date ? date.getTime() : 0),
  };
}

function lastDays(count) {
  const keys = [];
  const now = new Date();
  for (let index = count - 1; index >= 0; index -= 1) {
    keys.push(dayKey(new Date(now.getTime() - index * 86400000)));
  }
  return keys;
}

function stepText(event) {
  if (event.tipo === "click") return ACTION_LABELS[event.etiqueta] || event.etiqueta || "Acción";
  if (event.tipo === "tiempo") {
    if (event.segundos < 12 && event.etiqueta !== "leido") return "";
    return `${pageName(event.ruta)} · ${event.segundos}s`;
  }
  return pageName(event.ruta);
}

function renderLogin() {
  app.replaceChildren();
  const gate = el("main", "gate");
  const panel = el("form", "panel");
  panel.append(
    el("div", "kicker", "FREEquence"),
    el("h1", null, "Admin"),
    el("label", null, "Contraseña")
  );
  const input = document.createElement("input");
  input.type = "password";
  input.name = "password";
  input.autocomplete = "current-password";
  input.required = true;
  input.setAttribute("aria-label", "Contraseña");
  const error = el("p", "error");
  error.setAttribute("role", "alert");
  const button = el("button", "enter", "Entrar");
  button.type = "submit";
  panel.append(input, button, error);
  panel.addEventListener("submit", async (event) => {
    event.preventDefault();
    error.textContent = "";
    const ok = await passwordMatches(input.value);
    if (!ok) {
      error.textContent = "Esa contraseña no es.";
      input.select();
      return;
    }
    setAuthed(true);
    renderDashboard();
  });
  gate.append(panel);
  app.append(gate);
  input.focus();
}

function renderDashboard() {
  app.replaceChildren();
  const wrap = el("main", "wrap");
  const header = document.createElement("header");
  const brand = el("p", "brand", "FREEquence");
  brand.append(el("span", null, "CLUB"));
  const tools = el("div", "tools");
  const refresh = el("button", "textbtn", "Actualizar");
  refresh.type = "button";
  const logout = el("button", "textbtn", "Salir");
  logout.type = "button";
  const home = el("a", "textbtn", "Sitio");
  home.href = "../";
  tools.append(refresh, logout, home);
  header.append(brand, tools);
  const status = el("p", "muted", "Cargando visitas…");
  wrap.append(header, status);
  app.append(wrap);

  logout.addEventListener("click", () => {
    setAuthed(false);
    renderLogin();
  });

  const load = async () => {
    wrap.querySelectorAll(".block, .notice").forEach((node) => node.remove());
    let loading = wrap.querySelector(".muted");
    if (!loading) {
      loading = el("p", "muted");
      wrap.append(loading);
    }
    loading.textContent = "Cargando visitas…";
    try {
      const events = await loadEvents();
      loading.remove();
      paint(wrap, events);
    } catch (error) {
      loading.remove();
      const notice = el("div", "notice");
      if (error && error.code === "permission-denied") {
        notice.textContent = "Firestore todavía no deja leer las visitas. En Firebase, abrí Rules, reemplazá todo con el archivo firestore.rules del proyecto y publicalo.";
      } else {
        notice.textContent = "No se pudieron cargar las visitas.";
      }
      wrap.append(notice);
    }
  };

  refresh.addEventListener("click", load);
  load();
}

async function loadEvents() {
  const [{ initializeApp, getApps }, { getFirestore, getDocs, collection }] = await Promise.all([
    import("https://www.gstatic.com/firebasejs/11.6.0/firebase-app.js"),
    import("https://www.gstatic.com/firebasejs/11.6.0/firebase-firestore.js"),
  ]);
  const existing = getApps().find((item) => item.name === "admin");
  const db = getFirestore(existing || initializeApp(firebaseConfig, "admin"));
  const snap = await getDocs(collection(db, VISITS_COLLECTION));
  return snap.docs
    .map(normalize)
    .filter((event) => event.ruta || event.etiqueta)
    .sort((a, b) => a.orden - b.orden);
}

function paint(wrap, events) {
  const pages = events.filter(isPage);
  const today = dayKey(new Date());
  const weekStart = Date.now() - 6 * 86400000;
  const sessions = groupSessions(events);
  const todayVisits = uniqueSessions(
    sessions,
    (event) => isPage(event) && event.date && dayKey(event.date) === today
  );
  const weekVisits = uniqueSessions(
    sessions,
    (event) => isPage(event) && event.date && event.date.getTime() >= weekStart
  );
  const memberClicks = events.filter(isMemberClick);
  const whatsapp = events.filter((event) => event.tipo === "click" && event.etiqueta === "envio-whatsapp");
  const manifestoOpens = [...sessions.values()].filter(openedManifesto).length;
  const manifestoReads = [...sessions.values()].filter(readManifesto).length;

  const hero = el("section", "hero block");
  const heroCopy = document.createElement("div");
  heroCopy.append(el("p", "kicker", "Hoy"), el("h2", null, String(todayVisits)), el("p", "label", "Visitas únicas"));
  const chartWrap = document.createElement("div");
  const chartHead = el("div", "chart-head");
  chartHead.append(el("p", "kicker", "Últimos 14 días"));
  chartWrap.append(chartHead, renderDays(sessions, today));
  hero.append(heroCopy, chartWrap);

  const metrics = el("div", "metrics block");
  [
    [String(weekVisits), "7 días"],
    [String(sessions.size), "Recorridos"],
    [String(manifestoOpens), "Manifiesto"],
    [String(manifestoReads), "Leyeron"],
    [String(memberClicks.length), "Miembro"],
    [String(whatsapp.length), "WhatsApp"],
    [String(pages.length), "Páginas"],
  ].forEach(([value, label]) => {
    const card = el("article", "metric");
    card.append(el("b", null, value), el("span", null, label));
    metrics.append(card);
  });

  const split = el("div", "split block");
  split.append(renderPages(events), renderActions(events));
  wrap.append(hero, metrics, split, renderSessions(sessions));
}

function groupSessions(events) {
  const sessions = new Map();
  events.forEach((event) => {
    const key = event.sesion || event.id;
    if (!sessions.has(key)) sessions.set(key, []);
    sessions.get(key).push(event);
  });
  return sessions;
}

function uniqueSessions(sessions, predicate) {
  let count = 0;
  sessions.forEach((events) => {
    if (events.some(predicate)) count += 1;
  });
  return count;
}

function renderDays(sessions, today) {
  const chart = el("div", "chart");
  const keys = lastDays(14);
  const counts = keys.map((key) =>
    uniqueSessions(sessions, (event) => isPage(event) && event.date && dayKey(event.date) === key)
  );
  const max = Math.max(1, ...counts);
  let previousMonth = "";
  keys.forEach((key, index) => {
    const count = counts[index];
    const bits = dayBits(key);
    const column = el("div", "col" + (count ? "" : " is-empty") + (key === today ? " is-today" : ""));
    const track = el("span", "track");
    const fill = document.createElement("i");
    if (count) fill.style.height = `${Math.max(8, Math.round((count / max) * 100))}%`;
    track.append(fill);
    const tick = el("span", "tick", bits.day);
    tick.append(el("small", null, bits.month !== previousMonth ? bits.month : ""));
    previousMonth = bits.month;
    column.append(el("span", "count", count ? String(count) : ""), track, tick);
    chart.append(column);
  });
  return chart;
}

function renderMeters(title, entries, empty) {
  const section = document.createElement("section");
  section.append(el("h3", null, title));
  if (!entries.length) {
    section.append(el("p", "muted", empty));
    return section;
  }
  const max = Math.max(1, ...entries.map((entry) => entry[1]));
  entries.forEach(([name, count]) => {
    const meter = el("div", "meter");
    const top = el("div", "meter-top");
    top.append(el("span", null, name), el("b", null, String(count)));
    const line = el("div", "line");
    const fill = document.createElement("i");
    fill.style.width = `${Math.max(4, Math.round((count / max) * 100))}%`;
    line.append(fill);
    meter.append(top, line);
    section.append(meter);
  });
  return section;
}

function renderPages(events) {
  const counts = new Map();
  events.filter(isPage).forEach((event) => {
    const name = pageName(event.ruta);
    counts.set(name, (counts.get(name) || 0) + 1);
  });
  const entries = [...counts.entries()].sort((a, b) => b[1] - a[1]);
  return renderMeters("Páginas", entries, "Todavía no hay páginas vistas.");
}

function renderActions(events) {
  const counts = new Map();
  events
    .filter((event) => event.tipo === "click")
    .forEach((event) => {
      const name = ACTION_LABELS[event.etiqueta] || event.etiqueta || "Acción";
      counts.set(name, (counts.get(name) || 0) + 1);
    });
  const entries = [...counts.entries()].sort((a, b) => b[1] - a[1]);
  return renderMeters("Acciones", entries, "Todavía no hay clics guardados.");
}

function compressSteps(events) {
  const steps = [];
  events.forEach((event) => {
    const text = stepText(event);
    if (!text) return;
    const last = steps[steps.length - 1];
    if (last && last.text === text) last.count += 1;
    else steps.push({ text, count: 1 });
  });
  return steps;
}

function renderSessions(sessions) {
  const section = el("section", "journeys block");
  section.append(el("h3", null, "Recorridos"));
  const lists = [...sessions.values()].sort((a, b) => {
    const aTime = a[a.length - 1]?.orden || 0;
    const bTime = b[b.length - 1]?.orden || 0;
    return bTime - aTime;
  });
  if (!lists.length) {
    section.append(el("p", "muted", "Todavía no hay recorridos."));
    return section;
  }
  lists.slice(0, 40).forEach((events) => {
    const first = events.find((event) => event.date) || events[0];
    const article = el("article", "session");
    const when = first && first.date ? clockLabel(first.date) : "Sin fecha";
    const from = events.find((event) => event.referencia)?.referencia;
    const meta = [when, deviceLabel(first && first.dispositivo), from].filter(Boolean).join(" · ");
    const chips = el("div", "chips");
    compressSteps(events).forEach((step) => {
      const chip = el("span", "chip", step.text);
      if (step.count > 1) chip.append(el("small", null, ` ×${step.count}`));
      chips.append(chip);
    });
    article.append(el("div", "kicker", meta), chips);
    section.append(article);
  });
  return section;
}

if (authed()) renderDashboard();
else renderLogin();
