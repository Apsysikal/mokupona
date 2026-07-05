import {
  acceptPrivacyAndJoin,
  dinnerFormValues,
  fillDinnerForm,
  fillSignupContact,
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

    // and a select question with an options editor
    cy.findByRole("button", { name: /^add field$/i }).click();
    cy.findAllByLabelText(/^type$/i)
      .last()
      .select("select");
    cy.findAllByLabelText(/^label$/i)
      .last()
      .type("Menu choice")
      .blur();
    cy.findByLabelText(/options \(one per line\)/i).type("Meat\nVegan");

    cy.findByRole("button", { name: /create dinner/i }).click();
    cy.findByRole("heading", { name: values.title }).should("be.visible");

    cy.location("pathname")
      .should("match", /\/admin\/dinners\/[^/.]+$/)
      .then((pathname) => {
        const dinnerId = getDinnerIdFromPathname(pathname);
        dinnersToCleanup.push(dinnerId);

        // builder round-trip: the edit screen shows the authored field again
        // (stored rows load collapsed — expand via the row header first)
        cy.visitAndCheck(`/admin/dinners/${dinnerId}/edit`);
        cy.findAllByRole("button", { name: /favorite dish/i })
          .first()
          .click();
        cy.findByDisplayValue("Favorite dish").should("be.visible");
        cy.findByDisplayValue("favorite_dish").should("be.visible");

        // the public signup page renders the custom question
        cy.visitAndCheck(`/dinners/${dinnerId}`);
        fillSignupContact({
          name: signerName,
          email: `builder-${suffix}@example.com`,
        });
        cy.findByRole("textbox", { name: /favorite dish/i }).type("Ramen");
        cy.findByRole("combobox", { name: /menu choice/i }).select("Vegan");
        acceptPrivacyAndJoin();

        // the answer reaches the admin table and the CSV column union
        cy.visitAndCheck(`/admin/dinners/${dinnerId}/signups`);
        cy.findByText(signerName);

        cy.request(`/admin/dinners/${dinnerId}/signups.csv`).then(
          (response) => {
            expect(response.body).to.include("Favorite dish");
            expect(response.body).to.include("Ramen");
            expect(response.body).to.include("Menu choice");
            expect(response.body).to.include("Vegan");
            expect(response.body).to.include(signerName);
          },
        );
      });
  });

  it("versions a submitted form and exports mixed legacy + multi-version rows", () => {
    const suffix = uniqueSuffix();
    const values = dinnerFormValues(`builder-versions-${suffix}`);
    const legacyName = `Legacy Guest ${suffix}`;
    const v1Signer = `V1 Signer ${suffix}`;
    const v1Friend = `V1 Friend ${suffix}`;
    const v2Signer = `V2 Signer ${suffix}`;

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

        // legacy rows can't be written through the app anymore
        runUploadDbCommand("create-legacy-response", {
          eventId: dinnerId,
          name: legacyName,
        });

        // v1 signup with a friend
        cy.visitAndCheck(`/dinners/${dinnerId}`);
        fillSignupContact({
          name: v1Signer,
          email: `v1-${suffix}@example.com`,
        });
        cy.findByRole("button", { name: /add a friend/i }).click();
        cy.findAllByRole("textbox", { name: /^name$/i })
          .should("have.length", 2)
          .last()
          .type(v1Friend);
        acceptPrivacyAndJoin();

        // with submissions, existing field keys are locked and edits fork v2
        cy.visitAndCheck(`/admin/dinners/${dinnerId}/edit`);
        cy.findAllByLabelText(/field key \(locked/i).should(
          "have.length.greaterThan",
          0,
        );
        // the collapsed friend twin's header is hidden, so this hits the
        // signer row
        cy.findAllByRole("button", { name: /dietary restrictions/i })
          .first()
          .click();
        cy.findAllByDisplayValue("Dietary restrictions")
          .first()
          .clear()
          .type("Allergies");
        cy.findByRole("button", { name: /update dinner/i }).click();
        cy.findByRole("heading", { name: values.title }).should("be.visible");

        // v2 signup (solo) against the renamed field
        cy.visitAndCheck(`/dinners/${dinnerId}`);
        fillSignupContact({
          name: v2Signer,
          email: `v2-${suffix}@example.com`,
        });
        cy.findAllByRole("textbox", { name: /allergies/i })
          .first()
          .type("pollen");
        acceptPrivacyAndJoin();

        // all four people from three sources share one roster and one CSV;
        // the header carries the latest label
        cy.visitAndCheck(`/admin/dinners/${dinnerId}/signups`);
        cy.findByText(legacyName);
        cy.findByText(v1Signer);
        cy.findByText(v1Friend);
        cy.findByText(v2Signer);

        cy.request(`/admin/dinners/${dinnerId}/signups.csv`).then(
          (response) => {
            expect(response.body).to.include("Allergies");
            expect(response.body).to.include(legacyName);
            expect(response.body).to.include(v1Signer);
            expect(response.body).to.include(v1Friend);
            expect(response.body).to.include(v2Signer);
            expect(response.body).to.include("pollen");
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
        // the signer one (first in DOM order — the friend twin's collapsed
        // header is hidden inside the collapsed friends row)
        cy.findAllByRole("button", { name: /dietary restrictions/i })
          .first()
          .click();
        cy.findAllByDisplayValue("Dietary restrictions")
          .first()
          .clear()
          .type("Allergies");
        cy.findAllByRole("button", { name: /friends/i })
          .first()
          .click();
        cy.findByLabelText(/max per signup/i)
          .clear()
          .type("0");
        cy.findByRole("button", { name: /update dinner/i }).click();
        cy.findByRole("heading", { name: values.title }).should("be.visible");

        // reload shows the edited form
        cy.visitAndCheck(`/admin/dinners/${dinnerId}/edit`);
        cy.findAllByRole("button", { name: /allergies/i })
          .first()
          .click();
        cy.findByDisplayValue("Allergies").should("be.visible");
        cy.findByLabelText(/max per signup/i).should("have.value", "0");

        // the public page reflects it: relabeled field, no friends button
        cy.visitAndCheck(`/dinners/${dinnerId}`);
        cy.findAllByRole("textbox", { name: /allergies/i }).should("exist");
        cy.findByRole("button", { name: /add a friend/i }).should("not.exist");
      });
  });
});
