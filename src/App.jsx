import { useEffect, useState } from "react";
import { init, ensureTopic, todayDone, todayTotal, useDb, useProfile, levelFor } from "./store.js";
import { warmVoices, hasSkVoice } from "./lib/tts.js";

import Mascot from "./components/Mascot.jsx";
import BottomNav from "./components/BottomNav.jsx";
import Today from "./pages/Today.jsx";
import Cards from "./pages/Cards.jsx";
import Chat from "./pages/Chat.jsx";
import Quiz from "./pages/Quiz.jsx";
import Listen from "./pages/Listen.jsx";
import Progress from "./pages/Progress.jsx";
import Dict from "./pages/Dict.jsx";
import Settings from "./pages/Settings.jsx";
import WelcomeScreen from "./pages/WelcomeScreen.jsx";

export default function App() {
  const db = useDb();
  const profile = useProfile();
  const [route, setRoute] = useState("today");
  const [ready, setReady] = useState(false);

  useEffect(() => {
    warmVoices();
    init().then(() => ensureTopic().finally(() => setReady(true)));
    const t = setTimeout(() => hasSkVoice(), 800);
    return () => clearTimeout(t);
  }, []);

  if (db.boot === "welcome") return <WelcomeScreen />;

  if (!profile) {
    if (db.boot === "offline")
      return (
        <div className="min-h-full flex flex-col items-center justify-center gap-4 px-6">
          <Mascot size={90} />
          <div className="font-bold text-stone-700">Нет связи с сервером</div>
          <div className="text-sm text-stone-400 text-center">Не могу достучаться до бэкенда.</div>
          <button
            onClick={() => { setReady(false); init().then(() => ensureTopic().finally(() => setReady(true))); }}
            className="px-8 py-3 rounded-2xl bg-orange-500 text-white font-bold"
          >
            Попробовать ещё раз
          </button>
        </div>
      );
    return (
      <div className="min-h-full flex flex-col items-center justify-center gap-3">
        <Mascot size={90} bounce />
      </div>
    );
  }

  const page = (() => {
    const props = { setRoute };
    switch (route) {
      case "cards": return <Cards {...props} />;
      case "chat": return <Chat {...props} />;
      case "quiz": return <Quiz {...props} />;
      case "listen": return <Listen {...props} />;
      case "progress": return <Progress {...props} />;
      case "dict": return <Dict {...props} />;
      case "settings": return <Settings {...props} />;
      default: return <Today {...props} />;
    }
  })();

  return (
    <div className="min-h-full bg-orange-50 text-stone-800">
      <header className="sticky top-0 z-30 bg-orange-50/90 backdrop-blur border-b border-orange-100">
        <div className="flex items-center justify-between px-4 py-2.5 max-w-[480px] mx-auto">
          <div className="flex items-center gap-2 shrink-0">
            <Mascot size={34} src="/logo.png" />
            <div className="leading-tight">
              <div className="font-extrabold text-lg text-orange-600 leading-none">SlovakFast</div>
              <div className="text-[10px] text-stone-400 mt-0.5">{levelFor(profile.dayNumber)}</div>
            </div>
          </div>
          <div className="flex items-center gap-1.5 ml-2">
            <span
              title={profile.name || "Игрок"}
              className="w-8 h-8 rounded-full bg-orange-500 text-white text-sm font-bold flex items-center justify-center shrink-0 cursor-pointer"
              onClick={() => setRoute("settings")}
            >
              {(profile.name || "И")[0]?.toUpperCase()}
            </span>
            <span className="flex items-center gap-1 bg-orange-100 rounded-full px-2 py-1 text-sm font-bold text-orange-600 shrink-0">
              🔥 {profile.streak}
              <span className="text-orange-300">·</span>
              <span className="text-xs">{todayDone(profile)}/{todayTotal()}</span>
            </span>
            <button
              onClick={() => setRoute(route === "settings" ? "today" : "settings")}
              className="w-8 h-8 rounded-full bg-white border border-orange-100 flex items-center justify-center text-base shrink-0"
            >
              ⚙️
            </button>
          </div>
        </div>
      </header>

      <main className="px-4 pt-3 pb-28">
        {!ready ? (
          <div className="flex flex-col items-center justify-center py-24 gap-3">
            <Mascot size={90} bounce />
            <div className="text-stone-400 text-sm animate-pulse">Mačka готовит тему…</div>
          </div>
        ) : (
          page
        )}
      </main>

      {route !== "settings" && (
        <BottomNav active={route === "listen" ? "today" : route} onNav={setRoute} state={profile} />
      )}
    </div>
  );
}