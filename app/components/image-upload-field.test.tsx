import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { ImageUploadField } from "./image-upload-field";

type FieldProps = React.ComponentProps<typeof ImageUploadField>;

const TOO_LARGE = "File cannot be greater than 3MB";

function imageFile(name: string) {
  return new File(["binary"], name, { type: "image/jpeg" });
}

function renderField(props: Partial<FieldProps> = {}) {
  const baseProps: FieldProps = {
    labelProps: { children: "Photos" },
    inputProps: { name: "images", multiple: true },
    ...props,
  };

  const view = render(<ImageUploadField {...baseProps} />);
  const input = screen.getByLabelText("Photos") as HTMLInputElement;

  // The upload round trip re-renders the same input with the server's verdict.
  // The browser keeps the selection, so the previews outlive the submission.
  function reportErrors(errorProps: Partial<FieldProps>) {
    view.rerender(<ImageUploadField {...baseProps} {...errorProps} />);
  }

  return { input, reportErrors };
}

function select(input: HTMLInputElement, files: File[]) {
  fireEvent.change(input, { target: { files } });
}

function tiles() {
  return within(
    screen.getByRole("list", { name: "Selected images" }),
  ).getAllByRole("listitem");
}

function isFlagged(tile: HTMLElement) {
  return tile.hasAttribute("data-invalid");
}

describe("ImageUploadField", () => {
  it("renders a plain file input and no preview list until files are selected", () => {
    const { input } = renderField();

    expect(input.type).toBe("file");
    expect(screen.queryByRole("list")).not.toBeInTheDocument();
  });

  it("previews every selected file with its own remove control", () => {
    const { input } = renderField();

    select(input, [imageFile("first.jpg"), imageFile("second.jpg")]);

    expect(tiles()).toHaveLength(2);
    expect(
      screen.getByRole("button", { name: "Remove first.jpg" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Remove second.jpg" }),
    ).toBeInTheDocument();
  });

  it("removes only the chosen file from the preview and from the input", () => {
    const { input } = renderField();

    select(input, [
      imageFile("keep-one.jpg"),
      imageFile("drop-me.jpg"),
      imageFile("keep-two.jpg"),
    ]);
    fireEvent.click(screen.getByRole("button", { name: "Remove drop-me.jpg" }));

    expect(tiles()).toHaveLength(2);
    expect(
      screen.queryByRole("button", { name: "Remove drop-me.jpg" }),
    ).not.toBeInTheDocument();
    expect(Array.from(input.files ?? []).map((file) => file.name)).toEqual([
      "keep-one.jpg",
      "keep-two.jpg",
    ]);
  });

  it("clears the preview list when the last file is removed", () => {
    const { input } = renderField();

    select(input, [imageFile("only.jpg")]);
    fireEvent.click(screen.getByRole("button", { name: "Remove only.jpg" }));

    expect(screen.queryByRole("list")).not.toBeInTheDocument();
    expect(input.files?.length ?? 0).toBe(0);
  });

  it("flags only the file that failed to upload when errors are keyed by name", () => {
    const { input, reportErrors } = renderField();

    select(input, [
      imageFile("fine.jpg"),
      imageFile("broken.jpg"),
      imageFile("also-fine.jpg"),
    ]);
    reportErrors({ fileErrors: { "broken.jpg": ["Upload failed"] } });

    const [first, second, third] = tiles();

    expect(isFlagged(second)).toBe(true);
    expect(isFlagged(first)).toBe(false);
    expect(isFlagged(third)).toBe(false);
    expect(screen.getByText("broken.jpg: Upload failed")).toBeInTheDocument();
  });

  it("keeps the message on the field instead of on the thumbnail", () => {
    const { input, reportErrors } = renderField();

    select(input, [imageFile("broken.jpg")]);
    reportErrors({ fileErrors: { "broken.jpg": ["Upload failed"] } });

    const list = screen.getByRole("list", { name: "Selected images" });
    const message = screen.getByText("broken.jpg: Upload failed");

    expect(list).not.toContainElement(message);
    expect(
      screen.getByRole("button", { name: "Remove broken.jpg" }),
    ).toHaveAccessibleDescription("broken.jpg: Upload failed");
  });

  it("maps positional errors onto the matching preview", () => {
    const { input, reportErrors } = renderField();

    select(input, [imageFile("first.jpg"), imageFile("second.jpg")]);
    reportErrors({ fileErrors: [undefined, [TOO_LARGE]] });

    const [first, second] = tiles();

    expect(isFlagged(second)).toBe(true);
    expect(isFlagged(first)).toBe(false);
    expect(screen.getByText(`second.jpg: ${TOO_LARGE}`)).toBeInTheDocument();
  });

  it("retires positional errors once the selection shifts under them", () => {
    const { input, reportErrors } = renderField();

    select(input, [imageFile("first.jpg"), imageFile("second.jpg")]);
    reportErrors({ fileErrors: [undefined, [TOO_LARGE]] });
    fireEvent.click(screen.getByRole("button", { name: "Remove first.jpg" }));

    expect(
      screen.queryByText(`second.jpg: ${TOO_LARGE}`),
    ).not.toBeInTheDocument();
    expect(isFlagged(tiles()[0])).toBe(false);
  });

  it("keeps name-keyed errors on the files that are still selected", () => {
    const { input, reportErrors } = renderField();

    select(input, [imageFile("fine.jpg"), imageFile("broken.jpg")]);
    reportErrors({ fileErrors: { "broken.jpg": ["Upload failed"] } });
    fireEvent.click(screen.getByRole("button", { name: "Remove fine.jpg" }));

    expect(screen.getByText("broken.jpg: Upload failed")).toBeInTheDocument();
    expect(isFlagged(tiles()[0])).toBe(true);
  });

  it("marks the single selected file when the field itself reports an error", () => {
    const { input, reportErrors } = renderField({
      inputProps: { name: "image" },
    });

    select(input, [imageFile("too-big.jpg")]);
    reportErrors({ errors: [TOO_LARGE] });

    expect(isFlagged(tiles()[0])).toBe(true);
    expect(screen.getByText(TOO_LARGE)).toBeInTheDocument();
  });

  it("drops per-file errors once the selection is replaced", () => {
    const { input, reportErrors } = renderField();

    select(input, [imageFile("broken.jpg")]);
    reportErrors({ fileErrors: { "broken.jpg": ["Upload failed"] } });
    expect(screen.getByText("broken.jpg: Upload failed")).toBeInTheDocument();

    select(input, [imageFile("broken.jpg")]);

    expect(
      screen.queryByText("broken.jpg: Upload failed"),
    ).not.toBeInTheDocument();
    expect(isFlagged(tiles()[0])).toBe(false);
  });

  it("moves focus to the next remove control after a removal", () => {
    const { input } = renderField();

    select(input, [imageFile("first.jpg"), imageFile("second.jpg")]);
    fireEvent.click(screen.getByRole("button", { name: "Remove first.jpg" }));

    expect(
      screen.getByRole("button", { name: "Remove second.jpg" }),
    ).toHaveFocus();
  });

  it("returns focus to the input when the last preview goes away", () => {
    const { input } = renderField();

    select(input, [imageFile("only.jpg")]);
    fireEvent.click(screen.getByRole("button", { name: "Remove only.jpg" }));

    expect(input).toHaveFocus();
  });
});
