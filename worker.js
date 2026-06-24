// Deploy via Cloudflare Workers Builds (auto da GitHub, branch main).
// Cloudflare Worker — bot Telegram "oracolo del fumo" per il Secret Santa.
//
// Sempre attivo, gratis, risposte istantanee (webhook). Stesso database del
// sito: legge temi.json dalla pagina GitHub Pages (unica fonte di verità).
//
// Variabili da impostare nel Worker (Settings -> Variables and Secrets, RUNTIME):
//   BOT_TOKEN       (secret)  -> token del bot da @BotFather   [obbligatorio]
//   WEBHOOK_SECRET  (secret)  -> stringa a piacere per blindare il webhook [opzionale]
//
// Comandi: /tema  /vota [N]  /help
// /vota apre una procedura a bottoni: numero opzioni -> anonimo? -> scelta multipla?

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

// bottoni rapidi (benvenuto, /start, /help)
const BOTTONI = {
  inline_keyboard: [[
    { text: "🔮 Tema a caso", callback_data: "act:tema" },
    { text: "🗳️ Genera sondaggio", callback_data: "act:vota" },
  ]],
};

// invia un tema a caso con piccola suspense
async function inviaTema(token, chatId, temi) {
  const r = await tg(token, "sendMessage", {
    chat_id: chatId, text: "🌫️ <i>Evoco un tema dal fumo…</i>", parse_mode: "HTML",
  });
  const testo = "🔮 <b>" + esc(pick(temi)) + "</b>";
  if (r && r.ok && r.result && r.result.message_id) {
    await sleep(1300);
    await tg(token, "editMessageText", {
      chat_id: chatId, message_id: r.result.message_id, text: testo, parse_mode: "HTML",
    });
  } else {
    await tg(token, "sendMessage", { chat_id: chatId, text: testo, parse_mode: "HTML" });
  }
}

// messaggio di benvenuto quando il bot viene aggiunto a un gruppo
function inviaBenvenuto(token, chatId) {
  return tg(token, "sendMessage", {
    chat_id: chatId,
    parse_mode: "HTML",
    text:
      "🔮 <b>Oracolo del fumo</b> è arrivato!\n\n" +
      "Toccate un bottone qui sotto, oppure usate <b>/vota</b> per il sondaggio e <b>/tema</b> per un tema a caso.",
    reply_markup: BOTTONI,
  });
}

// invia un nuovo messaggio oppure modifica quello esistente (durante la procedura)
function inviaOEdita(token, chatId, messageId, text, inline_keyboard) {
  const base = { chat_id: chatId, text, parse_mode: "HTML", reply_markup: { inline_keyboard } };
  if (messageId) return tg(token, "editMessageText", { ...base, message_id: messageId });
  return tg(token, "sendMessage", base);
}

// Procedura /vota guidata dai bottoni. Lo stato viaggia nei callback_data:
//   v:<n>:<anon>:<multi>   dove ogni campo è un numero oppure "?" (non ancora scelto)
async function passoVota(token, chatId, messageId, n, anon, multi, temi) {
  // 1) quante opzioni?
  if (n === null) {
    const kb = [];
    let row = [];
    for (let i = 2; i <= 10; i++) {
      row.push({ text: String(i), callback_data: `v:${i}:?:?` });
      if (row.length === 3) { kb.push(row); row = []; }
    }
    if (row.length) kb.push(row);
    return inviaOEdita(token, chatId, messageId,
      "🗳️ <b>Quante opzioni</b> nel sondaggio? (2–10)", kb);
  }
  // 2) anonimo?
  if (anon === null) {
    const kb = [[
      { text: "🙈 Anonimo", callback_data: `v:${n}:1:?` },
      { text: "👀 Voto palese", callback_data: `v:${n}:0:?` },
    ]];
    return inviaOEdita(token, chatId, messageId, "🗳️ <b>Voto anonimo?</b>", kb);
  }
  // 3) scelta multipla?
  if (multi === null) {
    const a = anon ? 1 : 0;
    const kb = [[
      { text: "☑️ Una sola scelta", callback_data: `v:${n}:${a}:0` },
      { text: "✅ Scelta multipla", callback_data: `v:${n}:${a}:1` },
    ]];
    return inviaOEdita(token, chatId, messageId,
      "🗳️ <b>Si può votare più di un tema?</b>", kb);
  }
  // 4) tutto scelto -> crea il sondaggio
  const opzioni = sample(temi, n);
  if (messageId) {
    await tg(token, "editMessageText", {
      chat_id: chatId, message_id: messageId, parse_mode: "HTML",
      text: `🗳️ <i>Il fumo propone ${n} temi…</i> ` +
            `(${anon ? "anonimo" : "palese"}, ${multi ? "scelta multipla" : "scelta singola"})`,
    });
  }
  await tg(token, "sendPoll", {
    chat_id: chatId,
    question: "🎁 Quale tema per il Secret Santa?",
    options: opzioni,
    is_anonymous: anon,
    allows_multiple_answers: multi,
  });
}

