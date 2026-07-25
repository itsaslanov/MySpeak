import { useState } from "react";
import { User } from "lucide-react";

export default function NameModal({ onSave }) {
  const [name, setName] = useState("");

  function handleSubmit(event) {
    event.preventDefault();
    const trimmed = name.trim().replace(/\s+/g, " ");

    if (trimmed) {
      onSave(trimmed);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/90 p-4">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-sm rounded-[28px] border border-slate-800 bg-slate-900 p-6 shadow-sm"
      >
        <div className="mb-5 flex h-11 w-11 items-center justify-center rounded-lg bg-sky-500 text-white">
          <User size={22} aria-hidden="true" />
        </div>
        <h1 className="text-xl font-semibold text-slate-100">Enter your name</h1>
        <p className="mt-2 text-sm leading-6 text-slate-400">
          This is the only thing users need before joining a voice group.
        </p>
        <input
          autoFocus
          value={name}
          onChange={(event) => setName(event.target.value)}
          maxLength={32}
          placeholder="Your name"
          className="mt-5 h-11 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 text-sm text-slate-100 outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20"
        />
        <button
          type="submit"
          className="mt-4 inline-flex h-11 w-full items-center justify-center rounded-lg bg-sky-600 px-4 text-sm font-semibold text-white transition hover:bg-sky-700 disabled:cursor-not-allowed disabled:bg-slate-800"
          disabled={!name.trim()}
        >
          Continue
        </button>
      </form>
    </div>
  );
}
