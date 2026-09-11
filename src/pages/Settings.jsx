import { useState } from "react";
import { useDb, useProfile, deleteProfile, resetProfile, addProfile, selectProfile } from "../store.js";
import Mascot from "../components/Mascot.jsx";

export default function Settings({ setRoute }) {
  const db = useDb();
  const profile = useProfile();
  const [confirmReset, setConfirmReset] = useState(false);
  const [newName, setNewName] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const existing = db.meta?.profiles || [];
  const active = db.meta?.active;

  const create = async () => {
    const trimmed = newName.trim();
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
    if (busy || id === active) return;
    setBusy(true);
    setErr(null);
    try {
      await selectProfile(id);
    } catch (e) {
      setErr(e.message);
      setBusy(false);
    }
  };

  const remove = async () => {
    if (busy) return;
    setBusy(true);
    setErr(null);
    try {
      await deleteProfile(active);
      setConfirmDelete(false);
    } catch (e) {
      setErr(e.message);
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4 pb-6">
      <section className="bg-white rounded-3xl p-5 border border-orange-100">
        <div className="flex items-center gap-3 mb-2">
          <Mascot size={48} />
          <div>
            <div className="font-extrabold text-lg">Привет, {profile.name || "Игрок"}! 👋</div>
            <div className="text-xs text-stone-400">Прогресс хранится на сервере</div>
          </div>
        </div>
        <div className="mt-3 pt-3 border-t border-orange-100 text-xs text-stone-400 space-y-1">
          <div>День {profile.dayNumber} · стрик 🔥 {profile.streak} · слов: {profile.words.length}</div>
          <div>Темы и прогресс синхронизируются между устройствами.</div>
        </div>
      </section>

      <section className="bg-white rounded-3xl p-5 border border-orange-100">
        <h3 className="font-bold text-sm text-stone-600 mb-3">Профили</h3>
        <div className="space-y-2">
          {existing.map((u) => (
            <button
              key={u.id}
              onClick={() => pick(u.id)}
              disabled={busy || u.id === active}
              className={`w-full flex items-center justify-between px-4 py-3 rounded-2xl border transition-colors disabled:opacity-60 ${
                u.id === active ? "bg-orange-50 border-orange-200" : "bg-stone-50 border-stone-100"
              }`}
            >
              <span className="font-bold text-stone-700">{u.name}</span>
              {u.id === active ? (
                <span className="text-[10px] font-bold text-orange-500 bg-orange-100 rounded-full px-2 py-0.5">
                  СЕЙЧАС
                </span>
              ) : (
                <span className="text-xs text-stone-400 font-semibold">Переключиться →</span>
              )}
            </button>
          ))}
        </div>
        <div className="mt-3 flex gap-2">
          <input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && create()}
            maxLength={20}
            placeholder="Новый профиль"
            className="flex-1 px-4 py-2.5 rounded-2xl border border-orange-100 bg-white outline-none focus:border-orange-300 text-sm"
          />
          <button
            onClick={create}
            disabled={busy || newName.trim().length < 2}
            className="px-4 py-2.5 rounded-2xl bg-orange-500 text-white font-bold text-sm disabled:opacity-40"
          >
            Добавить
          </button>
        </div>
        {err && <div className="mt-2 text-sm text-red-500">{err}</div>}
      </section>

      <section className="bg-white rounded-3xl p-5 border border-orange-100">
        <h3 className="font-bold text-sm text-stone-600 mb-3">Профиль</h3>
        <div className="space-y-2.5">
          {existing.length > 1 && (
            <button
              onClick={() => setConfirmDelete(true)}
              className="w-full bg-red-50 text-red-500 font-bold py-3 rounded-2xl border border-red-200 active:scale-[0.98] transition-transform"
            >
              Удалить профиль «{profile.name || "Игрок"}»
            </button>
          )}
          <button
            onClick={() => setConfirmReset(true)}
            className="w-full bg-red-50 text-red-500 font-bold py-3 rounded-2xl border border-red-200 active:scale-[0.98] transition-transform"
          >
            Сбросить прогресс ({profile.name || "Игрок"})
          </button>
        </div>

        {confirmDelete && (
          <div className="mt-3 p-4 bg-red-50 border border-red-200 rounded-2xl">
            <div className="text-sm font-semibold text-red-600 mb-3">
              Удалить профиль «{profile.name || "Игрок"}» навсегда?
            </div>
            <div className="flex gap-2">
              <button
                onClick={remove}
                disabled={busy}
                className="flex-1 bg-red-500 text-white font-bold py-2.5 rounded-xl disabled:opacity-50"
              >
                Удалить
              </button>
              <button
                onClick={() => setConfirmDelete(false)}
                className="flex-1 bg-stone-100 text-stone-600 font-bold py-2.5 rounded-xl"
              >
                Отмена
              </button>
            </div>
          </div>
        )}

        {confirmReset && (
          <div className="mt-3 p-4 bg-red-50 border border-red-200 rounded-2xl">
            <div className="text-sm font-semibold text-red-600 mb-3">
              Стереть прогресс у «{profile.name || "Игрок"}»?
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => {
                  resetProfile();
                  setConfirmReset(false);
                }}
                className="flex-1 bg-red-500 text-white font-bold py-2.5 rounded-xl"
              >
                Да, стереть
              </button>
              <button
                onClick={() => setConfirmReset(false)}
                className="flex-1 bg-stone-100 text-stone-600 font-bold py-2.5 rounded-xl"
              >
                Отмена
              </button>
            </div>
          </div>
        )}
      </section>

      <section className="bg-white rounded-3xl p-5 border border-orange-100 text-sm">
        <h3 className="font-bold text-stone-600 mb-2">Как установить на телефон</h3>
        <ul className="text-stone-400 text-xs space-y-1">
          <li>iPhone: Safari → Поделиться → «На экран «Домой»</li>
          <li>Android: Chrome → меню ⋮ → «Добавить на главный экран»</li>
        </ul>
        <div className="mt-3 pt-3 border-t border-orange-100 text-[10px] text-stone-300">
          SlovakFast v0.4 · бэкенд: Hono · Groq на сервере
        </div>
      </section>

      <button
        onClick={() => setRoute("today")}
        className="w-full text-stone-400 text-sm font-semibold py-2"
      >
        ← На главную
      </button>
    </div>
  );
}