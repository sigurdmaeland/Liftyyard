/** Stabil farge per program (ut fra ID), brukt på flisen i Bibliotek. */
const COLORS = ['#2F6BFF', '#E5533D', '#1F9D55', '#8B5CF6', '#F59E2B', '#0EA5E9', '#DB2777'];

export function programColor(id: string): string {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return COLORS[h % COLORS.length];
}
