import type { ReactNode } from "react";
import { fieldLabelStyle, fieldStyle } from "../styles";

function Field({ children, label }: { children: ReactNode; label: string }) {
  return (
    <label className={fieldStyle}>
      <span className={fieldLabelStyle}>{label}</span>
      {children}
    </label>
  );
}

export default Field;
