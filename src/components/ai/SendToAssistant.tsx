"use client";

import { usePathname } from "next/navigation";
import { useAuthSession } from "@/components/auth/AuthGate";
import { sendToAssistant } from "@/lib/assistant";

/**
 * Hands the current page's data to the assistant drawer. `data` should be a compact snapshot (visible rows/totals);
 * it is truncated client-side and again on the server.
 */
export function SendToAssistant({
  title,
  prompt,
  data,
  label = "پرسش از دستیار",
  autoSend = false,
}: {
  title: string;
  prompt: string;
  data?: unknown;
  label?: string;
  autoSend?: boolean;
}) {
  const pathname = usePathname();
  const { can } = useAuthSession();
  if (!can("AI.USE")) return null;
  return (
    <button
      type="button"
      className="btn-ghost btn-sm"
      onClick={() => sendToAssistant({ prompt, autoSend, context: { page: pathname, title, data } })}
    >
      {label}
    </button>
  );
}
