import { runUploadDbCommand } from "../support/upload-test-utils";

describe("admin cms pages", () => {
  beforeEach(() => {
    cy.loginAsRole("moderator");
    runUploadDbCommand("delete-page", { pageKey: "home" });
  });

  afterEach(() => {
    runUploadDbCommand("delete-page", { pageKey: "home" });
  });

  it("materializes the home page and bumps revision on subsequent page-meta saves", () => {
    cy.visitAndCheck("/admin");
    cy.findByRole("link", { name: /manage pages/i }).click();
    cy.location("pathname").should("eq", "/admin/pages");

    cy.findByRole("link", { name: /^edit$/i }).click();
    cy.location("pathname").should("eq", "/admin/pages/home");

    cy.findByText(/default-backed page/i).should("be.visible");

    cy.findByLabelText(/^title$/i)
      .clear()
      .type("cms home title");
    cy.findByLabelText(/^description$/i)
      .clear()
      .type("cms home description");
    cy.findByRole("button", { name: /save page/i }).click();

    cy.findByText(/persisted page/i).should("be.visible");
    cy.findByText(/revision 1/i).should("be.visible");

    cy.findByLabelText(/^title$/i)
      .clear()
      .type("cms home title updated");
    cy.findByRole("button", { name: /save page/i }).click();

    cy.findByText(/revision 2/i).should("be.visible");

    cy.visitAndCheck("/");
    cy.title().should("eq", "cms home title updated");
    cy.get('meta[name="description"]').should(
      "have.attr",
      "content",
      "cms home description",
    );
  });

  it("shows required-field validation errors without dropping the entered form state", () => {
    cy.visitAndCheck("/admin/pages/home");

    cy.findByLabelText(/^title$/i).clear();
    cy.findByLabelText(/^description$/i)
      .clear()
      .type("still here");

    cy.findByRole("button", { name: /save page/i }).click();

    cy.findByText(/title is required/i).should("be.visible");
    cy.findByLabelText(/^description$/i).should("have.value", "still here");
    cy.findByText(/default-backed page/i).should("be.visible");
  });

  it("falls back to defaults and shows diagnostics for invalid persisted page content", () => {
    runUploadDbCommand("seed-invalid-page", {
      pageKey: "home",
    });

    cy.visitAndCheck("/admin/pages");
    cy.findByText(/invalid data/i).should("be.visible");

    cy.visitAndCheck("/admin/pages/home");
    cy.findByText(/showing defaults instead/i).should("be.visible");
    cy.findByText(/default-backed page/i).should("be.visible");
    cy.findByLabelText(/^title$/i).should("have.value", "moku pona");

    cy.visitAndCheck("/");
    cy.title().should("eq", "moku pona");
  });

  it("refreshes the editor with current values after a stale save conflict", () => {
    cy.visitAndCheck("/admin/pages/home");

    cy.findByLabelText(/^title$/i)
      .clear()
      .type("stale local title");
    cy.findByLabelText(/^description$/i)
      .clear()
      .type("stale local description");

    runUploadDbCommand("save-page-meta", {
      pageKey: "home",
      title: "remote current title",
      description: "remote current description",
    });

    cy.findByRole("button", { name: /save page/i }).click();

    cy.findByText(/changed by someone else/i).should("be.visible");
    cy.findByText(/revision 1/i).should("be.visible");
    cy.findByLabelText(/^title$/i).should("have.value", "remote current title");
    cy.findByLabelText(/^description$/i).should(
      "have.value",
      "remote current description",
    );

    cy.findByLabelText(/^title$/i)
      .clear()
      .type("resolved title");
    cy.findByRole("button", { name: /save page/i }).click();

    cy.findByText(/revision 2/i).should("be.visible");
  });
});
