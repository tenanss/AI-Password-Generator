import math

import pytest

import generator
from generator import Options


def test_default_length_and_all_classes_present():
    for _ in range(200):
        password = generator.generate()
        assert len(password) == generator.DEFAULT_LENGTH
        assert any(c in generator.LOWER for c in password)
        assert any(c in generator.UPPER for c in password)
        assert any(c in generator.DIGITS for c in password)
        assert any(c in generator.SYMBOLS for c in password)


@pytest.mark.parametrize("length", [generator.MIN_LENGTH, 20, generator.MAX_LENGTH])
def test_requested_length(length):
    assert len(generator.generate(Options(length=length))) == length


def test_only_selected_classes():
    password = generator.generate(Options(length=64, upper=False, symbols=False))
    assert set(password) <= set(generator.LOWER + generator.DIGITS)


def test_exclude_ambiguous():
    opts = Options(length=128, exclude_ambiguous=True)
    for _ in range(50):
        assert not set(generator.generate(opts)) & generator.AMBIGUOUS


def test_passwords_are_unique():
    assert len({generator.generate() for _ in range(1000)}) == 1000


@pytest.mark.parametrize("length", [generator.MIN_LENGTH - 1, generator.MAX_LENGTH + 1, 0, -5])
def test_invalid_length_rejected(length):
    with pytest.raises(ValueError):
        generator.generate(Options(length=length))


def test_no_classes_rejected():
    with pytest.raises(ValueError):
        generator.generate(Options(lower=False, upper=False, digits=False, symbols=False))


def test_entropy():
    full = len(generator.LOWER + generator.UPPER + generator.DIGITS + generator.SYMBOLS)
    assert generator.entropy_bits(Options(length=16)) == pytest.approx(16 * math.log2(full))
    assert generator.entropy_bits(
        Options(length=10, lower=False, upper=False, symbols=False)
    ) == pytest.approx(10 * math.log2(10))


@pytest.mark.parametrize(
    "bits,level",
    [(0, "weak"), (49.9, "weak"), (50, "fair"), (69.9, "fair"),
     (70, "strong"), (99.9, "strong"), (100, "very_strong"), (500, "very_strong")],
)
def test_strength_levels(bits, level):
    assert generator.strength(bits) == level
