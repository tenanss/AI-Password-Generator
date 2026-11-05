# Restyling "Caveau" Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Portare nell'app vera il design "Caveau" approvato: generatore animato nella ruota, sezioni Come funziona e Sicurezza, pagina `/api`, font e icone nuove.

**Architecture:** FastAPI + Jinja2 restano. Un template base (`base.html`) con barra e footer condivisi da `index.html` e dalla nuova `api.html`. CSS e JS vanilla in file statici (la CSP vieta inline). La logica di generazione in `app.js` non cambia: si riscrive solo l'interfaccia attorno a lei.

**Tech Stack:** Python 3.14, FastAPI 0.162, Jinja2, pytest; JS/CSS vanilla; Pillow (solo sviluppo, per le icone); Playwright MCP per le verifiche nel browser.

**Spec:** `docs/superpowers/specs/2026-11-05-restyling-caveau-design.md` — riferimento visivo e testi definitivi: `docs/superpowers/specs/2026-11-05-restyling-caveau-prototipo.html`. Quando il piano dice "come nel prototipo", copia da lì markup, testi e CSS, adattandoli ai vincoli qui sotto.

## Global Constraints

- CSP invariata in `main.py` (`default-src 'self'; script-src 'self'; style-src 'self'; ...`): niente `<script>`/`<style>` inline, niente `style=` né `onclick` nell'HTML. Stili da JS solo via CSSOM (`el.style.x`) o classi.
- Nessuna risorsa esterna: niente Google Fonts, CDN o analytics. Le uniche URL esterne ammesse sono link `<a href>` (GitHub, securityheaders.com).
- Font in `static/fonts/` (woff2, sottoinsieme latino): Fraunces normale e corsivo, Inter, JetBrains Mono, con i file di licenza OFL.
- Palette: `--bg #0d0e11`, `--surface #15161a`, `--line #26272d`, `--text #ece7db`, `--muted #8f8b82`, `--brass #c9a35b`, `--brass-hi #f0d79e`, `--brass-dim #5c4c2c`. Livelli: weak `#c4513b`, fair `#d0883a`, strong `var(--brass)`, very-strong `var(--brass-hi)`.
- Soglie e etichette invariate: < 50 Debole, < 70 Discreta, < 100 Forte, oltre Molto forte. Timbri: SIGILLATA (strong, very-strong), FRAGILE (fair), DEBOLE (weak).
- Logica di generazione invariata (`randomInt`, `CHARSETS`, `characterPools`, `generatePassword`, `entropyBits`, `crackTimeText`, `clampLength`, `loadOptions`, `saveOptions`, `fallbackCopy` in `static/js/app.js`). Lunghezza 8–64.
- Tema solo scuro. Ottone solo come accento.
- Ogni testo visibile in italiano, identico al prototipo dove il prototipo lo fissa.
- `APP_VERSION = "1.1.0"`.
- Lavoro sul branch `restyling-caveau`; mai commit diretti su `main` (ogni merge su `main` va online su Render).
- Ogni messaggio di commit termina con la riga `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`; la descrizione della PR termina con `🤖 Generated with [Claude Code](https://claude.com/claude-code)`.

## Review Focus

1. **Password da 64 caratteri:** deve restare tutta dentro il quadrante della ruota, leggibile, su desktop e a 360 px. → verifica in Task 4, step 6.
2. **Opzioni cambiate durante l'animazione o doppio clic su «Genera e sigilla»:** nessuna password a metà, nessuna doppia animazione; le opzioni cambiate durante il sigillo portano allo stato "anteprima" appena il sigillo finisce. → Task 4, step 6.
3. **Preferenze salvate dalla versione 1.0.0** (`localStorage["vaultforge:options"]`, es. `{"length":40,"symbols":false}`): vengono rispettate al primo avvio della nuova versione. → Task 4, step 6.
4. **`prefers-reduced-motion: reduce`:** stato finale subito (password, timbro, barra), copia attiva, nessuna dissolvenza che nasconda contenuti. → Task 4, step 6, e Task 5, step 3.
5. **App installata e offline dopo l'aggiornamento:** il nuovo service worker mette in cache font e `/api`, cancella la cache `vaultforge-1.0.0`; la pagina offline mostra i font giusti. → Task 7, step 5.

