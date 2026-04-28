import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut } from 'firebase/auth';
import { initializeFirestore, doc, getDocFromServer } from 'firebase/firestore';

// Import the Firebase configuration
import firebaseConfig from '../firebase-applet-config.json';

// Detect if configuration is placeholder/invalid
export const isFirebaseConfigValid = 
  !!firebaseConfig.apiKey && 
  firebaseConfig.apiKey !== 'remixed-api-key' && 
  firebaseConfig.apiKey.includes('AIzaSy'); // Google API keys usually start with AIzaSy

let app;
let db: any;
let auth: any;

try {
  if (isFirebaseConfigValid) {
    app = initializeApp(firebaseConfig);
    db = initializeFirestore(app, {
      experimentalForceLongPolling: true
    }, firebaseConfig.firestoreDatabaseId);
    auth = getAuth(app);
  } else {
    app = null;
    db = null;
    auth = { currentUser: null, onAuthStateChanged: (cb: any) => { cb(null); return () => {}; } };
  }
} catch (e) {
  app = null;
  db = null;
  auth = { currentUser: null, onAuthStateChanged: (cb: any) => { cb(null); return () => {}; } };
}

export { db, auth };
export const googleProvider = isFirebaseConfigValid ? new GoogleAuthProvider() : null;

// Auth helpers
export const loginWithGoogle = () => {
  if (!isFirebaseConfigValid) throw new Error("Firebase not configured");
  return signInWithPopup(auth, googleProvider!);
};

export const logout = () => {
  if (!isFirebaseConfigValid) return Promise.resolve();
  return signOut(auth);
};

// Using initializeFirestore with experimentalForceLongPolling: true 
// to avoid connection issues in restricted network environments

// Validate Connection to Firestore
async function testConnection() {
  if (!isFirebaseConfigValid) return;
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if(error instanceof Error && error.message.includes('the client is offline')) {
      console.error("Please check your Firebase configuration. ");
    }
    // Skip logging for other errors, as this is simply a connection test.
  }
}
testConnection();

// Error Handling Spec for Firestore Operations
export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId: string | undefined;
    email: string | null | undefined;
    emailVerified: boolean | undefined;
    isAnonymous: boolean | undefined;
    tenantId: string | null | undefined;
    providerInfo: {
      providerId: string;
      displayName: string | null;
      email: string | null;
      photoUrl: string | null;
    }[];
  }
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData.map(provider => ({
        providerId: provider.providerId,
        displayName: provider.displayName,
        email: provider.email,
        photoUrl: provider.photoURL
      })) || []
    },
    operationType,
    path
  }
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}
