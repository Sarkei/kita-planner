/** Label wie in der Bibliothek (Speicherzeitpunkt → „Frühling 2025“). */
export function getSeasonYearLabelFromTimestamp(timestamp: number): string {
  const date = new Date(timestamp);
  const month = date.getMonth();
  const year = date.getFullYear();

  let season = '';
  if (month === 11 || month === 0 || month === 1) {
    season = 'Winter';
  } else if (month >= 2 && month <= 4) {
    season = 'Frühling';
  } else if (month >= 5 && month <= 7) {
    season = 'Sommer';
  } else {
    season = 'Herbst';
  }
  return `${season} ${year}`;
}
