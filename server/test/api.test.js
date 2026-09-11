process.env.DATA_DIR = ".test-data";
import { test, before } from "node:test";
import assert from "node:assert/strict";
import { rmSync, existsSync } from "node:fs";
import { app } from "../src/app.js";

before(() => {
  if (existsSync(".test-data")) rmSync(".test-data", { recursive: true, force: true });
});

async function call(method, path, body) {
  const headers = {};
  if (body !== undefined) headers["Content-Type"] = "application/json";
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

test("state empty at start", async () => {
  const { status, json } = await call("GET", "/api/state");
  assert.equal(status, 200);
  assert.deepEqual(json.meta.profiles, []);
  assert.deepEqual(json.profiles, {});
});

test("createProfile", async () => {
  let r = await call("POST", "/api/profile", { id: "a", name: "Аня", pin: "p1" });
  assert.equal(r.status, 200);
  assert.equal(r.json.profile.name, "Аня");

  r = await call("POST", "/api/profile", { id: "b", name: "А", pin: "p" });
  assert.equal(r.status, 400);

  r = await call("POST", "/api/profile", { id: "c", name: "аня", pin: "p" });
  assert.equal(r.status, 409);
  assert.match(r.json.error, /Имя уже занято/);

  r = await call("POST", "/api/profile", { id: "a", name: "Макс", pin: "p" });
  assert.equal(r.status, 409);
});

test("state lists profiles", async () => {
  const { status, json } = await call("GET", "/api/state");
  assert.equal(status, 200);
  assert.deepEqual(
    json.meta.profiles.map((u) => u.name),
    ["Аня"]
  );
  assert.ok(json.profiles.a);
  assert.equal(json.profiles.a.dayNumber, 1);
});

test("topic fallback generation", async () => {
  const { status, json } = await call("POST", "/api/topic", { dayNumber: 1, seenTopics: [] });
  assert.equal(status, 200);
  assert.equal(json.words.length, 10);
  assert.ok(json.sk);
});

test("quiz local generation", async () => {
  const topicRes = await call("POST", "/api/topic", { dayNumber: 1, seenTopics: [] });
  const { status, json } = await call("POST", "/api/quiz", { topic: topicRes.json });
  assert.equal(status, 200);
  assert.equal(json.questions.length, 5);
  for (const q of json.questions) {
    assert.equal(q.options.length, 4);
    assert.ok(q.options[q.answer] !== undefined);
  }
});

test("chat fallback", async () => {
  const { status, json } = await call("POST", "/api/chat", {
    topic: { ru: "Животные", words: [{ sk: "mačka", ru: "кошка" }] },
    msgs: [],
    opener: "",
    dayNumber: 1,
  });
  assert.equal(status, 200);
  assert.ok(json.reply);
});

test("state save per profile", async () => {
  const r = await call("POST", "/api/profile", { id: "b", name: "Макс", pin: "p2" });
  assert.equal(r.status, 200);

  let state = await call("GET", "/api/state");
  const aProfile = state.json.profiles.a;
  aProfile.today.cards.done = true;
  aProfile.today.cards.correct = 10;
  aProfile.words = [{ sk: "mačka", ru: "кошка", box: 1, next: "2026-09-11", correct: 1 }];

  const saved = await call("PUT", "/api/state", { id: "a", ...aProfile });
  assert.equal(saved.status, 200);
  assert.equal(saved.json.profiles.a.today.cards.done, true);
  assert.equal(saved.json.profiles.a.words.length, 1);

  state = await call("GET", "/api/state");
  assert.equal(state.json.profiles.a.today.cards.done, true);
  assert.equal(state.json.profiles.a.words[0].sk, "mačka");
  assert.equal(state.json.profiles.b.dayNumber, 1, "профиль Макса не затронут");
});

test("PUT state without id is rejected", async () => {
  const { status } = await call("PUT", "/api/state", { dayNumber: 5 });
  assert.equal(status, 400);
});

test("deleteProfile requires owner PIN", async () => {
  let r = await call("DELETE", "/api/profile/b");
  assert.equal(r.status, 401);

  r = await call("DELETE", "/api/profile/b", { pin: "wrong" });
  assert.equal(r.status, 403);

  r = await call("DELETE", "/api/profile/b", { pin: "p2" });
  assert.equal(r.status, 200);

  const state = await call("GET", "/api/state");
  assert.ok(!state.json.profiles.b);
  assert.equal(state.json.meta.profiles.length, 1);

  r = await call("DELETE", "/api/profile/b", { pin: "p2" });
  assert.equal(r.status, 404);
});