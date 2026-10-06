import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getDatabase } from "firebase/database";

const env = import.meta.env;

const config = {
  apiKey: env.VITE_FIREBASE_API_KEY?.trim(),
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN?.trim(),
  databaseURL: env.VITE_FIREBASE_DATABASE_URL?.trim(),
  projectId: env.VITE_FIREBASE_PROJECT_ID?.trim(),
  appId: env.VITE_FIREBASE_APP_ID?.trim(),
};

export const isFirebaseConfigured = Boolean(
  config.apiKey && config.authDomain && config.databaseURL && config.projectId && config.appId,
);

const app = isFirebaseConfigured ? initializeApp(config) : null;

export const auth = app ? getAuth(app) : null;
export const db = app ? getDatabase(app) : null;