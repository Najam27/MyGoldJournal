import React, { useState } from "react";
import { Mt5SetupGuide } from "@/components/Mt5SetupGuide";
import { loadMt5Settings } from "@/lib/mt5Storage";

export function Mt5GuidedView({ BaseView }: { BaseView: React.ComponentType }) {
  const [url] = useState(() => loadMt5Settings().url || "http://localhost:7842");
  const [status, setStatus] = useState("Complete the five steps below, then use the live import controls.");
  const testBridge = async () => {
    const endpoint = `${url.trim().replace(/\/$/, "")}/status`;
    setStatus("Testing local bridge connection…");
    try {
      const response = await fetch(endpoint);
      const payload = await response.json().catch(() => null);
      if (!response.ok || payload?.ok === false) throw new Error(payload?.message || `Bridge returned HTTP ${response.status}.`);
      setStatus(payload?.message || "Bridge connected. Now select a journal account in the live controls below and run the import.");
    } catch (error: any) {
      const message = error instanceof TypeError ? "Browser could not reach the bridge. Start the local bridge, confirm the URL and port, and allow the connection through your firewall/CORS settings." : error?.message || "Bridge did not respond.";
      setStatus(`Bridge test failed — ${message}`);
    }
  };
  return <><Mt5SetupGuide bridgeUrl={url} targetName="Select below" targetReady={false} status={status} onTest={() => void testBridge()} onImport={() => document.querySelector(".mt5-target-panel")?.scrollIntoView({ behavior: "smooth", block: "start" })} importing={false} /><div className="mt5-live-controls"><span className="section-label">LIVE IMPORT CONTROLS</span><p>After finishing the guide, choose your journal account, set the bridge URL and history window, then run the real import here.</p><BaseView /></div></>;
}
