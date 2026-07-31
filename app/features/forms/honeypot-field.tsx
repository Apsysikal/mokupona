import {
  HONEYPOT_FIELD_NAME,
  HONEYPOT_VALID_FROM_FIELD_NAME,
} from "./honeypot";

import { useHoneypotProps } from "~/shared/root-data";

/**
 * Spam trap: fields a browser never shows but a form-filling bot will fill.
 * The hiding CSS ships inline with the markup so the trap can never flash
 * visible, and `sr-only` is deliberately avoided — an announced field is one
 * a real user would fill. The labels are the escape hatch for anyone who
 * sees it anyway.
 *
 * Kept out of `~/components/forms` on purpose: reading root loader data pulls
 * the generated root route types in, and `cypress/tsconfig.json` declares no
 * `rootDirs` to resolve them. Only the two public form routes import this.
 */
export function HoneypotField() {
  const honeypot = useHoneypotProps();

  return (
    <div
      id={`${HONEYPOT_FIELD_NAME}_wrap`}
      className="__honeypot_inputs"
      aria-hidden="true"
    >
      <style>{`.__honeypot_inputs { display: none; }`}</style>
      <label htmlFor={HONEYPOT_FIELD_NAME}>Please leave this field blank</label>
      <input
        id={HONEYPOT_FIELD_NAME}
        name={HONEYPOT_FIELD_NAME}
        type="text"
        defaultValue=""
        // invalid on purpose: browsers autofill `off` far more eagerly
        autoComplete="nope"
        tabIndex={-1}
      />
      <label htmlFor={HONEYPOT_VALID_FROM_FIELD_NAME}>
        Please leave this field blank
      </label>
      <input
        id={HONEYPOT_VALID_FROM_FIELD_NAME}
        name={HONEYPOT_VALID_FROM_FIELD_NAME}
        type="text"
        value={honeypot.validFrom}
        readOnly
        autoComplete="off"
        tabIndex={-1}
      />
    </div>
  );
}
