const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";

const JSON_SYSTEM =
  "Ты создаёшь контент для изучения словацкого языка (уровень A1, учащийся русскоязычный). Возвращай ТОЛЬКО валидный JSON без markdown и пояснений.";

function extractJson(text) {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const raw = (fenced ? fenced[1] : text).trim();
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  return JSON.parse(raw.slice(start, end + 1));
}

function isValidQuizQuestion(q) {
  if (!q || !Array.isArray(q.options) || q.options.length < 2) return false;
  if (q.answer < 0 || q.answer >= q.options.length) return false;
  const opts = q.options.map((o) => String(o || "").trim());
  if (opts.some((o) => !o)) return false;
  if (new Set(opts.map((o) => o.toLowerCase())).size < opts.length) return false;
  const qText = q.q.replace(/[«»"]/g, "").toLowerCase().trim();
  if (opts.some((o) => qText.includes(o.toLowerCase()))) return false;
  return true;
}

export function createAi({ apiKey = "", model = "openai/gpt-oss-20b", baseUrl = GROQ_URL, proxyToken = "" } = {}) {
  const useProxy = !!proxyToken;
  const hasKey = () => useProxy || !!apiKey;

  async function callGroq(system, user, temperature = 0.7) {
    if (!hasKey()) throw new Error("AI is not configured");
    const headers = { "Content-Type": "application/json" };
    if (useProxy) headers["x-proxy-token"] = proxyToken;
    else headers.Authorization = `Bearer ${apiKey}`;
    const r = await fetch(baseUrl, {
      method: "POST",
      headers,
      body: JSON.stringify({
        model,
        temperature,
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
      }),
    });
    if (!r.ok) {
      const txt = await r.text().catch(() => "");
      throw new Error(`AI ${r.status}: ${txt.slice(0, 200)}`);
    }
    const data = await r.json();
    const content = data.choices?.[0]?.message?.content || "";
    if (!content) throw new Error("AI: empty response");
    return content;
  }

  async function generateTopicJson(dayNumber, seen) {
    if (!hasKey()) throw new Error("no key");
    const user = `Придумай СЛУЧАЙНУЮ, необычную и запоминающуюся тему для урока словацкого. НЕ повторяй уже пройденные темы: ${(seen || []).slice(-12).join(", ") || "нет"}.
Уровень A1, 15 простых слов/фраз.
Верни JSON:
{
 "topic": "тема на словацком (2-4 слова, с заглавной)",
 "topicRu": "тема по-русски",
 "example": "одно простое предложение на словацком по теме",
 "words": [ 15 объектов вида {"sk": "слово/фраза на словацком", "ru": "перевод на русский"} ]
}
Только JSON.`;
    return extractJson(await callGroq(JSON_SYSTEM, user));
  }

  async function generateQuizJson(topic) {
    if (!hasKey()) throw new Error("no key");
    const words = (topic?.words || []).map((w) => `${w.sk} = ${w.ru}`).join("; ");
    const user = `Тема: ${topic.sk} (${topic.ru}). Слова: ${words}.
Составь тест из 10 вопросов по этим словам (перевод со словацкого на русский или наоборот).
ВАЖНО: варианты ответа для каждого вопроса перемешивай в случайном порядке, не ставь правильный всегда первым.
Верни только JSON:
{"questions":[
  {"q":"Как переводится «chlieb»?","options":["хлеб","молоко","сыр","мясо"],"answer":0}
]}
answer — индекс правильного варианта в ПЕРЕМЕШАННОМ списке. Только JSON.`;
    const parsed = extractJson(await callGroq(JSON_SYSTEM, user));
    const qs = (parsed.questions || [])
      .slice(0, 10)
      .filter((q) => Array.isArray(q.options) && q.options.length >= 2 && q.options[q.answer] !== undefined);
    return qs.map((q) => {
      const shuffled = [...q.options];
      for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
      }
      return { ...q, options: shuffled, answer: shuffled.indexOf(q.options[q.answer]) };
    }).filter(isValidQuizQuestion);
  }

  async function chatReply(topic, msgs, opener) {
    if (!hasKey()) throw new Error("no key");
    const history = [{ role: "assistant", content: opener }, ...msgs]
      .filter(Boolean)
      .slice(-8)
      .map((m) => `${m.role === "user" ? "Ученик" : "Mačka"}: ${m.content}`)
      .join("\n");
    const user = `Тема урока: ${topic.sk} (${topic.ru}). Пример фразы: ${topic.example}.
Ты — кот Mačka, помогаешь учить словацкий. Продолжи короткий диалог ПО-СЛОВАЦКИ (максимум 2 предложения), как дружелюбный кот.
Если ученик написал на русском или допустил ошибку — после своего ответа добавь строку «[П]» с переводом на русский и правильным словацким вариантом. Если всё верно — просто продолжай диалог по-словацки.
История диалога:
${history || "(диалог ещё не начат — начни с приветствия и короткого вопроса по теме)"}

Твой следующий ответ:`;
    return (await callGroq("Ты Mačka — кот, помогающий учить словацкий язык. Отвечай коротко и с энтузиазмом.", user, 0.8)).trim();
  }

  return { hasKey, generateTopicJson, generateQuizJson, chatReply };
}
