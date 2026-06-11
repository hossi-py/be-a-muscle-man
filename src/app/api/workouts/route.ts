import { NextResponse } from "next/server";
import { z } from "zod";

import { getSupabaseServerClient } from "@/lib/supabase";
import type { WorkoutEntry, WorkoutSet } from "@/lib/workout-storage";

export const dynamic = "force-dynamic";

const profileId = process.env.WORKOUT_PROFILE_ID ?? "default";

const workoutSetSchema = z.object({
  id: z.string(),
  weight: z.coerce.number().min(0),
  reps: z.coerce.number().int().min(1),
});

const workoutEntrySchema = z.object({
  id: z.string().uuid(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  exercise: z.string().min(1),
  sets: z.array(workoutSetSchema).min(1),
  note: z.string().optional(),
  createdAt: z.string(),
});

type WorkoutEntryRow = {
  id: string;
  entry_date: string;
  exercise: string;
  sets: WorkoutSet[];
  note: string | null;
  created_at: string;
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

function mapWorkoutRow(row: WorkoutEntryRow): WorkoutEntry {
  return {
    id: row.id,
    date: row.entry_date,
    exercise: row.exercise,
    sets: row.sets,
    note: row.note || undefined,
    createdAt: row.created_at,
  };
}

export async function GET() {
  const { supabase, error } = getClientOrError();

  if (error) {
    return error;
  }

  const { data, error: queryError } = await supabase
    .from("workout_entries")
    .select("id, entry_date, exercise, sets, note, created_at")
    .eq("profile_id", profileId)
    .order("entry_date", { ascending: false })
    .order("created_at", { ascending: false });

  if (queryError) {
    return NextResponse.json({ error: queryError.message }, { status: 500 });
  }

  return NextResponse.json({
    entries: ((data ?? []) as WorkoutEntryRow[]).map(mapWorkoutRow),
  });
}

export async function POST(request: Request) {
  const { supabase, error } = getClientOrError();

  if (error) {
    return error;
  }

  const parsed = workoutEntrySchema.safeParse(await request.json());

  if (!parsed.success) {
    return NextResponse.json(
      { error: "운동 기록 형식이 올바르지 않습니다." },
      { status: 400 },
    );
  }

  const entry = parsed.data;
  const { data, error: queryError } = await supabase
    .from("workout_entries")
    .insert({
      id: entry.id,
      profile_id: profileId,
      entry_date: entry.date,
      exercise: entry.exercise,
      sets: entry.sets,
      note: entry.note ?? null,
      created_at: entry.createdAt,
    })
    .select("id, entry_date, exercise, sets, note, created_at")
    .single();

  if (queryError) {
    return NextResponse.json({ error: queryError.message }, { status: 500 });
  }

  return NextResponse.json({ entry: mapWorkoutRow(data as WorkoutEntryRow) });
}
