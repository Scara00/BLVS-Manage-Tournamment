import { useId, type ReactNode } from "react";
import { cn } from "@/lib/utils";

export type ResponsiveTableColumn<Row> = {
  key: string;
  header: string;
  /** The column that names the row (e.g. the player): `<th scope="row">`. */
  rowHeader?: boolean;
  /** Defaults to "end" for numeric columns, "start" otherwise. */
  align?: "start" | "end";
  /** Scores, points, positions: mono, tabular figures. */
  numeric?: boolean;
  /**
   * Column width on desktop as a share of the table, e.g. "15%". Avoid rem:
   * it grows with the text size and would push the table past the viewport.
   */
  width?: string;
  /** Cell content; defaults to `row[key]`. */
  render?: (row: Row) => ReactNode;
};

/** Long words and names wrap instead of forcing horizontal scroll. */
const wrap = "break-words [overflow-wrap:anywhere]";

function alignClass<Row>(column: ResponsiveTableColumn<Row>) {
  const align = column.align ?? (column.numeric ? "end" : "start");
  return align === "end" ? "text-end" : "text-start";
}

function cellValue<Row>(row: Row, column: ResponsiveTableColumn<Row>) {
  if (column.render) return column.render(row);
  return (row as Record<string, ReactNode>)[column.key];
}

/**
 * Data table on desktop, list of cards below `md`. Both views are always
 * rendered; the hidden one is `display: none`, so assistive tech meets the
 * data once. No client JS.
 */
export function ResponsiveTable<Row>({
  caption,
  captionHidden = false,
  columns,
  rows,
  getRowKey,
  cardBadgeKey,
  cardTitleKey,
  emptyMessage = "Nessun dato da mostrare.",
  className,
}: {
  /** Names the table and, on mobile, the list. */
  caption: string;
  captionHidden?: boolean;
  columns: readonly ResponsiveTableColumn<Row>[];
  rows: readonly Row[];
  getRowKey: (row: Row) => string;
  /** Column shown as the card's leading badge (e.g. position). */
  cardBadgeKey?: string;
  /** Column used as the card title; defaults to the row-header column. */
  cardTitleKey?: string;
  /** Shown instead of the table and the cards when `rows` is empty. */
  emptyMessage?: string;
  className?: string;
}) {
  const captionId = useId();
  const titleKey =
    cardTitleKey ?? columns.find((c) => c.rowHeader)?.key ?? columns[0]?.key;
  const badge = columns.find((c) => c.key === cardBadgeKey);
  const title = columns.find((c) => c.key === titleKey);
  const details = columns.filter((c) => c !== badge && c !== title);

  if (rows.length === 0) {
    return (
      <section
        aria-labelledby={captionId}
        className={cn("w-full min-w-0", className)}
      >
        <p
          id={captionId}
          className={cn(
            captionHidden
              ? "sr-only"
              : "pb-space-3 font-heading text-xl font-semibold",
          )}
        >
          {caption}
        </p>
        <p className="border border-border p-inset text-muted-foreground">
          {emptyMessage}
        </p>
      </section>
    );
  }

  return (
    <div className={cn("w-full min-w-0", className)}>
      <table className="hidden w-full table-fixed border-collapse text-start md:table">
        <caption
          className={cn(
            captionHidden
              ? "sr-only"
              : "pb-space-3 text-start font-heading text-xl font-semibold",
          )}
        >
          {caption}
        </caption>
        <thead>
          <tr className="border-b-2 border-primary">
            {columns.map((column) => (
              <th
                key={column.key}
                scope="col"
                style={column.width ? { width: column.width } : undefined}
                className={cn(
                  "px-space-3 py-space-2 align-bottom font-heading text-sm font-semibold",
                  alignClass(column),
                  wrap,
                )}
              >
                {column.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={getRowKey(row)} className="border-b border-border">
              {columns.map((column) => {
                const Cell = column.rowHeader ? "th" : "td";
                return (
                  <Cell
                    key={column.key}
                    scope={column.rowHeader ? "row" : undefined}
                    className={cn(
                      "px-space-3 py-space-3 align-top",
                      column.rowHeader
                        ? "font-heading font-semibold"
                        : "font-normal",
                      column.numeric && "font-mono tabular-nums",
                      alignClass(column),
                      wrap,
                    )}
                  >
                    {cellValue(row, column)}
                  </Cell>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>

      <div className="md:hidden">
        {captionHidden ? null : (
          <p
            id={captionId}
            className="pb-space-3 font-heading text-xl font-semibold"
          >
            {caption}
          </p>
        )}
        <ol
          aria-label={captionHidden ? caption : undefined}
          aria-labelledby={captionHidden ? undefined : captionId}
          className="flex flex-col gap-stack-sm"
        >
          {rows.map((row) => (
            <li
              key={getRowKey(row)}
              className="flex flex-wrap items-start gap-x-space-3 gap-y-space-2 border border-border bg-card p-inset"
            >
              {badge ? (
                <p className="inline-flex min-h-10 min-w-10 shrink-0 items-center justify-center bg-primary px-space-2 font-mono font-semibold text-primary-foreground tabular-nums">
                  <span className="sr-only">{badge.header} </span>
                  {cellValue(row, badge)}
                </p>
              ) : null}
              {title ? (
                <p
                  className={cn(
                    "min-w-0 flex-1 self-center font-heading text-lg font-semibold",
                    wrap,
                  )}
                >
                  {cellValue(row, title)}
                </p>
              ) : null}
              {details.length > 0 ? (
                <dl className="flex basis-full flex-wrap gap-x-space-5 gap-y-space-2">
                  {details.map((column) => (
                    <div key={column.key} className="flex min-w-0 flex-col">
                      <dt className={cn("text-sm text-muted-foreground", wrap)}>
                        {column.header}
                      </dt>
                      <dd
                        className={cn(
                          column.numeric &&
                            "font-mono text-lg font-semibold tabular-nums",
                          wrap,
                        )}
                      >
                        {cellValue(row, column)}
                      </dd>
                    </div>
                  ))}
                </dl>
              ) : null}
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}
