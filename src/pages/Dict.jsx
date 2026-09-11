import { useState } from "react";
import { useProfile, todayStr } from "../store.js";

const BOX_LABEL = ["Новые", "1 день", "2 дн.", "4 дн.", "7 дн.", "15 дн.", "30 дн.", "60 дн."];

export default function Dict({ setRoute }) {
  const profile = useProfile();
  const [q, setQ] = useState("");
  const [showDue, setShowDue] = useState(false);
  const words = profile.words || [];
  const t = todayStr();
  const query = q.trim().toLowerCase();

  const filtered = words.filter((w) => {
    const matchSearch =
      !query ||
      (w.sk || "").toLowerCase().includes(query) ||
      (w.ru || "").toLowerCase().includes(query);
    const due = w.next && w.next <= t;
    return matchSearch && (!showDue || due);
  });

  const sorted = [...filtered].sort((a, b) => {
    if (b.box !== a.box) return b.box - a.box;
    return (a.sk || "").localeCompare(b.sk || "");
  });

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-3xl p-5 border border-orange-100">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-xs text-stone-400">Словарь {profile.name ? `· ${profile.name}` : ""}</div>
            <div className="text-xl font-extrabold text-orange-600">{words.length} слов</div>
          </div>
          <button
            onClick={() => setRoute("progress")}
            className="text-sm text-stone-400 font-semibold underline"
          >
            Прогресс
          </button>
        </div>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="🔍 Поиск по словацкому или переводу…"
          className="mt-4 w-full px-4 py-3 rounded-2xl border border-orange-100 bg-orange-50/50 outline-none focus:border-orange-300 text-sm"
        />
        <button
          onClick={() => setShowDue((v) => !v)}
          className={`mt-2 text-xs font-bold rounded-full px-3 py-1.5 border transition-colors ${
            showDue ? "bg-red-50 border-red-200 text-red-500" : "bg-stone-50 border-stone-100 text-stone-400"
          }`}
        >
          {showDue ? "Показать всё" : "Надо повторить"}
        </button>
      </div>

      {sorted.length === 0 ? (
        <div className="text-center text-stone-400 text-sm py-16">
          {words.length === 0
            ? "Слова появятся, когда пройдёшь карточки."
            : "Ничего не найдено. 🔍"}
        </div>
      ) : (
        <div className="space-y-2">
          {sorted.map((w, i) => {
            const due = w.next && w.next <= t;
            return (
              <div
                key={i}
                className="flex items-center gap-3 bg-white rounded-2xl px-4 py-3 border border-orange-100"
              >
                <div className="flex-1 min-w-0">
                  <div className="font-extrabold text-stone-800">{w.sk}</div>
                  <div className="text-sm text-stone-400 truncate">{w.ru}</div>
                </div>
                <div className="flex flex-col items-end gap-1 shrink-0">
                  <span
                    className={`text-[10px] font-bold rounded-full px-2 py-0.5 ${
                      due
                        ? "bg-red-50 text-red-500"
                        : w.box === 0
                        ? "bg-orange-50 text-orange-500"
                        : "bg-green-50 text-green-600"
                    }`}
                  >
                    {due ? "повторить" : BOX_LABEL[w.box] || ""}
                  </span>
                  {w.correct > 0 && (
                    <span className="text-[10px] text-stone-300">✓ {w.correct}</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <p className="text-center text-xs text-stone-400 pb-4">
        Словарь собирается из карточек и хранится на сервере
      </p>
    </div>
  );
}