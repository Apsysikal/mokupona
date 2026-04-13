import {
  runUploadDbCommand,
  VALID_UPLOAD_FIXTURE_PATH,
} from "../support/upload-test-utils";

function materializeHomePage() {
  cy.visitAndCheck("/admin/pages/home");
  cy.findByRole("button", { name: /save page/i }).click();
  cy.findByText(/persisted page/i).should("be.visible");
}

function imageForms() {
  return cy.get('form[id^="image-block-editor-"]');
}

function imageCardAt(index: number) {
  return imageForms().eq(index).parent();
}

function getImageBlockRefs() {
  return imageForms()
    .find('input[name="blockRef"]')
    .then(($inputs) =>
      $inputs.map((_, el) => (el as HTMLInputElement).value).get(),
    );
}

function parsePageBlockRef(blockRef: string): {
  kind: "page-block-id";
  pageBlockId: string;
  position: number;
} {
  return JSON.parse(blockRef) as {
    kind: "page-block-id";
    pageBlockId: string;
    position: number;
  };
}

function getPublicPictureImageCount() {
  return cy.get("main picture img").its("length");
}

describe("admin cms image block editor", () => {
  beforeEach(() => {
    cy.loginAsRole("moderator");
    runUploadDbCommand("delete-page", { pageKey: "home" });
  });

  afterEach(() => {
    runUploadDbCommand("delete-page", { pageKey: "home" });
  });

  it("adds an image block, replaces it with an upload, and reflects it on the public page", () => {
    materializeHomePage();
    cy.visitAndCheck("/");
    getPublicPictureImageCount().then((beforeCount) => {
      cy.visitAndCheck("/admin/pages/home");

      cy.findByRole("button", { name: /\+ add image block/i }).click();
      cy.findByText(/persisted page/i).should("be.visible");

      imageForms()
        .last()
        .within(() => {
          cy.findByLabelText(/^image action$/i).select("replace");
          cy.findByLabelText(/^upload image file$/i).selectFile(
            VALID_UPLOAD_FIXTURE_PATH,
            {
              force: true,
            },
          );
          cy.findByLabelText(/^image accessibility$/i).select("decorative");
          cy.findByRole("button", { name: /save block/i }).click();
        });

      cy.findByText(/persisted page/i).should("be.visible");

      cy.visitAndCheck("/");
      getPublicPictureImageCount().should("eq", beforeCount + 1);
    });
  });

  it("reorders and deletes repeatable image blocks", () => {
    materializeHomePage();

    cy.findByRole("button", { name: /\+ add image block/i }).click();
    cy.findByText(/persisted page/i).should("be.visible");
    imageForms().should("have.length", 2);

    getImageBlockRefs().then((refsBeforeMove) => {
      const movedRefBefore = parsePageBlockRef(refsBeforeMove[1]);
      imageCardAt(1).within(() => {
        cy.findByRole("button", { name: /move up/i }).click();
      });

      cy.findByText(/persisted page/i).should("be.visible");
      getImageBlockRefs().then((refsAfterMove) => {
        const movedRefAfter = refsAfterMove
          .map(parsePageBlockRef)
          .find((ref) => ref.pageBlockId === movedRefBefore.pageBlockId);

        expect(movedRefAfter).to.exist;
        expect(movedRefAfter?.position).to.eq(movedRefBefore.position - 1);
      });
    });

    imageCardAt(0).within(() => {
      cy.findByRole("button", { name: /delete block/i }).click();
    });

    cy.findByText(/persisted page/i).should("be.visible");
    imageForms().should("have.length", 1);
  });
});
