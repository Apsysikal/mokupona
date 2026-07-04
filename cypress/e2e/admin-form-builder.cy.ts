import { faker } from "@faker-js/faker";

import {
  dinnerFormValues,
  fillDinnerForm,
  getDinnerIdFromPathname,
  runUploadDbCommand,
  uniqueSuffix,
  uploadDinnerCover,
  VALID_UPLOAD_FIXTURE_PATH,
} from "../support/upload-test-utils";

describe("admin signup form builder", () => {
  let dinnersToCleanup: string[];

  beforeEach(() => {
    dinnersToCleanup = [];
    cy.loginAsRole("moderator");
  });

  afterEach(() => {
    cy.then(() => {
      dinnersToCleanup.forEach((id) => {
        runUploadDbCommand("delete-dinner", { id });
      });
    });
  });

  it("authors a custom field that round-trips signup → admin table → CSV", () => {
    const suffix = uniqueSuffix();
    const values = dinnerFormValues(`builder-${suffix}`);
    const signerName = `Builder Signer ${suffix}`;

    cy.visitAndCheck("/admin/dinners/new");
    fillDinnerForm(values);
    uploadDinnerCover(VALID_UPLOAD_FIXTURE_PATH);

    // add a custom signer question; the field key derives from the label
    cy.findByRole("button", { name: /^add field$/i }).click();
    cy.findAllByLabelText(/^label$/i)
      .last()
      .type("Favorite dish")
      .blur();
    cy.findAllByLabelText(/^field key$/i)
      .last()
      .should("have.value", "favorite_dish");

    cy.findByRole("button", { name: /create dinner/i }).click();
    cy.findByRole("heading", { name: values.title }).should("be.visible");

    cy.location("pathname")
      .should("match", /\/admin\/dinners\/[^/.]+$/)
      .then((pathname) => {
        const dinnerId = getDinnerIdFromPathname(pathname);
        dinnersToCleanup.push(dinnerId);

        // builder round-trip: the edit screen shows the authored field again
        cy.visitAndCheck(`/admin/dinners/${dinnerId}/edit`);
        cy.findByDisplayValue("Favorite dish").should("be.visible");
        cy.findByDisplayValue("favorite_dish").should("be.visible");

        // the public signup page renders the custom question
        cy.visitAndCheck(`/dinners/${dinnerId}`);
        cy.findAllByRole("textbox", { name: /^name$/i })
          .first()
          .type(signerName);
        cy.findByRole("textbox", { name: /email/i }).type(
          `builder-${suffix}@example.com`,
        );
        cy.findByRole("textbox", { name: /phone number/i }).type(
          faker.phone.number({ style: "international" }),
        );
        cy.findByRole("textbox", { name: /favorite dish/i }).type("Ramen");
        cy.findByLabelText(/agree to privacy policy/i).click();
        cy.findByRole("button", { name: /join/i }).click();
        cy.location("pathname").should("equal", "/dinners");
        cy.findByText(/signup complete/i);

        // the answer reaches the admin table and the CSV column union
        cy.visitAndCheck(`/admin/dinners/${dinnerId}/signups`);
        cy.findByText(signerName);

        cy.request(`/admin/dinners/${dinnerId}/signups.csv`).then(
          (response) => {
            expect(response.body).to.include("Favorite dish");
            expect(response.body).to.include("Ramen");
            expect(response.body).to.include(signerName);
          },
        );
      });
  });

  it("edits a form and shows the change after reload", () => {
    const suffix = uniqueSuffix();
    const values = dinnerFormValues(`builder-edit-${suffix}`);

    cy.visitAndCheck("/admin/dinners/new");
    fillDinnerForm(values);
    uploadDinnerCover(VALID_UPLOAD_FIXTURE_PATH);
    cy.findByRole("button", { name: /create dinner/i }).click();
    cy.findByRole("heading", { name: values.title }).should("be.visible");

    cy.location("pathname")
      .should("match", /\/admin\/dinners\/[^/.]+$/)
      .then((pathname) => {
        const dinnerId = getDinnerIdFromPathname(pathname);
        dinnersToCleanup.push(dinnerId);

        // relabel a default field and disable friends
        cy.visitAndCheck(`/admin/dinners/${dinnerId}/edit`);
        // both the signer field and the friend item carry this label; edit
        // the signer one (first in DOM order)
        cy.findAllByDisplayValue("Dietary restrictions")
          .first()
          .clear()
          .type("Allergies");
        cy.findByLabelText(/maximum friends per signup/i)
          .clear()
          .type("0");
        cy.findByRole("button", { name: /update dinner/i }).click();
        cy.findByRole("heading", { name: values.title }).should("be.visible");

        // reload shows the edited form
        cy.visitAndCheck(`/admin/dinners/${dinnerId}/edit`);
        cy.findByDisplayValue("Allergies").should("be.visible");
        cy.findByLabelText(/maximum friends per signup/i).should(
          "have.value",
          "0",
        );

        // the public page reflects it: relabeled field, no friends button
        cy.visitAndCheck(`/dinners/${dinnerId}`);
        cy.findAllByRole("textbox", { name: /allergies/i }).should("exist");
        cy.findByRole("button", { name: /add a friend/i }).should("not.exist");
      });
  });
});
