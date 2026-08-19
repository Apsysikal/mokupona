import { Accordion as AccordionPrimitive } from "@base-ui/react/accordion";
import { ChevronDownIcon } from "lucide-react";
import React from "react";

import { cn } from "~/lib/utils";

const Accordion = AccordionPrimitive.Root;

const AccordionItem = ({
  className,
  ref,
  ...props
}: React.ComponentProps<typeof AccordionPrimitive.Item>) => (
  <AccordionPrimitive.Item
    ref={ref}
    className={cn("border-b", className)}
    {...props}
  />
);

AccordionItem.displayName = "AccordionItem";

const AccordionTrigger = ({
  className,
  children,
  ref,
  ...props
}: React.ComponentProps<typeof AccordionPrimitive.Trigger>) => (
  <AccordionPrimitive.Header className="flex">
    <AccordionPrimitive.Trigger
      ref={ref}
      className={cn(
        "group flex flex-1 items-center justify-between py-5 text-left text-base font-semibold transition-colors",
        className,
      )}
      {...props}
    >
      {children}
      <ChevronDownIcon className="text-primary size-4 shrink-0 transition-transform duration-300 group-data-panel-open:rotate-180" />
    </AccordionPrimitive.Trigger>
  </AccordionPrimitive.Header>
);

AccordionTrigger.displayName = "AccordionTrigger";

const AccordionContent = ({
  className,
  children,
  ref,
  ...props
}: React.ComponentProps<typeof AccordionPrimitive.Panel>) => (
  <AccordionPrimitive.Panel
    ref={ref}
    className="h-[var(--accordion-panel-height)] overflow-hidden transition-[height] duration-200 ease-out data-ending-style:h-0 data-starting-style:h-0"
    {...props}
  >
    <div className={cn("pb-4", className)}>{children}</div>
  </AccordionPrimitive.Panel>
);

AccordionContent.displayName = "AccordionContent";

export { Accordion, AccordionContent, AccordionItem, AccordionTrigger };
