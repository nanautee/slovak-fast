import { useEffect, useState } from "react";
import { useProfile, startListen, answerListen } from "../store.js";
import { speak, hasSkVoice } from "../lib/tts.js";
import Mascot from "../components/Mascot.jsx";

export default function Listen({ setRoute }) {
  const profile = useProfile();
  const [speaking, setSpeaking] = useState(false);
  const [picked, setPicked] = useState(null);
  const [revealed, setRevealed] = useState(false);
  const listen = profile.today.listen;

  useEffect(() => {
    if (!listen.questions?.length) startListen();
  }, [listen.questions?.length]);

  if (!listen.questions?.length) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-3">
        <Mascot size={90} bounce />
        <div className="text-stone-400 text-sm animate-pulse">Mačka выбирает фразы…</div>
      </div>
    );
  }

  if (listen.done) {
    const pct = Math.round((listen.correct / listen.total) * 100);
    return (
      <div className="flex flex-col items-center justify-center text-center py-16 gap-4">
        <div className="animate-pop">
          <Mascot size={110} bounce={pct >= 60} />
        </div>
        <div className="text-3xl font-extrabold">{listen.correct}/{listen.total}</div>
        <div className="text-stone-400 text-sm">
          {pct === 100 ? "Dobré ucho! (=^･ω･^=)" : pct >= 60 ? "Už to znie rozumne!" : "Skús nastaviť hlasitosť! (◕︵◕)"}
        </div>
        <button
          onClick={() => startListen()}
          className="text-sm text-stone-400 underline"
        >
          Пройти ещё раз
        </button>
        <button
          onClick={() => setRoute("today")}
          className="w-full max-w-xs bg-gradient-to-r from-orange-500 to-amber-500 text-white font-extrabold py-4 rounded-2xl shadow-lg shadow-orange-200/60 active:scale-[0.98] transition-transform"
        >
          На главную
        </button>
      </div>
    );
  }

  const index = listen.answered;
  const q = listen.questions[index];
  const answered = picked !== null;

  const choose = (i) => {
    if (answered || speaking) return;
    setPicked(i);
    setRevealed(true);
    setTimeout(() => {
      answerListen(index, i);
      setPicked(null);
      setRevealed(false);
    }, 1000);
  };

  return (
    <div className="flex flex-col min-h-[70vh]">
      <div className="flex items-center justify-between mb-4">
        <div className="flex gap-1 flex-1 mr-3">
          {listen.questions.map((_, i) => (
            <div
              key={i}
              className={`flex-1 h-1.5 rounded-full ${
                i < listen.answered ? "bg-orange-400" : i === listen.answered ? "bg-orange-300" : "bg-orange-100"
              }`}
            />
          ))}
        </div>
        <span className="text-sm font-bold text-stone-400">{index + 1}/{listen.total}</span>
      </div>

      {!hasSkVoice() && (
        <div className="bg-amber-100 border border-amber-200 text-amber-700 text-xs rounded-xl px-3 py-2 mb-3">
          Нет словацкого голоса в браузере — Mačka показала фразу. Поставь (например) Google на Словацком в настройках Chrome.
        </div>
      )}

      <div className="flex-1 flex flex-col items-center justify-center gap-5 text-center">
        <button
          onClick={() => {
            if (speaking) return;
            setSpeaking(false);
            speak(q.sk, () => setSpeaking(false));
          }}
          disabled={speaking}
          className={`w-32 h-32 rounded-full bg-gradient-to-br from-orange-400 to-amber-400 text-white shadow-xl shadow-orange-200/60 flex flex-col items-center justify-center gap-1 active:scale-95 transition-transform ${
            speaking ? "animate-bounce" : ""
          }`}
        >
          <span className="text-4xl">🔊</span>
          <span className="text-xs font-bold">{speaking ? "Počkaj…" : "Слушать"}</span>
        </button>

        {revealed && (
          <div className="text-3xl font-extrabold text-orange-600">{q.sk}</div>
        )}

        <div className="text-stone-400 text-sm">Что это значит?</div>
      </div>

      <div className="space-y-2.5">
        {q.options.map((op, i) => {
          const isAnswer = i === q.answer;
          const isPicked = i === picked;
          let cls = "bg-white border-orange-100 text-stone-700";
          if (answered) {
            if (isAnswer) cls = "bg-green-100 border-green-300 text-green-800";
            else if (isPicked) cls = "bg-red-100 border-red-300 text-red-700";
            else cls = "bg-stone-50 border-stone-100 text-stone-400";
          }
          return (
            <button
              key={i}
              onClick={() => choose(i)}
              className={`w-full text-left border-2 rounded-2xl px-4 py-3.5 font-semibold transition-all active:scale-[0.985] ${cls}`}
            >
              {answered && isAnswer && "✅ "}
              {op}
            </button>
          );
        })}
      </div>
    </div>
  );
}