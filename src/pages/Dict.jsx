import { useState } from "react";
import { useProfile, todayStr, startReview } from "../store.js";

const BOX_LABEL = ["Новые", "1 день", "2 дн.", "4 дн.", "7 дн.", "15 дн.", "30 дн.", "60 дн."];

const MODES = [
  { id: "all", label: "Все 🗂", check: () => true },
  { id: "due", label: "Повторить 🔁", check: (w, t) => w.next && w.next <= t },
  { id: "unknown", label: "Не знаю 😕", check: (w) => w.mark === "unknown" },
  { id: "new", label: "Новые ✨", check: (w) => !w.correct && w.mark !== "unknown" && (w.box === 0 || w.box === undefined) },
];

export default function Dict({ setRoute }) {
  const profile = useProfile();
  const [q, setQ] = useState("");
  const [mode, setMode] = useState("all");
  const words = profile.words || [];
  const t = todayStr();
  const query = q.trim().toLowerCase();

  const filtered = words.filter((w) => {
    const matchSearch =
      !query ||
      (w.sk || "").toLowerCase().includes(query) ||
      (w.ru || "").toLowerCase().includes(query);
    const m = MODES.find((x) => x.id === mode);
    return matchSearch && m.check(w, t);
  });

  const sorted = [...filtered].sort((a, b) => {
    const aidx = ["unknown", "new", "due"].indexOf(a.mark);
    const bidx = ["unknown", "new", "due"].indexOf(b.mark);
    if (aidx !== bidx) return aidx - bidx;
    if (b.box !== a.box) return b.box - a.box;
    return (a.sk || "").localeCompare(b.sk || "");
  });

  const counts = {};
  for (const m of MODES) counts[m.id] = words.filter((w) => m.check(w, t)).length;

  const learn = (list) => {
    if (!list.length) return;
    startReview(list);
    setRoute("cards");
  };

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

        <div className="mt-3 flex flex-wrap gap-2">
          {MODES.map((m) => (
            <button
              key={m.id}
              onClick={() => setMode(m.id)}
              className={`text-xs font-bold rounded-full px-3 py-1.5 border transition-colors ${
                mode === m.id
                  ? m.id === "due"
                    ? "bg-red-500 border-red-500 text-white"
                    : m.id === "unknown"
                    ? "bg-orange-500 border-orange-500 text-white"
                    : "bg-stone-800 border-stone-800 text-white"
                  : "bg-stone-50 border-stone-100 text-stone-400"
              }`}
            >
              {m.label} {counts[m.id] > 0 && `· ${counts[m.id]}`}
            </button>
          ))}
        </div>

        {mode !== "all" && (
          <button
            onClick={() => learn(sorted)}
            disabled={!sorted.length}
            className="mt-3 w-full bg-gradient-to-r from-orange-500 to-amber-500 text-white font-extrabold py-3.5 rounded-2xl shadow-lg shadow-orange-200/60 disabled:opacity-40 active:scale-[0.98] transition-transform"
          >
            🃏 Учить {sorted.length > 0 ? `(${sorted.length})` : ""}
          </button>
        )}
      </div>

      {sorted.length === 0 ? (
        <div className="text-center text-stone-400 text-sm py-16">
          {words.length === 0
            ? "Слова появятся, когда пройдёшь карточки."
            : mode === "all"
            ? "Ничего не найдено. 🔍"
            : "В этой категории пока пусто. 🐱"}
        </div>
      ) : (
        <div className="space-y-2">
          {sorted.map((w, i) => {
            const due = w.next && w.next <= t;
            const isUnknown = w.mark === "unknown";
            const isNew = !w.correct && !isUnknown && (w.box === 0 || w.box === undefined);
            return (
              <div
                key={i}
                className="flex items-center gap-3 bg-white rounded-2xl px-4 py-3 border border-orange-100"
              >
                <div className="flex-1 min-w-0">
                  <div className="font-extrabold text-stone-800">{w.sk}</div>
                  <div className="text-sm text-stone-400 truncate">{w.ru}</div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <div className="flex flex-col items-end gap-1">
                    <span
                      className={`text-[10px] font-bold rounded-full px-2 py-0.5 ${
                        due
                          ? "bg-red-50 text-red-500"
                          : isUnknown
                          ? "bg-orange-50 text-orange-500"
                          : isNew
                          ? "bg-amber-50 text-amber-600"
                          : "bg-green-50 text-green-600"
                      }`}
                    >
                      {due ? "повторить" : isUnknown ? "не знаю" : isNew ? "новое" : BOX_LABEL[w.box] || ""}
                    </span>
                    {w.correct > 0 && (
                      <span className="text-[10px] text-stone-300">✓ {w.correct}</span>
                    )}
                  </div>
                  <button
                    onClick={() => learn([w])}
                    title="Учить слово"
                    className="w-9 h-9 rounded-full bg-orange-100 text-lg flex items-center justify-center active:scale-90 transition-transform"
                  >
                    🎴
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <p className="text-center text-xs text-stone-400 pb-4">
        Нажми 🎴, чтобы выучить слово · категории можно учить разом
      </p>
    </div>
  );
}