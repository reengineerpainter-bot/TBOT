# Product Requirements Document (PRD)

## XAUUSD Split-Lot EMA Crossover Expert Advisor & Workspace (v2.1.2)

---

### Document Information
- **Title:** Product Requirements Document (PRD) for XAUUSD MetaBot Workspace
- **Category:** Algorithmic Trading Systems
- **Target Platform:** MetaTrader 5 (MT5) & React/Express Workspace Sandbox
- **Core Assets:** XAUUSD (Gold / US Dollar Spot)
- **Author:** AI Trading Systems Development Group
- **Status:** Approved / Production-Ready
- **Date:** June 1, 2026

---

## 1. Executive Summary & Purpose

The **XAUUSD MetaBot Workspace** is a high-performance, full-stack algorithmic trading solution designed for the specific and volatile market dynamics of spot Gold (**XAUUSD**). 

The primary business objective is to eliminate emotional trading errors and reduce structural drawdown by automating a rigorous **Trend Crossover, Impulse Validation, Pullback Bouncing, and Split-Lot Position Management** system.

This project delivers:
1. An **Interactive Sandbox Simulator** displaying real-time responsive charts matching live Gold pricing models (approx. $4490.00).
2. A **Dual-Stage MetaTrader 5 Expert Advisor (EA)** generator producing highly commented, compile-ready MQL5 script-base.
3. A **Durable HTTP Webhook Terminal API** backend permitting MT5 and local engines to synchronize log histories and alert states.

---

## 2. Core Functional Requirements

### 2.1 Strategy State Machine Logics

The core execution strategy consists of a deterministic, 5-stage sovereign state-machine:

```
[ STATE_IDLE ] --------( 9/50 Crossover )--------> [ STATE_CONFIRMED ]
       ^                                                    |
       |---------------( Invalidated if Close < 50EMA )-----|
       |                                                    v
       |<--------------( Target Impulse Met Validation )----|
       |                                                    v
[ STATE_IDLE ] <-------( Invalidated if Breaks 50EMA )---- [ STATE_PULLBACK ]
                                                            |
                                                   ( Touch EMA50 / Level & 
                                                      Continuation Candle )
                                                            v
                                                   [ STATE_ACTIVE_TRADE ]
                                                            |
                                                    ( Exit TP/SL Loops )
                                                            v
                                                   [ STATE_COOLDOWN_RANGE ]
```

#### A. Scanning Phase (`STATE_IDLE`)
- **Action:** Scanner tracks prices of the **Fast 9-period EMA** and **Slow 50-period EMA** on a designated timeframe (typically 15-Minute chart).
- **Trigger:** A bullish crossover (9 EMA passing above 50 EMA on a closed bar) initiates a **BUY Setup**. A bearish crossover (9 EMA passing below 50 EMA on a closed bar) initiates a **SELL Setup**.

#### B. Impulse Verification Phase (`STATE_CONFIRMED`)
- **Constraint:** To filter flat/choppy consolidation zones, the crossover close price must establish sufficient momentum.
- **Rules:** The absolute distance between the close price and the 50 EMA crossover level must be **at least** the user-defined `minDistancePips` (e.g., `1000 pips`, which corresponds to `$10.00` on Gold). 
- **Action:** If the first closed bar does not meet the impulse distance, the system monitors subsequent closed bars. If a candle closes on the *opposite* side of the 50 EMA prior to validation, the setup is **immediately invalidated** and resets to `IDLE`.

#### C. Pullback Phase (`STATE_CONFIRMED` & `impulseValidated = true` $\rightarrow$ `STATE_PULLBACK`)
- **Objective:** Prevent "FOMO" buying at peaks. The engine waits for a brief counter-trend consolidation.
- **Rules:** Price must pull back and touch (or pierce) either the original crossover price level or the rising/falling **50-period EMA** (on current bar high/low values).
- **Action:** Transition state to `STATE_PULLBACK`. If a candle closes on the opposite side of the 50 EMA during this pullback phase, the setup is **invalidated** and reverts to `IDLE`.

