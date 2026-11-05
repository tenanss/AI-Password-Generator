# Passphrase in italiano: documento di progetto

Data: 2026-11-05
Riferimento visivo: [`2026-11-05-passphrase-prototipo.html`](2026-11-05-passphrase-prototipo.html)
(bozza interattiva approvata: aprila nel browser e premi "Passphrase" sopra la ruota. Come il prototipo del
restyling carica i font da Google solo perché è una bozza.)
Si basa sul restyling "Caveau" già online (versione 1.1.0): stessi vincoli, stile e comportamenti, descritti in
[`2026-11-05-restyling-caveau-design.md`](2026-11-05-restyling-caveau-design.md).

## Intento

Le password a caratteri casuali sono ideali per tutto ciò che salva un gestore di password, ma sono
controproducenti per le poche password che una persona deve **ricordare e digitare a mano**: chi non riesce a
ricordarle le scrive su un post-it o le sostituisce con password deboli.
VaultForge aggiunge una seconda modalità che genera **passphrase di parole italiane**, pensata per:

- **dipendenti** che devono ricordare la password del computer e digitarla ogni giorno;
- **privati** che usano l'app per le proprie password da ricordare (gestore di password, Wi-Fi).

Per il responsabile IT è anche un argomento in più: VaultForge copre entrambi i casi senza rinunciare ai principi
del prodotto (generazione nel browser, robustezza misurata e onesta).

## Obiettivi

1. Selettore **Password | Passphrase** sopra la ruota; la modalità Password resta quella predefinita.
2. Passphrase generate nel browser con la stessa casualità crittografica e lo stesso metodo senza distorsioni.
3. Valori predefiniti che superano le regole tipiche dei computer aziendali e risultano "Forte".
4. Robustezza calcolata e mostrata con la stessa onestà delle password.
5. Endpoint API per le passphrase, documentato su `/api`.

## Non obiettivi

- Liste di parole in altre lingue, o scelta della lista da parte dell'utente.
- Parole scelte o modificate a mano dall'utente.
- Nuove funzioni aziendali (Fase 2), account, database.

## Anti-obiettivi

- Una richiesta di rete durante la generazione (renderebbe falsa la scheda Sicurezza "Zero trasmissione").
- Una passphrase predefinita che il sito stesso giudica "Discreta" o "Debole".
- Bit di entropia gonfiati: maiuscola e posizione della cifra sono fisse e non vanno contate come casualità.
- Parole spezzate a metà nella ruota.

## Decisioni prese con l'utente

- **Lista di parole:** la lista italiana del **BIP-39** (2.048 parole), licenza **MIT**. Verificata: 2.048 parole
  uniche, nessuna accentata, lunghezza media 6,8 lettere (massimo 9), costruita in modo che le prime 4 lettere
  identifichino la parola. Fonte: `bip-0039/italian.txt` nel repository `bitcoin/bips` (BIP-39, "License: MIT").
  Ogni parola vale log₂(2048) = **11 bit**.
- **Valori predefiniti:** **7 parole**, **iniziale maiuscola** (solo la prima lettera della prima parola),
  **una cifra in fondo** all'ultima parola, **trattino** come separatore.
  Esempio: `Spuntino-seccatura-zefiro-incontro-lacuna-ambito-lombare4`.
  Robustezza: 7 × 11 + log₂(10) = **80,3 bit → Forte**, circa 2 milioni di anni con la stima attuale
  (attacco offline a 10 miliardi di tentativi al secondo, metà delle combinazioni).
- La password a caratteri resta la modalità predefinita.
- Il comportamento è quello della bozza approvata (vedi sotto).

## Comportamento (dalla bozza approvata)

- **Selettore** "Password | Passphrase" sopra la ruota, nello stile Caveau (pillola con la voce attiva in ottone).
  Cambiando modalità si genera subito una nuova password/passphrase con l'animazione completa.
- **Opzioni della passphrase** (al posto delle pillole dei caratteri):
  - "Parole": da **4 a 10**, con slider e campo numerico come la lunghezza oggi; predefinito 7;
  - pillole "Maiuscola" e "Cifra finale", attive di base;
  - "Separatore": scelta esclusiva tra `-` (predefinito), `.`, `_` e spazio. Non esiste l'opzione senza separatore.
  - riga di aiuto: "Per le password da ricordare e digitare: computer, gestore di password, Wi-Fi."
- **Entropia:** parole × 11 + (cifra finale attiva ? log₂(10) : 0). Stesse soglie, colori e timbri di oggi
  (4 parole + cifra ≈ 47 bit → Debole; 5 ≈ 58 → Discreta; 6 ≈ 69 → Discreta; 7 ≈ 80 → Forte; 9 ≈ 102 → Molto forte).
