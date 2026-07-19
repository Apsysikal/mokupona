import { faker } from "@faker-js/faker";

import {
  acceptPrivacyAndJoin,
  fillSignupContact,
} from "../support/upload-test-utils";

describe("dinner signup", () => {
  function visitFirstDinner() {
    cy.visitAndCheck("/dinners");
    cy.findAllByRole("link", { name: /read more/i })
      .first()
      .click();
  }

  function fillSigner(name = faker.person.fullName()) {
    fillSignupContact({
      name,
      email: `${faker.internet.username()}@example.com`,
    });
  }

  function addFriend(name: string) {
    cy.findByRole("button", { name: /add a friend/i }).click();
    cy.findAllByRole("textbox", { name: /^name$/i })
      .should("have.length", 2)
      .last()
      .type(name);
  }

  it("allows signing up for a dinner", () => {
    visitFirstDinner();

    fillSigner();
    acceptPrivacyAndJoin();
  });

  it("allows signing up with a friend", () => {
    visitFirstDinner();

    fillSigner();
    addFriend(faker.person.fullName());
    acceptPrivacyAndJoin();
  });

  it("shows a new signup in the admin table and CSV export", () => {
    const suffix = `${Date.now()}`;
    const signerName = `Cypress Signer ${suffix}`;
    const friendName = `Cypress Friend ${suffix}`;

    visitFirstDinner();
    // wait for the client-side navigation to commit before capturing the id
    cy.location("pathname")
      .should("match", /^\/dinners\/[^/]+$/)
      .then((pathname) => {
        const dinnerId = pathname.split("/").pop();

        fillSignupContact({
          name: signerName,
          email: `signer-${suffix}@example.com`,
        });
        addFriend(friendName);
        acceptPrivacyAndJoin();

        cy.loginAsRole("moderator");

        // the admin table shows one row per party: the signer fronts the
        // row and the friend only bumps the party size
        cy.visitAndCheck(`/admin/dinners/${dinnerId}/signups`);
        cy.findByText(signerName)
          .closest("tr")
          .within(() => {
            cy.findByText("2");
          });

        cy.request(`/admin/dinners/${dinnerId}/signups.csv`).then(
          (response) => {
            expect(response.body).to.include(signerName);
            expect(response.body).to.include(friendName);
          },
        );
      });
  });

  it("shows validation errors for an empty submission", () => {
    visitFirstDinner();

    cy.findByRole("button", { name: /join/i }).click();

    cy.findByText("Name is required");
    cy.findByText("Email is required");
    cy.findByText("Phone number is required");
    cy.findByText("You must agree to signup");
    cy.location("pathname").should("not.equal", "/dinners");
  });
});
