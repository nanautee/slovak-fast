process.env.DATA_DIR = ".test-data";
import { test, before } from "node:test";
import assert from "node:assert/strict";
import { rmSync, existsSync } from "node:fs";
import { app } from "../src/app.js";

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
const tok = (t) => ({ "x-auth-token": t });

test("health: 0 устройств", async () => {
  const { status, json } = await call("GET", "/api/health");
  assert.equal(status, 200);
  assert.equal(json.ok, true);
  assert.equal(json.devices, 0);
});

test("bootstrap создаёт устройство с токеном", async () => {
  const { status, json } = await call("POST", "/api/bootstrap", { name: "Аня" });
  assert.equal(status, 200);
  assert.ok(json.token.length >= 30, "случайный токен");
  assert.equal(json.existing, false);
  assert.equal(json.profile.name, "Аня");
  bootstrapA = json;
});
let bootstrapA = null;

test("state без токена — 401", async () => {
  const r = await call("GET", "/api/state");
  assert.equal(r.status, 401);
  const put = await call("PUT", "/api/state", { dayNumber: 5 });
  assert.equal(put.status, 401);
  const wrong = await call("GET", "/api/state", undefined, tok("bad-token"));
  assert.equal(wrong.status, 401);
});

test("state по токену — только свой профиль", async () => {
  const other = await call("POST", "/api/bootstrap", { name: "Макс" });
  assert.equal(other.status, 200);

  const { status, json } = await call("GET", "/api/state", undefined, tok(bootstrapA.token));
  assert.equal(status, 200);
  assert.deepEqual(Object.keys(json.profiles), [bootstrapA.token], "виден только Анин профиль");
  assert.equal(json.profiles[bootstrapA.token].name, "Аня");
  assert.equal(json.meta.profiles.length, 2, "в списке имён оба устройства");
});

test("bootstrap с тем же токеном возвращает тот же профиль", async () => {
  const { status, json } = await call("POST", "/api/bootstrap", { name: "Что-то другое" }, tok(bootstrapA.token));
  assert.equal(status, 200);
  assert.equal(json.existing, true);
  assert.equal(json.token, bootstrapA.token);
  assert.equal(json.profile.name, "Аня", "имя не перезаписалось");
});

test("PUT state по токену сохраняет прогресс", async () => {
  const state = await call("GET", "/api/state", undefined, tok(bootstrapA.token));
  const prof = state.json.profiles[bootstrapA.token];
  prof.today.cards.done = true;
  prof.today.cards.correct = 10;
  prof.words = [{ sk: "mačka", ru: "кошка", box: 1, next: "2026-09-11", correct: 1 }];

  const saved = await call("PUT", "/api/state", { ...prof }, tok(bootstrapA.token));
  assert.equal(saved.status, 200);
  assert.equal(saved.json.profiles[bootstrapA.token].today.cards.done, true);
  assert.equal(saved.json.profiles[bootstrapA.token].words.length, 1);

  const g = await call("GET", "/api/state", undefined, tok(bootstrapA.token));
  assert.equal(g.json.profiles[bootstrapA.token].today.cards.done, true);
});

test("PUT чужим токеном запрещён", async () => {
  const r = await call("PUT", "/api/state", { dayNumber: 99 }, tok(bootstrapA.token + "x"));
  assert.equal(r.status, 401, "изменённый токен не подходит");
});

test("rename: имя меняется по токену", async () => {
  let r = await call("POST", "/api/rename", { name: "Аня" });
  assert.equal(r.status, 401, "без токена нельзя переименовать");

  r = await call("POST", "/api/rename", { name: "Анечка" }, tok(bootstrapA.token));
  assert.equal(r.status, 200);
  assert.equal(r.json.profile.name, "Анечка");

  r = await call("GET", "/api/state", undefined, tok(bootstrapA.token));
  assert.equal(r.json.profiles[bootstrapA.token].name, "Анечка");

  r = await call("POST", "/api/rename", { name: "" }, tok(bootstrapA.token));
  assert.equal(r.status, 400);
});

test("delete: только по своему токену", async () => {
  let r = await call("DELETE", "/api/profile", undefined, tok(bootstrapA.token + "nope"));
  assert.equal(r.status, 401);

  r = await call("DELETE", "/api/profile", undefined, tok(bootstrapA.token));
  assert.equal(r.status, 200);

  r = await call("GET", "/api/state", undefined, tok(bootstrapA.token));
  assert.equal(r.status, 401, "после удаления токен недействителен");

  const health = await call("GET", "/api/health");
  assert.equal(health.json.devices, 1, "осталось одно устройство (Макс)");
});

test("topic/quiz/chat работают без авторизации", async () => {
  const t = await call("POST", "/api/topic", { dayNumber: 1, seenTopics: [] });
  assert.equal(t.status, 200);
  assert.equal(t.json.words.length, 15);

  const q = await call("POST", "/api/quiz", { topic: t.json });
  assert.equal(q.status, 200);
  assert.equal(q.json.questions.length, 10);
  let firstAnswer = -1;
  for (const qu of q.json.questions) {
    assert.equal(Array.isArray(qu.options), true);
    assert.equal(qu.options.length, 4);
    const ans = qu.options[qu.answer];
    assert.ok(ans !== undefined, "индекс answer валиден");
    assert.ok(qu.options.includes(qu.options[qu.answer]), "вариант содержит правильный перевод");
    firstAnswer = firstAnswer === -1 ? qu.answer : firstAnswer;
  }
  assert.ok(q.json.questions.length >= 2, "минимум 2 вопроса для проверки позиций");
  assert.ok(
    q.json.questions.some((qu) => qu.answer !== 0),
    "правильный ответ не всегда первый"
  );

  const c = await call("POST", "/api/chat", {
    topic: { ru: "Животные", words: [{ sk: "mačka", ru: "кошка" }] },
    msgs: [], opener: "", dayNumber: 1,
  });
  assert.equal(c.status, 200);
  assert.ok(c.json.reply);
});