import { faker } from "@faker-js/faker";

import { readLatestMailTo, visitMailLink } from "../support/mail";

function createInviteToken(
  email: string,
  role: "user" | "moderator",
  expired = false,
) {
  return cy
    .exec(
      `npx tsx ./cypress/support/create-invite.ts "${email}" "${role}" ${
        expired ? "expired" : ""
      }`,
    )
    .then(({ stdout }) => {
      return stdout
        .replace(/.*<token>(?<token>.*)<\/token>.*/s, "$<token>")
        .trim();
    });
}

describe("invites", () => {
  afterEach(() => {
    cy.cleanupUser();
  });

  it("lets an admin invite a new moderator who signs up through the link", () => {
    const invitee = {
      name: faker.person.fullName(),
      email: `${faker.internet.username()}@example.com`.toLowerCase(),
      password: faker.internet.password(),
    };
    cy.then(() => ({ email: invitee.email })).as("user");

    // create the invite through the admin UI
    cy.loginAsRole("admin");
    cy.visitAndCheck("/admin/users");
    cy.findByRole("button", { name: /invite/i }).click();
    cy.findByRole("textbox", { name: /email address/i }).type(invitee.email);
    cy.findByLabelText(/moderator/i).click({ force: true });
    cy.findByRole("button", { name: /send invite/i }).click();

    // pending invite row appears
    cy.findByText(invitee.email);
    cy.findByText(/moderator · invited today · expires in 7 days/i);

    // follow the invite mail as the (logged-out) invitee
    cy.clearCookie("better-auth.session_token");
    readLatestMailTo(invitee.email).then((mail) => {
      visitMailLink(mail, "/invite/");
    });

    cy.findByRole("heading", { name: /accept your invite/i });
    // the bound address is locked
    cy.findByLabelText(/email address/i).should("be.disabled");
    cy.findByRole("textbox", { name: /name/i }).type(invitee.name);
    cy.findByLabelText(/^password$/i).type(invitee.password);
    cy.findByRole("button", { name: /accept & create account/i }).click();

    // lands in the admin area as a moderator, no verification hop needed
    cy.location("pathname").should("equal", "/admin");
  });

  it("rejects a reused invite link", () => {
    const invitee = {
      email: `${faker.internet.username()}@example.com`.toLowerCase(),
      password: faker.internet.password(),
    };
    cy.then(() => ({ email: invitee.email })).as("user");

    createInviteToken(invitee.email, "moderator").then((token) => {
      cy.visit(`/invite/${token}`);
      cy.findByRole("textbox", { name: /name/i }).type("test person");
      cy.findByLabelText(/^password$/i).type(invitee.password);
      cy.findByRole("button", { name: /accept & create account/i }).click();
      cy.location("pathname").should("equal", "/admin");

      // second use dead-ends
      cy.clearCookie("better-auth.session_token");
      cy.visit(`/invite/${token}`);
      cy.findByRole("heading", {
        name: /this invite has already been accepted/i,
      });
    });
  });

  it("upgrades an existing logged-in user via the confirm screen", () => {
    cy.login().then((user) => {
      const { email } = user;

      createInviteToken(email, "moderator").then((token) => {
        cy.visit(`/invite/${token}`);

        cy.findByRole("heading", { name: /accept your invite/i });
        cy.findByRole("button", {
          name: /accept and become a moderator/i,
        }).click();

        cy.location("pathname").should("equal", "/admin");
      });
    });
  });

  it("dead-ends an expired invite", () => {
    const email = `${faker.internet.username()}@example.com`.toLowerCase();
    cy.then(() => ({ email })).as("user");

    createInviteToken(email, "user", true).then((token) => {
      cy.visit(`/invite/${token}`);
      cy.findByRole("heading", { name: /this invite has expired/i });
    });
  });

  it("explains a signed-in email mismatch", () => {
    cy.login().then(() => {
      const otherEmail =
        `${faker.internet.username()}@example.com`.toLowerCase();

      createInviteToken(otherEmail, "user").then((token) => {
        cy.visit(`/invite/${token}`);
        cy.findByRole("heading", {
          name: /this invite is for a different account/i,
        });
        cy.findByRole("button", { name: /log out & retry/i }).click();

        // logged out and back on the invite — now the signup form shows
        cy.findByRole("heading", { name: /accept your invite/i });
        cy.findByLabelText(/email address/i).should("be.disabled");
      });
    });
  });
});
