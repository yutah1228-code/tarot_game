"use strict";

import {
  initializeApp
} from "https://www.gstatic.com/firebasejs/12.0.0/firebase-app.js";

import {
  getAuth,
  signInAnonymously
} from "https://www.gstatic.com/firebasejs/12.0.0/firebase-auth.js";

import {
  getFirestore
} from "https://www.gstatic.com/firebasejs/12.0.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyC6R58--6OWpZpPhZQMONzEJXXJNN-LnPw",
  authDomain: "tarot-battle.firebaseapp.com",
  projectId: "tarot-battle",
  storageBucket: "tarot-battle.firebasestorage.app",
  messagingSenderId: "310910162011",
  appId: "1:310910162011:web:53829c6462c243743e5b7e"
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);

export async function loginAnonymously() {
  if (auth.currentUser) {
    return auth.currentUser;
  }

  const credential =
    await signInAnonymously(auth);

  return credential.user;
}