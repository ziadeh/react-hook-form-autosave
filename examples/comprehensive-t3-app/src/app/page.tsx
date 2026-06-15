import { HydrateClient } from "@/trpc/server";
import { AutosaveDemo } from "./_components/autosave-demo/AutosaveDemo";
import { Toaster } from "sonner";

export default function Home() {
  return (
    <HydrateClient>
      <main className="flex min-h-screen flex-col items-center justify-start bg-gradient-to-b from-[#2e026d] to-[#15162c] text-white">
        <div className="container flex flex-col items-center justify-start gap-8 px-4 py-12">
          <header className="flex flex-col items-center gap-2 text-center">
            <h1 className="text-4xl font-extrabold tracking-tight sm:text-5xl">
              React Hook Form{" "}
              <span className="text-[hsl(280,100%,70%)]">Autosave</span>
            </h1>
            <p className="max-w-xl text-sm text-white/60">
              Nested fields, an editable list, real autosave over tRPC, undo/redo,
              payload validation, metrics and a live save log.
            </p>
          </header>

          <AutosaveDemo />

          <footer className="flex flex-wrap items-center justify-center gap-2 pt-4 text-sm text-white/60">
            <span className="text-white/40">Prefer the basics?</span>
            <a
              href="/autosave-undo"
              className="font-medium underline hover:text-white"
            >
              View the minimal autosave + undo/redo example →
            </a>
          </footer>
        </div>
        <Toaster richColors theme="dark" />
      </main>
    </HydrateClient>
  );
}
