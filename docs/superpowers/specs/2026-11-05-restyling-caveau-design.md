# Restyling "Caveau" di VaultForge: documento di progetto

Data: 2026-11-05
Riferimento visivo: [`2026-11-05-restyling-caveau-prototipo.html`](2026-11-05-restyling-caveau-prototipo.html)
(prototipo funzionante approvato; aprilo nel browser. Carica i font da Google solo perché è un prototipo: vedi Vincoli.)

## Intento

Oggi VaultForge è una sola card essenziale. Funziona, ma non comunica la serietà del prodotto.
Il pubblico è il **responsabile IT di una PMI**: una persona tecnica e scettica, che si fida di ciò
che può verificare e non delle promesse. Il restyling deve far sembrare VaultForge affidabile,
**perché lo è davvero**: l'affidabilità deve nascere da sostanza verificabile (come funziona,
cosa non succede, come controllarlo), presentata con cura.

Il riferimento di sobrietà è Bitwarden, ma VaultForge deve essere più riconoscibile. L'identità
ruota attorno alla parola **vault**: cassaforte, sigillo, qualcosa di chiuso e solido.

## Obiettivi

1. Nuova identità visiva "Caveau": grafite e ottone, titoli con grazie.
2. Il generatore resta **in primo piano**, in cima alla pagina, dentro una ruota da cassaforte animata.
3. Animazioni che rendono tangibile la generazione sicura ("genera e sigilla").
4. Presentazione del prodotto nella stessa pagina: sezioni **Come funziona** e **Sicurezza**.
5. Una pagina separata di **Documentazione API** per l'endpoint esistente.

## Non obiettivi

- Sezione o pagina **Aziende**: rimandata a quando le funzioni della Fase 2 esisteranno davvero.
- Tema chiaro: la pagina è **sempre scura**, perché il tema scuro fa parte dell'identità.
- Nessuna modifica al comportamento dell'API, nessun account, nessun database, nessun dominio personalizzato.
- Nessuna modalità passphrase (resta in roadmap).

## Anti-obiettivi (anche se funziona, sarebbe un fallimento)

- Qualsiasi cosa che faccia uscire una password dal browser (la generazione nel browser resta locale al 100%).
- Risorse di terze parti (font, CDN, analytics): renderebbero falsa la sezione Sicurezza.
- Affermazioni non vere o non verificabili nei testi.
- Oro usato come superficie ampia: l'ottone è **solo un accento** (bottone principale, timbro,
  dettagli, parole in evidenza). Usato troppo, il sito sembra un casinò o una cripto.
- Una password debole che sembri sicura.
- Un'animazione che impedisca di usare l'app: chi ha `prefers-reduced-motion` vede subito lo stato finale.

## Vincoli tecnici (dal codice esistente)

- Stack invariato: FastAPI + Jinja2, JS e CSS vanilla, nessun framework, nessun build step.
- **CSP invariata**: `default-src 'self'; script-src 'self'; style-src 'self'; ...`. Quindi niente
  `<script>` né `<style>` inline, niente attributi `style=` o `onclick` nell'HTML (c'è già un test che lo verifica).
  Impostare stili da JS via CSSOM (`el.style.x = ...`) e usare la Web Animations API è consentito.
- **Font inclusi nel sito** (`static/fonts/`, formato woff2, sottoinsieme latino con le lettere accentate italiane):
  Fraunces (con corsivo) per i titoli, Inter per il testo, JetBrains Mono per codice e numeri.
  Sono tutti con licenza SIL OFL: includi i file di licenza accanto ai font.
- La logica di generazione non cambia: stesso `randomInt` senza bias, stessi set di caratteri
  (`CHARSETS` di `app.js`, allineati a `generator.py`), almeno un carattere per tipo scelto, Fisher–Yates,
  stessa formula dell'entropia e del tempo d'attacco. Il prototipo ha set di simboli diversi: **vale il codice attuale**.
- Lunghezza da 8 a 64 caratteri come oggi (il prototipo si ferma a 32). La password deve stare leggibile
  nella ruota anche a 64 caratteri (più righe e font più piccolo, a scelta del builder).
- Restano le funzioni attuali: preferenze salvate in `localStorage` (mai la password), copia negli appunti
  con avviso, PWA offline con service worker, header di sicurezza.
- `APP_VERSION` in `main.py` va portata a **1.1.0**, così si aggiorna la cache delle app installate.
  Il service worker deve mettere in cache anche i font e la pagina della documentazione API.
- Il manifest (`theme_color`, `background_color`) e il `<meta name="theme-color">` passano al nuovo sfondo grafite.
- Deve funzionare bene da telefono (larghezza 360 px): la ruota si ridimensiona, le sezioni vanno in colonna.

## Cosa è stato deciso

### Identità visiva
- Palette (dal prototipo): sfondo `#0d0e11`, superfici `#15161a`, linee `#26272d`, testo `#ece7db`,
  testo secondario `#8f8b82`, ottone `#c9a35b`, ottone chiaro `#f0d79e`, ottone scuro `#5c4c2c`.
- Colori di robustezza, con le **stesse soglie** di oggi: Debole (< 50 bit) rosso mattone `#c4513b`;
  Discreta (50–70) ocra `#d0883a`; Forte (70–100) ottone; Molto forte (≥ 100) ottone chiaro.
  Etichette: Debole, Discreta, Forte, Molto forte.
- Tipografia "Classica": titoli in Fraunces, con le parole chiave in corsivo ottone chiaro.
- Logo: il simbolo della ruota stilizzata e la scritta VAULTFORGE spaziata, in ottone.

