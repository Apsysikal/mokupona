export function nullableStringUpdateValue({
  formData,
  fieldName,
  parsedValue,
}: {
  formData: FormData;
  fieldName: string;
  parsedValue: string | undefined;
}) {
  if (!formData.has(fieldName)) {
    return undefined;
  }

  const rawValue = formData.get(fieldName);

  if (typeof rawValue === "string" && rawValue.trim() === "") {
    return null;
  }

  return parsedValue;
}
