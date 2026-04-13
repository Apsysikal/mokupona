import {
  FILE_TOO_LARGE_ERROR,
  runUploadDbCommand,
  uploadFileInput,
  VALID_UPLOAD_FIXTURE_PATH,
  ZOD_LIMIT_BYTES,
} from "../support/upload-test-utils";

function materializeHomePage() {
  cy.visitAndCheck("/admin/pages/home");
  cy.findByRole("button", { name: /save page/i }).click();
  cy.findByText(/persisted page/i).should("be.visible");
}

function setHeroImageReplacement(file: string | Cypress.FileReferenceObject) {
  cy.findByLabelText(/^image action$/i).select("replace");
  cy.findByLabelText(/^upload image file$/i).selectFile(file, {
    force: true,
  });
  cy.findByLabelText(/^image accessibility$/i).select("decorative");
}

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
    cy.findByText(/persisted page/i).should("be.visible");

    cy.findByLabelText(/^headline$/i).should("be.visible");
    cy.findByLabelText(/^headline$/i).clear();
    cy.findByLabelText(/^headline$/i).type("Edited headline with invalid CTA", {
      delay: 0,
    });

    cy.findByLabelText(/^cta label$/i).should("be.visible");
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

  it("serves a non-broken homepage hero image after uploading a CMS image", () => {
    materializeHomePage();
    setHeroImageReplacement(VALID_UPLOAD_FIXTURE_PATH);

    cy.findByRole("button", { name: /save block/i }).click();
    cy.findByText(/persisted page/i).should("be.visible");

    cy.visitAndCheck("/");
    cy.get("section img")
      .first()
      .should("have.attr", "src")
      .and("match", /^\/file\//)
      .then((src) => {
        cy.request(String(src)).its("status").should("eq", 200);
      });

    cy.get("section img")
      .first()
      .should(($img) => {
        const image = $img[0] as HTMLImageElement | undefined;
        expect(image?.naturalWidth ?? 0).to.be.greaterThan(0);
      });
  });

  it("shows a validation error when the uploaded hero image is larger than 3MB", () => {
    materializeHomePage();
    setHeroImageReplacement(
      uploadFileInput(ZOD_LIMIT_BYTES + 1, { fileName: "zod-too-large.jpg" }),
    );

    cy.findByRole("button", { name: /save block/i }).click();
    cy.findByText(FILE_TOO_LARGE_ERROR).should("be.visible");
  });

  it("requires an explicit accessibility choice before replacing the hero image", () => {
    materializeHomePage();

    cy.findByLabelText(/^image action$/i).select("replace");
    cy.findByLabelText(/^upload image file$/i).selectFile(
      VALID_UPLOAD_FIXTURE_PATH,
      {
        force: true,
      },
    );

    cy.findByRole("button", { name: /save block/i }).click();
    cy.findByText(/image accessibility choice is required/i).should(
      "be.visible",
    );
  });

  it("updates uploaded hero accessibility metadata without requiring a second upload", () => {
    materializeHomePage();
    cy.findByLabelText(/^image action$/i).select("replace");
    cy.findByLabelText(/^upload image file$/i).selectFile(
      VALID_UPLOAD_FIXTURE_PATH,
      {
        force: true,
      },
    );
    cy.findByLabelText(/^image accessibility$/i).select("descriptive");
    cy.findByLabelText(/^image alt text$/i)
      .clear()
      .type("Original hero alt text");

    cy.findByRole("button", { name: /save block/i }).click();
    cy.findByText(/persisted page/i).should("be.visible");

    cy.visitAndCheck("/admin/pages/home");
    cy.findByLabelText(/^image action$/i).should("have.value", "keep");
    cy.findByLabelText(/^image accessibility$/i).select("descriptive");
    cy.findByLabelText(/^image alt text$/i)
      .clear()
      .type("Updated hero alt text");

    cy.findByRole("button", { name: /save block/i }).click();
    cy.findByText(/persisted page/i).should("be.visible");

    cy.visitAndCheck("/");
    cy.get("section img")
      .first()
      .should("have.attr", "alt", "Updated hero alt text");
  });
});
