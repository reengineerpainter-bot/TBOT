/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from "react";
import { StrategyParameters, WebhookLog, HistoricalTrade } from "./types";
import { generateMql5Code } from "./utils/mqlCode";
import { PRD_TEXT } from "./utils/prdText";
import ChartSimulator from "./components/ChartSimulator";
import StrategyConfig from "./components/StrategyConfig";
import NotificationTerminal from "./components/NotificationTerminal";

import { 
  TrendingUp, Code, Terminal as TermIcon, ShieldAlert, Award, ChevronRight, Zap, Download, Copy, Check, FileCode, Play, Award as WinIcon, RotateCcw, FileText
} from "lucide-react";

export default function App() {
  const [activeTab, setActiveTab] = useState<"simulation" | "compiler" | "webhook" | "prd">("simulation");
  const [copiedCode, setCopiedCode] = useState(false);

  // Strategy configuration block parameters
  const [stratParams, setStratParams] = useState<StrategyParameters>({
    fastEma: 9,
    slowEma: 50,
    trendEma: 200,
    timeframe: "15m",
    minDistancePips: 1000, // 1000 pips = $10 on gold level crossover
    maxSpreadPips: 50,     // strict max 50 pips limit on executions
    maxTradesPerDay: 5,    // 5 maximum trades daily to avoid chopper flatlands
    tp1Ratio: 3.0,          // TP1 3x Risk-to-Reward
    tp2Ratio: 4.0,          // TP2 4x Risk-to-Reward (Positions Lot splitting strategy!)
    riskDollars: 500,
    defaultLotSize: 0.10,  // splits into 2 x 0.05 lot positions
  });

  const [isChoppyMode, setIsChoppyMode] = useState<boolean>(false);

  // In-memory Webhook Notification Logs list
  const [webhookLogs, setWebhookLogs] = useState<WebhookLog[]>([]);

  // Historical simulated trades executed by backtester
  const [tradeHistory, setTradeHistory] = useState<HistoricalTrade[]>([]);

  // Simulation Metrics tracker
  const [stats, setStats] = useState({
    count: 0,
    profit: 0,
    winRate: 0,
  });

  // Dynamic Server Webhook URL
  const [webhookUrl, setWebhookUrl] = useState<string>("");

  useEffect(() => {
    // Determine server domain origin to give actual working Webhook endpoint URL
    const origin = window.location.origin;
    setWebhookUrl(`${origin}/api/webhook`);
  }, []);

  // Fetch log history from Node.js API server to sync client when actions happen
  const fetchBackendLogs = async () => {
    try {
      const res = await fetch("/api/webhook/logs");
      if (res.ok) {
        const data = await res.json();
        setWebhookLogs(data.logs);
      }
    } catch (err) {
      console.warn("Backend logs unavailable, falling back to local simulation logs", err);
    }
  };

  useEffect(() => {
    fetchBackendLogs();
    // Poll logs every 2 seconds to reflect incoming MT5 webhooks
    const logPollInterval = setInterval(fetchBackendLogs, 2000);
    return () => clearInterval(logPollInterval);
  }, []);

  // Clear remote logs
  const clearBackendLogs = async () => {
    try {
      const res = await fetch("/api/webhook/clear", { method: "POST" });
      if (res.ok) {
        const data = await res.json();
        setWebhookLogs(data.logs);
      } else {
        setWebhookLogs([]);
      }
    } catch {
      setWebhookLogs([]);
    }
  };

  // Add webhook log manually from the local Sandbox engine
  const handleLocalWebhookSignal = async (signal: Partial<WebhookLog>) => {
    // Send to our node.js API route!
    try {
      const res = await fetch("/api/webhook", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(signal),
      });
      if (res.ok) {
        fetchBackendLogs();
      } else {
        // Fallback locally
        const mockLog: WebhookLog = {
          id: `local-${Date.now()}`,
          type: signal.type || "info",
          message: signal.message || "",
          time: new Date().toISOString(),
          price: signal.price || 0,
          direction: signal.direction,
          lots: signal.lots,
          sl: signal.sl,
          tp1: signal.tp1,
          tp2: signal.tp2,
          spread: signal.spread,
        };
        setWebhookLogs((prev) => [mockLog, ...prev]);
      }
    } catch {
      // Fallback
      const mockLog: WebhookLog = {
        id: `local-${Date.now()}`,
        type: signal.type || "info",
        message: signal.message || "",
        time: new Date().toISOString(),
        price: signal.price || 0,
        direction: signal.direction,
        lots: signal.lots,
        sl: signal.sl,
        tp1: signal.tp1,
        tp2: signal.tp2,
        spread: signal.spread,
      };
      setWebhookLogs((prev) => [mockLog, ...prev]);
    }
  };

  // Action: reset backtest metrics
  const resetTradeHistory = () => {
    setTradeHistory([]);
    setStats({ count: 0, profit: 0, winRate: 0 });
    handleLocalWebhookSignal({
      type: "info",
      message: "Simulation statistics and backtest histories are reset."
    });
  };

  const handleCopyCode = () => {
    const code = generateMql5Code(stratParams, webhookUrl);
    navigator.clipboard.writeText(code);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  const handleDownloadFile = () => {
    const code = generateMql5Code(stratParams, webhookUrl);
    const blob = new Blob([code], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "XAUUSD_EMA_Splits_Bot.mq5";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleDownloadPrd = () => {
    const blob = new Blob([PRD_TEXT], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "XAUUSD_EMA_Bot_PRD.md";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col font-sans selection:bg-amber-500 selection:text-black">
      {/* Top Bento Header Bar */}
      <header className="border-b border-zinc-900 bg-zinc-950/80 backdrop-blur-md sticky top-0 z-40 px-6 py-4 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 bg-amber-500 rounded-lg flex items-center justify-center text-zinc-950 font-black text-xl">G</div>
          <div>
            <h1 className="text-zinc-100 text-base md:text-lg font-black tracking-tight uppercase">XAUUSD MetaBot <span className="text-zinc-500 font-normal">v2.1.2</span></h1>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
              <span className="text-xs text-emerald-500 font-mono">MT5 ACTIVE FEED: LOCAL SIM COMPILING</span>
            </div>
          </div>
        </div>

        {/* Header Badges */}
        <div className="flex items-center gap-3">
          <div className="bg-zinc-900 border border-zinc-800 px-4 py-2 rounded-md">
            <span className="text-[10px] text-zinc-500 block uppercase font-bold tracking-wider font-mono">DAILY TRADE CAP</span>
            <span className="text-zinc-100 font-mono text-xs">{stats.count} / {stratParams.maxTradesPerDay} <span className="text-zinc-650 text-[10px]">LIMIT</span></span>
          </div>
          <div className="bg-zinc-900 border border-zinc-800 px-4 py-2 rounded-md">
            <span className="text-[10px] text-zinc-500 block uppercase font-bold tracking-wider font-mono">TAKE PROFIT LIMITS</span>
            <span className="text-emerald-400 font-mono text-xs italic font-bold">{stratParams.tp1Ratio.toFixed(1)}x / {stratParams.tp2Ratio.toFixed(1)}x</span>
          </div>
          <button className="bg-zinc-100 text-zinc-950 px-5 py-2 rounded-md font-bold text-xs uppercase tracking-wider font-sans hover:bg-zinc-200 transition-all">
            BOT COMPILED
          </button>
        </div>
      </header>

      {/* Main Stats HUD Bento boxes Grid */}
      <section className="px-6 py-5 grid grid-cols-2 lg:grid-cols-4 gap-4 bg-zinc-950 border-b border-zinc-900">
        {/* Trade counter card */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 flex flex-col justify-between hover:border-zinc-700 transition-all">
          <span className="text-[10px] font-mono text-zinc-500 uppercase font-black tracking-widest">
            Daily Trade Frequency
          </span>
          <div className="text-2xl font-bold font-mono tracking-tight text-zinc-100 mt-2">
            {stats.count} <span className="text-xs text-zinc-500 font-normal">Trades Fired</span>
          </div>
          <span className="text-[10px] text-zinc-650 font-mono mt-2 block border-t border-zinc-850/60 pt-2">
             Risk limits: max {stratParams.maxTradesPerDay} trades per day
          </span>
        </div>

        {/* Total profit simulated */}
        <div className="bg-emerald-950/20 border border-emerald-900/30 rounded-2xl p-5 flex flex-col justify-between hover:brightness-110 transition-all">
          <span className="text-[10px] font-mono text-emerald-500 uppercase font-black tracking-widest">
            Today Net Yield
          </span>
          <div className={`text-2xl font-bold font-mono tracking-tight mt-2 ${
            stats.profit >= 0 ? "text-emerald-400" : "text-red-400"
          }`}>
            {stats.profit >= 0 ? "+" : ""}${stats.profit.toFixed(2)}
          </div>
          <span className="text-[10px] text-emerald-600/80 font-mono mt-2 block border-t border-emerald-900/20 pt-2">
            Lot weights: {stratParams.defaultLotSize} split lots
          </span>
        </div>

        {/* Win Rate */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 flex flex-col justify-between hover:border-zinc-700 transition-all">
          <span className="text-[10px] font-mono text-zinc-500 uppercase font-black tracking-widest">
            Closed Win Ratio
          </span>
          <div className="text-2xl font-bold font-mono tracking-tight text-amber-500 mt-2">
            {stats.winRate}% <span className="text-xs text-zinc-500 font-normal">Success</span>
          </div>
          <span className="text-[10px] text-zinc-650 font-mono mt-2 block border-t border-zinc-850/60 pt-2">
            Excluding neutral breakeven orders
          </span>
        </div>

        {/* Execution Engine */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 flex flex-col justify-between hover:border-zinc-700 transition-all">
          <span className="text-[10px] font-mono text-zinc-500 uppercase font-black tracking-widest">
            Risk Mitigation Ratio
          </span>
          <div className="text-sm font-bold font-mono text-zinc-200 mt-2">
            Split A: <span className="text-amber-500 font-black">{stratParams.tp1Ratio.toFixed(1)}x</span> / B: <span className="text-amber-500 font-black">{stratParams.tp2Ratio.toFixed(1)}x</span>
          </div>
          <span className="text-[10px] text-zinc-650 font-mono mt-2 block border-t border-zinc-850/60 pt-2">
            Auto-protect split B at TP1 secure
          </span>
        </div>
      </section>

      {/* Primary Workspace Grid */}
      <main className="flex-1 w-full max-w-7xl mx-auto px-6 py-6 grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left column (Bento Config): Always visible parameters panel on desktop */}
        <section className="lg:col-span-4 bg-zinc-900 border border-zinc-800 p-6 rounded-2xl flex flex-col gap-6">
          <StrategyConfig 
            params={stratParams}
            onChange={(updates) => setStratParams(prev => ({ ...prev, ...updates }))}
            isChoppyMode={isChoppyMode}
            onToggleChoppyMode={() => setIsChoppyMode(prev => !prev)}
          />
        </section>

        {/* Right column (Tabs workspace selector) */}
        <section className="lg:col-span-8 flex flex-col gap-5">
          {/* Workspace tab selector buttons bar */}
          <div className="flex bg-zinc-900 border border-zinc-800 rounded-xl p-1 self-start select-none">
            <button
              onClick={() => setActiveTab("simulation")}
              id="tab-simulation-btn"
              className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold font-mono uppercase tracking-wider transition duration-150 cursor-pointer ${
                activeTab === "simulation"
                  ? "bg-zinc-800 text-zinc-100 border border-zinc-750 shadow-sm"
                  : "text-zinc-500 hover:text-zinc-300"
              }`}
            >
              <TrendingUp size={12} /> Live Simulation
            </button>
            <button
              onClick={() => setActiveTab("compiler")}
              id="tab-compiler-btn"
              className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold font-mono uppercase tracking-wider transition duration-150 cursor-pointer ${
                activeTab === "compiler"
                  ? "bg-zinc-800 text-zinc-100 border border-zinc-750 shadow-sm animate-pulse"
                  : "text-zinc-550 hover:text-zinc-350"
              }`}
            >
              <Code size={12} /> Compile MQL5 Script
            </button>
            <button
              onClick={() => setActiveTab("webhook")}
              id="tab-webhook-btn"
              className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold font-mono uppercase tracking-wider transition duration-150 cursor-pointer ${
                activeTab === "webhook"
                  ? "bg-zinc-800 text-zinc-100 border border-zinc-750 shadow-sm"
                  : "text-zinc-550 hover:text-zinc-350"
              }`}
            >
              <TermIcon size={12} /> Webhook Endpoint
            </button>
            <button
              onClick={() => setActiveTab("prd")}
              id="tab-prd-btn"
              className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold font-mono uppercase tracking-wider transition duration-150 cursor-pointer ${
                activeTab === "prd"
                  ? "bg-zinc-800 text-zinc-100 border border-zinc-750 shadow-sm"
                  : "text-zinc-550 hover:text-zinc-350"
              }`}
            >
              <FileText size={12} className="text-amber-500" /> Strategy PRD
            </button>
          </div>

          {/* Tab Content 1: Backtesting & Interactive Canvas Stage */}
          {activeTab === "simulation" && (
            <div className="flex flex-col gap-5">
              <ChartSimulator
                params={stratParams}
                isChoppyMode={isChoppyMode}
                onPlaceWebhookSignal={handleLocalWebhookSignal}
                onTradeFinished={(trade) => setTradeHistory(prev => [trade, ...prev])}
                onStatsUpdated={setStats}
                historicalTrades={tradeHistory}
              />

              {/* Backtesting closed trades logs */}
              <div className="bg-zinc-950 border border-zinc-850 p-5 rounded-2xl">
                <div className="flex items-center justify-between border-b border-zinc-900 pb-3 mb-4">
                  <h4 className="text-zinc-200 text-xs font-bold font-mono uppercase tracking-wide flex items-center gap-2">
                    <WinIcon size={14} className="text-amber-400" /> Playback Backtest Ledger
                  </h4>
                  {tradeHistory.length > 0 && (
                    <button
                      onClick={resetTradeHistory}
                      id="reset-ledger-btn"
                      className="text-[10px] text-zinc-500 hover:text-zinc-350 cursor-pointer flex items-center gap-1 font-mono transition"
                    >
                      <RotateCcw size={10} /> Reset Ledger
                    </button>
                  )}
                </div>

                <div className="overflow-x-auto">
                  {tradeHistory.length === 0 ? (
                    <div className="text-center py-6 text-xs text-zinc-505 font-mono">
                      No positions archived yet. Run the Sandbox to witness trade triggers!
                    </div>
                  ) : (
                    <table className="w-full text-[11px] font-mono whitespace-nowrap text-left">
                      <thead>
                        <tr className="border-b border-zinc-900 text-zinc-500 text-[10px] uppercase">
                          <th className="pb-2">Setup ID</th>
                          <th className="pb-2">Direction</th>
                          <th className="pb-2">Execution Period</th>
                          <th className="pb-2">Entries price</th>
                          <th className="pb-2">Exits Price</th>
                          <th className="pb-2">Lot Weights</th>
                          <th className="pb-2 text-right">Yield Pnl</th>
                        </tr>
                      </thead>
                      <tbody>
                        {tradeHistory.map((trade) => (
                          <tr key={trade.id} className="border-b border-zinc-900/55 hover:bg-zinc-900/30 transition">
                            <td className="py-2.5 font-bold text-zinc-400">
                              {trade.id.substring(6, 11)}..
                            </td>
                            <td className="py-2.5">
                              <span className={`px-2 py-0.5 rounded font-black text-[10px] ${
                                trade.type === "BUY" ? "bg-emerald-950 text-emerald-400" : "bg-red-950 text-red-100"
                              }`}>
                                {trade.type}
                              </span>
                            </td>
                            <td className="py-2.5 text-zinc-300">
                              {trade.entryTime} <ChevronRight className="inline text-zinc-600" size={11} /> {trade.exitTime}
                            </td>
                            <td className="py-2.5 font-medium text-zinc-300">
                              ${trade.entryPrice.toFixed(2)}
                            </td>
                            <td className="py-2.5 font-medium text-zinc-200">
                              ${trade.exitPrice.toFixed(2)}
                            </td>
                            <td className="py-2.5 text-zinc-300">
                              {trade.lots.toFixed(2)} Lots
                            </td>
                            <td className={`py-2.5 font-extrabold text-right ${
                              trade.result === "WIN" ? "text-emerald-400" : 
                              trade.result === "BREAKEVEN" ? "text-cyan-400" : "text-red-400"
                            }`}>
                              {trade.pnl >= 0 ? "+" : ""}${trade.pnl.toFixed(2)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Tab Content 2: Compiler and download script block */}
          {activeTab === "compiler" && (
            <div className="bg-zinc-950 border border-zinc-850 p-6 rounded-2xl flex flex-col gap-5">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-zinc-900 pb-4">
                <div className="flex items-center gap-3">
                  <span className="flex items-center justify-center p-2.5 rounded-xl bg-orange-950/40 border border-orange-900/50 text-orange-400">
                    <FileCode size={20} />
                  </span>
                  <div>
                    <h3 className="text-zinc-100 font-bold text-sm">XAUUSD_EMA_Splits_Bot.mq5</h3>
                    <p className="text-[11px] text-zinc-500 mt-0.5 leading-none">
                      Production ready, commented EA logic file for MetaTrader 5
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={handleCopyCode}
                    id="copy-code-btn"
                    className="flex items-center gap-1.5 bg-zinc-850 hover:bg-zinc-750 text-zinc-250 px-3.5 py-2 rounded-lg border border-zinc-700 transition font-mono text-xs cursor-pointer focus:outline-none"
                  >
                    {copiedCode ? (
                      <>
                        <Check size={13} className="text-emerald-500" /> Copied code
                      </>
                    ) : (
                      <>
                        <Copy size={13} /> Copy EA Code
                      </>
                    )}
                  </button>
                  <button
                    onClick={handleDownloadFile}
                    id="download-code-btn"
                    className="flex items-center gap-1.5 bg-amber-500 hover:bg-amber-600 text-black px-4 py-2 font-bold rounded-lg transition font-mono text-xs cursor-pointer focus:outline-none shadow-lg shadow-amber-500/10"
                    title="Download the compiled .mq5 file"
                  >
                    <Download size={13} /> Download .MQ5
                  </button>
                </div>
              </div>

              {/* Code viewer console */}
              <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 font-mono text-[11px] h-[400px] overflow-y-auto select-text scrollbar-thin text-zinc-300 leading-relaxed scroll-smooth">
                <pre>{generateMql5Code(stratParams, webhookUrl)}</pre>
              </div>

              {/* Instructions checklist block */}
              <div className="bg-zinc-900/40 border border-zinc-850 p-4 rounded-xl flex items-start gap-3">
                <ShieldAlert className="text-amber-500 shrink-0 mt-0.5" size={16} />
                <div className="text-xs text-zinc-400 leading-relaxed">
                  <b className="text-zinc-300">How to load on your chart:</b>
                  <ol className="list-decimal list-inside pl-1 mt-1.5 flex flex-col gap-1 text-[11px]">
                    <li>Copy or download the <b>XAUUSD_EMA_Splits_Bot.mq5</b> above.</li>
                    <li>Inside MT5: Click <b>Tools {'->'} MetaQuotes Language Editor</b> (F4).</li>
                    <li>Create an empty Advisor script, delete template and paste this complete code.</li>
                    <li>Click <b>Compile</b> at the top. Head back to MT5 screen.</li>
                    <li>Drag the Advisor from Navigator onto your 15-Minute XAUUSD Chart!</li>
                  </ol>
                </div>
              </div>
            </div>
          )}

          {/* Tab Content 3: Notification and Webhook Terminal */}
          {activeTab === "webhook" && (
            <NotificationTerminal
              logs={webhookLogs}
              webhookUrl={webhookUrl}
              onClearLogs={clearBackendLogs}
              onRefreshLogs={fetchBackendLogs}
            />
          )}

          {/* Tab Content 4: Strategy PRD Viewer and Download */}
          {activeTab === "prd" && (
            <div className="bg-zinc-950 border border-zinc-850 p-6 rounded-2xl flex flex-col gap-5">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-zinc-900 pb-4">
                <div className="flex items-center gap-3">
                  <span className="flex items-center justify-center p-2.5 rounded-xl bg-amber-950/40 border border-amber-900/50 text-amber-500">
                    <FileText size={20} />
                  </span>
                  <div>
                    <h3 className="text-zinc-100 font-bold text-sm">Product_Requirements_Document.md</h3>
                    <p className="text-[11px] text-zinc-500 mt-0.5 leading-none">
                      Comprehensive system and execution strategy manual
                    </p>
                  </div>
                </div>

                <button
                  onClick={handleDownloadPrd}
                  id="download-prd-btn"
                  className="flex items-center gap-1.5 bg-amber-500 hover:bg-amber-600 text-black px-4 py-2 font-bold rounded-lg transition font-mono text-xs cursor-pointer focus:outline-none shadow-lg shadow-amber-500/10"
                  title="Download the full PRD Markdown document"
                >
                  <Download size={13} /> Download PRD .MD
                </button>
              </div>

              {/* Styled Interactive Roadmap Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-zinc-900 border border-zinc-800 p-4 rounded-xl">
                  <h4 className="text-xs font-bold text-amber-500 font-mono uppercase mb-2">🚀 System Objective</h4>
                  <p className="text-[11px] text-zinc-300 leading-relaxed">
                    Eliminate emotional trading errors and reduce drawdown through deterministic trend crossovers, impulse filters, pullback validation, and split-lot risk distribution.
                  </p>
                </div>
                <div className="bg-zinc-900 border border-zinc-805 p-4 rounded-xl">
                  <h4 className="text-xs font-bold text-emerald-400 font-mono uppercase mb-2">📊 Split-Lot Geometry</h4>
                  <p className="text-[11px] text-zinc-300 leading-relaxed">
                    Total target lots split equally (lot sizes / 2) to trigger Position A (secures TP1 at 3.0x Risk-to-Reward) and Position B (free-rides on TP2 with auto-breakeven protection).
                  </p>
                </div>
              </div>

              {/* Markdown viewer console */}
              <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 font-sans text-xs h-[400px] overflow-y-auto select-text scrollbar-thin text-zinc-300 leading-relaxed scroll-smooth">
                <pre className="font-mono whitespace-pre-wrap text-[11px] text-zinc-300 leading-relaxed">{PRD_TEXT}</pre>
              </div>

              <div className="bg-zinc-900/40 border border-zinc-850 p-4 rounded-xl flex items-start gap-3">
                <ShieldAlert className="text-zinc-500 shrink-0 mt-0.5" size={16} />
                <div className="text-[11px] text-zinc-400 leading-relaxed">
                  <b className="text-zinc-300">Development Footnote:</b> This requirements documentation details the technical blueprints of the local simulation engine state-machine and MT5 script compilers. Keep these rules synchronized with physical file <code className="text-amber-500 text-[10px] font-mono">/Product_Requirements_Document.md</code> in the repository root directory.
                </div>
              </div>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
