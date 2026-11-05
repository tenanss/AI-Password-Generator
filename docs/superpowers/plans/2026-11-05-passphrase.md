# Passphrase in italiano Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Aggiungere a VaultForge la modalità Passphrase (parole italiane BIP-39) nel browser e nell'API, come da bozza approvata.

**Architecture:** La lista BIP-39 vive in `static/wordlists/it-bip39.txt` (fonte unica); uno script genera `static/js/wordlist-it.js`, caricato con la pagina, e un test verifica che coincidano. Il server legge il `.txt` in un nuovo modulo `passphrase.py`. In `app.js` si aggiungono funzioni pure per le passphrase accanto a quelle esistenti e l'interfaccia gestisce due modalità.

**Tech Stack:** come oggi: Python 3.14, FastAPI, Jinja2, pytest; JS/CSS vanilla; Playwright MCP per le verifiche nel browser.

**Spec:** `docs/superpowers/specs/2026-11-05-passphrase-design.md` — bozza approvata: `docs/superpowers/specs/2026-11-05-passphrase-prototipo.html` (markup, CSS e comportamento del selettore e delle pillole da lì). Vincoli generali ereditati: `docs/superpowers/specs/2026-11-05-restyling-caveau-design.md`.

## Global Constraints

- Branch `passphrase-italiana`; mai commit su `main`. Ogni commit termina con `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- CSP invariata: niente script/stili inline, niente `style=`/`onclick` nell'HTML, nessuna risorsa esterna.
- Lista: BIP-39 italiano, 2.048 parole, 11 bit/parola; scaricata con la pagina, **mai durante la generazione**.
- Valori predefiniti passphrase: 7 parole, maiuscola sì (solo prima lettera della prima parola), cifra finale sì (in fondo all'ultima parola), separatore `-`. Intervallo parole 4–10. Separatori: `-`, `.`, `_`, spazio (API: `space`).
- Entropia passphrase = parole × log₂(2048) + (cifra ? log₂(10) : 0). Soglie, colori e timbri invariati.
- Modalità predefinita della pagina: Password. Cambiando modalità si genera subito.
- Testi: "Parole", "Maiuscola", "Cifra finale", "separatore", "Per le password da ricordare e digitare: computer, gestore di password, Wi-Fi.", "Opzioni cambiate. Premi «Genera e sigilla» per una nuova passphrase.", "Passphrase precedente copiata: premi «Genera e sigilla» per una nuova", toast copia normale "Passphrase copiata negli appunti".
- Preferenze: chiave esistente `vaultforge:options` invariata (compatibile 1.1.0); nuove chiavi `vaultforge:passphrase` e `vaultforge:mode`. Mai salvare passphrase.
- `APP_VERSION = "1.2.0"`.

## Review Focus

1. **10 parole lunghe a 360 px:** tutta la passphrase dentro il quadrante, nessuna parola spezzata. → Task 3, step 6.
2. **Cambio di modalità o di opzioni durante il sigillo:** nessuna doppia animazione; il cambio di modalità durante il sigillo viene ignorato; le opzioni cambiate portano all'anteprima a sigillo finito. → Task 3, step 6.
3. **Preferenze salvate rovinate o vecchie:** `vaultforge:passphrase` con `{"words":99,"separator":"x"}` → valori validi (10 e `-`); preferenze 1.1.0 della password intatte. → Task 3, step 6.
4. **Animazioni ridotte in modalità passphrase:** stato finale subito, copia attiva. → Task 3, step 6.
5. **Offline e nessuna richiesta di rete in modalità passphrase:** dopo il caricamento, generare 5 passphrase non produce richieste; offline la modalità funziona. → Task 4, step 5.

---

### Task 1: Lista di parole e generazione lato server

**Files:**
- Create: `static/wordlists/it-bip39.txt`, `static/wordlists/LICENSE-BIP39.txt`
- Create: `tools/make_wordlist_js.py`, `static/js/wordlist-it.js`
- Create: `passphrase.py`
- Test: `tests/test_passphrase.py`

**Interfaces:**
- Produces (Python, `passphrase.py`): `MIN_WORDS = 4`, `MAX_WORDS = 10`, `DEFAULT_WORDS = 7`, `SEPARATORS = {"-": "-", ".": ".", "_": "_", "space": " "}`, `WORDLIST: tuple[str, ...]` (letta da `static/wordlists/it-bip39.txt`), `@dataclass(frozen=True) class PassphraseOptions(words: int = 7, capitalize: bool = True, number: bool = True, separator: str = "-")` (`separator` è una chiave di `SEPARATORS`), `generate_passphrase(options: PassphraseOptions = PassphraseOptions()) -> str` (ValueError se `words` fuori 4–10 o separatore sconosciuto), `entropy_bits(options: PassphraseOptions) -> float`.
- Produces (JS): `static/js/wordlist-it.js` definisce `const WORDLIST_IT = Object.freeze([...])` (2.048 stringhe, stesso ordine del `.txt`).

- [ ] **Step 1: Scrivi i test che falliscono**

```python
import json, math, re
from pathlib import Path
import pytest
import passphrase as pp

