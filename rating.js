"use strict";

const STORAGE_KEY = "vivant-rating-data-v1";

const DEFAULT_DATA = {
  rating: 0,
  wins: 0,
  losses: 0,
  upsetWins: 0,
  unlockedBadges: [],
  processedMatches: []
};

function normalizeData(value) {
  return {
    ...DEFAULT_DATA,
    ...value,

    rating: Number.isFinite(value?.rating)
      ? Math.max(0, Math.min(1500, value.rating))
      : 0,

    wins: Number.isFinite(value?.wins)
      ? Math.max(0, value.wins)
      : 0,

    losses: Number.isFinite(value?.losses)
      ? Math.max(0, value.losses)
      : 0,

    upsetWins: Number.isFinite(value?.upsetWins)
      ? Math.max(0, value.upsetWins)
      : 0,

    unlockedBadges: Array.isArray(
      value?.unlockedBadges
    )
      ? value.unlockedBadges
      : [],

    processedMatches: Array.isArray(
      value?.processedMatches
    )
      ? value.processedMatches
      : []
  };
}

export function loadRatingData() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);

    if (!saved) {
      return { ...DEFAULT_DATA };
    }

    return normalizeData(JSON.parse(saved));
  } catch (error) {
    console.warn(
      "レートデータを読み込めませんでした:",
      error
    );

    return { ...DEFAULT_DATA };
  }
}

function saveRatingData(data) {
  const normalized = normalizeData(data);

  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify(normalized)
  );

  return normalized;
}

export function getRankBadge(rating) {
  if (rating >= 1001) {
    return {
      id: "gold",
      name: "ゴールド",
      symbol: "🥇"
    };
  }

  if (rating >= 501) {
    return {
      id: "silver",
      name: "シルバー",
      symbol: "🥈"
    };
  }

  return {
    id: "bronze",
    name: "ブロンズ",
    symbol: "🥉"
  };
}

function getLossAmount(rating) {
  if (rating >= 1001) {
    return 30;
  }

  if (rating >= 501) {
    return 20;
  }

  return 10;
}

function unlockAchievementBadges(data) {
  const unlocked = new Set(data.unlockedBadges);

  if (data.upsetWins >= 1) {
    unlocked.add("upset_beginner");
  }

  if (data.upsetWins >= 5) {
    unlocked.add("upset_intermediate");
  }

  data.unlockedBadges = [...unlocked];
}

export function getAchievementBadges(data) {
  const badgeDefinitions = {
    upset_beginner: {
      id: "upset_beginner",
      name: "下剋上初心者",
      symbol: "⚔️",
      description:
        "奴隷で王を1回倒した"
    },

    upset_intermediate: {
      id: "upset_intermediate",
      name: "下剋上中級者",
      symbol: "🔥",
      description:
        "奴隷で王を5回倒した"
    }
  };

  return data.unlockedBadges
    .map(id => badgeDefinitions[id])
    .filter(Boolean);
}

export function applyMatchResult({
  matchId,
  won,
  upsetWin = false
}) {
  const data = loadRatingData();

  if (!matchId) {
    throw new Error(
      "レート更新にはmatchIdが必要です。"
    );
  }

  /*
   * onSnapshotや再描画による
   * 同一試合の二重加算を防止
   */
  if (data.processedMatches.includes(matchId)) {
    return {
      updated: false,
      change: 0,
      data
    };
  }

  const previousRating = data.rating;
  let change;

  if (won) {
    change = 30;
    data.wins++;
  } else {
    change = -getLossAmount(previousRating);
    data.losses++;
  }

  data.rating = Math.max(
    0,
    Math.min(1500, previousRating + change)
  );

  /*
   * 上限・下限で実際に変化した値へ補正
   */
  change = data.rating - previousRating;

  if (upsetWin) {
    data.upsetWins++;
  }

  unlockAchievementBadges(data);

  data.processedMatches.push(matchId);

  /*
   * 保存データが増え続けないよう、
   * 最新100試合だけ保持
   */
  data.processedMatches =
    data.processedMatches.slice(-100);

  const savedData = saveRatingData(data);

  return {
    updated: true,
    change,
    previousRating,
    data: savedData
  };
}

export function renderRating(elementIds = {}) {
  const {
    ratingId = "playerRating",
    rankId = "playerRank",
    badgesId = "playerBadges",
    recordId = "playerRecord"
  } = elementIds;

  const data = loadRatingData();
  const rank = getRankBadge(data.rating);
  const achievements =
    getAchievementBadges(data);

  const ratingElement =
    document.getElementById(ratingId);

  const rankElement =
    document.getElementById(rankId);

  const badgesElement =
    document.getElementById(badgesId);

  const recordElement =
    document.getElementById(recordId);

  if (ratingElement) {
    ratingElement.textContent =
      String(data.rating);
  }

  if (rankElement) {
    rankElement.textContent =
      `${rank.symbol} ${rank.name}`;
  }

  if (recordElement) {
    recordElement.textContent =
      `${data.wins}勝 ${data.losses}敗`;
  }

  if (badgesElement) {
    if (achievements.length === 0) {
      badgesElement.innerHTML =
        `<span class="empty-badge">実績バッジなし</span>`;

      return;
    }

    badgesElement.innerHTML =
      achievements
        .map(
          badge => `
            <span
              class="achievement-badge"
              title="${badge.description}"
            >
              ${badge.symbol} ${badge.name}
            </span>
          `
        )
        .join("");
  }
}