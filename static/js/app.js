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
  const perLine = Math.ceil(length / lines);
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

document.addEventListener("DOMContentLoaded", () => {
  registerServiceWorker();
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
    copy: document.getElementById("copy"),
    toast: document.getElementById("toast"),
    ring: document.getElementById("dial-ring"),
  };
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  const bolts = buildDial(document.getElementById("dial-ticks"), document.getElementById("dial-bolts"));

  let opts = loadOptions();
  let current = "";
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

  function syncForm() {
    el.range.value = opts.length;
    el.number.value = opts.length;
    for (const chip of el.chips) chip.setAttribute("aria-pressed", String(opts[chip.dataset.option]));
  }

  function showStrength(bits, preview) {
    const level = strengthOf(bits);
    body.dataset.level = level.key;
    el.meterFill.style.width = `${Math.min(100, (bits / METER_FULL_BITS) * 100)}%`;
    el.strengthLabel.textContent = preview ? `Anteprima: ${level.label.toLowerCase()}` : level.label;
    return level;
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
  function scramble(password, done) {
    const alphabet = characterPools(opts).join("");
    const spans = [...password].map(() => {
      const span = document.createElement("span");
      span.className = "ch";
      return span;
    });
    el.password.replaceChildren(...spans);
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
    generate.disabled = true;
    el.copy.disabled = true;
    document.dispatchEvent(new CustomEvent("vaultforge:generate"));

    const password = generatePassword(opts);
    const bits = entropyBits(opts);
    current = password;
    sealOff();
    el.meterFill.style.width = "0";
    el.entropyBits.textContent = bitsFormat.format(0);
    el.strengthLabel.textContent = "Sigillo in corso…";
    el.crackTime.textContent = " ";
    fitPassword(el.password, password.length);

    const finish = () => {
      const level = showStrength(bits, false);
      el.stamp.textContent = STAMPS[level.key];
      el.stamp.classList.add("show");
      countBits(bits);
      el.crackTime.textContent =
        `Tempo stimato per indovinarla con un attacco offline: ${crackTimeText(bits)}.`;
      el.srStatus.textContent = `Nuova password generata: ${level.label.toLowerCase()}.`;
      sealing = false;
      body.classList.remove("is-sealing");
      generate.disabled = false;
      el.copy.disabled = false;
      if (staleWhileSealing) markStale();
    };

    if (reducedMotion.matches) {
      el.password.textContent = password;
      for (const bolt of bolts) bolt.classList.add("on");
      finish();
      return;
    }
    spinRing();
    scramble(password, () => lightBolts(finish));
  }

  /** Le opzioni sono cambiate: niente nuova password, solo l'anteprima della robustezza. */
  function markStale() {
    if (sealing) {
      staleWhileSealing = true;
      return;
    }
    body.classList.add("is-stale");
    sealOff();
    const bits = entropyBits(opts);
    showStrength(bits, true);
    el.entropyBits.textContent = bitsFormat.format(bits);
    el.crackTime.textContent = "Opzioni cambiate. Premi «Genera e sigilla» per una nuova password.";
  }

  function update(changes) {
    opts = { ...opts, ...changes };
    saveOptions(opts);
    syncForm();
    markStale();
  }

  el.range.addEventListener("input", () => update({ length: clampLength(el.range.value) }));
  el.number.addEventListener("change", () => update({ length: clampLength(el.number.value) }));

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
    let ok = false;
    try {
      await navigator.clipboard.writeText(current);
      ok = true;
    } catch {
      ok = fallbackCopy(current);
    }
    showToast(ok ? "Password copiata negli appunti" : "Copia non riuscita: selezionala a mano");
  });

  syncForm();
  seal();
});
