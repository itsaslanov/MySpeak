export default function Footer() {
  return (
    <footer className="mt-auto border-t border-zinc-800/50 pt-4 pb-3">
      <div className="flex flex-col items-center justify-between gap-2 sm:flex-row">
        <p className="text-[11px] text-zinc-600">
          &copy; 2026{" "}
          <a href="https://aziz.kr" target="_blank" rel="noopener noreferrer" className="text-zinc-500 hover:text-accent transition-colors">
            MySpeak
          </a>
          . All rights reserved.
        </p>
        <p className="text-[11px] text-zinc-600">
          Made by{" "}
          <a href="https://aziz.kr" target="_blank" rel="noopener noreferrer" className="text-zinc-500 hover:text-accent transition-colors">
            aziz.kr
          </a>
        </p>
      </div>
    </footer>
  );
}
