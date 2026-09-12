import { useEffect, useRef, useState } from "react";
import { useProfile, chatSend } from "../store.js";
import Mascot from "../components/Mascot.jsx";

const TIPS = [
  ["👋", "Ahoj! Ako sa máš?"],
  ["🗣", "Páči sa mi {word}."],
  ["❓", "Čo je to?"],
  ["🙏", "Ďakujem! A ty?"],
];

export default function Chat({ setRoute }) {
  const profile = useProfile();
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [started, setStarted] = useState(false);
  const endRef = useRef(null);
  const msgs = profile.today.chat.msgs || [];
  const lines = profile.today.chat.lines || 0;
  const done = profile.today.chat.done;
  const t = profile.topic || {};
  const firstWordSk = t.words?.[0]?.sk || "kávu";

  useEffect(() => {
    if (msgs.length === 0 && !started) {
      setStarted(true);
      setBusy(true);
      chatSend(null).finally(() => setBusy(false));
    }
  }, [msgs.length, started]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [msgs.length, busy]);

  const send = () => {
    const v = text.trim();
    if (!v || busy) return;
    setText("");
    setBusy(true);
    chatSend(v).finally(() => setBusy(false));
  };

  const useTip = (tip) => {
    setBusy(true);
    setText("");
    chatSend(tip).finally(() => setBusy(false));
  };

  return (
    <div className="flex flex-col h-[76vh]">
      <div className="bg-white rounded-2xl p-3 mb-2 border border-orange-100 flex items-center gap-3">
        <Mascot size={40} />
        <div className="flex-1 min-w-0">
          <div className="font-bold text-sm">Mačka · {t.sk}</div>
          <div className="text-xs text-stone-400 text-ellipsis overflow-hidden whitespace-nowrap">
            {t.example || "Poďme sa rozprávať po slovensky!"}
          </div>
        </div>
        <span
          className={`text-xs font-bold rounded-full px-2 py-1 ${
            done ? "bg-green-100 text-green-600" : "bg-orange-100 text-orange-500"
          }`}
        >
          {done ? "✓ засчитано" : `${lines}/3`}
        </span>
      </div>

      {done && (
        <div className="bg-green-50 border border-green-200 text-green-700 text-xs font-semibold rounded-2xl px-4 py-2.5 mb-2">
          ✅ Диалог засчитан! Можно говорить ещё сколько хочешь — продолжай!
        </div>
      )}

      <div className="bg-amber-50 border border-amber-200 rounded-2xl px-4 py-2.5 mb-2">
        <div className="text-xs font-bold text-amber-700">
          {done ? "Продолжай диалог 🗣" : "Что делать: поздоровайся → задай вопрос → ответь на вопрос Mačky. Пиши по-словацки — Mačka поправит, ошибки — это нормально!"}
        </div>
        <div className="flex flex-wrap gap-1.5 mt-2">
          {TIPS.map(([emoji, tip], i) => (
            <button
              key={i}
              onClick={() => useTip(tip.replace("{word}", firstWordSk))}
              disabled={busy}
              className="text-[11px] font-bold bg-white border border-amber-200 text-amber-700 rounded-full px-2.5 py-1 disabled:opacity-40 active:scale-95 transition-transform"
            >
              {emoji} {tip.replace("{word}", firstWordSk)}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto no-scrollbar space-y-2.5 pb-2">
        {msgs.map((m, i) => (
          <div
            key={i}
            className={`max-w-[88%] rounded-2xl px-3.5 py-2.5 text-[15px] leading-snug break-words ${
              m.role === "user"
                ? "ml-auto bg-orange-500 text-white rounded-br-md"
                : "bg-white border border-orange-100 rounded-bl-md"
            }`}
          >
            {m.content.split("[П]").map((part, pi) =>
              part.trim() ? (
                <div key={pi} className={pi === 1 ? "text-xs text-stone-400 mt-1 border-t border-orange-100 pt-1" : ""}>
                  {pi === 1 ? "💡 " : ""}
                  {part.trim()}
                </div>
              ) : null
            )}
          </div>
        ))}
        {busy && (
          <div className="bg-white border border-orange-100 rounded-2xl rounded-bl-md px-3.5 py-2.5 w-16 text-sm text-stone-400 animate-pulse">
            Mačka píše…
          </div>
        )}
        <div ref={endRef} />
      </div>

      <div className="flex gap-2 pt-2 items-end">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              send();
            }
          }}
          rows={1}
          placeholder="Напиши по-словацки… или по-русски, Mačka поможет"
          className="flex-1 bg-white border border-orange-200 rounded-2xl px-4 py-3 text-[15px] outline-none focus:border-orange-400 resize-none max-h-28"
        />
        <button
          onClick={send}
          disabled={busy || !text.trim()}
          className="w-12 h-12 shrink-0 rounded-2xl bg-gradient-to-r from-orange-500 to-amber-500 text-white text-xl font-bold shadow-lg shadow-orange-200/60 disabled:opacity-40 active:scale-95 transition-transform"
        >
          ➤
        </button>
      </div>
      <div className="text-center text-[10px] text-stone-300 mt-2">
        {done
          ? "Задание выполнено — можно продолжать говорить!"
          : "3 твоих сообщения = диалог засчитан"}
      </div>
    </div>
  );
}