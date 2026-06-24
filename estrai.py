#!/usr/bin/env python3
"""
Estrattore di temi per il Secret Santa.

Pesca a caso N temi (default 8) dal database `temi.json`.
Ogni tema estratto è il "vincolo creativo" per un regalo: per quanto
strano o astratto, deve poter ispirare un oggetto fisico reale.

Uso:
    python3 estrai.py            # estrae 8 temi, uno per regalo
    python3 estrai.py -n 5       # estrae 5 temi
    python3 estrai.py --seed 42  # estrazione riproducibile
    python3 estrai.py --una-per-categoria   # evita due temi della stessa categoria
"""
import argparse
import json
import random
from pathlib import Path

DB = Path(__file__).parent / "temi.json"


def carica():
    with open(DB, encoding="utf-8") as f:
        return json.load(f)


def estrai(temi, n, una_per_categoria=False, rng=random):
    if una_per_categoria:
        per_cat = {}
        for t in temi:
            per_cat.setdefault(t["categoria"], []).append(t)
        categorie = list(per_cat)
        rng.shuffle(categorie)
        if n > len(categorie):
            raise SystemExit(
                f"Solo {len(categorie)} categorie disponibili: impossibile "
                f"estrarne {n} tutte diverse."
            )
        return [rng.choice(per_cat[c]) for c in categorie[:n]]
    if n > len(temi):
        raise SystemExit(f"Il database ha solo {len(temi)} temi.")
    return rng.sample(temi, n)


def main():
    p = argparse.ArgumentParser(description="Estrae temi a caso per il Secret Santa.")
    p.add_argument("-n", "--numero", type=int, default=8,
                   help="quanti temi estrarre (default: 8, uno per regalo)")
    p.add_argument("--seed", type=int, default=None,
                   help="seme per un'estrazione riproducibile")
    p.add_argument("--una-per-categoria", action="store_true",
                   help="estrai temi tutti di categorie diverse")
    args = p.parse_args()

    rng = random.Random(args.seed) if args.seed is not None else random
    temi = carica()
    scelti = estrai(temi, args.numero, args.una_per_categoria, rng)

    print(f"\n  🎁  Temi estratti ({len(scelti)} regali) — database di {len(temi)} temi\n")
    for i, t in enumerate(scelti, 1):
        print(f"  Regalo {i}: {t['tema']}")
        print(f"            ({t['categoria']} · #{t['id']})\n")


if __name__ == "__main__":
    main()
