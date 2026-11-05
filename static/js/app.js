"use strict";

// Stessa logica di generator.py: se modifichi set di caratteri o soglie qui,
// aggiornali anche li'.
const MIN_LENGTH = 8;
const MAX_LENGTH = 64; // limite dell'interfaccia (l'API arriva a 128)
const CHARSETS = {
  lower: "abcdefghijklmnopqrstuvwxyz",
  upper: "ABCDEFGHIJKLMNOPQRSTUVWXYZ",
  digits: "0123456789",
  symbols: "!@#$%^&*()-_=+[]{};:,.<>?/~",
};
const POOL_ORDER = ["lower", "upper", "digits", "symbols"];
const AMBIGUOUS = new Set(["O", "0", "o", "I", "l", "1"]);
const LEVELS = [
  { max: 50, key: "weak", label: "Debole" },
  { max: 70, key: "fair", label: "Discreta" },
  { max: 100, key: "strong", label: "Forte" },
  { max: Infinity, key: "very-strong", label: "Molto forte" },
];
const GUESSES_PER_SECOND = 1e10; // attacco offline con hardware dedicato
const METER_FULL_BITS = 128;
const STORAGE_KEY = "vaultforge:options";
const DEFAULTS = {
  length: 16,
  lower: true,
  upper: true,
  digits: true,
  symbols: true,
  excludeAmbiguous: false,
};

const numberFormat = new Intl.NumberFormat("it-IT", { maximumFractionDigits: 0 });

/** Intero uniforme in [0, max) senza bias del modulo. */
function randomInt(max) {
  const limit = Math.floor(0x100000000 / max) * max;
  const buffer = new Uint32Array(1);
  let value;
  do {
    crypto.getRandomValues(buffer);
    value = buffer[0];
  } while (value >= limit);
  return value % max;
}

function characterPools(opts) {
  return POOL_ORDER.filter((key) => opts[key]).map((key) => {
    const chars = CHARSETS[key];
    return opts.excludeAmbiguous
      ? [...chars].filter((c) => !AMBIGUOUS.has(c)).join("")
      : chars;
  });
}

function generatePassword(opts) {
  const pools = characterPools(opts);
  if (pools.length === 0) throw new Error("Seleziona almeno un tipo di carattere.");
  const alphabet = pools.join("");
  const chars = pools.map((pool) => pool[randomInt(pool.length)]);
  while (chars.length < opts.length) chars.push(alphabet[randomInt(alphabet.length)]);
  for (let i = chars.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return chars.join("");
}

function entropyBits(opts) {
  const size = characterPools(opts).reduce((sum, pool) => sum + pool.length, 0);
  return opts.length * Math.log2(size);
}

function strengthOf(bits) {
  return LEVELS.find((level) => bits < level.max);
}

function plural(n, one, many) {
  return `${numberFormat.format(n)} ${n === 1 ? one : many}`;
}

/** Tempo medio per indovinare la password: metà dello spazio delle combinazioni. */
function crackTimeText(bits) {
  const seconds = Math.pow(2, bits - 1) / GUESSES_PER_SECOND;
  const MINUTE = 60, HOUR = 3600, DAY = 86400, YEAR = 31557600;
  if (seconds < 1) return "meno di un secondo";
  if (seconds < MINUTE) return plural(Math.round(seconds), "secondo", "secondi");
  if (seconds < HOUR) return plural(Math.round(seconds / MINUTE), "minuto", "minuti");
  if (seconds < DAY) return plural(Math.round(seconds / HOUR), "ora", "ore");
  if (seconds < YEAR) return plural(Math.round(seconds / DAY), "giorno", "giorni");
  const years = seconds / YEAR;
  if (years < 1e3) return plural(Math.round(years), "anno", "anni");
  if (years < 1e6) return "migliaia di anni";
  if (years < 1e9) return "milioni di anni";
  if (years < 1.4e10) return "miliardi di anni";
  return "più dell'età dell'universo";
}

function clampLength(value) {
  const n = Number.parseInt(value, 10);
  if (Number.isNaN(n)) return DEFAULTS.length;
  return Math.min(MAX_LENGTH, Math.max(MIN_LENGTH, n));
}

// Nel browser si salvano solo le preferenze, mai le password.
function loadOptions() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
    if (!saved || typeof saved !== "object") return { ...DEFAULTS };
    const opts = { ...DEFAULTS };
    for (const key of Object.keys(DEFAULTS)) {
      if (key === "length") opts.length = clampLength(saved.length);
      else if (typeof saved[key] === "boolean") opts[key] = saved[key];
    }
    return characterPools(opts).length ? opts : { ...DEFAULTS };
  } catch {
    return { ...DEFAULTS };
  }
}

