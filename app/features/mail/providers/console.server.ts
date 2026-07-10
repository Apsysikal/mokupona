import type { MailProvider } from "../types";

// Local-dev default: no API key, the verification/reset/invite links land in
// the server log instead of an inbox.
export const consoleProvider: MailProvider = {
  async send(message) {
    console.info(
      [
        "📬 mail (console provider)",
        `To:      ${message.to}`,
        `Subject: ${message.subject}`,
        "",
        message.text,
      ].join("\n"),
    );
  },
};
