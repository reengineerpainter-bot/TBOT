/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface StrategyParameters {
  fastEma: number;      // 9 EMA
  slowEma: number;      // 50 EMA
  trendEma: number;     // 200 EMA
  timeframe: "15m" | "1h";
  minDistancePips: number; // in pips (e.g. 1000 pips = $10 on gold, 2000 pips = $20 on gold)
  maxSpreadPips: number;   // 50 pips (500 points)
  maxTradesPerDay: number; // 5 trades
  tp1Ratio: number;        // 3x risk
  tp2Ratio: number;        // 4x risk (replaces partially taking profit, split lot)
  riskDollars: number;     // calculated risk per trade (e.g. $500, or auto calculated using lots)
  defaultLotSize: number;  // 0.1 lots (split into 2 operations of 0.05 each)
}

export interface Candle {
  time: string;
  open: number;
  high: number;
  low: number;
  close: number;
  emaFast: number;
  emaSlow: number;
  emaTrend: number;
  volume: number;
}

export interface ActiveTrade {
  id: string;
  type: "BUY" | "SELL";
  entryPrice: number;
  entryTime: string;
  sl: number;
  tp1: number;
  tp2: number;
  initialSl: number;
  lots: number;          // Total lot size
  splitLots: number[];   // array of lots [lot1, lot2]
  status: "OPEN" | "TP1_HIT" | "CLOSED";
  pnl: number;
  tradesClosed: number;  // 1 or 2 closed
  reason?: string;
  comments: string;
}

export interface HistoricalTrade {
  id: string;
  type: "BUY" | "SELL";
  entryPrice: number;
  exitPrice: number;
  entryTime: string;
  exitTime: string;
  lots: number;
  pnl: number;
  result: "WIN" | "LOSS" | "BREAKEVEN";
  reason: string;
}

export interface WebhookLog {
  id: string;
  type: "confirmation" | "entry" | "tp" | "sl" | "breakeven" | "error" | "info";
  message: string;
  time: string;
  price: number;
  direction?: "BUY" | "SELL";
  lots?: number[];
  sl?: number;
  tp1?: number;
  tp2?: number;
  spread?: number;
}

export interface BotState {
  currentStage: "IDLE" | "CONFIRMED" | "PULLBACK" | "ACTIVE_TRADE" | "COOLDOWN_RANGE";
  stageNotes: string;
  crossoverPrice: number;
  impulseValidated?: boolean;
  lastConfirmationTime?: string;
  pullbackReachedAt?: string;
  tradesPlacedToday: number;
  todayProfit: number;
  dailyWinRate: number;
  confirmationCandle?: Candle | null; // Box to show first confirmation candle details
}
