const mem = {};
globalThis.localStorage = {
  getItem: (k) => (k in mem ? mem[k] : null),
  setItem: (k, v) => (mem[k] = String(v)),
  removeItem: (k) => delete mem[k],
};

const serverSim = {
  users: [{ id: "anya", name: "Аня" }, { id: "max", name: "Макс" }],
  active: "anya",
  profiles: { anya: {}, max: {} },
};

const profileSeed = (name) => ({
  dayNumber: 1,
  streak: 0,
  lastDoneDate: null,
  topicDate: null,
  topic: null,
  today: { cards: {}, chat: { msgs: [], opener: "" }, quiz: {}, listen: {} },
  words: [],
  history: [],
  seenTopics: [],
  name,
});

serverSim.profiles.anya = profileSeed("Аня");
serverSim.profiles.max = profileSeed("Макс");

const bundle = (active) => ({
  meta: { active, profiles: serverSim.users.map((u) => ({ id: u.id, name: u.name })) },
  profiles: serverSim.profiles,
});

let chatCount = 0;
globalThis.fetch = async (url, opts = {}) => {
  const method = opts.method || "GET";
  const body = opts.body ? JSON.parse(opts.body) : null;
  const path = String(url).replace(/^.*\/api/, "/api").split("?")[0];
  const token = (opts.headers || {}).Authorization?.replace(/^Bearer\s+/, "") || "";
  const uid = token === "tok123" ? "anya" : null;

  const json = (data, status = 200) =>
    Promise.resolve(new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json" } }));

  switch (path) {
    case "/api/health":
      return json({ ok: true });
    case "/api/auth/register":
    case "/api/auth/login": {
      if (!body.pin || body.pin.length < 4) return json({ error: "ПИН минимум 4 символа" }, 400);
      if (path.endsWith("login") && body.name !== "Аня") return json({ error: "Неверное имя или ПИН" }, 401);
      return json({ token: "tok123", user: { id: uid || "anya", name: "Аня" } });
    }
    case "/api/state": {
      if (!uid) return json({ error: "Unauthorized" }, 401);
      if (method === "PUT") serverSim.profiles[uid] = { ...serverSim.profiles[uid], ...body };
      return json(bundle(uid));
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
      return json({
        reply: `reply-${chatCount}: ${body.msgs?.length || 0} сообщений в контексте`,
      });
    default:
      return json({ error: "not found" }, 404);
  }
};

const s = await import("../src/store.js");

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

await s.login("Аня", "1234");
let db = s.getDb();
ok(db.boot === "ok", "boot=ok после логина");
ok(db.meta.profiles.length === 2, "оба участника в мета");
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
const saved = serverSim.profiles.anya;
ok(saved.today.cards.done === true, "прогресс дошёл до сервера (PUT)");

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
ok(db.anya.streak === 1, "стрик 1 после закрытия");
await sleep(5);
ok(serverSim.profiles.anya.streak === 1, "стрик синхронизирован на сервер");

await s.logout();
db = s.getDb();
ok(db.boot === "noauth", "после logout — экран входа");

console.log(fails === 0 ? "\nALL PASS ✓" : `\n${fails} FAILURES`);
process.exit(fails === 0 ? 0 : 1);