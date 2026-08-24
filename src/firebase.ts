import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import firebaseConfig from "../firebase-applet-config.json";

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Auth
export const auth = getAuth(app);

// Initialize Cloud Firestore using the configured database ID
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId || "(default)");

export default app;
