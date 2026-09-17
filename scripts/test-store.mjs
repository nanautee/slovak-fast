const store = {};
globalThis.localStorage = {
  getItem: (k) => (k in store ? store[k] : null),
  setItem: (k, v) => (store[k] = String(v)),
  removeItem: (k) => delete store[k],
};

const seed = (name) => ({
  name,
  dayNumber: 1,
  streak: 0,
  lastDoneDate: null,
  topicDate: null,
  topic: null,
  today: { cards: {}, chat: { msgs: [], opener: "" }, quiz: {}, listen: {} },
  words: [],
  history: [],
  seenTopics: [],
});

/* ---- mimic of server/src/data.js (устройство = токен) ---- */
const S = { profiles: {}, pins: {} };
const tokHash = (s) => "h:" + s;

globalThis.fetch = async (url, opts = {}) => {
  const method = opts.method || "GET";
  const body = opts.body ? JSON.parse(opts.body) : null;
  const header = (h) => opts.headers?.[h] || "";
  const path = String(url).replace(/^.*\/api/, "/api").split("?")[0];
  const token = header("x-auth-token");
  const authed = () => !!token && !!S.profiles[token] && S.pins[token] === tokHash(token);

  const json = (data, status = 200) =>
    Promise.resolve(new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json" } }));
  const state401 = () =>
    Promise.resolve(new Response(JSON.stringify({ error: "Авторизуйся" }), { status: 401, headers: { "Content-Type": "application/json" } }));

  if (path === "/api/health") return json({ ok: true, devices: Object.keys(S.profiles).length });

  if (path === "/api/bootstrap") {
    if (authed()) return json({ ok: true, token, profile: S.profiles[token], existing: true });
    const t = "tok-" + Math.random().toString(36).slice(2);
    S.profiles[t] = seed((body?.name || "").trim() || "Игрок");
    S.pins[t] = tokHash(t);
    return json({ ok: true, token: t, profile: S.profiles[t], existing: false });
  }

  if (path === "/api/rename") {
    if (!authed()) return state401();
    if (!body?.name?.trim()) return json({ error: "Имя слишком короткое" }, 400);
    S.profiles[token] = { ...S.profiles[token], name: body.name.trim() };
    return json({ ok: true, profile: S.profiles[token] });
  }

  if (path === "/api/state") {
    if (!authed()) return state401();
    if (method === "PUT" && body) S.profiles[token] = { ...body, name: S.profiles[token].name };
    return json({ meta: { profiles: Object.entries(S.profiles).map(([id, p]) => ({ id, name: p.name })) }, profiles: { [token]: S.profiles[token] } });
  }

  if (path === "/api/profile" && method === "DELETE") {
    if (!authed()) return state401();
    delete S.profiles[token];
    delete S.pins[token];
    return json({ ok: true });
  }

  if (path === "/api/topic")
    return json({ sk: "Zvieratá", ru: "Животные", example: "Mačka spí.", words: Array.from({ length: 15 }, (_, i) => ({ sk: `slovo${i}`, ru: `перевод${i}` })) });
  if (path === "/api/quiz") return json({ questions: [] });
  if (path === "/api/chat") return json({ reply: `reply: ${body.msgs?.length || 0}` });
  return json({ error: "not found" }, 404);
};

const s = await import("../src/store.js");

let fails = 0;
const ok = (cond, msg) => { if (!cond) { fails++; console.error("FAIL:", msg); } else console.log("PASS:", msg); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/* --- без токена → welcome --- */
await s.init();
ok(s.getDb().boot === "welcome", "первый запуск без токена → экран «Начать»");

/* --- start: один токен на устройство --- */
await s.start("Аня");
let db = s.getDb();
const token = store["sf_token"];
ok(!!token, "токен автоматически сохранён в localStorage");
ok(db.boot === "ok" && !!db.meta.active, "boot=ok после старта");
ok(db[db.meta.active].name === "Аня", "профиль создан с именем Аня");

await s.ensureTopic();
db = s.getDb();
ok(db[db.meta.active].topic?.words?.length === 15, "тема сгенерирована с 15 словами");

/* --- карточки (+ не теряем active, «не знаю») --- */
const words = [...db[db.meta.active].topic.words];
words.forEach((_, i) => s.answerCard(i, i < 3 ? false : true));
db = s.getDb();
ok(db[db.meta.active].today.cards.done, "карточки done");
ok(store["sf_token"] === token, "токен не меняется при сохранении");
ok(db[db.meta.active].today.cards.correct === 12, "3 «не знаю»: 12 из 15 правильных");
ok(db[db.meta.active].words.length === 15, "15 слов в словаре");
await sleep(5);
ok(S.profiles[token].today.cards.done === true, "прогресс сохранён на «сервер» (PUT)");

/* --- остальные квесты --- */
await s.startQuiz();
db = s.getDb();
const qs = db[db.meta.active].today.quiz.questions;
ok(qs.length === 10, "тест из 10 вопросов");
ok(
  qs.every((qu) => {
    const qText = qu.q.replace(/[«»"]/g, "").toLowerCase().trim();
    const uniq = new Set(qu.options.map((o) => o.toLowerCase()));
    return uniq.size === qu.options.length && qu.options.every((o) => !qText.includes(o.toLowerCase()));
  }),
  "тест: нет дублей и ни один вариант не повторяет вопрос"
);
qs.forEach((_, i) => s.answerQuiz(i, qs[i].answer));
await s.chatSend(null);
for (let i = 0; i < 3; i++) await s.chatSend(`Сообщение ${i}`);
s.startListen();
db = s.getDb();
ok(db[db.meta.active].today.listen.total === 15, "слушание включает все 15 слов темы");
db[db.meta.active].today.listen.questions.forEach((_, i) => s.answerListen(i, db[db.meta.active].today.listen.questions[i].answer));
db = s.getDb();
ok(s.todayDone(db[db.meta.active]) === 4, "все 4 квеста закрыты");

/* --- чат продолжается после 3 сообщений, не сбрасывается --- */
const msgCountBefore = db[db.meta.active].today.chat.msgs.length;
await s.chatSend("Сообщение 4");
db = s.getDb();
const chat = db[db.meta.active].today.chat;
ok(chat.done === true, "задание остаётся засчитанным после 4-го сообщения");
ok(chat.lines === 4, "счётчик реплик вырос до 4");
ok(chat.msgs.length === msgCountBefore + 2, "история сохранена, ничего не сброшено");

/* --- повторение из словаря --- */
const revWords = db[db.meta.active].words.slice(0, 3);
s.startReview(revWords);
db = s.getDb();
ok(db[db.meta.active].reviewDeck?.length === 3, "запущена колода повтора на 3 слова");
db[db.meta.active].reviewDeck.forEach((_, i) => s.answerReview(i, i % 2 === 0));
db = s.getDb();
ok(db[db.meta.active].reviewDeck === null, "колода закрыта после последней карточки");
ok(db[db.meta.active].reviewResult?.correct === 2 && db[db.meta.active].reviewResult?.total === 3, "результат повтора 2/3");
s.exitReview();
db = s.getDb();
ok(db[db.meta.active].reviewResult === null, "экран результата закрыт по кнопке");

/* --- падежная форма не заводит новое слово (slovo1om → slovo1) --- */
s.startReview([{ sk: "slovo1om", ru: "перевод1" }]);
s.answerReview(0, true);
s.exitReview();
db = s.getDb();
ok(db[db.meta.active].words.length === 15, "другая форма слова не задублирована в словаре");
ok(db[db.meta.active].words.every((w) => w.sk !== "slovo1om"), "в словаре сохранена каноническая форма");

s.completeToday();
db = s.getDb();
ok(db[db.meta.active].streak === 1, "стрик 1");

/* --- перезаход с тем же токеном --- */
delete store["sf_user"];
await s.init();
db = s.getDb();
ok(db.boot === "ok" && db[db.meta.active].name === "Аня" && db[db.meta.active].streak === 1, "профиль восстановлен по токену");

/* --- rename --- */
await s.rename("Анечка");
db = s.getDb();
ok(db[db.meta.active].name === "Анечка", "имя изменено");

/* --- второе устройство = отдельный профиль --- */
store["sf_token"] = "";
await s.init();
ok(s.getDb().boot === "welcome", "другое устройство (без токена) → снова «Начать»");
await s.start("Макс");
db = s.getDb();
ok(db[db.meta.active].name === "Макс" && db[db.meta.active].words.length === 0, "у нового устройства свой чистый прогресс (разделение)");
ok(S.profiles[token].name === "Анечка" && S.profiles[token].streak === 1, "прогресс Ани не тронут вторым устройством");

/* --- актуальность токена: блокировка после удаления --- */
store["sf_token"] = token;
await s.init();
db = s.getDb();
ok(!!db[db.meta.active], "вернулись к Ане");
await s.deleteProfile();
ok(!store["sf_token"], "токен очищен после выхода");
ok(s.getDb().boot === "welcome", "после удаления → экран «Начать»");
ok(!S.profiles[token], "профиль удалён с сервера");

console.log(fails === 0 ? "\nALL PASS ✓" : `\n${fails} FAILURES`);
process.exit(fails === 0 ? 0 : 1);