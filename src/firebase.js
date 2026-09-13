import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyBTEiOVKMQ_Jn8wikHRSsDm2hrG0zKh4r8",
  authDomain: "crodytolaunchingsoon.firebaseapp.com",
  databaseURL: "https://crodytolaunchingsoon-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "crodytolaunchingsoon",
  storageBucket: "crodytolaunchingsoon.firebasestorage.app",
  messagingSenderId: "473030269256",
  appId: "1:473030269256:web:eba0e265db40a4c122fb7d",
  measurementId: "G-JYJ654P1XD"
};

// Firebase initialize kora
const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);