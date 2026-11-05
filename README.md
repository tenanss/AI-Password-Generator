# 🔐 VaultForge

Generatore di password per aziende e professionisti, installabile come app (PWA).
Le password vengono generate **nel browser** con la crittografia del dispositivo
(Web Crypto API) e non vengono mai inviate a un server.

## Funzionalità
- **Generazione crittografica locale** con `crypto.getRandomValues`, senza bias del modulo.
- **Opzioni complete:** lunghezza da 8 a 64, maiuscole, minuscole, numeri e simboli,
  esclusione dei caratteri ambigui (`0 O o 1 l I`). La password contiene sempre
  almeno un carattere di ogni tipo selezionato.
- **Passphrase in italiano** per le password da ricordare e digitare (computer, gestore di
  password, Wi-Fi): da 4 a 10 parole della lista BIP-39 italiana, iniziale maiuscola, cifra
  finale e separatore a scelta. Predefinito: 7 parole + cifra, circa 80 bit ("Forte").
- **Robustezza misurata in bit di entropia**, con stima del tempo necessario per un
  attacco offline (10 miliardi di tentativi al secondo).
- **Funziona offline** e si installa su desktop e smartphone (service worker + manifest).
- **Sicurezza della pagina:** Content Security Policy rigorosa, nessuno script o font esterno,
  header di sicurezza su ogni risposta.
- **API REST** (`/api/v1/generate`, `/api/v1/passphrase`) con la stessa logica, base per le funzioni aziendali.

## API
Documentazione completa nell'app, alla pagina [`/api`](https://ai-password-generator-twpu.onrender.com/api).
```
GET /api/v1/generate?length=24&symbols=false&exclude_ambiguous=true
```
```json
{ "password": "…", "length": 24, "entropy_bits": 139.4, "strength": "very_strong" }
```
Parametri: `length` (8–128), `lower`, `upper`, `digits`, `symbols`, `exclude_ambiguous`.
Le risposte hanno `Cache-Control: no-store`.

```
GET /api/v1/passphrase?words=7&separator=space
```
```json
{ "passphrase": "…", "words": 7, "entropy_bits": 80.3, "strength": "strong" }
```
Parametri: `words` (4–10), `capitalize`, `number`, `separator` (`-`, `.`, `_`, `space`).

## Sviluppo locale
```bash
python -m venv .venv
.venv\Scripts\activate        # Windows  (macOS/Linux: source .venv/bin/activate)
pip install -r requirements-dev.txt
uvicorn main:app --reload
pytest
```

## Deploy (Render)
- Build command: `pip install -r requirements.txt`
- Start command: `uvicorn main:app --host 0.0.0.0 --port $PORT`
- A ogni rilascio incrementa `APP_VERSION` in `main.py`: aggiorna la cache dell'app installata.

## Struttura
| File | Contenuto |
|---|---|
| `main.py` | App FastAPI, header di sicurezza, API, pagina `/api` |
| `generator.py` | Generazione e calcolo dell'entropia lato server |
| `passphrase.py` | Passphrase lato server (stessa logica del browser) |
| `static/wordlists/` | Lista BIP-39 italiana (fonte unica) e la sua licenza MIT |
| `static/js/wordlist-it.js` | La stessa lista per il browser, generata da `tools/make_wordlist_js.py` |
| `static/js/app.js` | Generazione nel browser e interfaccia: ruota, sigillo, animazioni (stessa logica di `generator.py`) |
| `templates/base.html` | Struttura comune: barra in alto e footer |
| `templates/index.html` | Pagina principale: generatore, Come funziona, Sicurezza |
| `templates/api.html` | Documentazione API |
| `templates/sw.js` | Service worker (funzionamento offline) |
| `static/css/` | Stile "Caveau" (`app.css`) e font (`fonts.css`) |
| `static/fonts/` | Fraunces, Inter e JetBrains Mono inclusi nel sito, con licenze OFL |
| `static/icons/`, `static/manifest.webmanifest` | Icone e manifest della PWA |
| `tools/make_icons.py` | Rigenera le icone (richiede Pillow, in `requirements-dev.txt`) |
| `tools/make_wordlist_js.py` | Rigenera `wordlist-it.js` dalla lista in `static/wordlists/` |
| `tests/` | Test automatici (`pytest`) |

## Roadmap
- [x] Fase 1: fondamenta (generazione locale, entropia, PWA, sicurezza, test)
- [x] Modalità passphrase in italiano
- [ ] Fase 2: account aziendali, policy password personalizzate, generazione in blocco (CSV), API key
- [ ] Fase 3: abbonamenti e fatturazione

## Crediti
- Lista di parole: [BIP-39 italiano](https://github.com/bitcoin/bips/tree/master/bip-0039), licenza MIT
  (testo in `static/wordlists/LICENSE-BIP39.txt`).
- Font: Fraunces, Inter e JetBrains Mono, licenza SIL OFL 1.1 (testi in `static/fonts/`).