---

### Task 1: Font inclusi nel sito

**Files:**
- Create: `static/fonts/fraunces-latin.woff2`, `static/fonts/fraunces-italic-latin.woff2`, `static/fonts/inter-latin.woff2`, `static/fonts/jetbrains-mono-latin.woff2`
- Create: `static/fonts/OFL-Fraunces.txt`, `static/fonts/OFL-Inter.txt`, `static/fonts/OFL-JetBrainsMono.txt`
- Create: `static/css/fonts.css`
- Test: `tests/test_app.py`

**Interfaces:**
- Produces: famiglie CSS `"Fraunces"` (pesi 400–600, stile normal e italic), `"Inter"` (400–600), `"JetBrains Mono"` (400–600), dichiarate in `/static/css/fonts.css` con `font-display: swap`. Lista dei 4 percorsi woff2, usata dal service worker in Task 7.

- [ ] **Step 1: Scrivi i test che falliscono**

```python
FONT_FILES = [
    "/static/fonts/fraunces-latin.woff2",
    "/static/fonts/fraunces-italic-latin.woff2",
    "/static/fonts/inter-latin.woff2",
    "/static/fonts/jetbrains-mono-latin.woff2",
]

@pytest.mark.parametrize("path", FONT_FILES)
def test_font_served(path):
    res = client.get(path)
    assert res.status_code == 200
    assert res.content[:4] == b"wOF2"

def test_fonts_css_declares_local_faces():
    css = client.get("/static/css/fonts.css").text
    for family in ("Fraunces", "Inter", "JetBrains Mono"):
        assert f'font-family: "{family}"' in css
    assert "font-style: italic" in css
    assert "http" not in css
```

- [ ] **Step 2: Esegui e verifica che falliscano**

Run: `.venv/Scripts/python -m pytest tests/test_app.py -k "font" -v`
Expected: FAIL (404 sui file).

- [ ] **Step 3: Scarica font e licenze**

Chiedi il CSS a `https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,400..600;1,9..144,400..600&family=Inter:wght@400..600&family=JetBrains+Mono:wght@400..600&display=swap` con uno User-Agent di Chrome recente (così risponde con woff2). Da ogni famiglia/stile prendi solo il blocco commentato `/* latin */` e scarica il suo `src` nel file corrispondente. Licenze: `https://raw.githubusercontent.com/google/fonts/main/ofl/fraunces/OFL.txt`, `.../ofl/inter/OFL.txt`, `.../ofl/jetbrainsmono/OFL.txt`.

- [ ] **Step 4: Scrivi `static/css/fonts.css`**

Un `@font-face` per file, con `src: url("/static/fonts/<file>") format("woff2")`, l'intervallo `font-weight: 400 600`, `font-style` corretto, `font-display: swap` e lo `unicode-range` del blocco latin scaricato. Per Fraunces aggiungi `font-variation-settings` solo se serve: va bene l'asse opsz automatico.

- [ ] **Step 5: Esegui i test**

Run: `.venv/Scripts/python -m pytest -q`
Expected: tutti PASS.

- [ ] **Step 6: Commit**

```bash
git add static/fonts static/css/fonts.css tests/test_app.py
git commit -m "Font Fraunces, Inter e JetBrains Mono inclusi nel sito"
```

---

### Task 2: Icone e favicon con il logo a cassaforte

**Files:**
- Create: `tools/make_icons.py`
- Modify: `requirements-dev.txt` (aggiungi `pillow==12.2.0`)
- Modify: `static/icons/icon.svg`, `static/icons/favicon-32.png`, `static/icons/apple-touch-icon.png`, `static/icons/icon-192.png`, `static/icons/icon-512.png`, `static/icons/icon-maskable-512.png`
- Modify: `static/manifest.webmanifest` (`background_color` e `theme_color` → `#0d0e11`)
- Test: `tests/test_app.py`

**Interfaces:**
- Produces: `static/icons/icon.svg` col logo (usato anche in barra e footer da Task 3).