async function gestisci(update, env) {
  const token = env.BOT_TOKEN;
  const temi = await caricaTemi();

  // --- inline mode: @SecretSantaVagbot in qualunque chat ---
  // NB: Telegram non consente di inviare un SONDAGGIO via inline (solo messaggi).
  // Quindi l'inline manda un tema a caso (o cerca); per il sondaggio si usa /vota.
  if (update.inline_query) {
    const iq = update.inline_query;
    const q = (iq.query || "").trim().toLowerCase();
    const art = (id, t, title, desc) => ({
      type: "article",
      id,
      title,
      description: desc,
      input_message_content: { message_text: "🔮 <b>" + esc(t) + "</b>", parse_mode: "HTML" },
    });
    let results;
    if (q) {
      // ricerca per sottostringa
      results = temi
        .filter((t) => t.toLowerCase().includes(q))
        .slice(0, 25)
        .map((t, i) => art(String(i), t, t, "🔮 Tocca per inviare questo tema"));
    } else {
      // una sola voce: tocchi e mandi un tema a caso
      const t = pick(temi);
      results = [art("rnd", t, "🎲 Tema a caso", t)];
    }
    if (!results.length) {
      results = [{
        type: "article",
        id: "0",
        title: "Nessun tema trovato",
        input_message_content: { message_text: "Nessun tema trovato 🤷" },
      }];
    }
    await tg(token, "answerInlineQuery", {
      inline_query_id: iq.id,
      results,
      cache_time: 1, // basso: così "tema a caso" cambia ogni volta
      is_personal: true,
    });
    return;
  }

  // --- bot aggiunto/rimosso da un gruppo: messaggio di benvenuto coi bottoni ---
  if (update.my_chat_member) {
    const nuovo = update.my_chat_member.new_chat_member?.status;
    const vecchio = update.my_chat_member.old_chat_member?.status;
    if ((nuovo === "member" || nuovo === "administrator") &&
        (vecchio === "left" || vecchio === "kicked" || !vecchio)) {
      await inviaBenvenuto(token, update.my_chat_member.chat.id);
    }
    return;
  }

  // --- pressione di un bottone ---
  if (update.callback_query) {
    const cq = update.callback_query;
    const data = cq.data || "";
    await tg(token, "answerCallbackQuery", { callback_query_id: cq.id });
    if (!cq.message) return;
    const chatId = cq.message.chat.id;
    if (data === "act:tema") {
      await inviaTema(token, chatId, temi);
    } else if (data === "act:vota") {
      await passoVota(token, chatId, null, null, null, null, temi); // avvia: chiede il numero
    } else if (data.startsWith("v:")) {
      const [, ns, as, ms] = data.split(":");
      const n = ns === "?" ? null : parseInt(ns, 10);
      const anon = as === "?" ? null : as === "1";
      const multi = ms === "?" ? null : ms === "1";
      await passoVota(token, chatId, cq.message.message_id, n, anon, multi, temi);
    }
    return;
  }

  // --- messaggi/comandi ---
  const msg = update.message || update.channel_post;
  if (!msg || !msg.text) return;
  const text = msg.text.trim();
  if (!text.startsWith("/")) return;

  const chatId = msg.chat.id;
  const parts = text.split(/\s+/);
  const cmd = parts[0].slice(1).split("@")[0].toLowerCase(); // /vota@MioBot -> vota
  const args = parts.slice(1);

  if (cmd === "tema") {
    await inviaTema(token, chatId, temi);
  } else if (cmd === "vota" || cmd === "sondaggio") {
    if (args[0] && /^\d+$/.test(args[0])) {
      // numero dato -> salta la domanda sul numero, chiedi anonimo/multipla
      const n = Math.max(2, Math.min(10, parseInt(args[0], 10)));
      await passoVota(token, chatId, null, n, null, null, temi);
    } else {
      // niente numero -> chiedi quante opzioni
      await passoVota(token, chatId, null, null, null, null, temi);
    }
  } else if (cmd === "start" || cmd === "help") {
    await tg(token, "sendMessage", {
      chat_id: chatId,
      parse_mode: "HTML",
      text:
        "🔮 <b>Oracolo del fumo — Secret Santa</b>\n\n" +
        "/tema — evoca un tema a caso\n" +
        "/vota [N] — sondaggio per votare (chiede numero opzioni, anonimo, scelta multipla)\n" +
        "/help — questo messaggio",
      reply_markup: BOTTONI,
    });
  }
}

export default {
  async fetch(request, env, ctx) {
    if (request.method === "GET") {
      return new Response("🔮 Oracolo del fumo — bot attivo (v5).", { status: 200 });
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
    // rispondo subito 200; il lavoro continua in background
    ctx.waitUntil(gestisci(update, env).catch((e) => console.log("errore:", e)));
    return new Response("ok", { status: 200 });
  },
};
