import { NextResponse } from "next/server";
import { z } from "zod";

import { getSupabaseServerClient } from "@/lib/supabase";
import type { ProteinEntry } from "@/lib/workout-storage";

export const dynamic = "force-dynamic";

const profileId = process.env.WORKOUT_PROFILE_ID ?? "default";

const proteinEntrySchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  grams: z.coerce.number().min(0),
  updatedAt: z.string(),
});

type ProteinEntryRow = {
  entry_date: string;
  grams: number;
  updated_at: string;
};

function getClientOrError() {
  const supabase = getSupabaseServerClient();

  if (!supabase) {
    return {
      error: NextResponse.json(
        {
          error:
            "Supabase 환경변수가 없습니다. Vercel의 SUPABASE_URL, SUPABASE_ANON_KEY를 확인해 주세요.",
        },
        { status: 500 },
      ),
    };
  }

  return { supabase };
}

function mapProteinRow(row: ProteinEntryRow): ProteinEntry {
  return {
    date: row.entry_date,
    grams: Number(row.grams),
    updatedAt: row.updated_at,
  };
}

export async function GET() {
  const { supabase, error } = getClientOrError();

  if (error) {
    return error;
  }

  const { data, error: queryError } = await supabase
    .from("protein_entries")
    .select("entry_date, grams, updated_at")
    .eq("profile_id", profileId)
    .order("entry_date", { ascending: false });

  if (queryError) {
    return NextResponse.json({ error: queryError.message }, { status: 500 });
  }

  return NextResponse.json({
    entries: ((data ?? []) as ProteinEntryRow[]).map(mapProteinRow),
  });
}

export async function POST(request: Request) {
  const { supabase, error } = getClientOrError();

  if (error) {
    return error;
  }

  const parsed = proteinEntrySchema.safeParse(await request.json());

  if (!parsed.success) {
    return NextResponse.json(
      { error: "단백질 기록 형식이 올바르지 않습니다." },
      { status: 400 },
    );
  }

  const entry = parsed.data;
  const { data, error: queryError } = await supabase
    .from("protein_entries")
    .upsert(
      {
        profile_id: profileId,
        entry_date: entry.date,
        grams: entry.grams,
        updated_at: entry.updatedAt,
      },
      { onConflict: "profile_id,entry_date" },
    )
    .select("entry_date, grams, updated_at")
    .single();

  if (queryError) {
    return NextResponse.json({ error: queryError.message }, { status: 500 });
  }

  return NextResponse.json({ entry: mapProteinRow(data as ProteinEntryRow) });
}
