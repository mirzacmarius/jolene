/** `list` with its item at `from` moved to `to`. */
export function moved<T>(list: readonly T[], from: number, to: number) {
  const next = [...list];
  const [item] = next.splice(from, 1);
  if (item !== undefined) next.splice(to, 0, item);
  return next;
}
