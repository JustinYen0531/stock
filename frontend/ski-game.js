/* ═══════════════════════════════════════════════════════════════
   ski-game.js  —  Stock Ski Game
   玩法：股票收盤線橫穿畫面，角色 hitbox 必須保持在線上（上下都不能完全超過）
   控制：滑鼠滾輪上下移動角色
   ═══════════════════════════════════════════════════════════════ */

(function () {
  /* ── 常數 ───────────────────────────────────────── */
  const HITBOX_H       = 40;   // 一般模式 hitbox 高度 (px)
  const HITBOX_W       = 28;   // 角色 hitbox 寬度 (px)
  const SCROLL_SPEED   = 6.0;  // 基準速度
  const MIN_SPEED      = 3.0;  // 極限最低速
  const MAX_SPEED      = 11.0; // 極限最高速
  const SCROLL_SENS    = 18;   // 滾輪靈敏度
  const BOOST_MULTIPLIER = 2.8; // 按住中鍵時的滾輪增幅
  const SPEED_BOOST_MULT = 1.5; // 右鍵 / D 最快 1.5x
  const SPEED_BRAKE_MULT = 0.8; // 左鍵 / A 最慢 0.8x
  const CHAR_X_RATIO   = 0.22; // 角色在畫面的 X 比例（左側固定位置）
  const LINE_Y_MID     = 0.55; // 地平線在畫面高度的比例
  const TIME_LIMIT_RATIO = 0.8; // 通關時間限制：正常基準時間的 80%
  const PERIOD_TUNING = {
    "1mo": { mapWidth: 3.2, heightScale: 1.45, slopeAccel: 0.095, dangerTolerance: 38 },
    "3mo": { mapWidth: 4.2, heightScale: 1.2, slopeAccel: 0.085, dangerTolerance: 42 },
    "6mo": { mapWidth: 5.0, heightScale: 1.0, slopeAccel: 0.075, dangerTolerance: 45 },
    "1y":  { mapWidth: 7.5, heightScale: 0.82, slopeAccel: 0.065, dangerTolerance: 50 },
    "2y":  { mapWidth: 10.5, heightScale: 0.68, slopeAccel: 0.055, dangerTolerance: 56 },
  };
  // 練習模式係數 (乘以一般值)
  const PRACTICE_HEIGHT_SCALE_MULT  = 0.55; // 地形高度縮減到 55% (更平緩)
  const PRACTICE_SLOPE_ACCEL_MULT   = 0.50; // 斜率加速只有 50% (更慢)
  const PRACTICE_DANGER_TOL_MULT    = 2.5;  // 容忍時間放大 2.5 倍
  const PRACTICE_HITBOX_H           = 72;   // 練習模式 hitbox 高度 (比一般大很多)
  const DANGER_LIMIT_MULTIPLIER     = 5.5;  // 累積容錯大幅提高，讓單次失誤不至於直接淘汰

  /* ── 狀態 ───────────────────────────────────────── */
  let canvas, ctx;
  let animId;
  let gameState = 'idle'; // idle | countdown | playing | dead | complete
  let stockData = null;   // { symbol, closes, dates, period }
  let practiceMode = false; // 練習模式開關
  let practiceOpts = { steepness: 40, hitboxSize: 60, startPct: 0, endPct: 100 }; // 從滑框傳入

  // 動態取得當前 hitbox 高度
  // hitboxSize 1√100 → 映射到 40√100px
  function getHitboxH() {
    if (!practiceMode) return HITBOX_H;
    const t = (practiceOpts.hitboxSize - 1) / 99; // 0~1
    return Math.round(HITBOX_H + t * (100 - HITBOX_H)); // 40~100px
  }

  // 地形
  let terrainPoints = []; // [{x, y}] 已映射到畫面座標
  let terrainScrollX = 0; // 目前已捲過多少 px
  let activeCloses = [];
  let activeDates = [];
  let priceMin = 0;
  let priceMax = 1;
  let terrainYMin = 0;
  let terrainYMax = 1;
  let leftKeyDown = false;
  let rightKeyDown = false;
  let leftMouseDown = false;
  let rightMouseDown = false;

  // 角色
  let charY = 200;        // 角色中心 Y
  let charTargetY = 200;  // 滾輪目標 Y（加平滑）
  let isBoosting = false; // 滑鼠中鍵按住時提升上下移動幅度
  let spaceBoostDown = false;

  // 危險計時
  let dangerFrames = 0;
  let isDangerAbove = false;
  let isDangerBelow = false;

  // HUD
  let score = 0;
  let maxPossibleScore = 0; // 本關理論最高分
  let mouseOnlyRun = true;
  let surviveFrames = 0;
  let timeLimitSeconds = 0;
  let countdownVal = 3;
  let countdownTimer = 0;
  let perfectStreakDistance = 0;
  let bestPerfectStreakDistance = 0;
  let streakBonusScore = 0;
  let elapsedMs = 0;
  let lastFrameTs = 0;
  let earlyFinishBonus = 0;
  let scoreBandFrames = {
    perfect: 0,
    light: 0,
    mild: 0,
    medium: 0,
    heavy: 0,
  };
  let resultButtonRects = null;

  // 粒子
  let particles = [];

  // 速度
  let currentSpeed = SCROLL_SPEED;
  let playerSpeedMultiplier = 1;

  function getDangerLimit() {
    const config = getPeriodConfig();
    return Math.max(1, config.dangerTolerance * DANGER_LIMIT_MULTIPLIER);
  }

  function getDangerRatio() {
    return Math.min(1, dangerFrames / getDangerLimit());
  }

  function getAccuracyPct() {
    return Math.max(70, 100 - getDangerRatio() * 30);
  }

  function getAccuracyBarRatio() {
    return Math.max(0, Math.min(1, (getAccuracyPct() - 70) / 30));
  }

  function getScoreMultiplier() {
    return mouseOnlyRun ? 1.3 : 1;
  }

  function getFinalScore() {
    return Math.round((score + earlyFinishBonus) * getScoreMultiplier());
  }

  function getDangerBand(ratio) {
    if (ratio <= 0) return 'perfect';
    if (ratio <= 0.12) return 'light';
    if (ratio <= 0.28) return 'mild';
    if (ratio <= 0.5) return 'medium';
    return 'heavy';
  }

  function getBandScore(ratio) {
    const band = getDangerBand(ratio);
    if (band === 'perfect') {
      const totalDistance = Math.max(1, terrainPoints[terrainPoints.length - 1]?.x || 1);
      const streakPct = (perfectStreakDistance / totalDistance) * 100;
      if (streakPct >= 50) return 20;
      if (streakPct >= 40) return 18;
      if (streakPct >= 30) return 16;
      if (streakPct >= 20) return 14;
      if (streakPct >= 10) return 12;
      return 10;
    }
    if (band === 'light') return 7;
    if (band === 'mild') return 5;
    if (band === 'medium') return 3;
    return 1;
  }

  function getBandPct(key) {
    const total = Math.max(1, surviveFrames);
    return (scoreBandFrames[key] / total) * 100;
  }

  function getBestPerfectPct() {
    const totalDistance = Math.max(1, terrainPoints[terrainPoints.length - 1]?.x || 1);
    return (bestPerfectStreakDistance / totalDistance) * 100;
  }

  function getElapsedSeconds() {
    return elapsedMs / 1000;
  }

  function getQualifyingSeconds() {
    return timeLimitSeconds;
  }

  function getEarnedStars() {
    const starRatio = getFinalScore() / Math.max(1, maxPossibleScore);
    if (starRatio > 0.85) return 3;
    if (starRatio > 0.55) return 2;
    if (starRatio > 0.25) return 1;
    return 0;
  }

  function unlockMedal(key) {
    try {
      const medals = JSON.parse(localStorage.getItem('skiMedals') || '{}');
      medals[key] = true;
      localStorage.setItem('skiMedals', JSON.stringify(medals));
      window.updateSkiMedals?.();
    } catch {
      // Ignore storage errors and keep gameplay uninterrupted.
    }
  }

  function getPeriodConfig() {
    const base = PERIOD_TUNING[stockData?.period] || PERIOD_TUNING["6mo"];
    if (!practiceMode) return base;
    // steepness 1~100 → 地形高度 0.08~1.0 倍，斜率加速 0.05~1.0 倍
    const t = (practiceOpts.steepness - 1) / 99; // 0~1
    const heightMult = 0.08 + t * 0.92;  // 0.08x (very flat) ~ 1.0x (normal)
    const slopeMult  = 0.05 + t * 0.95;  // 0.05x (very slow) ~ 1.0x (normal)
    return {
      mapWidth:        base.mapWidth,
      heightScale:     base.heightScale * heightMult,
      slopeAccel:      base.slopeAccel  * slopeMult,
      dangerTolerance: Math.round(base.dangerTolerance * PRACTICE_DANGER_TOL_MULT),
    };
  }

  /* ══════════════════════════════════════════════════
     公開 API — 從 app.js 呼叫
  ══════════════════════════════════════════════════ */
  window.SkiGame = {
    launch(data, options = {}) {
      stockData    = data; // { symbol, closes: [], dates: [], period }
      practiceMode = !!options.practice;
      if (practiceMode) {
        practiceOpts = {
          steepness:  Math.max(1, Math.min(100, options.steepness  ?? 40)),
          hitboxSize: Math.max(1, Math.min(100, options.hitboxSize ?? 60)),
          startPct:   Math.max(0, Math.min(99,  options.startPct  ?? 0)),
          endPct:     Math.max(1, Math.min(100, options.endPct    ?? 100)),
        };
        // 確保 start < end
        if (practiceOpts.startPct >= practiceOpts.endPct) practiceOpts.endPct = Math.min(100, practiceOpts.startPct + 1);
      }
      openModal();
      initGame();
    },
    close: closeGame
  };

  /* ── Modal 開關 ─────────────────────────────────── */
  function openModal() {
    let modal = document.getElementById('skiGameModal');
    if (!modal) {
      modal = buildModalDOM();
      document.body.appendChild(modal);
    }
    modal.classList.remove('hidden');
    canvas = document.getElementById('skiCanvas');
    ctx    = canvas.getContext('2d');
    updateCursorVisibility();
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);
  }

  function closeGame() {
    cancelAnimationFrame(animId);
    gameState = 'idle';
    particles = [];
    unbindInput();
    window.removeEventListener('resize', resizeCanvas);
    document.getElementById('skiGameModal')?.classList.add('hidden');
  }

  function buildModalDOM() {
    const modal = document.createElement('div');
    modal.id = 'skiGameModal';
    modal.className = 'ski-modal hidden';
    modal.innerHTML = `
      <canvas id="skiCanvas"></canvas>
      <button class="ski-close-btn" onclick="SkiGame.close()">✕ 離開</button>
      <div class="ski-hint">🖱️ 滾輪上下移動 &nbsp;·&nbsp; 同時按住 ←→ 或 A+D 往右衝刺 &nbsp;·&nbsp; 別被拖到最左邊</div>
    `;
    return modal;
  }

  function resizeCanvas() {
    if (!canvas) return;
    canvas.width  = canvas.parentElement.clientWidth  || window.innerWidth;
    canvas.height = canvas.parentElement.clientHeight || window.innerHeight;
    buildTerrain(); // 重新映射地形
  }

  /* ── 地形建構 ────────────────────────────────────── */
  function buildTerrain() {
    if (!stockData || !canvas) return;
    const allCloses = stockData.closes;
    const allDates = stockData.dates || [];
    const allN = allCloses.length;

    // 練習模式：依百分比切片地形
    let closes = allCloses;
    let dates = allDates;
    if (practiceMode && (practiceOpts.startPct > 0 || practiceOpts.endPct < 100)) {
      const s = Math.floor(allN * practiceOpts.startPct / 100);
      const e = Math.min(allN, Math.ceil(allN * practiceOpts.endPct  / 100));
      closes = allCloses.slice(s, e);
      dates = allDates.slice(s, e);
    }

    activeCloses = closes;
    activeDates = dates;

    const N = closes.length;
    if (N < 2) return;

    const W = canvas.width;
    const H = canvas.height;

    const minP = Math.min(...closes);
    const maxP = Math.max(...closes);
    const range = maxP - minP || 1;
    const config = getPeriodConfig();
    const totalW = W * config.mapWidth;
    const segW   = totalW / (N - 1);
    const centerY = H * 0.5;
    const baseAmplitude = H * 0.35;
    const amplitude = Math.min(H * 0.42, baseAmplitude * config.heightScale);
    const yMin = centerY - amplitude;
    const yMax = centerY + amplitude;
    priceMin = minP;
    priceMax = maxP;
    terrainYMin = yMin;
    terrainYMax = yMax;

    terrainPoints = closes.map((c, i) => ({
      x: i * segW,
      y: yMax - ((c - minP) / range) * (yMax - yMin),
    }));
  }

  /* ── 初始化遊戲 ──────────────────────────────────── */
  function initGame() {
    cancelAnimationFrame(animId);
    unbindInput();
    terrainScrollX = 0;
    score          = 0;
    surviveFrames  = 0;
    dangerFrames   = 0;
    isDangerAbove  = false;
    isDangerBelow  = false;
    particles      = [];
    currentSpeed   = SCROLL_SPEED;
    playerSpeedMultiplier = 1;
    countdownVal   = 3;
    countdownTimer = 0;
    leftKeyDown    = false;
    rightKeyDown   = false;
    leftMouseDown  = false;
    rightMouseDown = false;
    mouseOnlyRun   = true;
    spaceBoostDown = false;
    perfectStreakDistance = 0;
    bestPerfectStreakDistance = 0;
    streakBonusScore = 0;
    elapsedMs = 0;
    lastFrameTs = 0;
    earlyFinishBonus = 0;
    scoreBandFrames = {
      perfect: 0,
      light: 0,
      mild: 0,
      medium: 0,
      heavy: 0,
    };
    resultButtonRects = null;

    buildTerrain();

    // 計算理論最高分 (假設每幀都是完美狀態 x10)
    // 我們粗略估計：總距離 / 平均速度 = 總幀數 * 10
    const lastX = terrainPoints[terrainPoints.length - 1]?.x || 1;
    maxPossibleScore = Math.floor((lastX / SCROLL_SPEED) * 10);
    timeLimitSeconds = Math.max(0.1, (lastX / SCROLL_SPEED / 60) * TIME_LIMIT_RATIO);

    // 角色起始 Y 對齊玩家所在 X 位置的地形中心，開場就精準壓在線上
    const charX = canvas.width * CHAR_X_RATIO;
    charY       = getLineYAt(charX);
    charTargetY = charY;

    gameState = 'countdown';
    bindInput();
    updateCursorVisibility();
    animId = requestAnimationFrame(loop);
  }

  /* ── 輸入綁定 ────────────────────────────────────── */
  function bindInput() {
    canvas.addEventListener('wheel', onWheel, { passive: false });
    canvas.addEventListener('mousedown', onMouseDown);
    canvas.addEventListener('mouseup', onMouseUp);
    canvas.addEventListener('mouseleave', onMouseUp);
    canvas.addEventListener('contextmenu', onContextMenu);
    document.addEventListener('keydown', onKey);
    document.addEventListener('keyup', onKeyUp);
  }

  function unbindInput() {
    canvas?.removeEventListener('wheel', onWheel);
    canvas?.removeEventListener('mousedown', onMouseDown);
    canvas?.removeEventListener('mouseup', onMouseUp);
    canvas?.removeEventListener('mouseleave', onMouseUp);
    canvas?.removeEventListener('contextmenu', onContextMenu);
    document.removeEventListener('keydown', onKey);
    document.removeEventListener('keyup', onKeyUp);
  }

  function disableWheelInput() {
    canvas?.removeEventListener('wheel', onWheel);
    isBoosting = false;
  }

  function updateCursorVisibility() {
    if (!canvas) return;
    const showCursor = gameState === 'dead' || gameState === 'complete';
    canvas.classList.toggle('ski-canvas-show-cursor', showCursor);
  }

  function onWheel(e) {
    e.preventDefault();
    if (gameState !== 'playing') return;
    const moveAmount = SCROLL_SENS * (isBoosting ? BOOST_MULTIPLIER : 1);
    charTargetY += e.deltaY > 0 ? moveAmount : -moveAmount;
    // 夾在畫面範圍內
    const hh = getHitboxH();
    charTargetY = Math.max(hh / 2 + 5, Math.min(canvas.height - hh / 2 - 5, charTargetY));
  }

  function onMouseDown(e) {
    if (e.button === 0 && (gameState === 'dead' || gameState === 'complete')) {
      const rect = canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      const retryRect = resultButtonRects?.retry;
      const exitRect = resultButtonRects?.exit;
      if (retryRect && x >= retryRect.x && x <= retryRect.x + retryRect.w && y >= retryRect.y && y <= retryRect.y + retryRect.h) {
        initGame();
        return;
      }
      if (exitRect && x >= exitRect.x && x <= exitRect.x + exitRect.w && y >= exitRect.y && y <= exitRect.y + exitRect.h) {
        closeGame();
        return;
      }
    }
    if (e.button === 1) {
      e.preventDefault();
      isBoosting = true;
    } else if (e.button === 0) {
      leftMouseDown = true;
    } else if (e.button === 2) {
      e.preventDefault();
      rightMouseDown = true;
    }
  }

  function onMouseUp(e) {
    if (!e || e.button === 1) {
      isBoosting = spaceBoostDown;
    }
    if (!e || e.button === 0) leftMouseDown = false;
    if (!e || e.button === 2) rightMouseDown = false;
  }

  function onContextMenu(e) {
    e.preventDefault();
  }

  function onKey(e) {
    if (e.key === 'Escape') closeGame();
    if ((e.key === 'r' || e.key === 'R') && (gameState === 'dead' || gameState === 'complete')) {
      initGame();
    }
    if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') {
      leftKeyDown = true;
      mouseOnlyRun = false;
    }
    if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') {
      rightKeyDown = true;
      mouseOnlyRun = false;
    }
    if (e.code === 'Space' && !spaceBoostDown) {
      e.preventDefault();
      spaceBoostDown = true;
      isBoosting = true;
      mouseOnlyRun = false;
    }
  }

  function onKeyUp(e) {
    if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') leftKeyDown = false;
    if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') rightKeyDown = false;
    if (e.code === 'Space') {
      spaceBoostDown = false;
      isBoosting = false;
    }
  }

  /* ── 主迴圈 ──────────────────────────────────────── */
  function loop() {
    const now = performance.now();
    if (!lastFrameTs) lastFrameTs = now;
    const deltaMs = Math.min(50, Math.max(0, now - lastFrameTs));
    lastFrameTs = now;
    update();
    if (gameState === 'playing') {
      elapsedMs += deltaMs;
    }
    render();
    if (gameState !== 'idle') {
      animId = requestAnimationFrame(loop);
    }
  }

  function update() {
    if (gameState === 'countdown') {
      countdownTimer++;
      if (countdownTimer >= 60) { // 每秒
        countdownTimer = 0;
        countdownVal--;
        if (countdownVal <= 0) gameState = 'playing';
      }
      updateParticles();
      if (Math.random() < 0.3) {
        spawnSnowflake();
      }
      return;
    }

    if (gameState === 'complete') {
      updateParticles();
      if (Math.random() < 0.45) {
        spawnFallingConfetti();
      }
      return;
    }

    if (gameState === 'dead') {
      updateParticles();
      return;
    }

    if (gameState !== 'playing') return;

    surviveFrames++;
    const config = getPeriodConfig();
    
    const charX = canvas.width * CHAR_X_RATIO;

    // 平滑移動角色
    charY += (charTargetY - charY) * 0.18;

    // 計算目前捲動位置對應的地形 Y
    const lineY = getLineYAt(terrainScrollX + charX);

    // ── 持續式速度物理 ──
    const lookAhead = 25; // 地圖變長後，讀取更遠一點的點來反應斜率變化
    const nextLineY = getLineYAt(terrainScrollX + charX + lookAhead);
    const slope     = (nextLineY - lineY) / lookAhead; // 正=下坡, 負=上坡

    // 根據斜率累加/減速度 (加速度模型)
    currentSpeed += slope * config.slopeAccel;

    // 空氣阻力：緩緩拉回基準速度 (讓速度不會永遠卡在最高或最低)
    const drag = 0.004;
    currentSpeed += (SCROLL_SPEED - currentSpeed) * drag;

    // 玩家自主速度倍率：只受左右鍵影響，與上下坡造成的實際速度分開
    const accelActive = (rightKeyDown || rightMouseDown) && !(leftKeyDown || leftMouseDown);
    const brakeActive = (leftKeyDown || leftMouseDown) && !(rightKeyDown || rightMouseDown);

    if (accelActive) {
      playerSpeedMultiplier = Math.min(SPEED_BOOST_MULT, playerSpeedMultiplier + 0.008);
    } else if (brakeActive) {
      playerSpeedMultiplier = Math.max(SPEED_BRAKE_MULT, playerSpeedMultiplier - 0.008);
    } else {
      const driftBack = playerSpeedMultiplier > 1 ? -0.005 : playerSpeedMultiplier < 1 ? 0.005 : 0;
      playerSpeedMultiplier = Math.max(SPEED_BRAKE_MULT, Math.min(SPEED_BOOST_MULT, playerSpeedMultiplier + driftBack));
    }

    // 玩家控制速度：右側輸入加速，左側輸入減速
    if (accelActive) {
      currentSpeed += 0.16;
    } else if (brakeActive) {
      currentSpeed -= 0.14;
    }

    // 限制極速與最低速
    const dynamicMinSpeed = Math.max(MIN_SPEED, SCROLL_SPEED * SPEED_BRAKE_MULT);
    const dynamicMaxSpeed = Math.min(MAX_SPEED, SCROLL_SPEED * SPEED_BOOST_MULT);
    currentSpeed = Math.max(dynamicMinSpeed, Math.min(dynamicMaxSpeed, currentSpeed));

    terrainScrollX += currentSpeed;

    if (getElapsedSeconds() > timeLimitSeconds) {
      triggerDeath(lineY);
      return;
    }

    // 判定：角色 hitbox 是否包住線
    const hh        = getHitboxH();
    const hitTop    = charY - hh / 2;
    const hitBottom = charY + hh / 2;
    const aboveLine = hitBottom < lineY; // hitbox 完全在線上方
    const belowLine = hitTop    > lineY; // hitbox 完全在線下方

    if (aboveLine || belowLine) {
      // 累積值會永久保留；偏得更遠只會增加得稍快，不會一下暴衝。
      // 這樣單次大失誤仍可挽回，但反覆的小失誤會慢慢把容錯吃光。
      const dist = aboveLine ? (lineY - hitBottom) : (hitTop - lineY);
      const distRatio = dist / Math.max(1, hh);
      const increaseRate = 0.12 + Math.pow(Math.max(0, distRatio), 0.85) * 0.55;
      
      dangerFrames += increaseRate;
      isDangerAbove = aboveLine;
      isDangerBelow = belowLine;
      
      if (dangerFrames >= getDangerLimit()) {
        triggerDeath(lineY);
        return;
      }
    } else {
      isDangerAbove  = false;
      isDangerBelow  = false;
    }

    // ── 動態計分系統 ──
    const postDangerRatio = getDangerRatio();
    const scoreBand = getDangerBand(postDangerRatio);
    scoreBandFrames[scoreBand]++;

    if (scoreBand === 'perfect') {
      perfectStreakDistance += currentSpeed;
      bestPerfectStreakDistance = Math.max(bestPerfectStreakDistance, perfectStreakDistance);
    } else {
      perfectStreakDistance = 0;
    }

    const frameScore = getBandScore(postDangerRatio);
    score += frameScore;
    if (scoreBand === 'perfect' && frameScore > 10) {
      streakBonusScore += frameScore - 10;
    }

    // 關卡完成：捲過地形最後一點
    const lastX = terrainPoints[terrainPoints.length - 1].x;
    if (terrainScrollX + charX >= lastX) {
      const secondsEarly = Math.max(0, getQualifyingSeconds() - getElapsedSeconds());
      earlyFinishBonus = Math.round(secondsEarly * 50);
      gameState = 'complete';
      disableWheelInput();
      updateCursorVisibility();
      unlockMedal(practiceMode ? 'practiceComplete' : 'normalComplete');
      if (getEarnedStars() >= 3) unlockMedal('threeStars');
      spawnPartyParticles();
    }

    // 粒子更新
    updateParticles();

    // 持續雪花
    if (Math.random() < 0.3) {
      spawnSnowflake();
    }
  }

  /* ── 取得地形 Y ──────────────────────────────────── */
  function getLineYAt(worldX) {
    if (!terrainPoints.length) return canvas.height * LINE_Y_MID;
    // 二分搜尋找區段
    const pts = terrainPoints;
    if (worldX <= pts[0].x)             return pts[0].y;
    if (worldX >= pts[pts.length - 1].x) return pts[pts.length - 1].y;

    let lo = 0, hi = pts.length - 1;
    while (hi - lo > 1) {
      const mid = (lo + hi) >> 1;
      if (pts[mid].x <= worldX) lo = mid; else hi = mid;
    }
    const t = (worldX - pts[lo].x) / (pts[hi].x - pts[lo].x);
    return pts[lo].y + t * (pts[hi].y - pts[lo].y);
  }

  function getInterpolatedCloseAt(worldX) {
    if (!terrainPoints.length || !activeCloses.length) return null;
    const pts = terrainPoints;
    if (worldX <= pts[0].x) return activeCloses[0] ?? null;
    if (worldX >= pts[pts.length - 1].x) return activeCloses[activeCloses.length - 1] ?? null;

    let lo = 0, hi = pts.length - 1;
    while (hi - lo > 1) {
      const mid = (lo + hi) >> 1;
      if (pts[mid].x <= worldX) lo = mid; else hi = mid;
    }

    const leftClose = activeCloses[lo];
    const rightClose = activeCloses[hi];
    if (leftClose == null || rightClose == null) return leftClose ?? rightClose ?? null;

    const t = (worldX - pts[lo].x) / (pts[hi].x - pts[lo].x);
    return leftClose + (rightClose - leftClose) * t;
  }

  function getCloseAtScreenY(screenY) {
    const clampedY = Math.max(terrainYMin, Math.min(terrainYMax, screenY));
    const ratio = (terrainYMax - clampedY) / Math.max(1, terrainYMax - terrainYMin);
    return priceMin + ratio * (priceMax - priceMin);
  }

  function getScreenYForClose(close) {
    if (priceMax === priceMin) return (terrainYMin + terrainYMax) / 2;
    const ratio = (close - priceMin) / (priceMax - priceMin);
    return terrainYMax - ratio * (terrainYMax - terrainYMin);
  }

  /* ── 死亡 ────────────────────────────────────────── */
  function triggerDeath(lineY) {
    gameState = 'dead';
    disableWheelInput();
    updateCursorVisibility();
    for (let i = 0; i < 40; i++) {
      particles.push({
        x: canvas.width * CHAR_X_RATIO,
        y: charY,
        vx: (Math.random() - 0.5) * 6,
        vy: (Math.random() - 0.8) * 5,
        color: `hsl(${Math.random() * 30 + 0},80%,60%)`,
        size: Math.random() * 5 + 2,
        life: 60, maxLife: 60, alpha: 1
      });
    }
  }

  /* ── 粒子工廠 ────────────────────────────────────── */
  function spawnSnowflake() {
    particles.push({
      x: Math.random() * canvas.width,
      y: -5,
      vx: -currentSpeed * 0.5 + (Math.random() - 0.5),
      vy: Math.random() * 0.8 + 0.3,
      color: 'rgba(200,230,255,0.7)',
      size: Math.random() * 2 + 0.5,
      life: 200, maxLife: 200, alpha: 0.7,
      isSnow: true
    });
  }

  function spawnPartyParticles() {
    for (let i = 0; i < 80; i++) {
      particles.push({
        x: Math.random() * canvas.width,
        y: -Math.random() * canvas.height * 0.35,
        vx: (Math.random() - 0.5) * 2.2,
        vy: Math.random() * 2.8 + 1.8,
        color: `hsl(${Math.random() * 360},80%,60%)`,
        size: Math.random() * 6 + 2,
        life: 140, maxLife: 140, alpha: 1,
        angle: Math.random() * Math.PI * 2,
        spin: (Math.random() - 0.5) * 0.35
      });
    }
  }

  function spawnFallingConfetti() {
    particles.push({
      x: Math.random() * canvas.width,
      y: -12,
      vx: (Math.random() - 0.5) * 1.4,
      vy: Math.random() * 2.2 + 1.6,
      color: `hsl(${Math.random() * 360},85%,62%)`,
      size: Math.random() * 7 + 3,
      life: 150, maxLife: 150, alpha: 1,
      angle: Math.random() * Math.PI * 2,
      spin: (Math.random() - 0.5) * 0.4
    });
  }

  function updateParticles() {
    particles = particles.filter(p => p.life > 0);
    particles.forEach(p => {
      p.x += p.vx;
      p.y += p.vy;
      p.vy += p.isSnow ? 0 : 0.04;
      p.life--;
      p.alpha = p.life / p.maxLife;
      if (!p.isSnow) {
        p.angle = (p.angle || 0) + (p.spin || 0);
      }
    });
  }

  /* ══════════════════════════════════════════════════
     RENDER
  ══════════════════════════════════════════════════ */
  function render() {
    const W = canvas.width;
    const H = canvas.height;

    // ── 畫面震動計算 ──
    const dangerConfig = getPeriodConfig();
    const heatRatio = getDangerRatio();
    let shakeX = 0, shakeY = 0;
    if (heatRatio > 0.75 && gameState === 'playing') {
      const shakeAmp = (heatRatio - 0.75) * 15; // 震動幅度隨危險度增加
      shakeX = (Math.random() - 0.5) * shakeAmp;
      shakeY = (Math.random() - 0.5) * shakeAmp;
    }

    ctx.save();
    ctx.translate(shakeX, shakeY); // 套用震動

    // 背景漸層（夜間雪山）
    const bg = ctx.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0,   '#0a0f1e');
    bg.addColorStop(0.5, '#0d1829');
    bg.addColorStop(1,   '#111f35');
    ctx.fillStyle = bg;
    ctx.fillRect(-20, -20, W + 40, H + 40); // 這裡稍微畫大一點防止震動露底

    // 星星背景
    drawStars(W, H);

    // 遠景山脈
    drawMountains(W, H);

    // 地形線
    drawTerrain(W, H);

    // 粒子（雪花在後）
    drawParticles(true);

    // 角色
    if (gameState === 'countdown' || gameState === 'playing' || gameState === 'dead') {
      drawCharacter(W);
    }

    // 危險警示光暈
    if (dangerFrames > 0 && gameState === 'playing') {
      drawDangerVignette(W, H);
    }

    // 粒子（碎片在前）
    drawParticles(false);
    
    ctx.restore(); // 結束震動影響範圍

    // HUD (不隨畫面震動，保持 UI 穩定)
    if (gameState === 'playing' || gameState === 'countdown') {
      drawHUD(W, H);
    }

    // 倒數
    if (gameState === 'countdown') {
      drawCountdown(W, H);
    }

    // 結果畫面
    if (gameState === 'dead')     drawDeadScreen(W, H);
    if (gameState === 'complete') drawCompleteScreen(W, H);
  }

  /* ── 繪製工具 ────────────────────────────────────── */
  // 用 seed 讓星星位置固定
  const starPositions = (() => {
    const arr = [];
    let s = 12345;
    function rnd() { s = (s * 1664525 + 1013904223) & 0xffffffff; return (s >>> 0) / 0xffffffff; }
    for (let i = 0; i < 120; i++) arr.push({ x: rnd(), y: rnd() * 0.5, r: rnd() * 1.2 + 0.3 });
    return arr;
  })();

  function drawStars(W, H) {
    ctx.save();
    starPositions.forEach(s => {
      ctx.beginPath();
      ctx.arc(s.x * W, s.y * H, s.r, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(200,220,255,${0.4 + s.r * 0.3})`;
      ctx.fill();
    });
    ctx.restore();
  }

  function drawMountains(W, H) {
    // 遠山（深色）
    ctx.save();
    ctx.fillStyle = '#0f1e33';
    ctx.beginPath();
    ctx.moveTo(0, H * 0.55);
    [0.05,0.15,0.28,0.4,0.52,0.65,0.78,0.9,1].forEach((rx, i) => {
      const ry = i % 2 === 0 ? 0.25 : 0.38;
      ctx.lineTo(rx * W, ry * H);
    });
    ctx.lineTo(W, H * 0.55);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  function drawTerrain(W, H) {
    if (!terrainPoints.length) return;

    const charWorldX = terrainScrollX + canvas.width * CHAR_X_RATIO;
    const lineY = getLineYAt(charWorldX);
    drawReferenceGrid(W);

    // 畫地形線
    ctx.save();
    ctx.beginPath();
    let started = false;
    let firstVisibleX = Infinity;

    for (let i = 0; i < terrainPoints.length; i++) {
      const screenX = terrainPoints[i].x - terrainScrollX;
      if (screenX < -50 || screenX > W + 50) continue;
      if (!started) {
        ctx.moveTo(screenX, terrainPoints[i].y);
        firstVisibleX = screenX;
        started = true;
      } else {
        ctx.lineTo(screenX, terrainPoints[i].y);
      }
    }

    // 危險狀態下線條閃爍顏色
    const dangerRatio = getDangerRatio();
    let lineColor;
    if (dangerRatio > 0) {
      const r = Math.floor(96  + dangerRatio * 159);
      const g = Math.floor(165 - dangerRatio * 165);
      const b = Math.floor(250 - dangerRatio * 200);
      lineColor = `rgb(${r},${g},${b})`;
    } else {
      lineColor = '#60a5fa';
    }

    ctx.strokeStyle = lineColor;
    ctx.lineWidth   = 2.5;
    ctx.shadowColor = lineColor;
    ctx.shadowBlur  = 10;
    ctx.stroke();

    // 線以下填色（海洋/深淵感）
    ctx.lineTo(W + 50, H + 10);
    ctx.lineTo(firstVisibleX - 50, H + 10);
    ctx.closePath();
    const grad = ctx.createLinearGradient(0, lineY, 0, H);
    const fillA = dangerRatio > 0.3 ? 0.35 + dangerRatio * 0.2 : 0.18;
    grad.addColorStop(0, `rgba(96,165,250,${fillA})`);
    grad.addColorStop(1, 'rgba(10,20,50,0.05)');
    ctx.fillStyle = grad;
    ctx.fill();
    ctx.restore();

    // 進度標記點（日期 dots）
    drawProgressDots(W, H);
    drawCurrentPriceGuide(W);
  }

  function drawProgressDots(W, H) {
    const N = terrainPoints.length;
    const step = Math.max(1, Math.floor(N / 8));
    ctx.save();
    ctx.font = '9px Inter, sans-serif';
    ctx.textAlign = 'center';
    for (let i = 0; i < N; i += step) {
      const screenX = terrainPoints[i].x - terrainScrollX;
      if (screenX < 0 || screenX > W) continue;
      const sy = terrainPoints[i].y;
      ctx.beginPath();
      ctx.arc(screenX, sy, 3, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(100,180,255,0.6)';
      ctx.fill();
      if (activeDates[i]) {
        ctx.fillStyle = 'rgba(150,200,255,0.5)';
        ctx.fillText(activeDates[i].slice(5), screenX, sy - 8);
      }
    }
    ctx.restore();
  }

  function drawCurrentPriceGuide(W) {
    const guideY = Math.max(terrainYMin, Math.min(terrainYMax, charY));
    const currentClose = getCloseAtScreenY(guideY);
    if (currentClose == null) return;

    const priceText = currentClose.toFixed(2);
    ctx.save();

    ctx.setLineDash([7, 6]);
    ctx.strokeStyle = 'rgba(250, 204, 21, 0.72)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(0, guideY);
    ctx.lineTo(W - 86, guideY);
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.font = '700 12px JetBrains Mono, monospace';
    const textW = ctx.measureText(priceText).width;
    const labelW = Math.max(60, textW + 20);
    const labelH = 24;
    const labelX = W - labelW - 16;
    const labelY = Math.max(12, Math.min(canvas.height - labelH - 12, guideY - labelH / 2));

    ctx.fillStyle = 'rgba(15, 23, 42, 0.92)';
    ctx.strokeStyle = 'rgba(250, 204, 21, 0.95)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.roundRect(labelX, labelY, labelW, labelH, 8);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#facc15';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(priceText, labelX + labelW / 2, labelY + labelH / 2 + 0.5);

    ctx.restore();
  }

  function drawReferenceGrid(W) {
    if (priceMax <= priceMin || terrainYMax <= terrainYMin) return;

    const gridCount = 4;
    ctx.save();
    ctx.setLineDash([4, 7]);
    ctx.lineWidth = 1;
    ctx.strokeStyle = 'rgba(148, 163, 184, 0.24)';
    ctx.fillStyle = 'rgba(148, 163, 184, 0.72)';
    ctx.font = '600 10px JetBrains Mono, monospace';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';

    for (let i = 0; i < gridCount; i++) {
      const ratio = (i + 1) / (gridCount + 1);
      const close = priceMax - ratio * (priceMax - priceMin);
      const y = getScreenYForClose(close);
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(W - 16, y);
      ctx.stroke();
      ctx.fillText(close.toFixed(2), W - 20, y);
    }

    ctx.restore();
  }

  /* ══════════════════════════════════════════════════
     角色繪製 — 右向滑雪者，5 種姿態
  ══════════════════════════════════════════════════ */
  function drawCharacter(W) {
    const cx      = canvas.width * CHAR_X_RATIO;
    const cy      = charY;
    const lineY   = getLineYAt(terrainScrollX + cx);
    const DR      = getDangerRatio(); // 0~1 危險程度
    const isOffTrack = isDangerAbove || isDangerBelow;
    const t       = Date.now() / 1000;

    /* ── hitbox 框（不隨姿態旋轉）─────────────────── */
    const hh = getHitboxH();
    ctx.save();
    const hitAlpha  = 0.12 + DR * 0.28;
    // 練習模式：hitbox 邊框帶橘色提示
    const hitBorder = isOffTrack
      ? `rgba(255,${Math.floor(Math.max(0, 100 - DR*100))},${Math.floor(Math.max(0, 100 - DR*100))},0.85)`
      : practiceMode ? 'rgba(251,191,36,0.55)' : 'rgba(96,165,250,0.45)';
    ctx.strokeStyle = hitBorder;
    ctx.fillStyle   = isOffTrack
      ? `rgba(255,80,80,${hitAlpha})`
      : practiceMode ? `rgba(251,191,36,${hitAlpha * 0.8})` : `rgba(96,165,250,${hitAlpha})`;
    ctx.lineWidth   = practiceMode ? 2.5 : 2;
    ctx.beginPath();
    ctx.roundRect(cx - HITBOX_W / 2, cy - hh / 2, HITBOX_W, hh, 6);
    ctx.fill();
    ctx.stroke();

    // 虛線：hitbox 邊緣到地形線
    const edgeY = lineY > cy ? cy + hh / 2 : cy - hh / 2;
    ctx.setLineDash([3, 4]);
    ctx.strokeStyle = 'rgba(148,163,184,0.28)';
    ctx.lineWidth   = 1;
    ctx.beginPath();
    ctx.moveTo(cx, edgeY);
    ctx.lineTo(cx, lineY);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();

    /* ── 姿態計算 ────────────────────────────────── */
    // relPos: 0=線在hitbox中央, -1=線在頂端, +1=線在底端; 超出±1=出界
    const relPos = (lineY - cy) / (HITBOX_H / 2);

    // bodyAngle: 正=前傾(向右), 負=後仰(向左)
    let bodyAngle    = 0.12;  // 預設微微前傾
    let bounceY      = 0;     // 重心額外 Y 位移
    let crouchFactor = 0.45;  // 0=全站直, 1=全蹲伏
    let armAngle     = 0.05;  // 前臂向右延伸角度

    if (isDangerAbove) {
      // ★ 太高危險：強烈後仰，不斷往上彈，快要飛走！
      bodyAngle    = -0.55 + Math.sin(t * 6) * 0.2;
      bounceY      = -Math.abs(Math.sin(t * 9)) * 11;
      crouchFactor = 0.08 + Math.abs(Math.sin(t * 7)) * 0.35;
      armAngle     = -0.65 + Math.sin(t * 8) * 0.45; // 手臂亂揮
    } else if (isDangerBelow) {
      // ★ 太低危險：極端前傾，快撲地，身體顫抖！
      bodyAngle    = 0.88 + Math.sin(t * 12) * 0.13;
      bounceY      = Math.sin(t * 10) * 3.5;
      crouchFactor = 0.04;
      armAngle     = 0.95 + Math.sin(t * 11) * 0.2;
    } else if (relPos < -0.25) {
      // 略高：身體上揚、稍微後仰
      const a   = Math.min(1, (-relPos - 0.25) / 0.75);
      bodyAngle    = 0.12 - a * 0.42;
      bounceY      = Math.sin(t * 5) * a * 4.5;
      crouchFactor = 0.45 - a * 0.22;
      armAngle     = 0.05 - a * 0.38;
    } else if (relPos > 0.25) {
      // 略低：重心下壓，急速蹲伏前傾
      const a   = Math.min(1, (relPos - 0.25) / 0.75);
      bodyAngle    = 0.12 + a * 0.52;
      crouchFactor = 0.45 + a * 0.48;
      armAngle     = 0.05 + a * 0.52;
    }

    /* ── 顏色 ──────────────────────────────────────── */
    const suitTop = DR > 0.55 ? '#ef4444' : '#3b82f6';
    const suitBot = DR > 0.55 ? '#dc2626' : '#1d4ed8';
    const helmCol = DR > 0.55 ? '#b91c1c' : '#1e3a8a';
    const skinCol = '#fde68a';
    const skiCol  = '#e2e8f0';
    const skiBack = '#94a3b8';
    const poleCol = '#64748b';

    /* ── 繪製右向滑雪者 ────────────────────────────── */
    ctx.save();
    ctx.translate(cx, cy + bounceY);
    ctx.rotate(bodyAngle);

    // 相對座標（以原點為角色腰部中心）
    const headY  = -19;
    const torsoT = -10;
    const torsoB =  5 + crouchFactor * 7;
    const hipY   = torsoB;
    const skiY   = hipY + 10 + crouchFactor * 9;

    // ── 後雪杖 ──
    ctx.strokeStyle = poleCol; ctx.lineWidth = 1.8; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(-4, torsoT + 3); ctx.lineTo(-15, skiY); ctx.stroke();

    // ── 後腿 ──
    ctx.strokeStyle = suitBot; ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(-1, hipY);
    ctx.quadraticCurveTo(-2 - crouchFactor * 6, hipY + 5 + crouchFactor * 7, -7, skiY - 1);
    ctx.stroke();

    // ── 後 ski 板 ──
    ctx.strokeStyle = skiBack; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(-17, skiY); ctx.lineTo(7, skiY); ctx.stroke();

    // ── 上半身 ──
    ctx.fillStyle = suitTop;
    ctx.beginPath();
    ctx.ellipse(0, (torsoT + torsoB) / 2, 6, Math.abs(torsoB - torsoT) / 2, 0, 0, Math.PI * 2);
    ctx.fill();

    // ── 頭 ──
    ctx.fillStyle = skinCol;
    ctx.beginPath(); ctx.arc(2, headY, 7.5, 0, Math.PI * 2); ctx.fill();

    // ── 安全帽 ──
    ctx.fillStyle = helmCol;
    ctx.beginPath(); ctx.arc(2, headY - 2, 7, Math.PI, 0); ctx.fill();
    ctx.fillRect(-5, headY - 9, 16, 7);

    // ── 護目鏡（面向右，在右臉） ──
    ctx.fillStyle = '#7dd3fc';
    ctx.beginPath(); ctx.ellipse(8, headY + 0.5, 5, 3.2, -0.12, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#0ea5e9'; ctx.lineWidth = 0.8; ctx.stroke();
    // 鏡框高光
    ctx.strokeStyle = 'rgba(255,255,255,0.5)'; ctx.lineWidth = 0.5;
    ctx.beginPath(); ctx.arc(6.5, headY - 0.5, 2, -1.5, -0.5); ctx.stroke();

    // ── 前腿 ──
    ctx.strokeStyle = suitBot; ctx.lineWidth = 4.5;
    ctx.beginPath();
    ctx.moveTo(2, hipY);
    ctx.quadraticCurveTo(4 + crouchFactor * 7, hipY + 4 + crouchFactor * 8, 7, skiY - 1);
    ctx.stroke();

    // ── 前 ski 板 ──
    ctx.strokeStyle = skiCol; ctx.lineWidth = 3.5; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(-13, skiY); ctx.lineTo(15, skiY); ctx.stroke();
    // ski 翹頭
    ctx.strokeStyle = '#cbd5e1'; ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.moveTo(14, skiY); ctx.quadraticCurveTo(20, skiY - 1, 22, skiY - 7); ctx.stroke();

    // ── 前臂 ──
    const aex = 10 + Math.cos(armAngle) * 9;
    const aey = torsoT + 4 + Math.sin(armAngle) * 9;
    ctx.strokeStyle = suitTop; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(3, torsoT + 3); ctx.lineTo(aex, aey); ctx.stroke();

    // 手（小圓）
    ctx.fillStyle = skinCol;
    ctx.beginPath(); ctx.arc(aex, aey, 2.8, 0, Math.PI * 2); ctx.fill();

    // 前雪杖
    ctx.strokeStyle = poleCol; ctx.lineWidth = 1.6;
    ctx.beginPath(); ctx.moveTo(aex, aey); ctx.lineTo(aex + 7, skiY); ctx.stroke();
    // 雪杖底端圓圈
    ctx.strokeStyle = poleCol; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.arc(aex + 7, skiY, 2, 0, Math.PI * 2); ctx.stroke();

    ctx.restore();
  }

  function drawDangerVignette(W, H) {
    const ratio = getDangerRatio();
    const pulse = 0.5 + 0.5 * Math.sin(Date.now() / 80);
    const alpha = ratio * 0.45 * pulse;

    const dir = isDangerAbove ? 'top' : 'bottom';
    const grad = ctx.createLinearGradient(
      0, dir === 'top' ? 0 : H,
      0, dir === 'top' ? H * 0.4 : H * 0.6
    );
    grad.addColorStop(0, `rgba(255,50,50,${alpha})`);
    grad.addColorStop(1, 'rgba(255,50,50,0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);

    // 警告文字
    if (ratio > 0.5) {
      ctx.save();
      ctx.font = `bold ${14 + ratio * 4}px Inter, sans-serif`;
      ctx.fillStyle = `rgba(255,150,150,${ratio * pulse})`;
      ctx.textAlign = 'center';
      ctx.fillText(isDangerAbove ? '⬆ 飛太高了！往下！' : '⬇ 掉太低了！往上！', W / 2, dir === 'top' ? 60 : H - 50);
      ctx.restore();
    }
  }

  function drawParticles(snowOnly) {
    particles.forEach(p => {
      if (snowOnly !== !!p.isSnow) return;
      ctx.save();
      ctx.globalAlpha = p.alpha;
      ctx.fillStyle   = p.color;
      if (p.isSnow) {
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.translate(p.x, p.y);
        ctx.rotate(p.angle || 0);
        ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size);
      }
      ctx.restore();
    });
  }

  function drawHUD(W, H) {
    ctx.save();
    const dangerRatio = getDangerRatio();

    // 股票名稱 + 練習模式標示
    ctx.font = '600 13px Inter, sans-serif';
    ctx.fillStyle = 'rgba(148,163,184,0.9)';
    ctx.textAlign = 'left';
    let modeLabel;
    if (practiceMode) {
      const s = practiceOpts.startPct, e = practiceOpts.endPct;
      modeLabel = (s === 0 && e === 100) ? '🟡 練習模式' : `🟡 練習 ${s}%～${e}%`;
    } else {
      modeLabel = '關卡';
    }
    ctx.fillText(`⛷️  ${stockData?.symbol || ''}  ${modeLabel}`, 16, 28);

    // 分數
    ctx.font = '700 22px JetBrains Mono, monospace';
    ctx.fillStyle = '#e8f0fe';
    ctx.fillText(`${score.toString().padStart(6, '0')}`, 16, 56);

    // 評級 (S/A/B/C)
    const ratio = score / (maxPossibleScore * (surviveFrames / (surviveFrames || 1))); // 簡化評估
    let grade = 'C';
    let gradeCol = '#94a3b8';
    if (dangerFrames === 0) { grade = 'S'; gradeCol = '#fde68a'; }
    else if (dangerRatio < 0.18) { grade = 'A'; gradeCol = '#4ade80'; }
    else if (dangerRatio < 0.45) { grade = 'B'; gradeCol = '#3b82f6'; }

    ctx.font = '900 18px Inter, sans-serif';
    ctx.fillStyle = gradeCol;
    ctx.fillText(grade, 105, 54);
    ctx.font = '600 10px Inter, sans-serif';
    ctx.fillText('RANK', 105, 38);

    ctx.textAlign = 'center';
    ctx.font = '700 26px JetBrains Mono, monospace';
    ctx.fillStyle = '#e8f0fe';
    ctx.fillText(getElapsedSeconds().toFixed(2), W / 2, 34);
    ctx.font = '600 11px Inter, sans-serif';
    ctx.fillStyle = 'rgba(148,163,184,0.85)';
    ctx.fillText(`合格 ${getQualifyingSeconds().toFixed(2)}s`, W / 2, 52);

    const accelActive = (rightKeyDown || rightMouseDown) && !(leftKeyDown || leftMouseDown);
    const brakeActive = (leftKeyDown || leftMouseDown) && !(rightKeyDown || rightMouseDown);

    if (accelActive && gameState === 'playing') {
      ctx.font = '700 11px Inter, sans-serif';
      ctx.fillStyle = '#fbbf24';
      ctx.fillText('ACCEL', 150, 54);
    } else if (brakeActive && gameState === 'playing') {
      ctx.font = '700 11px Inter, sans-serif';
      ctx.fillStyle = '#fca5a5';
      ctx.fillText('BRAKE', 150, 54);
    }

    // 頂部進度群組
    const charWorldX = terrainScrollX + canvas.width * CHAR_X_RATIO;
    const totalW = terrainPoints[terrainPoints.length - 1]?.x || 1;
    const prog = Math.min(1, charWorldX / totalW);
    const topHudW = 420;
    const topHudX = W / 2 - topHudW / 2;
    const routeBarY = 74;
    const smallBarY = 112;
    const smallBarGap = 40;
    const routeBarH = 18;
    const smallBarW = 240;
    const smallBarH = 18;
    const barLabelGap = 12;
    const smallLabelW = 110;
    const smallValueW = 90;
    const smallRowX = W / 2 - (smallLabelW + barLabelGap + smallBarW + barLabelGap + smallValueW) / 2;
    const routeLabelW = 120;
    const routeValueW = 90;
    const routeRowX = W / 2 - (routeLabelW + barLabelGap + topHudW + barLabelGap + routeValueW) / 2;

    // ── 底部中央 HUD 群組 ──
    const panelCx = W / 2;
    const gaugeR = 72;
    const gx = panelCx;
    const gy = H - 122;

    // ── 準確率 / 時間條 ──
    const elapsedRatio = timeLimitSeconds > 0 ? Math.max(0, Math.min(1, getElapsedSeconds() / timeLimitSeconds)) : 0;
    const timeRatio = Math.max(0, 1 - elapsedRatio);
    const accuracyPct = getAccuracyPct();
    const accuracyBarRatio = getAccuracyBarRatio();
    
    // 進度條參數
    const hbx = smallRowX + smallLabelW + barLabelGap;
    const hbW = smallBarW;
    const hbH = smallBarH;
    const timeBarY = smallBarY;
    const hby = smallBarY + smallBarGap;

    // 路程條
    ctx.fillStyle = 'rgba(15, 23, 42, 0.88)';
    ctx.strokeStyle = 'rgba(148, 163, 184, 0.4)';
    ctx.lineWidth = 2;
    const routeBarX = routeRowX + routeLabelW + barLabelGap;
    ctx.fillRect(routeBarX, routeBarY, topHudW, routeBarH);
    ctx.strokeRect(routeBarX, routeBarY, topHudW, routeBarH);

    const routeGrad = ctx.createLinearGradient(routeBarX, 0, routeBarX + topHudW, 0);
    routeGrad.addColorStop(0, '#38bdf8');
    routeGrad.addColorStop(1, '#22c55e');
    ctx.fillStyle = routeGrad;
    ctx.fillRect(routeBarX + 2, routeBarY + 2, (topHudW - 4) * prog, routeBarH - 4);

    ctx.textAlign = 'left';
    ctx.font = '700 18px Inter, sans-serif';
    ctx.fillStyle = '#f8fafc';
    ctx.textBaseline = 'middle';
    ctx.fillText('路程進度', routeRowX, routeBarY + routeBarH / 2);

    ctx.textAlign = 'right';
    ctx.font = '700 18px JetBrains Mono, monospace';
    ctx.fillStyle = '#38bdf8';
    ctx.fillText(`${Math.floor(prog * 100)}%`, routeBarX + topHudW + barLabelGap + routeValueW, routeBarY + routeBarH / 2);

    // 時間條底框
    ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
    ctx.strokeStyle = 'rgba(148, 163, 184, 0.4)';
    ctx.lineWidth = 2;
    ctx.fillRect(hbx, timeBarY, hbW, hbH);
    ctx.strokeRect(hbx, timeBarY, hbW, hbH);

    let timeColor = '#4ade80';
    if (timeRatio <= 0.3) timeColor = '#f87171';
    else if (timeRatio <= 0.6) timeColor = '#fbbf24';

    if (timeRatio > 0.01) {
      ctx.fillStyle = timeColor;
      if (timeRatio <= 0.35) {
        ctx.shadowBlur = 18;
        ctx.shadowColor = timeColor;
      }
      ctx.fillRect(hbx + 2, timeBarY + 2, (hbW - 4) * timeRatio, hbH - 4);
      ctx.shadowBlur = 0;
    }

    ctx.textAlign = 'left';
    ctx.font = 'bold 20px Inter, sans-serif';
    ctx.fillStyle = timeRatio <= 0.3 ? '#f87171' : '#f8fafc';
    ctx.fillText('時間值', smallRowX, timeBarY + hbH / 2);

    ctx.textAlign = 'right';
    ctx.font = '700 18px JetBrains Mono, monospace';
    ctx.fillStyle = timeColor;
    ctx.fillText(`🕒 ${Math.floor(timeRatio * 100)}%`, hbx + hbW + barLabelGap + smallValueW, timeBarY + hbH / 2);

    // 準確率條底框
    ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
    ctx.strokeStyle = 'rgba(148, 163, 184, 0.4)';
    ctx.lineWidth = 2;
    ctx.fillRect(hbx, hby, hbW, hbH);
    ctx.strokeRect(hbx, hby, hbW, hbH);

    // 準確率顏色判定 (綠 -> 黃 -> 紅)
    let heatColor = '#4ade80'; // 安全綠
    if (accuracyPct <= 78) heatColor = '#f87171';      // 紅
    else if (accuracyPct <= 88) heatColor = '#fbbf24'; // 黃

    // 準確率填充進度
    if (accuracyBarRatio > 0.01) {
      ctx.fillStyle = heatColor;
      
      // 危險時增加外發光特效 (WOW effect)
      if (accuracyPct <= 82) {
        ctx.shadowBlur = 18;
        ctx.shadowColor = heatColor;
      }
      
      ctx.fillRect(hbx + 2, hby + 2, (hbW - 4) * accuracyBarRatio, hbH - 4);
      ctx.shadowBlur = 0; // 重置發光防止污染
    }

    // 準確率文字與百分比
    ctx.textAlign = 'left';
    ctx.font = 'bold 20px Inter, sans-serif';
    ctx.fillStyle = accuracyPct <= 78 ? '#f87171' : '#f8fafc';
    ctx.fillText('準確值', smallRowX, hby + hbH / 2);
    
    ctx.textAlign = 'right';
    ctx.font = '700 18px JetBrains Mono, monospace';
    ctx.fillStyle = heatColor;
    ctx.fillText(`⚡ ${accuracyPct.toFixed(0)}%`, hbx + hbW + barLabelGap + smallValueW, hby + hbH / 2);

    if (isBoosting) {
      ctx.textAlign = 'center';
      ctx.font = '700 18px Inter, sans-serif';
      ctx.fillStyle = '#fbbf24';
      ctx.shadowBlur = 14;
      ctx.shadowColor = 'rgba(251,191,36,0.85)';
      ctx.fillText('滾輪靈敏模式', panelCx, gy - gaugeR - 18);
      ctx.shadowBlur = 0;
    }

    // 外圈半圓 (速度計)
    ctx.beginPath();
    ctx.arc(gx, gy, gaugeR, Math.PI, 0);
    ctx.lineWidth = 12;
    ctx.strokeStyle = 'rgba(148, 163, 184, 0.2)'; // 弱化未使用的底圈
    ctx.stroke();

    // 速度分區顏色
    const drawArcZone = (start, end, color) => {
      ctx.beginPath();
      ctx.arc(gx, gy, gaugeR, Math.PI + start, Math.PI + end);
      ctx.strokeStyle = color;
      ctx.lineWidth = 12;
      ctx.stroke();
    };
    drawArcZone(0, Math.PI * 0.35, '#4ade80');     // 減速區
    drawArcZone(Math.PI * 0.35, Math.PI * 0.65, '#3b82f6'); // 勻速區
    drawArcZone(Math.PI * 0.65, Math.PI, '#f87171');     // 加速區

    // 指針
    const speedRatio = (currentSpeed / SCROLL_SPEED);
    const normRatio = (currentSpeed - MIN_SPEED) / (MAX_SPEED - MIN_SPEED);
    const needleAngle = Math.PI * Math.max(0, Math.min(1, normRatio));

    ctx.save();
    ctx.translate(gx, gy);
    ctx.rotate(needleAngle);
    ctx.beginPath();
    ctx.moveTo(-gaugeR + 10, 0);
    ctx.lineTo(0, -4);
    ctx.lineTo(0, 4);
    ctx.closePath();
    ctx.fillStyle = '#fff';
    ctx.shadowBlur = 14;
    ctx.shadowColor = '#fff';
    ctx.fill();
    ctx.restore();

    // 中央小點
    ctx.beginPath();
    ctx.arc(gx, gy, 6, 0, Math.PI * 2);
    ctx.fillStyle = '#94a3b8';
    ctx.fill();

    // 速度文字
    ctx.font = '700 20px JetBrains Mono, monospace';
    ctx.fillStyle = '#e8f0fe';
    ctx.textAlign = 'center';
    const kmh = Math.floor(currentSpeed * 15);
    const speedMult = playerSpeedMultiplier.toFixed(2);
    ctx.fillText(`${kmh}`, gx, gy - 18);
    ctx.font = '600 13px Inter, sans-serif';
    ctx.fillStyle = 'rgba(148,163,184,0.8)';
    ctx.fillText('VELOCITY', gx, gy + 20);

    const speedMultColor = playerSpeedMultiplier > 1 ? '#fbbf24' : playerSpeedMultiplier < 1 ? '#fca5a5' : '#93c5fd';
    ctx.font = '800 54px JetBrains Mono, monospace';
    ctx.fillStyle = speedMultColor;
    ctx.textAlign = 'center';
    ctx.shadowBlur = 20;
    ctx.shadowColor = speedMultColor;
    ctx.fillText(`${speedMult}x`, panelCx, H - 22);
    ctx.shadowBlur = 0;

    ctx.restore();
  }

  function drawCountdown(W, H) {
    ctx.save();
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillRect(0, 0, W, H);

    const label = countdownVal > 0 ? String(countdownVal) : 'GO!';
    const size  = countdownVal > 0 ? 120 : 90;
    ctx.font      = `900 ${size}px Inter, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = countdownVal > 0 ? '#f8fafc' : '#4ade80';
    ctx.shadowColor = countdownVal > 0 ? '#60a5fa' : '#4ade80';
    ctx.shadowBlur  = 30;
    ctx.fillText(label, W / 2, H / 2);

    ctx.font = '500 18px Inter, sans-serif';
    ctx.fillStyle = 'rgba(148,163,184,0.8)';
    ctx.shadowBlur = 0;
    ctx.fillText(`${stockData?.symbol} — 讓股票線穿過你的 hitbox！`, W / 2, H / 2 + 80);
    ctx.restore();
  }

  function drawResultTable(W, topY) {
    const cardW = 520;
    const rowH = 34;
    const headerH = 42;
    const cardH = headerH + rowH * 4;
    const x = W / 2 - cardW / 2;
    const y = topY;
    const labelX = x + 24;
    const valueX = x + cardW - 24;
    const rows = [
      ['穩定 / 微偏 / 有偏', `${getBandPct('perfect').toFixed(0)}% / ${getBandPct('light').toFixed(0)}% / ${getBandPct('mild').toFixed(0)}%`],
      ['中偏 / 重偏', `${getBandPct('medium').toFixed(0)}% / ${getBandPct('heavy').toFixed(0)}%`],
      ['完成 / 合格 / 提早加分', `${getElapsedSeconds().toFixed(2)}s / ${getQualifyingSeconds().toFixed(2)}s / +${earlyFinishBonus}`],
      ['連穩額外 / 最高連穩', `+${streakBonusScore} / ${getBestPerfectPct().toFixed(0)}%`],
    ];

    ctx.save();
    ctx.fillStyle = 'rgba(9, 18, 34, 0.88)';
    ctx.strokeStyle = 'rgba(96, 165, 250, 0.24)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(x, y, cardW, cardH, 18);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = 'rgba(30, 41, 59, 0.85)';
    ctx.beginPath();
    ctx.roundRect(x + 2, y + 2, cardW - 4, headerH, 16);
    ctx.fill();

    ctx.font = '700 16px Inter, sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#f8fafc';
    ctx.fillText('本局紀錄', labelX, y + headerH / 2 + 1);

    ctx.font = '600 12px Inter, sans-serif';
    ctx.textAlign = 'right';
    ctx.fillStyle = 'rgba(191, 219, 254, 0.9)';
    ctx.fillText('規則：穩定 10/12/14/16/18/20，微偏 7，有偏 5，中偏 3，重偏 1', valueX, y + headerH / 2 + 1);

    rows.forEach((row, index) => {
      const rowY = y + headerH + index * rowH;
      if (index > 0) {
        ctx.strokeStyle = 'rgba(148, 163, 184, 0.14)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(x + 16, rowY);
        ctx.lineTo(x + cardW - 16, rowY);
        ctx.stroke();
      }
      ctx.textAlign = 'left';
      ctx.font = '600 14px Inter, sans-serif';
      ctx.fillStyle = 'rgba(191, 219, 254, 0.95)';
      ctx.fillText(row[0], labelX, rowY + rowH / 2);

      ctx.textAlign = 'right';
      ctx.font = '700 15px JetBrains Mono, monospace';
      ctx.fillStyle = '#e2e8f0';
      ctx.fillText(row[1], valueX, rowY + rowH / 2);
    });
    ctx.restore();

    return y + cardH;
  }

  function drawResultButtons(W, y, retryLabel) {
    const btnW = 150;
    const btnH = 46;
    const gap = 18;
    const totalW = btnW * 2 + gap;
    const startX = W / 2 - totalW / 2;
    const labels = [
      { text: retryLabel, x: startX, colorA: '#1d4ed8', colorB: '#0891b2', border: 'rgba(147,197,253,0.7)' },
      { text: '離開', x: startX + btnW + gap, colorA: '#1e293b', colorB: '#334155', border: 'rgba(148,163,184,0.45)' },
    ];
    resultButtonRects = {
      retry: { x: startX, y, w: btnW, h: btnH },
      exit: { x: startX + btnW + gap, y, w: btnW, h: btnH },
    };

    ctx.save();
    labels.forEach((btn) => {
      const grad = ctx.createLinearGradient(btn.x, y, btn.x + btnW, y + btnH);
      grad.addColorStop(0, btn.colorA);
      grad.addColorStop(1, btn.colorB);
      ctx.fillStyle = grad;
      ctx.strokeStyle = btn.border;
      ctx.lineWidth = 2;
      ctx.shadowBlur = 18;
      ctx.shadowColor = btn.colorA;
      ctx.beginPath();
      ctx.roundRect(btn.x, y, btnW, btnH, 14);
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.stroke();
      ctx.fillStyle = '#f8fafc';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.font = '700 18px Inter, sans-serif';
      ctx.fillText(btn.text, btn.x + btnW / 2, y + btnH / 2 + 1);
    });
    ctx.restore();
  }

  function drawDeadScreen(W, H) {
    resultButtonRects = null;
    ctx.save();
    ctx.fillStyle = 'rgba(0,0,0,0.72)';
    ctx.fillRect(0, 0, W, H);

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    const centerY = H / 2 - 36;

    // 標題
    ctx.font      = '900 56px Inter, sans-serif';
    ctx.fillStyle = '#f87171';
    ctx.shadowColor = '#f87171';
    ctx.shadowBlur  = 20;
    ctx.fillText(getElapsedSeconds() > timeLimitSeconds ? '⏰ 超時了！' : '💥 出界了！', W / 2, centerY - 52);

    // 分數
    ctx.font = '700 32px JetBrains Mono, monospace';
    ctx.fillStyle = '#e8f0fe';
    ctx.shadowBlur = 0;
    ctx.fillText(`得分：${getFinalScore()}`, W / 2, centerY + 18);

    if (mouseOnlyRun) {
      ctx.font = '700 16px Inter, sans-serif';
      ctx.fillStyle = '#4ade80';
      ctx.fillText('純滑鼠操作獎勵 1.3x', W / 2, centerY + 50);
    }
    const tableBottom = drawResultTable(W, centerY + 82);

    // 方向提示
    const tip = getElapsedSeconds() > timeLimitSeconds
      ? '速度不夠快——下次多利用加速把通關時間壓進 80% 內'
      : isDangerAbove ? '飛太高了——下次試試往下一點 🖱️↓' : '掉太低了——下次試試往上一點 🖱️↑';
    ctx.font = '400 16px Inter, sans-serif';
    ctx.fillStyle = 'rgba(148,163,184,0.8)';
    ctx.fillText(tip, W / 2, tableBottom + 30);
    drawResultButtons(W, tableBottom + 56, '重試');

    ctx.restore();
  }

  function drawCompleteScreen(W, H) {
    resultButtonRects = null;
    ctx.save();
    ctx.fillStyle = 'rgba(0,0,0,0.7)';
    ctx.fillRect(0, 0, W, H);

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    const centerY = H / 2 - 52;

    ctx.font      = '900 52px Inter, sans-serif';
    ctx.fillStyle = '#4ade80';
    ctx.shadowColor = '#4ade80';
    ctx.shadowBlur  = 25;
    ctx.fillText('🏆 關卡完成！', W / 2, centerY - 34);

    ctx.font = '700 32px JetBrains Mono, monospace';
    ctx.fillStyle = '#fde68a';
    ctx.shadowBlur = 0;
    ctx.fillText(`最終得分：${getFinalScore()}`, W / 2, centerY + 34);

    if (mouseOnlyRun) {
      ctx.font = '700 16px Inter, sans-serif';
      ctx.fillStyle = '#4ade80';
      ctx.fillText('純滑鼠操作獎勵 1.3x', W / 2, centerY + 66);
    }

    // 星星系統
    const stars = getEarnedStars();

    ctx.font = '40px Inter, sans-serif';
    let starStr = '';
    for(let i=0; i<3; i++) starStr += (i < stars ? '⭐' : '☆');
    ctx.fillText(starStr, W / 2, centerY + 102);

    ctx.font = '400 16px Inter, sans-serif';
    ctx.fillStyle = 'rgba(148,163,184,0.8)';
    ctx.fillText(`評價：${stars === 3 ? '完美滑行！' : stars === 2 ? '技術湛！' : '還有進步空間'}`, W / 2, centerY + 146);
    const tableBottom = drawResultTable(W, centerY + 178);
    drawResultButtons(W, tableBottom + 26, '再玩一次');

    ctx.restore();
  }

})();