Il logo è quello della barra nel prototipo: cerchio esterno r=11, cerchio interno r=5.5, quattro tacche cardinali lunghe 4, tratto ottone `#c9a35b`, su viewBox 26×26. Nelle icone app sta su un quadrato grafite `#0d0e11` (angoli arrotondati per `icon.svg` e PNG "any"; quadrato pieno senza arrotondamento e logo dentro il 60% centrale per la maskable). Tratto più spesso nelle icone piccole perché resti leggibile a 32 px.

- [ ] **Step 1: Scrivi i test che falliscono**

```python
from PIL import Image
import io

@pytest.mark.parametrize("path,size", [
    ("/static/icons/favicon-32.png", 32),
    ("/static/icons/apple-touch-icon.png", 180),
    ("/static/icons/icon-192.png", 192),
    ("/static/icons/icon-512.png", 512),
    ("/static/icons/icon-maskable-512.png", 512),
])
def test_icon_sizes_and_palette(path, size):
    img = Image.open(io.BytesIO(client.get(path).content)).convert("RGB")
    assert img.size == (size, size)
    assert img.getpixel((size // 2, size // 2)) == (13, 14, 17)  # centro grafite

def test_manifest_uses_caveau_colors():
    data = json.loads(client.get("/manifest.webmanifest").content)
    assert data["theme_color"] == "#0d0e11"
    assert data["background_color"] == "#0d0e11"

def test_svg_icon_is_brass_dial():
    svg = client.get("/static/icons/icon.svg").text
    assert "#c9a35b" in svg and "<circle" in svg
```

- [ ] **Step 2: Esegui e verifica che falliscano**

Run: `.venv/Scripts/pip install -r requirements-dev.txt; .venv/Scripts/python -m pytest tests/test_app.py -k "icon or manifest_uses" -v`
Expected: FAIL (colori vecchi, blu).

- [ ] **Step 3: Scrivi `tools/make_icons.py`**

`main() -> None` che disegna il logo con Pillow (supersampling 4× e riduzione con `LANCZOS` per bordi lisci) e salva i cinque PNG in `static/icons/`; scrive anche `icon.svg` a mano come stringa. Eseguibile con `.venv/Scripts/python tools/make_icons.py`.

- [ ] **Step 4: Genera le icone, aggiorna il manifest, esegui i test**

Run: `.venv/Scripts/python tools/make_icons.py; .venv/Scripts/python -m pytest -q`
Expected: tutti PASS. Apri `static/icons/favicon-32.png` e guardalo: il logo deve essere riconoscibile.

- [ ] **Step 5: Commit**

```bash
git add tools requirements-dev.txt static/icons static/manifest.webmanifest tests/test_app.py
git commit -m "Icone e favicon con il logo a cassaforte"
```

---

### Task 3: Pagina principale: struttura, testi e stile

**Files:**
- Create: `templates/base.html`
- Modify: `templates/index.html` (riscritto, estende `base.html`)
- Modify: `static/css/app.css` (riscritto)
- Test: `tests/test_app.py`

**Interfaces:**
- Consumes: `/static/css/fonts.css` (Task 1), `/static/icons/icon.svg` (Task 2).
- Produces per Task 4 e 5 (id e classi che il JS userà):
  - Ruota: `<svg id="dial">` con gruppi vuoti `#dial-ticks` (dentro `#dial-ring`) e `#dial-bolts`; `#password` (`<output>`, `aria-live="off"`); `#stamp`; `#sr-status` (visivamente nascosto, `role="status"`, `aria-live="polite"`).
  - Pannello: `#meter` (contenitore) con `#meter-fill`; `#strength-label`; `#entropy-bits`; `#crack-time`; `#length` (range 8–64), `#length-number` (number 8–64); pulsanti `button.chip[data-option="upper|lower|digits|symbols|excludeAmbiguous"][aria-pressed]`; `#generate` («Genera e sigilla»); `#copy`; `#toast`.
  - Diagramma: `#flow`. Elementi animati allo scroll: classe `.reveal`. Barra: `<nav class="topbar">`.
  - Stato pagina sul `<body>`: `data-level="weak|fair|strong|very-strong"`, classi `is-stale`, `is-sealing`.
- `base.html` blocchi: `title`, `description`, `content`; contiene `<nav class="topbar">` e `<footer>`; carica `fonts.css`, `app.css` e `app.js` con `?v={{ version }}`.

