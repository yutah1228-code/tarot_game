"use strict";

import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
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
      renderRoom();

      if (
        isHost() &&
        currentRoom.status === "choosing" &&
        currentRoom.hostChoice !== null &&
        currentRoom.guestChoice !== null
      ) {
        resolveOnlineRound();
      }

      if (
        isHost() &&
        currentRoom.status === "result" &&
        currentRoom.hostReady &&
        currentRoom.guestReady
      ) {
        startNextOnlineRound();
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

  const mySide = getMySide();
  const myCards =
    currentRoom.battle[mySide].cards;

  if (!myCards.includes(cardNumber)) {
    return;
  }

  const roomReference =
    doc(db, "rooms", currentRoomCode);

  const choiceField =
    isHost() ? "hostChoice" : "guestChoice";

  await runTransaction(
    db,
    async transaction => {
      const snapshot =
        await transaction.get(roomReference);

      if (!snapshot.exists()) {
        throw new Error(
          "部屋が存在しません。"
        );
      }

      const room = snapshot.data();

      if (room.status !== "choosing") {
        throw new Error(
          "現在はカードを選択できません。"
        );
      }

      if (room[choiceField] !== null) {
        throw new Error(
          "すでにカードを選択しています。"
        );
      }

      transaction.update(roomReference, {
        [choiceField]: cardNumber,
        updatedAt: serverTimestamp()
      });
    }
  );
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

  const alreadySelected =
    currentRoom[myChoiceField] !== null;

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
    resetPlayedCard(
      "opponentPlayed",
      "相手のカード"
    );

    resetPlayedCard(
      "playerPlayed",
      "あなたのカード"
    );

    $("resultTitle").textContent =
      currentRoom.status === "choosing"
        ? "カードを選んでください"
        : "対戦相手を待っています";

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