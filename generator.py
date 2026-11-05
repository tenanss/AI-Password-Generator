"""Generazione crittograficamente sicura delle password.

La stessa logica e' replicata nel browser in static/js/app.js:
se modifichi set di caratteri o soglie qui, aggiornali anche li'.
"""

from __future__ import annotations

import math
import secrets
import string
from dataclasses import dataclass

MIN_LENGTH = 8
MAX_LENGTH = 128
DEFAULT_LENGTH = 16

LOWER = string.ascii_lowercase
UPPER = string.ascii_uppercase
DIGITS = string.digits
SYMBOLS = "!@#$%^&*()-_=+[]{};:,.<>?/~"
AMBIGUOUS = frozenset("O0oIl1")

# Soglie in bit di entropia (limite superiore escluso) -> livello.
STRENGTH_LEVELS = (
    (50, "weak"),
    (70, "fair"),
    (100, "strong"),
    (math.inf, "very_strong"),
)


@dataclass(frozen=True)
class Options:
    length: int = DEFAULT_LENGTH
    lower: bool = True
    upper: bool = True
    digits: bool = True
    symbols: bool = True
    exclude_ambiguous: bool = False


def character_pools(options: Options) -> list[str]:
    """Restituisce un gruppo di caratteri per ogni tipo selezionato."""
    selected = (
        (options.lower, LOWER),
        (options.upper, UPPER),
        (options.digits, DIGITS),
        (options.symbols, SYMBOLS),
    )
    pools = []
    for enabled, chars in selected:
        if not enabled:
            continue
        if options.exclude_ambiguous:
            chars = "".join(c for c in chars if c not in AMBIGUOUS)
        pools.append(chars)
    return pools


def _validated_pools(options: Options) -> list[str]:
    if not MIN_LENGTH <= options.length <= MAX_LENGTH:
        raise ValueError(
            f"La lunghezza deve essere compresa tra {MIN_LENGTH} e {MAX_LENGTH}."
        )
    pools = character_pools(options)
    if not pools:
        raise ValueError("Seleziona almeno un tipo di carattere.")
    return pools


def generate(options: Options = Options()) -> str:
    """Genera una password che contiene almeno un carattere per ogni tipo scelto."""
    pools = _validated_pools(options)
    alphabet = "".join(pools)

    chars = [secrets.choice(pool) for pool in pools]
    chars += [secrets.choice(alphabet) for _ in range(options.length - len(chars))]

    # Fisher-Yates con sorgente crittografica: i caratteri garantiti
    # non restano nelle prime posizioni.
    for i in range(len(chars) - 1, 0, -1):
        j = secrets.randbelow(i + 1)
        chars[i], chars[j] = chars[j], chars[i]
    return "".join(chars)


def entropy_bits(options: Options) -> float:
    """Stima dell'entropia: lunghezza x log2(dimensione dell'alfabeto)."""
    pools = _validated_pools(options)
    return options.length * math.log2(sum(len(pool) for pool in pools))


def strength(bits: float) -> str:
    for limit, level in STRENGTH_LEVELS:
        if bits < limit:
            return level
    raise AssertionError("unreachable")
