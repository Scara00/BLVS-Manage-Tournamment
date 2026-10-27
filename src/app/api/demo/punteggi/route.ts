import {
  demoPunteggiGet,
  demoPunteggiPost,
} from "@/lib/demo/coda-punteggi-route";

/** e2e fixture for the score queue (BLVS-33), 404 unless TAPPE_DEMO_SEED=true. */
export async function POST(request: Request) {
  return demoPunteggiPost(request);
}

export async function GET(request: Request) {
  return demoPunteggiGet(request);
}
