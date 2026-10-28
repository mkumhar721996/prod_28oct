// Wrap-around is the assumed production behaviour (unconfirmed plan assumption).
export function nextIndex(current: number, count: number): number {
  return count <= 1 ? 0 : (current + 1) % count;
}

export function prevIndex(current: number, count: number): number {
  return count <= 1 ? 0 : (current - 1 + count) % count;
}

export function showsControls(count: number): boolean {
  return count > 1;
}
