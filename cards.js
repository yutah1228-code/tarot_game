"use strict";

export const MAX_LIFE = 5;

export const CARD_DATA = [
  {
    number: 1,
    name: "奴隷",
    symbol: "☽",
    effect: "王と対決すると、残りライフに関係なく即時勝利"
  },
  {
    number: 2,
    name: "女教皇",
    symbol: "☾",
    effect: "相手が偶数なら、相手より強さが1高くなる"
  },
  {
    number: 3,
    name: "女帝",
    symbol: "✿",
    effect: "この勝負を引き分けにする"
  },
  {
    number: 4,
    name: "皇帝",
    symbol: "♜",
    effect: "相手による数値変更の影響を受けない"
  },
  {
    number: 5,
    name: "教皇",
    symbol: "✚",
    effect: "相手が自分より強い場合、両者の強さを入れ替える"
  },
  {
    number: 6,
    name: "恋人",
    symbol: "♡",
    effect: "勝利したらライフを1回復"
  },
  {
    number: 7,
    name: "戦車",
    symbol: "♞",
    effect: "勝利すると相手に追加で1ダメージ（合計2）"
  },
  {
    number: 8,
    name: "正義",
    symbol: "⚖",
    effect: "勝利すると次回以降のカードを永久的に+1する"
  },
  {
    number: 9,
    name: "隠者",
    symbol: "✦",
    effect: "敗北しても受けるダメージを1回だけ無効化する"
  },
  {
    number: 10,
    name: "王",
    symbol: "♛",
    effect:
      "勝利すると相手の未使用カードをランダムに1枚捨てさせる。ただし奴隷には即時敗北"
  }
];

export function getCard(number) {
  return CARD_DATA.find(card => card.number === number);
}

export function createFullHand() {
  return CARD_DATA.map(card => card.number);
}