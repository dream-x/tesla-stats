import Link from "next/link";

export default function MainLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <header className="border-b border-white/10">
        <nav className="mx-auto flex max-w-5xl items-center gap-5 px-4 py-3 text-sm">
          <Link href="/" className="font-semibold tracking-wide text-white">
            ⚡ Tesla Stats
          </Link>
          <Link href="/" className="text-neutral-400 hover:text-white">
            Статистика
          </Link>
          <Link href="/data" className="text-neutral-400 hover:text-white">
            Данные
          </Link>
          <Link href="/widget" className="text-neutral-400 hover:text-white">
            Виджет
          </Link>
          <Link href="/settings" className="ml-auto text-neutral-400 hover:text-white">
            Настройки
          </Link>
        </nav>
      </header>
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-6">{children}</main>
    </>
  );
}
