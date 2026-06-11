"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Activity,
  CalendarDays,
  Dumbbell,
  Flame,
  LineChart,
  Plus,
  Trash2,
  Utensils,
} from "lucide-react";
import dynamic from "next/dynamic";
import { useMemo, useState } from "react";
import { useFieldArray, useForm, useWatch } from "react-hook-form";
import { z } from "zod";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  deleteWorkoutEntry,
  formatNumber,
  getDateVolume,
  getEntryVolume,
  getRecentWeightForExercise,
  loadProteinEntries,
  loadWorkoutEntries,
  saveWorkoutEntry,
  toDateKey,
  upsertProteinEntry,
  type ProteinEntry,
  type WorkoutEntry,
} from "@/lib/workout-storage";

const workoutSchema = z.object({
  date: z.string().min(1, "날짜를 선택해 주세요."),
  exercise: z.string().trim().min(1, "운동 이름을 입력해 주세요."),
  note: z.string().optional(),
  sets: z
    .array(
      z.object({
        weight: z.number().min(0, "0kg 이상 입력해 주세요."),
        reps: z.number().int().min(1, "1회 이상 입력해 주세요."),
      }),
    )
    .min(1, "세트를 1개 이상 추가해 주세요."),
});

const proteinSchema = z.object({
  grams: z.number().min(0, "0g 이상 입력해 주세요."),
});

type WorkoutFormValues = z.infer<typeof workoutSchema>;
type ProteinFormValues = z.infer<typeof proteinSchema>;

const VolumeChart = dynamic(
  () => import("@/components/volume-chart").then((mod) => mod.VolumeChart),
  {
    ssr: false,
    loading: () => <div className="h-72 rounded-md bg-zinc-50" />,
  },
);

const queryKeys = {
  workouts: ["workouts"],
  protein: ["protein"],
};

function createId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function getLastSevenDays(selectedDate: string) {
  const base = new Date(`${selectedDate}T00:00:00`);

  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date(base);
    date.setDate(base.getDate() - (6 - index));
    return toDateKey(date);
  });
}

