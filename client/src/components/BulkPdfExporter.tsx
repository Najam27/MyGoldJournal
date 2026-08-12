import React, { useEffect, useMemo, useState } from "react";
import { CalendarRange, FileDown, Image as ImageIcon } from "lucide-react";
import { jsPDF } from "jspdf";
import { useAuth } from "@/_core/hooks/useAuth";
import { getSelectedAccountId, subscribeSelectedAccount } from "@/lib/accountSelection";
import { selectBulkPdfTrades, summarizeBulkPdfTrades } from "@/lib/bulkPdf";
import { formatDate, formatMoney, formatRr, toNumber } from "@/lib/gold";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

const page = { width: 210, height: 297, margin: 15 };
const colors = { bg: [16, 20, 26] as const, panel: [25, 32, 41] as const, gold: [233, 182, 75] as const, text: [235, 240, 245] as const, muted: [146, 159, 171] as const, green: [83, 188, 137] as const, red: [222, 104, 98] as const };

function dateInput(value: number | Date) { return new Date(value).toISOString().slice(0, 10); }
function setPageBackground(pdf: jsPDF) { pdf.setFillColor(...colors.bg); pdf.rect(0, 0, page.width, page.height, "F"); }
function fetchImageData(url: string) { return fetch(url).then(response => { if (!response.ok) throw new Error("Screenshot unavailable"); return response.blob(); }).then(blob => new Promise<string>((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result)); reader.onerror = reject; reader.readAsDataURL(blob); })); }
function sectionTitle(pdf: jsPDF, label: string, title: string) { pdf.setTextColor(...colors.gold); pdf.setFontSize(8); pdf.text(label.toUpperCase(), page.margin, 18); pdf.setTextColor(...colors.text); pdf.setFontSize(20); pdf.text(title, page.margin, 29); }
function addWrapped(pdf: jsPDF, value: string, x: number, y: number, width: number, lineHeight = 4.5) { const lines = pdf.splitTextToSize(value || "—", width); pdf.text(lines, x, y); return y + lines.length * lineHeight; }

