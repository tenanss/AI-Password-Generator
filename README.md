# 🔐 VaultForge

Generatore di password per aziende e professionisti, installabile come app (PWA).
Le password vengono generate **nel browser** con la crittografia del dispositivo
(Web Crypto API) e non vengono mai inviate a un server.

## Funzionalità
- **Generazione crittografica locale** con `crypto.getRandomValues`, senza bias del modulo.
- **Opzioni complete:** lunghezza da 8 a 64, maiuscole, minuscole, numeri e simboli,
  esclusione dei caratteri ambigui (`0 O o 1 l I`). La password contiene sempre
  almeno un carattere di ogni tipo selezionato.
- **Robustezza misurata in bit di entropia**, con stima del tempo necessario per un
  attacco offline (10 miliardi di tentativi al secondo).
- **Funziona offline** e si installa su desktop e smartphone (service worker + manifest).
- **Sicurezza della pagina:** Content Security Policy rigorosa, nessuno script esterno,
  header di sicurezza su ogni risposta.
- **API REST** (`/api/v1/generate`) con la stessa logica, base per le funzioni aziendali.

## API
```
GET /api/v1/generate?length=24&symbols=false&exclude_ambiguous=true
```
```json
{ "password": "…", "length": 24, "entropy_bits": 139.4, "strength": "very_strong" }
```
Parametri: `length` (8–128), `lower`, `upper`, `digits`, `symbols`, `exclude_ambiguous`.
Le risposte hanno `Cache-Control: no-store`.

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
| `main.py` | App FastAPI, header di sicurezza, API |
| `generator.py` | Generazione e calcolo dell'entropia lato server |
| `static/js/app.js` | Generazione nel browser e interfaccia (stessa logica di `generator.py`) |
| `templates/` | Pagina HTML e service worker |
| `static/` | CSS, icone, manifest |
| `tests/` | Test automatici (`pytest`) |

## Roadmap
- [x] Fase 1: fondamenta (generazione locale, entropia, PWA, sicurezza, test)
- [ ] Modalità passphrase in italiano
- [ ] Fase 2: account aziendali, policy password personalizzate, generazione in blocco (CSV), API key
- [ ] Fase 3: abbonamenti e fatturazione
