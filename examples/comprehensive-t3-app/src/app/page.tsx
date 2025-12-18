import { HydrateClient } from "@/trpc/server";
import { AutosaveDemo } from "./_components/autosave-demo/AutosaveDemo";
import { Toaster } from "sonner";

export default function Home() {
  return (
    <HydrateClient>
      <main className="flex min-h-screen flex-col items-center justify-start bg-gradient-to-b from-[#2e026d] to-[#15162c] text-white">
        <div className="container flex flex-col items-center justify-start gap-12 px-4 py-16">
          <h1 className="text-5xl font-extrabold tracking-tight sm:text-[3rem]">
            React Hook Form{" "}
            <span className="text-[hsl(280,100%,70%)]">Autosave</span>
          </h1>
          <AutosaveDemo />
        </div>
        <Toaster />
      </main>
    </HydrateClient>
  );
}
