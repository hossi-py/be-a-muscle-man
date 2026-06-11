import * as React from "react";

import { cn } from "@/lib/utils";

export function Card({ className, ...props }: React.ComponentProps<"section">) {
  return (
    <section
      className={cn(
        "rounded-lg border border-zinc-200 bg-white text-zinc-950 shadow-sm",
        className,
      )}
      {...props}
    />
  );
}

export function CardHeader({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return <div className={cn("space-y-1.5 p-4", className)} {...props} />;
}

export function CardTitle({
  className,
  ...props
}: React.ComponentProps<"h2">) {
  return (
    <h2
      className={cn("text-base font-semibold leading-6", className)}
      {...props}
    />
  );
}

export function CardContent({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return <div className={cn("p-4 pt-0", className)} {...props} />;
}
