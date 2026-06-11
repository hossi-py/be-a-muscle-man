import { getSupabaseBrowserClient } from "@/lib/supabase";

export type WorkoutSet = {
  id: string;
  weight: number;
  reps: number;
};

export type WorkoutEntry = {
  id: string;
  date: string;
  exercise: string;
  sets: WorkoutSet[];
  note?: string;
  createdAt: string;
};

export type ProteinEntry = {
  date: string;
  grams: number;
  updatedAt: string;
};

type WorkoutEntryRow = {
  id: string;
  entry_date: string;
  exercise: string;
  sets: WorkoutSet[];
  note: string | null;
  created_at: string;
};

type ProteinEntryRow = {
  entry_date: string;
  grams: number;
  updated_at: string;
};

const PROFILE_ID = process.env.NEXT_PUBLIC_WORKOUT_PROFILE_ID || "default";

function getRequiredSupabaseClient() {
  const supabase = getSupabaseBrowserClient();

  if (!supabase) {
    throw new Error(
      "Supabase 환경변수가 없습니다. NEXT_PUBLIC_SUPABASE_URL과 NEXT_PUBLIC_SUPABASE_ANON_KEY를 설정해 주세요.",
    );
  }

  return supabase;
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

function mapProteinRow(row: ProteinEntryRow): ProteinEntry {
  return {
    date: row.entry_date,
    grams: Number(row.grams),
    updatedAt: row.updated_at,
  };
}

function normalizeSupabaseError(error: { message?: string }) {
  return new Error(error.message || "Supabase 요청에 실패했습니다.");
}

export async function loadWorkoutEntries() {
  const supabase = getRequiredSupabaseClient();
  const { data, error } = await supabase
    .from("workout_entries")
    .select("id, entry_date, exercise, sets, note, created_at")
    .eq("profile_id", PROFILE_ID)
    .order("entry_date", { ascending: false })
    .order("created_at", { ascending: false });

  if (error) {
    throw normalizeSupabaseError(error);
  }

  return ((data ?? []) as WorkoutEntryRow[]).map(mapWorkoutRow);
}

export async function saveWorkoutEntry(entry: WorkoutEntry) {
  const supabase = getRequiredSupabaseClient();
  const { data, error } = await supabase
    .from("workout_entries")
    .insert({
      id: entry.id,
      profile_id: PROFILE_ID,
      entry_date: entry.date,
      exercise: entry.exercise,
      sets: entry.sets,
      note: entry.note ?? null,
      created_at: entry.createdAt,
    })
    .select("id, entry_date, exercise, sets, note, created_at")
    .single();

  if (error) {
    throw normalizeSupabaseError(error);
  }

  return mapWorkoutRow(data as WorkoutEntryRow);
}

export async function deleteWorkoutEntry(id: string) {
  const supabase = getRequiredSupabaseClient();
  const { error } = await supabase
    .from("workout_entries")
    .delete()
    .eq("profile_id", PROFILE_ID)
    .eq("id", id);

  if (error) {
    throw normalizeSupabaseError(error);
  }

  return id;
}

export async function loadProteinEntries() {
  const supabase = getRequiredSupabaseClient();
  const { data, error } = await supabase
    .from("protein_entries")
    .select("entry_date, grams, updated_at")
    .eq("profile_id", PROFILE_ID)
    .order("entry_date", { ascending: false });

  if (error) {
    throw normalizeSupabaseError(error);
  }

  return ((data ?? []) as ProteinEntryRow[]).map(mapProteinRow);
}

export async function upsertProteinEntry(entry: ProteinEntry) {
  const supabase = getRequiredSupabaseClient();
  const { data, error } = await supabase
    .from("protein_entries")
    .upsert(
      {
        profile_id: PROFILE_ID,
        entry_date: entry.date,
        grams: entry.grams,
        updated_at: entry.updatedAt,
      },
      { onConflict: "profile_id,entry_date" },
    )
    .select("entry_date, grams, updated_at")
    .single();

  if (error) {
    throw normalizeSupabaseError(error);
  }

  return mapProteinRow(data as ProteinEntryRow);
}

export function getEntryVolume(entry: WorkoutEntry) {
  return entry.sets.reduce((sum, set) => sum + set.weight * set.reps, 0);
}

export function getDateVolume(entries: WorkoutEntry[], date: string) {
  return entries
    .filter((entry) => entry.date === date)
    .reduce((sum, entry) => sum + getEntryVolume(entry), 0);
}

export function getRecentWeightForExercise(
  entries: WorkoutEntry[],
  exercise: string,
) {
  const normalized = exercise.trim().toLowerCase();

  if (!normalized) {
    return null;
  }

  const match = entries.find(
    (entry) => entry.exercise.trim().toLowerCase() === normalized,
  );

  if (!match) {
    return null;
  }

  return Math.max(...match.sets.map((set) => set.weight));
}

export function toDateKey(date = new Date()) {
  const localDate = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return localDate.toISOString().slice(0, 10);
}

export function formatNumber(value: number) {
  return new Intl.NumberFormat("ko-KR", {
    maximumFractionDigits: 1,
  }).format(value);
}
