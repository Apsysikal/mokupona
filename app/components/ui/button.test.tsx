import { render, screen } from "@testing-library/react";
import { Link, MemoryRouter } from "react-router";
import { describe, expect, it, vi } from "vitest";

import { Button, buttonVariants } from "./button";

// Base UI's Button stamps type="button" on a button that receives no type of
// its own. That is the opposite of the HTML default, and it silently disables
// every Conform intent button in the signup form builder ("Add field",
// "Remove", "Unlink"), which submit the form to carry their intent. These
// assertions pin the passthrough that keeps them working.

describe("Button type", () => {
  it("leaves the native submit default alone when no type is given", () => {
    render(<Button>Add field</Button>);

    expect(screen.getByText("Add field").getAttribute("type")).toBeNull();
  });

  it("submits its form when clicked without an explicit type", () => {
    const onSubmit = vi.fn((event: React.FormEvent) => event.preventDefault());

    render(
      <form onSubmit={onSubmit}>
        <Button>Add field</Button>
      </form>,
    );

    screen.getByText("Add field").click();

    expect(onSubmit).toHaveBeenCalledOnce();
  });

  it("keeps an explicit type", () => {
    render(<Button type="button">Cancel</Button>);

    expect(screen.getByText("Cancel").getAttribute("type")).toBe("button");
  });
});

// Base UI's Button always applies role="button", which would override the link
// role, so links that look like buttons take the classes and stay links.
describe("buttonVariants on a link", () => {
  it("styles a link without giving it button semantics", () => {
    render(
      <MemoryRouter>
        <Link to="/dinners" className={buttonVariants({ variant: "outline" })}>
          all dinners
        </Link>
      </MemoryRouter>,
    );

    const link = screen.getByRole("link", { name: "all dinners" });

    expect(link.getAttribute("role")).toBeNull();
    expect(link.getAttribute("type")).toBeNull();
    expect(link.className).toContain("inline-flex");
  });
});
