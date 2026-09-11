const serverSim = {
  profiles: { self: {} },
};

const profileSeed = () => ({
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

serverSim.profiles.self = profileSeed();

const bundle = () => ({
  meta: { active: "self", profiles: [{ id: "self", name: "Профиль" }] },
  profiles: serverSim.profiles,
});

let chatCount = 0;
globalThis.fetch = async (url, opts = {}) => {
  const method = opts.method || "GET";
  const body = opts.body ? JSON.parse(opts.body) : null;
  const path = String(url).replace(/^.*\/api/, "/api").split("?")[0];

  const json = (data, status = 200) =>
    Promise.resolve(new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json" } }));

  switch (path) {
    case "/api/health":
      return json({ ok: true });
    case "/api/state": {
      if (method === "PUT") serverSim.profiles.self = { ...serverSim.profiles.self, ...body };
      return json(bundle());
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

await s.init();
let db = s.getDb();
ok(db.boot === "ok", "boot=ok после init");
ok(db.meta.active === "self", "активный профиль = self");
ok(!!db.self, "профиль загружен");

await sleep(0);
await s.ensureTopic();
db = s.getDb();
ok(db.self.topic?.words?.length === 10, "тема сгенерирована через API");
ok(db.self.topicDate, "topicDate проставлен");

db.self.topic.words.forEach((_, i) => s.answerCard(i, true));
db = s.getDb();
ok(db.self.today.cards.done, "карточки done (клиент+сервер)");
ok(db.self.words.length === 10, "10 слов в словаре");
await sleep(5);
const saved = serverSim.profiles.self;
ok(saved.today.cards.done === true, "прогресс дошёл до сервера (PUT)");

await s.startQuiz();
db = s.getDb();
ok(db.self.today.quiz.questions.length === 5, "5 вопросов (клиентский fallback)");
const qs = db.self.today.quiz.questions;
qs.forEach((_, i) => s.answerQuiz(i, qs[i].answer));
db = s.getDb();
ok(db.self.today.quiz.done && db.self.today.quiz.correct === 5, "квиз 5/5");

const opener = await s.chatSend(null);
ok(!!opener, "чат: openер от сервера");
for (let i = 0; i < 3; i++) {
  await s.chatSend(`Сообщение ${i}`);
  await sleep(5);
}
db = s.getDb();
ok(db.self.today.chat.done, "чат done после 3 реплик");

s.startListen();
db = s.getDb();
db.self.today.listen.questions.forEach((_, i) => s.answerListen(i, db.self.today.listen.questions[i].answer));
db = s.getDb();
ok(db.self.today.listen.done && db.self.today.listen.correct === 5, "слушание 5/5");

ok(s.todayDone(db.self) === 4, "все 4 квеста закрыты");
s.completeToday();
db = s.getDb();
ok(db.self.streak === 1, "стрик 1 после закрытия");
await sleep(5);
ok(serverSim.profiles.self.streak === 1, "стрик синхронизирован на сервер");

console.log(fails === 0 ? "\nALL PASS ✓" : `\n${fails} FAILURES`);
process.exit(fails === 0 ? 0 : 1);