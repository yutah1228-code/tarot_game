"use strict";

const CARD_DATA = [
  { number: 1, name: "奴隷", symbol: "☽", effect: "王と対決すると、残りライフに関係なく即時勝利" },
  { number: 2,
    name: "女教皇",
    symbol: "☾",
    effect: "相手が偶数なら、相手より強さが1高くなる"},
  { number: 3, name: "女帝", symbol: "✿", effect: "この勝負を引き分けにする" },
  { number: 4, name: "皇帝", symbol: "♜", effect: "相手による数値変更の影響を受けない" },
  { number: 5, name: "教皇", symbol: "✚", effect: "相手が自分より強い場合、両者の強さを入れ替える" },
  { number: 6, name: "恋人", symbol: "♡", effect: "勝利したらライフを1回復" },
  { number: 7, name: "戦車", symbol: "♞", effect: "勝利すると相手に追加で1ダメージ（合計2）" },
  {
    number: 8,
    name: "正義",
    symbol: "⚖",
    effect: "勝利すると次回以降のカードを永久的に+1する"
  },
  { number: 9, name: "隠者", symbol: "✦", effect: "敗北しても受けるダメージを1回だけ無効化する" },
  {
    number: 10,
    name: "王",
    symbol: "♛",
    effect: "勝利すると相手の未使用カードをランダムに1枚捨てさせる。ただし奴隷には即時敗北"
  }
];

const state = {
  playerLife: 5,
  cpuLife: 5,

  playerCards: [],
  cpuCards: [],

  // 正義による永久強化
  playerBonus: 0,
  cpuBonus: 0,

  // 隠者の能力を使用したか
  playerHermitUsed: false,
  cpuHermitUsed: false,

  round: 1,
  locked: false,
  gameOver: false
};
const $ = (id) => document.getElementById(id);

function resetGame() {
  Object.assign(state, {
    playerLife: 5,
    cpuLife: 5,

    playerCards: CARD_DATA.map(card => card.number),
    cpuCards: CARD_DATA.map(card => card.number),

    playerBonus: 0,
    cpuBonus: 0,

    playerHermitUsed: false,
    cpuHermitUsed: false,

    round: 1,
    locked: false,
    gameOver: false
  });

  $("resultTitle").textContent = "カードを選んでください";
  $("resultText").textContent =
    "両者がカードを1枚ずつ公開します。カード能力を使って勝利を目指してください。";

  $("nextButton").hidden = true;

  resetPlayedCards();
  render();
}

function render() {
  renderLife("playerLife", state.playerLife);
  renderLife("cpuLife", state.cpuLife);
  $("roundNumber").textContent = state.round;
  $("playerHand").innerHTML = CARD_DATA.map(card => `
  <button
    class="card"
    data-number="${card.number}"
    ${!state.playerCards.includes(card.number) || state.locked || state.gameOver ? "disabled" : ""}
    aria-label="${card.number} ${card.name}: ${card.effect}"
  >
    <span class="card-content">
      <span class="card-number">
  ${card.number}
  ${state.playerBonus > 0 ? `<small>+${state.playerBonus}</small>` : ""}
</span>
      <span class="card-symbol">${card.symbol}</span>
      <span class="card-name">${card.name}</span>
    </span>

    <span class="card-effect" aria-hidden="true">
      ${card.effect}
    </span>
  </button>
`).join("");
  document.querySelectorAll(".card:not(:disabled)").forEach(button => {
  button.addEventListener("click", () => {
    const cardNumber = Number(button.dataset.number);

    // タッチ操作の端末では確認画面を表示
    if (window.matchMedia("(hover: none)").matches) {
      openCardConfirm(cardNumber);
    } else {
      // PCはクリックですぐカードを出す
      playRound(cardNumber);
    }
  });
});
}

function renderLife(id, life) {
  $(id).innerHTML = [1, 2, 3 ,4 ,5].map(i => `<span class="heart ${i > life ? "lost" : ""}" aria-hidden="true">♥</span>`).join("");
}

function getCard(number) { return CARD_DATA.find(card => card.number === number); }
function randomCpuCard() { return state.cpuCards[Math.floor(Math.random() * state.cpuCards.length)]; }

