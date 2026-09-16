import { useState } from "react";
import { useProfile, answerCard, answerReview, exitReview } from "../store.js";
import { speak } from "../lib/tts.js";
import Mascot from "../components/Mascot.jsx";

export default function Cards({ setRoute }) {
  const profile = useProfile();
  const deck = profile.reviewDeck;
  const result = profile.reviewResult;
  const [showBack, setShowBack] = useState(null);

  if (result) {
    return (
      <div className="flex flex-col items-center justify-center text-center py-16 gap-4">
        <div className="animate-pop">
          <Mascot size={110} bounce />
        </div>
        <div className="text-2xl font-extrabold">
          {Math.round((result.correct / result.total) * 100) >= 80
            ? "Naučené! (=^･ω･^=)"
            : "Ešte si to zopakuj. (•_•)"}
        </div>
        <div className="text-stone-400 text-sm">
          Знаешь {result.correct} из {result.total} слов на повторе
        </div>
        <button
          onClick={() => { exitReview(); setRoute("dict"); }}
          className="w-full max-w-xs bg-gradient-to-r from-orange-500 to-amber-500 text-white font-extrabold py-4 rounded-2xl shadow-lg shadow-orange-200/60 active:scale-[0.98] transition-transform"
        >
          В словарь
        </button>
        <button
          onClick={() => { exitReview(); setRoute("today"); }}
          className="text-sm text-stone-400 underline"
        >
          На главную
        </button>
      </div>
    );
  }

  const topic = profile.topic;
  if (!deck && (!topic || !topic.words?.length)) {
    return (
      <div className="text-center text-stone-400 py-20">
        Тема ещё не готова. Подожди чуть-чуть, Mačka жарит. 🐱
      </div>
    );
  }

  const words = deck || topic.words;
  const graded = words.filter((w) => w.graded !== undefined).length;
  const allDone = graded === words.length;
  const current = words.findIndex((w) => w.graded === undefined);
  const card = allDone ? null : words[current];
  const progress = Math.round((graded / words.length) * 100);
  const isReview = !!deck;

  const rate = (ok) => {
    if (isReview) answerReview(current, ok);
    else answerCard(current, ok);
    setShowBack(null);
  };

  if (allDone) {
    if (isReview) {
      // последняя карточка закрывает колоду через reviewResult, экран выше
      return null;
    }
    return (
      <DoneScreen correct={profile.today.cards.correct} total={words.length} onDone={() => setRoute("today")} />
    );
  }

  return (
    <div className="flex flex-col">
      <div className="flex justify-between items-center mb-3">
        <div className="min-w-0">
          <div className="font-extrabold text-lg truncate">{isReview ? "Повторение" : topic.sk}</div>
          <div className="text-xs text-stone-400">
            {isReview ? `${words.length} слов на повторе` : topic.ru}
          </div>
        </div>
        <span className="text-sm font-bold text-orange-600 shrink-0">{graded}/{words.length}</span>
      </div>

      <div className="flex gap-1 mb-5">
        {words.map((w, i) => (
          <div
            key={i}
            className={`flex-1 h-1.5 rounded-full ${w.graded ? "bg-orange-400" : "bg-orange-100"}`}
          />
        ))}
      </div>

      <div className="flex justify-center pt-2 pb-6">
        <div
          className={`card-flip w-full max-w-sm cursor-pointer select-none ${showBack === null ? "" : "flipped"}`}
          onClick={() => setShowBack((s) => (s === null ? "back" : null))}
        >
          <div className="card-inner relative w-full h-64 md:h-72">
            <div className="card-face absolute inset-0 bg-white rounded-3xl border-2 border-orange-200 shadow-xl flex flex-col items-center justify-center gap-3 p-6">
              <Mascot size={44} />
              <div className="text-4xl font-extrabold text-center text-stone-800 break-words">{card.sk}</div>
              <div className="text-xs text-stone-400">нажми, чтобы увидеть перевод</div>
            </div>
            <div className="card-face card-back absolute inset-0 bg-orange-500 rounded-3xl shadow-xl flex flex-col items-center justify-center gap-3 p-6 text-white">
              <div className="text-sm text-orange-200">{card.sk}</div>
              <div className="text-4xl font-extrabold text-center break-words">{card.ru}</div>
              <div className="text-xs text-orange-100">знаешь это слово?</div>
            </div>
          </div>
        </div>
      </div>

      <button
        onClick={() => speak(card.sk)}
        className="mx-auto mt-4 flex items-center gap-2 bg-stone-100 text-stone-500 font-semibold text-sm rounded-full px-4 py-2 active:scale-95 transition-transform"
      >
        🔊 {card.sk}
      </button>

      <div className="flex gap-3 mt-3">
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
      <div className="text-center text-xs text-stone-400 mt-3 pb-2">
        {isReview ? "повторение из словаря" : `${progress}% сегодня`}
      </div>
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