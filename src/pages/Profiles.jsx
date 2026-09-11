import { useState } from "react";
import { useDb, addProfile, selectProfile } from "../store.js";
import Mascot from "../components/Mascot.jsx";

export default function Profiles() {
  const db = useDb();
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);
  const existing = db.meta?.profiles || [];

  const create = async () => {
    const trimmed = name.trim();
    if (trimmed.length < 2 || busy) return;
    setBusy(true);
    setErr(null);
    try {
      await addProfile(trimmed);
    } catch (e) {
      setErr(e.message);
      setBusy(false);
    }
  };

  const pick = async (id) => {
    if (busy) return;
    setBusy(true);
    try {
      await selectProfile(id);
    } catch (e) {
      setErr(e.message);
      setBusy(false);
    }
  };

  return (
    <div className="min-h-full px-4 pt-10 pb-12 flex flex-col items-center">
      <Mascot size={96} bounce />
      <h1 className="mt-4 text-2xl font-extrabold text-orange-600">SlovakFast</h1>
      <p className="text-stone-400 text-sm mt-1">У каждого свой прогресс</p>

      {existing.length > 0 && (
        <div className="w-full max-w-[380px] mt-6">
          <div className="text-xs font-bold text-stone-400 uppercase tracking-wide mb-2">Кто ты?</div>
          <div className="space-y-2">
            {existing.map((u) => (
              <button
                key={u.id}
                onClick={() => pick(u.id)}
                disabled={busy}
                className="w-full px-5 py-4 rounded-2xl bg-white border border-orange-100 shadow-sm flex items-center justify-between hover:border-orange-300 transition-colors disabled:opacity-50"
              >
                <span className="font-bold text-stone-700">{u.name}</span>
                <span className="text-orange-400 text-xs font-bold">Продолжить →</span>
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="w-full max-w-[380px] mt-6">
        {existing.length > 0 && (
          <div className="text-xs font-bold text-stone-400 uppercase tracking-wide mb-2">Новый</div>
        )}
        <div className="flex gap-2">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && create()}
            maxLength={20}
            placeholder="Имя"
            className="flex-1 px-4 py-3 rounded-2xl border border-orange-100 bg-white outline-none focus:border-orange-300"
          />
          <button
            onClick={create}
            disabled={busy || name.trim().length < 2}
            className="px-5 py-3 rounded-2xl bg-orange-500 text-white font-bold disabled:opacity-40"
          >
            Создать
          </button>
        </div>
        {err && <div className="mt-2 text-sm text-red-500">{err}</div>}
      </div>
    </div>
  );
}