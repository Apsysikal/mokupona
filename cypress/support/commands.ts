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
      /**
       * Logs in with a random user. Yields the user and adds an alias to the user
       *
       * @returns {typeof login}
       * @memberof Chainable
       * @example
       *    cy.login()
       * @example
       *    cy.login({ email: 'whatever@example.com' })
       */
      login: typeof login;

      /**
       * Logs in as one of the seeded role accounts.
       *
       * @returns {typeof loginAsRole}
       * @memberof Chainable
       * @example
       *    cy.loginAsRole()
       * @example
       *    cy.loginAsRole("admin")
       */
      loginAsRole: typeof loginAsRole;

      /**
       * Deletes the current @user
       *
       * @returns {typeof cleanupUser}
       * @memberof Chainable
       * @example
       *    cy.cleanupUser()
       * @example
       *    cy.cleanupUser({ email: 'whatever@example.com' })
       */
      cleanupUser: typeof cleanupUser;

      /**
       * Extends the standard visit command to wait for the page to load
       *
       * @returns {typeof visitAndCheck}
       * @memberof Chainable
       * @example
       *    cy.visitAndCheck('/')
       *  @example
       *    cy.visitAndCheck('/', 500)
       */
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

// We're waiting a second because of this issue happen randomly
// https://github.com/cypress-io/cypress/issues/7306
// Also added custom types to avoid getting detached
// https://github.com/cypress-io/cypress/issues/7306#issuecomment-1152752612
// ===========================================================
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
