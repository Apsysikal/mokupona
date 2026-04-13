import { runUploadDbCommand } from "../support/upload-test-utils";

describe("admin cms hero block editor", () => {
  beforeEach(() => {
    cy.loginAsRole("moderator");
    // Start fresh — default-backed page each time
    runUploadDbCommand("delete-page", { pageKey: "home" });
  });

  afterEach(() => {
    runUploadDbCommand("delete-page", { pageKey: "home" });
  });

  it("edits hero headline, CTA label, and CTA destination; admin and public pages reflect the saved changes", () => {
    cy.visitAndCheck("/admin/pages/home");

    cy.findByRole("button", { name: /save page/i }).click();
    cy.findByText(/persisted page/i).should("be.visible");

    cy.findByLabelText(/^headline$/i).should("be.visible");

    cy.findByLabelText(/^headline$/i)
      .clear()
      .type("New hero headline from CMS");
    cy.findByLabelText(/^cta label$/i)
      .clear()
      .type("Browse dinners");
    cy.findByLabelText(/^cta destination$/i).select("Dinners");

    cy.findByRole("button", { name: /save block/i }).click();
    cy.findByText(/persisted page/i).should("be.visible");

    cy.visitAndCheck("/admin/pages/home");
    cy.findByLabelText(/^headline$/i).should(
      "have.value",
      "New hero headline from CMS",
    );
    cy.findByLabelText(/^cta label$/i).should("have.value", "Browse dinners");
    cy.findByLabelText(/^cta destination$/i).should("have.value", "/dinners");

    cy.visitAndCheck("/");
    cy.contains("New hero headline from CMS").should("be.visible");
    cy.findByRole("link", { name: /browse dinners/i }).should(
      "have.attr",
      "href",
      "/dinners",
    );
  });

  it("shows block validation errors without dropping the entered hero form state", () => {
    cy.visitAndCheck("/admin/pages/home");
    cy.findByRole("button", { name: /save page/i }).click();

    cy.findByLabelText(/^headline$/i)
      .clear()
      .type("Edited headline with invalid CTA");
    cy.findByLabelText(/^cta label$/i).clear();

    cy.findByRole("button", { name: /save block/i }).click();

    cy.findByText(/cta label is required/i).should("be.visible");
    cy.findByLabelText(/^headline$/i).should(
      "have.value",
      "Edited headline with invalid CTA",
    );
    cy.findByLabelText(/^cta label$/i).should("have.value", "");
    cy.findByText(/revision 1/i).should("be.visible");
  });

  it("rejects forged block saves that post an external CTA href", () => {
    cy.visitAndCheck("/admin/pages/home");
    cy.findByRole("button", { name: /save page/i }).click();

    cy.request({
      method: "POST",
      url: "/admin/pages/home",
      form: true,
      failOnStatusCode: false,
      body: {
        intent: "set-block-data",
        blockRef: JSON.stringify({
          kind: "definition-key",
          definitionKey: "hero-main",
        }),
        blockType: "hero",
        blockVersion: "1",
        baseRevision: "1",
        eyebrow: "our next event is on may 9th",
        headline: "moku pona",
        description:
          "A dinner society in Zurich, bringing people together through shared meals, stories, and the joy of discovery.",
        "actions[0].label": "Join a dinner",
        "actions[0].href": "https://example.com",
      },
    }).then((response) => {
      expect(response.status).to.eq(200);
      expect(String(response.body)).to.include(
        "CTA destination must be one of the registered site links",
      );
    });

    cy.visitAndCheck("/admin/pages/home");
    cy.findByLabelText(/^cta destination$/i).should("have.value", "/dinners");

    cy.visitAndCheck("/");
    cy.findByRole("link", { name: /join a dinner/i }).should(
      "have.attr",
      "href",
      "/dinners",
    );
  });

  it("hero block editor shows read-only image and no move/delete controls for the fixed hero slot", () => {
    cy.visitAndCheck("/admin/pages/home");

    // The image src should appear as a read-only reference, not an editable input
    cy.findByText(/hero-image\.jpg/i).should("be.visible");
    cy.get('input[value="/hero-image.jpg"]').should("not.exist");

    // Move-up and delete buttons should not exist for the fixed hero block
    cy.findByRole("button", { name: /move up/i }).should("not.exist");
    cy.findByRole("button", { name: /delete block/i }).should("not.exist");
  });
});
