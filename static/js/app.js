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

document.addEventListener("DOMContentLoaded", () => {
  const el = {
    form: document.getElementById("options"),
    password: document.getElementById("password"),
    copy: document.getElementById("copy"),
    generate: document.getElementById("generate"),
    range: document.getElementById("length"),
    number: document.getElementById("length-number"),
    meter: document.querySelector(".meter"),
    meterFill: document.getElementById("meter-fill"),
    strengthLabel: document.getElementById("strength-label"),
    entropy: document.getElementById("entropy"),
    crackTime: document.getElementById("crack-time"),
    toast: document.getElementById("toast"),
  };
  const checkboxes = [...el.form.querySelectorAll('input[type="checkbox"]')];
  let opts = loadOptions();
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
    for (const box of checkboxes) box.checked = opts[box.name];
  }

  function render() {
    el.password.textContent = generatePassword(opts);
    const bits = entropyBits(opts);
    const level = strengthOf(bits);
    el.meter.dataset.level = level.key;
    el.meterFill.style.width = `${Math.min(100, (bits / METER_FULL_BITS) * 100)}%`;
    el.strengthLabel.textContent = level.label;
    el.entropy.textContent = `${numberFormat.format(bits)} bit di entropia`;
    el.crackTime.textContent =
      `Tempo stimato per indovinarla con un attacco offline: ${crackTimeText(bits)}.`;
  }

  function update(changes) {
    opts = { ...opts, ...changes };
    saveOptions(opts);
    syncForm();
    render();
  }

  el.range.addEventListener("input", () => update({ length: clampLength(el.range.value) }));
  el.number.addEventListener("change", () => update({ length: clampLength(el.number.value) }));

  for (const box of checkboxes) {
    box.addEventListener("change", () => {
      const next = { ...opts, [box.name]: box.checked };
      if (characterPools(next).length === 0) {
        box.checked = true;
        showToast("Serve almeno un tipo di carattere");
        return;
      }
      update({ [box.name]: box.checked });
    });
  }

  el.form.addEventListener("submit", (event) => event.preventDefault());
  el.generate.addEventListener("click", render);

  el.copy.addEventListener("click", async () => {
    const text = el.password.textContent;
    let ok = false;
    try {
      await navigator.clipboard.writeText(text);
      ok = true;
    } catch {
      ok = fallbackCopy(text);
    }
    showToast(ok ? "Password copiata negli appunti" : "Copia non riuscita: selezionala a mano");
  });

  syncForm();
  render();

  if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    });
  }
});
