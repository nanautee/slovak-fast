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

const serverSim = { profiles: { anya: seed("Аня"), max: seed("Макс") }, pins: { anya: "p-anya", max: "p-max" } };

const meta = () => ({
  active: store["sf_user"] || null,
  profiles: Object.entries(serverSim.profiles).map(([id, p]) => ({ id, name: p.name })),
});
const bundle = () => ({ meta: meta(), profiles: serverSim.profiles });

let chatCount = 0;
globalThis.fetch = async (url, opts = {}) => {
  const method = opts.method || "GET";
  const body = opts.body ? JSON.parse(opts.body) : null;
  const path = String(url).replace(/^.*\/api/, "/api").split("?")[0];

  const json = (data, status = 200) =>
    Promise.resolve(new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json" } }));

  const del = path.match(/^\/api\/profile\/(.+)$/);
  if (del && method === "DELETE") {
    if (!serverSim.profiles[del[1]]) return json({ error: "Профиль не найден" }, 404);
    if (!serverSim.pins[del[1]] || serverSim.pins[del[1]] !== body?.pin) return json({ error: "Ниверный PIN" }, 403);
    delete serverSim.profiles[del[1]];
    delete serverSim.pins[del[1]];
    return json({ ok: true });
  }

  switch (path) {
    case "/api/health":
      return json({ ok: true });
    case "/api/state": {
      if (method === "PUT" && body?.id && serverSim.profiles[body.id]) {
        serverSim.profiles[body.id] = { ...serverSim.profiles[body.id], ...body };
      }
      return json(bundle());
    }
    case "/api/profile": {
      if (serverSim.profiles[body.id]) return json({ error: "Профиль уже существует" }, 409);
      serverSim.profiles[body.id] = seed(body.name);
      if (body.pin) serverSim.pins[body.id] = body.pin;
      return json({ ok: true });
    }
    case "/api/topic":
      return json({
        sk: "Zvieratá",
        ru: "Животные",
        example: "Mačka spí.",
        words: Array.from({ length: 10 }, (_, i) => ({ sk: `slovo${i}`, ru: `перевод${i}` })),
      });
    case "/api/quiz":
      return json({ questions: [] });
    case "/api/chat":
      chatCount++;
      return json({ reply: `reply-${chatCount}: ${body.msgs?.length || 0} сообщений в контексте` });
    default:
      return json({ error: "not found" }, 404);
  }
};

const s = await import("../src/store.js");
const { getUserId, setUserId, api } = await import("../src/lib/api.js");

let fails = 0;
const ok = (cond, msg) => {
  if (!cond) {
    fails++;
    console.error("FAIL:", msg);
  } else {
    console.log("PASS:", msg);
  }
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

setUserId("anya");
await s.init();
let db = s.getDb();
ok(db.boot === "ok", "boot=ok после init");
ok(db.meta.active === "anya", "активный профиль = Аня");
ok(!!db.anya, "профиль Ани загружен");

await sleep(0);
await s.ensureTopic();
db = s.getDb();
ok(db.anya.topic?.words?.length === 10, "тема сгенерирована через API");
ok(db.anya.topicDate, "topicDate проставлен");

db.anya.topic.words.forEach((_, i) => s.answerCard(i, true));
db = s.getDb();
ok(db.anya.today.cards.done, "карточки done (клиент+сервер)");
ok(db.anya.words.length === 10, "10 слов в словаре");
await sleep(5);
ok(serverSim.profiles.anya.today.cards.done === true, "прогресс Ани дошёл до сервера (PUT)");

await s.startQuiz();
db = s.getDb();
ok(db.anya.today.quiz.questions.length === 5, "5 вопросов (клиентский fallback)");
const qs = db.anya.today.quiz.questions;
qs.forEach((_, i) => s.answerQuiz(i, qs[i].answer));
db = s.getDb();
ok(db.anya.today.quiz.done && db.anya.today.quiz.correct === 5, "квиз 5/5");

const opener = await s.chatSend(null);
ok(!!opener, "чат: openер от сервера");
for (let i = 0; i < 3; i++) {
  await s.chatSend(`Сообщение ${i}`);
  await sleep(5);
}
db = s.getDb();
ok(db.anya.today.chat.done, "чат done после 3 реплик");

s.startListen();
db = s.getDb();
db.anya.today.listen.questions.forEach((_, i) => s.answerListen(i, db.anya.today.listen.questions[i].answer));
db = s.getDb();
ok(db.anya.today.listen.done && db.anya.today.listen.correct === 5, "слушание 5/5");

ok(s.todayDone(db.anya) === 4, "все 4 квеста закрыты");
s.completeToday();
db = s.getDb();
ok(db.anya.streak === 1, "стрик Ани 1 после закрытия");
await sleep(5);
ok(serverSim.profiles.anya.streak === 1, "стрик Ани синхронизирован на сервер");

await s.addProfile("Макс");
db = s.getDb();
ok(db.meta.active !== "anya", "после создания активный профиль сменился");
const maxId = db.meta.active;
ok(!!db[maxId] && db[maxId].name === "Макс", "профиль Макс создан и активен");
ok(getUserId() === maxId, "id сохранён в localStorage");
ok(!(db[maxId].words.length) && db[maxId].streak === 0 && !db[maxId].today.cards.done, "у Макса нет прогресса Ани (разделение)");

await s.selectProfile("anya");
db = s.getDb();
ok(db.meta.active === "anya", "переключение обратно на Аню");
ok(db.anya.streak === 1 && db.anya.words.length === 10, "прогресс Ани сохранён после переключений");

removeStored();
await s.init();
db = s.getDb();
ok(db.boot === "pick", "без сохранённого id → экран выбора профиля");

setUserId("anya");
await s.init();
ok(s.getDb().meta.active === "anya", "возврат к Ане через сохранённый id");

const victim = await s.addProfile("Жертва");
const pins = JSON.parse(store["sf_pins"] || "{}");
ok(!!pins[victim], "пин владельца сохранён в localStorage");
let rejected = false;
try {
  await api.deleteProfile(victim, "wrong-pin");
} catch (e) {
  rejected = true;
}
ok(rejected, "удаление с чужим PIN отклонено");
await s.deleteProfile(victim);
db = s.getDb();
ok(!serverSim.profiles[victim], "профиль удалён владельцем по PIN");
ok(db.meta.active === "anya" && !!db.anya, "после удаления активен оставшийся профиль");

function removeStored() {
  try {
    localStorage.removeItem("sf_user");
  } catch (e) {}
}

console.log(fails === 0 ? "\nALL PASS ✓" : `\n${fails} FAILURES`);
process.exit(fails === 0 ? 0 : 1);