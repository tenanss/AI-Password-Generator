"""Genera static/js/wordlist-it.js dalla lista static/wordlists/it-bip39.txt.

Uso: .venv/Scripts/python tools/make_wordlist_js.py
Il file .txt e' l'unica fonte: il server lo legge direttamente, il browser riceve
questa copia in JS (caricata con la pagina, cosi' generare non fa richieste di rete).
"""

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SOURCE = ROOT / "static" / "wordlists" / "it-bip39.txt"
TARGET = ROOT / "static" / "js" / "wordlist-it.js"

HEADER = """// Lista di parole BIP-39 italiana (2048 parole), licenza MIT: vedi static/wordlists/LICENSE-BIP39.txt.
// Generato da tools/make_wordlist_js.py a partire da static/wordlists/it-bip39.txt: non modificare a mano.
"""


def main() -> None:
    words = [line.strip() for line in SOURCE.read_text(encoding="utf-8").splitlines() if line.strip()]
    TARGET.write_text(
        HEADER + "const WORDLIST_IT = Object.freeze(" + json.dumps(words, separators=(",", ":")) + ");\n",
        encoding="utf-8",
    )
    print(f"{len(words)} parole scritte in {TARGET}")


if __name__ == "__main__":
    main()
