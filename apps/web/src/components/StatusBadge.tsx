import { getStatusBadgeStyle, statusLabelStyle, statusValueStyle } from "../styles";

function StatusBadge({
  label,
  tone,
  value
}: {
  label: string;
  tone: "attention" | "good" | "neutral" | "warn";
  value: string;
}) {
  return (
    <div className={getStatusBadgeStyle(tone)}>
      <span className={statusLabelStyle}>{label}</span>
      <strong className={statusValueStyle}>{value}</strong>
    </div>
  );
}

export default StatusBadge;
