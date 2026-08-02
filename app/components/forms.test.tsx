import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { CheckboxField, Field, SelectField, TextareaField } from "./forms";

// The accessible description is the whole point of the feature: helper text
// that is visible but not announced is decoration. These assertions pin the
// aria-describedby composition — including the two failure modes that are easy
// to reintroduce: a dangling IDREF when no description renders, and an empty
// aria-describedby="" attribute when nothing describes the control at all.

const description = "We only use this to confirm your seat.";
const errors = ["Enter your email address"];

describe("Field description wiring", () => {
  it("renders the description and points the input at it", () => {
    render(
      <Field
        labelProps={{ children: "Email" }}
        description={description}
        inputProps={{ name: "email" }}
      />,
    );

    const input = screen.getByLabelText("Email");
    const describedBy = input.getAttribute("aria-describedby");

    expect(screen.getByText(description)).toBeTruthy();
    expect(describedBy).toBeTruthy();
    expect(document.getElementById(describedBy!)?.textContent).toBe(
      description,
    );
  });

  it("omits aria-describedby entirely when there is nothing to describe", () => {
    render(
      <Field
        labelProps={{ children: "Email" }}
        inputProps={{ name: "email" }}
      />,
    );

    // an empty attribute is not the same as an absent one, and a reference to
    // a description node that never rendered is a dangling IDREF
    expect(
      screen.getByLabelText("Email").hasAttribute("aria-describedby"),
    ).toBe(false);
  });

  it("references both the description and the error, description first", () => {
    render(
      <Field
        labelProps={{ children: "Email" }}
        description={description}
        errors={errors}
        inputProps={{ name: "email" }}
      />,
    );

    const input = screen.getByLabelText("Email");
    const ids = input.getAttribute("aria-describedby")!.split(" ");

    expect(ids).toHaveLength(2);
    expect(document.getElementById(ids[0])?.textContent).toBe(description);
    expect(document.getElementById(ids[1])?.textContent).toContain(errors[0]);
    expect(input.getAttribute("aria-invalid")).toBe("true");
  });

  // Conform's getInputProps/getTextareaProps/getSelectProps put their own
  // aria-describedby on the control the moment the field is invalid, and every
  // field view spreads them onto these components. Passing hand-written props
  // is the one shape that never occurs in the app.
  const conformInvalidProps = {
    name: "email",
    id: "signup-email",
    "aria-invalid": true,
    "aria-describedby": "signup-email-error",
  } as const;

  it("merges the control's own aria-describedby instead of dropping either", () => {
    render(
      <Field
        labelProps={{ children: "Email" }}
        description={description}
        errors={errors}
        inputProps={conformInvalidProps}
      />,
    );

    const ids = screen
      .getByLabelText("Email")
      .getAttribute("aria-describedby")!
      .split(" ");

    // conform's error id is the one this component mints, so it appears once
    expect(ids).toEqual(["signup-email-description", "signup-email-error"]);
    expect(document.getElementById(ids[0])?.textContent).toBe(description);
    expect(document.getElementById(ids[1])?.textContent).toContain(errors[0]);
  });

  it("keeps an unrelated id the control brings along", () => {
    render(
      <Field
        labelProps={{ children: "Email" }}
        description={description}
        inputProps={{ ...conformInvalidProps, "aria-describedby": "hint" }}
      />,
    );

    expect(
      screen.getByLabelText("Email").getAttribute("aria-describedby"),
    ).toBe("signup-email-description hint");
  });

  it("merges on textarea, select and checkbox alike", () => {
    const cases = [
      <TextareaField
        key="textarea"
        labelProps={{ children: "Notes" }}
        description={description}
        errors={errors}
        textareaProps={conformInvalidProps}
      />,
      <SelectField
        key="select"
        labelProps={{ children: "Notes" }}
        description={description}
        errors={errors}
        selectProps={{
          ...conformInvalidProps,
          options: [{ label: "A", value: "a" }],
        }}
      />,
      <CheckboxField
        key="checkbox"
        labelProps={{ children: "Notes" }}
        description={description}
        errors={errors}
        buttonProps={conformInvalidProps}
      />,
    ];

    for (const element of cases) {
      const { unmount } = render(element);

      expect(
        screen.getByLabelText("Notes").getAttribute("aria-describedby"),
        `${element.key} dropped an id`,
      ).toBe("signup-email-description signup-email-error");

      unmount();
    }
  });

  it("still references the error alone when there is no description", () => {
    render(
      <Field
        labelProps={{ children: "Email" }}
        errors={errors}
        inputProps={{ name: "email" }}
      />,
    );

    const ids = screen
      .getByLabelText("Email")
      .getAttribute("aria-describedby")!
      .split(" ");

    expect(ids).toHaveLength(1);
    expect(document.getElementById(ids[0])?.textContent).toContain(errors[0]);
  });

  it("wires the description on textarea, select and checkbox alike", () => {
    const cases = [
      <TextareaField
        key="textarea"
        labelProps={{ children: "Notes" }}
        description={description}
        textareaProps={{ name: "notes" }}
      />,
      <SelectField
        key="select"
        labelProps={{ children: "Notes" }}
        description={description}
        selectProps={{ name: "notes", options: [{ label: "A", value: "a" }] }}
      />,
      <CheckboxField
        key="checkbox"
        labelProps={{ children: "Notes" }}
        description={description}
        buttonProps={{ name: "notes" }}
      />,
    ];

    for (const element of cases) {
      const { unmount } = render(element);

      const control = screen.getByLabelText("Notes");
      const describedBy = control.getAttribute("aria-describedby");

      expect(describedBy, `${element.key} has no description`).toBeTruthy();
      expect(document.getElementById(describedBy!)?.textContent).toBe(
        description,
      );

      unmount();
    }
  });
});
