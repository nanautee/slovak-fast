import { useState } from "react";
import { useProfile, answerCard } from "../store.js";
import Mascot from "../components/Mascot.jsx";

export default function Cards({ setRoute }) {
  const profile = useProfile();
  const topic = profile.topic;
  const [showBack, setShowBack] = useState(null);

  if (!topic || !topic.words?.length) {
    return (
      <div className="text-center text-stone-400 py-20">
        Тема ещё не готова. Подожди чуть-чуть, Mačka жарит. 🐱
      </div>
    );
  }

  const words = topic.words;
  const graded = words.filter((w) => w.graded).length;
  const allDone = graded === words.length;
  const current = words.findIndex((w) => !w.graded);
  const card = allDone ? null : words[current];
  const progress = Math.round((graded / words.length) * 100);

  if (allDone) {
    return (
      <DoneScreen correct={profile.today.cards.correct} total={words.length} onDone={() => setRoute("today")} />
    );
  }

  const rate = (ok) => {
    answerCard(current, ok);
    setShowBack(null);
  };

  return (
    <div className="flex flex-col min-h-[70vh]">
      <div className="flex justify-between items-center mb-3">
        <div>
          <div className="font-extrabold text-lg">{topic.sk}</div>
          <div className="text-xs text-stone-400">{topic.ru}</div>
        </div>
        <span className="text-sm font-bold text-orange-600">{graded}/{words.length}</span>
      </div>

      <div className="flex gap-1 mb-4">
        {words.map((w, i) => (
          <div
            key={i}
            className={`flex-1 h-1.5 rounded-full ${w.graded ? "bg-orange-400" : "bg-orange-100"}`}
          />
        ))}
      </div>

      <div className="flex-1 flex items-center justify-center">
        <div
          className={`card-flip w-full max-w-sm cursor-pointer select-none ${showBack === null ? "" : "flipped"}`}
          onClick={() => setShowBack((s) => (s === null ? "back" : null))}
        >
          <div className="card-inner relative w-full h-72">
            <div className="card-face absolute inset-0 bg-white rounded-3xl border-2 border-orange-200 shadow-xl flex flex-col items-center justify-center gap-3 p-6">
              <Mascot size={44} />
              <div className="text-4xl font-extrabold text-center text-stone-800">{card.sk}</div>
              <div className="text-xs text-stone-400">нажми, чтобы увидеть перевод</div>
            </div>
            <div className="card-face card-back absolute inset-0 bg-orange-500 rounded-3xl shadow-xl flex flex-col items-center justify-center gap-3 p-6 text-white">
              <div className="text-sm text-orange-200">{card.sk}</div>
              <div className="text-4xl font-extrabold text-center">{card.ru}</div>
              <div className="text-xs text-orange-100">знаешь это слово?</div>
            </div>
          </div>
        </div>
      </div>

      <div className="flex gap-3 mt-6">
        <button
          onClick={() => rate(false)}
          className="flex-1 bg-stone-100 text-stone-600 font-bold py-4 rounded-2xl active:scale-[0.97] transition-transform"
        >
          🤔 Не знаю
        </button>
        <button
          onClick={() => rate(true)}
          className="flex-1 bg-gradient-to-r from-orange-500 to-amber-500 text-white font-extrabold py-4 rounded-2xl shadow-lg shadow-orange-200/60 active:scale-[0.97] transition-transform"
        >
          ✅ Знаю!
        </button>
      </div>
      <div className="text-center text-xs text-stone-400 mt-3">{progress}% сегодня</div>
    </div>
  );
}

function DoneScreen({ correct, total, onDone }) {
  const pct = Math.round((correct / total) * 100);
  return (
    <div className="flex flex-col items-center justify-center text-center py-16 gap-4">
      <div className="animate-pop">
        <Mascot size={110} bounce />
      </div>
      <div className="text-2xl font-extrabold">
        {pct >= 80 ? "Karvička zvládnutá! (=^･ω･^=)" : "Odporúčam zopakovať. (•_•)"}
      </div>
      <div className="text-stone-400 text-sm">
        Знаешь {correct} из {total} слов
      </div>
      <button
        onClick={onDone}
        className="w-full max-w-xs bg-gradient-to-r from-orange-500 to-amber-500 text-white font-extrabold py-4 rounded-2xl shadow-lg shadow-orange-200/60 active:scale-[0.98] transition-transform"
      >
        На главную
      </button>
    </div>
  );
}