// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyCXIfPxXt4V1yrWIxsu-YTWFthVROzkogA",
  authDomain: "voting-system-5d97e.firebaseapp.com",
  projectId: "voting-system-5d97e",
  storageBucket: "voting-system-5d97e.appspot.com",
  messagingSenderId: "355898768368",
  appId: "1:355898768368:web:9e9b8896e0c34708eb3b35"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize and export Firebase services
export const db = getFirestore(app);
export const auth = getAuth(app);

