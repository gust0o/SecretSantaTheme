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

## Sito (l'oracolo del fumo)

`index.html` è un mini-sito a pagina singola, stile "quest di Jumanji": uno
sfondo di nebbia particellare (solo CSS), una scritta iniziale _premi il tasto_
e un tasto misterioso senza indicazioni. A ogni pressione viene estratto **un
solo tema** a caso, che emerge dal fumo e fluttua. Funziona da desktop e mobile,
senza dipendenze.

Per pubblicarlo con **GitHub Pages**: Settings → Pages → _Deploy from a branch_
→ branch `main`, cartella `/ (root)`. Il sito sarà su
`https://<utente>.github.io/SecretSantaTheme/` e legge i temi da `temi.json`.

## Bot Telegram

`bot_telegram.py` porta lo stesso oracolo su Telegram (stesso `temi.json`, solo
Python 3, nessuna dipendenza). Comandi:

- `/tema` — evoca **un** tema a caso (con un po' di suspense)
- `/vota [N]` — genera N temi (2–10, default 5) e apre un **sondaggio nativo**
  di Telegram per farli votare al gruppo
- `/regali [N]` — estrae N temi (default 8), uno per regalo
- `/help` — istruzioni

**Setup:**

1. Crea il bot con [@BotFather](https://t.me/BotFather) → ottieni il token.
2. Passa il token come variabile d'ambiente (**non** va scritto nel codice né
   committato) e avvia:

   ```bash
   export TELEGRAM_BOT_TOKEN="123456:ABC-..."
   python3 bot_telegram.py
   ```

Il bot usa long-polling: va tenuto in esecuzione su una macchina/server (il PC,
una VPS, ecc.). Per il voto in gruppo, aggiungi il bot al gruppo e usa `/vota`.

## Note

Repository volutamente generico: nessun nome, nessuna informazione personale,
nessun riferimento a partecipanti o eventi specifici. Solo temi. Il token del
bot Telegram si passa via variabile d'ambiente e non è presente nel repo.
