export default function BottomNav({ active, onNav, state }) {
  const items = [
    { id: "today", label: "Главная", emoji: "🏠" },
    { id: "cards", label: "Карточки", emoji: "🃏", badge: state?.today?.cards && !state.today.cards.done },
    { id: "chat", label: "Чат", emoji: "💬", badge: state?.today?.chat && !state.today.chat.done },
    { id: "quiz", label: "Тест", emoji: "📝", badge: state?.today?.quiz && !state.today.quiz.done },
    { id: "progress", label: "Прогресс", emoji: "📊" },
  ];
  return (
    <nav className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[480px] bg-white/90 backdrop-blur border-t border-orange-100 pb-safe z-40">
      <div className="flex">
        {items.map((it) => {
          const isActive = active === it.id;
          return (
            <button
              key={it.id}
              onClick={() => onNav(it.id)}
              className={`relative flex-1 flex flex-col items-center gap-0.5 py-2.5 transition-colors ${
                isActive ? "text-orange-600" : "text-stone-400"
              }`}
            >
              {it.badge && (
                <span className="absolute top-1.5 right-1/2 translate-x-3 w-2 h-2 rounded-full bg-orange-500" />
              )}
              <span className="text-xl leading-none">{it.emoji}</span>
              <span className="text-[10px] font-semibold">{it.label}</span>
              <span
                className={`absolute bottom-0 w-8 h-1 rounded-full transition-all ${
                  isActive ? "bg-orange-500" : "bg-transparent"
                }`}
              />
            </button>
          );
        })}
      </div>
    </nav>
  );
}