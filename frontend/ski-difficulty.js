(() => {
  const PERIOD_TUNING = {
    "1mo": { mapWidth: 3.2, heightScale: 1.45, slopeAccel: 0.095, dangerTolerance: 38 },
    "3mo": { mapWidth: 4.2, heightScale: 1.2, slopeAccel: 0.085, dangerTolerance: 42 },
    "6mo": { mapWidth: 5.0, heightScale: 1.0, slopeAccel: 0.075, dangerTolerance: 45 },
    "1y":  { mapWidth: 7.5, heightScale: 0.82, slopeAccel: 0.065, dangerTolerance: 50 },
    "2y":  { mapWidth: 10.5, heightScale: 0.68, slopeAccel: 0.055, dangerTolerance: 56 },
  };
  const PRACTICE_DANGER_TOL_MULT = 2.5;
  const TIME_LIMIT_RATIO = 0.8;

  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }

  function average(values) {
    if (!Array.isArray(values) || values.length === 0) return 0;
    return values.reduce((sum, value) => sum + value, 0) / values.length;
  }

  function getTopAverage(values, ratio = 0.1) {
    if (!Array.isArray(values) || values.length === 0) return 0;
    const count = Math.max(1, Math.ceil(values.length * ratio));
    const sorted = [...values].sort((a, b) => b - a);
    return average(sorted.slice(0, count));
  }

  function analyzeMarketShape(closes) {
    if (!Array.isArray(closes) || closes.length < 2) {
      return { trend: 0, volatility: 0, maxSwing: 0 };
    }
    const first = closes[0] || 1;
    const last = closes[closes.length - 1] || first;
    const trend = (last - first) / Math.max(1, Math.abs(first));
    let volatilitySum = 0;
    let maxSwing = 0;
    for (let i = 1; i < closes.length; i++) {
      const prev = closes[i - 1] || 1;
      const move = Math.abs(closes[i] - prev) / Math.max(1, Math.abs(prev));
      volatilitySum += move;
      if (move > maxSwing) maxSwing = move;
    }
    return {
      trend,
      volatility: volatilitySum / Math.max(1, closes.length - 1),
      maxSwing,
    };
  }

  function getDifficultyLabel(score) {
    if (score >= 95) return 'hell';
    if (score >= 80) return 'expert';
    if (score >= 60) return 'hard';
    if (score >= 40) return 'normal';
    return 'easy';
  }

  function normalizePracticeOptions(options = {}) {
    const normalized = {
      steepness: Math.max(1, Math.min(100, options.steepness ?? 40)),
      hitboxSize: Math.max(1, Math.min(100, options.hitboxSize ?? 60)),
      startPct: Math.max(0, Math.min(99, options.startPct ?? 0)),
      endPct: Math.max(1, Math.min(100, options.endPct ?? 100)),
    };
    if (normalized.startPct >= normalized.endPct) {
      normalized.endPct = Math.min(100, normalized.startPct + 1);
    }
    return normalized;
  }

  function getPeriodConfigFor(period, isPractice, options = {}) {
    const base = PERIOD_TUNING[period] || PERIOD_TUNING["6mo"];
    if (!isPractice) return base;
    const normalized = normalizePracticeOptions(options);
    const t = (normalized.steepness - 1) / 99;
    const heightMult = 0.08 + t * 0.92;
    const slopeMult = 0.05 + t * 0.95;
    return {
      mapWidth: base.mapWidth,
      heightScale: base.heightScale * heightMult,
      slopeAccel: base.slopeAccel * slopeMult,
      dangerTolerance: Math.round(base.dangerTolerance * PRACTICE_DANGER_TOL_MULT),
    };
  }

  function sliceClosesForPractice(closes, isPractice, options = {}) {
    if (!Array.isArray(closes) || closes.length < 3) return [];
    if (!isPractice) return closes;
    const normalized = normalizePracticeOptions(options);
    if (normalized.startPct <= 0 && normalized.endPct >= 100) return closes;
    const startIndex = Math.max(0, Math.min(closes.length - 2, Math.floor(closes.length * normalized.startPct / 100)));
    const endIndex = Math.max(startIndex + 2, Math.min(closes.length, Math.ceil(closes.length * normalized.endPct / 100)));
    return closes.slice(startIndex, endIndex);
  }

  function calculateDifficulty({ closes, period, practiceMode, practiceOpts, width, height, config }) {
    if (!Array.isArray(closes) || closes.length < 3 || !width || !height) {
      return null;
    }

    const normalizedPracticeOpts = normalizePracticeOptions(practiceOpts || {});
    const derivedConfig = config || getPeriodConfigFor(period, practiceMode, normalizedPracticeOpts);
    const minP = Math.min(...closes);
    const maxP = Math.max(...closes);
    const range = maxP - minP || 1;
    const totalW = width * derivedConfig.mapWidth;
    const segW = totalW / Math.max(1, closes.length - 1);
    const amplitude = Math.min(height * 0.42, height * 0.35 * derivedConfig.heightScale);
    const ySpan = amplitude * 2;
    const screenY = closes.map((close) => ySpan - ((close - minP) / range) * ySpan);
    const slopes = [];
    const slopeChanges = [];
    let signChanges = 0;
    let safeSegments = 0;
    let extremeDownhillCount = 0;

    for (let i = 1; i < screenY.length; i++) {
      const slope = (screenY[i] - screenY[i - 1]) / Math.max(1, segW);
      slopes.push(slope);
      if (Math.abs(slope) <= 0.035) safeSegments++;
      if (slope >= 0.14) extremeDownhillCount++;
      if (i >= 2) {
        slopeChanges.push(Math.abs(slope - slopes[i - 2]));
        if (Math.sign(slope) !== 0 && Math.sign(slopes[i - 2]) !== 0 && Math.sign(slope) !== Math.sign(slopes[i - 2])) {
          signChanges++;
        }
      }
    }

    const downhillSlopes = slopes.filter((slope) => slope > 0);
    const uphillSlopes = slopes.filter((slope) => slope < 0).map((slope) => Math.abs(slope));
    const marketShape = analyzeMarketShape(closes);
    const practiceSteepness = practiceMode ? clamp((normalizedPracticeOpts.steepness ?? 40) / 100, 0.2, 1) : 1;
    const segmentCount = Math.max(1, slopes.length);
    const downhillRatio = downhillSlopes.length / segmentCount;
    const uphillRatio = uphillSlopes.length / segmentCount;
    const avgDownhill = average(downhillSlopes);
    const maxDownhill = downhillSlopes.length ? Math.max(...downhillSlopes) : 0;
    const avgUphill = average(uphillSlopes);

    const terrainVariation = clamp(average(slopeChanges) / 0.075, 0, 1);
    const timePressure = clamp(
      ((derivedConfig.mapWidth - 3.2) / 7.3) * 0.55
      + clamp(marketShape.volatility / 0.04, 0, 1) * 0.3
      + (1 - TIME_LIMIT_RATIO) * 0.75 * 0.15,
      0,
      1,
    );
    const downhillRisk = clamp(
      clamp(avgDownhill / 0.085, 0, 1) * 0.5
      + clamp(maxDownhill / 0.18, 0, 1) * 0.3
      + clamp(downhillRatio / 0.68, 0, 1) * 0.12
      + clamp(getTopAverage(downhillSlopes, 0.1) / 0.13, 0, 1) * 0.08,
      0,
      1,
    );
    const uphillDrag = clamp(
      clamp(avgUphill / 0.09, 0, 1) * 0.72
      + clamp(uphillRatio / 0.7, 0, 1) * 0.28,
      0,
      1,
    );
    const directionChangeDensity = clamp(signChanges / Math.max(1, slopes.length - 1) / 0.42, 0, 1);
    const recoveryScarcity = 1 - clamp((safeSegments / segmentCount) / 0.42, 0, 1);
    const burstPenalty = clamp(
      clamp(extremeDownhillCount / Math.max(1, Math.round(segmentCount * 0.12)), 0, 1) * 0.8
      + clamp(getTopAverage(downhillSlopes, 0.05) / 0.18, 0, 1) * 0.2,
      0,
      1,
    );

    const score = Math.round(100 * clamp(
      0.15 * terrainVariation +
      0.15 * timePressure +
      0.35 * downhillRisk +
      0.08 * uphillDrag +
      0.12 * directionChangeDensity +
      0.08 * recoveryScarcity +
      0.07 * burstPenalty,
      0,
      1,
    ) * practiceSteepness);

    return {
      score,
      label: getDifficultyLabel(score),
      factors: {
        terrainVariation: +terrainVariation.toFixed(3),
        timePressure: +timePressure.toFixed(3),
        downhillRisk: +downhillRisk.toFixed(3),
        uphillDrag: +uphillDrag.toFixed(3),
        directionChangeDensity: +directionChangeDensity.toFixed(3),
        recoveryScarcity: +recoveryScarcity.toFixed(3),
        burstPenalty: +burstPenalty.toFixed(3),
      },
    };
  }

  function previewDifficulty(data, options = {}) {
    if (!data?.closes?.length) return null;
    const isPractice = !!options.practice;
    const normalized = normalizePracticeOptions(options);
    const closes = sliceClosesForPractice(data.closes, isPractice, normalized);
    if (closes.length < 3) return null;
    const config = getPeriodConfigFor(data.period, isPractice, normalized);
    return calculateDifficulty({
      closes,
      period: data.period,
      practiceMode: isPractice,
      practiceOpts: normalized,
      width: Math.max(1100, window.innerWidth || 1100),
      height: Math.max(640, window.innerHeight || 640),
      config,
    });
  }

  window.SkiDifficulty = {
    PERIOD_TUNING,
    normalizePracticeOptions,
    getPeriodConfigFor,
    calculateDifficulty,
    previewDifficulty,
    getDifficultyLabel,
    sliceClosesForPractice,
  };
})();