function playRound(playerNumber) {
  if (state.locked || state.gameOver) return;
  state.locked = true;
  const cpuNumber = randomCpuCard();
  state.playerCards = state.playerCards.filter(n => n !== playerNumber);
  state.cpuCards = state.cpuCards.filter(n => n !== cpuNumber);
  showPlayedCard("playerPlayed", getCard(playerNumber));
  showPlayedCard("cpuPlayed", getCard(cpuNumber));
  const outcome = resolveBattle(playerNumber, cpuNumber);
  finishRound(outcome, playerNumber, cpuNumber);
}

function resolveBattle(player, cpu) {
  const messages = [];

  /*
   * 1 奴隷
   * 王との対決では即時勝利
   */
  if (
    (player === 1 && cpu === 10) ||
    (player === 10 && cpu === 1)
  ) {
    return {
      instant: true,
      winner: player === 1 ? "player" : "cpu",
      title: "下剋上！",
      text: "奴隷が王を討ち倒しました。残りライフに関係なく即時勝利です。"
    };
  }

  /*
   * 3 女帝
   * 無条件で引き分け
   */
  if (player === 3 || cpu === 3) {
    return {
      winner: "draw",
      title: "女帝の停戦",
      text: "女帝の力によって、この勝負は引き分けになりました。"
    };
  }

  /*
   * 正義による永久強化を適用
   */
  let playerPower = player + state.playerBonus;
  let cpuPower = cpu + state.cpuBonus;

  if (state.playerBonus > 0) {
    messages.push(`あなたのカードは正義の力で+${state.playerBonus}`);
  }

  if (state.cpuBonus > 0) {
    messages.push(`CPUのカードは正義の力で+${state.cpuBonus}`);
  }

  /*
   * 2 女教皇
   * 相手の元のカード番号が偶数なら、
   * 相手の現在の強さより1高くなる
   */
  if (player === 2 && cpu % 2 === 0) {
    playerPower = cpuPower + 1;
    messages.push(`あなたの女教皇が未来を読み、強さ${playerPower}`);
  }

  if (cpu === 2 && player % 2 === 0) {
    cpuPower = playerPower + 1;
    messages.push(`CPUの女教皇が未来を読み、強さ${cpuPower}`);
  }

  /*
   * 5 教皇
   * 相手のほうが強ければ、両者の強さを入れ替える
   *
   * 4 皇帝は相手による数値変更を受けないため、
   * 皇帝が相手の場合は入れ替え失敗
   */
  if (player === 5 && cpuPower > playerPower) {
    if (cpu === 4) {
      messages.push("CPUの皇帝が教皇の強さ入れ替えを無効化");
    } else {
      [playerPower, cpuPower] = [cpuPower, playerPower];
      messages.push("あなたの教皇が両者の強さを入れ替えた");
    }
  }

  if (cpu === 5 && playerPower > cpuPower) {
    if (player === 4) {
      messages.push("あなたの皇帝が教皇の強さ入れ替えを無効化");
    } else {
      [playerPower, cpuPower] = [cpuPower, playerPower];
      messages.push("CPUの教皇が両者の強さを入れ替えた");
    }
  }

  /*
   * 数値が同じなら引き分け
   */
  if (playerPower === cpuPower) {
    return {
      winner: "draw",
      title: "引き分け",
      text: [
        ...messages,
        `両者の最終的な強さは${playerPower}。ダメージは発生しません。`
      ].join("。")
    };
  }

  const winner = playerPower > cpuPower ? "player" : "cpu";
  const loser = winner === "player" ? "cpu" : "player";

  const winnerCard = winner === "player" ? player : cpu;
  const loserCard = loser === "player" ? player : cpu;

  let damage = winnerCard === 7 ? 2 : 1;
  let hermitActivated = false;

  /*
   * 9 隠者
   * 敗北時のダメージをゲーム中1回だけ無効化
   */
  if (loserCard === 9) {
    if (loser === "player" && !state.playerHermitUsed) {
      state.playerHermitUsed = true;
      damage = 0;
      hermitActivated = true;
      messages.push("あなたの隠者がダメージを無効化");
    }

    if (loser === "cpu" && !state.cpuHermitUsed) {
      state.cpuHermitUsed = true;
      damage = 0;
      hermitActivated = true;
      messages.push("CPUの隠者がダメージを無効化");
    }
  }

  /*
   * ダメージ処理
   */
  if (winner === "player") {
    state.cpuLife = Math.max(0, state.cpuLife - damage);
  } else {
    state.playerLife = Math.max(0, state.playerLife - damage);
  }

  if (winnerCard === 7 && !hermitActivated) {
    messages.push("戦車の突撃で2ダメージ");
  } else if (!hermitActivated) {
    messages.push(`${damage}ダメージ`);
  }

  /*
   * 6 恋人
   * 勝利すると自分のライフを1回復
   */
  if (winnerCard === 6) {
    if (winner === "player") {
      const before = state.playerLife;
      state.playerLife = Math.min(5, state.playerLife + 1);

      if (state.playerLife > before) {
        messages.push("恋人の祝福であなたのライフが1回復");
      } else {
        messages.push("あなたのライフはすでに最大");
      }
    } else {
      const before = state.cpuLife;
      state.cpuLife = Math.min(5, state.cpuLife + 1);

      if (state.cpuLife > before) {
        messages.push("恋人の祝福でCPUのライフが1回復");
      } else {
        messages.push("CPUのライフはすでに最大");
      }
    }
  }

  /*
   * 8 正義
   * 勝利すると以降のカードを永久的に+1
   */
  if (winnerCard === 8) {
    if (winner === "player") {
      state.playerBonus++;
      messages.push(
        `正義の力で、あなたの今後のカードが永久に+${state.playerBonus}`
      );
    } else {
      state.cpuBonus++;
      messages.push(
        `正義の力で、CPUの今後のカードが永久に+${state.cpuBonus}`
      );
    }
  }

  /*
   * 10 王
   * 勝利すると相手の未使用カードを1枚捨てる
   */
  if (winnerCard === 10) {
    const discardedCard = discardRandomCard(loser);

    if (discardedCard) {
      messages.push(
        `王の命令で${discardedCard.name}が手札から捨てられた`
      );
    } else {
      messages.push("捨てられるカードが残っていなかった");
    }
  }

  const who = winner === "player" ? "あなた" : "CPU";

  return {
    winner,
    title: `${who}の勝利`,
    text: messages.join("。") + "。"
  };
}

