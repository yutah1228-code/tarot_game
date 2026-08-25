"use strict";

import {
  MAX_LIFE,
  createFullHand,
  getCard
} from "./cards.js";

export function createInitialBattleState() {
  return {
    player1: {
      life: MAX_LIFE,
      cards: createFullHand(),
      bonus: 0,
      hermitUsed: false
    },

    player2: {
      life: MAX_LIFE,
      cards: createFullHand(),
      bonus: 0,
      hermitUsed: false
    },

    round: 1,
    gameOver: false,
    winner: null
  };
}

function cloneState(state) {
  return structuredClone(state);
}

function removeCard(cards, cardNumber) {
  return cards.filter(number => number !== cardNumber);
}

function discardRandomCard(player, random = Math.random) {
  if (player.cards.length === 0) {
    return null;
  }

  const index = Math.floor(random() * player.cards.length);
  const [discardedNumber] = player.cards.splice(index, 1);

  return getCard(discardedNumber);
}

function refillHandsIfNeeded(state) {
  if (
    state.player1.cards.length === 0 ||
    state.player2.cards.length === 0
  ) {
    state.player1.cards = createFullHand();
    state.player2.cards = createFullHand();

    return true;
  }

  return false;
}

export function resolveBattle(
  currentState,
  player1Card,
  player2Card,
  random = Math.random
) {
  const state = cloneState(currentState);
  const messages = [];

  if (state.gameOver) {
    throw new Error("すでに対戦が終了しています。");
  }

  if (!state.player1.cards.includes(player1Card)) {
    throw new Error("プレイヤー1はそのカードを使用できません。");
  }

  if (!state.player2.cards.includes(player2Card)) {
    throw new Error("プレイヤー2はそのカードを使用できません。");
  }

  // 使用したカードを手札から取り除く
  state.player1.cards = removeCard(
    state.player1.cards,
    player1Card
  );

  state.player2.cards = removeCard(
    state.player2.cards,
    player2Card
  );

  /*
   * 1 奴隷
   */
  if (
    (player1Card === 1 && player2Card === 10) ||
    (player1Card === 10 && player2Card === 1)
  ) {
    const winner =
      player1Card === 1 ? "player1" : "player2";

    state.gameOver = true;
    state.winner = winner;

    return {
      state,
      outcome: {
        instant: true,
        winner,
        title: "下剋上！",
        text:
          "奴隷が王を討ち倒しました。残りライフに関係なく即時勝利です。",
        player1Card,
        player2Card
      }
    };
  }

  /*
   * 3 女帝
   */
  if (player1Card === 3 || player2Card === 3) {
    const refilled = refillHandsIfNeeded(state);

    return {
      state,
      outcome: {
        winner: "draw",
        title: "女帝の停戦",
        text:
          "女帝の力によって、この勝負は引き分けになりました。",
        player1Card,
        player2Card,
        refilled
      }
    };
  }

  /*
   * 正義の永久強化
   */
  let player1Power =
    player1Card + state.player1.bonus;

  let player2Power =
    player2Card + state.player2.bonus;

  if (state.player1.bonus > 0) {
    messages.push(
      `プレイヤー1のカードは正義の力で+${state.player1.bonus}`
    );
  }

  if (state.player2.bonus > 0) {
    messages.push(
      `プレイヤー2のカードは正義の力で+${state.player2.bonus}`
    );
  }

  /*
   * 2 女教皇
   */
  if (player1Card === 2 && player2Card % 2 === 0) {
    player1Power = player2Power + 1;

    messages.push(
      `プレイヤー1の女教皇が強さ${player1Power}になった`
    );
  }

  if (player2Card === 2 && player1Card % 2 === 0) {
    player2Power = player1Power + 1;

    messages.push(
      `プレイヤー2の女教皇が強さ${player2Power}になった`
    );
  }

  /*
   * 5 教皇
   * 4 皇帝には入れ替えが効かない
   */
  if (
    player1Card === 5 &&
    player2Power > player1Power
  ) {
    if (player2Card === 4) {
      messages.push(
        "プレイヤー2の皇帝が強さの入れ替えを無効化"
      );
    } else {
      [player1Power, player2Power] =
        [player2Power, player1Power];

      messages.push(
        "プレイヤー1の教皇が両者の強さを入れ替えた"
      );
    }
  }

  if (
    player2Card === 5 &&
    player1Power > player2Power
  ) {
    if (player1Card === 4) {
      messages.push(
        "プレイヤー1の皇帝が強さの入れ替えを無効化"
      );
    } else {
      [player1Power, player2Power] =
        [player2Power, player1Power];

      messages.push(
        "プレイヤー2の教皇が両者の強さを入れ替えた"
      );
    }
  }

  /*
   * 引き分け
   */
  if (player1Power === player2Power) {
    const refilled = refillHandsIfNeeded(state);

    return {
      state,
      outcome: {
        winner: "draw",
        title: "引き分け",
        text: [
          ...messages,
          `両者の最終的な強さは${player1Power}`,
          "ダメージは発生しません"
        ].join("。"),
        player1Card,
        player2Card,
        refilled
      }
    };
  }

  const winner =
    player1Power > player2Power
      ? "player1"
      : "player2";

  const loser =
    winner === "player1"
      ? "player2"
      : "player1";

  const winnerCard =
    winner === "player1"
      ? player1Card
      : player2Card;

  const loserCard =
    loser === "player1"
      ? player1Card
      : player2Card;

  const winnerState = state[winner];
  const loserState = state[loser];

  /*
   * 7 戦車
   */
  let damage = winnerCard === 7 ? 2 : 1;

  /*
   * 9 隠者
   */
  if (loserCard === 9 && !loserState.hermitUsed) {
    loserState.hermitUsed = true;
    damage = 0;

    messages.push(
      `${loser === "player1" ? "プレイヤー1" : "プレイヤー2"}の隠者がダメージを無効化`
    );
  }

  loserState.life = Math.max(
    0,
    loserState.life - damage
  );

  if (damage > 0) {
    messages.push(`${damage}ダメージ`);
  }

  /*
   * 6 恋人
   */
  if (winnerCard === 6) {
    const previousLife = winnerState.life;

    winnerState.life = Math.min(
      MAX_LIFE,
      winnerState.life + 1
    );

    if (winnerState.life > previousLife) {
      messages.push(
        `${winner === "player1" ? "プレイヤー1" : "プレイヤー2"}のライフが1回復`
      );
    }
  }

  /*
   * 8 正義
   */
  if (winnerCard === 8) {
    winnerState.bonus++;

    messages.push(
      `${winner === "player1" ? "プレイヤー1" : "プレイヤー2"}の今後のカードが+${winnerState.bonus}`
    );
  }

  /*
   * 10 王
   */
  if (winnerCard === 10) {
    const discardedCard = discardRandomCard(
      loserState,
      random
    );

    if (discardedCard) {
      messages.push(
        `王の命令で${discardedCard.name}が捨てられた`
      );
    }
  }

  if (loserState.life <= 0) {
    state.gameOver = true;
    state.winner = winner;
  }

  const refilled = state.gameOver
    ? false
    : refillHandsIfNeeded(state);

  return {
    state,
    outcome: {
      winner,
      title:
        winner === "player1"
          ? "プレイヤー1の勝利"
          : "プレイヤー2の勝利",
      text: messages.join("。") + "。",
      player1Card,
      player2Card,
      player1Power,
      player2Power,
      refilled
    }
  };
}

export function advanceRound(currentState) {
  const state = cloneState(currentState);

  if (!state.gameOver) {
    state.round++;
  }

  return state;
}