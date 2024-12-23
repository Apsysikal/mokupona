import { ArrowRightIcon } from "@radix-ui/react-icons";
import { type ClassValue } from "clsx";

import { cn } from "~/lib/utils";

export interface ArrowProps {
  orientation?: "up" | "right" | "down" | "left";
  className?: string | ClassValue[];
}

export function Arrow({ orientation = "right", className }: ArrowProps) {
  return (
    <>
      <div
        className={cn(
          "flex h-12 w-12 items-center rounded-full border border-current text-current",
          className,
        )}
      >
        <ArrowRightIcon
          className={cn(
            "mx-auto h-8 w-8",
            orientation === "down" && "rotate-90",
            orientation === "left" && "rotate-180",
            orientation === "up" && "-rotate-90",
          )}
        />
      </div>
    </>
  );
}
