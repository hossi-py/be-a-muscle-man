import { NextResponse } from "next/server";

import { getSupabaseServerClient } from "@/lib/supabase";

export const dynamic = "force-dynamic";

const profileId = process.env.WORKOUT_PROFILE_ID ?? "default";

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const supabase = getSupabaseServerClient();

  if (!supabase) {
    return NextResponse.json(
      {
        error:
          "Supabase 환경변수가 없습니다. Vercel의 SUPABASE_URL, SUPABASE_ANON_KEY를 확인해 주세요.",
      },
      { status: 500 },
    );
  }

  const { id } = await params;
  const { error } = await supabase
    .from("workout_entries")
    .delete()
    .eq("profile_id", profileId)
    .eq("id", id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ id });
}
