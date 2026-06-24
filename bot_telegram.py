#!/usr/bin/env python3
"""
Bot Telegram per il Secret Santa "oracolo del fumo".

Stesso database del sito (temi.json). Comandi:
    /tema            -> evoca UN tema a caso (con piccola suspense)
    /vota [N]        -> genera N temi (2-10, default 5) e apre un SONDAGGIO
                        nativo di Telegram per farli votare al gruppo
    /help            -> istruzioni

NESSUN dato personale nel codice: il token si legge dalla variabile
d'ambiente TELEGRAM_BOT_TOKEN (da NON committare).

Avvio:
    export TELEGRAM_BOT_TOKEN="123456:ABC-..."
    python3 bot_telegram.py

Richiede solo Python 3 (nessuna dipendenza esterna). Va tenuto in
esecuzione su una macchina/server: Telegram contatta il bot via long-polling.
"""
import json
import os
import random
import sys
import time
import urllib.request
import urllib.error
from pathlib import Path

TOKEN = os.environ.get("TELEGRAM_BOT_TOKEN", "").strip()
API = "https://api.telegram.org/bot{}/{}".format(TOKEN, "{}")
DB = Path(__file__).parent / "temi.json"


def carica_temi():
    with open(DB, encoding="utf-8") as f:
        dati = json.load(f)
    return [t["tema"] if isinstance(t, dict) else t for t in dati]


def esc(s):
    """Escape per parse_mode HTML."""
    return s.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")


def chiama(metodo, http_timeout=40, **params):
    """Chiamata all'API di Telegram. Ritorna il campo 'result' o None su errore.

    http_timeout è il timeout della richiesta HTTP; eventuali parametri come
    'timeout' (long-polling di getUpdates) si passano in **params.
    """
    url = API.format(metodo)
    data = json.dumps(params).encode("utf-8")
    req = urllib.request.Request(
        url, data=data, headers={"Content-Type": "application/json"}
    )
    try:
        with urllib.request.urlopen(req, timeout=http_timeout) as r:
            payload = json.load(r)
        if not payload.get("ok"):
            print("API error:", payload.get("description"), file=sys.stderr)
            return None
        return payload.get("result")
    except urllib.error.HTTPError as e:
        print("HTTP", e.code, e.read().decode("utf-8", "ignore"), file=sys.stderr)
    except Exception as e:  # rete, timeout, ecc.
        print("Errore chiamata:", e, file=sys.stderr)
    return None


def manda(chat_id, testo, **kw):
    return chiama("sendMessage", chat_id=chat_id, text=testo,
                  parse_mode="HTML", **kw)


# ---------------------------------------------------------------- comandi

def cmd_tema(chat_id, _args, temi):
    # piccola suspense: messaggio segnaposto, poi lo trasformo nel tema
    res = manda(chat_id, "🌫️ <i>Evoco un tema dal fumo…</i>")
    tema = random.choice(temi)
    testo = "🔮 <b>{}</b>".format(esc(tema))
    if res and "message_id" in res:
        time.sleep(1.3)
        chiama("editMessageText", chat_id=chat_id, message_id=res["message_id"],
               text=testo, parse_mode="HTML")
    else:
        manda(chat_id, testo)


def cmd_vota(chat_id, args, temi):
    n = 5
    if args and args[0].isdigit():
        n = int(args[0])
    n = max(2, min(10, n))                      # Telegram: 2..10 opzioni
    opzioni = random.sample(temi, n)
    manda(chat_id, "🗳️ <i>Il fumo propone {} temi… votate il preferito!</i>".format(n))
    chiama("sendPoll", chat_id=chat_id,
           question="🎁 Quale tema per il Secret Santa?",
           options=opzioni,
           is_anonymous=False,
           allows_multiple_answers=False)


def cmd_help(chat_id, _args, _temi):
    manda(chat_id,
          "🔮 <b>Oracolo del fumo — Secret Santa</b>\n\n"
          "/tema — evoca un tema a caso\n"
          "/vota [N] — N temi (2-10) e apre un sondaggio per votare\n"
          "/help — questo messaggio")


COMANDI = {
    "start": cmd_help,
    "help": cmd_help,
    "tema": cmd_tema,
    "vota": cmd_vota,
    "sondaggio": cmd_vota,
}


def gestisci(update, temi):
    msg = update.get("message") or update.get("channel_post")
    if not msg:
        return
    testo = (msg.get("text") or "").strip()
    if not testo.startswith("/"):
        return
    chat_id = msg["chat"]["id"]
    parti = testo.split()
    comando = parti[0][1:].split("@")[0].lower()   # /vota@MioBot -> vota
    args = parti[1:]
    handler = COMANDI.get(comando)
    if handler:
        handler(chat_id, args, temi)


def main():
    if not TOKEN:
        sys.exit("ERRORE: imposta la variabile d'ambiente TELEGRAM_BOT_TOKEN "
                 "(token da @BotFather). Non scrivere il token nel codice.")
    temi = carica_temi()
    print("Bot avviato. {} temi caricati. In ascolto…".format(len(temi)))

    # verifica token
    me = chiama("getMe", http_timeout=10)
    if me:
        print("Connesso come @{}".format(me.get("username")))

    offset = None
    while True:
        params = {"timeout": 30}                 # long-polling lato Telegram
        if offset is not None:
            params["offset"] = offset
        updates = chiama("getUpdates", http_timeout=40, **params)
        if not updates:
            time.sleep(1)
            continue
        for up in updates:
            offset = up["update_id"] + 1
            try:
                gestisci(up, temi)
            except Exception as e:
                print("Errore gestione update:", e, file=sys.stderr)


if __name__ == "__main__":
    main()
