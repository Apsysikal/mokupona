import type React from "react";

import type { TextSectionBlockType } from "./model";

type TextSectionBlockViewProps = React.ComponentPropsWithoutRef<"div"> & {
  blockData: TextSectionBlockType;
};

export function TextSectionBlockView({
  blockData,
  ...rest
}: TextSectionBlockViewProps) {
  const { data } = blockData;
  const { headline, body, variant } = data;

  const section = (
    <section className="my-5 grid max-w-4xl grid-cols-5 gap-5">
      <h2 className="col-span-full text-4xl">{headline}</h2>

      <p className="col-span-full my-auto text-xl leading-relaxed font-thin">
        {body}
      </p>
    </section>
  );

  const textClasses =
    variant === "slanted" ? "text-background" : "text-foreground";

  return (
    <div
      className={["relative my-20 w-full py-10", textClasses].join(" ")}
      {...rest}
    >
      {variant === "slanted" ? (
        <div className="after:bg-accent mx-auto flex max-w-4xl flex-col gap-2 px-4 after:absolute after:inset-0 after:-z-10 after:skew-y-3">
          {section}
        </div>
      ) : (
        <div className="mx-auto flex max-w-4xl flex-col gap-2 px-4">
          {section}
        </div>
      )}
    </div>
  );
}