function saveOptions(opts) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(opts));
  } catch {
    /* archiviazione non disponibile: le preferenze non vengono ricordate */
  }
}

function fallbackCopy(text) {
  const area = document.createElement("textarea");
  area.value = text;
  area.setAttribute("readonly", "");
  area.className = "offscreen";
  document.body.appendChild(area);
  area.select();
  let ok = false;
  try {
    ok = document.execCommand("copy");
  } catch {
    ok = false;
  }
  area.remove();
  return ok;
}

// ---------------------------------------------------------------------------
// Passphrase: parole italiane BIP-39 (WORDLIST_IT, da wordlist-it.js).
// Stessa logica di passphrase.py: se cambi lista, regole o valori, aggiornali anche li'.
// ---------------------------------------------------------------------------

const PP_STORAGE_KEY = "vaultforge:passphrase";
const MODE_STORAGE_KEY = "vaultforge:mode";
const PP_MIN_WORDS = 4;
const PP_MAX_WORDS = 10;
const PP_SEPARATORS = { "-": "-", ".": ".", _: "_", space: " " };
const PP_DEFAULTS = { words: 7, capitalize: true, number: true, separator: "-" };
const MODES = ["password", "passphrase"];

/** Parole estratte senza bias; maiuscola e cifra in posizione fissa (regole aziendali). */
function generatePassphrase(pp) {
  const words = [];
  for (let i = 0; i < pp.words; i++) words.push(WORDLIST_IT[randomInt(WORDLIST_IT.length)]);
  if (pp.capitalize) words[0] = words[0][0].toUpperCase() + words[0].slice(1);
  if (pp.number) words[words.length - 1] += String(randomInt(10));
  const separator = PP_SEPARATORS[pp.separator];
  const groups = words.map((word, i) => (i < words.length - 1 ? word + separator : word));
  return { text: groups.join(""), groups };
}

/** Contano solo le scelte casuali: le parole e, se presente, la cifra. */
function passphraseEntropyBits(pp) {
  return pp.words * Math.log2(WORDLIST_IT.length) + (pp.number ? Math.log2(10) : 0);
}

function clampWords(value) {
  const n = Number.parseInt(value, 10);
  if (Number.isNaN(n)) return PP_DEFAULTS.words;
  return Math.min(PP_MAX_WORDS, Math.max(PP_MIN_WORDS, n));
}

// Nel browser si salvano solo le preferenze, mai le passphrase.
function loadPassphraseOptions() {
  try {
    const saved = JSON.parse(localStorage.getItem(PP_STORAGE_KEY) || "null");
    if (!saved || typeof saved !== "object") return { ...PP_DEFAULTS };
    return {
      words: saved.words === undefined ? PP_DEFAULTS.words : clampWords(saved.words),
      capitalize: typeof saved.capitalize === "boolean" ? saved.capitalize : PP_DEFAULTS.capitalize,
      number: typeof saved.number === "boolean" ? saved.number : PP_DEFAULTS.number,
      separator: Object.hasOwn(PP_SEPARATORS, saved.separator) ? saved.separator : PP_DEFAULTS.separator,
    };
  } catch {
    return { ...PP_DEFAULTS };
  }
}

function savePassphraseOptions(pp) {
  try {
    localStorage.setItem(PP_STORAGE_KEY, JSON.stringify(pp));
  } catch {
    /* archiviazione non disponibile */
  }
}

function loadMode() {
  try {
    const saved = localStorage.getItem(MODE_STORAGE_KEY);
    return MODES.includes(saved) ? saved : "password";
  } catch {
    return "password";
  }
}

function saveMode(mode) {
  try {
    localStorage.setItem(MODE_STORAGE_KEY, mode);
  } catch {
    /* archiviazione non disponibile */
  }
}


// ---------------------------------------------------------------------------
// Interfaccia "Caveau": ruota della cassaforte, sigillo e anteprima delle opzioni.
// ---------------------------------------------------------------------------

