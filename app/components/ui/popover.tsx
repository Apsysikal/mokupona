"use client";

import { Popover as PopoverPrimitive } from "@base-ui/react/popover";
import React from "react";

import { cn } from "~/lib/utils";

const Popover = PopoverPrimitive.Root;

const PopoverTrigger = PopoverPrimitive.Trigger;

const PopoverContent = ({
  className,
  align = "center",
  side,
  sideOffset = 4,
  ref,
  ...props
}: React.ComponentProps<typeof PopoverPrimitive.Popup> &
  Pick<
    React.ComponentProps<typeof PopoverPrimitive.Positioner>,
    "align" | "side" | "sideOffset"
  >) => (
  <PopoverPrimitive.Portal>
    <PopoverPrimitive.Positioner
      align={align}
      side={side}
      sideOffset={sideOffset}
      className="z-50"
    >
      <PopoverPrimitive.Popup
        ref={ref}
        className={cn(
          "bg-popover text-popover-foreground w-72 origin-[var(--transform-origin)] rounded-2xl border p-4 shadow-md outline-hidden transition-[opacity,scale] duration-150 data-ending-style:scale-95 data-ending-style:opacity-0 data-starting-style:scale-95 data-starting-style:opacity-0",
          className,
        )}
        {...props}
      />
    </PopoverPrimitive.Positioner>
  </PopoverPrimitive.Portal>
);

PopoverContent.displayName = "PopoverContent";

export { Popover, PopoverContent, PopoverTrigger };
