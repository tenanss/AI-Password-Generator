"""Generazione crittograficamente sicura delle passphrase in italiano.

Lista: BIP-39 italiano (2048 parole, licenza MIT), in static/wordlists/it-bip39.txt.
La stessa logica e' replicata nel browser in static/js/app.js, che usa la stessa
lista (copiata in static/js/wordlist-it.js da tools/make_wordlist_js.py).
"""

from __future__ import annotations

import math
import secrets
from dataclasses import dataclass
from pathlib import Path

MIN_WORDS = 4
MAX_WORDS = 10
DEFAULT_WORDS = 7

# Nome del separatore (usato dall'API) -> carattere.
SEPARATORS = {"-": "-", ".": ".", "_": "_", "space": " "}

_WORDLIST_PATH = Path(__file__).resolve().parent / "static" / "wordlists" / "it-bip39.txt"
WORDLIST: tuple[str, ...] = tuple(
    line.strip() for line in _WORDLIST_PATH.read_text(encoding="utf-8").splitlines() if line.strip()
)


@dataclass(frozen=True)
class PassphraseOptions:
    words: int = DEFAULT_WORDS
    capitalize: bool = True
    number: bool = True
    separator: str = "-"


def _validate(options: PassphraseOptions) -> None:
    if not MIN_WORDS <= options.words <= MAX_WORDS:
        raise ValueError(f"Il numero di parole deve essere tra {MIN_WORDS} e {MAX_WORDS}.")
    if options.separator not in SEPARATORS:
        raise ValueError("Separatore non valido: usa '-', '.', '_' oppure 'space'.")


def generate_passphrase(options: PassphraseOptions = PassphraseOptions()) -> str:
    _validate(options)
    words = [secrets.choice(WORDLIST) for _ in range(options.words)]
    # Maiuscola e cifra in posizione fissa: servono a superare le regole aziendali.
    if options.capitalize:
        words[0] = words[0][0].upper() + words[0][1:]
    if options.number:
        words[-1] += str(secrets.randbelow(10))
    return SEPARATORS[options.separator].join(words)


def entropy_bits(options: PassphraseOptions) -> float:
    """Solo le scelte casuali contano: le parole e, se presente, la cifra."""
    _validate(options)
    bits = options.words * math.log2(len(WORDLIST))
    if options.number:
        bits += math.log2(10)
    return bits
