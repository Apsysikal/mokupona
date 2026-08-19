import { Button as ButtonPrimitive } from "@base-ui/react/button";
import { cva, type VariantProps } from "class-variance-authority";

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
  extends ButtonPrimitive.Props, VariantProps<typeof buttonVariants> {}

// Base UI's Button stamps `type="button"` when the caller passes no type,
// which is the opposite of the HTML default and silently turns Conform's
// intent buttons (`form.insert.getButtonProps()` and friends) into no-ops —
// a bare <button> in a form submits. Passing `type` through last, undefined
// included, restores the native default.
//
// Links do not belong here: Base UI's Button always applies `role="button"`,
// which overrides the link role. Style the anchor with `buttonVariants`
// instead — see the shadcn Button docs, "As Link".
const Button = ({ className, variant, size, type, ...props }: ButtonProps) => (
  <ButtonPrimitive
    className={cn(buttonVariants({ variant, size, className }))}
    {...props}
    type={type}
  />
);

Button.displayName = "Button";

export { Button, buttonVariants };