- [ ] **Step 1: Scrivi i test che falliscono**

```python
def test_index_structure():
    html = client.get("/").text
    for needle in ('id="come-funziona"', 'id="sicurezza"', 'href="#come-funziona"',
                   'href="#sicurezza"', 'href="/api"', 'id="dial"', 'id="generate"',
                   "Genera e sigilla", "sigillata", "Quattro passaggi", "Verificalo",
                   "https://github.com/tenanss/VaultForge", "fonts.css?v="):
        assert needle in html
    assert 'data-option="excludeAmbiguous"' in html
    assert 'name="theme-color" content="#0d0e11"' in html
    assert "Aziende" not in html
    assert "fonts.googleapis" not in html

def test_index_chips_are_accessible_buttons():
    html = client.get("/").text
    assert html.count('class="chip"') == 5
    assert html.count("aria-pressed=") == 5
```

- [ ] **Step 2: Esegui e verifica che falliscano**

Run: `.venv/Scripts/python -m pytest tests/test_app.py -k "index" -v`
Expected: FAIL su `test_index_structure` e `test_index_chips_are_accessible_buttons`; i test esistenti sugli header restano PASS.

- [ ] **Step 3: Scrivi `templates/base.html` e `templates/index.html`**

Markup e testi come nel prototipo (barra senza "Aziende" e "API"; hero; Come funziona; Sicurezza; footer), con gli id dell'Interfaces sopra. Differenze dal prototipo: niente link a Google Fonts; niente barra "Tipografia"; gli attributi `onclick`/`style` diventano classi; accanto allo slider c'è `#length-number`; le pillole sono `<button type="button" class="chip" data-option="…" aria-pressed="true">`; il link "Leggi la documentazione API" e il bottone in barra vanno a `/api`; "Codice pubblico" linka il repository; `<noscript>` con "Per generare le password è necessario JavaScript." resta. Mantieni meta description, manifest, icone e apple-touch-icon di oggi. La `<html>` ha `lang="it"`.

- [ ] **Step 4: Riscrivi `static/css/app.css`**

Dal prototipo, con i token della sezione Global Constraints e le famiglie di Task 1, più: layout telefono come nel prototipo (sotto 900 px: sopratitolo, titolo, ruota, poi sottotitolo e prove; sezioni in colonna); focus visibile su tutti i controlli (`:focus-visible`, contorno `--brass-hi`); `.chip[aria-pressed="true"]` per lo stato attivo; classe `.sr-only`; `.reveal` **visibile di base** e nascosto solo con `.reveal.is-pending` (aggiunta dal JS in Task 5); stati `body[data-level]`, `body.is-stale`, `body.is-sealing` come nel prototipo (lì si chiamano `data-level` e `stale`); `@media (prefers-reduced-motion: reduce)` che azzera animazioni e transizioni.

- [ ] **Step 5: Esegui i test e guarda la pagina**

Run: `.venv/Scripts/python -m pytest -q`
Expected: tutti PASS (compreso `test_index_has_no_inline_scripts_or_styles`).
Avvia `uvicorn main:app --reload` e apri `/` con Playwright a 1280×800 e 390×844: layout come nel prototipo (la ruota sarà vuota finché Task 4 non la disegna), nessuno scroll orizzontale (`document.documentElement.scrollWidth <= innerWidth`), nessun errore CSP in console.

- [ ] **Step 6: Commit**

```bash
git add templates/base.html templates/index.html static/css/app.css tests/test_app.py
git commit -m "Pagina Caveau: struttura, testi e stile"
```

---

### Task 4: Generatore: ruota, sigillo, anteprima

**Files:**
- Modify: `static/js/app.js` (la parte dentro `DOMContentLoaded` viene riscritta; le funzioni pure sopra restano identiche)

**Interfaces:**
- Consumes: id, classi e stati del `body` di Task 3; funzioni pure esistenti di `app.js`.
- Produces: `window` non viene toccato. Evento personalizzato `document.dispatchEvent(new CustomEvent("vaultforge:generate"))` emesso all'inizio di ogni generazione (lo usa Task 5 per l'impulso del diagramma).

