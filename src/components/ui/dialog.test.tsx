import * as React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "./alert-dialog";
import { Button } from "./button";
import {
  Dialog,
  DialogAction,
  DialogBody,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "./dialog";

/** Base UI focus guards hand focus back to the dialog asynchronously. */
async function expectFocusWithin(container: HTMLElement) {
  await waitFor(() =>
    expect(container).toContainElement(document.activeElement as HTMLElement),
  );
}

function ModificaSquadra({
  initialFocus,
}: {
  initialFocus?: React.RefObject<HTMLElement | null>;
}) {
  return (
    <Dialog>
      <DialogTrigger render={<Button />}>Modifica squadra</DialogTrigger>
      <DialogContent initialFocus={initialFocus}>
        <DialogHeader>
          <DialogTitle>Modifica squadra</DialogTitle>
          <DialogDescription>Aggiorna il nome della squadra.</DialogDescription>
        </DialogHeader>
        <DialogBody>
          <label>
            Nome
            <input name="nome" />
          </label>
        </DialogBody>
        <DialogFooter>
          <DialogClose render={<Button variant="outline" />}>
            Annulla
          </DialogClose>
          <DialogAction>Salva</DialogAction>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

describe("Dialog", () => {
  it("si apre con nome e descrizione accessibili", async () => {
    const user = userEvent.setup();
    render(<ModificaSquadra />);

    await user.click(screen.getByRole("button", { name: "Modifica squadra" }));

    const dialog = await screen.findByRole("dialog", {
      name: "Modifica squadra",
    });
    expect(dialog).toHaveAccessibleDescription(
      "Aggiorna il nome della squadra.",
    );
  });

  it("intrappola il focus con Tab e Maiusc+Tab", async () => {
    const user = userEvent.setup();
    render(<ModificaSquadra />);
    await user.click(screen.getByRole("button", { name: "Modifica squadra" }));
    const dialog = await screen.findByRole("dialog");

    for (let i = 0; i < 6; i++) {
      await user.tab();
      await expectFocusWithin(dialog);
    }
    for (let i = 0; i < 6; i++) {
      await user.tab({ shift: true });
      await expectFocusWithin(dialog);
    }
  });

  it("porta il focus iniziale sull'elemento configurato", async () => {
    const user = userEvent.setup();
    function ConFocus() {
      const ref = React.useRef<HTMLButtonElement>(null);
      return (
        <Dialog>
          <DialogTrigger render={<Button />}>Apri</DialogTrigger>
          <DialogContent initialFocus={ref}>
            <DialogTitle>Titolo</DialogTitle>
            <input aria-label="Primo campo" />
            <DialogFooter>
              <DialogAction ref={ref}>Conferma</DialogAction>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      );
    }
    render(<ConFocus />);

    await user.click(screen.getByRole("button", { name: "Apri" }));

    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Conferma" })).toHaveFocus(),
    );
  });

  it("si chiude con Esc e riporta il focus al trigger", async () => {
    const user = userEvent.setup();
    render(<ModificaSquadra />);
    const trigger = screen.getByRole("button", { name: "Modifica squadra" });
    trigger.focus();
    await user.keyboard("{Enter}");
    await screen.findByRole("dialog");

    await user.keyboard("{Escape}");

    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    await waitFor(() => expect(trigger).toHaveFocus());
  });

  it("tiene il footer fuori dal corpo scorrevole", async () => {
    render(
      <Dialog defaultOpen>
        <DialogContent>
          <DialogTitle>Regolamento</DialogTitle>
          <DialogBody>Testo lungo</DialogBody>
          <DialogFooter>
            <DialogAction>Ho capito</DialogAction>
          </DialogFooter>
        </DialogContent>
      </Dialog>,
    );

    const dialog = await screen.findByRole("dialog");
    const body = dialog.querySelector('[data-slot="dialog-body"]')!;
    const footer = dialog.querySelector('[data-slot="dialog-footer"]')!;

    expect(dialog).toHaveClass("flex", "flex-col");
    expect(body).toHaveClass("overflow-y-auto", "min-h-0", "flex-1");
    expect(footer).toHaveClass("shrink-0");
    expect(body).not.toContainElement(footer as HTMLElement);
    expect(footer.parentElement).toBe(dialog);
  });

  it("mostra l'azione distruttiva in caricamento come occupata", async () => {
    render(
      <Dialog defaultOpen>
        <DialogContent>
          <DialogTitle>Elimina torneo</DialogTitle>
          <DialogFooter>
            <DialogAction
              tone="destructive"
              loading
              loadingText="Eliminazione…"
            >
              Elimina
            </DialogAction>
          </DialogFooter>
        </DialogContent>
      </Dialog>,
    );

    const action = await screen.findByRole("button", { name: "Eliminazione…" });
    expect(action).toHaveAttribute("aria-busy", "true");
    expect(action).toHaveAttribute("aria-disabled", "true");
    expect(action).toHaveAttribute("data-tone", "destructive");
    expect(action).toHaveClass("bg-error-fg", "text-white");
  });
});

function EliminaTorneo() {
  return (
    <AlertDialog>
      <AlertDialogTrigger render={<Button />}>
        Elimina torneo
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Eliminare il torneo?</AlertDialogTitle>
          <AlertDialogDescription>
            L&apos;operazione non si può annullare.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Annulla</AlertDialogCancel>
          <AlertDialogAction tone="destructive">Elimina</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

describe("AlertDialog", () => {
  it("porta il focus iniziale sull'azione sicura", async () => {
    const user = userEvent.setup();
    render(<EliminaTorneo />);

    await user.click(screen.getByRole("button", { name: "Elimina torneo" }));

    const dialog = await screen.findByRole("alertdialog", {
      name: "Eliminare il torneo?",
    });
    expect(dialog).toHaveAccessibleDescription(
      "L'operazione non si può annullare.",
    );
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Annulla" })).toHaveFocus(),
    );
  });

  it("si chiude con Esc e riporta il focus al trigger", async () => {
    const user = userEvent.setup();
    render(<EliminaTorneo />);
    const trigger = screen.getByRole("button", { name: "Elimina torneo" });
    await user.click(trigger);
    await screen.findByRole("alertdialog");

    await user.keyboard("{Escape}");

    await waitFor(() => expect(screen.queryByRole("alertdialog")).toBeNull());
    await waitFor(() => expect(trigger).toHaveFocus());
  });

  it("intrappola il focus tra le azioni", async () => {
    const user = userEvent.setup();
    render(<EliminaTorneo />);
    await user.click(screen.getByRole("button", { name: "Elimina torneo" }));
    const dialog = await screen.findByRole("alertdialog");

    for (let i = 0; i < 4; i++) {
      await user.tab();
      await expectFocusWithin(dialog);
    }
  });
});
