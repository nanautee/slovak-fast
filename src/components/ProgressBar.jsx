export default function ProgressBar({ value, className = "" }) {
  const pct = Math.max(0, Math.min(100, value));
  return (
    <div className={`w-full h-3 rounded-full bg-orange-100 overflow-hidden ${className}`}>
      <div
        className="h-full rounded-full bg-gradient-to-r from-orange-400 to-amber-400 transition-all duration-500"
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}