function discardRandomCard(target) {
  const cards =
    target === "player"
      ? state.playerCards
      : state.cpuCards;

  if (cards.length === 0) {
    return null;
  }

  const randomIndex = Math.floor(Math.random() * cards.length);
  const [discardedNumber] = cards.splice(randomIndex, 1);

  return getCard(discardedNumber);
}



function finishRound(outcome, player, cpu) {
  $("resultTitle").textContent = outcome.title;
  $("resultText").textContent = outcome.text;

  if (outcome.instant || state.playerLife <= 0 || state.cpuLife <= 0) {
    state.gameOver = true;
    const playerWon = outcome.instant ? outcome.winner === "player" : state.cpuLife <= 0;
    $("resultTitle").textContent = playerWon ? "あなたの勝利！" : "CPUの勝利";
    $("resultText").textContent = outcome.instant ? outcome.text : playerWon ? "相手のライフをすべて削りました。" : "あなたのライフが尽きました。もう一度挑戦しましょう。";
  } else if (!state.playerCards.length || !state.cpuCards.length) {
    state.playerCards = CARD_DATA.map(c => c.number);
    state.cpuCards = CARD_DATA.map(c => c.number);
    $("resultText").textContent += " 手札をすべて補充します。";
    $("nextButton").hidden = false;
  } else {
    $("nextButton").hidden = false;
  }
  render();
}

function showPlayedCard(id, card) {
  const element = $(id);
  element.className = "played-card revealed";
  element.innerHTML = `<div><div class="number">${card.number}</div><div class="symbol">${card.symbol}</div><div class="name">${card.name}</div></div>`;
}

