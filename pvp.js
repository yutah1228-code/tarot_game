"use strict";

import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  runTransaction,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.0.0/firebase-firestore.js";

import {
  db,
  loginAnonymously
} from "./firebase-config.js";

import {
  getCard
} from "./cards.js";

import {
  createInitialBattleState,
  resolveBattle,
  advanceRound
} from "./battle.js";

import {
  $,
  renderLife,
  renderHand,
  showPlayedCard,
  resetPlayedCard,
  renderRules,
  setupRulesDialog
} from "./ui.js";

let currentUser = null;
let currentRoomCode = null;
let currentRoom = null;
let unsubscribeRoom = null;
let selectedCardNumber = null;
let pendingChoice = null;
let resolvingRound = false;
let advancingRound = false;

function createRoomCode() {
  return String(
    Math.floor(100000 + Math.random() * 900000)
  );
}

async function createRoom() {
  currentUser = await loginAnonymously();

  let roomCode;
  let roomReference;

  do {
    roomCode = createRoomCode();
    roomReference = doc(db, "rooms", roomCode);
  } while ((await getDoc(roomReference)).exists());

  await setDoc(roomReference, {
    roomCode,

    hostUid: currentUser.uid,
    guestUid: null,

    status: "waiting",

    battle: createInitialBattleState(),

    hostChoice: null,
    guestChoice: null,

    hostReady: false,
    guestReady: false,

    lastOutcome: null,
    updatedAt: serverTimestamp()
  });

  currentRoomCode = roomCode;

  $("roomCode").textContent = roomCode;
  showScreen("waitingScreen");

  listenToRoom();
}

async function joinRoom() {
  currentUser = await loginAnonymously();

  const roomCode =
    $("roomCodeInput").value.trim();

  if (!/^\d{6}$/.test(roomCode)) {
    showLobbyError(
      "6桁の部屋コードを入力してください。"
    );
    return;
  }

  const roomReference =
    doc(db, "rooms", roomCode);

  try {
    await runTransaction(
      db,
      async transaction => {
        const snapshot =
          await transaction.get(roomReference);

        if (!snapshot.exists()) {
          throw new Error(
            "部屋が見つかりません。"
          );
        }

        const room = snapshot.data();

        if (room.status !== "waiting") {
          throw new Error(
            "この部屋では対戦を開始できません。"
          );
        }

        if (room.guestUid) {
          throw new Error(
            "この部屋は満員です。"
          );
        }

        if (room.hostUid === currentUser.uid) {
          throw new Error(
            "自分が作成した部屋には参加できません。"
          );
        }

        transaction.update(roomReference, {
          guestUid: currentUser.uid,
          status: "choosing",
          updatedAt: serverTimestamp()
        });
      }
    );

    currentRoomCode = roomCode;
    listenToRoom();
  } catch (error) {
    showLobbyError(error.message);
  }
}

function listenToRoom() {
  if (unsubscribeRoom) {
    unsubscribeRoom();
  }

  const roomReference =
    doc(db, "rooms", currentRoomCode);

  unsubscribeRoom = onSnapshot(
  roomReference,
  snapshot => {
    if (!snapshot.exists()) {
      showConnectionError(
        "部屋が削除されました。"
      );
      return;
    }

    currentRoom = snapshot.data();

    if (currentRoom.status === "abandoned") {
  showScreen("battleScreen");

  $("resultTitle").textContent =
    "対戦相手が退出しました";

  $("resultText").textContent =
    "対戦は終了しました。モード選択へ戻ってください。";

  $("nextButton").hidden = true;

  renderHand({
    elementId: "playerHand",
    cards: [],
    disabled: true,
    onSelect: () => {}
  });

  return;
}

    const myChoiceField =
      isHost() ? "hostChoice" : "guestChoice";

    // Firebase側へ保存されたら仮状態を解除
    if (currentRoom[myChoiceField] !== null) {
      pendingChoice = null;
    }

    renderRoom();

    if (
      isHost() &&
      !resolvingRound &&
      currentRoom.status === "choosing" &&
      currentRoom.hostChoice !== null &&
      currentRoom.guestChoice !== null
    ) {
      resolvingRound = true;

      resolveOnlineRound()
        .catch(error => {
          console.error(
            "勝敗確定エラー:",
            error
          );
        })
        .finally(() => {
          resolvingRound = false;
        });
    }

    if (
      isHost() &&
      !advancingRound &&
      currentRoom.status === "result" &&
      currentRoom.hostReady &&
      currentRoom.guestReady
    ) {
      advancingRound = true;

      startNextOnlineRound()
        .catch(error => {
          console.error(
            "次ラウンド開始エラー:",
            error
          );
        })
        .finally(() => {
          advancingRound = false;
        });
    }
  }
);
}

function isHost() {
  return (
    currentUser &&
    currentRoom &&
    currentUser.uid === currentRoom.hostUid
  );
}

function getMySide() {
  return isHost() ? "player1" : "player2";
}

function getOpponentSide() {
  return isHost() ? "player2" : "player1";
}

