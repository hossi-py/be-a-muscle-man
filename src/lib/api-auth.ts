import { NextResponse } from "next/server";

import { getSupabaseServerClient } from "@/lib/supabase";

export async function getAuthenticatedSupabase(request: Request) {
  const token = request.headers
    .get("authorization")
    ?.replace(/^Bearer\s+/i, "")
    .trim();

  if (!token) {
    return {
      error: NextResponse.json(
        { error: "로그인이 필요합니다." },
        { status: 401 },
      ),
    };
  }

  const supabase = getSupabaseServerClient(token);

  if (!supabase) {
    return {
      error: NextResponse.json(
        { error: "Supabase 환경변수가 없습니다." },
        { status: 500 },
      ),
    };
  }

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser(token);

  if (error || !user) {
    return {
      error: NextResponse.json(
        { error: "로그인 세션이 만료되었습니다. 다시 로그인해 주세요." },
        { status: 401 },
      ),
    };
  }

  return { supabase, user };
}
