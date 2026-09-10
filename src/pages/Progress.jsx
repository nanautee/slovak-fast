import { useProfile, useMeta, levelFor, todayStr, profileOf } from "../store.js";
import Mascot from "../components/Mascot.jsx";
import ProgressBar from "../components/ProgressBar.jsx";

const BOX_LABEL = ["Новые", "1 день", "2 дн.", "4 дн.", "7 дн.", "15 дн.", "30 дн.", "60 дн."];

export default function Progress({ setRoute }) {
  const profile = useProfile();
  const meta = useMeta();
  const words = profile.words || [];
  const boxes = Array.from({ length: 8 }, (_, i) => words.filter((w) => w.box === i).length);
  const due = words.filter((w) => w.next && w.next <= todayStr()).length;
  const daysKnown = words.filter((w) => w.box > 0).length;
  const totalWords = words.length;

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-3xl p-5 border border-orange-100">
        <div className="flex items-center gap-4">
          <Mascot size={72} />
          <div className="flex-1">
            <div className="text-xs text-stone-400">Изучающий</div>
            <div className="text-lg font-extrabold">
              {meta.profiles.find((p) => p.id === meta.active)?.name || ""} · {levelFor(profile.dayNumber)}
            </div>
            <div className="text-xs text-stone-500 mt-1">
              День {profile.dayNumber} · стрик 🔥 {profile.streak}
            </div>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-2 mt-4">
          <Stat label="Слов выучено" value={totalWords} accent="text-orange-500" />
          <Stat label="В стабильной памяти" value={daysKnown} accent="text-amber-500" />
          <Stat label="Повторить сегодня" value={due} accent="text-red-400" />
        </div>
      </div>

      <div className="bg-white rounded-3xl p-5 border border-orange-100">
        <h3 className="font-bold text-sm text-stone-600 mb-3">Интервалы повторения (SM-2)</h3>
        <div className="flex items-end gap-1.5 h-24">
          {boxes.map((n, i) => (
            <div key={i} className="flex-1 flex flex-col items-center justify-end gap-1">
              <span className="text-xs font-bold text-stone-500">{n}</span>
              <div
                className={`w-full rounded-t-lg ${i === 0 ? "bg-orange-200" : "bg-orange-400"}`}
                style={{ height: `${Math.max(6, (n / Math.max(1, ...boxes)) * 100)}%` }}
              />
              <span className="text-[9px] text-stone-400 rotate-0 text-center leading-tight">
                {BOX_LABEL[i]}
              </span>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-white rounded-3xl p-5 border border-orange-100">
        <div className="flex justify-between items-center mb-3">
          <h3 className="font-bold text-sm text-stone-600">Друг · {otherName(meta)}</h3>
          <span className="text-xs text-stone-400">🔥 {profileOf(otherId(meta)).streak}</span>
        </div>
        <ProgressBar
          value={Math.min(profileOf(otherId(meta)).dayNumber, 100) * 2.5}
          className="bg-stone-100"
        />
        <div className="text-xs text-stone-400 mt-1">
          {otherName(meta)} на дне {profileOf(otherId(meta)).dayNumber} · {levelFor(profileOf(otherId(meta)).dayNumber)}
        </div>
      </div>

      <div className="bg-white rounded-3xl p-5 border border-orange-100">
        <h3 className="font-bold text-sm text-stone-600 mb-3">История тем</h3>
        {profile.history.length === 0 ? (
          <div className="text-xs text-stone-400">Пока пусто. Закрой первый день — и появится!</div>
        ) : (
          <div className="space-y-1.5">
            {[...profile.history].reverse().slice(0, 14).map((h, i) => (
              <div key={i} className="flex items-center gap-2 text-sm">
                <span className="text-[10px] text-stone-300 w-20 shrink-0">{h.date}</span>
                <span className="font-semibold">{h.theme}</span>
                <span className="ml-auto text-green-500">✅</span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="bg-white rounded-3xl p-5 border border-orange-100">
        <h3 className="font-bold text-sm text-stone-600 mb-3">Словарь ({totalWords})</h3>
        {words.length === 0 ? (
          <div className="text-xs text-stone-400">Выучишь первые карточки — они появятся тут.</div>
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {words.map((w, i) => (
              <span
                key={i}
                className={`text-xs px-2 py-1 rounded-full border ${
                  w.box === 0
                    ? "bg-orange-50 border-orange-100 text-orange-600"
                    : "bg-green-50 border-green-100 text-green-700"
                }`}
              >
                {w.sk}
              </span>
            ))}
          </div>
        )}
      </div>

      <p className="text-center text-xs text-stone-400 pb-2">
        Данные хранятся локально в браузере
      </p>
    </div>
  );
}

function Stat({ label, value, accent }) {
  return (
    <div className="bg-orange-50 rounded-2xl p-3 text-center">
      <div className={`text-2xl font-extrabold ${accent}`}>{value}</div>
      <div className="text-[10px] text-stone-400">{label}</div>
    </div>
  );
}

function otherId(meta) {
  return meta.profiles.find((p) => p.id !== meta.active)?.id || meta.active;
}
function otherName(meta) {
  return meta.profiles.find((p) => p.id !== meta.active)?.name || "";
}