const SVG_NS = "http://www.w3.org/2000/svg";
const DIAL_CENTER = 200;
const BOLT_COUNT = 24;
const BOLT_STEP_MS = 22;
const STAMPS = {
  weak: "● DEBOLE",
  fair: "● FRAGILE",
  strong: "● SIGILLATA",
  "very-strong": "● SIGILLATA",
};
const bitsFormat = new Intl.NumberFormat("it-IT", {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});

function polar(radius, degrees) {
  const angle = ((degrees - 90) * Math.PI) / 180;
  return [DIAL_CENTER + radius * Math.cos(angle), DIAL_CENTER + radius * Math.sin(angle)];
}

function svgElement(tag, attributes) {
  const node = document.createElementNS(SVG_NS, tag);
  for (const [name, value] of Object.entries(attributes)) node.setAttribute(name, value);
  return node;
}

/** Disegna tacche, numeri e perni della ruota; restituisce i perni. */
function buildDial(ticks, boltsGroup) {
  for (let i = 0; i < 100; i++) {
    const deg = i * 3.6;
    const major = i % 10 === 0;
    const inner = major ? 146 : i % 5 === 0 ? 151 : 155;
    const [x1, y1] = polar(162, deg);
    const [x2, y2] = polar(inner, deg);
    ticks.appendChild(svgElement("line", { x1, y1, x2, y2, class: major ? "dial-tick major" : "dial-tick" }));
    if (major) {
      const [tx, ty] = polar(134, deg);
      const label = svgElement("text", { x: tx, y: ty + 4, "text-anchor": "middle", class: "dial-num" });
      label.textContent = String(i);
      ticks.appendChild(label);
    }
  }
  const bolts = [];
  for (let i = 0; i < BOLT_COUNT; i++) {
    const [cx, cy] = polar(176, i * (360 / BOLT_COUNT));
    const bolt = svgElement("circle", { cx, cy, r: i % 2 ? 2.4 : 4, class: "bolt" });
    boltsGroup.appendChild(bolt);
    bolts.push(bolt);
  }
  return bolts;
}

/** Righe e dimensione del carattere perche' la password stia nel quadrante. */
function fitPassword(output, length) {
  const lines = length <= 16 ? 1 : length <= 32 ? 2 : length <= 48 ? 3 : 4;
  fitBlock(output, lines, Math.ceil(length / lines));
}

/** Come fitPassword, ma le righe vanno a capo solo tra una parola e l'altra. */
function fitPassphrase(output, groups) {
  const longest = Math.max(...groups.map((group) => group.length));
  const perLine = Math.max(longest, Math.min(22, longest * 2));
  let lines = 1;
  let used = 0;
  for (const group of groups) {
    if (used && used + group.length > perLine) {
      lines += 1;
      used = 0;
    }
    used += group.length;
  }
  fitBlock(output, lines, perLine);
}

function fitBlock(output, lines, perLine) {
  // Raggio utile del quadrante (cerchio r=118 su 400) con un piccolo margine.
  const radius = (118 / 400) * output.parentElement.clientWidth * 0.94;
  const stampHeight = 54; // timbro (circa 39 px ruotato) e il suo margine, sotto la password
  // Il blocco (password + timbro) e' centrato: si riduce il carattere finche'
  // gli angoli in alto della password restano dentro il cerchio.
  let size = 19;
  while (size > 9) {
    const halfWidth = (perLine * 0.62 * size) / 2;
    const top = (lines * 1.5 * size + stampHeight) / 2;
    if (Math.hypot(halfWidth, top) <= radius) break;
    size -= 0.25;
  }
  output.style.fontSize = `${size}px`;
  output.style.maxWidth = `${perLine * 0.62 + 0.1}em`;
}

function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) return;
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch(() => {});
  });
}