Comportamento (dalla spec, sezione "Comportamento del generatore"):
- `buildDial()`: 100 tacche (maggiori ogni 10 con numero 0–90, medie ogni 5) in `#dial-ticks`, 24 perni alternati grandi/piccoli in `#dial-bolts`, come nel prototipo.
- `seal()`: genera con `generatePassword(opts)`; aggiunge `is-sealing` (copia e generate disattivati via `disabled`); rotazione di `#dial-ring` con la Web Animations API (avanti, indietro, avanti, ~1,5 s); caratteri che scorrono e si fissano da sinistra a destra (~0,5–1,4 s); perni accesi in sequenza; poi timbro col testo del livello, barra (`Math.min(100, bits / METER_FULL_BITS * 100)` %), conteggio dei bit, `#crack-time` = `Tempo stimato per indovinarla con un attacco offline: ${crackTimeText(bits)}.`; infine toglie `is-sealing` e scrive in `#sr-status` "Nuova password generata: <livello>". Durata totale circa 2 s.
- Con `matchMedia("(prefers-reduced-motion: reduce)").matches`: stesso risultato finale, senza animazioni.
- Password nella ruota: righe = 1 fino a 16 caratteri, 2 fino a 32, 3 fino a 48, 4 oltre; dimensione del font calcolata dalla larghezza del quadrante, massimo 19 px (vedi prototipo, funzione `run`).
- `markStale()`: su `input` dello slider, `change` del campo numerico e clic su una pillola: salva le preferenze (`saveOptions`), aggiorna i controlli, aggiunge `is-stale`, spegne timbro e perni, mostra l'anteprima (`Anteprima: ${label.toLowerCase()}`, bit, barra) e in `#crack-time` "Opzioni cambiate. Premi «Genera e sigilla» per una nuova password." Non genera. Se arriva mentre c'è `is-sealing`, viene applicata appena il sigillo finisce.
- Pillole: clic → inverte `aria-pressed`; se resterebbe nessun tipo attivo, non cambia e mostra il toast "Serve almeno un tipo di carattere". `excludeAmbiguous` non conta come tipo.
- Copia: come oggi (`navigator.clipboard` poi `fallbackCopy`, stessi testi del toast).
- All'avvio: `loadOptions()`, sincronizza i controlli, `buildDial()`, `seal()`. Registrazione del service worker invariata.

- [ ] **Step 1: Riscrivi la parte interfaccia di `app.js`**

Funzioni nominate sopra (`buildDial`, `seal`, `markStale`, più gli aiuti che servono) dentro il gestore `DOMContentLoaded`. Nessuna modifica alle funzioni pure.

- [ ] **Step 2: Esegui i test Python**

Run: `.venv/Scripts/python -m pytest -q`
Expected: tutti PASS.

- [ ] **Step 3: Verifica la generazione nel browser (Playwright, 1280×800)**

Apri `/`, attendi 3 s, poi con `browser_evaluate`:
```js
() => ({ pw: document.querySelector("#password").textContent,
         stamp: document.querySelector("#stamp").textContent,
         level: document.body.dataset.level,
         sealing: document.body.classList.contains("is-sealing") })
```
Expected: `pw` lungo 16, `stamp` contiene "SIGILLATA", `level` = `very-strong`, `sealing` = false. Console senza errori.

- [ ] **Step 4: Verifica anteprima e colori**

Imposta lo slider a 8 (`input`), disattiva `upper`, `lower` e `symbols`: Expected `body.is-stale`, password invariata, `#strength-label` = "Anteprima: debole", `data-level="weak"`. Premi `#generate` e attendi 3 s: Expected password di 8 cifre, timbro "DEBOLE", nessun `is-stale`. Ripristina tutte le opzioni: con 8 caratteri e tutti i tipi, il livello è `fair` e il timbro "FRAGILE".

- [ ] **Step 5: Verifica pillole e copia**

Disattiva tutti i tipi tranne uno e prova a disattivare l'ultimo: Expected resta `aria-pressed="true"` e compare "Serve almeno un tipo di carattere". Durante il sigillo `#copy` e `#generate` hanno `disabled`.

- [ ] **Step 6: Verifica i casi della Review Focus**

