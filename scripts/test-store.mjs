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

/* ---- mimic of server/src/data.js ---- */
const S = { profiles: {}, passwords: {}, tokens: {} };
const hash = (s) => "h:" + s;
const isAuthed = (id) =>
  !!id && !!store["sf_token"] && (S.tokens[id] || []).includes(hash(store["sf_token"]));

const usersList = () => Object.entries(S.profiles).map(([id, p]) => ({ id, name: p.name }));
const bundle = (id) => ({
  meta: { profiles: usersList() },
  profiles: id ? { [id]: S.profiles[id] } : {},
});
const state401 = () =>
  Promise.resolve(new Response(JSON.stringify({ error: "Авторизуйся" }), { status: 401, headers: { "Content-Type": "application/json" } }));

let chatCount = 0;
globalThis.fetch = async (url, opts = {}) => {
  const method = opts.method || "GET";
  const body = opts.body ? JSON.parse(opts.body) : null;
  const header = (h) => opts.headers?.[h] || "";
  const path = String(url).replace(/^.*\/api/, "/api").split("?")[0];

  const json = (data, status = 200) =>
    Promise.resolve(new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json" } }));

  if (path === "/api/health") return json({ ok: true });
  if (path === "/api/users") return json({ profiles: usersList() });

  if (path === "/api/auth/register") {
    if (Object.values(S.profiles).some((p) => p.name.trim().toLowerCase() === body.name.trim().toLowerCase()))
      return json({ error: "Имя уже занято" }, 409);
    const id = "id-" + Math.random().toString(36).slice(2);
    S.profiles[id] = seed(body.name.trim());
    S.passwords[id] = body.password;
    const token = "tok-" + Math.random().toString(36).slice(2);
    S.tokens[id] = [hash(token)];
    return json({ ok: true, id, name: body.name, token });
  }

  if (path === "/api/auth/login") {
    if (!S.profiles[body.id]) return json({ error: "Профиль не найден" }, 404);
    const had = S.passwords[body.id];
    if (had && had !== body.password) return json({ error: "Неверный пароль" }, 403);
    if (!had) S.passwords[body.id] = body.password;
    const token = "tok-" + Math.random().toString(36).slice(2);
    S.tokens[body.id] = [hash(token)];
    return json({ ok: true, id: body.id, name: S.profiles[body.id].name, token, needsPassword: !had });
  }

  const id = header("x-user-id");
  if (path === "/api/auth/set-password") {
    if (!isAuthed(id)) return state401();
    S.passwords[id] = body.password;
    return json({ ok: true });
  }

  const del = path.match(/^\/api\/profile\/(.+)$/);
  if (del && method === "DELETE") {
    if (!isAuthed(del[1])) return state401();
    delete S.profiles[del[1]];
    delete S.passwords[del[1]];
    delete S.tokens[del[1]];
    return json({ ok: true });
  }

  if (path === "/api/state") {
    if (!isAuthed(id)) return state401();
    if (method === "PUT" && body?.id === id) {
      S.profiles[id] = { ...S.profiles[id], ...body };
    }
    return json(bundle(id));
  }

  if (path === "/api/topic")
    return json({ sk: "Zvieratá", ru: "Животные", example: "Mačka spí.", words: Array.from({ length: 10 }, (_, i) => ({ sk: `slovo${i}`, ru: `перевод${i}` })) });
  if (path === "/api/quiz") return json({ questions: [] });
  if (path === "/api/chat") { chatCount++; return json({ reply: `reply-${chatCount}: ${body.msgs?.length || 0}` }); }
  return json({ error: "not found" }, 404);
};

const s = await import("../src/store.js");

let fails = 0;
const ok = (cond, msg) => { if (!cond) { fails++; console.error("FAIL:", msg); } else console.log("PASS:", msg); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/* --- без авторизации --- */
await s.init();
ok(s.getDb().boot === "auth", "без токена → экран входа (auth)");
ok(s.getDb().meta.profiles.length === 0, "список пуст, предлагает регистрацию");

/* --- регистрация --- */
let res = await s.register("Аня", "secret1");
ok(res.id && res.token, "регистрация вернула id и токен");
ok(store["sf_token"] === res.token, "токен сохранён в localStorage");
ok(store["sf_user"] === res.id, "id сохранён в localStorage");
let db = s.getDb();
ok(db.boot === "ok" && db.meta.active === res.id, "после регистрации boot=ok и Аня активна");
ok(db[res.id].name === "Аня", "профиль Ани загружен");

await s.ensureTopic();
db = s.getDb();
ok(db[res.id].topic?.words?.length === 10, "тема сгенерирована через API");

/* --- карточки (не знаю + знаю) + active не теряется --- */
const topicWords = [...db[res.id].topic.words];
topicWords.forEach((_, i) => s.answerCard(i, i < 3 ? false : true));
db = s.getDb();
ok(db[res.id].today.cards.done, "карточки done");
ok(db.meta.active === res.id, "active не теряется после syncState");
ok(db[res.id].today.cards.correct === 7, "3 «не знаю» + 7 «знаю» = 7 правильных");
ok(db[res.id].words.length === 10, "10 слов в словаре");
await sleep(5);
ok(S.profiles[res.id].today.cards.done === true, "прогресс Ани дошёл до сервера (PUT)");

/* --- прочие квесты --- */
await s.startQuiz();
db = s.getDb();
const qs = db[res.id].today.quiz.questions;
qs.forEach((_, i) => s.answerQuiz(i, qs[i].answer));
db = s.getDb();
ok(db[res.id].today.quiz.done && db[res.id].today.quiz.correct === 5, "квиз 5/5");

const opener = await s.chatSend(null);
for (let i = 0; i < 3; i++) await s.chatSend(`Сообщение ${i}`);
db = s.getDb();
ok(db[res.id].today.chat.done, "чат done");

s.startListen();
db = s.getDb();
db[res.id].today.listen.questions.forEach((_, i) => s.answerListen(i, db[res.id].today.listen.questions[i].answer));
db = s.getDb();
ok(db[res.id].today.listen.done, "слушание done");

ok(s.todayDone(db[res.id]) === 4, "все 4 квеста закрыты");
s.completeToday();
db = s.getDb();
ok(db[res.id].streak === 1, "стрик 1");

/* --- второй профиль + разделение + чужие пароли --- */
res = await s.register("Макс", "secret2");
db = s.getDb();
ok(db.meta.active === res.id && db[res.id].name === "Макс", "Макс зарегистрирован и активен");
ok(db[res.id].words.length === 0 && db[res.id].streak === 0, "у Макса нет прогресса Ани (разделение)");

/* логин Макса — неверный пароль */
delete store["sf_token"]; delete store["sf_user"];
store["sf_user"] = res.id;
await s.init();
db = s.getDb();
ok(db.boot === "auth", "после очистки токена — снова экран входа");
ok(db.meta.profiles.length === 2, "оба профиля видны в списке");

let denied = false;
try { await s.login(res.id, "wrongpass"); } catch (e) { denied = true; }
ok(denied, "неверный пароль отклонён (403)");
await s.login(res.id, "secret2");
db = s.getDb();
ok(db.boot === "ok" && db.meta.active === res.id, "вход по паролю открыл профиль Макса");

/* Аня осталась отдельным профилем без пароля Макса */
delete store["sf_token"]; delete store["sf_user"];
store["sf_user"] = "anyaid";
await s.init();
ok(s.getDb().boot === "auth", "нельзя попасть в профиль без токена даже зная id");

/* --- удаление владельцем по токену --- */
const v = await s.register("Жертва", "secret3");
db = s.getDb();
ok(!!db[v.id], "жертва создана");
await s.deleteProfile(v.id);
db = s.getDb();
ok(!S.profiles[v.id], "профиль удалён владельцем (токен)");
ok(db.boot === "auth", "после удаления активного профиля — экран входа");

console.log(fails === 0 ? "\nALL PASS ✓" : `\n${fails} FAILURES`);
process.exit(fails === 0 ? 0 : 1);