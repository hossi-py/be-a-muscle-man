import { NextResponse } from "next/server";

import { getAuthenticatedSupabase } from "@/lib/api-auth";

export const dynamic = "force-dynamic";

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { supabase, user, error } = await getAuthenticatedSupabase(request);

  if (error) {
    return error;
  }

  const { id } = await params;
  const { error: queryError } = await supabase
    .from("workout_entries")
    .delete()
    .eq("user_id", user.id)
    .eq("id", id);

  if (queryError) {
    return NextResponse.json({ error: queryError.message }, { status: 500 });
  }

  return NextResponse.json({ id });
}
