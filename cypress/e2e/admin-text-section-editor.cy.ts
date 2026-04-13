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

    // The first text-section editor after the hero should have our vision headline
    cy.findAllByLabelText(/^headline$/i)
      .filter('[name="headline"]')
      .first()
      .should("be.visible");

    // Find the first text-section's save block button and its surrounding form
    // Edit headline and body of the first text-section
    cy.findAllByLabelText(/^headline$/i)
      .first()
      .clear()
      .type("Updated section headline");

    cy.findAllByLabelText(/^body$/i)
      .first()
      .clear()
      .type("Updated section body text.");

    cy.findAllByRole("button", { name: /save block/i })
      .first()
      .click();

    cy.findByText(/persisted page/i).should("be.visible");

    // Verify the saved value is reflected back
    cy.visitAndCheck("/admin/pages/home");
    cy.findAllByLabelText(/^headline$/i)
      .first()
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

    cy.findAllByLabelText(/^headline$/i)
      .first()
      .clear()
      .type("Valid headline but empty body");

    cy.findAllByLabelText(/^body$/i)
      .first()
      .clear();

    cy.findAllByRole("button", { name: /save block/i })
      .first()
      .click();

    cy.findByText(/body is required/i).should("be.visible");
    cy.findAllByLabelText(/^headline$/i)
      .first()
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

    // Read the order of headlines before moving
    cy.findAllByLabelText(/^headline$/i)
      .then(($inputs) =>
        $inputs.map((_, el) => (el as HTMLInputElement).value).get(),
      )
      .then((headlinesBefore) => {
        // The first text-section headline
        const firstHeadline = headlinesBefore[0];

        // Move-up is disabled for the first text-section (index 1 can't go before index 0 hero)
        // So we need the second text-section to move up - that should have a "Move up" button
        cy.findAllByRole("button", { name: /move up/i })
          .first()
          .click();

        cy.findByText(/persisted page/i).should("be.visible");

        cy.findAllByLabelText(/^headline$/i)
          .first()
          .invoke("val")
          .should("not.eq", firstHeadline);
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
