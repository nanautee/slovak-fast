import { useState } from "react";
import { login, register } from "../store.js";
import Mascot from "./Mascot.jsx";

export default function LoginBox({ user, onDone }) {
  const [name, setName] = useState(user?.name || "");
  const [password, setPassword] = useState("");
  const [password2, setPassword2] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);
  const [mode, setMode] = useState(user ? "login" : "register");

  const submit = async () => {
    setBusy(true); setErr(null);
    try {
      if (mode === "register") {
        if (password.length < 4) { setErr("Пароль минимум 4 символа"); setBusy(false); return; }
        if (password !== password2) { setErr("Пароли не совпадают"); setBusy(false); return; }
        await register(name.trim(), password);
      } else {
        await login(user.id, password);
      }
      onDone?.();
    } catch (e) {
      setErr(e.message);
      setBusy(false);
    }
  };

  const Input = ({ placeholder, ...rest }) => (
    <input
      {...rest}
      placeholder={placeholder}
      className="w-full px-4 py-3 rounded-2xl border border-orange-100 bg-orange-50/50 outline-none focus:border-orange-300 text-sm"
    />
  );

  return (
    <div className="w-full max-w-[380px] space-y-3">
      <Mascot size={64} bounce={false} />
      {mode === "login" ? (
        <div className="bg-white rounded-2xl p-4 border border-orange-100 shadow-sm text-center">
          <div className="text-xs text-stone-400 mb-1">Войти как</div>
          <div className="font-extrabold text-lg text-orange-600">{user?.name || "?"}</div>
        </div>
      ) : (
        <>
          <Input placeholder="Имя" value={name} onChange={(e) => setName(e.target.value)} maxLength={20} disabled={busy} />
        </>
      )}
      <Input
        type="password"
        placeholder={mode === "register" ? "Придумай пароль" : "Пароль"}
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && submit()}
        autoFocus
        disabled={busy}
      />
      {mode === "register" && (
        <Input
          type="password"
          placeholder="Повтори пароль"
          value={password2}
          onChange={(e) => setPassword2(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && submit()}
          disabled={busy}
        />
      )}
      {err && <div className="text-sm text-red-500 text-center">{err}</div>}
      <button
        onClick={submit}
        disabled={busy || (mode === "login" ? !password : name.trim().length < 2 || password.length < 4)}
        className="w-full bg-gradient-to-r from-orange-500 to-amber-500 text-white font-extrabold py-3.5 rounded-2xl shadow-lg shadow-orange-200/60 disabled:opacity-40 active:scale-[0.98] transition-transform"
      >
        {busy ? "Подожди…" : mode === "login" ? "Войти" : "Зарегистрироваться"}
      </button>
      {mode === "login" ? (
        <button
          onClick={() => { setMode("register"); setErr(null); setPassword(""); setPassword2(""); setName(""); }}
          className="w-full text-sm text-stone-400 font-semibold underline"
        >
          Новый профиль
        </button>
      ) : (
        <button
          onClick={() => { setMode("login"); setErr(null); setPassword(""); }}
          className="w-full text-sm text-stone-400 font-semibold underline"
        >
          У меня уже есть профиль
        </button>
      )}
    </div>
  );
}