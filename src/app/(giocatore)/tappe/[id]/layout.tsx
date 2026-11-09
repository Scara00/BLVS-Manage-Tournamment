import { Suspense } from "react";
import { AvvisoTappaProva } from "@/components/tappa/avviso-tappa-prova";
import { leggiTappaInProva } from "@/lib/tappe/prova-read";

async function AvvisoSeInProva({ id }: { id: string }) {
  if (!(await leggiTappaInProva(id))) return null;
  return (
    <div className="mx-auto w-full max-w-frame px-inset pt-space-6 md:px-inset-lg">
      <AvvisoTappaProva />
    </div>
  );
}

/**
 * Every page of a stage. A «tappa di prova» (a draft only admins see)
 * shows a notice above the page; any other stage renders as before.
 */
export default function TappaLayout({
  children,
  params,
}: LayoutProps<"/tappe/[id]">) {
  return (
    <>
      <Suspense fallback={null}>
        {params.then(({ id }) => (
          <AvvisoSeInProva id={decodeURIComponent(id)} />
        ))}
      </Suspense>
      {children}
    </>
  );
}