export function BulkPdfExporter() {
  const { isAuthenticated } = useAuth();
  const [open, setOpen] = useState(false);
  const [accountId, setAccountId] = useState<number | undefined>(() => getSelectedAccountId());
  const journal = trpc.journal.get.useQuery({ accountId }, { enabled: isAuthenticated });
  const [allTime, setAllTime] = useState(true);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => subscribeSelectedAccount(setAccountId), []);
  useEffect(() => { const openExporter = () => setOpen(true); window.addEventListener("gold-journal:bulk-pdf", openExporter); return () => window.removeEventListener("gold-journal:bulk-pdf", openExporter); }, []);
  const account = journal.data?.activeAccount;
  const trades = journal.data?.trades ?? [];
  const selected = useMemo(() => account ? selectBulkPdfTrades(trades, account.id, allTime ? undefined : from, allTime ? undefined : to) : [], [trades, account?.id, allTime, from, to]);
  const summary = useMemo(() => summarizeBulkPdfTrades(selected), [selected]);
  const earliest = trades.length ? dateInput(trades.reduce((oldest: any, trade: any) => new Date(trade.tradeDate) < new Date(oldest.tradeDate) ? trade : oldest).tradeDate) : "";
  const latest = trades.length ? dateInput(trades.reduce((newest: any, trade: any) => new Date(trade.tradeDate) > new Date(newest.tradeDate) ? trade : newest).tradeDate) : "";
  const setCustom = () => { setAllTime(false); setFrom(value => value || earliest); setTo(value => value || latest); };

  const createPdf = async () => {
    if (!account || !selected.length) { toast.error("No trades match this export range."); return; }
    setBusy(true);
    try {
      const pdf = new jsPDF({ unit: "mm", format: "a4" });
      setPageBackground(pdf);
      sectionTitle(pdf, "Gold Journal · Private performance report", account.name);
      pdf.setTextColor(...colors.muted); pdf.setFontSize(10);
      pdf.text(allTime ? "Complete trade log" : `${from || earliest} to ${to || latest}`, page.margin, 39);
      pdf.setFillColor(...colors.panel); pdf.roundedRect(page.margin, 49, 180, 38, 4, 4, "F");
      const cards = [["Trades", String(summary.total)], ["Net P&L", formatMoney(summary.pnl)], ["Win rate", `${summary.winRate.toFixed(1)}%`], ["Wins / Losses", `${summary.wins} / ${summary.losses}`]];
      cards.forEach(([label, value], index) => { const x = 22 + index * 43; pdf.setTextColor(...colors.muted); pdf.setFontSize(8); pdf.text(label, x, 62); pdf.setTextColor(...colors.text); pdf.setFontSize(14); pdf.text(value, x, 73); });
      pdf.setTextColor(...colors.muted); pdf.setFontSize(9); addWrapped(pdf, "This report contains trade cards, linked screenshot evidence when available, performance analysis, and a daily P&L calendar for the selected account only.", page.margin, 103, 165);

      for (let index = 0; index < selected.length; index += 1) {
        const trade: any = selected[index];
        pdf.addPage(); setPageBackground(pdf);
        sectionTitle(pdf, `Trade card ${String(index + 1).padStart(2, "0")} / ${String(selected.length).padStart(2, "0")}`, `${formatDate(trade.tradeDate)} · ${trade.direction} · ${trade.result.replace("_", " ")}`);
        pdf.setFillColor(...colors.panel); pdf.roundedRect(page.margin, 40, 180, 47, 4, 4, "F");
        const fields = [["Session", trade.session], ["Level", trade.level || "—"], ["Timeframe", trade.timeframe || "—"], ["Setup", trade.setupQuality || "—"], ["Risk", formatMoney(trade.risk)], ["Reward", formatMoney(trade.reward)], ["R:R", formatRr(trade.risk, trade.reward)], ["P&L", formatMoney(trade.pnl)]];
        fields.forEach(([label, value], fieldIndex) => { const column = fieldIndex % 4; const row = Math.floor(fieldIndex / 4); const x = 22 + column * 44; const y = 53 + row * 18; const valueColor = label === "P&L" ? toNumber(trade.pnl) >= 0 ? colors.green : colors.red : colors.text; pdf.setTextColor(...colors.muted); pdf.setFontSize(7); pdf.text(label, x, y); pdf.setTextColor(valueColor[0], valueColor[1], valueColor[2]); pdf.setFontSize(11); pdf.text(String(value), x, y + 8); });
        pdf.setTextColor(...colors.gold); pdf.setFontSize(8); pdf.text("JOURNAL NOTES", page.margin, 101); pdf.setTextColor(...colors.text); pdf.setFontSize(9); let y = addWrapped(pdf, trade.notes || "No trade notes recorded.", page.margin, 108, 180);
        if (trade.emotionBefore || trade.emotionDuring || trade.emotionAfter) { y += 8; pdf.setTextColor(...colors.gold); pdf.setFontSize(8); pdf.text("EXECUTION EMOTIONS", page.margin, y); y += 7; pdf.setTextColor(...colors.text); pdf.setFontSize(8.5); y = addWrapped(pdf, `Before: ${trade.emotionBefore || "—"}\nDuring: ${trade.emotionDuring || "—"}\nAfter: ${trade.emotionAfter || "—"}`, page.margin, y, 180); }
        if (trade.screenshotUrl) { y += 10; pdf.setTextColor(...colors.gold); pdf.setFontSize(8); pdf.text("SCREENSHOT EVIDENCE", page.margin, y); y += 5; try { const image = await fetchImageData(trade.screenshotUrl); const properties = pdf.getImageProperties(image); const ratio = properties.width / properties.height; const maxWidth = 180; const maxHeight = Math.max(45, page.height - y - 15); const width = Math.min(maxWidth, maxHeight * ratio); const height = width / ratio; pdf.addImage(image, "JPEG", page.margin, y, width, height); } catch { pdf.setTextColor(...colors.muted); pdf.setFontSize(8); pdf.text("Screenshot evidence could not be loaded at export time.", page.margin, y + 6); } }
      }

      pdf.addPage(); setPageBackground(pdf); sectionTitle(pdf, "Selected-period analysis", "Performance snapshot");
      const sessions = Array.from(new Set(selected.map((trade: any) => trade.session || "Unspecified")));
      pdf.setTextColor(...colors.gold); pdf.setFontSize(8); pdf.text("NET P&L BY SESSION", page.margin, 46);
      sessions.forEach((session, index) => { const rows = selected.filter((trade: any) => (trade.session || "Unspecified") === session); const pnl = rows.reduce((sum: number, trade: any) => sum + toNumber(trade.pnl), 0); const y = 58 + index * 11; const pnlColor = pnl >= 0 ? colors.green : colors.red; pdf.setTextColor(...colors.text); pdf.setFontSize(10); pdf.text(session, page.margin, y); pdf.setTextColor(pnlColor[0], pnlColor[1], pnlColor[2]); pdf.text(formatMoney(pnl), 115, y); pdf.setTextColor(...colors.muted); pdf.text(`${rows.length} trade${rows.length === 1 ? "" : "s"}`, 155, y); });
      pdf.setTextColor(...colors.gold); pdf.setFontSize(8); pdf.text("REVIEW PROMPTS", page.margin, 125); pdf.setTextColor(...colors.text); pdf.setFontSize(9); addWrapped(pdf, `• ${summary.winRate.toFixed(1)}% win rate across ${summary.total} selected trades.\n• Net period P&L: ${formatMoney(summary.pnl)}.\n• Review the trade cards for repeated session, risk, and emotional patterns.`, page.margin, 133, 175);

      pdf.addPage(); setPageBackground(pdf); sectionTitle(pdf, "P&L calendar", "Daily performance");
      const daily = new Map<string, number>(); selected.forEach((trade: any) => { const key = dateInput(trade.tradeDate); daily.set(key, (daily.get(key) || 0) + toNumber(trade.pnl)); });
      const entries = Array.from(daily.entries()).sort(([a], [b]) => a.localeCompare(b));
      pdf.setTextColor(...colors.muted); pdf.setFontSize(9); pdf.text("Selected date", page.margin, 45); pdf.text("Trades", 95, 45); pdf.text("Daily P&L", 145, 45);
      entries.forEach(([day, pnl], index) => { const y = 55 + (index % 20) * 10; if (index === 20) { pdf.addPage(); setPageBackground(pdf); sectionTitle(pdf, "P&L calendar", "Daily performance (continued)"); } const pnlColor = pnl >= 0 ? colors.green : colors.red; pdf.setTextColor(...colors.text); pdf.setFontSize(9); pdf.text(day, page.margin, index < 20 ? y : 55 + (index - 20) * 10); const count = selected.filter((trade: any) => dateInput(trade.tradeDate) === day).length; pdf.text(String(count), 95, index < 20 ? y : 55 + (index - 20) * 10); pdf.setTextColor(pnlColor[0], pnlColor[1], pnlColor[2]); pdf.text(formatMoney(pnl), 145, index < 20 ? y : 55 + (index - 20) * 10); });
      pdf.save(`GoldJournal_${account.name.replace(/[^a-z0-9]+/gi, "-")}_${allTime ? "Full-Log" : `${from}_to_${to}`}.pdf`);
      toast.success("Bulk PDF report downloaded.");
      setOpen(false);
    } catch (error: any) { toast.error(error.message || "The PDF report could not be generated."); } finally { setBusy(false); }
  };

  if (!isAuthenticated) return null;
  return <Dialog open={open} onOpenChange={setOpen}><DialogContent className="bulk-pdf-dialog"><DialogHeader><DialogTitle>Bulk trade-log PDF</DialogTitle><DialogDescription>Download selected trade cards with screenshot evidence, period analysis, and a P&L calendar. The report contains only the active account.</DialogDescription></DialogHeader><div className="pdf-range-mode"><button className={allTime ? "active" : ""} onClick={() => setAllTime(true)}>Whole trade log</button><button className={!allTime ? "active" : ""} onClick={setCustom}><CalendarRange size={14} /> Custom date range</button></div>{!allTime && <div className="pdf-date-range"><label>From<Input type="date" value={from} min={earliest} max={to || latest} onChange={event => setFrom(event.target.value)} /></label><label>To<Input type="date" value={to} min={from || earliest} max={latest} onChange={event => setTo(event.target.value)} /></label></div>}<div className="pdf-selection-summary"><span><b>{selected.length}</b> selected trade{selected.length === 1 ? "" : "s"}</span><span>Net P&L <b className={summary.pnl >= 0 ? "positive" : "negative"}>{formatMoney(summary.pnl)}</b></span></div><div className="pdf-export-includes"><ImageIcon size={15} /><span>Every selected trade becomes a card. Available screenshot evidence is attached to its trade card, followed by analysis and daily P&L calendar pages.</span></div><div className="dialog-actions"><Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button><Button disabled={busy || !selected.length} onClick={createPdf}><FileDown size={15} />{busy ? "Building report…" : "Download bulk PDF"}</Button></div></DialogContent></Dialog>;
}