ROOT = Path(__file__).resolve().parent.parent

def test_wordlist_is_bip39_italian():
    assert len(pp.WORDLIST) == 2048 and len(set(pp.WORDLIST)) == 2048
    assert all(re.fullmatch(r"[a-z]{3,9}", w) for w in pp.WORDLIST)  # niente accenti
    assert pp.WORDLIST[0] == "abaco" and pp.WORDLIST[-1] == "zuppa"

def test_js_wordlist_matches_txt():
    js = (ROOT / "static/js/wordlist-it.js").read_text(encoding="utf-8")
    array = json.loads(js[js.index("["): js.rindex("]") + 1])
    assert array == list(pp.WORDLIST)

def test_license_file_present():
    assert "MIT" in (ROOT / "static/wordlists/LICENSE-BIP39.txt").read_text(encoding="utf-8")

def test_default_passphrase_shape():
    text = pp.generate_passphrase()
    parts = text.split("-")
    assert len(parts) == 7
    assert parts[0][0].isupper() and parts[0].lower() in pp.WORDLIST
    assert parts[-1][-1].isdigit() and parts[-1][:-1] in pp.WORDLIST
    assert all(p in pp.WORDLIST for p in parts[1:-1])

@pytest.mark.parametrize("sep,char", [("-", "-"), (".", "."), ("_", "_"), ("space", " ")])
def test_separators(sep, char):
    text = pp.generate_passphrase(pp.PassphraseOptions(words=5, capitalize=False, number=False, separator=sep))
    assert text.split(char) and all(w in pp.WORDLIST for w in text.split(char)) and len(text.split(char)) == 5

def test_entropy_values():
    assert pp.entropy_bits(pp.PassphraseOptions()) == pytest.approx(7 * 11 + math.log2(10))  # 80,3
    assert pp.entropy_bits(pp.PassphraseOptions(words=4, number=False)) == pytest.approx(44)

@pytest.mark.parametrize("bad", [dict(words=3), dict(words=11), dict(separator="x")])
def test_rejects_bad_options(bad):
    with pytest.raises(ValueError):
        pp.generate_passphrase(pp.PassphraseOptions(**bad))
```

- [ ] **Step 2: Esegui e verifica che falliscano**

Run: `.venv/Scripts/python -m pytest tests/test_passphrase.py -q`
Expected: errore di import (`passphrase` non esiste).

- [ ] **Step 3: Scarica la lista e la licenza**

Lista: `https://raw.githubusercontent.com/bitcoin/bips/master/bip-0039/italian.txt` → `static/wordlists/it-bip39.txt` (una parola per riga, fine riga `\n`). Licenza: testo MIT standard con l'intestazione "BIP-39 Italian wordlist — from https://github.com/bitcoin/bips/tree/master/bip-0039 — License: MIT (as stated in BIP-39)" e il copyright degli autori del BIP-39 come indicato nel BIP (Marek Palatinus, Pavol Rusnak, Aaron Voisine, Sean Bowe).

- [ ] **Step 4: Scrivi `tools/make_wordlist_js.py` e genera `wordlist-it.js`**

`main() -> None`: legge il `.txt` e scrive `static/js/wordlist-it.js` con un commento d'intestazione (fonte, licenza, "generato da tools/make_wordlist_js.py: non modificare a mano") e `const WORDLIST_IT = Object.freeze(<array JSON su una riga>);`.

- [ ] **Step 5: Scrivi `passphrase.py`**

