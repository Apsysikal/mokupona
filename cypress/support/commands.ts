import { faker } from "@faker-js/faker";

type TestUser = { email: string };

function setSessionCookie(command: string) {
  return cy.exec(command).then(({ stdout }) => {
    const value = stdout
      .replace(/.*<cookie>(?<cookieValue>.*)<\/cookie>.*/s, "$<cookieValue>")
      .trim();
    cy.setCookie("better-auth.session_token", value);
  });
}

declare global {
  namespace Cypress {
    interface Chainable {
      login: typeof login;

      loginAsRole: typeof loginAsRole;

      cleanupUser: typeof cleanupUser;

      visitAndCheck: typeof visitAndCheck;
    }
  }
}

function login({
  email = faker.internet.email({ provider: "example.com" }),
}: {
  email?: string;
} = {}) {
  cy.then((): TestUser => ({ email })).as("user");
  setSessionCookie(`npx tsx ./cypress/support/create-user.ts "${email}"`);
  return cy.get<TestUser>("@user");
}

function loginAsRole(role: "moderator" | "admin" = "moderator") {
  setSessionCookie(
    `npx tsx ./cypress/support/create-role-session.ts "${role}"`,
  );
}

function cleanupUser({ email }: { email?: string } = {}) {
  if (email) {
    deleteUserByEmail(email);
  } else {
    cy.get<TestUser>("@user").then(({ email }) => {
      deleteUserByEmail(email);
    });
  }
  cy.clearCookie("better-auth.session_token");
}

function deleteUserByEmail(email: string) {
  cy.exec(`npx tsx ./cypress/support/delete-user.ts "${email}"`);
  cy.clearCookie("better-auth.session_token");
}

function visitAndCheck(url: string, waitTime = 1000) {
  cy.visit(url);
  cy.location("pathname").should("contain", url).wait(waitTime);
}

export const registerCommands = () => {
  Cypress.Commands.add("login", login);
  Cypress.Commands.add("loginAsRole", loginAsRole);
  Cypress.Commands.add("cleanupUser", cleanupUser);
  Cypress.Commands.add("visitAndCheck", visitAndCheck);
};
