/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from "react";
import { StrategyParameters } from "../types";

interface StrategyConfigProps {
  params: StrategyParameters;
  onChange: (updates: Partial<StrategyParameters>) => void;
  isChoppyMode: boolean;
  onToggleChoppyMode: () => void;
}

export default function StrategyConfig({
  params,
  onChange,
  isChoppyMode,
  onToggleChoppyMode,
}: StrategyConfigProps) {
  
  const handleNumChange = (key: keyof StrategyParameters, val: string) => {
    const num = parseFloat(val);
    if (!isNaN(num)) {
      onChange({ [key]: num });
    }
  };

  return (
    <div className="w-full flex flex-col gap-6">
      {/* Parameters Header */}
      <div className="border-b border-zinc-800 pb-4">
        <h2 className="text-zinc-500 text-xs font-bold uppercase tracking-widest mb-1.5">
          EMA Execution Checklist
        </h2>
        <p className="text-[11px] text-zinc-400">
          These rules compile directly to the MQL5 script and are enforced within the active simulation.
        </p>
      </div>

      {/* Grid parameter settings inputs */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Fast EMA Period */}
        <div>
          <label className="block text-[10px] font-mono text-zinc-400 mb-1.5 uppercase font-bold tracking-wider">
            Fast EMA Period
          </label>
          <input
            type="number"
            className="w-full bg-zinc-950 border border-zinc-800 rounded-xl p-2.5 text-xs text-zinc-200 focus:outline-none focus:border-amber-500/50 font-mono transition-all"
            value={params.fastEma}
            onChange={(e) => handleNumChange("fastEma", e.target.value)}
          />
          <span className="text-[10px] text-zinc-500 font-mono mt-1.5 block">
            Crossing trigger line (9 EMA default)
          </span>
        </div>

        {/* Slow EMA Period */}
        <div>
          <label className="block text-[10px] font-mono text-zinc-400 mb-1.5 uppercase font-bold tracking-wider">
            Slow EMA Period
          </label>
          <input
            type="number"
            className="w-full bg-zinc-950 border border-zinc-800 rounded-xl p-2.5 text-xs text-zinc-200 focus:outline-none focus:border-amber-500/50 font-mono transition-all"
            value={params.slowEma}
            onChange={(e) => handleNumChange("slowEma", e.target.value)}
          />
          <span className="text-[10px] text-zinc-500 font-mono mt-1.5 block">
            Dynamic support/resistance base
          </span>
        </div>

        {/* Crossover Impulse Distance */}
        <div>
          <label className="block text-[10px] font-mono text-zinc-400 mb-1.5 uppercase font-bold tracking-wider">
            Min Distance (Pips)
          </label>
          <input
            type="number"
            step="100"
            className="w-full bg-zinc-950 border border-zinc-800 rounded-xl p-2.5 text-xs text-zinc-200 focus:outline-none focus:border-amber-500/50 font-mono transition-all"
            value={params.minDistancePips}
            onChange={(e) => handleNumChange("minDistancePips", e.target.value)}
          />
          <span className="text-[10px] text-zinc-500 font-mono mt-1.5 block">
            Impulse crossover threshold
          </span>
        </div>

        {/* Max Spread safeguard */}
        <div>
          <label className="block text-[10px] font-mono text-zinc-400 mb-1.5 uppercase font-bold tracking-wider">
            Max Spread Filter
          </label>
          <input
            type="number"
            className="w-full bg-zinc-950 border border-zinc-800 rounded-xl p-2.5 text-xs text-zinc-200 focus:outline-none focus:border-amber-500/50 font-mono transition-all"
            value={params.maxSpreadPips}
            onChange={(e) => handleNumChange("maxSpreadPips", e.target.value)}
          />
          <span className="text-[10px] text-zinc-500 font-mono mt-1.5 block">
            Safety spread cap (Pips limit)
          </span>
        </div>

        {/* TP1 & TP2 multipliers */}
        <div>
          <label className="block text-[10px] font-mono text-zinc-400 mb-1.5 uppercase font-bold tracking-wider">
            TP1 Ratio (Split A)
          </label>
          <input
            type="number"
            step="0.5"
            className="w-full bg-zinc-950 border border-zinc-800 rounded-xl p-2.5 text-xs text-zinc-200 focus:outline-none focus:border-amber-500/50 font-mono transition-all"
            value={params.tp1Ratio}
            onChange={(e) => handleNumChange("tp1Ratio", e.target.value)}
          />
          <span className="text-[10px] text-zinc-500 font-mono mt-1.5 block">
            Half lot profit secure at R:R
          </span>
        </div>

        <div>
          <label className="block text-[10px] font-mono text-zinc-400 mb-1.5 uppercase font-bold tracking-wider">
            TP2 Ratio (Split B)
          </label>
          <input
            type="number"
            step="0.5"
            className="w-full bg-zinc-950 border border-zinc-800 rounded-xl p-2.5 text-xs text-zinc-200 focus:outline-none focus:border-amber-500/50 font-mono transition-all"
            value={params.tp2Ratio}
            onChange={(e) => handleNumChange("tp2Ratio", e.target.value)}
          />
          <span className="text-[10px] text-zinc-500 font-mono mt-1.5 block">
            Final residual runner closeout
          </span>
        </div>

        {/* Lot Size splits configuration */}
        <div>
          <label className="block text-[10px] font-mono text-zinc-400 mb-1.5 uppercase font-bold tracking-wider">
            Total Lot Size
          </label>
          <input
            type="number"
            step="0.01"
            className="w-full bg-zinc-950 border border-zinc-800 rounded-xl p-2.5 text-xs text-zinc-200 focus:outline-none focus:border-amber-500/50 font-mono transition-all"
            value={params.defaultLotSize}
            onChange={(e) => handleNumChange("defaultLotSize", e.target.value)}
          />
          <span className="text-[10px] text-zinc-500 font-mono mt-1.5 block">
            Splits into equal trade halves
          </span>
        </div>

        {/* Max trades limits per day */}
        <div>
          <label className="block text-[10px] font-mono text-zinc-400 mb-1.5 uppercase font-bold tracking-wider">
            Max Daily Fills
          </label>
          <input
            type="number"
            min="1"
            max="10"
            className="w-full bg-zinc-950 border border-zinc-800 rounded-xl p-2.5 text-xs text-zinc-200 focus:outline-none focus:border-amber-500/50 font-mono transition-all"
            value={params.maxTradesPerDay}
            onChange={(e) => handleNumChange("maxTradesPerDay", e.target.value)}
          />
          <span className="text-[10px] text-zinc-500 font-mono mt-1.5 block">
            Risk mitigation frequency limit
          </span>
        </div>
      </div>

      {/* Advanced Market Switcher controls block */}
      <div className="bg-zinc-950/50 border border-zinc-800 p-4 rounded-xl">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
          <div>
            <h4 className="text-zinc-250 text-xs font-bold uppercase tracking-wider font-sans">Chop Defense Filter</h4>
            <p className="text-[10px] text-zinc-500 mt-0.5 leading-relaxed font-mono">
              Enforce a flatline choppy Gold market to evaluate range defense filters.
            </p>
          </div>
          <button
            onClick={onToggleChoppyMode}
            id="chop-mode-toggle"
            className={`cursor-pointer px-4 py-2 rounded-lg border font-mono text-[10px] font-black tracking-widest transition-all ${
              isChoppyMode
                ? "bg-red-955 text-red-400 border-red-900/60 shadow-md rotate-1"
                : "bg-zinc-900 text-zinc-500 border-zinc-850 hover:text-zinc-300"
            }`}
          >
            {isChoppyMode ? "ACTIVE_CHOP" : "OFFLIN_TREND"}
          </button>
        </div>
      </div>
    </div>
  );
}
