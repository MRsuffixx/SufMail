import Link from "next/link";
import { auth } from "~/server/auth";

export default async function Home() {
  const session = await auth();

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-b from-[#0f0c29] via-[#1a1040] to-[#302b63] text-white">
      <div className="container flex flex-col items-center justify-center gap-12 px-4 py-16">
        <div className="flex flex-col items-center gap-4">
          <h1 className="text-6xl font-extrabold tracking-tight sm:text-[5rem]">
            Mail<span className="text-[hsl(262,83%,68%)]">Forge</span>
          </h1>
          <p className="text-xl text-white/70">
            A powerful, open-source webmail client
          </p>
        </div>

        <div className="flex flex-col items-center gap-4">
          {session ? (
            <>
              <p className="text-lg text-white/80">
                Welcome back, <span className="font-semibold">{session.user?.name ?? session.user?.email}</span>
              </p>
              <div className="flex gap-4">
                <Link
                  href="/app/inbox"
                  className="rounded-full bg-[hsl(262,83%,58%)] px-10 py-3 font-semibold no-underline transition hover:bg-[hsl(262,83%,68%)]"
                >
                  Go to Inbox →
                </Link>
                <Link
                  href="/api/auth/signout"
                  className="rounded-full bg-white/10 px-10 py-3 font-semibold no-underline transition hover:bg-white/20"
                >
                  Sign out
                </Link>
              </div>
            </>
          ) : (
            <Link
              href="/login"
              className="rounded-full bg-[hsl(262,83%,58%)] px-10 py-3 font-semibold no-underline transition hover:bg-[hsl(262,83%,68%)]"
            >
              Sign in to MailForge →
            </Link>
          )}
        </div>
      </div>
    </main>
  );
}
