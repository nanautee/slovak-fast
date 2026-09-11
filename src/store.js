import { useSyncExternalStore } from "react";
import { api, getUserId, setUserId, getPins, setPins, uid } from "./lib/api.js";

const INTERVALS = [1, 2, 4, 7, 15, 30, 60];

const pad = (n) => String(n).padStart(2, "0");
export const todayStr = () => {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};
export const yesterdayStr = () => {
  const d = new Date(Date.now() - 86400000);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};
const dayAhead = (n) => {
  const d = new Date(Date.now() + n * 86400000);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

export const emptyToday = () => ({
  cards: { done: false, correct: 0, total: 0 },
  chat: { done: false, lines: 0, msgs: [], opener: "" },
  quiz: { done: false, correct: 0, total: 0, questions: [], answers: [], answered: 0 },
  listen: { done: false, correct: 0, total: 0, questions: [], answered: 0 },
});

const defaultProfile = () => ({
  dayNumber: 1,
  streak: 0,
  lastDoneDate: null,
  topicDate: null,
  topic: null,
  today: emptyToday(),
  words: [],
  history: [],
  seenTopics: [],
});

const emptyDb = () => ({
  boot: "idle",
  meta: { profiles: [], active: null },
});

let db = emptyDb();

const listeners = new Set();
function notify() {
  listeners.forEach((l) => l());
}
function mutate(fn) {
  const active = db.meta.active;
  if (!active) {
    notify();
    return;
  }
  const next = fn(structuredClone(db[active]));
  db = { ...db, [active]: valid(next) };
  notify();
}
function hydrate(payload, active) {
  const meta = payload.meta || { profiles: [], active: null };
  db = { boot: "ok", meta: { ...meta, active: active || meta.active || null } };
  for (const [id, profile] of Object.entries(payload.profiles || {})) db[id] = valid(profile);
}

function valid(p) {
  return {
    ...defaultProfile(),
    ...p,
    today: { ...emptyToday(), ...(p.today || {}) },
    words: Array.isArray(p.words) ? p.words : [],
    history: Array.isArray(p.history) ? p.history : [],
    seenTopics: Array.isArray(p.seenTopics) ? p.seenTopics : [],
  };
}

export const getDb = () => db;
export const subscribeDb = (cb) => {
  listeners.add(cb);
  return () => listeners.delete(cb);
};
export const useDb = () => useSyncExternalStore(subscribeDb, getDb);
export const useProfile = () => {
  const d = useDb();
  return d[d.meta.active];
};

export function levelFor(dayNumber) {
  if (dayNumber >= 60) return "B1";
  if (dayNumber >= 30) return "A2";
  return "A1";
}

function rollover(p) {
  const t = todayStr();
  if (p.topicDate === t) return p;
  let streak = p.streak || 0;
  if (p.lastDoneDate && p.lastDoneDate !== t && p.lastDoneDate !== yesterdayStr()) streak = 0;
  return {
    ...p,
    dayNumber: (p.dayNumber || 1) + 1,
    streak,
    topicDate: t,
    topic: null,
    today: emptyToday(),
  };
}

export function todayDone(p) {
  const t = p.today || emptyToday();
  return [t.cards.done, t.chat.done, t.quiz.done, t.listen.done].filter(Boolean).length;
}

export function todayTotal() {
  return 4;
}

export function questList(p) {
  const t = p.today || emptyToday();
  const quizMeta = t.quiz.total ? `${t.quiz.correct}/${t.quiz.total}` : "0/5";
  const listenMeta = t.listen.total ? `${t.listen.correct}/${t.listen.total}` : "0/5";
  return [
    { id: "cards", emoji: "🃏", title: "Карточки", sk: "Kartičky", done: t.cards.done, detail: `${t.cards.correct}/${t.cards.total || (p.topic ? p.topic.words.length : 10)}` },
    { id: "chat", emoji: "💬", title: "Чат", sk: "Rozhovor", done: t.chat.done, detail: `3 реплики`, meta: `${t.chat.lines}/3` },
    { id: "quiz", emoji: "📝", title: "Тест", sk: "Test", done: t.quiz.done, detail: `5 вопросов`, meta: quizMeta },
    { id: "listen", emoji: "🎧", title: "Слушание", sk: "Počúvanie", done: t.listen.done, detail: `5 фраз`, meta: listenMeta },
  ];
}

/* ---------- sync ---------- */
const FALLBACK_TOPICS = [
  ["Kuchyňa", "Кухня"],
  ["Zvieratá", "Животные"],
  ["Doprava", "Транспорт"],
  ["V kaviarni", "В кафе"],
  ["Oblečenie", "Одежда"],
  ["Peniaze", "Деньги"],
  ["Dom", "Дом"],
  ["Počasie", "Погода"],
];

async function syncState() {
  const active = db.meta.active;
  if (!active) return;
  try {
    hydrate(await api.save(active, db[active]));
  } catch (e) {}
}

let booting = false;
export async function init() {
  if (booting) return;
  booting = true;
  try {
    const payload = await api.state();
    const stored = getUserId();
    hydrate(payload, stored);
    if (!db.meta.active || !db[db.meta.active]) {
      if (stored) {
        hydrate(await api.save(stored, defaultProfile()));
      } else {
        db = { ...db, boot: "pick" };
        notify();
      }
    }
  } catch (e) {
    db = { ...emptyDb(), boot: "offline" };
    notify();
  } finally {
    booting = false;
  }
}

export async function addProfile(name) {
  const id = uid();
  const pin = uid();
  await api.createProfile(id, name.trim(), pin);
  const pins = getPins();
  pins[id] = pin;
  setPins(pins);
  setUserId(id);
  hydrate(await api.state(), id);
  notify();
  return id;
}

export async function selectProfile(id) {
  setUserId(id);
  hydrate(await api.state(), id);
  notify();
}

export async function deleteProfile(id) {
  const pins = getPins();
  await api.deleteProfile(id, pins[id]);
  delete pins[id];
  setPins(pins);
  setUserId("");
  try {
    const payload = await api.state();
    const rest = payload.meta.profiles || [];
    if (rest.length) {
      setUserId(rest[0].id);
      hydrate(payload, rest[0].id);
    } else {
      db = { ...emptyDb(), boot: "pick" };
      notify();
    }
  } catch (e) {
    db = { ...emptyDb(), boot: "offline" };
    notify();
  }
}

export async function ensureTopic() {
  mutate((p) => rollover(p));
  const p = db[db.meta.active];
  if (!p) return;
  if (p.topic) return;
  let topic = null;
  try {
    topic = await api.topic(p.dayNumber || 1, p.seenTopics || []);
  } catch (e) {}
  if (!topic || !topic.words?.length) {
    const n = (p.dayNumber || 1) - 1;
    const [sk, ru] = FALLBACK_TOPICS[n % FALLBACK_TOPICS.length];
    topic = {
      sk,
      ru,
      example: "",
      words: [
        { sk: "mačka", ru: "кошка" },
        { sk: "pes", ru: "собака" },
        { sk: "dom", ru: "дом" },
        { sk: "voda", ru: "вода" },
        { sk: "chlieb", ru: "хлеб" },
        { sk: "kava", ru: "кофе" },
        { sk: "auto", ru: "машина" },
        { sk: "ulica", ru: "улица" },
        { sk: "strom", ru: "дерево" },
        { sk: "slnko", ru: "солнце" },
      ],
    };
  }
  mutate((pr) => {
    if (pr.topic) return pr;
    return {
      ...pr,
      topic,
      seenTopics: pr.seenTopics.includes(topic.sk) ? pr.seenTopics : [...pr.seenTopics, topic.sk],
    };
  });
  syncState();
}

/* ---------- Cards ---------- */
function gradeWord(list, w, known) {
  const exists = list.some((x) => x.sk === w.sk);
  if (!exists) {
    return [...list, { sk: w.sk, ru: w.ru, box: known ? 1 : 0, next: dayAhead(known ? INTERVALS[0] : 1), correct: known ? 1 : 0 }];
  }
  return list.map((x) => {
    if (x.sk !== w.sk) return x;
    if (!known) return { ...x, box: 0, next: dayAhead(1) };
    const box = Math.min(x.box + 1, INTERVALS.length - 1);
    return { ...x, box, next: dayAhead(INTERVALS[box]), correct: x.correct + 1 };
  });
}

export function answerCard(index, known) {
  mutate((p) => {
    const words = p.topic.words.map((w, i) => (i === index ? { ...w, graded: known } : w));
    const graded = words.filter((w) => w.graded).length;
    const correct = words.filter((w) => w.graded === true).length;
    const total = words.length;
    return {
      ...p,
      topic: { ...p.topic, words },
      words: gradeWord(p.words, p.topic.words[index], known),
      today: { ...p.today, cards: { done: graded === total, correct, total } },
    };
  });
  syncState();
}

/* ---------- Chat ---------- */
export async function chatSend(text) {
  let p = db[db.meta.active];
  if (!text && !p.today.chat.opener) {
    let reply = "";
    try {
      reply = (await api.chat(p.topic, [], "", p.dayNumber)).reply;
    } catch (e) {}
    const opener = reply || fallbackReply(p, 0);
    mutate((pr) => ({
      ...pr,
      today: { ...pr.today, chat: { ...pr.today.chat, msgs: opener ? [{ role: "assistant", content: opener }] : [], opener } },
    }));
    syncState();
    return opener;
  }

  const msgs = text ? [...p.today.chat.msgs, { role: "user", content: text }] : p.today.chat.msgs;
  if (text) mutate((pr) => ({ ...pr, today: { ...pr.today, chat: { ...pr.today.chat, msgs } } }));

  let reply = "";
  try {
    reply = (await api.chat(p.topic, msgs, p.today.chat.opener, p.dayNumber)).reply;
  } catch (e) {}
  if (!reply) reply = fallbackReply(p, msgs.length);

  const newMsgs = [...msgs, { role: "assistant", content: reply }];
  const lines = newMsgs.filter((m) => m.role === "user").length;
  mutate((pr) => ({ ...pr, today: { ...pr.today, chat: { ...pr.today.chat, msgs: newMsgs, lines, done: lines >= 3 } } }));
  syncState();
  return reply;
}

function fallbackReply(p, n) {
  const pool = [
    "Výborne! A čo ešte chceš povedať?",
    "Rozumiem! Dnes je téma " + (p.topic?.ru || "") + ".",
    "Super! Pokračuj, polož mi otázku po slovensky!",
    "Skvelé slovo! Skús ho použiť v odpovedi.",
  ];
  return pool[(p.dayNumber + n) % pool.length];
}

export function chatReset() {
  mutate((p) => ({ ...p, today: { ...p.today, chat: { done: false, lines: 0, msgs: [], opener: "" } } }));
  syncState();
}

/* ---------- Quiz ---------- */
export async function startQuiz() {
  let p = db[db.meta.active];
  let questions = [];
  try {
    questions = (await api.quiz(p.topic)).questions;
  } catch (e) {}
  if (!questions.length) questions = localQuiz(p.topic);
  if (!questions.length) return false;
  mutate((pr) => ({
    ...pr,
    today: { ...pr.today, quiz: { done: false, correct: 0, total: questions.length, questions, answers: [], answered: 0 } },
  }));
  syncState();
  return true;
}

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function localQuiz(topic) {
  if (!topic || !topic.words?.length) return [];
  const pool = shuffle(topic.words);
  const picked = pool.slice(0, Math.min(5, topic.words.length));
  return picked.map((w) => {
    const wrong = shuffle(topic.words.filter((x) => x.sk !== w.sk)).slice(0, 3).map((x) => x.ru);
    const options = shuffle([w.ru, ...wrong]);
    return { q: `Как переводится «${w.sk}»?`, options, answer: options.indexOf(w.ru) };
  });
}

export function answerQuiz(index, choice) {
  mutate((p) => {
    const qz = p.today.quiz;
    const q = qz.questions[index];
    const answers = [...(qz.answers || [])];
    answers[index] = choice === q.answer;
    const correct = answers.filter(Boolean).length;
    const answered = index + 1;
    return {
      ...p,
      today: { ...p.today, quiz: { ...qz, answers, correct, answered, done: answered >= qz.questions.length } },
    };
  });
  syncState();
}

/* ---------- Listening ---------- */
export function startListen() {
  mutate((p) => {
    const pool = shuffle(p.topic.words || []);
    const picked = pool.slice(0, Math.min(5, (p.topic.words || []).length));
    const questions = picked.map((w) => {
      const wrong = shuffle((p.topic.words || []).filter((x) => x.sk !== w.sk)).slice(0, 3).map((x) => x.ru);
      const options = shuffle([w.ru, ...wrong]);
      return { sk: w.sk, ru: w.ru, options, answer: options.indexOf(w.ru) };
    });
    return {
      ...p,
      today: { ...p.today, listen: { done: false, correct: 0, total: questions.length, questions, answered: 0 } },
    };
  });
  syncState();
}

export function answerListen(index, choice) {
  mutate((p) => {
    const li = p.today.listen;
    const q = li.questions[index];
    const isGood = choice === q.answer;
    const answered = index + 1;
    return {
      ...p,
      today: {
        ...p.today,
        listen: {
          ...li,
          correct: li.correct + (isGood ? 1 : 0),
          answered,
          done: answered >= li.questions.length,
        },
      },
    };
  });
  syncState();
}

/* ---------- Day ---------- */
export function completeToday() {
  mutate((p) => {
    const t = todayStr();
    let streak = p.streak || 0;
    if (p.lastDoneDate === yesterdayStr()) streak += 1;
    else if (p.lastDoneDate !== t) streak = 1;
    const lastEntry = (p.history || []).slice(-1)[0];
    const history = lastEntry && lastEntry.date === t ? p.history : [...(p.history || []).slice(-29), { date: t, theme: p.topic?.ru || "", done: true }];
    return { ...p, streak, lastDoneDate: t, history };
  });
  syncState();
}

/* ---------- Profile ---------- */
export async function resetProfile() {
  mutate(() => defaultProfile());
  await syncState();
}