/** Comparsa delle sezioni, impulso del diagramma, bordo della barra allo scroll. */
function setupMotion() {
  const topbar = document.querySelector(".topbar");
  if (topbar) {
    const onScroll = () => topbar.classList.toggle("is-scrolled", window.scrollY > 10);
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
  }
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  if (!("IntersectionObserver" in window)) return;

  // Si nascondono solo gli elementi che al caricamento sono sotto lo schermo:
  // quello che si vede subito resta visibile da subito.
  const revealer = new IntersectionObserver((entries) => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue;
      entry.target.classList.remove("is-pending");
      revealer.unobserve(entry.target);
    }
  }, { threshold: 0.15 });
  document.querySelectorAll(".reveal").forEach((node, i) => {
    if (node.getBoundingClientRect().top < window.innerHeight) return;
    node.style.transitionDelay = `${(i % 3) * 80}ms`;
    node.classList.add("is-pending");
    revealer.observe(node);
  });
  // Riserva: se l'osservatore perde un elemento (scroll molto veloce), lo scroll lo rivela
  // comunque appena e' nello schermo. Nessuna sezione deve restare nascosta.
  let checkQueued = false;
  window.addEventListener("scroll", () => {
    if (checkQueued) return;
    checkQueued = true;
    requestAnimationFrame(() => {
      checkQueued = false;
      for (const node of document.querySelectorAll(".reveal.is-pending")) {
        if (node.getBoundingClientRect().top < window.innerHeight) {
          node.classList.remove("is-pending");
          revealer.unobserve(node);
        }
      }
    });
  }, { passive: true });

  const flow = document.getElementById("flow");
  if (!flow) return;
  const pulse = () => {
    flow.classList.remove("pulse");
    void flow.offsetWidth; // riavvia l'animazione
    flow.classList.add("pulse");
  };
  new IntersectionObserver((entries) => {
    if (entries.some((entry) => entry.isIntersecting)) pulse();
  }, { threshold: 0.5 }).observe(flow);
  document.addEventListener("vaultforge:generate", pulse);
}

