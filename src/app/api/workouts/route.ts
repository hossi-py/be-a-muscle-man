import { NextResponse } from "next/server";
import { z } from "zod";

import { getAuthenticatedSupabase } from "@/lib/api-auth";
import type {
  WorkoutCardio,
  WorkoutEntry,
  WorkoutSet,
} from "@/lib/workout-storage";

export const dynamic = "force-dynamic";

const workoutSetSchema = z.object({
  id: z.string(),
  weight: z.coerce.number().min(0),
  reps: z.coerce.number().int().min(1),
});

const workoutCardioSchema = z.object({
  durationMinutes: z.coerce.number().min(1),
  incline: z.coerce.number().min(0),
  speed: z.coerce.number().min(0),
});

const workoutEntrySchema = z.object({
  id: z.string().uuid(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  exercise: z.string().min(1),
  sets: z.array(workoutSetSchema),
  cardio: workoutCardioSchema.optional(),
  note: z.string().optional(),
  createdAt: z.string(),
});

type WorkoutEntryRow = {
  id: string;
  entry_date: string;
  exercise: string;
  sets: WorkoutSet[];
  cardio: WorkoutCardio | null;
  note: string | null;
  created_at: string;
};

function mapWorkoutRow(row: WorkoutEntryRow): WorkoutEntry {
  return {
    id: row.id,
    date: row.entry_date,
    exercise: row.exercise,
    sets: row.sets,
    cardio: row.cardio || undefined,
    note: row.note || undefined,
    createdAt: row.created_at,
  };
}

export async function GET(request: Request) {
  const { supabase, user, error } = await getAuthenticatedSupabase(request);

  if (error) {
    return error;
  }

  const { data, error: queryError } = await supabase
    .from("workout_entries")
    .select("id, entry_date, exercise, sets, cardio, note, created_at")
    .eq("user_id", user.id)
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
  const { supabase, user, error } = await getAuthenticatedSupabase(request);

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
      user_id: user.id,
      entry_date: entry.date,
      exercise: entry.exercise,
      sets: entry.sets,
      cardio: entry.cardio ?? null,
      note: entry.note ?? null,
      created_at: entry.createdAt,
    })
    .select("id, entry_date, exercise, sets, cardio, note, created_at")
    .single();

  if (queryError) {
    return NextResponse.json({ error: queryError.message }, { status: 500 });
  }

  return NextResponse.json({ entry: mapWorkoutRow(data as WorkoutEntryRow) });
}
