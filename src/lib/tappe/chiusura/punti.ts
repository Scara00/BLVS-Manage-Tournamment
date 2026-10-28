/**
 * Points of a closed board (BLVS-43): the snapshot written in the registro
 * and on the live channel, and what a correction would change.
 */
import type {
  ClassificaTappa,
  RigaClassificaTappa,
} from "@/lib/tappe/classifica/classifica";

/** One player's definitive place and points. */
export type PuntiGiocatore = {
  iscrizioneId: string;
  nome: string;
  posizione: number;
  punti: number | null;
};

export function puntiDefinitivi(
  classifica: ClassificaTappa | null,
): PuntiGiocatore[] {
  return (classifica?.righe ?? []).map(
    ({ iscrizioneId, nome, posizione, punti }) => ({
      iscrizioneId,
      nome,
      posizione,
      punti,
    }),
  );
}

/** A player whose place or points a correction changes. */
export type CambioPunti = {
  iscrizioneId: string;
  nome: string;
  prima: { posizione: number; punti: number | null } | null;
  dopo: { posizione: number; punti: number | null } | null;
};

const valore = (r: RigaClassificaTappa | undefined) =>
  r ? { posizione: r.posizione, punti: r.punti } : null;

/** Rows whose place or points differ, in the order of the new standing. */
export function puntiCheCambiano(
  prima: ClassificaTappa,
  dopo: ClassificaTappa,
): CambioPunti[] {
  const vecchie = new Map(prima.righe.map((r) => [r.iscrizioneId, r]));
  const nuove = new Map(dopo.righe.map((r) => [r.iscrizioneId, r]));
  const ids = [
    ...dopo.righe.map((r) => r.iscrizioneId),
    ...prima.righe.map((r) => r.iscrizioneId).filter((id) => !nuove.has(id)),
  ];
  return ids.flatMap((id) => {
    const p = vecchie.get(id);
    const d = nuove.get(id);
    if (p && d && p.posizione === d.posizione && p.punti === d.punti) {
      return [];
    }
    return [
      {
        iscrizioneId: id,
        nome: (d ?? p)!.nome,
        prima: valore(p),
        dopo: valore(d),
      },
    ];
  });
}

/**
 * A fingerprint of the standing the admin confirmed against: the
 * correction is refused (asked again) if the points changed meanwhile.
 */
export function firmaPunti(classifica: ClassificaTappa): string {
  return classifica.righe
    .map((r) => `${r.iscrizioneId}:${r.posizione}:${r.punti ?? "-"}`)
    .join("|");
}
