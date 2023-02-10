export function hasErrors(fieldErrors: object) {
  return Object.values(fieldErrors).some(Boolean);
}
