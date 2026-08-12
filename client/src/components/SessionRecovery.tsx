import React from "react";
import { RefreshCcw, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";

export function SessionRecovery({ onRetry, onReconnect }: { onRetry: () => void; onReconnect: () => void }) {
  return <section className="panel query-error session-recovery" role="status">
    <ShieldAlert size={25} />
    <div>
      <span className="eyebrow">SECURE SYNC CHECK</span>
      <h2>Your journal is taking longer than expected.</h2>
      <p>Your private records have not been changed. Retry the secure sync, or reconnect your session if this screen remains open.</p>
      <div className="query-error-actions">
        <Button onClick={onRetry}><RefreshCcw size={15} /> Retry secure sync</Button>
        <Button variant="outline" onClick={onReconnect}>Reconnect session</Button>
      </div>
    </div>
  </section>;
}
