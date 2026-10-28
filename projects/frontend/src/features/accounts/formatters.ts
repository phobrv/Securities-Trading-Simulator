export function formatInteger(value: string | number): string {
  const text = String(value);
  const [sign, digits] = text.startsWith("-") ? ["-", text.slice(1)] : ["", text];

  return `${sign}${digits.replace(/\B(?=(\d{3})+(?!\d))/g, ".")}`;
}

export function formatVnd(value: string): string {
  return `${formatInteger(value)} đồng`;
}
