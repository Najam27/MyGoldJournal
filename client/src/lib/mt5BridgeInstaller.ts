export const MT5_BRIDGE_FILENAME = "gold_journal_mt5_bridge.py";

export const MT5_BRIDGE_PYTHON = `# Gold Journal MT5 local connector (Windows desktop)
# Prerequisite: pip install MetaTrader5
# Start: python gold_journal_mt5_bridge.py
import json
from datetime import datetime, timedelta
from http.server import BaseHTTPRequestHandler, HTTPServer

try:
    import MetaTrader5 as mt5
except ImportError:
    mt5 = None

HOST, PORT = "127.0.0.1", 7842

def respond(handler, status, body):
    encoded = json.dumps(body).encode("utf-8")
    handler.send_response(status)
    handler.send_header("Content-Type", "application/json")
    handler.send_header("Content-Length", str(len(encoded)))
    handler.send_header("Access-Control-Allow-Origin", "*")
    handler.send_header("Access-Control-Allow-Headers", "Content-Type")
    handler.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
    handler.end_headers()
    handler.wfile.write(encoded)

def connect():
    if mt5 is None:
        return False, "MetaTrader5 package is missing. Run: pip install MetaTrader5"
    if not mt5.initialize():
        return False, f"MT5 initialize failed: {mt5.last_error()}"
    info = mt5.terminal_info()
    if info is None:
        return False, "MT5 terminal is not available. Open MT5 and sign in first."
    return True, f"Connected to MT5 terminal ({info.company})"

def closed_deals(days):
    started = datetime.now() - timedelta(days=max(1, min(int(days), 90)))
    deals = mt5.history_deals_get(started, datetime.now()) or []
    rows = []
    for deal in deals:
        if deal.entry != mt5.DEAL_ENTRY_OUT:
            continue
        # An exit SELL closes a BUY position; an exit BUY closes a SELL position.
        direction = "BUY" if deal.type == mt5.DEAL_TYPE_SELL else "SELL"
        rows.append({
            "ticket": str(deal.ticket),
            "position": str(deal.position_id),
            "closeTime": int(deal.time) * 1000,
            "direction": direction,
            "pnl": float(deal.profit + deal.swap + deal.commission),
            "symbol": deal.symbol or "XAUUSD",
            "volume": float(deal.volume),
            "comment": deal.comment or "",
        })
    return rows

class Handler(BaseHTTPRequestHandler):
    def log_message(self, format, *args):
        pass
    def do_OPTIONS(self):
        respond(self, 200, {"ok": True})
    def do_GET(self):
        if self.path.rstrip("/") != "/status":
            return respond(self, 404, {"ok": False, "message": "Use GET /status"})
        ok, message = connect()
        return respond(self, 200 if ok else 503, {"ok": ok, "message": message})
    def do_POST(self):
        if self.path.rstrip("/") != "/sync":
            return respond(self, 404, {"ok": False, "message": "Use POST /sync"})
        try:
            size = int(self.headers.get("Content-Length", "0"))
            payload = json.loads(self.rfile.read(size) or b"{}")
            ok, message = connect()
            if not ok:
                return respond(self, 503, {"ok": False, "message": message})
            rows = closed_deals(payload.get("days", 30))
            return respond(self, 200, {"ok": True, "message": f"Read {len(rows)} closed MT5 deals.", "trades": rows, "imported": len(rows), "skipped": 0})
        except Exception as error:
            return respond(self, 500, {"ok": False, "message": str(error)})

if __name__ == "__main__":
    print(f"Gold Journal MT5 bridge running at http://{HOST}:{PORT}")
    HTTPServer((HOST, PORT), Handler).serve_forever()
`;

export function downloadMt5Bridge() {
  const blob = new Blob([MT5_BRIDGE_PYTHON], { type: "text/x-python" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = MT5_BRIDGE_FILENAME;
  link.click();
  URL.revokeObjectURL(url);
}
