/** Egy blobot letöltésként ment (rejtett linkkel), majd felszabadítja az object URL-t. */
export function saveBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  // A böngészőnek idő kell a letöltés elindításához, mielőtt az URL érvénytelenné válik
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
