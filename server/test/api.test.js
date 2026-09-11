process.env.DATA_DIR = ".test-data";
import { test, before } from "node:test";
import assert from "node:assert/strict";
import { rmSync, existsSync } from "node:fs";
import { app } from "../src/app.js";
import { SELF_ID } from "../src/data.js";

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

test("state auto-creates single profile", async () => {
  const { status, json } = await call("GET", "/api/state");
  assert.equal(status, 200);
  assert.equal(json.meta.active, SELF_ID);
  assert.equal(json.meta.profiles.length, 1);
  assert.ok(json.profiles[SELF_ID]);
  assert.equal(json.profiles[SELF_ID].dayNumber, 1);
  assert.ok(Array.isArray(json.profiles[SELF_ID].seenTopics));
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

test("state save/load roundtrip", async () => {
  const state = await call("GET", "/api/state");
  const profile = state.json.profiles[SELF_ID];
  profile.today.cards.done = true;
  profile.today.cards.correct = 10;
  profile.words = [{ sk: "mačka", ru: "кошка", box: 1, next: "2026-09-11", correct: 1 }];

  const saved = await call("PUT", "/api/state", profile);
  assert.equal(saved.status, 200);
  assert.equal(saved.json.profiles[SELF_ID].today.cards.done, true);
  assert.equal(saved.json.profiles[SELF_ID].words.length, 1);

  const reloaded = await call("GET", "/api/state");
  assert.equal(reloaded.json.profiles[SELF_ID].today.cards.done, true);
  assert.equal(reloaded.json.profiles[SELF_ID].words[0].sk, "mačka");
});