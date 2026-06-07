import clsx from "clsx";
import type { StashStatus } from "../types";

const labels: Record<StashStatus, string> = {
  pending: "Pending",
  processing: "Analyzing",
  done: "Done",
  failed: "Failed"
};

export function StatusBadge({ status }: { status: StashStatus }) {
  return (
    <span
      className={clsx(
        "inline-flex h-6 items-center rounded-full border px-2 text-[11px] font-medium",
        status === "done" && "border-emerald-200 bg-emerald-50 text-emerald-700",
        status === "processing" && "border-blue-200 bg-blue-50 text-blue-700",
        status === "pending" && "border-line bg-white text-muted",
        status === "failed" && "border-red-200 bg-red-50 text-red-700"
      )}
    >
      {labels[status]}
    </span>
  );
}