1. Lunghezza 64, genera, attendi 3 s, a 1280×800 e a 360×740: il rettangolo di `#password` sta dentro quello del quadrante interno (cerchio r=118 del viewBox 400, scalato), testo non tagliato. Fai uno screenshot e guardalo.
2. Doppio clic rapido su `#generate`: una sola animazione, password finale coerente con `#entropy-bits`. Cambia lo slider durante il sigillo: alla fine compare lo stato anteprima.
3. Esegui `localStorage.setItem("vaultforge:options", JSON.stringify({length: 40, symbols: false}))`, ricarica: slider a 40, pillola `symbols` con `aria-pressed="false"`, password di 40 caratteri senza simboli.
4. `browser_emulate_media` con `reducedMotion: "reduce"`, ricarica: subito dopo il caricamento password e timbro presenti e `#copy` attivo.

- [ ] **Step 7: Commit**

```bash
git add static/js/app.js
git commit -m "Generatore Caveau: ruota animata, sigillo e anteprima delle opzioni"
```

---

### Task 5: Movimento della pagina

**Files:**
- Modify: `static/js/app.js` (aggiunta in fondo al gestore `DOMContentLoaded`)

**Interfaces:**
- Consumes: `.reveal`, `#flow`, `nav.topbar` (Task 3); evento `vaultforge:generate` (Task 4).

- [ ] **Step 1: Implementa `setupMotion()`**

Senza riduzione del movimento: aggiunge `is-pending` solo agli elementi `.reveal` che al caricamento sono **sotto** lo schermo, e li rivela con un `IntersectionObserver` (soglia 0.15, ritardo a scaglioni come nel prototipo). `#flow` riceve la classe `pulse` (riavviata) quando entra per metà nello schermo e a ogni `vaultforge:generate`. `nav.topbar` riceve `is-scrolled` quando `scrollY > 10`. Con riduzione del movimento: nessuna di queste cose, tutto visibile.

- [ ] **Step 2: Esegui i test Python**

Run: `.venv/Scripts/python -m pytest -q`
Expected: tutti PASS.

- [ ] **Step 3: Verifica nel browser**

A 1280×800: scorri fino al footer; Expected nessun `.reveal.is-pending` rimasto, il diagramma pulsa quando compare e dopo un clic su «Genera e sigilla». Con `reducedMotion: "reduce"`: nessun elemento con `is-pending` dal primo istante. Clic su "Sicurezza" in barra: la pagina scorre alla sezione e il titolo non resta sotto la barra.

- [ ] **Step 4: Commit**

```bash
git add static/js/app.js
git commit -m "Comparsa delle sezioni, impulso del diagramma e barra allo scroll"
```

---

### Task 6: Pagina Documentazione API

**Files:**
- Create: `templates/api.html` (estende `base.html`)
- Modify: `main.py` (nuova rotta)
- Modify: `static/css/app.css` (stili della pagina: tabella parametri, blocchi di codice)
- Test: `tests/test_app.py`

**Interfaces:**
- Consumes: `base.html` (Task 3). Nella barra di questa pagina i link sono `/#come-funziona` e `/#sicurezza`: rendili un blocco o una variabile di `base.html` (es. `{% set home = "" if page == "home" else "/" %}`).
- Produces: `GET /api` → `HTMLResponse`, `include_in_schema=False`, funzione `api_docs(request: Request)`.

- [ ] **Step 1: Scrivi i test che falliscono**

```python
def test_api_docs_page():
    res = client.get("/api")
    assert res.status_code == 200
    assert res.headers["content-type"].startswith("text/html")
    assert "script-src 'self'" in res.headers["content-security-policy"]
    html = res.text
    for needle in ("/api/v1/generate", "length", "exclude_ambiguous", "very_strong",
                   "422", "no-store", "curl", 'href="/#sicurezza"'):
        assert needle in html
    assert "<script>" not in html and "style=" not in html

def test_api_docs_examples_match_api():
    # i nomi dei parametri documentati sono quelli che l'API accetta davvero
    html = client.get("/api").text
    for param in ("lower", "upper", "digits", "symbols"):
        assert f"<code>{param}</code>" in html
```

- [ ] **Step 2: Esegui e verifica che falliscano**

Run: `.venv/Scripts/python -m pytest tests/test_app.py -k "api_docs" -v`
Expected: FAIL (404).

- [ ] **Step 3: Scrivi la rotta e il template**

