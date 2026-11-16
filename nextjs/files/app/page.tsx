export default function Home() {
  return (
    <div className="flex flex-col flex-1 items-center justify-center font-sans">
      <main className="flex flex-1 w-full max-w-3xl flex-col items-center justify-center py-32 px-16 sm:items-start">
        <div className="flex flex-col items-center gap-6 text-center sm:items-start sm:text-left">
          <h1 className="max-w-xs text-3xl font-semibold leading-10 tracking-tight text-black dark:text-zinc-50">
            __TEMPLATE_HOME_TITLE__
          </h1>
          <p className="max-w-md text-lg leading-8 text-zinc-600 dark:text-zinc-400">
            __TEMPLATE_HOME_INTRO__{" "}
            <code className="px-2 py-1 rounded bg-zinc-100 dark:bg-zinc-800 font-mono text-sm">
              app/page.tsx
            </code>{" "}
            __TEMPLATE_HOME_OUTRO__
          </p>
          <div className="flex flex-col gap-3 text-sm text-zinc-600 dark:text-zinc-400">
            <p className="flex items-center gap-2">
              <span className="text-xl">✨</span>
              <span>__TEMPLATE_HOME_TIP_CHAT__</span>
            </p>
            <p className="flex items-center gap-2">
              <span className="text-xl">🎨</span>
              <span>__TEMPLATE_HOME_TIP_STYLE__</span>
            </p>
            <p className="flex items-center gap-2">
              <span className="text-xl">🚀</span>
              <span>__TEMPLATE_HOME_TIP_PUBLISH__</span>
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
