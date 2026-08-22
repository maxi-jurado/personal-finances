// Sanitiza texto libre a un número válido: descarta todo lo que no sea
// dígito o separador decimal (soporta "," como alias de "."), y colapsa
// cualquier separador extra. Pensado para inputs de texto que reemplazan a
// <input type="number"> (sin las flechas nativas del navegador).
export function sanitizeNumeric(raw: string, allowDecimal: boolean): string {
  const commaToDot = raw.replace(/,/g, ".");
  if (!allowDecimal) return commaToDot.replace(/[^\d]/g, "");

  const digitsAndDots = commaToDot.replace(/[^\d.]/g, "");
  const [intPart, ...rest] = digitsAndDots.split(".");
  return rest.length > 0 ? `${intPart}.${rest.join("")}` : intPart;
}
