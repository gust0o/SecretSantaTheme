# SecretSantaTheme

Un database di **500 temi** per un Secret Santa fuori di testa.

I temi sono pensati per essere **strani, assurdi e astratti** — ma mai del
tutto inutilizzabili: per quanto surreale, ogni tema deve poter ispirare un
**regalo concreto** (acquistabile o fai-da-te). L'idea è ricevere un tema come
vincolo creativo e tradurlo in un oggetto reale.

## Contenuto

- **`temi.json`** — i 500 temi, divisi in 10 categorie (50 ciascuna):
  oggetti impossibili, emozioni astratte, burocrazia surreale, gastronomia
  improbabile, creature assurde, concetti filosofici, nostalgia retrò, onirico
  surreale, tecnologia distopica, rituali quotidiani.
- **`estrai.py`** — pesca a caso i temi, uno per regalo.

Ogni tema è un oggetto:

```json
{ "id": 1, "categoria": "oggetti impossibili", "tema": "Una scatola che contiene se stessa" }
```

## Estrarre i temi

Servono solo Python 3 (nessuna dipendenza esterna).

```bash
python3 estrai.py                     # 8 temi, uno per regalo
python3 estrai.py -n 5                # estrae 5 temi
python3 estrai.py --una-per-categoria # tutti di categorie diverse
python3 estrai.py --seed 42           # estrazione riproducibile
```

## Note

Repository volutamente generico: nessun nome, nessuna informazione personale,
nessun riferimento a partecipanti o eventi specifici. Solo temi.
