import { createClient, type SupabaseClient } from "@supabase/supabase-js";

type SupabasePublicConfig = {
  url: string;
  key: string;
};

let browserClientPromise: Promise<SupabaseClient> | null = null;

async function loadSupabasePublicConfig() {
  const response = await fetch("/api/auth/config");

  if (!response.ok) {
    throw new Error("Supabase 인증 설정을 불러오지 못했습니다.");
  }

  return (await response.json()) as SupabasePublicConfig;
}

export async function getSupabaseBrowserClient() {
  browserClientPromise ??= loadSupabasePublicConfig().then(({ url, key }) =>
    createClient(url, key),
  );

  return browserClientPromise;
}

export async function getSupabaseAccessToken() {
  const supabase = await getSupabaseBrowserClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  return session?.access_token ?? null;
}
