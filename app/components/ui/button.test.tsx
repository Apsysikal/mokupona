import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { Button } from "./button";

// Base UI's button machinery stamps type="button" on a native button that
// receives no type of its own. That is the opposite of the HTML default, and
// it silently disables every Conform intent button in the signup form builder
// ("Add field", "Remove", "Unlink"), which submit the form to carry their
// intent. These assertions pin the passthrough that keeps them working.

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

  it("renders links as links, not as buttons", () => {
    render(<Button render={<a href="/dinners" />}>all dinners</Button>);

    const link = screen.getByText("all dinners");

    expect(link.tagName).toBe("A");
    expect(link.getAttribute("role")).toBeNull();
    expect(link.getAttribute("type")).toBeNull();
  });
});
