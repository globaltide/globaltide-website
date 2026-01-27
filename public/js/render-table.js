export function filterByLP(data, lpType) {
  return data.filter(d => d.visibleTo.includes(lpType));
}
