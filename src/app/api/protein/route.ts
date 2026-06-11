import { NextResponse } from "next/server";
import { z } from "zod";

import { getAuthenticatedSupabase } from "@/lib/api-auth";
import type { ProteinEntry } from "@/lib/workout-storage";

export const dynamic = "force-dynamic";

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

function mapProteinRow(row: ProteinEntryRow): ProteinEntry {
  return {
    date: row.entry_date,
    grams: Number(row.grams),
    updatedAt: row.updated_at,
  };
}

export async function GET(request: Request) {
  const { supabase, user, error } = await getAuthenticatedSupabase(request);

  if (error) {
    return error;
  }

  const { data, error: queryError } = await supabase
    .from("protein_entries")
    .select("entry_date, grams, updated_at")
    .eq("user_id", user.id)
    .order("entry_date", { ascending: false });

  if (queryError) {
    return NextResponse.json({ error: queryError.message }, { status: 500 });
  }

  return NextResponse.json({
    entries: ((data ?? []) as ProteinEntryRow[]).map(mapProteinRow),
  });
}

export async function POST(request: Request) {
  const { supabase, user, error } = await getAuthenticatedSupabase(request);

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
  const payload = {
    user_id: user.id,
    entry_date: entry.date,
    grams: entry.grams,
    updated_at: entry.updatedAt,
  };

  const { data: existing, error: lookupError } = await supabase
    .from("protein_entries")
    .select("entry_date")
    .eq("user_id", user.id)
    .eq("entry_date", entry.date)
    .maybeSingle();

  if (lookupError) {
    return NextResponse.json({ error: lookupError.message }, { status: 500 });
  }

  const query = existing
    ? supabase
        .from("protein_entries")
        .update(payload)
        .eq("user_id", user.id)
        .eq("entry_date", entry.date)
    : supabase.from("protein_entries").insert(payload);

  const { data, error: queryError } = await query
    .select("entry_date, grams, updated_at")
    .single();

  if (queryError) {
    return NextResponse.json({ error: queryError.message }, { status: 500 });
  }

  return NextResponse.json({ entry: mapProteinRow(data as ProteinEntryRow) });
}
