import { useEffect, useRef, useState } from "react";
import { useProfile, chatSend, chatReset } from "../store.js";
import Mascot from "../components/Mascot.jsx";

export default function Chat({ setRoute }) {
  const profile = useProfile();
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [started, setStarted] = useState(false);
  const endRef = useRef(null);
  const msgs = profile.today.chat.msgs || [];
  const lines = profile.today.chat.lines || 0;
  const done = profile.today.chat.done;

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

  if (done) {
    return (
      <div className="flex flex-col items-center justify-center text-center py-16 gap-4">
        <div className="animate-pop">
          <Mascot size={110} bounce />
        </div>
        <div className="text-2xl font-extrabold">Si skvelý kamarát, Mačka! (=^･ω･^=)</div>
        <div className="text-stone-400 text-sm">3 реплики сказаны. Диалог сегодня выполнен!</div>
        <button
          onClick={chatReset}
          className="text-sm text-stone-400 underline"
        >
          Ещё один маленький диалог
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

  const send = () => {
    const t = text.trim();
    if (!t || busy) return;
    setText("");
    setBusy(true);
    chatSend(t).finally(() => setBusy(false));
  };

  return (
    <div className="flex flex-col h-[72vh]">
      <div className="bg-white rounded-2xl p-3 mb-3 border border-orange-100 flex items-center gap-3">
        <Mascot size={40} />
        <div className="flex-1">
          <div className="font-bold text-sm">Mačka · {profile.topic?.sk}</div>
          <div className="text-xs text-stone-400 text-ellipsis overflow-hidden whitespace-nowrap">
            {profile.topic?.example || "…"}
          </div>
        </div>
        <span className="text-xs font-bold text-orange-500">{lines}/3</span>
      </div>

      <div className="flex-1 overflow-y-auto no-scrollbar space-y-2.5 pb-2">
        {msgs.map((m, i) => (
          <div
            key={i}
            className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-[15px] leading-snug break-words ${
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
        За 3 твоих сообщения диалог будет засчитан
      </div>
    </div>
  );
}