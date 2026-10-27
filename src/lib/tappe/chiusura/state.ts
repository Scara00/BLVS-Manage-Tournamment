/** Result of «Concludi tabellone»; expected failures are values, never throws. */
export type ConcludiTabelloneState =
  | { status: "idle" }
  | {
      status: "success";
      message: string;
      /** Both boards closed: the stage is concluded. */
      tappaConclusa: boolean;
      at: number;
    }
  | {
      status: "error";
      reason:
        | "bloccato"
        | "conflict"
        | "sessionExpired"
        | "permissionDenied"
        | "network";
      message: string;
      /** «Risolvi parità»: where the open tie is decided. */
      link?: { href: string; label: string };
      at: number;
    };

export const initialConcludiTabelloneState: ConcludiTabelloneState = {
  status: "idle",
};

export type ConcludiTabelloneAction = (
  prev: ConcludiTabelloneState,
  formData: FormData,
) => Promise<ConcludiTabelloneState>;
