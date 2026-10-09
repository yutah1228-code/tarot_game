"use strict";

import {
  getCard
} from "./cards.js";

import {
  createInitialBattleState,
  resolveBattle,
  advanceRound
} from "./battle.js";

import {
  applyMatchResult,
  renderRating
} from "./rating.js";

import {
  $,
  renderLife,
  renderHand,
  showPlayedCard,
  resetPlayedCard,
  renderRules,
  setupRulesDialog
} from "./ui.js";

let state = createInitialBattleState();
let locked = false;
let selectedCardNumber = null;
let cpuMatchId = crypto.randomUUID();

function randomCpuCard() {
  const cards = state.player2.cards;
  const index = Math.floor(
    Math.random() * cards.length
  );

  return cards[index];
}

function render() {
  renderLife(
    "playerLife",
    state.player1.life
  );

  renderLife(
    "cpuLife",
    state.player2.life
  );

  $("roundNumber").textContent =
    state.round;

  renderHand({
    elementId: "playerHand",
    cards: state.player1.cards,
    bonus: state.player1.bonus,
    disabled: locked || state.gameOver,
    onSelect: handleCardSelection
  });
}

function handleCardSelection(cardNumber) {
  if (locked || state.gameOver) return;

  if (window.matchMedia("(hover: none)").matches) {
    openCardConfirm(cardNumber);
  } else {
    playRound(cardNumber);
  }
}

function playRound(playerCard) {
  if (locked || state.gameOver) return;

  locked = true;

  const cpuCard = randomCpuCard();

  const result = resolveBattle(
    state,
    playerCard,
    cpuCard
  );

  state = result.state;
  if (result.state.gameOver) {
  const playerWon =
    result.state.winner === "player1";

  const upsetWin =
    playerWon &&
    result.outcome.instant === true &&
    playerCard === 1 &&
    cpuCard === 10;

  const ratingResult =
    applyMatchResult({
      matchId: cpuMatchId,
      won: playerWon,
      upsetWin
    });

  renderRating();

  if (ratingResult.updated) {
    const ratingChangeElement =
      document.getElementById(
        "ratingChange"
      );

    if (ratingChangeElement) {
      const sign =
        ratingResult.change > 0 ? "+" : "";

      ratingChangeElement.hidden = false;
      ratingChangeElement.textContent =
        `レート ${sign}${ratingResult.change}`;
    }
  }
}

  showPlayedCard(
    "playerPlayed",
    playerCard
  );

  showPlayedCard(
    "cpuPlayed",
    cpuCard
  );

  finishRound(result.outcome);
}

function finishRound(outcome) {
  let title = outcome.title;
  let text = outcome.text;

  if (state.gameOver) {
    const playerWon =
      state.winner === "player1";

    title = playerWon
      ? "あなたの勝利！"
      : "CPUの勝利";

    if (!outcome.instant) {
      text = playerWon
        ? "CPUのライフをすべて削りました。"
        : "あなたのライフが尽きました。";
    }
  } else if (outcome.refilled) {
    text += " 手札をすべて補充しました。";
  }

  $("resultTitle").textContent = title;
  $("resultText").textContent = text;
  $("nextButton").hidden = state.gameOver;

  render();
}

function nextRound() {
  if (state.gameOver) return;

  state = advanceRound(state);
  locked = false;

  $("nextButton").hidden = true;
  $("resultTitle").textContent =
    "次のカードを選んでください";

  $("resultText").textContent =
    "使用済みのカードは暗く表示されます。";

  resetPlayedCard(
    "cpuPlayed",
    "CPUのカード"
  );

  resetPlayedCard(
    "playerPlayed",
    "あなたのカード"
  );

  render();
}

function resetGame() {
  cpuMatchId = crypto.randomUUID();
  state = createInitialBattleState();
  locked = false;
  selectedCardNumber = null;

  $("nextButton").hidden = true;

  $("resultTitle").textContent =
    "カードを選んでください";

  $("resultText").textContent =
    "カード能力を使って勝利を目指してください。";

  resetPlayedCard(
    "cpuPlayed",
    "CPUのカード"
  );

  resetPlayedCard(
    "playerPlayed",
    "あなたのカード"
  );

  const ratingChangeElement =
    document.getElementById(
      "ratingChange"
    );

  if (ratingChangeElement) {
    ratingChangeElement.hidden = true;
    ratingChangeElement.textContent = "";
  }

  renderRating();
  render();
}

const confirmDialog =
  $("cardConfirmDialog");

const cancelCardButton =
  $("cancelCardButton");

const playCardButton =
  $("playCardButton");

function openCardConfirm(cardNumber) {
  const card = getCard(cardNumber);

  selectedCardNumber = cardNumber;

  $("confirmCardNumber").textContent =
    card.number;

  $("confirmCardSymbol").textContent =
    card.symbol;

  $("confirmCardName").textContent =
    card.name;

  $("confirmCardEffect").textContent =
    card.effect;

  confirmDialog.showModal();
}

function closeCardConfirm() {
  if (confirmDialog.open) {
    confirmDialog.close();
  }

  selectedCardNumber = null;
}

cancelCardButton.addEventListener(
  "click",
  closeCardConfirm
);

playCardButton.addEventListener(
  "click",
  () => {
    if (selectedCardNumber === null) return;

    const cardNumber = selectedCardNumber;

    closeCardConfirm();
    playRound(cardNumber);
  }
);

confirmDialog.addEventListener(
  "cancel",
  event => {
    event.preventDefault();
    closeCardConfirm();
  }
);

$("nextButton").addEventListener(
  "click",
  nextRound
);

// ゲームをやり直す
$("resetButton").addEventListener(
  "click",
  resetGame
);


// ルール一覧を生成
renderRules();

// ルールダイアログを有効化
setupRulesDialog();




// ゲーム開始
resetGame();