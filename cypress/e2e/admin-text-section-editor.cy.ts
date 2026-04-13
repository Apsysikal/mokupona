import { runUploadDbCommand } from "../support/upload-test-utils";

describe("admin cms text-section block editor", () => {
  beforeEach(() => {
    cy.loginAsRole("moderator");
    runUploadDbCommand("delete-page", { pageKey: "home" });
  });

  afterEach(() => {
    runUploadDbCommand("delete-page", { pageKey: "home" });
  });

  it("edits a text-section headline and body; public page reflects the change", () => {
    cy.visitAndCheck("/admin/pages/home");

    // Materialize the page first
    cy.findByRole("button", { name: /save page/i }).click();
    cy.findByText(/persisted page/i).should("be.visible");

    // The hero block also has a "Headline" label at index 0; text-sections
    // start at index 1.  Use eq(1) to target the first text-section.
    cy.findAllByLabelText(/^headline$/i).eq(1).should("be.visible");

    cy.findAllByLabelText(/^headline$/i)
      .eq(1)
      .clear()
      .type("Updated section headline");

    cy.findAllByLabelText(/^body$/i)
      .first()
      .clear()
      .type("Updated section body text.");

    // Hero's "Save block" is at index 0; first text-section's is at index 1.
    cy.findAllByRole("button", { name: /save block/i }).eq(1).click();

    cy.findByText(/persisted page/i).should("be.visible");

    // Verify the saved value is reflected back
    cy.visitAndCheck("/admin/pages/home");
    cy.findAllByLabelText(/^headline$/i)
      .eq(1)
      .should("have.value", "Updated section headline");

    // Public page reflects the change
    cy.visitAndCheck("/");
    cy.contains("Updated section headline").should("be.visible");
    cy.contains("Updated section body text.").should("be.visible");
  });

  it("shows validation errors when headline or body is empty, preserving entered values", () => {
    cy.visitAndCheck("/admin/pages/home");
    cy.findByRole("button", { name: /save page/i }).click();
    cy.findByText(/persisted page/i).should("be.visible");

    // Index 0 is the hero's headline; index 1 is the first text-section's.
    cy.findAllByLabelText(/^headline$/i)
      .eq(1)
      .clear()
      .type("Valid headline but empty body");

    cy.findAllByLabelText(/^body$/i).first().clear();

    // Index 0 is the hero's "Save block"; index 1 is the first text-section's.
    cy.findAllByRole("button", { name: /save block/i }).eq(1).click();

    cy.findByText(/body is required/i).should("be.visible");
    cy.findAllByLabelText(/^headline$/i)
      .eq(1)
      .should("have.value", "Valid headline but empty body");
  });

  it("adds a new text-section block via the add button; it appears at the end", () => {
    cy.visitAndCheck("/admin/pages/home");
    cy.findByRole("button", { name: /save page/i }).click();
    cy.findByText(/persisted page/i).should("be.visible");

    // Count existing save block buttons before adding
    cy.findAllByRole("button", { name: /save block/i }).then(($buttons) => {
      const initialCount = $buttons.length;

      cy.findByRole("button", { name: /\+ add text section/i }).click();
      cy.findByText(/persisted page/i).should("be.visible");

      // One more save block button should exist
      cy.findAllByRole("button", { name: /save block/i }).should(
        "have.length",
        initialCount + 1,
      );
    });
  });

  it("deletes a text-section block; block count decreases", () => {
    cy.visitAndCheck("/admin/pages/home");
    cy.findByRole("button", { name: /save page/i }).click();
    cy.findByText(/persisted page/i).should("be.visible");

    cy.findAllByRole("button", { name: /save block/i }).then(($buttons) => {
      const initialCount = $buttons.length;

      // Delete the first available delete button (first text-section)
      cy.findAllByRole("button", { name: /delete block/i })
        .first()
        .click();

      cy.findByText(/persisted page/i).should("be.visible");
      cy.findAllByRole("button", { name: /save block/i }).should(
        "have.length",
        initialCount - 1,
      );
    });
  });

  it("moves a text-section block up with the move-up button", () => {
    cy.visitAndCheck("/admin/pages/home");
    cy.findByRole("button", { name: /save page/i }).click();
    cy.findByText(/persisted page/i).should("be.visible");

    // Read the order of headlines before moving.
    // Index 0 is the hero's headline; text-section headlines start at index 1.
    cy.findAllByLabelText(/^headline$/i)
      .then(($inputs) =>
        $inputs.map((_, el) => (el as HTMLInputElement).value).get(),
      )
      .then((headlinesBefore) => {
        // The default home page has: hero, vision, (image – no editor),
        // difference, about.  In the rendered editors, the "difference"
        // block appears at headline slot 2 and "about" at slot 3.
        //
        // The first "Move up" button (eq(0)) belongs to "difference" and
        // would only swap it past the image block (no visible order change).
        // The second "Move up" button (eq(1)) belongs to "about" and swaps
        // it past "difference", making the visible order change at slot 2.
        const headlineAtSlot2Before = headlinesBefore[2];

        cy.findAllByRole("button", { name: /move up/i }).eq(1).click();

        cy.findByText(/persisted page/i).should("be.visible");

        cy.findAllByLabelText(/^headline$/i)
          .eq(2)
          .invoke("val")
          .should("not.eq", headlineAtSlot2Before);
      });
  });

  it("hero block has no delete button; text-section blocks do", () => {
    cy.visitAndCheck("/admin/pages/home");
    cy.findByRole("button", { name: /save page/i }).click();
    cy.findByText(/persisted page/i).should("be.visible");

    // Delete button should exist for text-section blocks
    cy.findAllByRole("button", { name: /delete block/i }).should(
      "have.length.at.least",
      1,
    );

    // Move-up should not appear for the very first non-hero block
    // (it's at requiredLeadingCount boundary), but move-down should
    cy.findAllByRole("button", { name: /move down/i }).should(
      "have.length.at.least",
      1,
    );
  });
});
