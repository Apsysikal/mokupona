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

    cy.findByRole("link", { name: /^home$/i }).click();
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
});
