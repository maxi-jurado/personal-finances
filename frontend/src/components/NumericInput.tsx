import type { ChangeEvent, ComponentProps } from "react";

import { sanitizeNumeric } from "../lib/numeric";
import { Input } from "./ui/input";

type NumericInputProps = Omit<ComponentProps<typeof Input>, "type"> & {
  /** Permite un separador decimal (montos). Desactívalo para enteros (ej. día del mes). */
  allowDecimal?: boolean;
};

// Input de texto para montos/enteros: sin las flechas nativas de
// <input type="number">, pero solo deja escribir dígitos (y un separador
// decimal, si allowDecimal !== false).
export function NumericInput({
  allowDecimal = true,
  onChange,
  ...props
}: NumericInputProps) {
  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    event.target.value = sanitizeNumeric(event.target.value, allowDecimal);
    onChange?.(event);
  };

  return (
    <Input
      {...props}
      type="text"
      inputMode={allowDecimal ? "decimal" : "numeric"}
      onChange={handleChange}
    />
  );
}
