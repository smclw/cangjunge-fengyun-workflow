import type { ScoringConfig } from '../services/config.js';

export interface TopicScoreInput {
  growth: Record<string, number>;
  monetization: Record<string, number>;
  risks: Record<string, number | boolean>;
  weights: { growth: number; monetization: number };
}

export function calculateTopicScore(input: TopicScoreInput, config: ScoringConfig) {
  if (Math.abs(input.weights.growth + input.weights.monetization - 1) > 0.000001) throw new Error('涨粉与变现权重之和必须为1');
  const sumCategory = (values: Record<string, number>, limits: Record<string, number>, label: string) => {
    let total = 0;
    for (const [key, max] of Object.entries(limits)) {
      const value = values[key];
      if (!Number.isFinite(value) || value < 0 || value > max) throw new Error(`${label}.${key} 必须在 0-${max} 之间`);
      total += value;
    }
    return total;
  };
  const growthScore = sumCategory(input.growth, config.growth, 'growth');
  const monetizationScore = sumCategory(input.monetization, config.monetization, 'monetization');
  let riskPenalty = 0;
  for (const [key, max] of Object.entries(config.risks)) {
    const raw = input.risks[key] ?? 0;
    const value = typeof raw === 'boolean' ? (raw ? max : 0) : raw;
    if (!Number.isFinite(value) || Number(value) < 0 || Number(value) > max) throw new Error(`risks.${key} 必须在 0-${max} 之间`);
    riskPenalty += Number(value);
  }
  const publishBlocked = config.hardBlocks.some((key) => Boolean(input.risks[key]));
  return {
    growthScore,
    monetizationScore,
    riskPenalty,
    compositeScore: Number((growthScore * input.weights.growth + monetizationScore * input.weights.monetization - riskPenalty).toFixed(2)),
    publishBlocked
  };
}
