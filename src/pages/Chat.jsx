import { useEffect, useRef, useState } from "react";
import { useProfile, chatSend } from "../store.js";
import { speak } from "../lib/tts.js";
import Mascot from "../components/Mascot.jsx";

const GREETINGS = ["Ahoj! Ako sa máš?", "Dobrý deň! Poďme sa učiť.", "Čau! Čo dnes robíme?"];

function themeChips(topic) {
  const ws = (topic?.words || []).slice(0, 4);
  const pairs = [
    (w) => `Páči sa mi ${w.sk}.`,
    (w) => `Chcem ${w.sk}.`,
    (w) => `Vidím ${w.sk}.`,
    (w) => `Hovorím o ${w.sk}.`,
  ];
  const out = [GREETINGS[Math.floor(Math.random() * GREETINGS.length)]];
  for (let i = 0; i < 3 && i < ws.length; i++) out.push(pairs[i](ws[i]));
  return out;
}

function Bubble({ m }) {
  const isUser = m.role === "user";
  return (
    <div className={`group flex items-end gap-2 max-w-[90%] ${isUser ? "ml-auto flex-row-reverse" : ""}`}>
      <div
        className={`rounded-2xl px-3.5 py-2.5 text-[15px] leading-snug break-words whitespace-pre-wrap ${
          isUser
            ? "bg-orange-500 text-white rounded-br-md"
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
      {!isUser && (
        <button
          onClick={() => speak(m.content.split("[П]")[0].trim())}
          className="w-7 h-7 rounded-full bg-stone-100 text-stone-400 flex items-center justify-center text-xs shrink-0 opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity"
          title="Прослушать"
        >
          🔊
        </button>
      )}
    </div>
  );
}

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

  const useChip = (phrase) => {
    setBusy(true);
    setText("");
    chatSend(phrase).finally(() => setBusy(false));
  };

  const chips = themeChips(t);

  return (
    <div className="flex flex-col h-[74vh]">
      <div className="bg-white rounded-2xl p-3 mb-2 border border-orange-100 flex items-center gap-3 shrink-0">
        <Mascot size={38} />
        <div className="flex-1 min-w-0">
          <div className="font-bold text-sm">{t.sk}</div>
          <div className="text-xs text-stone-400 text-ellipsis overflow-hidden whitespace-nowrap">
            {t.example || "Poďme sa rozprávať po slovensky!"}
          </div>
        </div>
        <span
          className={`text-[11px] font-bold rounded-full px-2 py-0.5 shrink-0 ${
            done ? "bg-green-100 text-green-600" : "bg-orange-100 text-orange-500"
          }`}
        >
          {done ? "✓" : `${lines}/3`}
        </span>
      </div>

      {done && (
        <div className="bg-green-50 border border-green-200 text-green-700 text-[11px] font-semibold rounded-2xl px-3 py-2 mb-1 shrink-0">
          ✅ Диалог засчитан — продолжай говорить сколько хочешь!
        </div>
      )}

      <div className="bg-amber-50 border border-amber-200 rounded-2xl px-3 py-2 mb-2 shrink-0">
        <div className="text-[11px] font-bold text-amber-700">
          {done ? "Продолжай диалог 🗣" : "Напиши по-словацки приветствие, вопрос или предложение по теме — Mačka поправит."}
        </div>
        <div className="flex flex-wrap gap-1.5 mt-1.5">
          {chips.map((chip, i) => (
            <button
              key={i}
              onClick={() => useChip(chip)}
              disabled={busy}
              className="text-[11px] font-bold bg-white border border-amber-200 text-amber-700 rounded-full px-2.5 py-1 disabled:opacity-40 active:scale-95 transition-transform"
            >
              {chip}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto no-scrollbar space-y-2.5 pb-2">
        {msgs.map((m, i) => (
          <Bubble key={i} m={m} />
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
          placeholder="Пиши по-словацки…"
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
      <div className="text-center text-[10px] text-stone-300 mt-1.5 shrink-0">
        {done ? "Задание выполнено · можно продолжать" : "3 сообщения = диалог засчитан"}
      </div>
    </div>
  );
}