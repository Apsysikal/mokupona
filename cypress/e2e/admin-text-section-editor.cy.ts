import { runUploadDbCommand } from "../support/upload-test-utils";

function materializeHomePage() {
  cy.visitAndCheck("/admin/pages/home");
  cy.findByRole("button", { name: /save page/i }).click();
  cy.findByText(/persisted page/i).should("be.visible");
}

function textSectionForms() {
  return cy.get('form[id^="text-section-block-editor-"]');
}

function textSectionCardAt(index: number) {
  return textSectionForms().eq(index).parent();
}

function getTextSectionHeadlines() {
  return textSectionForms()
    .find('input[name="headline"]')
    .then(($inputs) =>
      $inputs.map((_, el) => (el as HTMLInputElement).value).get(),
    );
}

describe("admin cms text-section block editor", () => {
  beforeEach(() => {
    cy.loginAsRole("moderator");
    runUploadDbCommand("delete-page", { pageKey: "home" });
  });

  afterEach(() => {
    runUploadDbCommand("delete-page", { pageKey: "home" });
  });

  it("edits a text-section headline and body; public page reflects the change", () => {
    materializeHomePage();

    textSectionForms()
      .first()
      .within(() => {
        cy.findByLabelText(/^headline$/i)
          .clear()
          .type("Updated section headline");
        cy.findByLabelText(/^body$/i)
          .clear()
          .type("Updated section body text.");
        cy.findByRole("button", { name: /save block/i }).click();
      });

    cy.findByText(/persisted page/i).should("be.visible");

    cy.visitAndCheck("/admin/pages/home");
    textSectionForms()
      .first()
      .within(() => {
        cy.findByLabelText(/^headline$/i).should(
          "have.value",
          "Updated section headline",
        );
      });

    cy.visitAndCheck("/");
    cy.contains("Updated section headline").should("be.visible");
    cy.contains("Updated section body text.").should("be.visible");
  });

  it("shows validation errors when headline or body is empty, preserving entered values", () => {
    materializeHomePage();

    textSectionForms()
      .first()
      .within(() => {
        cy.findByLabelText(/^headline$/i)
          .clear()
          .type("Valid headline but empty body");
        cy.findByLabelText(/^body$/i).clear();
        cy.findByRole("button", { name: /save block/i }).click();
      });

    cy.findByText(/body is required/i).should("be.visible");
    textSectionForms()
      .first()
      .within(() => {
        cy.findByLabelText(/^headline$/i).should(
          "have.value",
          "Valid headline but empty body",
        );
      });
  });

  it("adds a new text-section block via the add button; it appears at the end", () => {
    materializeHomePage();

    textSectionForms().then(($forms) => {
      const initialCount = $forms.length;

      cy.findByRole("button", { name: /\+ add text section/i }).click();
      cy.findByText(/persisted page/i).should("be.visible");

      textSectionForms().should("have.length", initialCount + 1);
      textSectionForms()
        .last()
        .find('input[name="headline"]')
        .should("have.value", "");
    });
  });

  it("deletes a text-section block; block count decreases", () => {
    materializeHomePage();

    textSectionForms().then(($forms) => {
      const initialCount = $forms.length;

      textSectionCardAt(0).within(() => {
        cy.findByRole("button", { name: /delete block/i }).click();
      });

      cy.findByText(/persisted page/i).should("be.visible");
      textSectionForms().should("have.length", initialCount - 1);
    });
  });

  it("moves a text-section block up with the move-up button", () => {
    materializeHomePage();

    getTextSectionHeadlines().then((headlinesBefore) => {
      textSectionCardAt(2).within(() => {
        cy.findByRole("button", { name: /move up/i }).click();
      });

      cy.findByText(/persisted page/i).should("be.visible");

      getTextSectionHeadlines().then((headlinesAfterMove) => {
        expect(headlinesAfterMove).to.deep.eq([
          headlinesBefore[0],
          headlinesBefore[2],
          headlinesBefore[1],
        ]);
      });
    });
  });

  it("persists text-section order after reload and public rendering", () => {
    materializeHomePage();

    getTextSectionHeadlines().then((headlinesBefore) => {
      textSectionCardAt(2).within(() => {
        cy.findByRole("button", { name: /move up/i }).click();
      });
      cy.findByText(/persisted page/i).should("be.visible");

      getTextSectionHeadlines().then((headlinesAfterMove) => {
        expect(headlinesAfterMove).to.deep.eq([
          headlinesBefore[0],
          headlinesBefore[2],
          headlinesBefore[1],
        ]);

        cy.reload();
        getTextSectionHeadlines().then((headlinesAfterReload) => {
          expect(headlinesAfterReload).to.deep.eq(headlinesAfterMove);
        });

        cy.visitAndCheck("/");
        cy.get("main h2").then(($headings) => {
          const publicHeadlines = $headings
            .map((_, el) => (el.textContent ?? "").trim())
            .get();
          expect(
            publicHeadlines.slice(0, headlinesAfterMove.length),
          ).to.deep.eq(headlinesAfterMove);
        });
      });
    });
  });

  it("enforces text-section controls while keeping hero immutable", () => {
    materializeHomePage();

    cy.get('form[id^="hero-block-editor-"]')
      .first()
      .parent()
      .within(() => {
        cy.findByRole("button", { name: /delete block/i }).should("not.exist");
      });

    textSectionCardAt(0).within(() => {
      cy.findByRole("button", { name: /delete block/i }).should("be.visible");
      cy.findByRole("button", { name: /move down/i }).should("be.visible");
      cy.findByRole("button", { name: /move up/i }).should("not.exist");
    });
  });
});
