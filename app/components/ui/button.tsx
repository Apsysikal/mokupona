import { Button as ButtonPrimitive } from "@base-ui/react/button";
import { mergeProps } from "@base-ui/react/merge-props";
import { useRender } from "@base-ui/react/use-render";
import { cva, type VariantProps } from "class-variance-authority";
import React from "react";

import { cn } from "~/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg text-base font-semibold transition-colors focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-primary/90",
        destructive:
          "bg-destructive text-destructive-foreground hover:bg-destructive/90",
        "destructive-outline":
          "border border-destructive/35 text-destructive-light hover:bg-destructive/10",
        outline: "border border-foreground/20 hover:bg-foreground/5",
        secondary: "bg-card text-card-foreground hover:bg-card/80",
        ghost: "text-foreground/80 hover:bg-foreground/5",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "h-11 px-6",
        sm: "h-9 px-4 text-sm",
        lg: "h-12 px-6",
        icon: "size-9",
        "icon-sm": "size-7",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

export interface ButtonProps
  extends
    useRender.ComponentProps<"button">,
    VariantProps<typeof buttonVariants> {}

// Base UI's Button primitive enforces button semantics — it stamps
// `type="button"` on a real button and `role="button"` on anything else. The
// links this button renders (`render={<Link/>}`) must keep link semantics, so
// those go through useRender, which only merges props onto the element.
function rendersNativeButton(render: ButtonProps["render"]) {
  return (
    render === undefined ||
    (React.isValidElement(render) && render.type === "button")
  );
}

const Button = ({
  className,
  variant,
  size,
  render,
  ref,
  ...props
}: ButtonProps) => {
  const classNames = cn(buttonVariants({ variant, size, className }));

  return rendersNativeButton(render) ? (
    <ButtonPrimitive
      className={classNames}
      render={render}
      ref={ref}
      {...props}
    />
  ) : (
    <RenderedButton
      className={classNames}
      render={render}
      ref={ref}
      {...props}
    />
  );
};

Button.displayName = "Button";

const RenderedButton = ({
  className,
  render,
  ref,
  ...props
}: useRender.ComponentProps<"button">) =>
  useRender({
    defaultTagName: "button",
    render,
    ref,
    props: mergeProps<"button">({ className }, props),
  });

RenderedButton.displayName = "RenderedButton";

export { Button, buttonVariants };
