// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyAj2_RFPTe-ftTX_us1HhXZ6H_5yR-UISU",
  authDomain: "lynx-ai-6dadf.firebaseapp.com",
  projectId: "lynx-ai-6dadf",
  storageBucket: "lynx-ai-6dadf.firebasestorage.app",
  messagingSenderId: "801396333101",
  appId: "1:801396333101:web:e4fac2a00002f1fc5df6a4",
  measurementId: "G-8E0JSFQ0VH"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);