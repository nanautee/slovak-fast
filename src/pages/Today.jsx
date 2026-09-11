import { useState } from "react";
import {
  useProfile,
  questList,
  todayDone,
  todayTotal,
  completeToday,
  todayStr,
  levelFor,
} from "../store.js";
import Mascot from "../components/Mascot.jsx";
import ProgressBar from "../components/ProgressBar.jsx";

function catMood(done, total) {
  if (done === total)
    return "Výborne! День закрыт! Si super! (=^･ｪ･^=)";
  if (done === 0)
    return "Ahoj! Mačka готова к приключениям сегодня. Начнём? (｡◕‿◕｡)";
  return "Super pokrok! Ещё чуть-чуть, a zvládneš to! (=^･ω･^=)";
}

export default function Today({ setRoute }) {
  const profile = useProfile();
  const total = todayTotal();
  const done = todayDone(profile);
  const quests = questList(profile);

  const showCelebrate = done === total;

  const statusIcon = (d) => (d ? "✅" : "▶️");

  return (
    <div className="space-y-4">
      <section className="bg-gradient-to-br from-orange-400 to-amber-400 rounded-3xl p-5 text-white shadow-lg shadow-orange-200/50">
        <div className="flex items-center gap-4">
          <div className="bg-white/20 rounded-2xl p-2">
            <Mascot size={88} bounce={showCelebrate} />
          </div>
          <div className="flex-1">
            <div className="text-xs uppercase tracking-wider text-orange-100">
              День {profile.dayNumber} · {levelFor(profile.dayNumber)}
            </div>
            <div className="text-2xl font-extrabold leading-tight mt-0.5">
              {profile.topic ? profile.topic.sk : "…"}
            </div>
            <div className="text-orange-100 text-sm">
              {profile.topic ? profile.topic.ru : "Mačka думает…"}
            </div>
            {profile.topic?.example && (
              <div className="mt-2 text-[13px] bg-white/15 rounded-xl px-3 py-1.5 inline-block">
                💬 {profile.topic.example}
              </div>
            )}
          </div>
        </div>
        <div className="mt-4">
          <ProgressBar value={(done / total) * 100} className="bg-white/25" />
          <div className="flex justify-between mt-1.5 text-xs font-semibold text-orange-100">
            <span>{done}/{total} заданий</span>
            <span>{Math.round((done / total) * 100)}%</span>
          </div>
        </div>
      </section>

      <div className="bg-white rounded-2xl p-4 border border-orange-100 flex items-center gap-3">
        <div className="text-4xl">{showCelebrate ? "🎉" : "🐱"}</div>
        <div>
          <div className="font-bold text-sm">{catMood(done, total)}</div>
          <div className="text-xs text-stone-400">
            {showCelebrate
              ? `Завтра будет новая тема. Стрик: ${profile.streak + (profile.lastDoneDate === todayStr() ? 0 : 1)}.`
              : `Стрик: ${profile.streak} 🔥`}
          </div>
        </div>
      </div>

      {showCelebrate ? (
        <button
          onClick={() => completeToday()}
          className="w-full bg-gradient-to-r from-orange-500 to-amber-500 text-white font-extrabold py-4 rounded-2xl text-lg shadow-lg shadow-orange-200/60 active:scale-[0.98] transition-transform"
        >
          Закрыть день и получить стрик! 🔥
        </button>
      ) : (
        <button
          onClick={() => setRoute(quests.find((q) => !q.done)?.id || "cards")}
          className="w-full bg-gradient-to-r from-orange-500 to-amber-500 text-white font-extrabold py-4 rounded-2xl text-lg shadow-lg shadow-orange-200/60 active:scale-[0.98] transition-transform"
        >
          Продолжить тренировку →
        </button>
      )}

      <section className="space-y-2.5">
        <h2 className="font-extrabold text-stone-700 text-base px-1">Задания дня</h2>
        {quests.map((q) => (
          <button
            key={q.id}
            onClick={() => setRoute(q.id)}
            className={`w-full flex items-center gap-3 bg-white rounded-2xl p-3.5 border transition active:scale-[0.985] ${
              q.done ? "border-green-200 bg-green-50/60" : "border-orange-100"
            }`}
          >
            <div className="text-2xl">{q.emoji}</div>
            <div className="flex-1 text-left">
              <div className="font-bold text-sm">{q.title}</div>
              <div className="text-xs text-stone-400">
                {q.sk} · {q.detail}
              </div>
            </div>
            <div className="flex items-center gap-2">
              {q.id !== "cards" && <span className="text-xs text-stone-400">{q.meta}</span>}
              <span className="text-xl">{statusIcon(q.done)}</span>
            </div>
          </button>
        ))}
      </section>

      <p className="text-center text-xs text-stone-400 pt-1 pb-4">
        День {profile.dayNumber} · выучено слов: {profile.words.length}
      </p>
    </div>
  );
}