Contenuto dalla spec, sezione "Documentazione API": introduzione; avviso che via API le password nascono sul server, non vengono salvate né registrate, `Cache-Control: no-store`, e che per la massima riservatezza conviene il generatore nel browser; tabella dei parametri (`length` 8–128 default 16; `lower`, `upper`, `digits`, `symbols` default `true`; `exclude_ambiguous` default `false`); esempio con l'URL pubblico `https://ai-password-generator-twpu.onrender.com/api/v1/generate?length=24&symbols=false`; risposta JSON d'esempio con i quattro campi (`password`, `length`, `entropy_bits`, `strength`); valori di `strength` con le soglie in bit; errore 422 con i due casi. Stile Caveau, tabella in un contenitore `overflow-x: auto`.

- [ ] **Step 4: Esegui i test e guarda la pagina**

Run: `.venv/Scripts/python -m pytest -q`
Expected: tutti PASS. Apri `/api` con Playwright a 1280×800 e 390×844: leggibile, nessuno scroll orizzontale della pagina, link della barra funzionanti.

- [ ] **Step 5: Commit**

```bash
git add templates/api.html main.py static/css/app.css tests/test_app.py
git commit -m "Pagina Documentazione API"
```

---

### Task 7: Versione 1.1.0, offline, README

**Files:**
- Modify: `main.py` (`APP_VERSION = "1.1.0"`)
- Modify: `templates/sw.js` (`ASSETS`)
- Modify: `README.md`
- Test: `tests/test_app.py`

- [ ] **Step 1: Scrivi il test che fallisce**

```python
def test_service_worker_caches_new_assets():
    sw = client.get("/sw.js").text
    assert "vaultforge-1.1.0" in sw
    for path in FONT_FILES + ["/api", f"/static/css/fonts.css?v={APP_VERSION}"]:
        assert f'"{path}"' in sw
```

- [ ] **Step 2: Esegui e verifica che fallisca**

Run: `.venv/Scripts/python -m pytest tests/test_app.py -k "service_worker" -v`
Expected: FAIL.

- [ ] **Step 3: Aggiorna versione, `ASSETS` e README**

`ASSETS` aggiunge `fonts.css?v=...`, i 4 font, `/api` e `apple-touch-icon.png`. Nel service worker la navigazione verso `/api` segue la stessa logica di `/` (rete, poi cache). README: tabella "Struttura" con `templates/base.html`, `templates/api.html`, `static/fonts/`, `static/css/fonts.css`, `tools/make_icons.py`; sezione API che rimanda a `/api`; roadmap invariata.

- [ ] **Step 4: Esegui tutti i test**

Run: `.venv/Scripts/python -m pytest -q`
Expected: tutti PASS.

- [ ] **Step 5: Verifica offline (Review Focus 5)**

Con Playwright apri `/`, attendi che il service worker sia attivo (`navigator.serviceWorker.ready`), controlla `caches.keys()` = solo `vaultforge-1.1.0`; poi metti il contesto offline e ricarica `/` e `/api`: Expected entrambe si aprono con i font Fraunces (`document.fonts.check('16px Fraunces')` = true) e la generazione funziona.

- [ ] **Step 6: Commit**

```bash
git add main.py templates/sw.js README.md tests/test_app.py
git commit -m "Versione 1.1.0: cache offline aggiornata e README"
```

---

### Task 8: Verifica finale e pubblicazione

- [ ] **Step 1:** `.venv/Scripts/python -m pytest -q` → tutti PASS.
- [ ] **Step 2:** Giro completo con Playwright a 1280×800 e 390×844 su `/` e `/api`: screenshot, console senza errori, nessuno scroll orizzontale, confronto visivo col prototipo.
- [ ] **Step 3:** Push del branch e pull request verso `main` con `gh pr create` (descrizione in italiano con l'elenco delle modifiche). Il merge, che pubblica su Render, si fa solo dopo l'ok dell'utente.
- [ ] **Step 4:** Dopo il merge: attendi il deploy (`render deploys list srv-d613087pm1nc73e5dug0`), poi verifica `https://ai-password-generator-twpu.onrender.com/`, `/api` e `/healthz` (200) e gli header di sicurezza con `curl -sI`.
