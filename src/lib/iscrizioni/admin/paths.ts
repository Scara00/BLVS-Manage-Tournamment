/** w-admin-iscritti of a stage. */
export function iscrittiPath(id: string): string {
  return `/admin/tappe/${encodeURIComponent(id)}/iscritti`;
}
