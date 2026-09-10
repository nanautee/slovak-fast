import { useState } from "react";
import { useProfile, startQuiz, answerQuiz } from "../store.js";
import Mascot from "../components/Mascot.jsx";

export default function Quiz({ setRoute }) {
  const profile = useProfile();
  const [loading, setLoading] = useState(false);
  const [picked, setPicked] = useState(null);
  const quiz = profile.today.quiz;

  const begin = async () => {
    setLoading(true);
    await startQuiz();
    setLoading(false);
    setPicked(null);
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-3">
        <Mascot size={90} bounce />
        <div className="text-stone-400 text-sm animate-pulse">Mačka пишет вопросы…</div>
      </div>
    );
  }

  if (!quiz.questions?.length) {
    return (
      <div className="flex flex-col items-center justify-center text-center py-16 gap-4">
        <Mascot size={100} />
        <div className="text-xl font-extrabold">Мини-тест по теме «{profile.topic?.ru || "…"}»</div>
        <div className="text-stone-400 text-sm">5 вопросов. Сразу увидишь ответ!</div>
        <button
          onClick={begin}
          className="w-full max-w-xs bg-gradient-to-r from-orange-500 to-amber-500 text-white font-extrabold py-4 rounded-2xl shadow-lg shadow-orange-200/60 active:scale-[0.98] transition-transform"
        >
          Начать тест 🚀
        </button>
      </div>
    );
  }

  if (quiz.done) {
    const pct = Math.round((quiz.correct / quiz.total) * 100);
    return (
      <div className="flex flex-col items-center justify-center text-center py-16 gap-4">
        <div className="animate-pop">
          <Mascot size={110} bounce={pct >= 60} />
        </div>
        <div className="text-3xl font-extrabold">{quiz.correct}/{quiz.total}</div>
        <div className="text-stone-400 text-sm">
          {pct === 100
            ? "Perfektné! Mačka sa usmieva! (=^･ω･^=)"
            : pct >= 60
            ? "Dobré! Скоро будет идеально!"
            : "Možno trochu opakovať? (◕︵◕)"}
        </div>
        <button
          onClick={begin}
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

  const index = quiz.answered;
  const q = quiz.questions[index];
  const answered = picked !== null;

  const choose = (i) => {
    if (answered) return;
    setPicked(i);
    setTimeout(() => {
      answerQuiz(index, i);
      setPicked(null);
    }, 900);
  };

  return (
    <div className="flex flex-col min-h-[70vh]">
      <div className="flex items-center justify-between mb-4">
        <div className="flex gap-1 flex-1 mr-3">
          {quiz.questions.map((_, i) => (
            <div
              key={i}
              className={`flex-1 h-1.5 rounded-full ${
                i < quiz.answered ? "bg-orange-400" : i === quiz.answered ? "bg-orange-300" : "bg-orange-100"
              }`}
            />
          ))}
        </div>
        <span className="text-sm font-bold text-stone-400">{index + 1}/{quiz.total}</span>
      </div>

      <div className="bg-white rounded-3xl p-5 border border-orange-100">
        <div className="text-xs text-orange-400 uppercase tracking-wide mb-2">Вопрос {index + 1}</div>
        <div className="text-2xl font-extrabold mb-5">{q.q}</div>
        <div className="space-y-2.5">
          {q.options.map((op, i) => {
            const isAnswer = i === q.answer;
            const isPicked = i === picked;
            let cls = "bg-orange-50 border-orange-100 text-stone-700";
            if (answered) {
              if (isAnswer) cls = "bg-green-100 border-green-300 text-green-800";
              else if (isPicked && !isAnswer) cls = "bg-red-100 border-red-300 text-red-700";
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

      <div className="mt-4 text-center text-xs text-stone-400">
        Прогресс: {quiz.correct} правильно
      </div>
    </div>
  );
}