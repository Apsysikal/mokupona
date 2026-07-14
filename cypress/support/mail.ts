import { latestMailPath } from "~/features/mail/capture.shared";

interface CapturedMail {
  to: string;
  subject: string;
  text: string;
  html?: string;
  sequence: number;
}

// The app must run with MAIL_PROVIDER=capture (the e2e default) for these to
// find anything. cy.readFile retries until the file exists, which doubles as
// "wait for the mail to arrive".
export function readLatestMailTo(
  email: string,
): Cypress.Chainable<CapturedMail> {
  return cy.readFile(latestMailPath(email), { timeout: 10_000 });
}

// First absolute link in the mail text whose path contains `pathPart`
// (e.g. "/reset-password", "/verify-email", "/invite/").
function extractMailLink(mail: CapturedMail, pathPart: string): string {
  const links = mail.text.match(/https?:\/\/[^\s"'<>)]+/g) ?? [];
  const link = links.find((url) => new URL(url).pathname.includes(pathPart));
  if (!link) {
    throw new Error(
      `No link containing "${pathPart}" in mail "${mail.subject}" to ${mail.to}:\n${mail.text}`,
    );
  }
  return link;
}

// Convenience: visit a mailed link, stripping the origin so the visit stays
// on Cypress' baseUrl even if the app rendered an absolute URL.
export function visitMailLink(mail: CapturedMail, pathPart: string) {
  const url = new URL(extractMailLink(mail, pathPart));
  return cy.visit(url.pathname + url.search);
}
