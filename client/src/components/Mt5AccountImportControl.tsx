import React, { useState } from "react";
import { Cable, ExternalLink, Upload } from "lucide-react";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { setSelectedAccountId } from "@/lib/accountSelection";
import { buildMt5ImportProfile } from "@/lib/mt5Import";
import { saveMt5Profile, saveMt5Settings } from "@/lib/mt5Storage";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

export function Mt5AccountImportControl() {
  const { isAuthenticated } = useAuth();
  const createAccount = trpc.accounts.create.useMutation();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("MT5 Account");
  const [url, setUrl] = useState(() => JSON.parse(localStorage.getItem("gj_mt5_settings") || "{}")?.url || "http://localhost:7842");
  const [days, setDays] = useState("30");

  if (!isAuthenticated) return null;
  const prepare = async () => {
    const trimmed = name.trim();
    if (!trimmed) { toast.error("Give the imported MT5 account a journal name."); return; }
    try {
      const result = await createAccount.mutateAsync({ name: trimmed, startingBalance: 0 });
      saveMt5Settings({ url, days: Number(days) });
      saveMt5Profile(buildMt5ImportProfile({ accountId: result.id, accountName: trimmed, url, days: Number(days) }));
      setSelectedAccountId(result.id);
      toast.success("MT5 journal account prepared. Open MT5 Import to run the bridge sync.");
      setOpen(false);
    } catch (error: any) { toast.error(error.message || "MT5 account could not be prepared."); }
  };

  return <><button className="mt5-import-fab" onClick={() => setOpen(true)} title="Prepare MT5 import"><Cable size={15} /><span>Import MT5</span></button><Dialog open={open} onOpenChange={setOpen}><DialogContent className="mt5-import-dialog"><DialogHeader><DialogTitle>Import an MT5 account</DialogTitle><DialogDescription>Gold Journal imports through a local bridge on the computer where MetaTrader 5 is running. Your terminal password is never stored in Gold Journal.</DialogDescription></DialogHeader><div className="mt5-import-steps"><div><b>1</b><span>Open MetaTrader 5 on your trading computer and sign in to the broker account you want to review.</span></div><div><b>2</b><span>Start the local <code>mt5_sync</code> bridge. It must expose a status endpoint on your computer.</span></div><div><b>3</b><span>Create the matching private journal account below. Then use the <strong>MT5 Import</strong> page to sync the selected date window.</span></div></div><label className="mt5-guide-field">Journal account name<Input value={name} maxLength={100} onChange={event => setName(event.target.value)} placeholder="e.g. FTMO 100K" /></label><label className="mt5-guide-field">Local bridge URL<Input value={url} onChange={event => setUrl(event.target.value)} placeholder="http://localhost:7842" /></label><label className="mt5-guide-field">Days of closed history to import<Input type="number" min="1" max="90" value={days} onChange={event => setDays(event.target.value)} /></label><div className="mt5-security-note"><ExternalLink size={15} /><span>The bridge runs locally. Gold Journal only receives the trade data returned by that bridge after you initiate a sync.</span></div><div className="dialog-actions"><Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button><Button disabled={createAccount.isPending || !name.trim()} onClick={prepare}><Upload size={15} />{createAccount.isPending ? "Preparing…" : "Prepare MT5 import"}</Button></div></DialogContent></Dialog></>;
}
