import { useState } from "react";
import { start } from "../store.js";
import Mascot from "../components/Mascot.jsx";

export default function WelcomeScreen() {
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);

  const go = async () => {
    if (busy) return;
    setBusy(true);
    setErr(null);
    try {
      await start(name);
    } catch (e) {
      setErr(e.message);
      setBusy(false);
    }
  };

  return (
    <div className="min-h-full flex flex-col items-center justify-center px-6 py-10 gap-5">
      <Mascot size={96} bounce />
      <div className="text-center">
        <div className="text-2xl font-extrabold text-orange-600">SlovakFast</div>
        <div className="text-sm text-stone-400 mt-1">
          Прогресс сохранится на этом устройстве
        </div>
      </div>

      {err && <div className="text-sm text-red-500">{err}</div>}

      <div className="w-full max-w-[380px] space-y-3">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && go()}
          maxLength={20}
          placeholder="Как тебя зовут? (можно позже)"
          className="w-full px-4 py-3.5 rounded-2xl border border-orange-100 bg-white outline-none focus:border-orange-300 text-center"
        />
        <button
          onClick={go}
          disabled={busy}
          className="w-full bg-gradient-to-r from-orange-500 to-amber-500 text-white font-extrabold py-4 rounded-2xl text-lg shadow-lg shadow-orange-200/60 disabled:opacity-40 active:scale-[0.98] transition-transform"
        >
          {busy ? "Подожди…" : "Начать"}
        </button>
      </div>
    </div>
  );
}