import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyC-Jzft0lNoO2v10S7eugNceL1S2pIBOvw",
  authDomain: "hustl-bfa04.firebaseapp.com",
  projectId: "hustl-bfa04",
  storageBucket: "hustl-bfa04.firebasestorage.app",
  messagingSenderId: "482134338688",
  appId: "1:482134338688:web:f11ad4224fbf0177b58a65"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const provider = new GoogleAuthProvider();
export const db = getFirestore(app);