### Struttura della pagina
1. **Barra in alto**, fissa durante lo scroll: logo; link "Come funziona" e "Sicurezza" (scorrono alla sezione);
   bottone "Documentazione API" che apre la pagina della documentazione.
2. **Hero**, su due colonne (una sola su telefono):
   - a sinistra: sopratitolo "GENERATORE DI PASSWORD PER AZIENDE"; titolo "Ogni password, *sigillata* prima
     ancora di nascere."; sottotitolo "VaultForge genera le password **direttamente nel tuo browser**, con la
     crittografia del dispositivo. Nessun server le vede, nessun database le conserva."; tre prove brevi:
     "0 byte inviati", "Web Crypto API", "Funziona offline".
   - a destra: la ruota della cassaforte con la password al centro e, sotto, il pannello dei controlli.
3. **Come funziona** (testi definitivi nel prototipo): titolo "Quattro passaggi. *Tutti* dentro il tuo browser.",
   diagramma dispositivo → server interrotto con "0 byte ricevuti", quattro passaggi numerati.
4. **Sicurezza** (testi definitivi nel prototipo): titolo "Non chiederti se fidarti. *Verificalo.*", sei schede
   ciascuna con una riga "Verifica", riquadro terminale con il comando `curl`, riquadro "E l'API?".
   Il link "Codice pubblico" punta a https://github.com/tenanss/VaultForge. L'URL nel comando `curl` è quello
   pubblico attuale (https://ai-password-generator-twpu.onrender.com) finché non ci sarà un dominio.
5. **Footer** essenziale: logo e "Password generate sul tuo dispositivo. Mai inviate, mai salvate."

### Comportamento del generatore
- All'apertura della pagina si genera una password con l'animazione completa.
- **«Genera e sigilla»** avvia la sequenza (circa 2 secondi in tutto):
  1. la ruota gira avanti, indietro e di nuovo avanti, come una combinazione;
  2. i caratteri scorrono a caso e si fissano uno alla volta da sinistra a destra, con un lampo dorato;
  3. i perni attorno alla ruota si accendono in sequenza;
  4. compare il timbro (**SIGILLATA** per Forte/Molto forte, **FRAGILE** per Discreta, **DEBOLE** per Debole),
     la barra si riempie e i bit di entropia contano fino al valore finale; poi compare il testo del tempo d'attacco.
  I colori di barra, timbro, perni, etichetta e bit seguono il livello di robustezza.
- **Cambiare le opzioni non genera.** Lunghezza o tipi di caratteri modificati: la password attuale si sfoca,
  il timbro e i perni si spengono, la barra mostra un'**anteprima** ("Anteprima: forte · N bit"), compare
  "Opzioni cambiate. Premi «Genera e sigilla» per una nuova password." e il bottone pulsa piano.
  La nuova password arriva solo premendo il bottone.
- Il diagramma di "Come funziona" fa passare un impulso dorato quando entra nello schermo e a ogni generazione.
- Le sezioni compaiono con una leggera dissolvenza verso l'alto durante lo scroll.

### Documentazione API
Pagina separata nello stesso stile (barra in alto e footer uguali), per l'endpoint esistente
`GET /api/v1/generate`. Deve contenere: a cosa serve; avviso chiaro che le password via API nascono sul server
e non vengono salvate né registrate (`Cache-Control: no-store`), e che per la massima riservatezza conviene il
generatore nel browser; tabella dei parametri (`length` 8–128, default 16; `lower`, `upper`, `digits`, `symbols`,
default true; `exclude_ambiguous`, default false); esempio `curl` e risposta JSON; significato di `strength`
(`weak`, `fair`, `strong`, `very_strong`); errore 422 (lunghezza fuori limiti o nessun tipo di carattere).
La pagina è statica e scritta a mano: la documentazione automatica di FastAPI resta disattivata.

## Decisioni prese da me (da verificare)

- Percorso della documentazione: `/api` (il bottone "Documentazione API" e il link del riquadro "E l'API?" puntano lì).
- I tipi di caratteri diventano pulsanti a "pillola" come nel prototipo, ma restano accessibili: pulsanti veri con
  `aria-pressed`, usabili da tastiera. Resta impossibile disattivare l'ultimo tipo attivo.
- Resta il campo numerico della lunghezza accanto allo slider, come oggi (il prototipo mostra solo il numero).
- Durante l'animazione il bottone di copia è disattivato, così non si copia mai una password non ancora sigillata.
  Con le opzioni cambiate (password sfocata) la copia resta possibile e copia la password mostrata.
- La password generata viene annunciata agli screen reader solo a sigillo completato, non carattere per carattere.
- Le icone dell'app (favicon, icone PWA, `icon.svg`) vengono rifatte nel nuovo stile: il simbolo della ruota in
  ottone su grafite. Le attuali sono blu e stonerebbero.
- Il lavoro si fa su un branch dedicato e arriva su `main` tramite pull request: ogni merge su `main` viene
  pubblicato in automatico da Render, quindi su `main` arriva solo il lavoro finito e testato.

## Lasciato al builder

- Come organizzare HTML, CSS e JS: uno o più file, purché rispettino la CSP.
- Dettagli dell'animazione (curve, tempi esatti), restando intorno ai 2 secondi totali.
- Come ridimensionare la password nella ruota per lunghezze fino a 64.
- Layout preciso della pagina di documentazione API.
- Quali test aggiungere. Il minimo: la nuova pagina `/api` risponde con gli header di sicurezza; i font sono serviti;
  la pagina principale non ha ancora script o stili inline; i test esistenti restano verdi.
- Aggiornare il README (struttura dei file, nuova pagina).
