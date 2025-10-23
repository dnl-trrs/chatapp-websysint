// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyAORQoP125YP01dtCjPEPvPlH0oWpz9kI8",
  authDomain: "chatapp-b58.firebaseapp.com",
  projectId: "chatapp-b58",
  storageBucket: "chatapp-b58.appspot.com",
  messagingSenderId: "918192066198",
  appId: "1:918192066198:web:aa9ba38b737317c161bcb7"
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);
