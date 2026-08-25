"use strict";

import {
  CARD_DATA,
  MAX_LIFE,
  getCard
} from "./cards.js";

export const $ = id =>
  document.getElementById(id);

export function renderLife(elementId, life) {
  const element = $(elementId);

  if (!element) return;

  element.textContent = Array.from(
    { length: MAX_LIFE },
    (_, index) => {
      const lost = index + 1 > life;

      return `
        <span
          class="heart ${lost ? "lost" : ""}"
          aria-hidden="true"
        >
          ♥
        </span>
      `;
    }
  ).join("");
}

export function renderHand({
  elementId,
  cards,
  bonus = 0,
  disabled = false,
  onSelect
}) {
  const handElement = $(elementId);

  if (!handElement) return;

  handElement.textContent = CARD_DATA.map(card => {
    const unavailable =
      !cards.includes(card.number) || disabled;

    return `
      <button
        class="card"
        data-number="${card.number}"
        ${unavailable ? "disabled" : ""}
        aria-label="${card.number} ${card.name}: ${card.effect}"
      >
        <span class="card-content">
          <span class="card-number">
            ${card.number}
            ${bonus > 0 ? `<small>+${bonus}</small>` : ""}
          </span>

          <span class="card-symbol">
            ${card.symbol}
          </span>

          <span class="card-name">
            ${card.name}
          </span>
        </span>

        <span class="card-effect" aria-hidden="true">
          ${card.effect}
        </span>
      </button>
    `;
  }).join("");

  handElement
    .querySelectorAll(".card:not(:disabled)")
    .forEach(button => {
      button.addEventListener("click", () => {
        onSelect(Number(button.dataset.number));
      });
    });
}

export function showPlayedCard(elementId, cardNumber) {
  const element = $(elementId);
  const card = getCard(cardNumber);

  if (!element || !card) return;

  element.className = "played-card revealed";

  element.textContent = `
    <div>
      <div class="number">${card.number}</div>
      <div class="symbol">${card.symbol}</div>
      <div class="name">${card.name}</div>
    </div>
  `;
}

export function resetPlayedCard(
  elementId,
  label
) {
  const element = $(elementId);

  if (!element) return;

  element.className = "played-card";
  element.textContent = `<span>${label}</span>`;
}

export function renderRules(elementId = "rulesList") {
  const element = $(elementId);

  if (!element) return;

  element.textContent = CARD_DATA.map(card => `
    <div class="rule">
      <strong>${card.number}｜${card.name}</strong>
      <small>${card.effect}</small>
    </div>
  `).join("");
}

export function setupRulesDialog() {
  const rulesButton = $("rulesButton");
  const rulesDialog = $("rulesDialog");
  const closeButton = $("closeRules");

  if (!rulesButton || !rulesDialog || !closeButton) {
    return;
  }

  function openRules() {
    rulesButton.setAttribute(
      "aria-expanded",
      "true"
    );

    rulesDialog.showModal();
    closeButton.focus();
  }

  function closeRules() {
    rulesButton.setAttribute(
      "aria-expanded",
      "false"
    );

    rulesDialog.close();
    rulesButton.focus();
  }

  rulesButton.addEventListener(
    "click",
    openRules
  );

  closeButton.addEventListener(
    "click",
    closeRules
  );

  rulesDialog.addEventListener(
    "cancel",
    event => {
      event.preventDefault();
      closeRules();
    }
  );

  rulesDialog.addEventListener(
    "click",
    event => {
      if (event.target === rulesDialog) {
        closeRules();
      }
    }
  );
}