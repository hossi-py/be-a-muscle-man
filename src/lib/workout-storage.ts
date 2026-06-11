import { getSupabaseAccessToken } from "@/lib/supabase-browser";

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

async function requestJson<T>(path: string, init?: RequestInit) {
  const accessToken = await getSupabaseAccessToken();

  if (!accessToken) {
    throw new Error("로그인이 필요합니다.");
  }

  const response = await fetch(path, {
    ...init,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      ...init?.headers,
    },
  });

  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as {
      error?: string;
    } | null;

    throw new Error(body?.error || "요청을 처리하지 못했습니다.");
  }

  return (await response.json()) as T;
}

export async function loadWorkoutEntries() {
  const payload = await requestJson<{ entries: WorkoutEntry[] }>(
    "/api/workouts",
  );

  return payload.entries;
}

export async function saveWorkoutEntry(entry: WorkoutEntry) {
  const payload = await requestJson<{ entry: WorkoutEntry }>("/api/workouts", {
    method: "POST",
    body: JSON.stringify(entry),
  });

  return payload.entry;
}

export async function deleteWorkoutEntry(id: string) {
  await requestJson<{ id: string }>(`/api/workouts/${id}`, {
    method: "DELETE",
  });

  return id;
}

export async function loadProteinEntries() {
  const payload = await requestJson<{ entries: ProteinEntry[] }>(
    "/api/protein",
  );

  return payload.entries;
}

export async function upsertProteinEntry(entry: ProteinEntry) {
  const payload = await requestJson<{ entry: ProteinEntry }>("/api/protein", {
    method: "POST",
    body: JSON.stringify(entry),
  });

  return payload.entry;
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
