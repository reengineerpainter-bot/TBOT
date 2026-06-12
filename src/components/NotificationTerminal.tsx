/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from "react";
import { WebhookLog } from "../types";
import { 
  Terminal, Copy, Check, Server, RefreshCw, Smartphone, Monitor, ShieldAlert, Wifi, Eye
} from "lucide-react";

interface NotificationTerminalProps {
  logs: WebhookLog[];
  onClearLogs: () => void;
  onRefreshLogs: () => void;
  webhookUrl: string;
}

export default function NotificationTerminal({
  logs,
  onClearLogs,
  onRefreshLogs,
  webhookUrl,
}: NotificationTerminalProps) {
  const [copied, setCopied] = useState(false);
  const [tokenCopied, setTokenCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(webhookUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleCopyToken = () => {
    navigator.clipboard.writeText("XAUUSD_METABOT_SECURE_TOKEN_2026");
    setTokenCopied(true);
    setTimeout(() => setTokenCopied(false), 2000);
  };

  return (
    <div className="flex flex-col gap-6 font-sans">
      {/* Webhook Connectivity Header */}
      <div className="bg-zinc-900 border border-zinc-800 p-5 rounded-2xl">
        <div className="flex items-center gap-2.5 mb-3">
          <span className="flex items-center justify-center w-8 h-8 rounded-lg bg-zinc-950 border border-zinc-800 text-amber-500 font-bold">
            <Wifi size={16} />
          </span>
          <div>
            <h4 className="text-zinc-150 font-bold text-xs uppercase tracking-widest font-mono">
              Live MT5 Webhook Endpoint
            </h4>
            <p className="text-[10.5px] text-zinc-505 mt-0.5">
              When your MT5 EA runs on Windows/VPS, it streams setup events right here.
            </p>
          </div>
        </div>

        {/* Dynamic Webhook URL Panel */}
        <div className="flex items-center justify-between gap-2 bg-zinc-950 border border-zinc-800 p-2.5 rounded-xl font-mono text-[11px] text-zinc-350">
          <span className="truncate max-w-sm sm:max-w-md md:max-w-lg lg:max-w-xl text-emerald-400 font-bold select-all">
            {webhookUrl}
          </span>
          <button
            onClick={handleCopy}
            id="copy-webhook-url-btn"
            className="flex items-center gap-1.5 bg-zinc-800 hover:bg-zinc-750 text-zinc-200 px-3.5 py-1.5 rounded-lg border border-zinc-700 transition cursor-pointer shrink-0 text-[10px] font-bold uppercase tracking-wider"
          >
            {copied ? (
              <>
                <Check size={12} className="text-emerald-500" /> Copied!
              </>
            ) : (
              <>
                <Copy size={12} /> Copy URL
              </>
            )}
          </button>
        </div>

        {/* Secure Token Header Banner */}
        <div className="mt-3.5 p-3 rounded-xl bg-zinc-950/60 border border-zinc-800/80 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-[11px]">
          <div>
            <span className="text-[9.5px] uppercase font-bold tracking-wider text-amber-500 block mb-0.5 font-mono">🔒 Secure Webhook Authorization Key</span>
            <p className="text-zinc-400 text-[10px]">Add this to your MT5 custom headers: <code className="text-zinc-300 bg-zinc-900 border border-zinc-800 px-1 py-0.5 rounded ml-1 select-all font-mono text-[9px]">X-API-KEY: XAUUSD_METABOT_SECURE_TOKEN_2026</code></p>
          </div>
          <button
            onClick={handleCopyToken}
            className="text-[9px] bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-zinc-100 px-3 py-1.5 rounded border border-zinc-800 font-mono font-bold shrink-0 shadow-sm cursor-pointer flex items-center gap-1 uppercase tracking-wide transition duration-150"
          >
            {tokenCopied ? (
              <>
                <Check size={9} className="text-amber-500" /> KEY COPIED
              </>
            ) : (
              <>
                <Copy size={9} /> Copy key
              </>
            )}
          </button>
        </div>

        {/* Checklist for Setup */}

        <div className="mt-4 pt-4 border-t border-zinc-900 grid grid-cols-1 md:grid-cols-2 gap-4 text-xs text-zinc-400 leading-relaxed">
          <div>
            <span className="text-[11px] font-mono font-bold text-zinc-300 uppercase block mb-1.5">
              🛠️ 1. Enable MT5 Permissions
            </span>
            <p className="text-[10px] text-zinc-500">
              In MT5: Open <b>Tools {'->'} Options {'->'} Expert Advisors</b>.<br />
              Check <b>&quot;Allow WebRequest for listed URL&quot;</b>.<br />
              Add <b>{webhookUrl.split("/api")[0]}</b> to the list.
            </p>
          </div>
          <div>
            <span className="text-[11px] font-mono font-bold text-zinc-300 uppercase block mb-1.5">
              📬 2. Receive Realtime Signals
            </span>
            <p className="text-[10px] text-zinc-500">
              Whenever the 9/50 crossover detects +1000 pips of impulse or hits actual entry, the EA triggers an HTTP request to display visual/sound alerts on your dashboard in realtime.
            </p>
          </div>
        </div>
      </div>

      {/* Live web logs stream console */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden flex flex-col h-[350px]">
        {/* Terminal Header */}
        <div className="bg-zinc-950/80 px-4 py-3 border-b border-zinc-850 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="flex items-center justify-center w-5 h-5 rounded-full bg-zinc-950 animate-pulse text-[10px] text-emerald-400">
              ●
            </span>
            <span className="text-xs text-zinc-350 font-bold font-mono uppercase tracking-widest">
              Signal Feed Monitor
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onRefreshLogs}
              id="refresh-logs-btn"
              className="p-1.5 bg-zinc-800 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-700 rounded transition border border-zinc-700"
              title="Refresh webhook logs"
            >
              <RefreshCw size={11} />
            </button>
            <button
              onClick={onClearLogs}
              id="clear-logs-btn"
              className="text-[10px] bg-zinc-800 text-zinc-400 hover:text-zinc-200 border border-zinc-700 px-2 py-1 rounded hover:bg-zinc-700 transition font-mono"
            >
              Clear Log Buffer
            </button>
          </div>
        </div>

        {/* Scrollable logs screen */}
        <div className="flex-1 p-4 overflow-y-auto flex flex-col gap-2 font-mono scrollbar-thin">
          {logs.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-zinc-600 text-center text-xs">
              <Terminal size={18} className="mb-1" />
              <span>No signals logged. Waiting for active trades or simulated triggers...</span>
            </div>
          ) : (
            logs.map((log) => (
              <div 
                key={log.id} 
                className={`p-3 rounded-lg border text-xs leading-relaxed transition ${
                  log.type === "confirmation" ? "bg-amber-950/20 border-amber-900/40 text-amber-300" :
                  log.type === "entry" ? "bg-indigo-950/25 border-indigo-900/40 text-indigo-300 font-semibold" :
                  log.type === "tp" ? "bg-emerald-950/20 border-emerald-905/30 text-emerald-300" :
                  log.type === "sl" ? "bg-red-950/20 border-red-900/40 text-red-300" :
                  log.type === "breakeven" ? "bg-cyan-950/25 border-cyan-900/30 text-cyan-300" :
                  log.type === "error" ? "bg-rose-950/20 border-rose-900/40 text-rose-300 animate-bounce" :
                  "bg-zinc-900/50 border-zinc-800 text-zinc-400"
                }`}
              >
                {/* Header detail */}
                <div className="flex items-center justify-between text-[10px] opacity-75 mb-1 bg-zinc-950/40 p-1 px-1.5 rounded">
                  <div className="flex items-center gap-1.5 uppercase font-bold">
                    <span>
                      {log.type === "confirmation" && "📢 Crossover Setup"}
                      {log.type === "entry" && "🚀 Trade Trigger Fill"}
                      {log.type === "tp" && "🏆 Target Hit"}
                      {log.type === "sl" && "🛑 Stop Loss Hit"}
                      {log.type === "breakeven" && "🛡️ Breakeven Secure"}
                      {log.type === "error" && "⚠️ Strategy Guard Alarm"}
                      {log.type === "info" && "⚙️ System log"}
                    </span>
                    {log.direction && (
                      <span className={`px-1 py-0.2 rounded font-mono font-black ${
                        log.direction === "BUY" ? "bg-emerald-950 text-emerald-400" : "bg-red-950 text-red-400"
                      }`}>
                        {log.direction}
                      </span>
                    )}
                  </div>
                  <span>
                    {log.time.includes("T") 
                      ? new Date(log.time).toLocaleTimeString() 
                      : log.time}
                  </span>
                </div>

                {/* Log message */}
                <p className="text-zinc-200 select-text font-medium text-[11.5px] pl-1 pr-1">
                  {log.message}
                </p>

                {/* Prices summary if present */}
                {log.price > 0 && (
                  <div className="flex flex-wrap gap-4 mt-1.5 text-[10px] text-zinc-400 border-t border-zinc-900/40 pt-1">
                    <span>Trig Price: <b className="text-zinc-300">${log.price.toFixed(2)}</b></span>
                    {log.lots && <span>Lots Split: <b className="text-zinc-300">[{log.lots.join(", ")}]</b></span>}
                    {log.sl && <span>Stop Loss: <b className="text-red-400/90">${log.sl.toFixed(2)}</b></span>}
                    {log.spread ? <span>Spread: <b className="text-zinc-300">{log.spread} pips</b></span> : null}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
