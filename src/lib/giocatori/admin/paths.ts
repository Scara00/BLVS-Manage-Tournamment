export const GIOCATORI_ADMIN_PATH = "/admin/giocatori";

/** w-admin-giocatore. */
export function giocatoreAdminPath(id: string): string {
  return `${GIOCATORI_ADMIN_PATH}/${encodeURIComponent(id)}`;
}
