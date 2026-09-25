import { statusFa, statusTone } from "@/lib/labels";

export function StatusChip({ status }: { status: string | null | undefined }) {
  return <span className={`status-chip status-chip--${statusTone(status)}`}>{statusFa(status)}</span>;
}
