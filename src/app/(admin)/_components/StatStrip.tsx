// The mockup's "stat strip" pattern (`Admin-Calendar.dc.html`'s THIS WEEK / NO-SHOWS THIS
// WEEK / TODAY tile row), factored out so `AdminCalendarPage` and the no-mockup
// `AdminReportsPage` (frontend-components.md flags reports as reusing "the mockup's existing
// stat-strip pattern") both render it identically rather than each re-implementing the tiles.
import styles from "./StatStrip.module.css";

export interface StatTile {
  testId: string;
  label: string;
  value: string;
}

export function StatStrip({ tiles }: { tiles: StatTile[] }) {
  return (
    <div className={styles.strip}>
      {tiles.map((tile) => (
        <div className={styles.tile} key={tile.testId}>
          <div className={styles.label}>{tile.label}</div>
          <div className={styles.value} data-testid={tile.testId}>
            {tile.value}
          </div>
        </div>
      ))}
    </div>
  );
}
