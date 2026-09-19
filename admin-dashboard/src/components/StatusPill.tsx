export function StatusPill({ status }: { status: string }) {
  return <span className={`status-pill ${status.toLowerCase()}`}>{formatStatus(status)}</span>;
}

function formatStatus(status: string) {
  return status.charAt(0) + status.slice(1).toLowerCase().replace(/_/g, " ");
}
