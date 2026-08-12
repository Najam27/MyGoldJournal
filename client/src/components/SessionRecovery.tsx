import React from "react";
import { RefreshCcw, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";

type ReconnectStatus = "ready" | "checking" | "unavailable";

export function SessionRecovery({ onRetry, onReconnect, reconnectStatus = "ready" }: { onRetry: () => void; onReconnect: () => void; reconnectStatus?: ReconnectStatus }) {
  return <section className="panel query-error session-recovery" role="status">
    <ShieldAlert size={25} />
    <div>
      <span className="eyebrow">SECURE SYNC CHECK</span>
      <h2>Your journal is taking longer than expected.</h2>
      <p>Your private records have not been changed. Retry the secure sync, or reconnect your session if this screen remains open.</p>
      <div className="query-error-actions">
        <Button onClick={onRetry}><RefreshCcw size={15} /> Retry secure sync</Button>
        <Button variant="outline" disabled={reconnectStatus === "checking"} onClick={onReconnect}>{reconnectStatus === "checking" ? "Checking sign-in…" : reconnectStatus === "unavailable" ? "Recheck sign-in service" : "Reconnect session"}</Button>
      </div>
      {reconnectStatus === "unavailable" && <p className="session-reconnect-notice" role="alert">Secure sign-in is temporarily unavailable. Recheck the service before reconnecting; your journal remains unchanged.</p>}
    </div>
  </section>;
}