function resetPlayedCards() {
  $("cpuPlayed").className = $("playerPlayed").className = "played-card";
  $("cpuPlayed").innerHTML = "<span>CPUのカード</span>";
  $("playerPlayed").innerHTML = "<span>あなたのカード</span>";
}

function nextRound() {
  if (state.gameOver) return;
  state.round++;
  state.locked = false;
  $("nextButton").hidden = true;
  $("resultTitle").textContent = "次のカードを選んでください";
  $("resultText").textContent = "使用済みのカードは暗く表示されます。";
  resetPlayedCards();
  render();
}

$("nextButton").addEventListener("click", nextRound);
$("resetButton").addEventListener("click", resetGame);
const rulesButton = $("rulesButton");
const rulesDialog = $("rulesDialog");
const closeRulesButton = $("closeRules");

function openRules() {
  rulesButton.setAttribute("aria-expanded", "true");

  // dialogに対応しているブラウザ
  if (typeof rulesDialog.showModal === "function") {
    if (!rulesDialog.open) {
      rulesDialog.showModal();
    }
  } else {
    // 古いブラウザ向け
    rulesDialog.setAttribute("open", "");
    rulesDialog.classList.add("dialog-fallback");
  }

  closeRulesButton.focus();
}

function closeRules() {
  rulesButton.setAttribute("aria-expanded", "false");

  if (typeof rulesDialog.close === "function" && rulesDialog.open) {
    rulesDialog.close();
  } else {
    rulesDialog.removeAttribute("open");
  }

  rulesDialog.classList.remove("dialog-fallback");
  rulesButton.focus();
}

rulesButton.setAttribute("aria-haspopup", "dialog");
rulesButton.setAttribute("aria-expanded", "false");

rulesButton.addEventListener("click", openRules);
closeRulesButton.addEventListener("click", closeRules);

// Escキーで閉じる
rulesDialog.addEventListener("cancel", event => {
  event.preventDefault();
  closeRules();
});

// モーダルの背景部分をクリックして閉じる
rulesDialog.addEventListener("click", event => {
  if (event.target === rulesDialog) {
    closeRules();
  }
});
$("rulesList").innerHTML = CARD_DATA.map(c => `<div class="rule"><strong>${c.number}｜${c.name}</strong><small>${c.effect}</small></div>`).join("");
resetGame();

const cardConfirmDialog = $("cardConfirmDialog");
const cancelCardButton = $("cancelCardButton");
const playCardButton = $("playCardButton");

let selectedCardNumber = null;

function openCardConfirm(cardNumber) {
  if (state.locked || state.gameOver) return;
  if (!state.playerCards.includes(cardNumber)) return;

  const card = getCard(cardNumber);
  selectedCardNumber = cardNumber;

  $("confirmCardNumber").textContent = card.number;
  $("confirmCardSymbol").textContent = card.symbol;
  $("confirmCardName").textContent = card.name;
  $("confirmCardEffect").textContent = card.effect;

  if (typeof cardConfirmDialog.showModal === "function") {
    if (!cardConfirmDialog.open) {
      cardConfirmDialog.showModal();
    }
  } else {
    cardConfirmDialog.setAttribute("open", "");
    cardConfirmDialog.classList.add("dialog-fallback");
  }

  playCardButton.focus();
}

function closeCardConfirm() {
  if (typeof cardConfirmDialog.close === "function" &&
      cardConfirmDialog.open) {
    cardConfirmDialog.close();
  } else {
    cardConfirmDialog.removeAttribute("open");
  }

  cardConfirmDialog.classList.remove("dialog-fallback");
  selectedCardNumber = null;
}

cancelCardButton.addEventListener("click", closeCardConfirm);

playCardButton.addEventListener("click", () => {
  if (selectedCardNumber === null) return;

  const cardNumber = selectedCardNumber;
  closeCardConfirm();
  playRound(cardNumber);
});

cardConfirmDialog.addEventListener("cancel", event => {
  event.preventDefault();
  closeCardConfirm();
});

cardConfirmDialog.addEventListener("click", event => {
  if (event.target === cardConfirmDialog) {
    closeCardConfirm();
  }
});