async function submitCard(cardNumber) {
  if (!currentRoom) return;
  if (currentRoom.status !== "choosing") return;
  if (pendingChoice !== null) return;

  const mySide = getMySide();
  const myCards = currentRoom.battle[mySide].cards;

  if (!myCards.includes(cardNumber)) {
    throw new Error(
      "このカードは使用できません。"
    );
  }

  const choiceField =
    isHost() ? "hostChoice" : "guestChoice";

  const roomReference =
    doc(db, "rooms", currentRoomCode);

  // Firebaseからの返事を待たず、画面では選択済みにする
  pendingChoice = cardNumber;
  renderRoom();

  try {
    await updateDoc(roomReference, {
      [choiceField]: cardNumber,
      updatedAt: serverTimestamp()
    });
  } catch (error) {
    pendingChoice = null;
    renderRoom();
    throw error;
  }
}

async function resolveOnlineRound() {
  const roomReference =
    doc(db, "rooms", currentRoomCode);

  await runTransaction(
    db,
    async transaction => {
      const snapshot =
        await transaction.get(roomReference);

      if (!snapshot.exists()) return;

      const room = snapshot.data();

      if (room.status !== "choosing") return;

      if (
        room.hostChoice === null ||
        room.guestChoice === null
      ) {
        return;
      }

      const result = resolveBattle(
        room.battle,
        room.hostChoice,
        room.guestChoice
      );

      transaction.update(roomReference, {
        battle: result.state,
        lastOutcome: result.outcome,
        status: result.state.gameOver
          ? "finished"
          : "result",
        hostChoice: null,
        guestChoice: null,
        hostReady: false,
        guestReady: false,
        updatedAt: serverTimestamp()
      });
    }
  );
}

async function readyForNextRound() {
  if (!currentRoom) return;
  if (currentRoom.status !== "result") return;

  const readyField =
    isHost() ? "hostReady" : "guestReady";

  await updateDoc(
    doc(db, "rooms", currentRoomCode),
    {
      [readyField]: true,
      updatedAt: serverTimestamp()
    }
  );
}

async function startNextOnlineRound() {
  const roomReference =
    doc(db, "rooms", currentRoomCode);

  await runTransaction(
    db,
    async transaction => {
      const snapshot =
        await transaction.get(roomReference);

      if (!snapshot.exists()) return;

      const room = snapshot.data();

      if (
        room.status !== "result" ||
        !room.hostReady ||
        !room.guestReady
      ) {
        return;
      }

      transaction.update(roomReference, {
        battle: advanceRound(room.battle),
        status: "choosing",
        hostReady: false,
        guestReady: false,
        lastOutcome: null,
        updatedAt: serverTimestamp()
      });
    }
  );
}

const cardConfirmDialog =
  $("cardConfirmDialog");

const cancelCardButton =
  $("cancelCardButton");

const playCardButton =
  $("playCardButton");

function openOnlineCardConfirm(cardNumber) {
  if (!currentRoom) return;
  if (currentRoom.status !== "choosing") return;

  const card = getCard(cardNumber);

  if (!card) return;

  selectedCardNumber = cardNumber;

  $("confirmCardNumber").textContent =
    card.number;

  $("confirmCardSymbol").textContent =
    card.symbol;

  $("confirmCardName").textContent =
    card.name;

  $("confirmCardEffect").textContent =
    card.effect;

  if (!cardConfirmDialog.open) {
    cardConfirmDialog.showModal();
  }
}

function closeOnlineCardConfirm() {
  if (cardConfirmDialog.open) {
    cardConfirmDialog.close();
  }

  selectedCardNumber = null;
}

cancelCardButton.addEventListener(
  "click",
  closeOnlineCardConfirm
);

playCardButton.addEventListener(
  "click",
  async () => {
    if (selectedCardNumber === null) return;

    const cardNumber = selectedCardNumber;

    closeOnlineCardConfirm();

    try {
      await submitCard(cardNumber);
    } catch (error) {
      console.error(
        "カード選択エラー:",
        error
      );

      $("resultTitle").textContent =
        "カードを選択できませんでした";

      $("resultText").textContent =
        error.message;
    }
  }
);

cardConfirmDialog.addEventListener(
  "cancel",
  event => {
    event.preventDefault();
    closeOnlineCardConfirm();
  }
);

cardConfirmDialog.addEventListener(
  "click",
  event => {
    if (event.target === cardConfirmDialog) {
      closeOnlineCardConfirm();
    }
  }
);

