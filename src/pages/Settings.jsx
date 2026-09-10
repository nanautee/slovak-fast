import { useState } from "react";
import { useProfile, useMeta, logout, resetProfile } from "../store.js";
import Mascot from "../components/Mascot.jsx";

export default function Settings({ setRoute }) {
  const profile = useProfile();
  const meta = useMeta();
  const [confirmReset, setConfirmReset] = useState(false);
  const [confirmLogout, setConfirmLogout] = useState(false);
  const myName = meta.profiles.find((p) => p.id === meta.active)?.name || "";

  return (
    <div className="space-y-4 pb-6">
      <section className="bg-white rounded-3xl p-5 border border-orange-100">
        <div className="flex items-center gap-3 mb-2">
          <Mascot size={48} />
          <div>
            <div className="font-extrabold text-lg">Привет, {myName}! 👋</div>
            <div className="text-xs text-stone-400">Профиль · {meta.profiles.length} участника</div>
          </div>
        </div>
        <div className="mt-3 pt-3 border-t border-orange-100 text-xs text-stone-400 space-y-1">
          <div>День {profile.dayNumber} · стрик 🔥 {profile.streak} · слов: {profile.words.length}</div>
          <div>Прогресс и темы синхронизируются через сервер у обоих.</div>
        </div>
      </section>

      <section className="bg-white rounded-3xl p-5 border border-orange-100">
        <h3 className="font-bold text-sm text-stone-600 mb-3">Участники</h3>
        <div className="space-y-2">
          {meta.profiles.map((p) => (
            <div
              key={p.id}
              className={`flex items-center gap-3 px-3.5 py-2.5 rounded-2xl border ${
                p.id === meta.active ? "border-orange-400 bg-orange-50" : "border-orange-100 bg-orange-50/40"
              }`}
            >
              <span className="text-lg">{p.id === meta.active ? "🦁" : "🐱"}</span>
              <span className="font-bold">{p.name}</span>
              {p.id === meta.active && (
                <span className="ml-auto text-[10px] font-bold text-orange-500 bg-white px-2 py-0.5 rounded-full border border-orange-200">
                  это ты
                </span>
              )}
            </div>
          ))}
        </div>
      </section>

      <section className="bg-white rounded-3xl p-5 border border-orange-100">
        <h3 className="font-bold text-sm text-stone-600 mb-3">Аккаунт</h3>
        <div className="space-y-2.5">
          <button
            onClick={() => setConfirmLogout(true)}
            className="w-full bg-stone-50 text-stone-600 font-bold py-3 rounded-2xl border border-stone-200 active:scale-[0.98] transition-transform"
          >
            Выйти / войти под другим именем
          </button>
          <button
            onClick={() => setConfirmReset(true)}
            className="w-full bg-red-50 text-red-500 font-bold py-3 rounded-2xl border border-red-200 active:scale-[0.98] transition-transform"
          >
            Сбросить мой прогресс
          </button>
        </div>

        {confirmReset && (
          <div className="mt-3 p-4 bg-red-50 border border-red-200 rounded-2xl">
            <div className="text-sm font-semibold text-red-600 mb-3">Стереть весь прогресс {myName}?</div>
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

        {confirmLogout && (
          <div className="mt-3 p-4 bg-stone-50 border border-stone-200 rounded-2xl">
            <div className="text-sm font-semibold text-stone-600 mb-3">Выйти и войти как другой участник?</div>
            <div className="flex gap-2">
              <button
                onClick={() => logout()}
                className="flex-1 bg-stone-700 text-white font-bold py-2.5 rounded-xl"
              >
                Выйти
              </button>
              <button
                onClick={() => setConfirmLogout(false)}
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
          SlovakFast v0.2 · бэкенд: Hono · Groq на сервере
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