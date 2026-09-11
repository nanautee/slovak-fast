const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";

const KEY = process.env.GROQ_API_KEY || "";
const MODEL = process.env.GROQ_MODEL || "llama-3.3-70b-versatile";

export const hasKey = () => !!KEY;

async function callGroq(system, user, temperature = 0.7) {
  if (!KEY) throw new Error("GROQ_API_KEY not set");
  const r = await fetch(GROQ_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${KEY}` },
    body: JSON.stringify({
      model: MODEL,
      temperature,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
    }),
  });
  if (!r.ok) {
    const txt = await r.text().catch(() => "");
    throw new Error(`Groq ${r.status}: ${txt.slice(0, 200)}`);
  }
  const data = await r.json();
  const content = data.choices?.[0]?.message?.content || "";
  if (!content) throw new Error("Groq: empty response");
  return content;
}

function extractJson(text) {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const raw = (fenced ? fenced[1] : text).trim();
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  return JSON.parse(raw.slice(start, end + 1));
}

const JSON_SYSTEM =
  "Ты создаёшь контент для изучения словацкого языка (уровень A1, учащийся русскоязычный). Возвращай ТОЛЬКО валидный JSON без markdown и пояснений.";

export async function generateTopicJson(dayNumber, seen) {
  if (!KEY) throw new Error("no key");
  const user = `Придумай СЛУЧАЙНУЮ, необычную и запоминающуюся тему для урока словацкого. НЕ повторяй уже пройденные темы: ${(seen || []).slice(-12).join(", ") || "нет"}.
Уровень A1, 10 простых слов/фраз.
Верни JSON:
{
 "topic": "тема на словацком (2-4 слова, с заглавной)",
 "topicRu": "тема по-русски",
 "example": "одно простое предложение на словацком по теме",
 "words": [ 10 объектов вида {"sk": "слово/фраза на словацком", "ru": "перевод на русский"} ]
}
Только JSON.`;
  return extractJson(await callGroq(JSON_SYSTEM, user));
}

export async function generateQuizJson(topic) {
  if (!KEY) throw new Error("no key");
  const words = (topic?.words || []).map((w) => `${w.sk} = ${w.ru}`).join("; ");
  const user = `Тема: ${topic.sk} (${topic.ru}). Слова: ${words}.
Составь тест из 5 вопросов по этим словам (перевод со словацкого на русский или наоборот).
Верни только JSON:
{"questions":[
  {"q":"Как переводится «chlieb»?","options":["хлеб","молоко","сыр","мясо"],"answer":0}
]}
answer — индекс правильного варианта (0-3). Только JSON.`;
  const parsed = extractJson(await callGroq(JSON_SYSTEM, user));
  const qs = (parsed.questions || []).slice(0, 5);
  return qs.filter((q) => Array.isArray(q.options) && q.options.length >= 2 && q.options[q.answer] !== undefined);
}

export async function chatReply(topic, msgs, opener) {
  if (!KEY) throw new Error("no key");
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