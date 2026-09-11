process.env.DATA_DIR = ".test-data";
import { test, before } from "node:test";
import assert from "node:assert/strict";
import { rmSync, existsSync } from "node:fs";
import { app } from "../src/app.js";
import { setProfile, listUsers } from "../src/data.js";

before(() => {
  if (existsSync(".test-data")) rmSync(".test-data", { recursive: true, force: true });
});

async function call(method, path, body, headers = {}) {
  if (body !== undefined) headers["Content-Type"] = "application/json";
  const res = await app.request(path, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json = null;
  try { json = JSON.parse(text); } catch (e) {}
  return { status: res.status, json };
}
const authed = (id, token) => ({ "x-user-id": id, "x-auth-token": token });

test("health", async () => {
  const { status, json } = await call("GET", "/api/health");
  assert.equal(status, 200);
  assert.equal(json.ok, true);
});

test("users empty at start", async () => {
  const { status, json } = await call("GET", "/api/users");
  assert.equal(status, 200);
  assert.deepEqual(json.profiles, []);
});

test("register: валидация и создание", async () => {
  let r = await call("POST", "/api/auth/register", { name: "А", password: "1234" });
  assert.equal(r.status, 400);

  r = await call("POST", "/api/auth/register", { name: "Аня", password: "12" });
  assert.equal(r.status, 400);

  r = await call("POST", "/api/auth/register", { name: "Аня", password: "secret1" });
  assert.equal(r.status, 200);
  assert.ok(r.json.id && r.json.token);
  registerA = r.json;

  r = await call("POST", "/api/auth/register", { name: "аня", password: "secret2" });
  assert.equal(r.status, 409);
});
let registerA = null;

test("login: неверный пароль отклонён", async () => {
  let r = await call("POST", "/api/auth/login", { id: registerA.id, password: "wrong" });
  assert.equal(r.status, 403);

  r = await call("POST", "/api/auth/login", { id: "nonexistent", password: "x" });
  assert.equal(r.status, 404);

  r = await call("POST", "/api/auth/login", { id: registerA.id, password: "secret1" });
  assert.equal(r.status, 200);
  assert.ok(r.json.token);
  assert.equal(r.json.id, registerA.id);
});

test("state требует авторизации", async () => {
  const unauth = await call("GET", "/api/state");
  assert.equal(unauth.status, 401);

  const put = await call("PUT", "/api/state", { id: registerA.id, dayNumber: 5 });
  assert.equal(put.status, 401);

  const wrongToken = await call("GET", "/api/state", undefined, authed(registerA.id, "bad-token"));
  assert.equal(wrongToken.status, 401);
});

test("state отдаёт только свой профиль", async () => {
  await call("POST", "/api/auth/register", { name: "Макс", password: "secret2" });

  const { status, json } = await call("GET", "/api/state", undefined, authed(registerA.id, registerA.token));
  assert.equal(status, 200);
  assert.deepEqual(Object.keys(json.profiles), [registerA.id], "виден только Анин профиль");
  assert.equal(json.meta.profiles.length, 2, "в списке имён оба пользователя");
  assert.equal(json.profiles[registerA.id].dayNumber, 1);
});

test("PUT state по токену владельца", async () => {
  const state = await call("GET", "/api/state", undefined, authed(registerA.id, registerA.token));
  const prof = state.json.profiles[registerA.id];
  prof.today.cards.done = true;
  prof.today.cards.correct = 10;
  prof.words = [{ sk: "mačka", ru: "кошка", box: 1, next: "2026-09-11", correct: 1 }];

  const saved = await call("PUT", "/api/state", { id: registerA.id, ...prof }, authed(registerA.id, registerA.token));
  assert.equal(saved.status, 200);
  assert.equal(saved.json.profiles[registerA.id].today.cards.done, true);
  assert.equal(saved.json.profiles[registerA.id].words.length, 1);

  const g = await call("GET", "/api/state", undefined, authed(registerA.id, registerA.token));
  assert.equal(g.json.profiles[registerA.id].today.cards.done, true);
});

test("PUT state чужим токеном запрещён", async () => {
  const users = listUsers();
  const maxId = users.find((u) => u.name === "Макс").id;
  const maxLogin = await call("POST", "/api/auth/login", { id: maxId, password: "secret2" });
  const r = await call("PUT", "/api/state", { id: registerA.id, dayNumber: 99 }, authed(maxId, maxLogin.json.token));
  assert.equal(r.status, 403, "Макс не может писать в профиль Ани");
});

test("profile с legacy без пароля: первый вход ставит пароль", async () => {
  setProfile("legacy-id", { name: "Старый", today: { cards: { done: true } } });

  const r = await call("POST", "/api/auth/login", { id: "legacy-id", password: "mypassword" });
  assert.equal(r.status, 200);
  assert.equal(r.json.needsPassword, true);
  assert.ok(r.json.token);

  const wrongNow = await call("POST", "/api/auth/login", { id: "legacy-id", password: "otherpass" });
  assert.equal(wrongNow.status, 403, "после установки пароль обязателен");

  const set = await call("POST", "/api/auth/set-password", { password: "newpass" }, authed("legacy-id", r.json.token));
  assert.equal(set.status, 200);

  const relogin = await call("POST", "/api/auth/login", { id: "legacy-id", password: "newpass" });
  assert.equal(relogin.status, 200);
});

test("delete требует токен владельца", async () => {
  let r = await call("DELETE", "/api/profile/legacy-id");
  assert.equal(r.status, 401);

  const users = listUsers();
  const maxId = users.find((u) => u.name === "Макс").id;
  const maxLogin = await call("POST", "/api/auth/login", { id: maxId, password: "secret2" });
  r = await call("DELETE", "/api/profile/legacy-id", undefined, authed(maxId, maxLogin.json.token));
  assert.equal(r.status, 401, "чужой владелец не может удалить");

  r = await call("DELETE", "/api/profile/legacy-id", undefined, authed("legacy-id", maxLogin.json.token));
  assert.equal(r.status, 401, "неверный токен");

  const legLogin = await call("POST", "/api/auth/login", { id: "legacy-id", password: "newpass" });
  r = await call("DELETE", "/api/profile/legacy-id", undefined, authed("legacy-id", legLogin.json.token));
  assert.equal(r.status, 200);

  r = await call("DELETE", "/api/profile/legacy-id", undefined, authed("legacy-id", legLogin.json.token));
  assert.equal(r.status, 404);
});

test("topic/quiz/chat работают без авторизации", async () => {
  const t = await call("POST", "/api/topic", { dayNumber: 1, seenTopics: [] });
  assert.equal(t.status, 200);
  assert.equal(t.json.words.length, 10);

  const q = await call("POST", "/api/quiz", { topic: t.json });
  assert.equal(q.status, 200);
  assert.equal(q.json.questions.length, 5);
  for (const qu of q.json.questions) {
    assert.equal(qu.options.length, 4);
    assert.ok(qu.options[qu.answer] !== undefined);
  }

  const c = await call("POST", "/api/chat", {
    topic: { ru: "Животные", words: [{ sk: "mačka", ru: "кошка" }] },
    msgs: [], opener: "", dayNumber: 1,
  });
  assert.equal(c.status, 200);
  assert.ok(c.json.reply);
});