export function WorkoutApp() {
  const queryClient = useQueryClient();
  const [selectedDate, setSelectedDate] = useState(toDateKey());

  const workoutsQuery = useQuery({
    queryKey: queryKeys.workouts,
    queryFn: loadWorkoutEntries,
  });

  const proteinQuery = useQuery({
    queryKey: queryKeys.protein,
    queryFn: loadProteinEntries,
  });

  const workouts = useMemo(() => workoutsQuery.data ?? [], [workoutsQuery.data]);
  const proteinEntries = useMemo(
    () => proteinQuery.data ?? [],
    [proteinQuery.data],
  );
  const selectedProtein =
    proteinEntries.find((entry) => entry.date === selectedDate)?.grams ?? 0;

  const workoutForm = useForm<WorkoutFormValues>({
    resolver: zodResolver(workoutSchema),
    defaultValues: {
      date: selectedDate,
      exercise: "",
      note: "",
      sets: [{ weight: 0, reps: 10 }],
    },
  });

  const proteinForm = useForm<ProteinFormValues>({
    resolver: zodResolver(proteinSchema),
    values: {
      grams: selectedProtein,
    },
  });

  const { fields, append, remove } = useFieldArray({
    control: workoutForm.control,
    name: "sets",
  });

  const watchedExercise =
    useWatch({
      control: workoutForm.control,
      name: "exercise",
    }) ?? "";
  const watchedSets =
    useWatch({
      control: workoutForm.control,
      name: "sets",
    }) ?? [];
  const recentWeight = getRecentWeightForExercise(workouts, watchedExercise);
  const draftVolume = watchedSets.reduce(
    (sum, set) => sum + Number(set.weight || 0) * Number(set.reps || 0),
    0,
  );

  const dateEntries = useMemo(
    () => workouts.filter((entry) => entry.date === selectedDate),
    [selectedDate, workouts],
  );
  const dayVolume = getDateVolume(workouts, selectedDate);
  const daySets = dateEntries.reduce((sum, entry) => sum + entry.sets.length, 0);
  const exerciseCount = new Set(dateEntries.map((entry) => entry.exercise)).size;
  const proteinGoal = 120;
  const proteinProgress = Math.min(100, (selectedProtein / proteinGoal) * 100);

  const chartData = useMemo(() => {
    const dates = getLastSevenDays(selectedDate);

    return dates.map((date) => ({
      date: date.slice(5).replace("-", "/"),
      volume: getDateVolume(workouts, date),
      protein: proteinEntries.find((entry) => entry.date === date)?.grams ?? 0,
    }));
  }, [proteinEntries, selectedDate, workouts]);

  const addWorkoutMutation = useMutation({
    mutationFn: async (values: WorkoutFormValues) => {
      const entry: WorkoutEntry = {
        id: createId(),
        date: values.date,
        exercise: values.exercise.trim(),
        note: values.note?.trim() || undefined,
        sets: values.sets.map((set) => ({
          id: createId(),
          weight: Number(set.weight),
          reps: Number(set.reps),
        })),
        createdAt: new Date().toISOString(),
      };

      return saveWorkoutEntry(entry);
    },
    onSuccess: (_, values) => {
      setSelectedDate(values.date);
      queryClient.invalidateQueries({ queryKey: queryKeys.workouts });
      workoutForm.reset({
        date: values.date,
        exercise: "",
        note: "",
        sets: [{ weight: recentWeight ?? 0, reps: 10 }],
      });
    },
  });

  const deleteWorkoutMutation = useMutation({
    mutationFn: async (id: string) => deleteWorkoutEntry(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.workouts });
    },
  });

  const saveProteinMutation = useMutation({
    mutationFn: async (values: ProteinFormValues) => {
      const entry: ProteinEntry = {
        date: selectedDate,
        grams: Number(values.grams),
        updatedAt: new Date().toISOString(),
      };

      return upsertProteinEntry(entry);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.protein });
    },
  });

  function handleDateChange(date: string) {
    setSelectedDate(date);
    workoutForm.setValue("date", date);
  }

  function applyRecentWeight() {
    if (recentWeight === null) {
      return;
    }

    const currentSets = workoutForm.getValues("sets");
    currentSets.forEach((_, index) => {
      workoutForm.setValue(`sets.${index}.weight`, recentWeight);
    });
  }

  return (
    <main className="min-h-screen bg-[#f7f8f3] text-zinc-950">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-5 px-4 py-5 sm:px-6 lg:px-8">
        <header className="flex flex-col gap-4 rounded-lg border border-zinc-200 bg-white p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex size-11 items-center justify-center rounded-lg bg-emerald-600 text-white">
              <Dumbbell className="size-5" aria-hidden />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-700">
                Workout Log
              </p>
              <h1 className="text-2xl font-bold leading-8">오늘 운동</h1>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <CalendarDays className="size-5 text-zinc-500" aria-hidden />
            <Input
              aria-label="기록 날짜"
              className="w-full sm:w-44"
              type="date"
              value={selectedDate}
              onChange={(event) => handleDateChange(event.target.value)}
            />
          </div>
        </header>

        <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Metric icon={Flame} label="운동 볼륨" value={`${formatNumber(dayVolume)} kg`} />
          <Metric icon={Activity} label="세트" value={`${daySets} sets`} />
          <Metric icon={Dumbbell} label="운동" value={`${exerciseCount} types`} />
          <Metric icon={Utensils} label="단백질" value={`${formatNumber(selectedProtein)} g`} />
        </section>

        <section className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_390px]">
          <div className="flex flex-col gap-5">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between gap-3">
                <div>
                  <CardTitle>날짜별 기록</CardTitle>
                  <p className="text-sm text-zinc-500">{selectedDate}</p>
                </div>
                <Badge className="border-emerald-200 bg-emerald-50 text-emerald-700">
                  {formatNumber(dayVolume)} kg
                </Badge>
              </CardHeader>
              <CardContent>
                {dateEntries.length === 0 ? (
                  <div className="rounded-md border border-dashed border-zinc-300 bg-zinc-50 px-4 py-8 text-center text-sm text-zinc-500">
                    이 날짜에는 아직 기록이 없습니다.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {dateEntries.map((entry) => (
                      <article
                        key={entry.id}
                        className="rounded-lg border border-zinc-200 bg-white p-4"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <h3 className="text-base font-semibold">
                              {entry.exercise}
                            </h3>
                            <p className="text-sm text-zinc-500">
                              {entry.sets.length}세트 ·{" "}
                              {formatNumber(getEntryVolume(entry))} kg
                            </p>
                          </div>
                          <Button
                            aria-label={`${entry.exercise} 삭제`}
                            size="icon"
                            variant="ghost"
                            onClick={() => deleteWorkoutMutation.mutate(entry.id)}
                          >
                            <Trash2 className="size-4" aria-hidden />
                          </Button>
                        </div>
                        <div className="mt-3 grid gap-2 sm:grid-cols-2">
                          {entry.sets.map((set, index) => (
                            <div
                              key={set.id}
                              className="flex items-center justify-between rounded-md bg-zinc-50 px-3 py-2 text-sm"
                            >
                              <span className="font-medium">{index + 1}세트</span>
                              <span className="text-zinc-600">
                                {formatNumber(set.weight)}kg x {set.reps}회
                              </span>
                            </div>
                          ))}
                        </div>
                        {entry.note ? (
                          <p className="mt-3 rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-900">
                            {entry.note}
                          </p>
                        ) : null}
                      </article>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>최근 7일</CardTitle>
                <LineChart className="size-5 text-sky-600" aria-hidden />
              </CardHeader>
              <CardContent>
                <div className="h-72 w-full">
                  <VolumeChart data={chartData} />
                </div>
              </CardContent>
            </Card>
          </div>

          <aside className="flex flex-col gap-5">
            <Card>
              <CardHeader>
                <CardTitle>운동 추가</CardTitle>
              </CardHeader>
              <CardContent>
                <form
                  className="space-y-4"
                  onSubmit={workoutForm.handleSubmit((values) =>
                    addWorkoutMutation.mutate(values),
                  )}
                >
                  <div className="grid gap-2">
                    <Label htmlFor="workout-date">날짜</Label>
                    <Input
                      id="workout-date"
                      type="date"
                      {...workoutForm.register("date")}
                    />
                    <FormError message={workoutForm.formState.errors.date?.message} />
                  </div>

                  <div className="grid gap-2">
                    <Label htmlFor="exercise">운동</Label>
                    <Input
                      id="exercise"
                      placeholder="벤치프레스"
                      {...workoutForm.register("exercise")}
                    />
                    <div className="flex min-h-8 flex-wrap items-center gap-2">
                      {recentWeight !== null ? (
                        <>
                          <Badge className="border-sky-200 bg-sky-50 text-sky-700">
                            최근 {formatNumber(recentWeight)}kg
                          </Badge>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={applyRecentWeight}
                          >
                            적용
                          </Button>
                        </>
                      ) : null}
                    </div>
                    <FormError
                      message={workoutForm.formState.errors.exercise?.message}
                    />
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between gap-3">
                      <Label>세트</Label>
                      <Badge>{formatNumber(draftVolume)} kg</Badge>
                    </div>
                    <div className="space-y-2">
                      {fields.map((field, index) => (
                        <div
                          key={field.id}
                          className="grid grid-cols-[1fr_1fr_40px] gap-2"
                        >
                          <Input
                            aria-label={`${index + 1}세트 무게`}
                            type="number"
                            min="0"
                            step="0.5"
                            placeholder="kg"
                            {...workoutForm.register(`sets.${index}.weight`, {
                              valueAsNumber: true,
                            })}
                          />
                          <Input
                            aria-label={`${index + 1}세트 횟수`}
                            type="number"
                            min="1"
                            step="1"
                            placeholder="회"
                            {...workoutForm.register(`sets.${index}.reps`, {
                              valueAsNumber: true,
                            })}
                          />
                          <Button
                            aria-label={`${index + 1}세트 삭제`}
                            disabled={fields.length === 1}
                            size="icon"
                            variant="ghost"
                            onClick={() => remove(index)}
                          >
                            <Trash2 className="size-4" aria-hidden />
                          </Button>
                        </div>
                      ))}
                    </div>
                    <FormError
                      message={
                        workoutForm.formState.errors.sets?.message ??
                        workoutForm.formState.errors.sets?.root?.message
                      }
                    />
                    <Button
                      className="w-full"
                      variant="secondary"
                      onClick={() => append({ weight: recentWeight ?? 0, reps: 10 })}
                    >
                      <Plus className="size-4" aria-hidden />
                      세트 추가
                    </Button>
                  </div>

                  <div className="grid gap-2">
                    <Label htmlFor="note">메모</Label>
                    <Input
                      id="note"
                      placeholder="컨디션, RPE, 자세 느낌"
                      {...workoutForm.register("note")}
                    />
                  </div>

                  <Button
                    className="w-full"
                    disabled={addWorkoutMutation.isPending}
                    type="submit"
                  >
                    기록 저장
                  </Button>
                </form>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>단백질</CardTitle>
              </CardHeader>
              <CardContent>
                <form
                  className="space-y-4"
                  onSubmit={proteinForm.handleSubmit((values) =>
                    saveProteinMutation.mutate(values),
                  )}
                >
                  <div className="grid gap-2">
                    <Label htmlFor="protein">섭취량</Label>
                    <div className="grid grid-cols-[1fr_72px] gap-2">
                      <Input
                        id="protein"
                        type="number"
                        min="0"
                        step="1"
                        {...proteinForm.register("grams", {
                          valueAsNumber: true,
                        })}
                      />
                      <Button disabled={saveProteinMutation.isPending} type="submit">
                        저장
                      </Button>
                    </div>
                    <FormError
                      message={proteinForm.formState.errors.grams?.message}
                    />
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-medium text-zinc-700">목표 120g</span>
                      <span className="text-zinc-500">
                        {Math.round(proteinProgress)}%
                      </span>
                    </div>
                    <div className="h-2 rounded-full bg-zinc-100">
                      <div
                        className="h-2 rounded-full bg-sky-600 transition-all"
                        style={{ width: `${proteinProgress}%` }}
                      />
                    </div>
                  </div>
                </form>
              </CardContent>
            </Card>
          </aside>
        </section>
      </div>
    </main>
  );
}

type MetricProps = {
  icon: React.ComponentType<{ className?: string; "aria-hidden"?: boolean }>;
  label: string;
  value: string;
};

function Metric({ icon: Icon, label, value }: MetricProps) {
  return (
    <div className="flex min-h-24 items-center gap-3 rounded-lg border border-zinc-200 bg-white p-4 shadow-sm">
      <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-zinc-100 text-zinc-700">
        <Icon className="size-5" aria-hidden />
      </div>
      <div className="min-w-0">
        <p className="text-sm text-zinc-500">{label}</p>
        <p className="truncate text-xl font-bold">{value}</p>
      </div>
    </div>
  );
}

function FormError({ message }: { message?: string }) {
  if (!message) {
    return null;
  }

  return <p className="text-sm text-rose-600">{message}</p>;
}