document.addEventListener("DOMContentLoaded", () => {
  registerServiceWorker();
  setupMotion();
  const generate = document.getElementById("generate");
  if (!generate) return; // pagine senza generatore, come /api

  const body = document.body;
  const el = {
    form: document.getElementById("options"),
    password: document.getElementById("password"),
    stamp: document.getElementById("stamp"),
    srStatus: document.getElementById("sr-status"),
    meterFill: document.getElementById("meter-fill"),
    strengthLabel: document.getElementById("strength-label"),
    entropyBits: document.getElementById("entropy-bits"),
    crackTime: document.getElementById("crack-time"),
    range: document.getElementById("length"),
    number: document.getElementById("length-number"),
    chips: [...document.querySelectorAll(".chip[data-option]")],
    ppChips: [...document.querySelectorAll(".chip[data-pp]")],
    sepChips: [...document.querySelectorAll(".chip[data-separator]")],
    modes: [...document.querySelectorAll(".mode[data-mode]")],
    lengthLabel: document.getElementById("length-label"),
    copy: document.getElementById("copy"),
    toast: document.getElementById("toast"),
    ring: document.getElementById("dial-ring"),
  };
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  const bolts = buildDial(document.getElementById("dial-ticks"), document.getElementById("dial-bolts"));

  let opts = loadOptions();
  let ppOpts = loadPassphraseOptions();
  let mode = loadMode();
  let current = "";
  let currentGroups = null; // gruppi di parole della passphrase mostrata, null per le password
  let sealing = false;
  let staleWhileSealing = false;
  let ringAngle = 0;
  let toastTimer;

  function showToast(message) {
    el.toast.textContent = message;
    el.toast.classList.add("visible");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.toast.classList.remove("visible"), 2000);
  }

  const isPassphrase = () => mode === "passphrase";
  const noun = () => (isPassphrase() ? "passphrase" : "password");

  function syncForm() {
    const [min, max, value] = isPassphrase()
      ? [PP_MIN_WORDS, PP_MAX_WORDS, ppOpts.words]
      : [MIN_LENGTH, MAX_LENGTH, opts.length];
    for (const input of [el.range, el.number]) {
      input.min = min;
      input.max = max;
      input.value = value;
    }
    el.lengthLabel.textContent = isPassphrase() ? "Parole" : "Lunghezza";
    el.number.setAttribute("aria-label", isPassphrase() ? "Numero di parole" : "Lunghezza in caratteri");
    body.classList.toggle("mode-passphrase", isPassphrase());
    for (const button of el.modes) button.setAttribute("aria-pressed", String(button.dataset.mode === mode));
    for (const chip of el.chips) chip.setAttribute("aria-pressed", String(opts[chip.dataset.option]));
    for (const chip of el.ppChips) chip.setAttribute("aria-pressed", String(ppOpts[chip.dataset.pp]));
    for (const chip of el.sepChips) chip.setAttribute("aria-pressed", String(chip.dataset.separator === ppOpts.separator));
  }

  function currentBits() {
    return isPassphrase() ? passphraseEntropyBits(ppOpts) : entropyBits(opts);
  }

  function fitCurrent() {
    if (currentGroups) fitPassphrase(el.password, currentGroups);
    else if (current) fitPassword(el.password, current.length);
  }

  /** Spazi per ogni carattere; nelle passphrase raggruppati per parola, che non va mai spezzata. */
  function buildSpans(text, groups) {
    const chars = [];
    const makeChar = () => {
      const span = document.createElement("span");
      span.className = "ch";
      chars.push(span);
      return span;
    };
    if (!groups) {
      el.password.replaceChildren(...[...text].map(makeChar));
      return chars;
    }
    el.password.replaceChildren(...groups.map((group) => {
      const word = document.createElement("span");
      word.className = "w";
      word.append(...[...group].map(makeChar));
      return word;
    }));
    return chars;
  }

  function showStrength(bits, preview) {
    const level = strengthOf(bits);
    body.dataset.level = level.key;
    el.meterFill.style.width = `${Math.min(100, (bits / METER_FULL_BITS) * 100)}%`;
    el.strengthLabel.textContent = preview ? `Anteprima: ${level.label.toLowerCase()}` : level.label;
    return level;
  }

  function setBusy(busy) {
    generate.setAttribute("aria-disabled", String(busy));
    el.copy.setAttribute("aria-disabled", String(busy));
  }

  function sealOff() {
    el.stamp.classList.remove("show");
    for (const bolt of bolts) bolt.classList.remove("on");
  }

  function spinRing() {
    const a1 = ringAngle + 360 + randomInt(180);
    const a2 = a1 - 270 - randomInt(120);
    const a3 = a2 + 90 + randomInt(90);
    el.ring.animate(
      [
        { transform: `rotate(${ringAngle}deg)` },
        { transform: `rotate(${a1}deg)`, offset: 0.45 },
        { transform: `rotate(${a2}deg)`, offset: 0.8 },
        { transform: `rotate(${a3}deg)` },
      ],
      { duration: 1500, easing: "cubic-bezier(.45,.05,.25,1)", fill: "forwards" }
    );
    ringAngle = a3;
  }

  /** I caratteri scorrono a caso e si fissano da sinistra a destra. */
  function scramble(password, groups, done) {
    const alphabet = groups ? "abcdefghilmnopqrstuvz" : characterPools(opts).join("");
    const spans = buildSpans(password, groups);
    const start = performance.now();
    const lockStart = 500;
    const lockSpan = 900;
    const locked = new Array(password.length).fill(false);
    (function frame(now) {
      const t = now - start;
      spans.forEach((span, i) => {
        if (locked[i]) return;
        if (t > lockStart + i * (lockSpan / password.length)) {
          span.textContent = password[i];
          span.classList.add("lock");
          locked[i] = true;
        } else {
          span.textContent = alphabet[randomInt(alphabet.length)];
        }
      });
      if (locked.every(Boolean)) done();
      else requestAnimationFrame(frame);
    })(start);
  }

  function lightBolts(done) {
    bolts.forEach((bolt, i) => setTimeout(() => bolt.classList.add("on"), i * BOLT_STEP_MS));
    setTimeout(done, BOLT_COUNT * BOLT_STEP_MS + 60);
  }

  function countBits(target) {
    if (reducedMotion.matches) {
      el.entropyBits.textContent = bitsFormat.format(target);
      return;
    }
    const start = performance.now();
    (function tick(now) {
      const p = Math.min(1, (now - start) / 700);
      el.entropyBits.textContent = bitsFormat.format(target * (1 - (1 - p) ** 3));
      if (p < 1) requestAnimationFrame(tick);
    })(start);
  }

  function seal() {
    if (sealing) return;
    sealing = true;
    staleWhileSealing = false;
    body.classList.remove("is-stale");
    body.classList.add("is-sealing");
    // aria-disabled invece di disabled: disattivare il pulsante col focus farebbe
    // perdere la posizione a chi usa la tastiera. Il blocco vero e' `sealing`.
    setBusy(true);
    document.dispatchEvent(new CustomEvent("vaultforge:generate"));

    const made = isPassphrase() ? generatePassphrase(ppOpts) : { text: generatePassword(opts), groups: null };
    const password = made.text;
    const bits = currentBits();
    current = password;
    currentGroups = made.groups;
    el.password.classList.toggle("words", Boolean(made.groups));
    sealOff();
    el.meterFill.style.width = "0";
    el.entropyBits.textContent = bitsFormat.format(0);
    el.strengthLabel.textContent = "Sigillo in corso…";
    el.crackTime.textContent = " ";
    fitCurrent();

    const finish = () => {
      const level = showStrength(bits, false);
      el.stamp.textContent = STAMPS[level.key];
      el.stamp.classList.add("show");
      countBits(bits);
      el.crackTime.textContent =
        `Tempo stimato per indovinarla con un attacco offline: ${crackTimeText(bits)}.`;
      el.srStatus.textContent = `Nuova ${noun()} generata: ${level.label.toLowerCase()}.`;
      sealing = false;
      body.classList.remove("is-sealing");
      setBusy(false);
      if (staleWhileSealing) markStale();
    };

    if (reducedMotion.matches) {
      buildSpans(password, made.groups).forEach((span, i) => { span.textContent = password[i]; });
      for (const bolt of bolts) bolt.classList.add("on");
      finish();
      return;
    }
    spinRing();
    scramble(password, made.groups, () => lightBolts(finish));
  }

  /** Le opzioni sono cambiate: niente nuova password, solo l'anteprima della robustezza. */
  function markStale() {
    if (sealing) {
      staleWhileSealing = true;
      return;
    }
    body.classList.add("is-stale");
    sealOff();
    const bits = currentBits();
    showStrength(bits, true);
    el.entropyBits.textContent = bitsFormat.format(bits);
    el.crackTime.textContent = `Opzioni cambiate. Premi «Genera e sigilla» per una nuova ${noun()}.`;
  }

  function update(changes) {
    opts = { ...opts, ...changes };
    saveOptions(opts);
    syncForm();
    markStale();
  }

  function updatePassphrase(changes) {
    ppOpts = { ...ppOpts, ...changes };
    savePassphraseOptions(ppOpts);
    syncForm();
    markStale();
  }

  function onLengthInput(value) {
    if (isPassphrase()) updatePassphrase({ words: clampWords(value) });
    else update({ length: clampLength(value) });
  }

  el.range.addEventListener("input", () => onLengthInput(el.range.value));
  el.number.addEventListener("change", () => onLengthInput(el.number.value));

  for (const chip of el.ppChips) {
    chip.addEventListener("click", () => updatePassphrase({ [chip.dataset.pp]: !ppOpts[chip.dataset.pp] }));
  }
  for (const chip of el.sepChips) {
    chip.addEventListener("click", () => updatePassphrase({ separator: chip.dataset.separator }));
  }

  // Cambiando modalita' si genera subito: chi preme "Passphrase" la vuole vedere.
  for (const button of el.modes) {
    button.addEventListener("click", () => {
      if (sealing || button.dataset.mode === mode) return;
      mode = button.dataset.mode;
      saveMode(mode);
      syncForm();
      seal();
    });
  }

  for (const chip of el.chips) {
    chip.addEventListener("click", () => {
      const key = chip.dataset.option;
      const next = { ...opts, [key]: !opts[key] };
      if (characterPools(next).length === 0) {
        showToast("Serve almeno un tipo di carattere");
        return;
      }
      update({ [key]: next[key] });
    });
  }

  el.form.addEventListener("submit", (event) => event.preventDefault());
  generate.addEventListener("click", seal);

  el.copy.addEventListener("click", async () => {
    if (sealing) return; // mai copiare una password non ancora sigillata
    let ok = false;
    try {
      await navigator.clipboard.writeText(current);
      ok = true;
    } catch {
      ok = fallbackCopy(current);
    }
    if (!ok) showToast("Copia non riuscita: selezionala a mano");
    else if (body.classList.contains("is-stale")) {
      // Le opzioni sono cambiate: si e' copiata quella mostrata (sfocata), non una nuova.
      showToast(`${isPassphrase() ? "Passphrase" : "Password"} precedente copiata: premi «Genera e sigilla» per una nuova`);
    } else showToast(`${isPassphrase() ? "Passphrase" : "Password"} copiata negli appunti`);
  });

  // Se la ruota cambia dimensione (rotazione del telefono, finestra ridimensionata)
  // la password va riadattata al nuovo quadrante.
  if ("ResizeObserver" in window) {
    new ResizeObserver(() => {
      fitCurrent();
    }).observe(el.password.parentElement);
  }

  syncForm();
  seal();
});
