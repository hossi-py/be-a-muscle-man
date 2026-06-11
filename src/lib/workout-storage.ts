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

const WORKOUTS_KEY = "workout-tracker:workouts";
const PROTEIN_KEY = "workout-tracker:protein";

function readJson<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") {
    return fallback;
  }

  const raw = window.localStorage.getItem(key);
  if (!raw) {
    return fallback;
  }

  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function writeJson<T>(key: string, value: T) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(key, JSON.stringify(value));
}

export function loadWorkoutEntries() {
  return readJson<WorkoutEntry[]>(WORKOUTS_KEY, []);
}

export function saveWorkoutEntry(entry: WorkoutEntry) {
  const entries = loadWorkoutEntries();
  const next = [entry, ...entries].sort((a, b) => {
    const byDate = b.date.localeCompare(a.date);
    return byDate || b.createdAt.localeCompare(a.createdAt);
  });

  writeJson(WORKOUTS_KEY, next);
  return next;
}

export function deleteWorkoutEntry(id: string) {
  const next = loadWorkoutEntries().filter((entry) => entry.id !== id);
  writeJson(WORKOUTS_KEY, next);
  return next;
}

export function loadProteinEntries() {
  return readJson<ProteinEntry[]>(PROTEIN_KEY, []);
}

export function upsertProteinEntry(entry: ProteinEntry) {
  const entries = loadProteinEntries();
  const next = [
    entry,
    ...entries.filter((item) => item.date !== entry.date),
  ].sort((a, b) => b.date.localeCompare(a.date));

  writeJson(PROTEIN_KEY, next);
  return next;
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
