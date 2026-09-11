import { useState } from "react";
import { useDb, beginSwitch } from "../store.js";
import LoginBox from "../components/LoginBox.jsx";
import Mascot from "../components/Mascot.jsx";

export default function AuthScreen({ setRoute }) {
  const db = useDb();
  const users = db.meta?.profiles || [];
  const fromApp = db.meta?.fromApp;
  const pendingId = db.meta?.pendingId;
  const initialUser = pendingId ? users.find((u) => u.id === pendingId) || null : null;
  const [selUser, setSelUser] = useState(initialUser);

  const back = () => {
    beginSwitch(null, false);
    if (fromApp) setRoute("today");
  };

  return (
    <div className="min-h-full flex flex-col items-center justify-center px-4 py-10 gap-4">
      <Mascot size={96} bounce />
      <div>
        <div className="text-2xl font-extrabold text-orange-600 text-center">SlovakFast</div>
        <div className="text-sm text-stone-400 text-center mt-1">
          {selUser ? "Войди в профиль" : "Войди, чтобы продолжить"}
        </div>
      </div>

      {fromApp && (
        <button onClick={back} className="text-sm text-stone-400 font-semibold underline">← Назад</button>
      )}

      {!selUser && users.length > 0 && (
        <div className="w-full max-w-[380px] space-y-2">
          <div className="text-xs font-bold text-stone-400 uppercase tracking-wide">Кто ты?</div>
          {users.map((u) => (
            <button
              key={u.id}
              onClick={() => setSelUser(u)}
              className="w-full px-5 py-4 rounded-2xl bg-white border border-orange-100 shadow-sm flex items-center justify-between hover:border-orange-300 transition-colors"
            >
              <span className="font-bold text-stone-700">{u.name}</span>
              <span className="text-orange-400 text-xs font-bold">Войти →</span>
            </button>
          ))}
        </div>
      )}

      <LoginBox
        key={selUser?.id || "__register__"}
        user={selUser}
        onDone={() => {}}
      />

      {selUser && (
        <button
          onClick={() => setSelUser(null)}
          className="text-sm text-stone-400 font-semibold underline"
        >
          К списку профилей
        </button>
      )}
    </div>
  );
}