export const PRD_TEXT = `# Product Requirements Document (PRD)
## XAUUSD Split-Lot EMA Crossover Expert Advisor & Workspace

### Document Information
- **Title:** Product Requirements Document (PRD) for XAUUSD MetaBot Workspace
- **Category:** Algorithmic Trading Systems
- **Target Platform:** MetaTrader 5 (MT5) & React/Express Workspace Sandbox
- **Core Assets:** XAUUSD (Gold / US Dollar Spot)
- **Author:** AI Trading Systems Development Group
- **Status:** Approved / Production-Ready
- **Version:** v2.1.2
- **Date:** June 1, 2026

---

## 1. Executive Summary & Purpose

The **XAUUSD MetaBot Workspace** is a high-performance, full-stack algorithmic trading solution designed for the specific and volatile market dynamics of spot Gold (**XAUUSD**). 

The primary business objective is to eliminate emotional trading errors and reduce structural drawdown by automating a rigorous **Trend Crossover, Impulse Validation, Pullback Bouncing, and Split-Lot Position Management** system.

This project delivers:
1. An **Interactive Sandbox Simulator** displaying real-time responsive charts matching live Gold pricing models (at current ~4490.00).
2. A **Dual-Stage MetaTrader 5 Expert Advisor (EA)** generator producing a commented, compile-ready MQL5 script.
3. A **Durable HTTP Webhook Terminal API** backend permitting MT5 and local engines to synchronize log histories and alert states.

---

## 2. Core Functional Requirements

### 2.1 Strategy State Machine Logics

The core execution strategy consists of a deterministic, 5-stage sovereign state-machine:

1. **Scanning Phase (STATE_IDLE)**
   - Scanner tracks prices of the Fast 9-period EMA and Slow 50-period EMA on a designated timeframe (typically 15-Minute).
   - A bullish crossover (9 EMA passing above 50 EMA on a closed bar) initiates a BUY Setup. A bearish crossover (9 EMA passing below 50 EMA on a closed bar) initiates a SELL Setup.

2. **Impulse Verification Phase (STATE_CONFIRMED)**
   - To filter flat/choppy consolidation zones, the crossover close price must establish sufficient momentum.
   - The absolute distance between the close price and the 50 EMA crossover level must be at least the user-defined minDistancePips (e.g., 1000 pips, which corresponds to $10.00 on Gold).
   - If the first closed bar does not meet the impulse distance, the system monitors subsequent closed bars. If a candle closes on the opposite side of the 50 EMA prior to validation, the setup is immediately invalidated and resets to IDLE.

3. **Pullback Phase (STATE_CONFIRMED & impulseValidated = true -> STATE_PULLBACK)**
   - Prevent "FOMO" buying at peaks. The engine waits for a brief counter-trend consolidation.
   - Price must pull back and touch (or pierce) either the original crossover price level or the rising/falling 50-period EMA (on current bar high/low values).
   - Transition state to STATE_PULLBACK. If a candle closes on the opposite side of the 50 EMA during this pullback phase, the setup is invalidated and reverts to IDLE.

4. **Continuation & Trigger Phase (STATE_PULLBACK -> STATE_ACTIVE_TRADE)**
   - Once pullback touches the bounce level, wait for confirmation of continuation.
   - Bullish Continue (BUY): Previous closed bar must be a green candle (Close > Open).
   - Bearish Continue (SELL): Previous closed bar must be a red candle (Close < Open).
   - Execution: Instantly fire trade market orders.

5. **Active Position Management & Split-Lots (STATE_ACTIVE_TRADE)**
   - Position allocation (e.g. defaultLotSize = 0.10 Lots) is split into two equal, isolated orders (A & B = 0.05 Lots).
   - Stop Loss (SL) is established on both positions at a safe distance.
   - Take-Profit TP1 is set at e.g. 3.0x Risk-to-Reward. When hit, Position A closes in profit.
   - Take-Profit TP2 is set at e.g. 4.0x Risk-to-Reward.
   - At the exact moment TP1 is hit, the remaining Position B's Stop Loss is adjusted to the exact Entry Price (Breakeven). This guarantees zero risk of loss.

---

## 3. Web UI Views

- **Live Sandbox Simulator:** Renders candle canvas, moving averages, current trade bounds, speed sliders, typical gold spread, and "Choppy Mode" injection.
- **MQL5 Script Generator:** Generates parametric compile-safe MQL5 code matching user strategy parameters, complete with copy-to-clipboard and file downloads.
- **Webhook Logger console:** Reports state transitions, alert streams, and local or remote MT5 events.
`;
