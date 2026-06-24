// Cloudflare Worker — bot Telegram "oracolo del fumo" per il Secret Santa.
//
// Sempre attivo, gratis, risposte istantanee (webhook). Stesso database del
// sito: legge temi.json dalla pagina GitHub Pages (unica fonte di verità).
//
// Variabili da impostare nel Worker (Settings -> Variables and Secrets):
//   BOT_TOKEN       (secret)  -> token del bot da @BotFather   [obbligatorio]
//   WEBHOOK_SECRET  (secret)  -> stringa a piacere per blindare il webhook [opzionale]
//
// Comandi: /tema  /vota [N]  /regali [N]  /help

const TEMI_URL = "https://gust0o.github.io/SecretSantaTheme/temi.json";
let TEMI = null; // cache in memoria dell'isolate (riusata tra le richieste)

async function caricaTemi() {
  if (TEMI) return TEMI;
  const r = await fetch(TEMI_URL, { cf: { cacheTtl: 3600, cacheEverything: true } });
  const dati = await r.json();
  TEMI = dati.map((t) => (t && t.tema ? t.tema : t));
  return TEMI;
}

const esc = (s) =>
  String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const pick = (a) => a[Math.floor(Math.random() * a.length)];
function sample(a, n) {
  const c = a.slice();
  const out = [];
  n = Math.min(n, c.length);
  for (let i = 0; i < n; i++) out.push(c.splice(Math.floor(Math.random() * c.length), 1)[0]);
  return out;
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function tg(token, method, body) {
  const r = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return r.json();
}

async function gestisci(update, env) {
  const token = env.BOT_TOKEN;
  const msg = update.message || update.channel_post;
  if (!msg || !msg.text) return;
  const text = msg.text.trim();
  if (!text.startsWith("/")) return;

  const chatId = msg.chat.id;
  const parts = text.split(/\s+/);
  const cmd = parts[0].slice(1).split("@")[0].toLowerCase(); // /vota@MioBot -> vota
  const args = parts.slice(1);
  const temi = await caricaTemi();

  if (cmd === "tema") {
    const r = await tg(token, "sendMessage", {
      chat_id: chatId,
      text: "🌫️ <i>Evoco un tema dal fumo…</i>",
      parse_mode: "HTML",
    });
    const testo = "🔮 <b>" + esc(pick(temi)) + "</b>";
    if (r && r.ok && r.result && r.result.message_id) {
      await sleep(1300); // piccola suspense
      await tg(token, "editMessageText", {
        chat_id: chatId,
        message_id: r.result.message_id,
        text: testo,
        parse_mode: "HTML",
      });
    } else {
      await tg(token, "sendMessage", { chat_id: chatId, text: testo, parse_mode: "HTML" });
    }
  } else if (cmd === "vota" || cmd === "sondaggio") {
    let n = args[0] && /^\d+$/.test(args[0]) ? parseInt(args[0], 10) : 5;
    n = Math.max(2, Math.min(10, n)); // Telegram: 2..10 opzioni
    const opzioni = sample(temi, n);
    await tg(token, "sendMessage", {
      chat_id: chatId,
      text: `🗳️ <i>Il fumo propone ${n} temi… votate il preferito!</i>`,
      parse_mode: "HTML",
    });
    await tg(token, "sendPoll", {
      chat_id: chatId,
      question: "🎁 Quale tema per il Secret Santa?",
      options: opzioni,
      is_anonymous: false,
      allows_multiple_answers: false,
    });
  } else if (cmd === "regali" || cmd === "estrai") {
    let n = args[0] && /^\d+$/.test(args[0]) ? parseInt(args[0], 10) : 8;
    n = Math.max(1, Math.min(temi.length, n));
    const righe = [`🎁 <b>Temi estratti (${n} regali)</b>\n`];
    sample(temi, n).forEach((t, i) => righe.push(`<b>Regalo ${i + 1}:</b> ${esc(t)}`));
    await tg(token, "sendMessage", { chat_id: chatId, text: righe.join("\n"), parse_mode: "HTML" });
  } else if (cmd === "start" || cmd === "help") {
    await tg(token, "sendMessage", {
      chat_id: chatId,
      parse_mode: "HTML",
      text:
        "🔮 <b>Oracolo del fumo — Secret Santa</b>\n\n" +
        "/tema — evoca un tema a caso\n" +
        "/vota [N] — N temi (2-10) e apre un sondaggio per votare\n" +
        "/regali [N] — estrae N temi (default 8), uno per regalo\n" +
        "/help — questo messaggio",
    });
  }
}

export default {
  async fetch(request, env, ctx) {
    if (request.method === "GET") {
      return new Response(
        "🔮 Oracolo del fumo — bot attivo. Imposta il webhook di Telegram su questo URL.",
        { status: 200 }
      );
    }
    if (request.method !== "POST") return new Response("Method not allowed", { status: 405 });

    // blindatura opzionale: Telegram rimanda il secret in questo header
    if (env.WEBHOOK_SECRET) {
      if (request.headers.get("X-Telegram-Bot-Api-Secret-Token") !== env.WEBHOOK_SECRET)
        return new Response("forbidden", { status: 403 });
    }
    if (!env.BOT_TOKEN) return new Response("missing BOT_TOKEN", { status: 500 });

    let update;
    try {
      update = await request.json();
    } catch (e) {
      return new Response("bad request", { status: 400 });
    }
    // rispondo subito 200; il lavoro (inclusa la suspense) continua in background
    ctx.waitUntil(gestisci(update, env).catch((e) => console.log("errore:", e)));
    return new Response("ok", { status: 200 });
  },
};
