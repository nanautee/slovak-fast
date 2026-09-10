import { useState } from "react";
import { login, register } from "../store.js";
import Mascot from "../components/Mascot.jsx";

export default function Auth() {
  const [mode, setMode] = useState("login");
  const [name, setName] = useState("");
  const [pin, setPin] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const submit = async () => {
    if (busy) return;
    if (!name.trim() || pin.length < 4) {
      setError("Имя + ПИН минимум 4 символа");
      return;
    }
    setBusy(true);
    setError("");
    try {
      if (mode === "login") await login(name, pin);
      else await register(name, pin);
    } catch (e) {
      setError(e.message || "Что-то пошло не так");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-full bg-orange-50 text-stone-800 flex flex-col items-center justify-center px-6 py-12">
      <Mascot size={110} bounce />
      <h1 className="mt-4 text-3xl font-extrabold text-orange-600">SlovakFast</h1>
      <p className="text-stone-400 text-sm mb-6 text-center">Дневные квесты по словацкому для двоих 🇸🇰</p>

      <div className="w-full max-w-sm bg-white rounded-3xl border border-orange-100 p-5 shadow-xl shadow-orange-100/50">
        <div className="flex gap-2 mb-4">
          <button
            onClick={() => {
              setMode("login");
              setError("");
            }}
            className={`flex-1 py-2.5 rounded-xl font-bold text-sm transition ${
              mode === "login" ? "bg-orange-500 text-white" : "bg-orange-50 text-stone-500"
            }`}
          >
            Войти
          </button>
          <button
            onClick={() => {
              setMode("register");
              setError("");
            }}
            className={`flex-1 py-2.5 rounded-xl font-bold text-sm transition ${
              mode === "register" ? "bg-orange-500 text-white" : "bg-orange-50 text-stone-500"
            }`}
          >
            Новый профиль
          </button>
        </div>

        <label className="block text-xs font-semibold text-stone-500 mb-1">Имя</label>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Аня или Макс"
          className="w-full bg-orange-50 border border-orange-200 rounded-2xl px-4 py-3 text-[15px] outline-none focus:border-orange-400 mb-3"
        />

        <label className="block text-xs font-semibold text-stone-500 mb-1">ПИН (4+ символов)</label>
        <input
          value={pin}
          onChange={(e) => setPin(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && submit()}
          type="password"
          inputMode="numeric"
          maxLength={12}
          placeholder="••••"
          className="w-full bg-orange-50 border border-orange-200 rounded-2xl px-4 py-3 text-[15px] outline-none focus:border-orange-400 mb-3"
        />

        {error && <div className="text-sm text-red-500 mb-3">⚠️ {error}</div>}

        <button
          onClick={submit}
          disabled={busy}
          className="w-full bg-gradient-to-r from-orange-500 to-amber-500 text-white font-extrabold py-3.5 rounded-2xl shadow-lg shadow-orange-200/60 active:scale-[0.98] transition-transform disabled:opacity-50"
        >
          {busy ? "Mačka проверяет…" : mode === "login" ? "Войти 🚀" : "Создать профиль 🐱"}
        </button>
      </div>

      <p className="text-[11px] text-stone-400 mt-6 text-center leading-relaxed">
        Прогресс хранится на сервере.<br />
        Общий профиль на двоих — или личный ПИН каждому.
      </p>
    </div>
  );
}