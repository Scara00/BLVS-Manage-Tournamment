import { MIN_PASSWORD_LENGTH } from "./messages";

/**
 * Password rules shared by every form that sets a password (reset, sign-up)
 * and by the API that receives it. They match Supabase Auth's own check in
 * supabase/config.toml: `minimum_password_length = 10` and
 * `password_requirements = "letters_digits"` (ASCII letters and digits).
 * 72 is bcrypt's limit: longer passwords would be truncated.
 */
export const MAX_PASSWORD_LENGTH = 72;

export type PasswordRequirementId = "lunghezza" | "lettera" | "cifra";

export type PasswordRequirement = {
  id: PasswordRequirementId;
  label: string;
  test: (password: string) => boolean;
};

export const PASSWORD_REQUIREMENTS: readonly PasswordRequirement[] = [
  {
    id: "lunghezza",
    label: `Da ${MIN_PASSWORD_LENGTH} a ${MAX_PASSWORD_LENGTH} caratteri`,
    test: (pw) =>
      pw.length >= MIN_PASSWORD_LENGTH && pw.length <= MAX_PASSWORD_LENGTH,
  },
  {
    id: "lettera",
    label: "Almeno una lettera",
    test: (pw) => /[A-Za-z]/.test(pw),
  },
  { id: "cifra", label: "Almeno un numero", test: (pw) => /[0-9]/.test(pw) },
];

export const PASSWORD_MATCH_LABEL = "Le due password coincidono";

export type RequirementResult = { id: string; label: string; met: boolean };

/**
 * Every requirement with its outcome, for the ✓/✕ list next to the field.
 * With `confirmation` it also reports whether the two passwords match.
 */
export function checkPassword(
  password: string,
  confirmation?: string,
): RequirementResult[] {
  const results: RequirementResult[] = PASSWORD_REQUIREMENTS.map((r) => ({
    id: r.id,
    label: r.label,
    met: r.test(password),
  }));
  if (confirmation !== undefined) {
    results.push({
      id: "coincidono",
      label: PASSWORD_MATCH_LABEL,
      met: password.length > 0 && password === confirmation,
    });
  }
  return results;
}

/**
 * Field errors for a new password and its confirmation (empty when valid),
 * keyed like the form fields: `password`, `conferma`.
 */
export function newPasswordErrors(
  password: string,
  confirmation: string,
): Partial<Record<"password" | "conferma", string>> {
  const errors: Partial<Record<"password" | "conferma", string>> = {};
  if (!password) {
    errors.password = "Inserisci la nuova password.";
  } else {
    const missing = PASSWORD_REQUIREMENTS.filter((r) => !r.test(password));
    if (missing.length > 0) {
      errors.password = `La password non rispetta i requisiti: ${missing
        .map((r) => r.label.toLowerCase())
        .join(", ")}.`;
    }
  }
  if (!confirmation) {
    errors.conferma = "Ripeti la nuova password.";
  } else if (password !== confirmation) {
    errors.conferma = "Le due password non coincidono.";
  }
  return errors;
}