function renderRoom() {
  if (!currentRoom || !currentUser) return;

  if (currentRoom.status === "waiting") {
    showScreen("waitingScreen");
    $("roomCode").textContent =
      currentRoom.roomCode;

    return;
  }

  showScreen("battleScreen");

  const mySide = getMySide();
  const opponentSide = getOpponentSide();

  const myState =
    currentRoom.battle[mySide];

  const opponentState =
    currentRoom.battle[opponentSide];

  renderLife("playerLife", myState.life);
  renderLife("opponentLife", opponentState.life);

  $("roundNumber").textContent =
    currentRoom.battle.round;

  const myChoiceField =
  isHost() ? "hostChoice" : "guestChoice";

const serverChoice =
  currentRoom[myChoiceField];

const alreadySelected =
  serverChoice !== null ||
  pendingChoice !== null;

  const selectionStatus =
  $("selectionStatus");

if (pendingChoice !== null) {
  selectionStatus.textContent =
    "カードを送信中…";
} else if (serverChoice !== null) {
  selectionStatus.textContent =
    "選択済み。相手を待っています…";
} else {
  selectionStatus.textContent = "";
}

  renderHand({
    elementId: "playerHand",
    cards: myState.cards,
    bonus: myState.bonus,
    disabled:
      currentRoom.status !== "choosing" ||
      alreadySelected,
    onSelect: openOnlineCardConfirm
  });

  renderOnlineResult();
}

function renderOnlineResult() {
  const outcome = currentRoom.lastOutcome;

  if (!outcome) {
  const myChoiceField =
    isHost() ? "hostChoice" : "guestChoice";

  const opponentChoiceField =
    isHost() ? "guestChoice" : "hostChoice";

  const myChoice =
    pendingChoice ??
    currentRoom[myChoiceField];

  if (myChoice !== null) {
    showPlayedCard(
      "playerPlayed",
      myChoice
    );
  } else {
    resetPlayedCard(
      "playerPlayed",
      "あなたのカード"
    );
  }

  resetPlayedCard(
    "opponentPlayed",
    currentRoom[opponentChoiceField] !== null
      ? "相手は選択済み"
      : "相手のカード"
  );

  $("resultTitle").textContent =
    myChoice !== null
      ? "相手を待っています"
      : "カードを選んでください";

  $("resultText").textContent =
    myChoice !== null
      ? "カードを送信しました。相手の選択を待っています。"
      : "両者がカードを選ぶと、同時に公開します。";

  return;
}

  const myCard = isHost()
    ? outcome.player1Card
    : outcome.player2Card;

  const opponentCard = isHost()
    ? outcome.player2Card
    : outcome.player1Card;

  showPlayedCard(
    "playerPlayed",
    myCard
  );

  showPlayedCard(
    "opponentPlayed",
    opponentCard
  );

  let title = outcome.title;

  if (outcome.winner === "player1") {
    title = isHost()
      ? "あなたの勝利"
      : "相手の勝利";
  }

  if (outcome.winner === "player2") {
    title = isHost()
      ? "相手の勝利"
      : "あなたの勝利";
  }

  $("resultTitle").textContent = title;
  $("resultText").textContent =
    outcome.text;

  $("nextButton").hidden =
    currentRoom.status !== "result";
}

function showScreen(screenId) {
  [
    "lobbyScreen",
    "waitingScreen",
    "battleScreen"
  ].forEach(id => {
    const element = $(id);

    if (element) {
      element.hidden = id !== screenId;
    }
  });
}

function showLobbyError(message) {
  $("lobbyError").textContent = message;
}

function showConnectionError(message) {
  $("resultTitle").textContent =
    "通信エラー";

  $("resultText").textContent =
    message;
}

$("createRoomButton").addEventListener(
  "click",
  createRoom
);

$("joinRoomButton").addEventListener(
  "click",
  joinRoom
);

$("nextButton").addEventListener(
  "click",
  readyForNextRound
);

renderRules();
setupRulesDialog();
showScreen("lobbyScreen");

$("joinRoomButton").addEventListener(
  "click",
  async () => {
    const button = $("joinRoomButton");

    button.disabled = true;
    button.textContent = "参加中…";
    showLobbyError("");

    try {
      await joinRoom();
    } catch (error) {
      console.error("部屋参加エラー:", error);

      showLobbyError(
        `参加できませんでした：${error.code || error.message}`
      );
    } finally {
      button.disabled = false;
      button.textContent = "部屋に参加する";
    }
  }
);

async function leaveRoom() {
  const button = $("leaveRoomButton");

  button.disabled = true;
  button.textContent = "退出中…";

  try {
    if (currentRoomCode && currentRoom) {
      const roomReference =
        doc(db, "rooms", currentRoomCode);

      const battleFinished =
        currentRoom.status === "finished" ||
        currentRoom.battle?.gameOver;

      if (battleFinished || isHost()) {
        // 対戦終了後、またはホスト退出時は部屋を削除
        await deleteDoc(roomReference);
      } else {
        // 対戦途中にゲストが退出
        await updateDoc(roomReference, {
          status: "abandoned",
          leftUid: currentUser.uid,
          updatedAt: serverTimestamp()
        });
      }
    }
  } catch (error) {
    // データ削除に失敗しても画面からは退出させる
    console.warn(
      "部屋の終了処理に失敗しました:",
      error
    );
  } finally {
    if (unsubscribeRoom) {
      unsubscribeRoom();
      unsubscribeRoom = null;
    }

    currentRoom = null;
    currentRoomCode = null;
    pendingChoice = null;

    window.location.href = "./index.html";
  }
}

$("leaveRoomButton").addEventListener(
  "click",
  leaveRoom
);