import * as React from "react";

import { cn } from "@/lib/utils";

export function Badge({ className, ...props }: React.ComponentProps<"span">) {
  return (
    <span
      className={cn(
        "inline-flex h-7 items-center rounded-md border border-zinc-200 bg-zinc-50 px-2.5 text-xs font-medium text-zinc-700",
        className,
      )}
      {...props}
    />
  );
}
