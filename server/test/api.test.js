process.env.DATA_DIR = ".test-data";
import { test, before } from "node:test";
import assert from "node:assert/strict";
import { rmSync, existsSync } from "node:fs";
import { app } from "../src/app.js";

before(() => {
  if (existsSync(".test-data")) rmSync(".test-data", { recursive: true, force: true });
});

async function call(method, path, body, token) {
  const headers = {};
  if (body !== undefined) headers["Content-Type"] = "application/json";
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await app.request(path, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json = null;
  try {
    json = JSON.parse(text);
  } catch (e) {}
  return { status: res.status, json };
}

test("health", async () => {
  const { status, json } = await call("GET", "/api/health");
  assert.equal(status, 200);
  assert.equal(json.ok, true);
});

test("register -> login -> auth flow", async () => {
  const a = await call("POST", "/api/auth/register", { name: "Аня", pin: "1234" });
  assert.equal(a.status, 200);
  assert.ok(a.json.token);
  const registredId = a.json.user.id;

  const b = await call("POST", "/api/auth/register", { name: "Макс", pin: "4321" });
  assert.equal(b.status, 200);

  const dup = await call("POST", "/api/auth/register", { name: "аня", pin: "9999" });
  assert.equal(dup.status, 409);

  const badLogin = await call("POST", "/api/auth/login", { name: "Аня", pin: "0000" });
  assert.equal(badLogin.status, 401);

  const login = await call("POST", "/api/auth/login", { name: "Аня", pin: "1234" });
  assert.equal(login.status, 200);
  assert.ok(login.json.token);
  const token = login.json.token;

  const shortPin = await call("POST", "/api/auth/register", { name: "Кто-то", pin: "12" });
  assert.equal(shortPin.status, 400);

  const noAuth = await call("GET", "/api/state");
  assert.equal(noAuth.status, 401);

  const state = await call("GET", "/api/state", undefined, token);
  assert.equal(state.status, 200);
  assert.equal(state.json.meta.active, registredId);
  assert.equal(Object.keys(state.json.profiles).length, 2);

  const me = state.json.profiles[registredId];
  assert.equal(me.dayNumber, 1);
  assert.ok(Array.isArray(me.seenTopics));

  return { token, id: registredId };
});

test("topic fallback generation", async () => {
  const login = await call("POST", "/api/auth/login", { name: "Аня", pin: "1234" });
  const res = await call("POST", "/api/topic", { dayNumber: 1, seenTopics: [] }, login.json.token);
  assert.equal(res.status, 200);
  assert.equal(res.json.words.length, 10);
  assert.ok(res.json.sk);
});

test("quiz local generation", async () => {
  const login = await call("POST", "/api/auth/login", { name: "Аня", pin: "1234" });
  const topicRes = await call("POST", "/api/topic", { dayNumber: 1, seenTopics: [] }, login.json.token);
  const res = await call("POST", "/api/quiz", { topic: topicRes.json }, login.json.token);
  assert.equal(res.status, 200);
  assert.equal(res.json.questions.length, 5);
  for (const q of res.json.questions) {
    assert.equal(q.options.length, 4);
    assert.ok(q.options[q.answer] !== undefined);
  }
});

test("chat fallback", async () => {
  const login = await call("POST", "/api/auth/login", { name: "Аня", pin: "1234" });
  const res = await call(
    "POST",
    "/api/chat",
    { topic: { ru: "Животные", words: [{ sk: "mačka", ru: "кошка" }] }, msgs: [], opener: "", dayNumber: 1 },
    login.json.token
  );
  assert.equal(res.status, 200);
  assert.ok(res.json.reply);
});

test("state save/load roundtrip", async () => {
  const login = await call("POST", "/api/auth/login", { name: "Аня", pin: "1234" });
  const token = login.json.token;
  const state = await call("GET", "/api/state", undefined, token);
  const profile = state.json.profiles[login.json.user.id];
  profile.today.cards.done = true;
  profile.today.cards.correct = 10;
  profile.words = [{ sk: "mačka", ru: "кошка", box: 1, next: "2026-09-11", correct: 1 }];

  const saved = await call("PUT", "/api/state", profile, token);
  assert.equal(saved.status, 200);
  assert.equal(saved.json.profiles[login.json.user.id].today.cards.done, true);
  assert.equal(saved.json.profiles[login.json.user.id].words.length, 1);

  const reloaded = await call("GET", "/api/state", undefined, token);
  assert.equal(reloaded.json.profiles[login.json.user.id].today.cards.done, true);
  assert.equal(reloaded.json.profiles[login.json.user.id].words[0].sk, "mačka");
});

test("other user sees friend progress", async () => {
  const maxLogin = await call("POST", "/api/auth/login", { name: "Макс", pin: "4321" });
  const res = await call("GET", "/api/state", undefined, maxLogin.json.token);
  const otherName = res.json.meta.profiles.find((p) => p.id !== res.json.meta.active).name;
  assert.equal(otherName, "Аня");
  const otherProfile = res.json.profiles[res.json.meta.profiles.find((p) => p.id !== res.json.meta.active).id];
  assert.equal(otherProfile.today.cards.done, true);
});