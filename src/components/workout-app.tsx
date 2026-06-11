"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import type { User } from "@supabase/supabase-js";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Armchair,
  BicepsFlexed,
  CalendarDays,
  Cable,
  Check,
  ChevronLeft,
  ChevronRight,
  CircleDot,
  ClipboardPenLine,
  Crosshair,
  Dumbbell,
  Footprints,
  Flame,
  Info,
  LineChart,
  ListChecks,
  LogOut,
  Mail,
  MoveHorizontal,
  Plus,
  Repeat2,
  Rows3,
  Save,
  ScanHeart,
  StretchHorizontal,
  Target,
  Timer,
  Trash2,
  Utensils,
  Weight,
  X,
  type LucideIcon,
} from "lucide-react";
import dynamic from "next/dynamic";
import {
  useEffect,
  useMemo,
  useState,
  type ComponentPropsWithoutRef,
  type FormEvent,
} from "react";
import { useFieldArray, useForm, useWatch } from "react-hook-form";
import { z } from "zod";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getSupabaseBrowserClient } from "@/lib/supabase-browser";
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
import { cn } from "@/lib/utils";

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

type CategoryId =
  | "upper"
  | "lower"
  | "back"
  | "chest"
  | "shoulder"
  | "arm"
  | "core"
  | "cardio";

type WorkoutExercise = {
  name: string;
  category: Exclude<CategoryId, "upper">;
  icon: LucideIcon;
  kind?: "strength" | "treadmill";
  tips: string[];
};

const VolumeChart = dynamic(
  () => import("@/components/volume-chart").then((mod) => mod.VolumeChart),
  {
    ssr: false,
    loading: () => <div className="h-56 rounded-md bg-zinc-50" />,
  },
);

const queryKeys = {
  workouts: ["workouts"],
  protein: ["protein"],
};

const HYDRATION_DATE = "2000-01-03";
const EXERCISES_PER_PAGE = 8;
const REP_OPTIONS = Array.from({ length: 30 }, (_, index) => index + 1);
const TREADMILL_DURATION_OPTIONS = [10, 15, 20, 25, 30, 35, 40, 45, 50, 60];
const TREADMILL_INCLINE_OPTIONS = Array.from({ length: 16 }, (_, index) => index);
const TREADMILL_SPEED_OPTIONS = Array.from(
  { length: 31 },
  (_, index) => Math.round((3 + index * 0.5) * 10) / 10,
);

const categories: Array<{
  id: CategoryId;
  label: string;
  icon: LucideIcon;
}> = [
  { id: "upper", label: "상체", icon: BicepsFlexed },
  { id: "lower", label: "하체", icon: Footprints },
  { id: "back", label: "등", icon: Rows3 },
  { id: "chest", label: "가슴", icon: Dumbbell },
  { id: "shoulder", label: "어깨", icon: CircleDot },
  { id: "arm", label: "팔", icon: BicepsFlexed },
  { id: "core", label: "코어", icon: ScanHeart },
  { id: "cardio", label: "유산소", icon: Timer },
];

const exercises: WorkoutExercise[] = [
  {
    name: "벤치프레스",
    category: "chest",
    icon: Dumbbell,
    tips: ["견갑을 모으고 가슴을 들어요.", "바는 가슴 중하단으로 내려요.", "발로 바닥을 밀며 몸통을 고정해요."],
  },
  {
    name: "인클라인 덤벨프레스",
    category: "chest",
    icon: Dumbbell,
    tips: ["벤치는 30도 안팎이 좋아요.", "덤벨은 팔꿈치보다 살짝 안쪽에 둬요.", "어깨가 으쓱하지 않게 내려요."],
  },
  {
    name: "체스트프레스",
    category: "chest",
    icon: Crosshair,
    tips: ["손잡이가 가슴 중간 높이에 오게 맞춰요.", "등과 엉덩이를 패드에 붙여요.", "팔꿈치를 완전히 잠그지 말고 밀어요."],
  },
  {
    name: "랫풀다운",
    category: "back",
    icon: StretchHorizontal,
    tips: ["가슴을 세우고 바를 쇄골 쪽으로 당겨요.", "팔보다 팔꿈치를 아래로 내린다고 생각해요.", "반동 없이 광배가 늘어나는 느낌을 확인해요."],
  },
  {
    name: "시티드로우",
    category: "back",
    icon: Rows3,
    tips: ["허리를 세우고 몸통 각도를 유지해요.", "손잡이를 배꼽 쪽으로 당겨요.", "어깨가 앞으로 말리지 않게 마무리해요."],
  },
  {
    name: "체스트서포티드 로우",
    category: "back",
    icon: Armchair,
    tips: ["가슴을 패드에 단단히 붙여요.", "팔꿈치를 뒤로 보낸다는 느낌으로 당겨요.", "상체 반동 없이 등으로만 움직여요."],
  },
  {
    name: "케이블 암풀다운",
    category: "back",
    icon: Cable,
    tips: ["팔꿈치를 살짝 굽힌 각도를 유지해요.", "손을 허벅지 쪽으로 끌어내려요.", "광배가 접히는 느낌에서 잠깐 멈춰요."],
  },
  {
    name: "어시스트 풀업",
    category: "back",
    icon: StretchHorizontal,
    tips: ["가슴을 바 쪽으로 올린다고 생각해요.", "턱만 들지 말고 팔꿈치를 아래로 당겨요.", "내려갈 때도 천천히 버티며 늘려요."],
  },
  {
    name: "머신로우",
    category: "back",
    icon: Rows3,
    tips: ["손잡이 높이를 명치 근처로 맞춰요.", "어깨를 먼저 내리고 당겨요.", "끝에서 등을 조인 뒤 천천히 돌아가요."],
  },
  {
    name: "원암 케이블로우",
    category: "back",
    icon: Cable,
    tips: ["골반과 몸통이 돌아가지 않게 잡아요.", "팔꿈치를 옆구리 뒤로 보낸다고 생각해요.", "좌우 자극 차이를 천천히 맞춰요."],
  },
  {
    name: "숄더프레스",
    category: "shoulder",
    icon: Dumbbell,
    tips: ["허리를 과하게 꺾지 않게 복부에 힘을 줘요.", "팔꿈치는 손목 바로 아래에 둬요.", "머리 위로 밀되 어깨 통증은 피하세요."],
  },
  {
    name: "사이드레터럴레이즈",
    category: "shoulder",
    icon: MoveHorizontal,
    tips: ["팔꿈치를 살짝 굽히고 옆으로 들어요.", "승모근이 올라가지 않게 어깨를 낮춰요.", "가벼운 무게로 천천히 버티는 게 좋아요."],
  },
  {
    name: "스쿼트",
    category: "lower",
    icon: Footprints,
    tips: ["발 전체로 바닥을 밀어요.", "무릎은 발끝 방향으로 자연스럽게 보내요.", "허리가 말리기 전 깊이까지만 내려가요."],
  },
  {
    name: "데드리프트",
    category: "back",
    icon: Weight,
    tips: ["바를 몸 가까이에 붙여요.", "등을 둥글게 말지 말고 복압을 잡아요.", "허리로 들기보다 바닥을 민다고 생각해요."],
  },
  {
    name: "레그프레스",
    category: "lower",
    icon: Footprints,
    tips: ["엉덩이가 말리지 않는 깊이까지만 내려요.", "무릎은 발끝 방향과 맞춰요.", "무릎을 끝까지 잠그지 말고 밀어요."],
  },
  {
    name: "레그익스텐션",
    category: "lower",
    icon: MoveHorizontal,
    tips: ["무릎 축이 머신 축과 맞게 앉아요.", "끝에서 허벅지 앞쪽을 1초 조여요.", "내릴 때 툭 떨어뜨리지 말고 버텨요."],
  },
  {
    name: "시티드 레그컬",
    category: "lower",
    icon: Repeat2,
    tips: ["무릎 뒤쪽이 패드와 편하게 맞게 조절해요.", "발목보다 뒤꿈치를 끌어당긴다고 생각해요.", "햄스트링이 늘어날 때 천천히 돌아가요."],
  },
  {
    name: "힙어브덕션",
    category: "lower",
    icon: MoveHorizontal,
    tips: ["골반이 흔들리지 않게 앉아요.", "무릎보다 엉덩이 옆으로 민다고 생각해요.", "벌린 상태에서 잠깐 멈춰 자극을 확인해요."],
  },
  {
    name: "바벨컬",
    category: "arm",
    icon: BicepsFlexed,
    tips: ["팔꿈치를 몸 옆에 고정해요.", "상체 반동 없이 팔로만 올려요.", "내릴 때 이두가 늘어나는 느낌을 살려요."],
  },
  {
    name: "삼두 푸쉬다운",
    category: "arm",
    icon: Cable,
    tips: ["팔꿈치를 옆구리에 붙여요.", "손보다 팔꿈치 아래를 펴는 느낌으로 내려요.", "끝에서 삼두를 조이고 천천히 올라와요."],
  },
  {
    name: "플랭크",
    category: "core",
    icon: Timer,
    tips: ["머리부터 발뒤꿈치까지 일직선을 만들어요.", "허리가 꺾이지 않게 배와 엉덩이에 힘을 줘요.", "시간보다 자세가 무너지지 않는 게 먼저예요."],
  },
];

