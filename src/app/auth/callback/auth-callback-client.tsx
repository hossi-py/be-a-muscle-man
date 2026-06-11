"use client";

import { Dumbbell } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

import { getSupabaseBrowserClient } from "@/lib/supabase-browser";

export function AuthCallbackClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [message, setMessage] = useState("이메일 인증을 확인하고 있습니다.");

  useEffect(() => {
    let isMounted = true;

    async function completeAuth() {
      const supabase = await getSupabaseBrowserClient();
      const code = searchParams.get("code");

      if (code) {
        const { error } = await supabase.auth.exchangeCodeForSession(code);

        if (error) {
          setMessage(error.message);
          return;
        }
      } else {
        const { error } = await supabase.auth.getSession();

        if (error) {
          setMessage(error.message);
          return;
        }
      }

      if (isMounted) {
        router.replace("/");
      }
    }

    completeAuth();

    return () => {
      isMounted = false;
    };
  }, [router, searchParams]);

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#f2f3ef] px-4 text-zinc-950">
      <section className="w-full max-w-sm rounded-lg border border-zinc-200 bg-white p-5 text-center shadow-sm">
        <div className="mx-auto flex size-12 items-center justify-center rounded-lg bg-zinc-950 text-white">
          <Dumbbell className="size-6" aria-hidden />
        </div>
        <h1 className="mt-4 text-xl font-bold">인증 처리 중</h1>
        <p className="mt-2 text-sm leading-6 text-zinc-600">{message}</p>
      </section>
    </main>
  );
}
