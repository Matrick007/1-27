/**
 * Cloudflare Worker — приём голосов с очередью.  (НЕ ПРОВЕРЯЛСЯ в бою — проверьте на тестовом чате.)
 *
 * Зачем: Telegram не даёт слать в один чат больше ~20 сообщений в минуту, поэтому при наплыве
 * прямые запросы из приложения получают 429. Здесь голос быстро кладётся в KV (ответ клиенту сразу),
 * а раз в минуту cron собирает голоса в пачки и отправляет несколькими сообщениями.
 * Токен бота хранится в секретах Worker и из клиента убирается.
 *
 * Настройка (wrangler.toml):
 *   [[kv_namespaces]]  binding = "VOTES"  id = "<id вашего KV>"
 *   [triggers]         crons = ["* * * * *"]
 *   секреты: wrangler secret put BOT_TOKEN ; wrangler secret put CHAT_ID
 * Потом в script.js:  VOTE_CONFIG.endpoint = 'https://<ваш-worker>.workers.dev/vote'
 */
const CORS = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'content-type', 'Access-Control-Allow-Methods': 'POST, OPTIONS' };
export default {
  async fetch(req, env) {
    if (req.method === 'OPTIONS') return new Response(null, { headers: CORS });
    if (req.method !== 'POST') return new Response('ok', { headers: CORS });
    let v; try { v = await req.json(); } catch { return new Response('bad', { status: 400, headers: CORS }); }
    if (!v || typeof v.id !== 'string' || typeof v.votes !== 'object') return new Response('bad', { status: 400, headers: CORS });
    const key = 'v:' + (v.userId && v.userId !== 'Аноним' ? v.userId : v.id);   // один голос на пользователя Telegram
    if (!(await env.VOTES.get(key)) && !(await env.VOTES.get('sent:' + key))) {
      await env.VOTES.put(key, JSON.stringify({ u: String(v.username || 'Аноним').slice(0, 64), votes: v.votes }), { expirationTtl: 86400 });
    }
    return new Response('ok', { headers: CORS });
  },
  async scheduled(_e, env) {
    const list = await env.VOTES.list({ prefix: 'v:', limit: 100 });
    let chunk = '', keys = [];
    const flush = async () => {
      if (!chunk) return;
      const r = await fetch(`https://api.telegram.org/bot${env.BOT_TOKEN}/sendMessage`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ chat_id: env.CHAT_ID, text: chunk }) });
      if (r.ok) for (const k of keys) { await env.VOTES.delete(k); await env.VOTES.put('sent:' + k, '1', { expirationTtl: 604800 }); }
      chunk = ''; keys = [];
    };
    for (const { name } of list.keys) {
      const d = JSON.parse(await env.VOTES.get(name));
      const text = `@${d.u} проголосовал за:\n` + Object.entries(d.votes).map(([r, n]) => `${r}: ${n}`).join('\n') + '\n\n';
      if ((chunk + text).length > 3800) await flush();
      chunk += text; keys.push(name);
    }
    await flush();
  }
};
