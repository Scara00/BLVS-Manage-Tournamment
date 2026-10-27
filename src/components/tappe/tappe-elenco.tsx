import { tappaInCorso, type TappaGiocatore } from "@/lib/tappe/format";
import { TappeLiveStrip } from "./tappe-live-strip";
import { TappeOffline } from "./tappe-offline";
import { TappeTable } from "./tappe-table";

/** The w-tappe screen body: live strip, offline notice, then the list. */
export function TappeElenco({
  tappe,
  connesso,
  offline,
}: {
  tappe: readonly TappaGiocatore[];
  connesso: boolean;
  /** Overrides the detected connection (stories). */
  offline?: boolean;
}) {
  const live = tappaInCorso(tappe);
  return (
    <div className="flex flex-col gap-stack">
      {live ? <TappeLiveStrip tappa={live} /> : null}
      <TappeOffline offline={offline} />
      <TappeTable tappe={tappe} connesso={connesso} />
    </div>
  );
}
