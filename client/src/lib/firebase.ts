import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth } from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyBQgHfytL-tKu7LBt9pIYyouDRdg-nGfwQ",
  authDomain: "mypay-28cea.firebaseapp.com",
  projectId: "mypay-28cea",
  storageBucket: "mypay-28cea.firebasestorage.app",
  messagingSenderId: "546562412795",
  appId: "1:546562412795:web:9f5d88b8a64f49bdb2605e",
  measurementId: "G-2GXZK0JYPP",
};

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
export const firebaseAuth = getAuth(app);