const weekdayLabels = ["일", "월", "화", "수", "목", "금", "토"];

exercises.push({
  name: "런닝머신",
  category: "cardio",
  icon: Timer,
  kind: "treadmill",
  tips: [
    "처음 3분은 가볍게 워밍업하고 기록을 시작해요.",
    "경사도와 속도는 숨이 차지만 자세가 무너지지 않는 선에서 맞춰요.",
    "마지막 2분은 속도를 낮춰 심박을 천천히 내려요.",
  ],
});

function createId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function getInitialWeight(weight?: number | null) {
  return typeof weight === "number" && weight > 0
    ? weight
    : ("" as unknown as number);
}

function createDefaultSets(
  weight?: number | null,
  options?: { allowZeroWeight?: boolean },
): WorkoutFormValues["sets"] {
  const initialWeight = options?.allowZeroWeight ? 0 : getInitialWeight(weight);

  return Array.from({ length: 4 }, () => ({ weight: initialWeight, reps: 10 }));
}

function getLastSevenDays(selectedDate: string) {
  const base = new Date(`${selectedDate}T00:00:00`);

  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date(base);
    date.setDate(base.getDate() - (6 - index));
    return toDateKey(date);
  });
}

function getWeekDays(selectedDate: string) {
  const base = new Date(`${selectedDate}T00:00:00`);
  const start = new Date(base);
  start.setDate(base.getDate() - base.getDay());

  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date(start);
    date.setDate(start.getDate() + index);

    return {
      dateKey: toDateKey(date),
      dayLabel: weekdayLabels[date.getDay()],
      dayNumber: date.getDate(),
    };
  });
}

function addMonths(dateKey: string, amount: number) {
  const date = new Date(`${dateKey}T00:00:00`);
  date.setMonth(date.getMonth() + amount, 1);
  return toDateKey(date);
}

function getMonthLabel(dateKey: string) {
  const date = new Date(`${dateKey}T00:00:00`);

  return `${date.getFullYear()}년 ${date.getMonth() + 1}월`;
}

function getMonthCalendarDays(monthDateKey: string) {
  const monthDate = new Date(`${monthDateKey}T00:00:00`);
  const monthStart = new Date(monthDate.getFullYear(), monthDate.getMonth(), 1);
  const gridStart = new Date(monthStart);
  gridStart.setDate(monthStart.getDate() - monthStart.getDay());

  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(gridStart);
    date.setDate(gridStart.getDate() + index);

    return {
      dateKey: toDateKey(date),
      dayNumber: date.getDate(),
      isCurrentMonth: date.getMonth() === monthStart.getMonth(),
    };
  });
}

