/**
 * Prints `sheet` on its own: it is appended to <body> as a .tm-worksheet while the print dialog is open, and
 * everything else on the page is hidden by the print styles (see time-machine-features.css).
 */
export function printSheet(sheet: HTMLElement): void {
  sheet.classList.add('tm-worksheet');
  document.body.appendChild(sheet);
  document.documentElement.classList.add('tm-printing');
  const cleanup = () => {
    document.documentElement.classList.remove('tm-printing');
    sheet.remove();
  };
  window.addEventListener('afterprint', cleanup, { once: true });
  window.print();
}
