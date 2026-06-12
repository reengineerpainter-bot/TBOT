/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { StrategyParameters } from "../types";

export function generateMql5Code(params: StrategyParameters, webhookUrl: string): string {
  const safeWebhookUrl = webhookUrl || "https://your-workspace-url.com/api/webhook";
  
  // Clean values for pips to points conversion.
  // In both the simulator and MT5 code, 1 PIP = 0.01 USD of XAUUSD Price movement ($1.00 USD of Gold move = 100 PIPs).
  // Thus, 1000 pips = $10.00 USD, which is a standard expectation.
  // We use unified, broker-independent point calculations (points * 100) to ensure perfect agreement across all MT5 environments.
  
  return `//+------------------------------------------------------------------+
//|                                     XAUUSD_EMA_Splits_Bot.mq5     |
//|                        Copyright 2026, XAUUSD EMA Bot Workspace  |
//|                                             https://ai.studio    |
//+------------------------------------------------------------------+
#property copyright "XAUUSD EMA Bot Workspace"
#property link      "https://ai.studio"
#property version   "1.01"

// Include standard trade library
#include <Trade/Trade.mqh>
CTrade trade;

//+------------------------------------------------------------------+
//| Inputs Configuration                                             |
//+------------------------------------------------------------------+
input group "=== Strategy Parameters ==="
input int      InpFastEma            = ${params.fastEma};        // Fast EMA (${params.fastEma})
input int      InpSlowEma            = ${params.slowEma};       // Slow EMA (${params.slowEma})
input int      InpTrendEma           = ${params.trendEma};      // Trend EMA (${params.trendEma})
input ENUM_TIMEFRAMES InpTimeframe   = PERIOD_M15;    // Confirmation Timeframe (15 Min / 1 Hr)
input int      InpMinDistancePips    = ${params.minDistancePips};     // Min crossover impulse distance (Pips - e.g. 1500)
input int      InpMaxSpreadPips      = ${params.maxSpreadPips};       // Max permit spread (Pips - e.g. 50)
input int      InpMaxDailyTrades     = ${params.maxTradesPerDay};       // Max trades per day limit
input bool     InpFilterChoppyMarket = false;                           // Enable Choppy Flat Filter (Skip ranges)

input group "=== Trade Settings ==="
input double   InpTotalLotSize       = ${params.defaultLotSize};      // Total Lot Size (Will be split into 2 trades)
input double   InpTp1Ratio           = ${params.tp1Ratio};       // TP1 Risk multiplier (e.g. 3x)
input double   InpTp2Ratio           = ${params.tp2Ratio};       // TP2 Risk multiplier (e.g. 4x)
input int      InpSwingLookbackBars  = 15;            // Recent swing detection lookback (15m candles)

input group "=== Alerts & Webhooks ==="
input bool     InpSendWebhooks       = true;          // Enable HTTP webhooks
input string   InpWebhookUrl         = "${safeWebhookUrl}"; // Server webhook API URL
input string   InpWebhookSecret      = "XAUUSD_METABOT_SECURE_TOKEN_2026"; // Webhook Secret Authorization Key (X-API-KEY)

//+------------------------------------------------------------------+
//| Global Variables & State Control                                 |
//+------------------------------------------------------------------+
// State Machine definition
enum ENUM_BOT_STATE
{
   STATE_IDLE,          // Waiting for crossover confirmation
   STATE_CONFIRMED,     // Crossover occurred with valid distance. Waiting for pullback.
   STATE_PULLBACK,      // Price pulled back. Waiting for continuation on trigger candle.
   STATE_ACTIVE_TRADE   // Currently holding split trades
};

ENUM_BOT_STATE gBotState = STATE_IDLE;
string         gStateString = "STATE_IDLE";

// Indicators handles
int gFastEmaHandle;
int gSlowEmaHandle;
int gTrendEmaHandle;

// Trade limits tracking
datetime gLastTradeDay = 0;
int      gDailyTradeCount = 0;

// Signals and trade monitoring
datetime gLastCalculatedBarTime;
double   gCrossoverPrice = 0;
int      gSetupDirection = 0; // 1 = Bullish setup, -1 = Bearish setup
bool     gImpulseValidated = false; // Whether the required impulse distance was met
ulong    gTicket1 = 0;
ulong    gTicket2 = 0;
bool     gIsBreakevenSet = false;
double   gPositionEntryPrice = 0;
double   gPositionSlPrice = 0;

// Golden Crossover Confirmation Candle Tracking variables "the box"
datetime gConfCandleTime = 0;
double   gConfCandleOpen = 0.0;
double   gConfCandleClose = 0.0;
double   gConfCandleHigh = 0.0;
double   gConfCandleLow = 0.0;
double   gConfImpulsePips = 0.0;

//+------------------------------------------------------------------+
//| Robust Price and Indicator Handlers (Native MQL5 standard copy)  |
//+------------------------------------------------------------------+
double GetEMAValue(int handle, int barIndex)
{
   double valueBuffer[];
   if(CopyBuffer(handle, 0, barIndex, 1, valueBuffer) > 0)
   {
      return valueBuffer[0];
   }
   return 0.0;
}

double GetCloseValue(int barIndex)
{
   double closePrices[];
   if(CopyClose(_Symbol, InpTimeframe, barIndex, 1, closePrices) > 0)
   {
      return closePrices[0];
   }
   return 0.0;
}

double GetOpenValue(int barIndex)
{
   double openPrices[];
   if(CopyOpen(_Symbol, InpTimeframe, barIndex, 1, openPrices) > 0)
   {
      return openPrices[0];
   }
   return 0.0;
}

double GetLowValue(int barIndex)
{
   double lowPrices[];
   if(CopyLow(_Symbol, InpTimeframe, barIndex, 1, lowPrices) > 0)
   {
      return lowPrices[0];
   }
   return 0.0;
}

double GetHighValue(int barIndex)
{
   double highPrices[];
   if(CopyHigh(_Symbol, InpTimeframe, barIndex, 1, highPrices) > 0)
   {
      return highPrices[0];
   }
   return 0.0;
}

datetime GetTimeValue(int barIndex)
{
   datetime timeValues[];
   if(CopyTime(_Symbol, InpTimeframe, barIndex, 1, timeValues) > 0)
   {
      return timeValues[0];
   }
   return 0;
}

//+------------------------------------------------------------------+
//| Expert initialization function                                   |
//+------------------------------------------------------------------+
int OnInit()
{
   Print("Initializing MT5 XAUUSD EMA Splits Bot...");
   Print("Target Setup: Fast EMA (", InpFastEma, ") / Slow EMA (", InpSlowEma, ") Crossover");

   // Initialize Indicator Handles for the selected timeframe
   gFastEmaHandle = iMA(_Symbol, InpTimeframe, InpFastEma, 0, MODE_EMA, PRICE_CLOSE);
   gSlowEmaHandle = iMA(_Symbol, InpTimeframe, InpSlowEma, 0, MODE_EMA, PRICE_CLOSE);
   gTrendEmaHandle = iMA(_Symbol, PERIOD_H1, InpTrendEma, 0, MODE_EMA, PRICE_CLOSE);
   
   if(gFastEmaHandle == INVALID_HANDLE || gSlowEmaHandle == INVALID_HANDLE || gTrendEmaHandle == INVALID_HANDLE)
   {
      Print("Error creating indicator handles. Bot init failed.");
      return(INIT_FAILED);
   }

   // Initialize trade settings
   trade.SetExpertMagicNumber(998811);

   gBotState = STATE_IDLE;
   gStateString = "STATE_IDLE";
   gDailyTradeCount = 0;
   
   datetime timeZero[];
   CopyTime(_Symbol, PERIOD_D1, 0, 1, timeZero);
   if(ArraySize(timeZero) > 0) gLastTradeDay = timeZero[0];

   SendWebhook("info", "MT5 XAUUSD Bot initialized successfully on account " + IntegerToString(AccountInfoInteger(ACCOUNT_LOGIN)));

   return(INIT_SUCCEEDED);
}

//+------------------------------------------------------------------+
//| Expert deinitialization function                                 |
//+------------------------------------------------------------------+
void OnDeinit(const int reason)
{
   IndicatorRelease(gFastEmaHandle);
   IndicatorRelease(gSlowEmaHandle);
   IndicatorRelease(gTrendEmaHandle);
   Comment(""); // Clear chart comment box metadata
   Print("Bot deinitialized. Reason code: ", reason);
}

//+------------------------------------------------------------------+
//| Expert tick function                                             |
//+------------------------------------------------------------------+
void OnTick()
{
   // 1. Reset trade counter on new day
   datetime dailyTime[];
   if(CopyTime(_Symbol, PERIOD_D1, 0, 1, dailyTime) > 0)
   {
      if(dailyTime[0] != gLastTradeDay)
      {
         gDailyTradeCount = 0;
         gLastTradeDay = dailyTime[0];
         Print("New day detected. Resetting daily trade counter.");
      }
   }

   // Compute Spread details
   double spreadPoints = (double)SymbolInfoInteger(_Symbol, SYMBOL_SPREAD);
   double pointSize = SymbolInfoDouble(_Symbol, SYMBOL_POINT);
   double spreadPips = (spreadPoints * pointSize) * 100.0;

   // Render the dynamic on-chart dashboard box
   UpdateChartDashboard(spreadPips);

   // 2. Check and handle Active Trades State
   if(gBotState == STATE_ACTIVE_TRADE)
   {
      MonitorActiveTrades();
      return;
   }

   // 3. Implement actual state checks on candle close
   datetime currentBarTime = GetTimeValue(0);
   if(currentBarTime == 0) return; // Wait until connection coordinates are warmed up
   
   if(currentBarTime == gLastCalculatedBarTime)
   {
      // Wait for candle close to avoid entering on temporary spikes or fake-outs
      return;
   }
   gLastCalculatedBarTime = currentBarTime;

   // Check Choppy Flat Market Avoidance Check (Only if enabled and scanning for a pullback)
   if(InpFilterChoppyMarket && gBotState != STATE_IDLE && IsMarketChoppy())
   {
      Print("[Filter] Market detected as chopper. Returning to IDLE safety scanner.");
      SetBotState(STATE_IDLE);
      return;
   }

   // State Machine Logic
   switch(gBotState)
   {
      case STATE_IDLE:
         CheckCrossoverConfirmation();
         break;

      case STATE_CONFIRMED:
         CheckPullbackConfirmation();
         break;

      case STATE_PULLBACK:
         CheckContinuationAndTrigger(spreadPips);
         break;
         
      default:
         break;
   }
}

//+------------------------------------------------------------------+
//| 1. Check Crossover and Distance Criteria                       |
//+------------------------------------------------------------------+
void CheckCrossoverConfirmation()
{
   double fast1 = GetEMAValue(gFastEmaHandle, 1);
   double slow1 = GetEMAValue(gSlowEmaHandle, 1);
   double fast2 = GetEMAValue(gFastEmaHandle, 2);
   double slow2 = GetEMAValue(gSlowEmaHandle, 2);

   bool bullishCross = (fast1 > slow1 && fast2 <= slow2);
   bool bearishCross = (fast1 < slow1 && fast2 >= slow2);

   if(!bullishCross && !bearishCross) return;

   // Get prices
   double closePrice = GetCloseValue(1);
   gCrossoverPrice = slow1;
   gSetupDirection = bullishCross ? 1 : -1;
   gImpulseValidated = false;
   SetBotState(STATE_CONFIRMED);
   
   string textDir = bullishCross ? "BULLISH" : "BEARISH";
   string msg = "9/50 EMA Crossover Formed: " + textDir + " " + IntegerToString(InpFastEma) + "/" + IntegerToString(InpSlowEma) + 
                ". Candle closed at $" + DoubleToString(closePrice, 2) + 
                ". Initializing threshold checks on subsequent candles.";
   
   Print(msg);
   SendWebhook("info", msg);
   
   // Run immediately to process the crossover closed bar on its initial state block
   CheckPullbackConfirmation();
}

//+------------------------------------------------------------------+
//| 2. Check Pullback Phase (touches crossover key level or EMA50)  |
//+------------------------------------------------------------------+
void CheckPullbackConfirmation()
{
   // 1. Get closed candle price to check invalidation and impulse validation
   double closePrice = GetCloseValue(1);
   double current50Ema = GetEMAValue(gSlowEmaHandle, 1);
   
   // Check invalidation: setup is ONLY invalidated if a candle closed back below the slow EMA (buy scenario)
   if(gSetupDirection == 1 && closePrice < current50Ema)
   {
      Print("[Invalidation] Candle closed below Slow EMA ($" + DoubleToString(closePrice, 2) + " < $" + DoubleToString(current50Ema, 2) + "). Reverting to IDLE.");
      SetBotState(STATE_IDLE);
      return;
   }
   else if(gSetupDirection == -1 && closePrice > current50Ema)
   {
      Print("[Invalidation] Candle closed above Slow EMA ($" + DoubleToString(closePrice, 2) + " > $" + DoubleToString(current50Ema, 2) + "). Reverting to IDLE.");
      SetBotState(STATE_IDLE);
      return;
   }

   // 2. Check Impulse Build
   if(!gImpulseValidated)
   {
      double distancePoints = MathAbs(closePrice - current50Ema);
      // Convert raw price distance in USD to unified pips (where 1 pip = 0.01 USD, matching the web simulator)
      double distancePips = distancePoints * 100.0;

      Print("Confirming Step: Dist=" + DoubleToString(distancePips, 1) + " pips. Req=" + IntegerToString(InpMinDistancePips));

      if(distancePips >= InpMinDistancePips)
      {
         gImpulseValidated = true;
         
         // Securely lock first confirmation candle attributes for graphic dashboard box
         gConfCandleTime = GetTimeValue(1);
         gConfCandleOpen = GetOpenValue(1);
         gConfCandleClose = GetCloseValue(1);
         gConfCandleHigh = GetHighValue(1);
         gConfCandleLow = GetLowValue(1);
         gConfImpulsePips = distancePips;

         string textDir = gSetupDirection == 1 ? "BULLISH" : "BEARISH";
         string msg = "FIRST CONFIRMATION VALIDATED: " + textDir + " " + IntegerToString(InpFastEma) + "/" + IntegerToString(InpSlowEma) + 
                      " EMA impulse validated. Candle closed at $" + DoubleToString(closePrice, 2) + 
                      " with required distance of " + DoubleToString(distancePips, 1) + " pips (>= " + IntegerToString(InpMinDistancePips) + "). Waiting for pullback.";
         Print(msg);
         SendWebhook("confirmation", msg);
      }
      else
      {
         Print("Impulse distance not yet reached. Waiting on subsequent closed candles. Dist=" + DoubleToString(distancePips, 1) + " pips.");
         return; // Stay in CONFIRMED stage, checking next closes, but don't check pullback yet
      }
   }

   // 3. Check Pullback Phase (touches crossover key level or EMA50) - check completed bar 1
   double lowVal = GetLowValue(1);
   double highVal = GetHighValue(1);

   bool isPullback = false;
   if(gSetupDirection == 1) // Bullish Setup: expecting pullback downward
   {
      // Pullback succeeds if low candle touches or dips below either 50EMA or Crossover Price Level
      if(lowVal <= current50Ema || lowVal <= gCrossoverPrice)
      {
         isPullback = true;
      }
   }
   else if(gSetupDirection == -1) // Bearish Setup: expecting pullback upward
   {
      // Pullback succeeds if high candle touches or exceeds either 50EMA or Crossover Price Level
      if(highVal >= current50Ema || highVal >= gCrossoverPrice)
      {
         isPullback = true;
      }
   }

   // Also support EMA 50 crossing the Trend EMA as a pullback trigger
   double curSlow = GetEMAValue(gSlowEmaHandle, 0);
   double curTrend = GetEMAValue(gTrendEmaHandle, 0);
   if (curSlow > curTrend && gSetupDirection == 1) isPullback = true;
   if (curSlow < curTrend && gSetupDirection == -1) isPullback = true;

   if(isPullback)
   {
      SetBotState(STATE_PULLBACK);
      string msg = "Price pulled back and balanced successfully off structural lines. Slow EMA: " + 
                   DoubleToString(current50Ema, 2) + ". Waiting for continuation close candle.";
      Print(msg);
   }
}

//+------------------------------------------------------------------+
//| 3. Check Continuation Sign and Execution                        |
//+------------------------------------------------------------------+
void CheckContinuationAndTrigger(double spreadPips)
{
   // Check invalidation first: setup is ONLY invalidated if a candle closed back below/above the slow EMA
   double closePrice = GetCloseValue(1);
   double current50Ema = GetEMAValue(gSlowEmaHandle, 1);
   
   if(gSetupDirection == 1 && closePrice < current50Ema)
   {
      Print("[Invalidation in Pullback Stage] Candle closed below slow EMA line ($" + DoubleToString(closePrice, 2) + " < $" + DoubleToString(current50Ema, 2) + "). Reverting to IDLE.");
      SetBotState(STATE_IDLE);
      return;
   }
   else if(gSetupDirection == -1 && closePrice > current50Ema)
   {
      Print("[Invalidation in Pullback Stage] Candle closed above slow EMA line ($" + DoubleToString(closePrice, 2) + " > $" + DoubleToString(current50Ema, 2) + "). Reverting to IDLE.");
      SetBotState(STATE_IDLE);
      return;
   }

   // Read closed candle values to check if it's a solid continuation bar
   double openVal = GetOpenValue(1);
   double closeVal = GetCloseValue(1);

   bool hasContinuation = false;
   if(gSetupDirection == 1) // Buy direction
   {
      if(closeVal > openVal) // Closed green
      {
         hasContinuation = true;
      }
   }
   else if(gSetupDirection == -1) // Sell direction
   {
      if(closeVal < openVal) // Closed red
      {
         hasContinuation = true;
      }
   }

   if(!hasContinuation) return;

   // Check spread guard limits
   if(spreadPips > InpMaxSpreadPips)
   {
      Print("[Filter] Entry blocked due to spread spike: " + DoubleToString(spreadPips, 1) + " pips (Max: " + IntegerToString(InpMaxSpreadPips) + ")");
      return;
   }

   // Check Daily Trade limits
   if(gDailyTradeCount >= InpMaxDailyTrades)
   {
      Print("[Filter] Maximum " + IntegerToString(InpMaxDailyTrades) + " trades per day reached. Resetting scanner to IDLE.");
      SetBotState(STATE_IDLE);
      return;
   }

   // Retrieve actual symbol Tick to prevent empty/zero spreads execution
   double ask = SymbolInfoDouble(_Symbol, SYMBOL_ASK);
   double bid = SymbolInfoDouble(_Symbol, SYMBOL_BID);
   if(ask <= 0 || bid <= 0)
   {
      MqlTick tick;
      if(SymbolInfoTick(_Symbol, tick))
      {
         ask = tick.ask;
         bid = tick.bid;
      }
   }

   double recentSwingValue;
   if(gSetupDirection == 1) // BUY
   {
      recentSwingValue = GetRecentSwingLow();
      double riskPoints = ask - recentSwingValue;
      if (riskPoints <= 0) {
         recentSwingValue = ask - (3000 * SymbolInfoDouble(_Symbol, SYMBOL_POINT)); // backup SL (30 USD of Gold)
         riskPoints = ask - recentSwingValue;
      }

      double tp1 = ask + (riskPoints * InpTp1Ratio);
      double tp2 = ask + (riskPoints * InpTp2Ratio);
      double splitLot = NormalizeDouble(InpTotalLotSize / 2.0, 2);

      if(splitLot < 0.01) splitLot = 0.01;

      Print("Executing BUY Splits... Lots=" + DoubleToString(splitLot, 2) + " each. SL=" + DoubleToString(recentSwingValue, 2));

      // Open Trade 1
      if(trade.Buy(splitLot, _Symbol, ask, recentSwingValue, tp1, "EMA Bot Split A"))
      {
         gTicket1 = trade.ResultDeal();
         if(gTicket1 == 0) gTicket1 = trade.ResultOrder();
      }
      // Open Trade 2
      if(trade.Buy(splitLot, _Symbol, ask, recentSwingValue, tp2, "EMA Bot Split B"))
      {
         gTicket2 = trade.ResultDeal();
         if(gTicket2 == 0) gTicket2 = trade.ResultOrder();
      }
      
      if(gTicket1 > 0 || gTicket2 > 0)
      {
         gPositionEntryPrice = ask;
         gPositionSlPrice = recentSwingValue;
         gIsBreakevenSet = false;
         gDailyTradeCount++;
         SetBotState(STATE_ACTIVE_TRADE);

         string msg = "ACTUAL ENTRY FILLED: Opened BUY split-lot orders for Total Lot Size " + DoubleToString(InpTotalLotSize, 2) +
                      " closely near " + DoubleToString(ask, 2) + ". SL set below swing at " + DoubleToString(recentSwingValue, 2) + 
                      ", TP1 (3x) at " + DoubleToString(tp1, 2) + ", TP2 (4.5x) at " + DoubleToString(tp2, 2) + ".";
         Print(msg);
         SendWebhook("entry", msg);
      }
   }
   else if(gSetupDirection == -1) // SELL
   {
      recentSwingValue = GetRecentSwingHigh();
      double riskPoints = recentSwingValue - bid;
      if (riskPoints <= 0) {
         recentSwingValue = bid + (3000 * SymbolInfoDouble(_Symbol, SYMBOL_POINT)); // backup SL
         riskPoints = recentSwingValue - bid;
      }

      double tp1 = bid - (riskPoints * InpTp1Ratio);
      double tp2 = bid - (riskPoints * InpTp2Ratio);
      double splitLot = NormalizeDouble(InpTotalLotSize / 2.0, 2);

      if(splitLot < 0.01) splitLot = 0.01;

      Print("Executing SELL Splits... Lots=" + DoubleToString(splitLot, 2) + " each. SL=" + DoubleToString(recentSwingValue, 2));

      // Open Trade 1
      if(trade.Sell(splitLot, _Symbol, bid, recentSwingValue, tp1, "EMA Bot Split A"))
      {
         gTicket1 = trade.ResultDeal();
         if(gTicket1 == 0) gTicket1 = trade.ResultOrder();
      }
      // Open Trade 2
      if(trade.Sell(splitLot, _Symbol, bid, recentSwingValue, tp2, "EMA Bot Split B"))
      {
         gTicket2 = trade.ResultDeal();
         if(gTicket2 == 0) gTicket2 = trade.ResultOrder();
      }

      if(gTicket1 > 0 || gTicket2 > 0)
      {
         gPositionEntryPrice = bid;
         gPositionSlPrice = recentSwingValue;
         gIsBreakevenSet = false;
         gDailyTradeCount++;
         SetBotState(STATE_ACTIVE_TRADE);

         string msg = "ACTUAL ENTRY FILLED: Opened SELL split-lot orders for Total Lot Size " + DoubleToString(InpTotalLotSize, 2) +
                      " closely near " + DoubleToString(bid, 2) + ". SL set above swing at " + DoubleToString(recentSwingValue, 2) + 
                      ", TP1 (3x) at " + DoubleToString(tp1, 2) + ", TP2 (4.5x) at " + DoubleToString(tp2, 2) + ".";
         Print(msg);
         SendWebhook("entry", msg);
      }
   }
}

//+------------------------------------------------------------------+
//| Monitor Active Positions and move Stop Loss to Breakeven          |
//+------------------------------------------------------------------+
void MonitorActiveTrades()
{
   int positionsFound = 0;
   bool position1Open = false;
   bool position2Open = false;
   
   for(int i = PositionsTotal() - 1; i >= 0; i--)
   {
      ulong ticket = PositionGetTicket(i);
      if(PositionGetString(POSITION_SYMBOL) == _Symbol)
      {
         if(ticket == gTicket1) { position1Open = true; positionsFound++; }
         if(ticket == gTicket2) { position2Open = true; positionsFound++; }
      }
   }

   // 1. If Position 1 is closed but Position 2 remains open, move Position 2 to Breakeven!
   if(!position1Open && position2Open && !gIsBreakevenSet)
   {
      // Move Position 2 SL to entry price
      if(PositionSelectByTicket(gTicket2))
      {
         double tp = PositionGetDouble(POSITION_TP);
         if(trade.PositionModify(gTicket2, gPositionEntryPrice, tp))
         {
            gIsBreakevenSet = true;
            string msg = "ALERT: TP1 Hit and closed successfully! Moved second split lot trade SL to breakeven at $" + 
                         DoubleToString(gPositionEntryPrice, 2);
            Print(msg);
            SendWebhook("breakeven", msg);
         }
      }
   }

   // 2. If both positions have closed, return state machine to IDLE
   if(positionsFound == 0)
   {
      Print("All active setup positions closed. Returning to IDLE search state.");
      gTicket1 = 0;
      gTicket2 = 0;
      SetBotState(STATE_IDLE);
   }
}

//+------------------------------------------------------------------+
//| Dynamic, pure native MQL5 Swing calculation loops               |
//+------------------------------------------------------------------+
double GetRecentSwingLow()
{
   double lowPrices[];
   ArraySetAsSeries(lowPrices, true);
   int copied = CopyLow(_Symbol, InpTimeframe, 1, InpSwingLookbackBars, lowPrices);
   if(copied <= 0) return SymbolInfoDouble(_Symbol, SYMBOL_BID) - (300 * SymbolInfoDouble(_Symbol, SYMBOL_POINT));
   
   double lowest = lowPrices[0];
   for(int i = 1; i < copied; i++)
   {
      if(lowPrices[i] < lowest) lowest = lowPrices[i];
   }
   return lowest;
}

double GetRecentSwingHigh()
{
   double highPrices[];
   ArraySetAsSeries(highPrices, true);
   int copied = CopyHigh(_Symbol, InpTimeframe, 1, InpSwingLookbackBars, highPrices);
   if(copied <= 0) return SymbolInfoDouble(_Symbol, SYMBOL_ASK) + (300 * SymbolInfoDouble(_Symbol, SYMBOL_POINT));
   
   double highest = highPrices[0];
   for(int i = 1; i < copied; i++)
   {
      if(highPrices[i] > highest) highest = highPrices[i];
   }
   return highest;
}

//+------------------------------------------------------------------+
//| Choppy/Ranging check filters                                     |
//+------------------------------------------------------------------+
bool IsMarketChoppy()
{
   double fast1 = GetEMAValue(gFastEmaHandle, 1);
   double slow1 = GetEMAValue(gSlowEmaHandle, 1);
   double fast2 = GetEMAValue(gFastEmaHandle, 2);
   double slow2 = GetEMAValue(gSlowEmaHandle, 2);

   double diffPips = MathAbs(fast1 - slow1) * 100.0;
   double diffPipsPrev = MathAbs(fast2 - slow2) * 100.0;

   if(diffPips < 50.0 && diffPipsPrev < 50.0)
   {
      // The EMAs are flatlining/interlocking
      return true;
   }
   return false;
}

//+------------------------------------------------------------------+
//| State Controller & Values Reset                                  |
//+------------------------------------------------------------------+
void SetBotState(ENUM_BOT_STATE newState)
{
   gBotState = newState;
   if(newState == STATE_IDLE)
   {
      gSetupDirection = 0;
      gImpulseValidated = false;
      gConfCandleTime = 0;
      gConfCandleOpen = 0.0;
      gConfCandleClose = 0.0;
      gConfCandleHigh = 0.0;
      gConfCandleLow = 0.0;
      gConfImpulsePips = 0.0;
   }
   switch(gBotState)
   {
      case STATE_IDLE:          gStateString = "STATE_IDLE"; break;
      case STATE_CONFIRMED:     gStateString = "STATE_CONFIRMED"; break;
      case STATE_PULLBACK:      gStateString = "STATE_PULLBACK"; break;
      case STATE_ACTIVE_TRADE:  gStateString = "STATE_ACTIVE_TRADE"; break;
   }
   Print("Bot shifted state to => ", gStateString);
}

//+------------------------------------------------------------------+
//| Draw graphical console HUD box on chart for Confirmation Details|
//+------------------------------------------------------------------+
void UpdateChartDashboard(double spreadPips)
{
   string text = "";
   text += "========================================================\\n";
   text += "         XAUUSD EMA SPLITS BOT - SYSTEM STATUS STATUS   \\n";
   text += "========================================================\\n";
   text += "  * Engine Active Stage : " + gStateString + "\\n";
   text += "  * Target Timeframe    : " + EnumToString(InpTimeframe) + "\\n";
   text += "  * Live Account Login  : " + IntegerToString(AccountInfoInteger(ACCOUNT_LOGIN)) + "\\n";
   text += "  * Live Market Spread  : " + DoubleToString(spreadPips, 1) + " pips (Max: " + IntegerToString(InpMaxSpreadPips) + ")\\n";
   text += "  * Max Trades Per Day  : " + IntegerToString(InpMaxDailyTrades) + "\\n";
   text += "  * Completed Trades    : " + IntegerToString(gDailyTradeCount) + " trades today\\n";
   text += "--------------------------------------------------------\\n";
   text += "  * Crossover Key Price : $" + DoubleToString(gCrossoverPrice, 2) + "\\n";
   text += "  * Projected Direction : " + (gSetupDirection == 1 ? "BULLISH (BUY)" : (gSetupDirection == -1 ? "BEARISH (SELL)" : "NONE (SCANNING)")) + "\\n";
   text += "  * Impulse Validated   : " + (gImpulseValidated ? "YES (GOAL REACHED)" : "NO") + "\\n";
   text += "========================================================\\n";
   text += "  [1st CONFIRMATION DETAILS BOX]                         \\n";
   if(gImpulseValidated && gConfCandleTime != 0)
   {
      text += "   * Confirmation Time  : " + TimeToString(gConfCandleTime, TIME_DATE|TIME_MINUTES) + "\\n";
      text += "   * Closed Candle O / C: Open: $" + DoubleToString(gConfCandleOpen, 2) + " | Close: $" + DoubleToString(gConfCandleClose, 2) + "\\n";
      text += "   * High / Low Range   : High: $" + DoubleToString(gConfCandleHigh, 2) + " | Low: $" + DoubleToString(gConfCandleLow, 2) + "\\n";
      text += "   * Verified Impulse   : " + DoubleToString(gConfImpulsePips, 1) + " pips (Threshold: " + IntegerToString(InpMinDistancePips) + ")\\n";
      text += "   * Status             : VALIDATED SUCCESSFUL\\n";
   }
   else
   {
      text += "   * Awaiting validation of " + IntegerToString(InpMinDistancePips) + " pip impulse close...\\n";
   }
   text += "========================================================\\n";
   if(gBotState == STATE_ACTIVE_TRADE)
   {
      text += "  [ACTIVE TRADING METRICS]                               \\n";
      text += "   * Entry Trade Price  : $" + DoubleToString(gPositionEntryPrice, 2) + "\\n";
      text += "   * Current Stop Loss  : $" + DoubleToString(gPositionSlPrice, 2) + "\\n";
      text += "   * Ticket A / Ticket B: " + IntegerToString((long)gTicket1) + " / " + IntegerToString((long)gTicket2) + "\\n";
      text += "   * Breakeven Triggered: " + (gIsBreakevenSet ? "YES (LOCKED AT ENTRY)" : "NO (Awaiting TP1 Close)") + "\\n";
   }
   text += "========================================================\\n";
   
   Comment(text);
}

//+------------------------------------------------------------------+
//| Send HTTP POST Webhook notifications                            |
//+------------------------------------------------------------------+
void SendWebhook(string type, string msg)
{
   if(!InpSendWebhooks || InpWebhookUrl == "" || InpWebhookUrl == "https://your-workspace-url.com/api/webhook") return;

   // Prepare JSON body payload
   string headers = "Content-Type: application/json\\r\\n";
   if(InpWebhookSecret != "")
   {
      headers += "X-API-KEY: " + InpWebhookSecret + "\\r\\n";
   }
   double currentPrice = SymbolInfoDouble(_Symbol, SYMBOL_BID);
   double currentSpread = (double)SymbolInfoInteger(_Symbol, SYMBOL_SPREAD);
   
   string jsonPayload = "{\\"type\\":\\""+type+"\\",";
   jsonPayload += "\\"message\\":\\""+msg+"\\",";
   jsonPayload += "\\"price\\":"+DoubleToString(currentPrice, 2)+",";
   jsonPayload += "\\"direction\\":\\""+(gSetupDirection == 1 ? "BUY" : "SELL")+"\\",";
   jsonPayload += "\\"sl\\":"+DoubleToString(gPositionSlPrice, 2)+",";
   jsonPayload += "\\"spread\\":"+DoubleToString(currentSpread, 1);
   jsonPayload += "}";

   char postData[];
   StringToCharArray(jsonPayload, postData);
   
   char result[];
   string resultHeaders;
   
   // Call WebRequest Web api
   int res = WebRequest("POST", InpWebhookUrl, headers, 3000, postData, result, resultHeaders);
   if(res == -1)
   {
      Print("Error sending HTTP webhooks notification. Error Code: ", GetLastError());
   }
   else
   {
      Print("Webhook notification sent successfully: Web response: ", res);
   }
}
//+------------------------------------------------------------------+
`;
}
