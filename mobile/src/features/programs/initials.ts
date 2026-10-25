/** To første bokstaver i navnet («Min rutine» → «Mi»), som Lyftas fliser. */
export function initials(name: string): string {
  const t = name.trim();
  return t ? t.slice(0, 2).charAt(0).toUpperCase() + t.slice(1, 2).toLowerCase() : '?';
}
