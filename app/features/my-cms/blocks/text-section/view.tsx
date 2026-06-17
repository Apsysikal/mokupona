import type { ViewProps } from "./model";

import { cn } from "~/lib/utils";

export function TextSectionBlockView({ data, ...props }: ViewProps) {
  const { headline, body, variant } = data;
  const slanted = variant === "slanted";

  return (
    <div
      className={cn(
        "relative my-20 w-full py-10",
        slanted ? "text-background" : "text-foreground",
      )}
      {...props}
    >
      <div
        className={cn(
          "mx-auto flex max-w-4xl flex-col gap-2 px-4",
          slanted &&
            "after:bg-accent after:absolute after:inset-0 after:-z-10 after:skew-y-3",
        )}
      >
        <section className="my-5 grid max-w-4xl grid-cols-5 gap-5">
          <h2 className="col-span-full text-4xl">{headline}</h2>

          <p className="col-span-full my-auto text-xl leading-relaxed font-thin">
            {body}
          </p>
        </section>
      </div>
    </div>
  );
}
