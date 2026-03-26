export function nullableStringUpdateValue({
  formData,
  fieldName,
}: {
  formData: FormData;
  fieldName: string;
}) {
  if (!formData.has(fieldName)) {
    return undefined;
  }

  const rawValue = formData.get(fieldName);

  if (typeof rawValue !== "string") {
    return undefined;
  }

  if (rawValue.trim() === "") {
    return null;
  }

  return rawValue.trim();
}