- **Animazione:** identica (ruota, lettere che si fissano, perni, timbro). Le lettere di passaggio sono minuscole.
- **Nella ruota** la passphrase va a capo solo tra una parola e l'altra (il separatore resta attaccato alla parola
  che lo precede) e deve stare tutta nel quadrante, come le password, anche a 10 parole e a 360 px.
- **Opzioni cambiate:** come per le password, nessuna generazione; anteprima della robustezza, testo
  "Opzioni cambiate. Premi «Genera e sigilla» per una nuova passphrase." e avviso di copia "Passphrase precedente
  copiata…" nello stesso stato.
- **Preferenze:** salvate nel browser come oggi (mai la passphrase): modalità scelta e opzioni di ciascuna modalità.
  Ogni modalità ricorda le sue impostazioni. Le preferenze salvate dalla versione 1.1.0 restano valide.

## Vincoli tecnici

- Valgono tutti i vincoli del restyling: CSP invariata, nessuna risorsa esterna, JS e CSS vanilla, nessun build step.
- **La lista è inclusa nel sito e caricata con la pagina** (per esempio come file JS statico che definisce l'array),
  **mai scaricata al momento della generazione**. Il service worker la mette in cache per l'uso offline.
- **Una sola fonte per la lista:** il file della lista è lo stesso per browser e server (il server lo legge, o il file
  JS viene generato dal file di testo con uno script, con un test che verifica che coincidano).
- Scelta delle parole e della cifra con lo stesso `randomInt` senza bias nel browser e con `secrets` sul server.
- Licenza: includere il testo MIT del BIP-39 accanto alla lista, citarla nel README e con una nota nella pagina `/api`.
- `APP_VERSION` → **1.2.0**.

## API

Nuovo endpoint `GET /api/v1/passphrase`, stessa forma e stesse regole di `/api/v1/generate`
(`Cache-Control: no-store`, errori 422):

| Parametro | Tipo | Predefinito |
|---|---|---|
| `words` | intero, 4–10 | 7 |
| `capitalize` | booleano | true |
| `number` | booleano | true |
| `separator` | uno tra `-`, `.`, `_`, `space` | `-` |

Risposta: `{"passphrase": "...", "words": 7, "entropy_bits": 80.3, "strength": "strong"}`.
La pagina `/api` documenta il nuovo endpoint con tabella dei parametri, esempio `curl` e risposta reale.

## Testi del sito da aggiornare

- **Hero:** invariato.
- **Come funziona, passaggio 01 "Scegli le regole":** citare anche la passphrase (numero di parole, separatore).
- **Come funziona, passaggio 04 "Misura onesta":** aggiungere la formula per le passphrase (parole × 11 bit).
- **Sicurezza:** una riga che spiega che i calcoli delle passphrase valgono anche se l'attaccante conosce la lista,
  perché le parole le sceglie il computer a caso; una passphrase con parole scelte da una persona è molto più debole.
- Tutte le affermazioni della scheda Sicurezza devono restare vere anche in modalità passphrase.

## Decisioni prese da me (da verificare)

- Maiuscola e cifra servono a superare le regole aziendali (3 tipi di caratteri su 4: con maiuscola, minuscole,
  cifra e trattino la passphrase ne ha 4). Nel calcolo dei bit conta solo la cifra (10 possibilità).
- Nessuna opzione "senza separatore": le parole attaccate si leggono male e rendono il calcolo meno preciso.
- Cambiando modalità si genera subito, invece di passare allo stato "anteprima": chi preme "Passphrase" la vuole vedere.
- Endpoint API separato (`/api/v1/passphrase`) invece di un parametro su `/api/v1/generate`: risposte e parametri
  diversi, più chiaro da documentare.
- Le lettere che scorrono durante l'animazione sono minuscole casuali (generate con `randomInt`, come oggi).
- Nell'API lo spazio come separatore si scrive `separator=space`: uno spazio vero in un indirizzo web è scomodo
  da digitare. Qualsiasi altro valore riceve un 422.

## Lasciato al builder

- Come organizzare il codice JS (stesso file o un modulo in più) e il formato del file della lista.
- Dettagli di impaginazione del selettore e delle nuove pillole, restando nello stile della bozza.
- Calcolo esatto delle righe della passphrase nella ruota, purché nessuna parola venga spezzata e tutto resti nel quadrante.
- Quali test aggiungere. Il minimo: la lista ha 2.048 parole uniche senza accenti e coincide tra browser e server;
  la passphrase generata dal server rispetta le opzioni; l'endpoint risponde con gli header giusti e i 422 previsti;
  la pagina `/api` documenta l'endpoint; il service worker mette in cache la lista; i test esistenti restano verdi.