Usa `secrets.randbelow` / `secrets.choice` (stessa garanzia di `generator.py`). Maiuscola: solo la prima lettera della prima parola. Cifra: `secrets.randbelow(10)` in coda all'ultima parola. Validazione: `ValueError` con messaggio in italiano.

- [ ] **Step 6: Esegui tutti i test**

Run: `.venv/Scripts/python -m pytest -q`
Expected: tutti PASS.

- [ ] **Step 7: Commit**

```bash
git add static/wordlists tools/make_wordlist_js.py static/js/wordlist-it.js passphrase.py tests/test_passphrase.py
git commit -m "Lista BIP-39 italiana e generazione delle passphrase lato server"
```

---

### Task 2: API `/api/v1/passphrase` e documentazione

**Files:**
- Modify: `main.py` (nuova rotta), `templates/api.html` (nuova sezione), `static/css/app.css` (solo se serve)
- Test: `tests/test_app.py`

**Interfaces:**
- Consumes: `passphrase.PassphraseOptions`, `passphrase.generate_passphrase`, `passphrase.entropy_bits`, `passphrase.MIN_WORDS/MAX_WORDS/DEFAULT_WORDS`, `generator.strength`.
- Produces: `GET /api/v1/passphrase?words&capitalize&number&separator` → `{"passphrase": str, "words": int, "entropy_bits": float (1 decimale), "strength": str}`; `separator` tipizzato `Literal["-", ".", "_", "space"]` (valore diverso → 422 di FastAPI).

- [ ] **Step 1: Scrivi i test che falliscono**

```python
def test_api_passphrase_defaults():
    res = client.get("/api/v1/passphrase")
    assert res.status_code == 200 and res.headers["cache-control"] == "no-store"
    body = res.json()
    assert body["words"] == 7 and len(body["passphrase"].split("-")) == 7
    assert body["entropy_bits"] == 80.3 and body["strength"] == "strong"

def test_api_passphrase_space_separator():
    body = client.get("/api/v1/passphrase", params={"words": 4, "separator": "space", "number": False}).json()
    assert len(body["passphrase"].split(" ")) == 4 and body["strength"] == "weak"

@pytest.mark.parametrize("params", [{"words": 3}, {"words": 11}, {"separator": "x"}])
def test_api_passphrase_rejects_bad_input(params):
    assert client.get("/api/v1/passphrase", params=params).status_code == 422

def test_api_docs_cover_passphrase():
    html = client.get("/api").text
    for needle in ("/api/v1/passphrase", "<code>words</code>", "<code>separator</code>",
                   "<code>space</code>", "MIT"):
        assert needle in html
```

- [ ] **Step 2: Esegui e verifica che falliscano**

Run: `.venv/Scripts/python -m pytest tests/test_app.py -k "passphrase" -q`
Expected: FAIL (404, testo mancante).

- [ ] **Step 3: Implementa `api_passphrase(...)` in `main.py`**

Stessa forma di `api_generate`: `Query(ge=MIN_WORDS, le=MAX_WORDS)` per `words`, `ValueError` → 422.

- [ ] **Step 4: Aggiungi la sezione in `templates/api.html`**

Dopo "Errori" della password, una sezione "Passphrase" con: a cosa serve (password da ricordare), tabella parametri (`words` 4–10 default 7; `capitalize` true; `number` true; `separator` `-` `.` `_` `space`, default `-`), esempio `curl` con l'URL pubblico e una risposta reale ottenuta chiamando l'API locale, formula dell'entropia (parole × 11 bit + 3,3 bit della cifra), errori 422. In fondo alla pagina: "Lista di parole: BIP-39 italiano, licenza MIT."

- [ ] **Step 5: Esegui tutti i test**

Run: `.venv/Scripts/python -m pytest -q` → tutti PASS.

- [ ] **Step 6: Commit**

```bash
git add main.py templates/api.html static/css/app.css tests/test_app.py
git commit -m "API /api/v1/passphrase e documentazione"
```

---

### Task 3: Modalità Passphrase nella pagina

**Files:**
- Modify: `templates/base.html` (carica `wordlist-it.js` prima di `app.js`, entrambi `defer`)
- Modify: `templates/index.html` (selettore e controlli), `static/css/app.css`, `static/js/app.js`
- Test: `tests/test_app.py`

