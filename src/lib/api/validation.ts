import type { FieldErrors } from "./responses";

/**
 * Tiny field validators for API bodies. Each reads `body[field]`, records an
 * Italian message in `errors` when it is invalid and returns the clean value.
 */
export class BodyReader {
  readonly errors: FieldErrors = {};

  constructor(private readonly body: Record<string, unknown>) {}

  get ok(): boolean {
    return Object.keys(this.errors).length === 0;
  }

  has(field: string): boolean {
    return this.body[field] !== undefined;
  }

  private fail(field: string, message: string): undefined {
    this.errors[field] ??= message;
    return undefined;
  }

  text(
    field: string,
    { required = true, max = 200 }: { required?: boolean; max?: number } = {},
  ): string | undefined {
    const raw = this.body[field];
    if (raw === undefined || raw === null || raw === "") {
      return required ? this.fail(field, "Campo obbligatorio.") : undefined;
    }
    if (typeof raw !== "string") return this.fail(field, "Valore non valido.");
    const value = raw.trim();
    if (required && !value) return this.fail(field, "Campo obbligatorio.");
    if (value.length > max)
      return this.fail(field, `Massimo ${max} caratteri.`);
    return value;
  }

  email(field = "email"): string | undefined {
    const value = this.text(field, { max: 254 });
    if (value === undefined) return undefined;
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(value)) {
      return this.fail(
        field,
        "Inserisci un'email valida, es. nome@esempio.it.",
      );
    }
    return value.toLowerCase();
  }

  password(field = "password", { min = 1 } = {}): string | undefined {
    const raw = this.body[field];
    if (typeof raw !== "string" || raw.length === 0) {
      return this.fail(field, "Campo obbligatorio.");
    }
    if (raw.length < min) return this.fail(field, `Almeno ${min} caratteri.`);
    if (raw.length > 72) return this.fail(field, "Massimo 72 caratteri.");
    return raw;
  }

  oneOf<T extends string>(
    field: string,
    values: readonly T[],
    { required = true }: { required?: boolean } = {},
  ): T | undefined {
    const raw = this.body[field];
    if (raw === undefined || raw === null || raw === "") {
      return required ? this.fail(field, "Campo obbligatorio.") : undefined;
    }
    return values.includes(raw as T)
      ? (raw as T)
      : this.fail(field, "Valore non ammesso.");
  }

  date(field: string, { required = true } = {}): string | undefined {
    const raw = this.text(field, { required, max: 10 });
    if (raw === undefined) return undefined;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(raw) || Number.isNaN(Date.parse(raw))) {
      return this.fail(field, "Data non valida (AAAA-MM-GG).");
    }
    return raw;
  }

  timestamp(field: string): string | null | undefined {
    const raw = this.body[field];
    if (raw === null) return null;
    if (raw === undefined) return undefined;
    if (typeof raw !== "string" || Number.isNaN(Date.parse(raw))) {
      return this.fail(field, "Data e ora non valide (ISO 8601).");
    }
    return raw;
  }

  integer(field: string, { min = 0 } = {}): number | undefined {
    const raw = this.body[field];
    if (typeof raw !== "number" || !Number.isInteger(raw) || raw < min) {
      return this.fail(field, `Inserisci un numero intero ≥ ${min}.`);
    }
    return raw;
  }

  literal(field: string, expected: true, message: string): true | undefined {
    return this.body[field] === expected ? expected : this.fail(field, message);
  }

  /** Copies only the keys that are present, for PATCH bodies. */
  pick<T extends Record<string, unknown>>(values: T): Partial<T> {
    return Object.fromEntries(
      Object.entries(values).filter(([, value]) => value !== undefined),
    ) as Partial<T>;
  }
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUuid(value: string): boolean {
  return UUID_RE.test(value);
}
