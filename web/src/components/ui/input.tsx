import * as React from "react";
import { cn } from "@/lib/utils";

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        "border-input bg-input/40 placeholder:text-muted-foreground flex h-10 w-full min-w-0 rounded-lg border px-3 py-1 text-base outline-none transition select-text",
        "focus-visible:border-ring focus-visible:ring-4 focus-visible:ring-ring/30 disabled:opacity-50",
        className,
      )}
      {...props}
    />
  );
}

export { Input };