function formatRecordDate(dateKey: string) {
  const date = new Date(`${dateKey}T00:00:00`);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}.${month}.${day} (${weekdayLabels[date.getDay()]})`;
}

function formatMonthDay(dateKey: string) {
  const date = new Date(`${dateKey}T00:00:00`);

  return `${date.getMonth() + 1}월 ${date.getDate()}일`;
}

export function WorkoutApp() {
  const queryClient = useQueryClient();
  const [isClientReady, setIsClientReady] = useState(false);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [authUser, setAuthUser] = useState<User | null>(null);
  const [authMode, setAuthMode] = useState<"signin" | "signup">("signin");
  const [authEmail, setAuthEmail] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [authError, setAuthError] = useState<string | null>(null);
  const [authNotice, setAuthNotice] = useState<string | null>(null);
  const [isAuthSubmitting, setIsAuthSubmitting] = useState(false);
  const [proteinInput, setProteinInput] = useState("");
  const [proteinInputError, setProteinInputError] = useState<string | null>(
    null,
  );
  const [todayDate, setTodayDate] = useState(HYDRATION_DATE);
  const [selectedDate, setSelectedDate] = useState(HYDRATION_DATE);
  const [selectedCategory, setSelectedCategory] =
    useState<CategoryId>("upper");
  const [exercisePage, setExercisePage] = useState(0);
  const [exerciseTouchStart, setExerciseTouchStart] = useState<number | null>(
    null,
  );
  const [tipExercise, setTipExercise] = useState<WorkoutExercise | null>(null);
  const [detailEntry, setDetailEntry] = useState<WorkoutEntry | null>(null);
  const [isSummaryOpen, setIsSummaryOpen] = useState(false);
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);
  const [visibleMonth, setVisibleMonth] = useState(HYDRATION_DATE);
  const [treadmillDuration, setTreadmillDuration] = useState(30);
  const [treadmillIncline, setTreadmillIncline] = useState(0);
  const [treadmillSpeed, setTreadmillSpeed] = useState(6);

  const workoutsQuery = useQuery({
    queryKey: queryKeys.workouts,
    enabled: isClientReady && isAuthReady && Boolean(authUser),
    queryFn: loadWorkoutEntries,
  });

  const proteinQuery = useQuery({
    queryKey: queryKeys.protein,
    enabled: isClientReady && isAuthReady && Boolean(authUser),
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
      sets: createDefaultSets(),
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

  useEffect(() => {
    const today = toDateKey();

    setTodayDate(today);
    setSelectedDate(today);
    setVisibleMonth(today);
    workoutForm.setValue("date", today);
    setIsClientReady(true);
  }, [workoutForm]);

  useEffect(() => {
    let isMounted = true;
    let unsubscribe: (() => void) | undefined;

    async function loadSession() {
      try {
        const supabase = await getSupabaseBrowserClient();
        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (!isMounted) {
          return;
        }

        setAuthUser(session?.user ?? null);

        const { data } = supabase.auth.onAuthStateChange((_event, session) => {
          setAuthUser(session?.user ?? null);
          queryClient.removeQueries({ queryKey: queryKeys.workouts });
          queryClient.removeQueries({ queryKey: queryKeys.protein });
        });

        unsubscribe = () => data.subscription.unsubscribe();
      } catch (error) {
        if (isMounted) {
          setAuthError(
            error instanceof Error
              ? error.message
              : "로그인 설정을 불러오지 못했습니다.",
          );
        }
      } finally {
        if (isMounted) {
          setIsAuthReady(true);
        }
      }
    }

    loadSession();

    return () => {
      isMounted = false;
      unsubscribe?.();
    };
  }, [queryClient]);

  useEffect(() => {
    setExercisePage(0);
  }, [selectedCategory]);

  useEffect(() => {
    if (!isCalendarOpen && !tipExercise && !detailEntry && !isSummaryOpen) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    const previousPaddingRight = document.body.style.paddingRight;
    const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;

    document.body.style.overflow = "hidden";
    if (scrollbarWidth > 0) {
      document.body.style.paddingRight = `${scrollbarWidth}px`;
    }

    return () => {
      document.body.style.overflow = previousOverflow;
      document.body.style.paddingRight = previousPaddingRight;
    };
  }, [detailEntry, isCalendarOpen, isSummaryOpen, tipExercise]);

  const watchedExercise =
    useWatch({
      control: workoutForm.control,
      name: "exercise",
    }) ?? "";
  const watchedExerciseConfig = exercises.find(
    (exercise) => exercise.name === watchedExercise,
  );
  const isTreadmillSelected = watchedExerciseConfig?.kind === "treadmill";

  useEffect(() => {
    if (isTreadmillSelected) {
      workoutForm.setValue("sets", createDefaultSets(0, { allowZeroWeight: true }));
    }
  }, [isTreadmillSelected, workoutForm]);

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
  const workoutDateSet = useMemo(
    () => new Set(workouts.map((entry) => entry.date)),
    [workouts],
  );
  const weekDays = useMemo(() => getWeekDays(selectedDate), [selectedDate]);
  const dayVolume = getDateVolume(workouts, selectedDate);
  const daySets = dateEntries.reduce((sum, entry) => sum + entry.sets.length, 0);
  const exerciseCount = new Set(dateEntries.map((entry) => entry.exercise)).size;
  const proteinGoal = 120;
  const proteinProgress = Math.min(100, (selectedProtein / proteinGoal) * 100);
  const recordProgress = Math.round(
    (((daySets > 0 ? 1 : 0) + (selectedProtein > 0 ? 1 : 0)) / 2) * 100,
  );
  const summaryTitle =
    selectedDate === todayDate ? "오늘 요약" : `${formatMonthDay(selectedDate)} 요약`;
  const filteredExercises = useMemo(() => {
    if (selectedCategory === "upper") {
      return exercises.filter(
        (exercise) =>
          exercise.category !== "lower" &&
          exercise.category !== "core" &&
          exercise.category !== "cardio",
      );
    }

    return exercises.filter((exercise) => exercise.category === selectedCategory);
  }, [selectedCategory]);
  const exercisePageCount = Math.max(
    1,
    Math.ceil(filteredExercises.length / EXERCISES_PER_PAGE),
  );
  const pagedExercises = useMemo(
    () =>
      filteredExercises.slice(
        exercisePage * EXERCISES_PER_PAGE,
        exercisePage * EXERCISES_PER_PAGE + EXERCISES_PER_PAGE,
      ),
    [exercisePage, filteredExercises],
  );

  useEffect(() => {
    setExercisePage((page) => Math.min(page, exercisePageCount - 1));
  }, [exercisePageCount]);

  const recentEntries = useMemo(() => workouts.slice(0, 4), [workouts]);

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
        sets: isTreadmillSelected
          ? []
          : values.sets.map((set) => ({
              id: createId(),
              weight: Number(set.weight),
              reps: Number(set.reps),
            })),
        cardio: isTreadmillSelected
          ? {
              durationMinutes: treadmillDuration,
              incline: treadmillIncline,
              speed: treadmillSpeed,
            }
          : undefined,
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
        sets: createDefaultSets(recentWeight ?? 0),
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
    mutationFn: async (entry: ProteinEntry) => upsertProteinEntry(entry),
    onMutate: async (entry) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.protein });
      const previous =
        queryClient.getQueryData<ProteinEntry[]>(queryKeys.protein);

      queryClient.setQueryData<ProteinEntry[]>(
        queryKeys.protein,
        (current = []) =>
          [entry, ...current.filter((item) => item.date !== entry.date)].sort(
            (a, b) => b.date.localeCompare(a.date),
          ),
      );
      setProteinInput("");

      return { previous };
    },
    onError: (_error, _entry, context) => {
      if (context?.previous) {
        queryClient.setQueryData(queryKeys.protein, context.previous);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.protein });
    },
  });

  const storageError =
    workoutsQuery.error ??
    proteinQuery.error ??
    addWorkoutMutation.error ??
    deleteWorkoutMutation.error ??
    saveProteinMutation.error;

  function handleProteinSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = proteinInput.trim();
    const grams = Number(trimmed);

    if (!trimmed || !Number.isFinite(grams) || grams < 0) {
      setProteinInputError("단백질 섭취량을 입력해 주세요.");
      return;
    }

    setProteinInputError(null);
    saveProteinMutation.mutate({
      date: selectedDate,
      grams,
      updatedAt: new Date().toISOString(),
    });
  }

  async function handleAuthSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setAuthError(null);
    setAuthNotice(null);
    setIsAuthSubmitting(true);

    try {
      const supabase = await getSupabaseBrowserClient();
      const credentials = {
        email: authEmail.trim(),
        password: authPassword,
      };
      const { data, error } =
        authMode === "signup"
          ? await supabase.auth.signUp({
              ...credentials,
              options: {
                emailRedirectTo: `${window.location.origin}/auth/callback`,
              },
            })
          : await supabase.auth.signInWithPassword(credentials);

      if (error) {
        setAuthError(error.message);
        return;
      }

      if (authMode === "signup" && !data.session) {
        setAuthNotice("가입 확인 메일을 보냈습니다. 메일 인증 후 로그인해 주세요.");
        return;
      }

      setAuthNotice(null);
    } finally {
      setIsAuthSubmitting(false);
    }
  }

  async function handleSignOut() {
    const supabase = await getSupabaseBrowserClient();
    await supabase.auth.signOut();
    setAuthUser(null);
    queryClient.removeQueries({ queryKey: queryKeys.workouts });
    queryClient.removeQueries({ queryKey: queryKeys.protein });
  }

  function handleDateChange(date: string) {
    setSelectedDate(date);
    setVisibleMonth(date);
    workoutForm.setValue("date", date, { shouldDirty: true });
  }

  function openCalendar() {
    setVisibleMonth(selectedDate);
    setIsCalendarOpen(true);
  }

  function selectExercise(name: string) {
    const exercise = exercises.find((item) => item.name === name);
    const weight = getRecentWeightForExercise(workouts, name) ?? 0;

    workoutForm.setValue("exercise", name, {
      shouldDirty: true,
      shouldValidate: true,
    });
    workoutForm.setValue("sets", createDefaultSets(weight, {
      allowZeroWeight: exercise?.kind === "treadmill",
    }), {
      shouldDirty: true,
      shouldValidate: true,
    });
  }

  function handleExerciseTouchEnd(clientX: number) {
    if (exerciseTouchStart === null) {
      return;
    }

    const distance = clientX - exerciseTouchStart;

    setExerciseTouchStart(null);
    if (Math.abs(distance) < 48) {
      return;
    }

    setExercisePage((page) => {
      if (distance < 0) {
        return Math.min(page + 1, exercisePageCount - 1);
      }

      return Math.max(page - 1, 0);
    });
  }

  function adjustSetWeight(index: number, amount: number) {
    const currentWeight = Number(
      workoutForm.getValues(`sets.${index}.weight`) || 0,
    );

    workoutForm.setValue(
      `sets.${index}.weight`,
      Math.max(0, currentWeight + amount),
      {
        shouldDirty: true,
        shouldValidate: true,
      },
    );
  }

  if (!isClientReady) {
    return <WorkoutAppLoading />;
  }

  if (!isAuthReady) {
    return <WorkoutAppLoading />;
  }

  if (!authUser) {
    return (
      <AuthScreen
        email={authEmail}
        error={authError}
        isSubmitting={isAuthSubmitting}
        mode={authMode}
        notice={authNotice}
        password={authPassword}
        onEmailChange={setAuthEmail}
        onModeChange={(mode) => {
          setAuthMode(mode);
          setAuthError(null);
          setAuthNotice(null);
        }}
        onPasswordChange={setAuthPassword}
        onSubmit={handleAuthSubmit}
      />
    );
  }

  return (
    <main className="min-h-screen bg-[#f2f3ef] text-zinc-950">
      <div className="mx-auto flex min-h-screen w-full max-w-[520px] flex-col gap-3 bg-[#fafaf7] px-3 py-4 shadow-[0_20px_60px_rgba(15,23,42,0.08)] sm:px-5 md:my-6 md:min-h-0 md:rounded-lg md:border md:border-zinc-200">
        <header className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex size-12 shrink-0 items-center justify-center rounded-lg bg-zinc-950 text-white shadow-sm">
              <Dumbbell className="size-6" aria-hidden />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase text-zinc-500">
                Workout Log
              </p>
              <h1 className="truncate text-2xl font-bold leading-8">
                오늘 운동
              </h1>
            </div>
          </div>

          <button
            aria-label="달력 열기"
            className="flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-lg border border-zinc-200 bg-white text-zinc-900 shadow-sm transition-colors hover:bg-zinc-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-950"
            type="button"
            onClick={openCalendar}
          >
            <CalendarDays className="size-5" aria-hidden />
          </button>
        </header>

        <div className="flex items-center justify-between gap-3 rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm shadow-sm">
          <span className="min-w-0 truncate font-medium text-zinc-600">
            {authUser.email}
          </span>
          <button
            className="flex shrink-0 items-center gap-1 rounded-md px-2 py-1.5 font-semibold text-zinc-900 transition-colors hover:bg-zinc-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-950"
            type="button"
            onClick={handleSignOut}
          >
            <LogOut className="size-4" aria-hidden />
            로그아웃
          </button>
        </div>

        <section
          aria-label="주간 날짜"
          className="rounded-lg border border-zinc-200 bg-white p-2 shadow-sm"
        >
          <div className="grid grid-cols-7 gap-1">
            {weekDays.map((day) => {
              const isSelected = day.dateKey === selectedDate;
              const hasRecord = workoutDateSet.has(day.dateKey);

              return (
                <button
                  key={day.dateKey}
                  className="flex min-h-20 flex-col items-center justify-center rounded-md px-1 py-2 text-center transition-colors hover:bg-zinc-50"
                  type="button"
                  onClick={() => handleDateChange(day.dateKey)}
                >
                  <span
                    className={cn(
                      "text-xs font-semibold text-zinc-500",
                      isSelected && "text-zinc-950",
                    )}
                  >
                    {day.dayLabel}
                  </span>
                  <span
                    className={cn(
                      "mt-1 flex size-10 items-center justify-center rounded-full text-lg font-semibold text-zinc-600",
                      hasRecord && !isSelected && "bg-zinc-100 text-zinc-950",
                      isSelected && "bg-zinc-950 text-white shadow-sm",
                    )}
                  >
                    {day.dayNumber}
                  </span>
                  <span
                    className={cn(
                      "mt-1 size-1.5 rounded-full",
                      isSelected
                        ? "bg-zinc-950"
                        : hasRecord
                          ? "bg-zinc-300"
                          : "bg-transparent",
                    )}
                  />
                </button>
              );
            })}
          </div>
        </section>

        {storageError ? <DatabaseErrorPanel error={storageError} /> : null}

        <Panel>
          <div className="mb-4 flex items-center justify-between gap-3">
            <h2 className="text-lg font-bold">{summaryTitle}</h2>
            <Badge className="border-zinc-200 bg-zinc-100 text-zinc-800">
              기록 {recordProgress}%
            </Badge>
          </div>

          <div
            className="grid cursor-pointer grid-cols-2 gap-2 min-[440px]:grid-cols-4"
            role="button"
            tabIndex={0}
            onClick={() => setIsSummaryOpen(true)}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") {
                setIsSummaryOpen(true);
              }
            }}
          >
            <SummaryMetric
              icon={Flame}
              label="운동 볼륨"
              value={formatNumber(dayVolume)}
              unit="kg"
            />
            <SummaryMetric
              icon={ListChecks}
              label="세트"
              value={daySets}
              unit="sets"
            />
            <SummaryMetric
              icon={Target}
              label="운동 종류"
              value={exerciseCount}
              unit="types"
            />
            <SummaryMetric
              icon={Utensils}
              label="단백질"
              value={formatNumber(selectedProtein)}
              unit="g"
            />
          </div>

          <form
            className="mt-3 grid grid-cols-[1fr_96px] items-end gap-2 rounded-md bg-zinc-50 p-3"
            onSubmit={handleProteinSubmit}
          >
            <div className="grid gap-1.5">
              <div className="flex items-center justify-between gap-2">
                <Label htmlFor="protein">단백질 섭취량</Label>
                <span className="text-xs font-medium text-zinc-500">
                  목표 {proteinGoal}g · {Math.round(proteinProgress)}%
                </span>
              </div>
              <Input
                id="protein"
                className="h-11 border-zinc-200 bg-white text-base focus:border-zinc-950 focus:ring-zinc-100"
                inputMode="numeric"
                min="0"
                pattern="[0-9]*"
                step="1"
                type="number"
                value={proteinInput}
                onChange={(event) => {
                  setProteinInput(event.target.value);
                  setProteinInputError(null);
                }}
              />
            </div>
            <Button
              className="h-11"
              disabled={saveProteinMutation.isPending}
              type="submit"
              variant="secondary"
            >
              저장
            </Button>
            <FormError message={proteinInputError ?? undefined} />
          </form>
        </Panel>

        <Panel>
          <div className="mb-4 flex items-center justify-between gap-3">
            <h2 className="text-lg font-bold">운동 빠른 선택</h2>
            {recentWeight !== null ? (
              <Badge className="border-zinc-200 bg-zinc-100 text-zinc-700">
                최근 {formatNumber(recentWeight)}kg
              </Badge>
            ) : null}
          </div>

          <div className="-mx-1 mb-4 flex gap-2 overflow-x-auto px-1 pb-1 scrollbar-none">
            {categories.map((category) => {
              const Icon = category.icon;
              const isSelected = category.id === selectedCategory;

              return (
                <button
                  key={category.id}
                  className={cn(
                    "flex h-11 shrink-0 items-center gap-2 rounded-full border px-4 text-sm font-semibold transition-colors",
                    isSelected
                      ? "border-zinc-950 bg-zinc-950 text-white"
                      : "border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50",
                  )}
                  type="button"
                  onClick={() => setSelectedCategory(category.id)}
                >
                  <Icon className="size-4" aria-hidden />
                  {category.label}
                </button>
              );
            })}
          </div>

          <div
            className="grid touch-pan-y grid-cols-2 gap-2"
            onTouchStart={(event) =>
              setExerciseTouchStart(event.changedTouches[0]?.clientX ?? null)
            }
            onTouchCancel={() => setExerciseTouchStart(null)}
            onTouchEnd={(event) =>
              handleExerciseTouchEnd(event.changedTouches[0]?.clientX ?? 0)
            }
          >
            {pagedExercises.map((exercise) => {
              const isSelected = watchedExercise === exercise.name;

              return (
                <article
                  key={exercise.name}
                  className={cn(
                    "relative min-h-32 rounded-lg border bg-white p-3 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md",
                    isSelected
                      ? "border-zinc-950 ring-2 ring-zinc-950/10"
                      : "border-zinc-200",
                  )}
                >
                  {isSelected ? (
                    <span className="absolute left-2 top-2 z-10 flex size-7 items-center justify-center rounded-full bg-zinc-950 text-white">
                      <Check className="size-4" aria-hidden />
                    </span>
                  ) : null}
                  <button
                    aria-label={`${exercise.name} 팁 보기`}
                    className="absolute right-2 top-2 z-10 flex size-8 items-center justify-center rounded-full border border-zinc-200 bg-white/90 text-zinc-700 shadow-sm backdrop-blur transition-colors hover:bg-zinc-950 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-950"
                    type="button"
                    onClick={() => setTipExercise(exercise)}
                  >
                    <Info className="size-4" aria-hidden />
                  </button>
                  <button
                    className="block h-full w-full text-left focus-visible:outline-none"
                    type="button"
                    onClick={() => selectExercise(exercise.name)}
                  >
                    <ExerciseVisual active={isSelected} icon={exercise.icon} />
                    <span className="mt-3 block min-h-10 text-center text-sm font-semibold leading-5">
                      {exercise.name}
                    </span>
                  </button>
                </article>
              );
            })}
          </div>
          {exercisePageCount > 1 ? (
            <div className="mt-3 flex items-center justify-center gap-2">
              <button
                aria-label="이전 운동 페이지"
                className="flex size-9 items-center justify-center rounded-full border border-zinc-200 bg-white text-zinc-700 disabled:opacity-40"
                disabled={exercisePage === 0}
                type="button"
                onClick={() => setExercisePage((page) => Math.max(page - 1, 0))}
              >
                <ChevronLeft className="size-4" aria-hidden />
              </button>
              <div className="flex items-center gap-1.5">
                {Array.from({ length: exercisePageCount }).map((_, index) => (
                  <button
                    key={index}
                    aria-label={`${index + 1}번 운동 페이지`}
                    className={cn(
                      "h-2 rounded-full transition-all",
                      index === exercisePage
                        ? "w-5 bg-zinc-950"
                        : "w-2 bg-zinc-300",
                    )}
                    type="button"
                    onClick={() => setExercisePage(index)}
                  />
                ))}
              </div>
              <button
                aria-label="다음 운동 페이지"
                className="flex size-9 items-center justify-center rounded-full border border-zinc-200 bg-white text-zinc-700 disabled:opacity-40"
                disabled={exercisePage >= exercisePageCount - 1}
                type="button"
                onClick={() =>
                  setExercisePage((page) =>
                    Math.min(page + 1, exercisePageCount - 1),
                  )
                }
              >
                <ChevronRight className="size-4" aria-hidden />
              </button>
            </div>
          ) : null}
        </Panel>

        <Panel>
          <form
            onSubmit={workoutForm.handleSubmit((values) =>
              addWorkoutMutation.mutate(values),
            )}
          >
            <input type="hidden" {...workoutForm.register("date")} />

            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="truncate text-xl font-bold">
                    {watchedExercise || "운동 선택"}
                  </h2>
                  <Badge className="border-zinc-200 bg-zinc-100 text-zinc-700">
                    기본 {fields.length}세트 x 10회
                  </Badge>
                </div>
                <p className="mt-1 text-sm text-zinc-500">
                  {formatNumber(draftVolume)} kg 예상 볼륨
                </p>
              </div>
              <ClipboardPenLine className="mt-1 size-5 shrink-0 text-zinc-500" />
            </div>

            <div className="mt-4 grid gap-2">
              <Label htmlFor="exercise">운동명</Label>
              <Input
                id="exercise"
                className="h-11 bg-zinc-50 text-base focus:border-zinc-950 focus:ring-zinc-100"
                placeholder="직접 입력"
                {...workoutForm.register("exercise")}
              />
              <FormError message={workoutForm.formState.errors.exercise?.message} />
            </div>

            {isTreadmillSelected ? (
              <TreadmillFields
                duration={treadmillDuration}
                incline={treadmillIncline}
                speed={treadmillSpeed}
                onDurationChange={setTreadmillDuration}
                onInclineChange={setTreadmillIncline}
                onSpeedChange={setTreadmillSpeed}
              />
            ) : null}

            <div className={cn("mt-4 space-y-3", isTreadmillSelected && "hidden")}>
              {fields.map((field, index) => (
                <div
                  key={field.id}
                  className="rounded-lg border border-zinc-100 bg-zinc-50 p-2.5"
                >
                  <div className="grid grid-cols-[2.25rem_4.5rem_minmax(0,1fr)] items-center gap-2">
                    <span className="flex size-8 items-center justify-center rounded-full bg-zinc-200 text-sm font-bold text-zinc-900">
                      {index + 1}
                    </span>

                    <label className="flex h-12 items-center justify-center gap-1 rounded-md bg-white px-2 text-sm text-zinc-700 shadow-sm">
                      <select
                        aria-label={`${index + 1}세트 횟수`}
                        className="h-full w-12 bg-transparent text-center text-base font-semibold outline-none"
                        value={Number(watchedSets[index]?.reps ?? 10)}
                        onChange={(event) =>
                          workoutForm.setValue(
                            `sets.${index}.reps`,
                            Number(event.target.value),
                            {
                              shouldDirty: true,
                              shouldValidate: true,
                            },
                          )
                        }
                      >
                        {REP_OPTIONS.map((reps) => (
                          <option key={reps} value={reps}>
                            {reps}
                          </option>
                        ))}
                      </select>
                      <input
                        aria-label={`${index + 1}세트 횟수`}
                        className="hidden"
                        min="1"
                        step="1"
                        type="number"
                        {...workoutForm.register(`sets.${index}.reps`, {
                          valueAsNumber: true,
                        })}
                      />
                      회
                    </label>

                    <label className="flex h-12 items-center rounded-md border border-zinc-300 bg-white px-3 shadow-sm focus-within:border-zinc-950 focus-within:ring-2 focus-within:ring-zinc-100">
                      <input
                        aria-label={`${index + 1}세트 무게`}
                        className="min-w-0 flex-1 bg-transparent text-center text-lg font-bold text-zinc-950 outline-none"
                        inputMode="decimal"
                        min="0"
                        pattern="[0-9]*[.,]?[0-9]*"
                        step="0.5"
                        type="number"
                        {...workoutForm.register(`sets.${index}.weight`, {
                          valueAsNumber: true,
                        })}
                      />
                      <span className="text-sm font-medium text-zinc-500">kg</span>
                    </label>
                  </div>

                  <div className="mt-2 grid grid-cols-[1fr_1fr_40px] gap-2 pl-10">
                    <button
                      className="h-10 rounded-md border border-zinc-200 bg-white text-sm font-semibold text-zinc-800 shadow-sm transition-colors hover:bg-zinc-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-950"
                      type="button"
                      onClick={() => adjustSetWeight(index, 2.5)}
                    >
                      +2.5kg
                    </button>
                    <button
                      className="h-10 rounded-md border border-zinc-200 bg-white text-sm font-semibold text-zinc-800 shadow-sm transition-colors hover:bg-zinc-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-950"
                      type="button"
                      onClick={() => adjustSetWeight(index, 5)}
                    >
                      +5kg
                    </button>
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
              className={cn("mt-3 w-full", isTreadmillSelected && "hidden")}
              variant="secondary"
              onClick={() => append({ weight: getInitialWeight(recentWeight), reps: 10 })}
            >
              <Plus className="size-4" aria-hidden />
              세트 추가
            </Button>

            <div className="mt-4 grid gap-2">
              <Label htmlFor="note">메모</Label>
              <Input
                id="note"
                className="h-12 bg-zinc-50 text-base focus:border-zinc-950 focus:ring-zinc-100"
                placeholder="컨디션, RPE, 자세 느낌 등을 메모해보세요"
                {...workoutForm.register("note")}
              />
            </div>

            <Button
              className="mt-4 h-14 w-full text-base"
              disabled={addWorkoutMutation.isPending}
              type="submit"
            >
              <Save className="size-5" aria-hidden />
              기록 저장
            </Button>
          </form>
        </Panel>

        <Panel>
          <div className="mb-4 flex items-center justify-between gap-3">
            <h2 className="text-lg font-bold">최근 기록</h2>
            <span className="flex items-center gap-1 text-sm font-medium text-zinc-500">
              전체 {workouts.length}개
              <ChevronRight className="size-4" aria-hidden />
            </span>
          </div>

          {recentEntries.length === 0 ? (
            <div className="rounded-md border border-dashed border-zinc-300 bg-zinc-50 px-4 py-8 text-center text-sm text-zinc-500">
              아직 저장된 운동 기록이 없습니다.
            </div>
          ) : (
            <div className="space-y-2">
              {recentEntries.map((entry) => (
                <article
                  key={entry.id}
                  className="grid cursor-pointer grid-cols-[minmax(0,1fr)_36px] gap-3 rounded-lg border border-zinc-200 bg-white p-3 shadow-sm transition-colors hover:bg-zinc-50"
                  role="button"
                  tabIndex={0}
                  onClick={() => setDetailEntry(entry)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      setDetailEntry(entry);
                    }
                  }}
                >
                  <div className="min-w-0">
                    <time className="text-sm font-medium text-zinc-500">
                      {formatRecordDate(entry.date)}
                    </time>
                    <h3 className="mt-1 truncate text-base font-bold">
                      {entry.exercise}
                    </h3>
                    {entry.cardio ? (
                      <div className="mt-3 grid grid-cols-2 divide-x divide-zinc-200 rounded-md bg-zinc-50 text-sm">
                        <div className="px-3 py-2">
                          <p className="text-xs text-zinc-500">시간</p>
                          <p className="font-semibold">
                            {entry.cardio.durationMinutes}분
                          </p>
                        </div>
                        <div className="px-3 py-2">
                          <p className="text-xs text-zinc-500">속도</p>
                          <p className="font-semibold">
                            {formatNumber(entry.cardio.speed)}km/h
                          </p>
                        </div>
                      </div>
                    ) : null}
                    <div className={cn("mt-3 grid grid-cols-2 divide-x divide-zinc-200 rounded-md bg-zinc-50 text-sm", entry.cardio && "hidden")}>
                      <div className="px-3 py-2">
                        <p className="text-xs text-zinc-500">볼륨</p>
                        <p className="font-semibold">
                          {entry.cardio
                            ? `${entry.cardio.durationMinutes}분`
                            : `${formatNumber(getEntryVolume(entry))} kg`}
                        </p>
                      </div>
                      <div className="px-3 py-2">
                        <p className="text-xs text-zinc-500">세트/회</p>
                        <p className="font-semibold">
                          {entry.sets.length}세트 /{" "}
                          {entry.sets[0]?.reps ?? 0}회
                        </p>
                      </div>
                    </div>
                    {entry.note ? (
                      <p className="mt-2 line-clamp-2 text-sm text-zinc-500">
                        {entry.note}
                      </p>
                    ) : null}
                  </div>

                  <Button
                    aria-label={`${entry.exercise} 삭제`}
                    className="self-center"
                    size="icon"
                    variant="ghost"
                    onClick={(event) => {
                      event.stopPropagation();
                      if (window.confirm(`${entry.exercise} 기록을 삭제할까요?`)) {
                        deleteWorkoutMutation.mutate(entry.id);
                      }
                    }}
                  >
                    <Trash2 className="size-4" aria-hidden />
                  </Button>
                </article>
              ))}
            </div>
          )}
        </Panel>

        <Panel>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-bold">최근 7일</h2>
            <LineChart className="size-5 text-zinc-600" aria-hidden />
          </div>
          <div className="h-56 w-full">
            <VolumeChart data={chartData} />
          </div>
        </Panel>

        {tipExercise ? (
          <ExerciseTipSheet
            exercise={tipExercise}
            onClose={() => setTipExercise(null)}
            onSelect={() => {
              selectExercise(tipExercise.name);
              setTipExercise(null);
            }}
          />
        ) : null}

        {detailEntry ? (
          <WorkoutDetailSheet
            entry={detailEntry}
            onClose={() => setDetailEntry(null)}
          />
        ) : null}

        {isSummaryOpen ? (
          <WorkoutSummarySheet
            date={selectedDate}
            entries={dateEntries}
            protein={selectedProtein}
            title={summaryTitle}
            onClose={() => setIsSummaryOpen(false)}
          />
        ) : null}

        {isCalendarOpen ? (
          <WorkoutCalendarSheet
            selectedDate={selectedDate}
            todayDate={todayDate}
            visibleMonth={visibleMonth}
            workoutDateSet={workoutDateSet}
            onClose={() => setIsCalendarOpen(false)}
            onMonthChange={setVisibleMonth}
            onSelectDate={(date) => {
              handleDateChange(date);
              setIsCalendarOpen(false);
            }}
          />
        ) : null}
      </div>
    </main>
  );
}

type AuthScreenProps = {
  email: string;
  error: string | null;
  isSubmitting: boolean;
  mode: "signin" | "signup";
  notice: string | null;
  password: string;
  onEmailChange: (value: string) => void;
  onModeChange: (mode: "signin" | "signup") => void;
  onPasswordChange: (value: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
};

function AuthScreen({
  email,
  error,
  isSubmitting,
  mode,
  notice,
  password,
  onEmailChange,
  onModeChange,
  onPasswordChange,
  onSubmit,
}: AuthScreenProps) {
  const isSignup = mode === "signup";

  return (
    <main className="min-h-screen bg-[#f2f3ef] text-zinc-950">
      <div className="mx-auto flex min-h-screen w-full max-w-[520px] flex-col justify-center gap-4 bg-[#fafaf7] px-4 py-6 shadow-[0_20px_60px_rgba(15,23,42,0.08)] sm:px-6 md:my-6 md:min-h-0 md:rounded-lg md:border md:border-zinc-200">
        <div className="flex items-center gap-3">
          <div className="flex size-12 shrink-0 items-center justify-center rounded-lg bg-zinc-950 text-white shadow-sm">
            <Dumbbell className="size-6" aria-hidden />
          </div>
          <div>
            <p className="text-xs font-semibold uppercase text-zinc-500">
              Workout Log
            </p>
            <h1 className="text-2xl font-bold leading-8">
              {isSignup ? "회원가입" : "로그인"}
            </h1>
          </div>
        </div>

        <Panel>
          <div className="mb-4 grid grid-cols-2 rounded-lg bg-zinc-100 p-1">
            <button
              className={cn(
                "h-10 rounded-md text-sm font-bold transition-colors",
                !isSignup ? "bg-white text-zinc-950 shadow-sm" : "text-zinc-500",
              )}
              type="button"
              onClick={() => onModeChange("signin")}
            >
              로그인
            </button>
            <button
              className={cn(
                "h-10 rounded-md text-sm font-bold transition-colors",
                isSignup ? "bg-white text-zinc-950 shadow-sm" : "text-zinc-500",
              )}
              type="button"
              onClick={() => onModeChange("signup")}
            >
              회원가입
            </button>
          </div>

          <form className="grid gap-3" onSubmit={onSubmit}>
            <div className="grid gap-1.5">
              <Label htmlFor="auth-email">이메일</Label>
              <div className="relative">
                <Mail
                  className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-zinc-400"
                  aria-hidden
                />
                <Input
                  id="auth-email"
                  autoComplete="email"
                  className="h-12 bg-zinc-50 pl-9 text-base focus:border-zinc-950 focus:ring-zinc-100"
                  inputMode="email"
                  required
                  type="email"
                  value={email}
                  onChange={(event) => onEmailChange(event.target.value)}
                />
              </div>
            </div>

            <div className="grid gap-1.5">
              <Label htmlFor="auth-password">비밀번호</Label>
              <Input
                id="auth-password"
                autoComplete={isSignup ? "new-password" : "current-password"}
                className="h-12 bg-zinc-50 text-base focus:border-zinc-950 focus:ring-zinc-100"
                minLength={6}
                required
                type="password"
                value={password}
                onChange={(event) => onPasswordChange(event.target.value)}
              />
            </div>

            {error ? (
              <div className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-medium text-rose-900">
                {error}
              </div>
            ) : null}

            {notice ? (
              <div className="rounded-md border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm font-medium text-zinc-700">
                {notice}
              </div>
            ) : null}

            <Button className="h-12 text-base" disabled={isSubmitting} type="submit">
              {isSubmitting ? "처리 중..." : isSignup ? "계정 만들기" : "로그인"}
            </Button>
          </form>
        </Panel>
      </div>
    </main>
  );
}

function Panel({
  className,
  ...props
}: ComponentPropsWithoutRef<"section">) {
  return (
    <section
      className={cn(
        "rounded-lg border border-zinc-200 bg-white p-4 shadow-sm",
        className,
      )}
      {...props}
    />
  );
}

type TreadmillFieldsProps = {
  duration: number;
  incline: number;
  speed: number;
  onDurationChange: (value: number) => void;
  onInclineChange: (value: number) => void;
  onSpeedChange: (value: number) => void;
};

function TreadmillFields({
  duration,
  incline,
  speed,
  onDurationChange,
  onInclineChange,
  onSpeedChange,
}: TreadmillFieldsProps) {
  return (
    <div className="mt-4 grid grid-cols-3 gap-2 rounded-lg border border-zinc-100 bg-zinc-50 p-3">
      <TreadmillSelect
        label="시간"
        unit="분"
        value={duration}
        options={TREADMILL_DURATION_OPTIONS}
        onChange={onDurationChange}
      />
      <TreadmillSelect
        label="경사도"
        unit="%"
        value={incline}
        options={TREADMILL_INCLINE_OPTIONS}
        onChange={onInclineChange}
      />
      <TreadmillSelect
        label="속도"
        unit="km/h"
        value={speed}
        options={TREADMILL_SPEED_OPTIONS}
        onChange={onSpeedChange}
      />
    </div>
  );
}

function TreadmillSelect({
  label,
  options,
  unit,
  value,
  onChange,
}: {
  label: string;
  options: number[];
  unit: string;
  value: number;
  onChange: (value: number) => void;
}) {
  return (
    <label className="grid gap-1.5">
      <span className="text-xs font-semibold text-zinc-500">{label}</span>
      <select
        className="h-11 rounded-md border border-zinc-200 bg-white px-2 text-center text-sm font-bold text-zinc-950 shadow-sm outline-none focus:border-zinc-950 focus:ring-2 focus:ring-zinc-100"
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
      >
        {options.map((option) => (
          <option key={option} value={option}>
            {formatNumber(option)} {unit}
          </option>
        ))}
      </select>
    </label>
  );
}

function WorkoutAppLoading() {
  return (
    <main className="min-h-screen bg-[#f2f3ef] text-zinc-950">
      <div className="mx-auto flex min-h-screen w-full max-w-[520px] flex-col gap-3 bg-[#fafaf7] px-3 py-4 shadow-[0_20px_60px_rgba(15,23,42,0.08)] sm:px-5 md:my-6 md:min-h-0 md:rounded-lg md:border md:border-zinc-200">
        <header className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex size-12 shrink-0 items-center justify-center rounded-lg bg-zinc-950 text-white shadow-sm">
              <Dumbbell className="size-6" aria-hidden />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase text-zinc-500">
                Workout Log
              </p>
              <h1 className="truncate text-2xl font-bold leading-8">
                오늘 운동
              </h1>
            </div>
          </div>
          <div className="flex size-11 shrink-0 items-center justify-center rounded-lg border border-zinc-200 bg-white text-zinc-900 shadow-sm">
            <CalendarDays className="size-5" aria-hidden />
          </div>
        </header>

        <section className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm">
          <div className="h-5 w-24 rounded-md bg-zinc-200" />
          <div className="mt-4 grid grid-cols-4 gap-2">
            {Array.from({ length: 4 }).map((_, index) => (
              <div
                key={index}
                className="h-24 rounded-lg bg-zinc-100"
              />
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}

function StorageErrorPanel({ error }: { error: unknown }) {
  const message = error instanceof Error ? error.message : "알 수 없는 오류";

  return (
    <section className="rounded-lg border border-rose-200 bg-rose-50 p-4 text-sm text-rose-950 shadow-sm">
      <p className="font-bold">Supabase 연결을 확인해 주세요.</p>
      <p className="mt-1 leading-6">{message}</p>
    </section>
  );
}

type SummaryMetricProps = {
  icon: LucideIcon;
  label: string;
  value: string | number;
  unit: string;
};

function DatabaseErrorPanel({ error }: { error: unknown }) {
  const rawMessage =
    error instanceof Error ? error.message : "알 수 없는 오류가 발생했습니다.";
  const isMissingTable = rawMessage.includes("workout_entries");
  const title = isMissingTable
    ? "Supabase 테이블을 생성해 주세요."
    : "Supabase 연결을 확인해 주세요.";
  const message = isMissingTable
    ? "Supabase SQL Editor에서 supabase/schema.sql 파일 내용을 실행해야 운동 기록 테이블이 만들어집니다."
    : rawMessage;

  return (
    <section className="rounded-lg border border-rose-200 bg-rose-50 p-4 text-sm text-rose-950 shadow-sm">
      <p className="font-bold">{title}</p>
      <p className="mt-1 leading-6">{message}</p>
    </section>
  );
}

function SummaryMetric({ icon: Icon, label, value, unit }: SummaryMetricProps) {
  return (
    <div className="min-h-28 rounded-lg bg-zinc-50 p-3">
      <Icon className="size-5 text-zinc-600" aria-hidden />
      <p className="mt-2 text-sm font-medium text-zinc-600">{label}</p>
      <p className="mt-1 flex items-baseline gap-1 text-xl font-bold tracking-normal text-zinc-950">
        <span>{value}</span>
        <span className="text-sm font-semibold text-zinc-600">{unit}</span>
      </p>
    </div>
  );
}

function ExerciseVisual({
  active,
  icon: Icon,
}: {
  active: boolean;
  icon: LucideIcon;
}) {
  return (
    <div
      className={cn(
        "flex h-16 items-center justify-center rounded-md bg-[radial-gradient(circle_at_top,#ffffff_0%,#f4f4f5_55%,#e4e4e7_100%)] text-zinc-500",
        active && "bg-[radial-gradient(circle_at_top,#ffffff_0%,#e5e7eb_60%,#d4d4d8_100%)] text-zinc-950",
      )}
    >
      <Icon className="size-8" aria-hidden />
    </div>
  );
}

function ExerciseTipSheet({
  exercise,
  onClose,
  onSelect,
}: {
  exercise: WorkoutExercise;
  onClose: () => void;
  onSelect: () => void;
}) {
  const Icon = exercise.icon;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/35 px-3 pb-3 backdrop-blur-[2px]"
      role="presentation"
      onClick={onClose}
    >
      <section
        aria-modal="true"
        className="w-full max-w-[520px] rounded-lg border border-zinc-200 bg-white p-4 shadow-2xl"
        role="dialog"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex size-11 shrink-0 items-center justify-center rounded-lg bg-zinc-950 text-white">
              <Icon className="size-5" aria-hidden />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase text-zinc-500">
                운동 팁
              </p>
              <h3 className="truncate text-xl font-bold">{exercise.name}</h3>
            </div>
          </div>
          <button
            aria-label="운동 팁 닫기"
            className="flex size-10 shrink-0 items-center justify-center rounded-full text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-950"
            type="button"
            onClick={onClose}
          >
            <X className="size-5" aria-hidden />
          </button>
        </div>

        <ol className="mt-4 space-y-2">
          {exercise.tips.map((tip, index) => (
            <li
              key={tip}
              className="grid grid-cols-[2rem_minmax(0,1fr)] items-start gap-2 rounded-md bg-zinc-50 p-3 text-sm leading-6 text-zinc-700"
            >
              <span className="flex size-7 items-center justify-center rounded-full bg-zinc-200 text-xs font-bold text-zinc-900">
                {index + 1}
              </span>
              <span>{tip}</span>
            </li>
          ))}
        </ol>

        <Button className="mt-4 h-12 w-full" type="button" onClick={onSelect}>
          이 운동 선택
        </Button>
      </section>
    </div>
  );
}

function WorkoutDetailSheet({
  entry,
  onClose,
}: {
  entry: WorkoutEntry;
  onClose: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/35 px-3 pb-3 backdrop-blur-[2px]"
      role="presentation"
      onClick={onClose}
    >
      <section
        aria-modal="true"
        className="w-full max-w-[520px] rounded-lg border border-zinc-200 bg-white p-4 shadow-2xl"
        role="dialog"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-sm font-medium text-zinc-500">
              {formatRecordDate(entry.date)}
            </p>
            <h3 className="mt-1 truncate text-xl font-bold">{entry.exercise}</h3>
          </div>
          <button
            aria-label="상세 닫기"
            className="flex size-10 shrink-0 items-center justify-center rounded-full text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-950"
            type="button"
            onClick={onClose}
          >
            <X className="size-5" aria-hidden />
          </button>
        </div>

        <WorkoutEntryDetail entry={entry} />
      </section>
    </div>
  );
}

function WorkoutSummarySheet({
  date,
  entries,
  protein,
  title,
  onClose,
}: {
  date: string;
  entries: WorkoutEntry[];
  protein: number;
  title: string;
  onClose: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/35 px-3 pb-3 backdrop-blur-[2px]"
      role="presentation"
      onClick={onClose}
    >
      <section
        aria-modal="true"
        className="max-h-[86vh] w-full max-w-[520px] overflow-y-auto rounded-lg border border-zinc-200 bg-white p-4 shadow-2xl"
        role="dialog"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-sm font-medium text-zinc-500">
              {formatRecordDate(date)}
            </p>
            <h3 className="mt-1 truncate text-xl font-bold">{title}</h3>
          </div>
          <button
            aria-label="요약 닫기"
            className="flex size-10 shrink-0 items-center justify-center rounded-full text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-950"
            type="button"
            onClick={onClose}
          >
            <X className="size-5" aria-hidden />
          </button>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-2">
          <div className="rounded-md bg-zinc-50 p-3">
            <p className="text-xs font-semibold text-zinc-500">운동</p>
            <p className="mt-1 text-lg font-bold">{entries.length}개</p>
          </div>
          <div className="rounded-md bg-zinc-50 p-3">
            <p className="text-xs font-semibold text-zinc-500">단백질</p>
            <p className="mt-1 text-lg font-bold">{formatNumber(protein)} g</p>
          </div>
        </div>

        {entries.length === 0 ? (
          <div className="mt-4 rounded-md border border-dashed border-zinc-300 bg-zinc-50 px-4 py-8 text-center text-sm text-zinc-500">
            이 날짜에 저장된 운동이 없습니다.
          </div>
        ) : (
          <div className="mt-4 space-y-3">
            {entries.map((entry) => (
              <article
                key={entry.id}
                className="rounded-lg border border-zinc-200 bg-white p-3"
              >
                <h4 className="font-bold">{entry.exercise}</h4>
                <WorkoutEntryDetail entry={entry} compact />
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function WorkoutEntryDetail({
  compact = false,
  entry,
}: {
  compact?: boolean;
  entry: WorkoutEntry;
}) {
  if (entry.cardio) {
    return (
      <div className={cn("grid grid-cols-3 gap-2", compact ? "mt-3" : "mt-4")}>
        <DetailMetric label="시간" value={`${entry.cardio.durationMinutes}분`} />
        <DetailMetric label="경사도" value={`${formatNumber(entry.cardio.incline)}%`} />
        <DetailMetric label="속도" value={`${formatNumber(entry.cardio.speed)}km/h`} />
      </div>
    );
  }

  return (
    <div className={cn("space-y-2", compact ? "mt-3" : "mt-4")}>
      {entry.sets.map((set, index) => (
        <div
          key={set.id}
          className="grid grid-cols-[2.25rem_1fr_1fr] items-center gap-2 rounded-md bg-zinc-50 p-2 text-sm"
        >
          <span className="flex size-8 items-center justify-center rounded-full bg-zinc-200 font-bold text-zinc-900">
            {index + 1}
          </span>
          <span className="font-semibold">{set.reps}회</span>
          <span className="text-right font-semibold">
            {formatNumber(set.weight)} kg
          </span>
        </div>
      ))}
      {entry.note ? (
        <p className="rounded-md bg-zinc-50 p-3 text-sm leading-6 text-zinc-600">
          {entry.note}
        </p>
      ) : null}
    </div>
  );
}

function DetailMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md bg-zinc-50 p-3 text-center">
      <p className="text-xs font-semibold text-zinc-500">{label}</p>
      <p className="mt-1 text-sm font-bold text-zinc-950">{value}</p>
    </div>
  );
}

function WorkoutCalendarSheet({
  selectedDate,
  todayDate,
  visibleMonth,
  workoutDateSet,
  onClose,
  onMonthChange,
  onSelectDate,
}: {
  selectedDate: string;
  todayDate: string;
  visibleMonth: string;
  workoutDateSet: Set<string>;
  onClose: () => void;
  onMonthChange: (date: string) => void;
  onSelectDate: (date: string) => void;
}) {
  const calendarDays = getMonthCalendarDays(visibleMonth);
  const today = new Date(`${todayDate}T00:00:00`);
  const todayLabel = `${today.getMonth() + 1}월 ${today.getDate()}일`;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/35 px-3 pb-3 backdrop-blur-[2px]"
      role="presentation"
      onClick={onClose}
    >
      <section
        aria-label="운동 기록 달력"
        aria-modal="true"
        className="w-full max-w-[520px] rounded-lg border border-zinc-200 bg-white p-4 shadow-2xl"
        role="dialog"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-3">
          <button
            aria-label="이전 달"
            className="flex size-10 items-center justify-center rounded-full border border-zinc-200 text-zinc-700 transition-colors hover:bg-zinc-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-950"
            type="button"
            onClick={() => onMonthChange(addMonths(visibleMonth, -1))}
          >
            <ChevronLeft className="size-5" aria-hidden />
          </button>

          <div className="text-center">
            <p className="text-xs font-semibold uppercase text-zinc-500">
              Calendar
            </p>
            <h3 className="text-xl font-bold">{getMonthLabel(visibleMonth)}</h3>
            <button
              className="mt-2 rounded-full bg-zinc-950 px-3 py-1 text-xs font-bold text-white transition-colors hover:bg-zinc-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-950 focus-visible:ring-offset-2"
              type="button"
              onClick={() => {
                onMonthChange(todayDate);
                onSelectDate(todayDate);
              }}
            >
              오늘 {todayLabel}
            </button>
          </div>

          <button
            aria-label="다음 달"
            className="flex size-10 items-center justify-center rounded-full border border-zinc-200 text-zinc-700 transition-colors hover:bg-zinc-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-950"
            type="button"
            onClick={() => onMonthChange(addMonths(visibleMonth, 1))}
          >
            <ChevronRight className="size-5" aria-hidden />
          </button>
        </div>

        <div className="mt-4 grid grid-cols-7 gap-1 text-center">
          {weekdayLabels.map((label) => (
            <div
              key={label}
              className="py-2 text-xs font-bold text-zinc-500"
            >
              {label}
            </div>
          ))}

          {calendarDays.map((day) => {
            const isSelected = day.dateKey === selectedDate;
            const isToday = day.dateKey === todayDate;
            const hasRecord = workoutDateSet.has(day.dateKey);

            return (
              <button
                key={day.dateKey}
                className={cn(
                  "relative flex min-h-14 flex-col items-center justify-center rounded-md border text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-950",
                  day.isCurrentMonth
                    ? "border-transparent text-zinc-700 hover:bg-zinc-100"
                    : "border-transparent text-zinc-300",
                  isToday &&
                    !isSelected &&
                    "border-zinc-950 bg-white text-zinc-950 ring-2 ring-zinc-950/10",
                  hasRecord &&
                    !isSelected &&
                    !isToday &&
                    "border-zinc-200 bg-zinc-100 text-zinc-950",
                  isSelected && "border-zinc-950 bg-zinc-950 text-white",
                )}
                data-date={day.dateKey}
                data-has-record={hasRecord ? "true" : undefined}
                data-selected={isSelected ? "true" : undefined}
                data-today={isToday ? "true" : undefined}
                type="button"
                onClick={() => onSelectDate(day.dateKey)}
              >
                {isToday && hasRecord ? (
                  <span
                    className={cn(
                      "absolute right-1.5 top-1.5 size-1.5 rounded-full",
                      isSelected ? "bg-white" : "bg-zinc-950",
                    )}
                  />
                ) : null}
                <span>{day.dayNumber}</span>
                <span className="mt-1 flex h-3 items-center justify-center">
                  {isToday ? (
                    <span
                      className={cn(
                        "rounded-full px-1.5 text-[10px] font-bold leading-3",
                        isSelected
                          ? "bg-white text-zinc-950"
                          : "bg-zinc-950 text-white",
                      )}
                    >
                      오늘
                    </span>
                  ) : (
                    <span
                      className={cn(
                        "size-1.5 rounded-full",
                        hasRecord
                          ? isSelected
                            ? "bg-white"
                            : "bg-zinc-950"
                          : "bg-transparent",
                      )}
                    />
                  )}
                </span>
              </button>
            );
          })}
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-zinc-100 pt-3">
          <div className="flex items-center gap-2 text-sm text-zinc-500">
            <span className="size-2 rounded-full bg-zinc-950" />
            운동 기록 있음
          </div>
          <button
            className="h-10 rounded-md px-3 text-sm font-semibold text-zinc-700 transition-colors hover:bg-zinc-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-950"
            type="button"
            onClick={onClose}
          >
            닫기
          </button>
        </div>
      </section>
    </div>
  );
}

function FormError({ message }: { message?: string }) {
  if (!message) {
    return null;
  }

  return <p className="text-sm text-rose-600">{message}</p>;
}
