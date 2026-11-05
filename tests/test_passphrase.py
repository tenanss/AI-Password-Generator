import json
import math
import re
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
    options = pp.PassphraseOptions(words=5, capitalize=False, number=False, separator=sep)
    words = pp.generate_passphrase(options).split(char)
    assert len(words) == 5 and all(w in pp.WORDLIST for w in words)


def test_entropy_values():
    assert pp.entropy_bits(pp.PassphraseOptions()) == pytest.approx(7 * 11 + math.log2(10))  # 80,3
    assert pp.entropy_bits(pp.PassphraseOptions(words=4, number=False)) == pytest.approx(44)


@pytest.mark.parametrize("bad", [dict(words=3), dict(words=11), dict(separator="x")])
def test_rejects_bad_options(bad):
    with pytest.raises(ValueError):
        pp.generate_passphrase(pp.PassphraseOptions(**bad))
