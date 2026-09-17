/** Maps an opportunity score (0-100) to a color on a red→green scale
 * (ColorBrewer RdYlGn), used to choropleth the map and to color score
 * badges in the detail panel consistently. */
export function scoreColor(score: number): string {
  if (score >= 80) return '#1a9850';
  if (score >= 60) return '#91cf60';
  if (score >= 40) return '#fee08b';
  if (score >= 20) return '#fc8d59';
  return '#d73027';
}