#### D. Continuation & Trigger Phase (`STATE_PULLBACK` $\rightarrow$ `STATE_ACTIVE_TRADE`)
- **Rules:** Once pullback touches the bounce level, wait for confirmation of continuation.
- **Bullish Continue (BUY):** Previous closed bar must be a **green candle** (Close > Open).
- **Bearish Continue (SELL):** Previous closed bar must be a **red candle** (Close < Open).
- **Execution:** Instantly fire trade market orders.

#### E. Active Position Management & Split-Lots (`STATE_ACTIVE_TRADE`)
To lock in safe returns while letting profits run, positions use a sophisticated **Lot-Splitting strategy**:
1. **Lot Split:** The total position size (e.g., `defaultLotSize = 0.10 Lots`) is split into **two equal, isolated orders** (Position A = 0.05 Lots; Position B = 0.05 Lots).
2. **Fixed Risk Profile:** Stop Loss (SL) is established on both positions at a safe distance (e.g. offset from entry or below the swing structure).
3. **Dual Take-Profit Targets:**
   - **Position A Targets TP1** (typically `3.0x` Risk-to-Reward Ratio). When reached, Position A closes in profit, immediately locking in `$15.00` per risk unit.
   - **Position B Targets TP2** (typically `4.0x` Risk-to-Reward Ratio).
4. **Auto-Breakeven Protection:** Instantaneous with Position A hitting TP1, the Stop Loss for the remaining Position B is relocated to the **exact entry price** (Breakeven). This ensures a completely stress-free ride for the second position, guaranteeing zero risk of overall capital loss.

---

## 3. Product Features & Views

### 3.1 Live Sandbox Simulator
- **Live SVG Candle Canvas:** Renders a high-fidelity chart displaying real-time candles, moving averages (9, 50, 200 EMAs), and current trade execution bounds.
- **Dynamic Controls:** Slider components to alter simulator speed (ms per tick), typical Gold spread, and "Choppy Mode" toggle (injects high-volatility sideways noise on demand).
- **HUD Performance Panels:** Keep running track of total simulated trades, win ratios, net yields, and security filters.

### 3.2 Compile MQL5 Script Generator
- **Auto-Generating Algorithmic Code:** Generates complete, compile-safe, production-ready **MetaTrader 5 Expert Advisor** written in clean MQL5.
- **Parametric Injection:** Injects user configuration (custom fast/slow EMAs, TP ratios, Webhook API parameters) directly into the MT5 input parameters section.
- **Easy Download & Deployment:** Includes visual buttons to copy or download ready-to-run `.mq5` scripts.

### 3.3 Remote Webhook Terminal API
- **Live HTTP Webhook:** Fully realized backend route (`/api/webhook`) that handles standard MT5 JSON notifications.
- **Synchronized Logs:** Visual retro console reporting state transitions, trade execution logs, and live MT5 broker signals.

---

## 4. Technical Architecture

### 4.1 Tech Stack
- **Framework:** React 18 with Vite.
- **Styling:** Tailwind CSS with full custom dark slate-and-gold visual pairing (`bg-zinc-950`).
- **Icons:** Lucide React icons.
- **Animations:** Motion React (`motion/react`) for crisp visual states transitions.
- **Backend API:** Fast Express Server proxying webhooks & serving static production bundles.

### 4.2 Trade Geometry
Gold Pricing Precision (2 Decimal Digits):
- $1.00 Gold movement = 100 Pips.
- $10.00 Crossover distance = 1000 Pips.
- Standard Gold Lot Size leverage: 1.0 Lot standard contract controls 100 oz of Gold.

---

## 5. Non-Functional & Safety Constraints
1. **Low-latency rendering:** Keep charts updated on tick updates without memory leaks.
2. **Strict Invalidation Guardrails:** Any violations of the 50 EMA boundary must reset scanners to avoid bad signals in flat markets.
3. **Responsive Design:** High contrast, legible typography using Inter and JetBrains Mono fonts optimized for desktop and high-density panels.
