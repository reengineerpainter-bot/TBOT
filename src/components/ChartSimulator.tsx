/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from "react";
import { Candle, ActiveTrade, HistoricalTrade, StrategyParameters, BotState, WebhookLog } from "../types";
import { 
  Play, Pause, RefreshCw, AlertTriangle, CheckCircle, TrendingUp, TrendingDown, Clock, Filter, Layers, Zap, Info, ShieldAlert
} from "lucide-react";

// Initial base Gold price
const INITIAL_GOLD_PRICE = 4490.00;

interface ChartSimulatorProps {
  params: StrategyParameters;
  isChoppyMode: boolean;
  onPlaceWebhookSignal: (log: Partial<WebhookLog>) => void;
  onTradeFinished: (trade: HistoricalTrade) => void;
  historicalTrades: HistoricalTrade[];
  onStatsUpdated: (stats: { count: number; profit: number; winRate: number }) => void;
}

export default function ChartSimulator({
  params,
  isChoppyMode,
  onPlaceWebhookSignal,
  onTradeFinished,
  historicalTrades,
  onStatsUpdated,
}: ChartSimulatorProps) {
  // Chart and Simulation State
  const [candles, setCandles] = useState<Candle[]>([]);
  const [isPlaying, setIsPlaying] = useState<boolean>(true);
  const [simSpeed, setSimSpeed] = useState<number>(3000); // ms per simulated tick
  const [spreadPips, setSpreadPips] = useState<number>(18); // Gold typical spread: 1.8 USD (18 pips)
  const [spreadFluctuate, setSpreadFluctuate] = useState<boolean>(true);

  // Strategy State Machine Tracker
  const [botState, setBotState] = useState<BotState>({
    currentStage: "IDLE",
    stageNotes: "Scanning for fresh 9/50 EMA crossover on 15m/1h candle close...",
    crossoverPrice: 0,
    tradesPlacedToday: 0,
    todayProfit: 0,
    dailyWinRate: 0,
    confirmationCandle: null,
  });

  const [setupDirection, setSetupDirection] = useState<"BUY" | "SELL" | null>(null);
  const [activeTrade, setActiveTrade] = useState<ActiveTrade | null>(null);

  // Time tracking
  const [simulatedTime, setSimulatedTime] = useState<Date>(new Date());
  
  // Element Refs for dimensions
  const containerRef = useRef<HTMLDivElement>(null);
  const candlesRef = useRef<Candle[]>([]);
  const [dimensions, setDimensions] = useState({ width: 800, height: 400 });

  // Sync candles ref
  useEffect(() => {
    candlesRef.current = candles;
  }, [candles]);

  // Update chart dimensions on resize
  useEffect(() => {
    if (containerRef.current) {
      setDimensions({
        width: containerRef.current.clientWidth || 800,
        height: 380,
      });
    }

    const handleResize = () => {
      if (containerRef.current) {
        setDimensions({
          width: containerRef.current.clientWidth || 800,
          height: 380,
        });
      }
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // Calculate EMA helper
  const calculateNextEma = (price: number, prevEma: number, period: number): number => {
    const k = 2 / (period + 1);
    return price * k + prevEma * (1 - k);
  };

  // Build initial Candle database
  const initChartData = () => {
    const initialCandles: Candle[] = [];
    let prevClose = INITIAL_GOLD_PRICE;
    let prevFast = INITIAL_GOLD_PRICE;
    let prevSlow = INITIAL_GOLD_PRICE;
    let prevTrend = INITIAL_GOLD_PRICE - 15.0; // below slow initially to trigger standard uptrend

    const count = 50;

    for (let i = 0; i < count; i++) {
      // Create trending sequence to start with or choppy sideways
      let change = 0;
      if (isChoppyMode) {
        // Horizontal sideways noise
        change = (Math.random() - 0.5) * 2.5;
      } else {
        // Strong bullish trend initially to set up a clean crossover scene
        if (i < 20) {
          change = (Math.random() - 0.3) * 3.5; // trending up
        } else if (i < 35) {
          change = (Math.random() - 0.7) * 4.0; // pullback
        } else {
          change = (Math.random() - 0.2) * 5.0; // extension
        }
      }

      const open = prevClose;
      const close = prevClose + change;
      const high = Math.max(open, close) + Math.random() * 1.5;
      const low = Math.min(open, close) - Math.random() * 1.5;
      
      const fast = calculateNextEma(close, prevFast, params.fastEma);
      const slow = calculateNextEma(close, prevSlow, params.slowEma);
      const trend = calculateNextEma(close, prevTrend, params.trendEma);

      initialCandles.push({
        time: new Date(Date.now() - (count - i) * 15 * 60 * 1000).toISOString(),
        open: Number(open.toFixed(2)),
        high: Number(high.toFixed(2)),
        low: Number(low.toFixed(2)),
        close: Number(close.toFixed(2)),
        emaFast: Number(fast.toFixed(2)),
        emaSlow: Number(slow.toFixed(2)),
        emaTrend: Number(trend.toFixed(2)),
        volume: Math.floor(Math.random() * 800) + 200,
      });

      prevClose = close;
      prevFast = fast;
      prevSlow = slow;
      prevTrend = trend;
    }

    setCandles(initialCandles);
    setBotState({
      currentStage: "IDLE",
      stageNotes: "Scanning for fresh 9/50 EMA crossover on 15m/1h candle close...",
      crossoverPrice: 0,
      tradesPlacedToday: botState.tradesPlacedToday,
      todayProfit: botState.todayProfit,
      dailyWinRate: botState.dailyWinRate,
      confirmationCandle: null,
    });
    setSetupDirection(null);
    setActiveTrade(null);
  };

  // Re-initialize chart when strategy change triggers or choppy option is updated
  useEffect(() => {
    initChartData();
  }, [params.fastEma, params.slowEma, params.trendEma, isChoppyMode]);

  // Main Ticker Engine
  useEffect(() => {
    if (!isPlaying) return;

    const interval = setInterval(() => {
      const currentCandles = candlesRef.current;
      if (currentCandles.length === 0) return;

      const lastCandle = currentCandles[currentCandles.length - 1];
      let priceFluctuation = (Math.random() - 0.5) * 1.2;

      // Apply spread fluctuation if enabled
      if (spreadFluctuate) {
        setSpreadPips((prev) => {
          const spreadChange = Math.floor((Math.random() - 0.5) * 8);
          let nextSpread = prev + spreadChange;
          if (nextSpread < 12) nextSpread = 12; // Gold spread minimum 12 pips
          if (nextSpread > 55) nextSpread = 55; // Sudden spike up to 55 pips
          return nextSpread;
        });
      }

      // Generate trend bias based on Choppy option or active bot strategy
      let bias = 0;
      if (isChoppyMode) {
        // Sideways oscillating movement
        bias = (INITIAL_GOLD_PRICE - lastCandle.close) * 0.05; // attract back to pivot to force chop
      } else {
        // If a pullback was reached, we want to simulate price starting to head in setup direction
        if (botState.currentStage === "PULLBACK") {
          bias = setupDirection === "BUY" ? 1.5 : -1.5;
        } else if (botState.currentStage === "CONFIRMED") {
          if (botState.impulseValidated) {
            // Push candle downward for BUY (force pullback search to touch touchpoint / EMA 50)
            bias = setupDirection === "BUY" ? -1.4 : 1.4;
          } else {
            // Push candle upward for BUY (build impulse trend strength to clear minimum distance)
            bias = setupDirection === "BUY" ? 1.7 : -1.7;
          }
        } else if (activeTrade) {
          // Active position, generate realistic trends to SL or TP
          bias = activeTrade.type === "BUY" ? 0.8 : -0.8;
        } else {
          // General trend wave (sine wave)
          const cycle = Math.sin(Date.now() / 60000);
          bias = cycle * 1.8;
        }
      }

      priceFluctuation += bias;

      // Create new candle simulation point
      const open = lastCandle.close;
      const close = open + priceFluctuation;
      const high = Math.max(open, close) + Math.random() * 0.8;
      const low = Math.min(open, close) - Math.random() * 0.8;

      const fast = calculateNextEma(close, lastCandle.emaFast, params.fastEma);
      const slow = calculateNextEma(close, lastCandle.emaSlow, params.slowEma);
      const trend = calculateNextEma(close, lastCandle.emaTrend, params.trendEma);

      const newCandle: Candle = {
        time: new Date().toISOString(),
        open: Number(open.toFixed(2)),
        high: Number(high.toFixed(2)),
        low: Number(low.toFixed(2)),
        close: Number(close.toFixed(2)),
        emaFast: Number(fast.toFixed(2)),
        emaSlow: Number(slow.toFixed(2)),
        emaTrend: Number(trend.toFixed(2)),
        volume: Math.floor(Math.random() * 400) + 100,
      };

      // Advance simulated clock
      setSimulatedTime(new Date());

      // Strategy Engine Real-time Analysis
      simulateStrategyLogic(newCandle, currentCandles);

      // Keep last 60 candles to avoid layout slowing
      const updated = [...currentCandles.slice(1), newCandle];
      setCandles(updated);
    }, simSpeed);

    return () => clearInterval(interval);
  }, [isPlaying, simSpeed, botState, setupDirection, activeTrade, isChoppyMode, spreadPips, params, spreadFluctuate]);

  // Handle Strategy Setup logic & transitions
  const simulateStrategyLogic = (currentCandle: Candle, history: Candle[]) => {
    if (history.length < 2) return;
    const prevClosedCandle = history[history.length - 1];
    const oldClosedCandle = history[history.length - 2];

    // Check Choppy Filter: Do not trade flat market
    const crossoverDiff = Math.abs(currentCandle.emaFast - currentCandle.emaSlow);
    const isChoppyFilterActive = crossoverDiff < 1.1 && isChoppyMode;

    // ACTIVE POSITION MONITORING
    if (activeTrade) {
      const currentPrice = currentCandle.close;
      let pnl = 0;

      if (activeTrade.type === "BUY") {
        // For BUY, TP1/2 are above, SL is below
        pnl = (currentPrice - activeTrade.entryPrice) * 10 * activeTrade.lots; // Multiply for Gold pricing

        // Check TP1
        if (activeTrade.status === "OPEN" && currentPrice >= activeTrade.tp1) {
          // Trigger first split take profit!
          // Half total lot closed at TP1, other half is active and moved to breakeven
          const closedLots = activeTrade.splitLots[0];
          const trade1Profit = (activeTrade.tp1 - activeTrade.entryPrice) * 10 * closedLots;

          onPlaceWebhookSignal({
            type: "tp",
            price: activeTrade.tp1,
            direction: "BUY",
            message: `🎉 SPLIT TP1 HIT at ${activeTrade.tp1.toFixed(2)}: Closed 1st half of lot size (${closedLots.toFixed(2)}) for profit $+${trade1Profit.toFixed(2)}.`
          });

          // Move stop loss of remainder to breakeven!
          setActiveTrade({
            ...activeTrade,
            status: "TP1_HIT",
            sl: activeTrade.entryPrice, // move to breakeven!
            pnl: trade1Profit,
            tradesClosed: 1,
            comments: "First split closed at TP1. Remainder stop loss moved to Breakeven entry price."
          });

          setBotState(prev => ({
            ...prev,
            currentStage: "ACTIVE_TRADE",
            stageNotes: `TP1 hit at ${activeTrade.tp1}! 1st split profit taken. 2nd split Stop Loss moved to Entry Breakeven ${activeTrade.entryPrice.toFixed(2)}.`,
            todayProfit: prev.todayProfit + trade1Profit,
          }));

          onPlaceWebhookSignal({
            type: "breakeven",
            price: activeTrade.entryPrice,
            direction: "BUY",
            message: `🛡️ BREAKEVEN SECURED on remaining split lot (${activeTrade.splitLots[1].toFixed(2)}). Stop loss updated to ${activeTrade.entryPrice.toFixed(2)}.`
          });
        }
        // Check TP2 (for second split)
        else if (activeTrade.status === "TP1_HIT" && currentPrice >= activeTrade.tp2) {
          const secondLots = activeTrade.splitLots[1];
          const trade2Profit = (activeTrade.tp2 - activeTrade.entryPrice) * 10 * secondLots;
          const totalPnl = activeTrade.pnl + trade2Profit;

          onPlaceWebhookSignal({
            type: "tp",
            price: activeTrade.tp2,
            direction: "BUY",
            message: `🏆 ULTIMATE TP2 HIT at ${activeTrade.tp2.toFixed(2)}: Closed remaining split (${secondLots.toFixed(2)}) for profit $+${trade2Profit.toFixed(2)}.`
          });

          // Terminate active position, publish to history logs
          const historic: HistoricalTrade = {
            id: activeTrade.id,
            type: "BUY",
            entryPrice: activeTrade.entryPrice,
            exitPrice: activeTrade.tp2,
            entryTime: activeTrade.entryTime,
            exitTime: new Date().toISOString(),
            lots: activeTrade.lots,
            pnl: totalPnl,
            result: "WIN",
            reason: "Fully Hit Split TPs (3x & 4x R:R)",
          };
          onTradeFinished(historic);
          setActiveTrade(null);
          setSetupDirection(null);
          
          setBotState(prev => ({
            ...prev,
            currentStage: "IDLE",
            stageNotes: `🏆 Trade sequence finished beautifully! Both splits hit TPs. Final Profit: $${totalPnl.toFixed(2)}. Scanner Idle.`,
            todayProfit: prev.todayProfit + trade2Profit,
          }));
        }
        // Check SL
        else if (currentPrice <= activeTrade.sl) {
          // Hit stop loss!
          let finalProfit = 0;
          let resultType: "LOSS" | "BREAKEVEN" = "LOSS";
          let exitReason = "Hit Initial Swing Stop Loss";

          if (activeTrade.status === "TP1_HIT") {
            // Already hit TP1 for half lot, remainder hit breakeven SL at entry price
            finalProfit = activeTrade.pnl; // only holding TP1 profits, second split lost 0
            resultType = "BREAKEVEN";
            exitReason = "Split A Hit TP1; Split B hit Entry Breakeven.";
            
            onPlaceWebhookSignal({
              type: "breakeven",
              price: activeTrade.sl,
              direction: "BUY",
              message: `🛡️ SL triggering at Breakeven level ${activeTrade.sl.toFixed(2)}. Remaining split exited safely with no loss.`
            });
          } else {
            // Hit original stop loss for entire position
            finalProfit = (activeTrade.sl - activeTrade.entryPrice) * 10 * activeTrade.lots;
            resultType = "LOSS";

            onPlaceWebhookSignal({
              type: "sl",
              price: activeTrade.sl,
              direction: "BUY",
              message: `🛑 STOP LOSS TRIGGERED at ${activeTrade.sl.toFixed(2)} (below recent swing low). Loss: $${finalProfit.toFixed(2)}.`
            });
          }

          const historic: HistoricalTrade = {
            id: activeTrade.id,
            type: "BUY",
            entryPrice: activeTrade.entryPrice,
            exitPrice: activeTrade.sl,
            entryTime: activeTrade.entryTime,
            exitTime: new Date().toISOString(),
            lots: activeTrade.lots,
            pnl: finalProfit,
            result: resultType,
            reason: exitReason,
          };

          onTradeFinished(historic);
          setActiveTrade(null);
          setSetupDirection(null);

          setBotState(prev => ({
            ...prev,
            currentStage: "IDLE",
            stageNotes: `🛑 Trade exited. SL hit. Reverting state to SCANNING IDLE.`,
            todayProfit: prev.todayProfit + (resultType === "LOSS" ? finalProfit : 0),
          }));
        }
      } 
      // SELL Active Trades
      else if (activeTrade.type === "SELL") {
        pnl = (activeTrade.entryPrice - currentPrice) * 10 * activeTrade.lots;

        // Check TP1 (for sell, below entry)
        if (activeTrade.status === "OPEN" && currentPrice <= activeTrade.tp1) {
          const closedLots = activeTrade.splitLots[0];
          const trade1Profit = (activeTrade.entryPrice - activeTrade.tp1) * 10 * closedLots;

          onPlaceWebhookSignal({
            type: "tp",
            price: activeTrade.tp1,
            direction: "SELL",
            message: `🎉 SPLIT TP1 HIT at ${activeTrade.tp1.toFixed(2)}: Closed 1st half of lot size (${closedLots.toFixed(2)}) for profit $+${trade1Profit.toFixed(2)}.`
          });

          setActiveTrade({
            ...activeTrade,
            status: "TP1_HIT",
            sl: activeTrade.entryPrice, // breakeven
            pnl: trade1Profit,
            tradesClosed: 1,
            comments: "First split closed at TP1 (3x). Sub-lot SL secured at Entry price."
          });

          setBotState(prev => ({
            ...prev,
            currentStage: "ACTIVE_TRADE",
            stageNotes: `TP1 hit at ${activeTrade.tp1}! 1st split profit taken. 2nd split Stop Loss moved to Entry Breakeven ${activeTrade.entryPrice.toFixed(2)}.`,
            todayProfit: prev.todayProfit + trade1Profit,
          }));

          onPlaceWebhookSignal({
            type: "breakeven",
            price: activeTrade.entryPrice,
            direction: "SELL",
            message: `🛡️ BREAKEVEN SECURED on remaining split lot (${activeTrade.splitLots[1].toFixed(2)}). Stop loss updated to ${activeTrade.entryPrice.toFixed(2)}.`
          });
        }
        // Check TP2 (below TP1 for SELL)
        else if (activeTrade.status === "TP1_HIT" && currentPrice <= activeTrade.tp2) {
          const secondLots = activeTrade.splitLots[1];
          const trade2Profit = (activeTrade.entryPrice - activeTrade.tp2) * 10 * secondLots;
          const totalPnl = activeTrade.pnl + trade2Profit;

          onPlaceWebhookSignal({
            type: "tp",
            price: activeTrade.tp2,
            direction: "SELL",
            message: `🏆 ULTIMATE TP2 HIT at ${activeTrade.tp2.toFixed(2)}: Closed remaining split (${secondLots.toFixed(2)}) for profit $+${trade2Profit.toFixed(2)}.`
          });

          const historic: HistoricalTrade = {
            id: activeTrade.id,
            type: "SELL",
            entryPrice: activeTrade.entryPrice,
            exitPrice: activeTrade.tp2,
            entryTime: activeTrade.entryTime,
            exitTime: new Date().toISOString(),
            lots: activeTrade.lots,
            pnl: totalPnl,
            result: "WIN",
            reason: "Fully Hit Split TPs (3x & 4x R:R)",
          };
          onTradeFinished(historic);
          setActiveTrade(null);
          setSetupDirection(null);
          
          setBotState(prev => ({
            ...prev,
            currentStage: "IDLE",
            stageNotes: `🏆 Trade sequence finished beautifully! Both splits hit TPs. Final Profit: $${totalPnl.toFixed(2)}. Scanner Idle.`,
            todayProfit: prev.todayProfit + trade2Profit,
          }));
        }
        // Check SL (Sell SL is above entry)
        else if (currentPrice >= activeTrade.sl) {
          let finalProfit = 0;
          let resultType: "LOSS" | "BREAKEVEN" = "LOSS";
          let exitReason = "Hit Initial Swing Stop Loss";

          if (activeTrade.status === "TP1_HIT") {
            finalProfit = activeTrade.pnl; // hold profits
            resultType = "BREAKEVEN";
            exitReason = "Split A Hit TP1; Split B hit Entry Breakeven.";

            onPlaceWebhookSignal({
              type: "breakeven",
              price: activeTrade.sl,
              direction: "SELL",
              message: `🛡️ SL triggering at Breakeven level ${activeTrade.sl.toFixed(2)}. Remaining split exited safely with no loss.`
            });
          } else {
            finalProfit = (activeTrade.entryPrice - activeTrade.sl) * 10 * activeTrade.lots;
            resultType = "LOSS";

            onPlaceWebhookSignal({
              type: "sl",
              price: activeTrade.sl,
              direction: "SELL",
              message: `🛑 STOP LOSS TRIGGERED at ${activeTrade.sl.toFixed(2)} (above recent swing high). Loss: $${finalProfit.toFixed(2)}.`
            });
          }

          const historic: HistoricalTrade = {
            id: activeTrade.id,
            type: "SELL",
            entryPrice: activeTrade.entryPrice,
            exitPrice: activeTrade.sl,
            entryTime: activeTrade.entryTime,
            exitTime: new Date().toISOString(),
            lots: activeTrade.lots,
            pnl: finalProfit,
            result: resultType,
            reason: exitReason,
          };

          onTradeFinished(historic);
          setActiveTrade(null);
          setSetupDirection(null);

          setBotState(prev => ({
            ...prev,
            currentStage: "IDLE",
            stageNotes: `🛑 Trade exited. SL hit. Reverting state to SCANNING IDLE.`,
            todayProfit: prev.todayProfit + (resultType === "LOSS" ? finalProfit : 0),
          }));
        }
      }
      return; // Stop running setup confirmations while trade is active
    }

    // STATE 1: IDLE - LOOKING FOR CROSSOVER AND IMPULSE DISTANCE
    if (botState.currentStage === "IDLE") {
      // Avoid tracking if choppy filter triggers
      if (isChoppyFilterActive) {
        setBotState(prev => ({
          ...prev,
          stageNotes: "⚠️ Choppy market detected. Bot filters active to prevent losses. Scanner paused.",
        }));
        return;
      }

      // 9 EMA crossing 50 EMA on previous candle
      const prevEmaFast = prevClosedCandle.emaFast;
      const prevEmaSlow = prevClosedCandle.emaSlow;
      const oldEmaFast = oldClosedCandle.emaFast;
      const oldEmaSlow = oldClosedCandle.emaSlow;

      const hasBullishCross = prevEmaFast > prevEmaSlow && oldEmaFast <= oldEmaSlow;
      const hasBearishCross = prevEmaFast < prevEmaSlow && oldEmaFast >= oldEmaSlow;

      if (hasBullishCross || hasBearishCross) {
        const crossoverPrice = prevClosedCandle.emaSlow;
        const dir = hasBullishCross ? "BUY" : "SELL";
        
        setSetupDirection(dir);
        setBotState({
          currentStage: "CONFIRMED",
          impulseValidated: false,
          stageNotes: `📢 9/50 EMA Crossover Formed (${dir})! Candle closed at $${prevClosedCandle.close.toFixed(2)}. Monitoring subsequent candles for >= ${params.minDistancePips} pips of impulse.`,
          crossoverPrice: crossoverPrice,
          tradesPlacedToday: botState.tradesPlacedToday,
          todayProfit: botState.todayProfit,
          dailyWinRate: botState.dailyWinRate,
          lastConfirmationTime: new Date().toLocaleTimeString(),
        });

        onPlaceWebhookSignal({
          type: "info",
          price: prevClosedCandle.close,
          direction: dir,
          message: `📢 9/50 crossover detected on XAUUSD ${params.timeframe}! ${dir} setup initiated, waiting for impulse distance validation (>= ${params.minDistancePips} pips).`
        });
      }
    }

    // STATE 2: CONFIRMED - WAITING FOR IMPULSE VALIDATION AND PULLBACK
    else if (botState.currentStage === "CONFIRMED" && setupDirection) {
      const closePrice = prevClosedCandle.close;
      const currentEmaSlow = prevClosedCandle.emaSlow;
      
      // 1. Invalidation Check: closed candle crossed back below/above the Slow EMA
      if (setupDirection === "BUY" && closePrice < currentEmaSlow) {
        setSetupDirection(null);
        setBotState(prev => ({
          ...prev,
          currentStage: "IDLE",
          impulseValidated: false,
          stageNotes: `⚠️ Invalidation: Candle closed below 50 EMA ($${closePrice.toFixed(2)} < $${currentEmaSlow.toFixed(2)}). Reverting to IDLE scanner.`,
        }));
        onPlaceWebhookSignal({
          type: "info",
          price: closePrice,
          message: `⚠️ SETUP INVALIDATED: XAUUSD closed back below the 50 EMA ($${closePrice.toFixed(2)}). Scanner reset to IDLE.`
        });
        return;
      }
      else if (setupDirection === "SELL" && closePrice > currentEmaSlow) {
        setSetupDirection(null);
        setBotState(prev => ({
          ...prev,
          currentStage: "IDLE",
          impulseValidated: false,
          stageNotes: `⚠️ Invalidation: Candle closed above 50 EMA ($${closePrice.toFixed(2)} > $${currentEmaSlow.toFixed(2)}). Reverting to IDLE scanner.`,
        }));
        onPlaceWebhookSignal({
          type: "info",
          price: closePrice,
          message: `⚠️ SETUP INVALIDATED: XAUUSD closed back above the 50 EMA ($${closePrice.toFixed(2)}). Scanner reset to IDLE.`
        });
        return;
      }

      // 2. Impulse Validation Check
      let impulseOk = !!botState.impulseValidated;
      if (!impulseOk) {
        const impulsePoints = Math.abs(closePrice - currentEmaSlow);
        const impulsePips = impulsePoints * 100; // 1 pip = 0.01 gold points

        if (impulsePips >= params.minDistancePips) {
          impulseOk = true;
          setBotState(prev => ({
            ...prev,
            impulseValidated: true,
            confirmationCandle: prevClosedCandle,
            lastConfirmationTime: new Date().toLocaleTimeString(),
            stageNotes: `📢 1st Confirmation Formed! Impulse distance verified at ${impulsePips.toFixed(0)} pips (Goal: >= ${params.minDistancePips} pips). Waiting for pullback to EMA 50 / crossover level.`,
          }));
          onPlaceWebhookSignal({
            type: "confirmation",
            price: closePrice,
            direction: setupDirection,
            message: `📢 1st Confirmation Formed: Impulse distance of ${impulsePips.toFixed(0)} pips (>= ${params.minDistancePips} pips) has been validated! Awaiting pullback to key level.`
          });
        } else {
          setBotState(prev => ({
            ...prev,
            stageNotes: `⏳ Crossover active. Current impulse is ${impulsePips.toFixed(0)} pips (Need >= ${params.minDistancePips} pips). Waiting for subsequent candle closures to build strength.`,
          }));
          return; // Remain in CONFIRMED waiting for impulse on subsequent closes
        }
      }

      // 3. Check Pullback Phase (since impulse is validated)
      const currentLow = currentCandle.low;
      const currentHigh = currentCandle.high;
      const current50Ema = currentCandle.emaSlow;
      const triggerLevel = botState.crossoverPrice;

      let isPulledBack = false;

      if (setupDirection === "BUY") {
        if (currentLow <= current50Ema || currentLow <= triggerLevel) {
          isPulledBack = true;
        }
      } else {
        if (currentHigh >= current50Ema || currentHigh >= triggerLevel) {
          isPulledBack = true;
        }
      }

      // Also confirmation if 50 EMA crosses 200 EMA (major golden cross)
      const has50vs200CrossBullish = currentCandle.emaSlow > currentCandle.emaTrend && prevClosedCandle.emaSlow <= prevClosedCandle.emaTrend;
      const has50vs200CrossBearish = currentCandle.emaSlow < currentCandle.emaTrend && prevClosedCandle.emaSlow >= prevClosedCandle.emaTrend;
      if ((setupDirection === "BUY" && has50vs200CrossBullish) || (setupDirection === "SELL" && has50vs200CrossBearish)) {
        isPulledBack = true;
      }

      if (isPulledBack) {
        setBotState(prev => ({
          ...prev,
          currentStage: "PULLBACK",
          stageNotes: `📉 Pullback successful! Price bounced touchpoint where crossover occurred / touched EMA 50. Waiting for next continuation candle (closed in setup trend direction) on 15m/5m timeframe.`,
          pullbackReachedAt: new Date().toLocaleTimeString(),
        }));

        onPlaceWebhookSignal({
          type: "info",
          price: currentCandle.close,
          message: `📉 Pullback validated! Price touched EMA 50 level at $${currentCandle.close.toFixed(2)}. Awaiting confirmation of continuation on the next candle closure.`
        });
      }
    }

    // STATE 3: PULLBACK - WAITING FOR CONTINUATION SIGNAL & TRIGGER TRADE
    else if (botState.currentStage === "PULLBACK" && setupDirection) {
      const closePrice = prevClosedCandle.close;
      const currentEmaSlow = prevClosedCandle.emaSlow;

      // Check Invalidation while waiting for continuation
      if (setupDirection === "BUY" && closePrice < currentEmaSlow) {
        setSetupDirection(null);
        setBotState(prev => ({
          ...prev,
          currentStage: "IDLE",
          impulseValidated: false,
          stageNotes: `⚠️ Invalidation: During pullback, candle closed below 50 EMA ($${closePrice.toFixed(2)} < $${currentEmaSlow.toFixed(2)}). Reverting to IDLE scanner.`,
        }));
        onPlaceWebhookSignal({
          type: "info",
          price: closePrice,
          message: `⚠️ SETUP INVALIDATED: Price broke below the 50 EMA during the pullback phase ($${closePrice.toFixed(2)}). Scanner reset.`
        });
        return;
      }
      else if (setupDirection === "SELL" && closePrice > currentEmaSlow) {
        setSetupDirection(null);
        setBotState(prev => ({
          ...prev,
          currentStage: "IDLE",
          impulseValidated: false,
          stageNotes: `⚠️ Invalidation: During pullback, candle closed above 50 EMA ($${closePrice.toFixed(2)} > $${currentEmaSlow.toFixed(2)}). Reverting to IDLE scanner.`,
        }));
        onPlaceWebhookSignal({
          type: "info",
          price: closePrice,
          message: `⚠️ SETUP INVALIDATED: Price broke above the 50 EMA during the pullback phase ($${closePrice.toFixed(2)}). Scanner reset.`
        });
        return;
      }

      // Continuation candle means candle closes in our trend direction on next closed bar
      const isOpenGreen = prevClosedCandle.close > prevClosedCandle.open;

      let isContinuationConfirmed = false;
      if (setupDirection === "BUY" && isOpenGreen) {
        isContinuationConfirmed = true;
      } else if (setupDirection === "SELL" && !isOpenGreen) {
        isContinuationConfirmed = true;
      }

      if (isContinuationConfirmed) {
        // Safety guard 1: Max trades today
        if (botState.tradesPlacedToday >= params.maxTradesPerDay) {
          setBotState(prev => ({
            ...prev,
            currentStage: "IDLE",
            stageNotes: `🛑 Trade blocked! Reached maximum daily limits of ${params.maxTradesPerDay} trades today. State reset to IDLE scanner.`,
          }));
          onPlaceWebhookSignal({
            type: "error",
            price: currentCandle.close,
            message: `⚠️ Entry blocked! Reached maximum daily allowed trading frequency (${params.maxTradesPerDay} trades). Bot rules preventing over-trading.`
          });
          return;
        }

        // Safety guard 2: Spread Filter
        if (spreadPips > params.maxSpreadPips) {
          setBotState(prev => ({
            ...prev,
            stageNotes: `⚠️ Entry delayed! Spread too high: ${spreadPips} pips. Maximum allowed spread is ${params.maxSpreadPips} pips. Waiting.`,
          }));
          return;
        }

        // We execute trade!
        const totalLot = params.defaultLotSize;
        const split = [Number((totalLot / 2).toFixed(2)), Number((totalLot / 2).toFixed(2))];
        const entryPrice = currentCandle.close;

        // Calculate Swing Stop Loss (SL)
        // Find recent swing (lowest close or low of last 15 candles on buy, highest on sell)
        const recentCandlesForSwing = history.slice(-15);
        let swingValue = entryPrice;

        if (setupDirection === "BUY") {
          const minLow = Math.min(...recentCandlesForSwing.map(c => c.low));
          swingValue = minLow - 0.50; // buffer below swing
          
          // Protect from negative or razor-thin SL
          if (entryPrice - swingValue < 1.0) {
            swingValue = entryPrice - 4.5; // backup 450 points
          }

          const slDelta = entryPrice - swingValue;
          const tp1 = entryPrice + (slDelta * params.tp1Ratio);
          const tp2 = entryPrice + (slDelta * params.tp2Ratio);

          const tradeId = `trade-${Date.now()}`;
          const newTrade: ActiveTrade = {
            id: tradeId,
            type: "BUY",
            entryPrice: entryPrice,
            entryTime: new Date().toLocaleTimeString(),
            sl: Number(swingValue.toFixed(2)),
            tp1: Number(tp1.toFixed(2)),
            tp2: Number(tp2.toFixed(2)),
            initialSl: Number(swingValue.toFixed(2)),
            lots: totalLot,
            splitLots: split,
            status: "OPEN",
            pnl: 0,
            tradesClosed: 0,
            comments: `Split position: Slot A (${split[0]} Lot) -> TP1 at 3x Risk. Slot B (${split[1]} Lot) -> TP2 at 4x Risk.`
          };

          setActiveTrade(newTrade);
          setBotState(prev => ({
            ...prev,
            currentStage: "ACTIVE_TRADE",
            stageNotes: `🚀 ACTUAL ENTRY FILLED! Split Lot BUY orders entered. Position A TP1: ${tp1.toFixed(2)} (3x), Position B TP2: ${tp2.toFixed(2)} (4x). SL: ${swingValue.toFixed(2)}.`,
            tradesPlacedToday: prev.tradesPlacedToday + 1,
          }));

          // Trigger ACTUAL entry Webhook Signal!
          onPlaceWebhookSignal({
            type: "entry",
            price: entryPrice,
            direction: "BUY",
            lots: split,
            sl: Number(swingValue.toFixed(2)),
            tp1: Number(tp1.toFixed(2)),
            tp2: Number(tp2.toFixed(2)),
            spread: spreadPips,
            message: `🚀 ACTUAL ENTRY FILLED: Opened BUY split-lot orders (2x ${split[0]} Lots) at $${entryPrice.toFixed(2)}. SL set below recent swing low at $${swingValue.toFixed(2)}. TP1 (3x) at $${tp1.toFixed(2)}, TP2 (4x) at $${tp2.toFixed(2)}. Active spread was ${spreadPips} pips.`
          });

        } else {
          // SELL SETUP
          const maxHigh = Math.max(...recentCandlesForSwing.map(c => c.high));
          swingValue = maxHigh + 0.50; // buffer above swing
          
          if (swingValue - entryPrice < 1.0) {
            swingValue = entryPrice + 4.5;
          }

          const slDelta = swingValue - entryPrice;
          const tp1 = entryPrice - (slDelta * params.tp1Ratio);
          const tp2 = entryPrice - (slDelta * params.tp2Ratio);

          const tradeId = `trade-${Date.now()}`;
          const newTrade: ActiveTrade = {
            id: tradeId,
            type: "SELL",
            entryPrice: entryPrice,
            entryTime: new Date().toLocaleTimeString(),
            sl: Number(swingValue.toFixed(2)),
            tp1: Number(tp1.toFixed(2)),
            tp2: Number(tp2.toFixed(2)),
            initialSl: Number(swingValue.toFixed(2)),
            lots: totalLot,
            splitLots: split,
            status: "OPEN",
            pnl: 0,
            tradesClosed: 0,
            comments: `Split position: Slot A (${split[0]} Lot) -> TP1 lower at 3x Risk. Slot B (${split[1]} Lot) -> TP2 lower at 4x Risk.`
          };

          setActiveTrade(newTrade);
          setBotState(prev => ({
            ...prev,
            currentStage: "ACTIVE_TRADE",
            stageNotes: `🚀 ACTUAL ENTRY FILLED! Split Lot SELL orders entered. Position A TP1: ${tp1.toFixed(2)} (3x), Position B TP2: ${tp2.toFixed(2)} (4x). SL: ${swingValue.toFixed(2)}.`,
            tradesPlacedToday: prev.tradesPlacedToday + 1,
          }));

          onPlaceWebhookSignal({
            type: "entry",
            price: entryPrice,
            direction: "SELL",
            lots: split,
            sl: Number(swingValue.toFixed(2)),
            tp1: Number(tp1.toFixed(2)),
            tp2: Number(tp2.toFixed(2)),
            spread: spreadPips,
            message: `🚀 ACTUAL ENTRY FILLED: Opened SELL split-lot orders (2x ${split[0]} Lots) at $${entryPrice.toFixed(2)}. SL set above recent swing high at $${swingValue.toFixed(2)}. TP1 (3x) at $${tp1.toFixed(2)}, TP2 (4x) at $${tp2.toFixed(2)}. Active spread was ${spreadPips} pips.`
          });
        }
      }
    }
  };

  // Compute stats metrics on trade updates
  useEffect(() => {
    if (historicalTrades.length === 0) return;
    const wins = historicalTrades.filter(t => t.result === "WIN").length;
    const bks = historicalTrades.filter(t => t.result === "BREAKEVEN").length;
    const tot = historicalTrades.length;
    // Winrate: treats breakevens separately
    const winRateVal = tot > 0 ? ((wins / tot) * 100) : 0;

    onStatsUpdated({
      count: tot,
      profit: historicalTrades.reduce((acc, current) => acc + current.pnl, 0),
      winRate: Math.round(winRateVal),
    });
  }, [historicalTrades]);

  // SVG parameters coordinate converters
  const getMinMaxPrices = () => {
    if (candles.length === 0) return { min: 4400, max: 4600 };
    const highs = candles.map((c) => c.high);
    const lows = candles.map((c) => c.low);
    const emaF = candles.map((c) => c.emaFast);
    const emaS = candles.map((c) => c.emaSlow);
    const emaT = candles.map((c) => c.emaTrend);

    let max = Math.max(...highs, ...emaF, ...emaS, ...emaT);
    let min = Math.min(...lows, ...emaF, ...emaS, ...emaT);

    // If active trades are running, zoom to see the SL and TP target lines nicely!
    if (activeTrade) {
      max = Math.max(max, activeTrade.tp1, activeTrade.tp2, activeTrade.sl, activeTrade.entryPrice);
      min = Math.min(min, activeTrade.tp1, activeTrade.tp2, activeTrade.sl, activeTrade.entryPrice);
    }

    const padding = (max - min) * 0.15 || 5;
    return { min: min - padding, max: max + padding };
  };

  const { min: yMin, max: yMax } = getMinMaxPrices();

  // Project point to SVG pixel coords
  const getX = (index: number) => {
    const spacing = dimensions.width / (candles.length || 1);
    return index * spacing + spacing / 2;
  };

  const getY = (price: number) => {
    const range = yMax - yMin;
    return dimensions.height - ((price - yMin) / (range || 1)) * dimensions.height;
  };

  // Convert candle array into formatted path string for lines
  const buildLinePath = (valueKey: "emaFast" | "emaSlow" | "emaTrend") => {
    return candles
      .map((c, i) => `${i === 0 ? "M" : "L"} ${getX(i).toFixed(1)} ${getY(c[valueKey]).toFixed(1)}`)
      .join(" ");
  };

  return (
    <div className="flex flex-col gap-5">
      {/* Simulation Speed & Controls Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-zinc-900 border border-zinc-800 p-5 rounded-2xl">
        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={() => setIsPlaying(!isPlaying)}
            id="sim-toggle-btn"
            className={`flex items-center gap-2 px-5 py-2 rounded-lg font-bold transition text-xs uppercase tracking-wider ${
              isPlaying 
                ? "bg-amber-500 hover:bg-amber-600 text-zinc-950 shadow-md" 
                : "bg-emerald-500 hover:bg-emerald-600 text-zinc-950 shadow-md"
            }`}
          >
            {isPlaying ? (
              <>
                <Pause size={13} /> Pause Bot
              </>
            ) : (
              <>
                <Play size={13} /> Run Bot
              </>
            )}
          </button>

          <button
            onClick={initChartData}
            id="sim-reset-btn"
            className="flex items-center gap-1.5 bg-zinc-800 hover:bg-zinc-750 text-zinc-200 p-2.5 rounded-lg border border-zinc-700 transition"
            title="Reset Simulation feeds"
          >
            <RefreshCw size={13} />
          </button>

          <div className="h-4 w-px bg-zinc-800 hidden sm:block" />

          {/* Speed Selector */}
          <div className="flex items-center gap-1 bg-zinc-950 border border-zinc-800 rounded-lg p-1">
            <span className="text-[10px] text-zinc-500 font-mono px-2.5 uppercase font-bold tracking-wider">Tick Speed:</span>
            {[
              { label: "1x", value: 3000 },
              { label: "2x", value: 1500 },
              { label: "5x", value: 500 },
            ].map((speed) => (
              <button
                key={speed.label}
                onClick={() => setSimSpeed(speed.value)}
                className={`text-[10px] font-bold font-mono px-3 py-1 rounded transition uppercase ${
                  simSpeed === speed.value
                    ? "bg-zinc-800 text-zinc-100"
                    : "text-zinc-500 hover:text-zinc-300"
                }`}
              >
                {speed.label}
              </button>
            ))}
          </div>
        </div>

        {/* Spread information filter info */}
        <div className="flex items-center gap-4 text-xs text-zinc-450 ml-auto sm:ml-0 font-mono">
          <div className="flex items-center gap-1.5">
            <Clock size={12} className="text-zinc-550 animate-pulse" />
            <span className="text-zinc-500 uppercase tracking-wider text-[10px] font-bold">Gold UTC:</span>
            <span className="text-zinc-200 font-bold">{simulatedTime.toLocaleTimeString()}</span>
          </div>

          <div className={`flex items-center gap-1.5 p-1.5 px-3 rounded-lg ${
            spreadPips > params.maxSpreadPips 
              ? "bg-red-950/40 text-red-400 border border-red-900/40" 
              : "bg-zinc-950 text-zinc-300 border border-zinc-800"
          }`}>
            <span className="text-[10px] text-zinc-500 uppercase font-bold tracking-wider">Spread:</span>
            <span className="font-bold text-xs">{spreadPips} pips</span>
            {spreadPips > params.maxSpreadPips && (
              <span className="text-[9px] bg-red-900 text-red-100 px-1.5 py-0.2 rounded font-black uppercase">BLOCKED</span>
            )}
          </div>
        </div>
      </div>

      {/* Simulator State Machine Tracker Panel */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        {/* Core state card */}
        <div className="lg:col-span-3 bg-zinc-900 border border-zinc-800 p-5 rounded-2xl flex items-start gap-4 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/5 rounded-full blur-3xl pointer-events-none" />
          
          <div className="mt-1 shrink-0">
            {botState.currentStage === "IDLE" && (
              <span className="flex items-center justify-center w-9 h-9 rounded-lg bg-zinc-950 border border-zinc-800 text-zinc-400 font-bold">
                <Clock size={15} />
              </span>
            )}
            {botState.currentStage === "CONFIRMED" && (
              <span className="flex items-center justify-center w-9 h-9 rounded-lg bg-amber-955 border border-amber-900/60 text-amber-400 animate-pulse font-bold">
                <Zap size={15} />
              </span>
            )}
            {botState.currentStage === "PULLBACK" && (
              <span className="flex items-center justify-center w-9 h-9 rounded-lg bg-blue-955 border border-blue-900/50 text-blue-450 font-bold">
                <TrendingDown size={15} />
              </span>
            )}
            {botState.currentStage === "ACTIVE_TRADE" && (
              <span className="flex items-center justify-center w-9 h-9 rounded-lg bg-emerald-950 border border-emerald-900 text-emerald-400 font-bold">
                <TrendingUp size={15} />
              </span>
            )}
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1.5">
              <span className="text-[10px] font-mono font-black uppercase tracking-widest text-zinc-500">
                Analysis Engine
              </span>
              <span className={`text-[10px] font-mono px-2 py-0.5 rounded font-black tracking-wider ${
                botState.currentStage === "IDLE" ? "bg-zinc-950 text-zinc-450 border border-zinc-850" :
                botState.currentStage === "CONFIRMED" ? "bg-amber-500/10 text-amber-500 border border-amber-500/20" :
                botState.currentStage === "PULLBACK" ? "bg-blue-500/10 text-blue-400 border border-blue-500/20" :
                "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
              }`}>
                {botState.currentStage}
              </span>

              {isChoppyMode && (
                <span className="text-[9px] bg-red-950/80 text-red-400 border border-red-900/40 px-2 py-0.5 rounded font-bold flex items-center gap-1 uppercase">
                  <Filter size={9} /> Chop Avoidance On
                </span>
              )}
            </div>

            <p id="bot-status-notes" className="text-sm text-zinc-200 font-medium leading-relaxed font-sans">
              {botState.stageNotes}
            </p>

            {/* Visual Multi-step state timeline progress */}
            <div className="flex items-center gap-2.5 mt-5 text-[9px] font-mono text-zinc-500 max-w-lg font-bold uppercase tracking-wider">
              <div className={`flex-1 h-1 rounded ${botState.currentStage !== "IDLE" ? "bg-emerald-500" : "bg-zinc-800"}`} />
              <span>Cross</span>
              <div className={`flex-1 h-1 rounded ${["PULLBACK", "ACTIVE_TRADE"].includes(botState.currentStage) ? "bg-emerald-500" : "bg-zinc-800"}`} />
              <span>Pullback</span>
              <div className={`flex-1 h-1 rounded ${botState.currentStage === "ACTIVE_TRADE" ? "bg-emerald-500" : "bg-zinc-800"}`} />
              <span>Trade Trigger</span>
            </div>

            {/* 1st Confirmation Candle Box */}
            {botState.confirmationCandle && (
              <div className="mt-4 p-4 bg-zinc-950 border border-amber-500/20 rounded-xl flex flex-col md:flex-row md:items-center justify-between gap-4 font-mono">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                    <span className="text-[10px] text-amber-500 font-bold uppercase tracking-wider">
                      [1st CONFIRMATION DETAILS BOX]
                    </span>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-[11px] text-zinc-400">
                    <div>
                      <span className="text-zinc-650 block text-[9px] uppercase tracking-widest">Time / Date</span>
                      <span className="text-zinc-200 font-bold">
                        {(() => {
                          try {
                            const date = new Date(botState.confirmationCandle.time);
                            return isNaN(date.getTime()) 
                              ? botState.confirmationCandle.time 
                              : date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) + " " + date.toLocaleDateString([], { month: 'short', day: 'numeric' });
                          } catch (e) {
                            return botState.confirmationCandle.time;
                          }
                        })()}
                      </span>
                    </div>
                    <div>
                      <span className="text-zinc-650 block text-[9px] uppercase tracking-widest">Open Val</span>
                      <span className="text-zinc-300 font-bold">${botState.confirmationCandle.open.toFixed(2)}</span>
                    </div>
                    <div>
                      <span className="text-zinc-650 block text-[9px] uppercase tracking-widest">Close Val</span>
                      <span className="text-emerald-400 font-bold">${botState.confirmationCandle.close.toFixed(2)}</span>
                    </div>
                    <div>
                      <span className="text-zinc-650 block text-[9px] uppercase tracking-widest">High / Low Range</span>
                      <span className="text-zinc-350">
                        H: ${botState.confirmationCandle.high.toFixed(2)} / L: ${botState.confirmationCandle.low.toFixed(2)}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="bg-amber-500/5 border border-amber-500/10 rounded-lg px-3 py-2 text-right shrink-0">
                  <span className="text-zinc-550 block text-[8px] uppercase tracking-wider font-bold">Impulse Height</span>
                  <span className="text-amber-400 text-xs font-bold font-mono">
                    {(Math.abs(botState.confirmationCandle.close - botState.confirmationCandle.emaSlow) * 100).toFixed(0)} Pips
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Live Active Trade Snapshot info */}
        <div className="bg-zinc-900 border border-zinc-800 p-5 rounded-2xl flex flex-col justify-between relative overflow-hidden">
          {activeTrade ? (
            <>
              <div>
                <div className="flex justify-between items-center mb-1.5">
                  <span className={`text-[10px] uppercase font-bold font-mono px-2 py-0.5 rounded ${
                    activeTrade.type === "BUY" ? "bg-emerald-950 text-emerald-400 border border-emerald-900/30" : "bg-red-950 text-red-450 border border-red-900/30"
                  }`}>
                    ACTIVE {activeTrade.type}
                  </span>
                  <span className="text-[9px] font-mono text-zinc-500 font-bold">{activeTrade.entryTime}</span>
                </div>
                <div className="text-xl font-mono font-bold text-zinc-100">
                  {activeTrade.lots.toFixed(2)} Lots <span className="text-xs text-zinc-500 font-normal">XAUUSD</span>
                </div>
                <div className="text-[10.5px] text-zinc-450 font-mono mt-3.5 flex flex-col gap-1">
                  <div className="flex justify-between">
                    <span>Entry:</span> <span className="text-zinc-200 font-semibold">${activeTrade.entryPrice.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Stop Loss:</span> <span className="text-red-400 font-semibold">${activeTrade.sl.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Target 1:</span> <span className="text-zinc-300 font-semibold">${activeTrade.tp1.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between flex-wrap gap-2 text-[9px] text-zinc-500 bg-zinc-950/60 p-1.5 rounded border border-zinc-850 mt-1.5">
                    <span>A: {activeTrade.splitLots[0]} Lot (3x)</span>
                    <span>B: {activeTrade.splitLots[1]} Lot (4x)</span>
                  </div>
                </div>
              </div>
              <div className="border-t border-zinc-800 mt-3 pt-3 flex items-center justify-between">
                <span className="text-[10px] font-mono font-bold uppercase text-zinc-550">Dynamic Yield:</span>
                <span className={`text-xs font-mono font-bold ${
                  candles[candles.length - 1]?.close >= activeTrade.entryPrice
                    ? activeTrade.type === "BUY" ? "text-emerald-400" : "text-red-400"
                    : activeTrade.type === "BUY" ? "text-red-400" : "text-emerald-400"
                }`}>
                  {activeTrade.type === "BUY" 
                    ? `$${((candles[candles.length - 1]?.close - activeTrade.entryPrice) * 10 * activeTrade.lots).toFixed(2)}`
                    : `$${((activeTrade.entryPrice - candles[candles.length - 1]?.close) * 10 * activeTrade.lots).toFixed(2)}`}
                </span>
              </div>
            </>
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-center py-4">
              <ShieldAlert className="text-zinc-650 mb-1.5" size={24} />
              <span className="text-xs font-bold uppercase tracking-wider text-zinc-400 font-mono">IDLE SECURE</span>
              <p className="text-[10px] text-zinc-550 font-mono mt-1 px-1 leading-normal">
                Waiting for 15m crossovers to generate pullback bounces...
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Main Interactive Candlestick SVG Studio Chart */}
      <div 
        ref={containerRef} 
        id="interactive-trading-stage"
        className="w-full h-[400px] bg-zinc-950 border border-zinc-850 rounded-2xl relative select-none overflow-hidden shadow-2xl"
      >
        {/* Absolute indicators elements & background lines grid */}
        <div className="absolute top-4 left-4 flex gap-4 text-[10px] font-mono bg-zinc-900/80 p-2 rounded-lg border border-zinc-800 backdrop-blur pointer-events-none z-10">
          <div className="flex items-center gap-1.5 text-emerald-400">
            <span className="inline-block w-2.5 h-1 bg-emerald-400 rounded-sm" /> EMA {params.fastEma}
          </div>
          <div className="flex items-center gap-1.5 text-sky-400">
            <span className="inline-block w-2.5 h-1 bg-sky-450 rounded-sm" /> EMA {params.slowEma}
          </div>
          <div className="flex items-center gap-1.5 text-indigo-400">
            <span className="inline-block w-2.5 h-1 bg-indigo-500 rounded-sm" /> EMA {params.trendEma} (H1)
          </div>
        </div>

        {candles.length === 0 ? (
          <div className="flex h-full items-center justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-amber-500" />
          </div>
        ) : (
          <svg width={dimensions.width} height={dimensions.height} className="overflow-visible">
            {/* Grid Lines Horizontal */}
            {Array.from({ length: 6 }).map((_, i) => {
              const price = yMin + ((yMax - yMin) / 5) * i;
              const y = getY(price);
              return (
                <g key={`grid-${i}`}>
                  <line
                    x1={0}
                    y1={y}
                    x2={dimensions.width}
                    y2={y}
                    className="stroke-zinc-900/60 stroke-[1]"
                    strokeDasharray="4 4"
                  />
                  <text
                    x={dimensions.width - 55}
                    y={y - 4}
                    className="fill-zinc-500 font-mono text-[9px] text-right"
                  >
                    ${price.toFixed(2)}
                  </text>
                </g>
              );
            })}

            {/* EMA Indicators Curves */}
            <path
              d={buildLinePath("emaFast")}
              className="fill-none stroke-emerald-400 stroke-[1.5] transition-all duration-350"
            />
            <path
              d={buildLinePath("emaSlow")}
              className="fill-none stroke-sky-400 stroke-[2] transition-all duration-350"
            />
            <path
              d={buildLinePath("emaTrend")}
              className="fill-none stroke-indigo-500/80 stroke-[2] transition-all duration-350"
              strokeDasharray="2 1"
            />

            {/* Draw Candlesticks */}
            {candles.map((candle, index) => {
              const cx = getX(index);
              const cyOpen = getY(candle.open);
              const cyClose = getY(candle.close);
              const cyHigh = getY(candle.high);
              const cyLow = getY(candle.low);
              
              const isGreen = candle.close >= candle.open;
              const bodyHeight = Math.max(1.5, Math.abs(cyClose - cyOpen));
              const bodyWidth = Math.max(2, (dimensions.width / candles.length) * 0.55);

              return (
                <g key={`candle-${index}`} className="opacity-90 hover:opacity-100 transition cursor-pointer">
                  {/* Wick */}
                  <line
                    x1={cx}
                    y1={cyHigh}
                    x2={cx}
                    y2={cyLow}
                    className={`stroke-[1.3] ${isGreen ? "stroke-emerald-500/80" : "stroke-red-500/80"}`}
                  />
                  {/* Body */}
                  <rect
                    x={cx - bodyWidth / 2}
                    y={Math.min(cyOpen, cyClose)}
                    width={bodyWidth}
                    height={bodyHeight}
                    rx={1}
                    className={`stroke-[0.3] ${
                      isGreen 
                        ? "fill-emerald-500/30 stroke-emerald-400" 
                        : "fill-red-500/30 stroke-red-400"
                    }`}
                  />
                </g>
              );
            })}

            {/* active setup highlight point */}
            {botState.currentStage !== "IDLE" && botState.crossoverPrice > 0 && (
              <g className="animate-pulse">
                <circle
                  cx={getX(candles.length - 10) || dimensions.width / 2}
                  cy={getY(botState.crossoverPrice)}
                  r={12}
                  className="fill-amber-500/10 stroke-amber-500 stroke-[1]"
                  strokeDasharray="3 3"
                />
                <circle
                  cx={getX(candles.length - 10) || dimensions.width / 2}
                  cy={getY(botState.crossoverPrice)}
                  r={4}
                  className="fill-amber-400"
                />
              </g>
            )}

            {/* Draw Active Position Target Lines */}
            {activeTrade && (
              <g className="transition-all duration-300">
                {/* Entry Line */}
                <line
                  x1={0}
                  y1={getY(activeTrade.entryPrice)}
                  x2={dimensions.width}
                  y2={getY(activeTrade.entryPrice)}
                  className="stroke-amber-400 stroke-[1.5]"
                  strokeDasharray="6 3"
                />
                <text
                  x={10}
                  y={getY(activeTrade.entryPrice) - 5}
                  className="fill-amber-400 font-mono text-[9px] font-semibold"
                >
                  ENTRY: ${activeTrade.entryPrice.toFixed(2)}
                </text>

                {/* SL Line */}
                <line
                  x1={0}
                  y1={getY(activeTrade.sl)}
                  x2={dimensions.width}
                  y2={getY(activeTrade.sl)}
                  className="stroke-red-500 stroke-[1.5]"
                />
                <text
                  x={10}
                  y={getY(activeTrade.sl) - 5}
                  className="fill-red-400 font-mono text-[9px] font-bold"
                >
                  SL (Stop Loss): ${activeTrade.sl.toFixed(2)}
                </text>

                {/* TP1 Line */}
                <line
                  x1={0}
                  y1={getY(activeTrade.tp1)}
                  x2={dimensions.width}
                  y2={getY(activeTrade.tp1)}
                  className="stroke-cyan-400 stroke-[1]"
                  strokeDasharray="4 4"
                />
                <text
                  x={10}
                  y={getY(activeTrade.tp1) - 5}
                  className="fill-cyan-400 font-mono text-[9px] font-medium"
                >
                  TP1 (3x R:R): ${activeTrade.tp1.toFixed(2)} {activeTrade.status === "TP1_HIT" && "✅ HIT"}
                </text>

                {/* TP2 Line */}
                <line
                  x1={0}
                  y1={getY(activeTrade.tp2)}
                  x2={dimensions.width}
                  y2={getY(activeTrade.tp2)}
                  className="stroke-emerald-400 stroke-[1.2]"
                  strokeDasharray="5 5"
                />
                <text
                  x={10}
                  y={getY(activeTrade.tp2) - 5}
                  className="fill-emerald-400 font-mono text-[9px] font-bold"
                >
                  TP2 (4x R:R): ${activeTrade.tp2.toFixed(2)}
                </text>
              </g>
            )}
          </svg>
        )}
      </div>
    </div>
  );
}