**Interfaces:**
- Consumes: `WORDLIST_IT` (Task 1); id e stati esistenti della pagina (`#password`, `#stamp`, `body.is-stale`, `body.is-sealing`, `data-level`, `fitPassword`, `seal`, `markStale`, `randomInt`).
- Produces (markup): `div.modes[role=group]` con `button.mode[data-mode="password"|"passphrase"][aria-pressed]`; in `#options`: `#length-label` (testo "Lunghezza"/"Parole"), contenitore `.pw-only` (pillole caratteri) e `.pp-only` (pillole `button.chip[data-pp="capitalize"|"number"][aria-pressed]`, pillole separatore `button.chip[data-separator="-"|"."|"_"|"space"][aria-pressed]`, riga di aiuto); classe `mode-passphrase` sul `body`.
- Produces (JS, funzioni pure in `app.js`): `PP_DEFAULTS = { words: 7, capitalize: true, number: true, separator: "-" }`, `generatePassphrase(ppOpts) -> { text: string, groups: string[] }` (ogni gruppo = parola + separatore tranne l'ultimo), `passphraseEntropyBits(ppOpts) -> number`, `loadPassphraseOptions()` / `savePassphraseOptions(ppOpts)` (chiave `vaultforge:passphrase`, valori non validi → default, `words` limitato a 4–10), `loadMode()` / `saveMode(mode)` (chiave `vaultforge:mode`, valori `"password"|"passphrase"`, default `"password"`).

- [ ] **Step 1: Scrivi i test che falliscono**

```python
def test_index_has_mode_switch_and_passphrase_controls():
    html = client.get("/").text
    for needle in ('data-mode="password"', 'data-mode="passphrase"', 'data-pp="capitalize"',
                   'data-pp="number"', 'data-separator="space"', "Cifra finale",
                   "Per le password da ricordare e digitare", f"wordlist-it.js?v={APP_VERSION}"):
        assert needle in html
    assert html.index("wordlist-it.js") < html.index("js/app.js")
    assert "style=" not in html and "<script>" not in html
```

- [ ] **Step 2: Esegui e verifica che fallisca**

Run: `.venv/Scripts/python -m pytest tests/test_app.py -k "mode_switch" -q` → FAIL.

- [ ] **Step 3: Markup e CSS**

Dalla bozza: selettore sopra la ruota, pillole e riga di aiuto; tutte le pillole sono `<button type="button">` con `aria-pressed` e `aria-label` esplicito ("Iniziale maiuscola", "Cifra finale", "Separatore trattino", "Separatore punto", "Separatore trattino basso", "Separatore spazio"). Visibilità con `body.mode-passphrase .pw-only/.pp-only`. Classe `.pw.words` con gruppi `.w` `inline-block` e `white-space: nowrap`.

- [ ] **Step 4: JS**

Funzioni pure dell'Interfaces sopra. Nell'interfaccia: stato `mode`; `seal()` usa `generatePassphrase` in modalità passphrase, costruisce i gruppi `.w` con i caratteri `.ch` dentro, lettere di passaggio `"abcdefghilmnopqrstuvz"` (con `randomInt`); `fitPassword` accetta righe e caratteri per riga calcolati sui gruppi (righe = gruppi distribuiti finché la riga non supera la parola più lunga × 2, massimo 22 caratteri, come nella bozza) mantenendo il controllo degli angoli; `markStale()` usa `passphraseEntropyBits` e il testo della passphrase; slider/campo numerico passano a 4–10 in modalità passphrase e ogni modalità ricorda il proprio valore; clic sul selettore durante `sealing` ignorato, altrimenti `saveMode`, aggiorna controlli e genera; testi dei toast di copia come in Global Constraints; il messaggio per lo screen reader dice "Nuova passphrase generata: …".

- [ ] **Step 5: Test Python**

Run: `.venv/Scripts/python -m pytest -q` → tutti PASS.

- [ ] **Step 6: Verifiche nel browser (Playwright, server riavviato, cache svuotata)**

1. Selettore → Passphrase: 7 gruppi separati da `-`, prima lettera maiuscola, cifra finale, timbro SIGILLATA, `#strength-label` "Forte", bit "80,3".
2. Review Focus 1: 10 parole, più generazioni, a 1280 e 360 px: angoli di `#password` dentro il quadrante; nessun `.w` spezzato su due righe (altezza di ogni `.w` = una riga).
3. Review Focus 2: doppio clic su generate → 1 animazione; clic su "Password" durante il sigillo → ignorato; cambio parole durante il sigillo → anteprima alla fine.
4. Review Focus 3: `localStorage["vaultforge:passphrase"] = {"words":99,"separator":"x"}` e `vaultforge:mode = "passphrase"` → ricarica: modalità passphrase, 10 parole, separatore `-`; le preferenze password di `vaultforge:options` restano quelle salvate.
5. Review Focus 4: `reducedMotion: "reduce"` in passphrase → stato finale subito, copia attiva.
6. 4 parole senza cifra → "Debole", timbro DEBOLE; anteprima e toast "Passphrase precedente copiata…" con opzioni cambiate.

- [ ] **Step 7: Commit**

```bash
git add templates/base.html templates/index.html static/css/app.css static/js/app.js tests/test_app.py
git commit -m "Modalità Passphrase nella pagina"
```

---

### Task 4: Testi, offline, versione 1.2.0, README

**Files:**
- Modify: `templates/index.html` (testi Come funziona / Sicurezza), `templates/sw.js`, `main.py` (`APP_VERSION`), `README.md`
- Test: `tests/test_app.py`

- [ ] **Step 1: Scrivi i test che falliscono**

```python
def test_service_worker_caches_wordlist():
    sw = client.get("/sw.js").text
    assert "vaultforge-1.2.0" in sw and f'"/static/js/wordlist-it.js?v={APP_VERSION}"' in sw

def test_index_explains_passphrase_security():
    html = client.get("/").text
    assert "passphrase" in html.lower() and "11 bit" in html and "conosce la lista" in html
```

- [ ] **Step 2: Esegui e verifica che falliscano** — `.venv/Scripts/python -m pytest tests/test_app.py -k "wordlist or passphrase_security" -q` → FAIL.

- [ ] **Step 3: Aggiorna testi, service worker, versione, README**

Testi (spec, sezione "Testi del sito da aggiornare"): passaggio 01 cita anche le passphrase (da 4 a 10 parole, separatore); passaggio 04 aggiunge "Passphrase: parole × 11 bit (lista di 2.048 parole), più 3,3 bit per la cifra."; nella sezione Sicurezza, dopo le sei schede, una nota: "Le passphrase restano robuste anche se un attaccante conosce la lista: le parole le sceglie il computer a caso. Una passphrase con parole scelte da una persona è molto più debole." `sw.js`: aggiungi `/static/js/wordlist-it.js?v={{ version }}`. README: funzionalità, API passphrase, struttura (`passphrase.py`, `static/wordlists/`, `tools/make_wordlist_js.py`), crediti BIP-39 MIT, roadmap con la passphrase spuntata.

- [ ] **Step 4: Esegui tutti i test** — `.venv/Scripts/python -m pytest -q` → tutti PASS.

- [ ] **Step 5: Verifica offline e assenza di richieste (Review Focus 5)**

Con Playwright: apri `/`, attendi il service worker, passa a Passphrase, registra le richieste di rete, genera 5 passphrase: nessuna richiesta. Metti offline, ricarica: la modalità passphrase genera; `caches.keys()` = solo `vaultforge-1.2.0`.

- [ ] **Step 6: Commit**

```bash
git add templates/index.html templates/sw.js main.py README.md tests/test_app.py
git commit -m "Testi sulla passphrase, cache offline e versione 1.2.0"
```

---

### Task 5: Verifica finale e pubblicazione

- [ ] **Step 1:** `.venv/Scripts/python -m pytest -q` → tutti PASS.
- [ ] **Step 2:** Giro Playwright a 1280×800 e 390×844 su `/` (entrambe le modalità) e `/api`: console pulita, nessuno scroll orizzontale.
- [ ] **Step 3:** Revisione finale indipendente dell'intero branch; correzione dei problemi importanti con test.
- [ ] **Step 4:** Con l'ok dell'utente: unione su `main`, push, attesa del deploy Render, verifica di `/`, `/api`, `/api/v1/passphrase` e della versione 1.2.0 sul sito pubblico.
