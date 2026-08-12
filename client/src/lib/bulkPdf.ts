export type PdfTrade = { id: number; accountId?: number; tradeDate: number | Date; pnl: number | string | null; result: string; session?: string };

export function selectBulkPdfTrades(trades: PdfTrade[], accountId: number, from?: string, to?: string) {
  const fromMs = from ? new Date(`${from}T00:00:00`).getTime() : Number.NEGATIVE_INFINITY;
  const toMs = to ? new Date(`${to}T23:59:59.999`).getTime() : Number.POSITIVE_INFINITY;
  return trades.filter(trade => trade.accountId === accountId && new Date(trade.tradeDate).getTime() >= fromMs && new Date(trade.tradeDate).getTime() <= toMs).sort((a, b) => new Date(a.tradeDate).getTime() - new Date(b.tradeDate).getTime());
}

export function summarizeBulkPdfTrades(trades: PdfTrade[]) {
  const pnl = trades.reduce((sum, trade) => sum + Number(trade.pnl || 0), 0);
  const wins = trades.filter(trade => trade.result === "WIN").length;
  return { total: trades.length, pnl, wins, losses: trades.filter(trade => trade.result === "LOSS").length, winRate: trades.length ? wins / trades.length * 100 : 0 };
}
