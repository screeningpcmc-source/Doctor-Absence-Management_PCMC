import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getAuth,
  signInWithPopup,
  GoogleAuthProvider,
  onAuthStateChanged,
  User,
  signOut,
} from 'firebase/auth';
import firebaseConfig from '../../firebase-applet-config.json';

const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
export const auth = getAuth(app);

const provider = new GoogleAuthProvider();
provider.addScope('https://www.googleapis.com/auth/spreadsheets');
provider.addScope('https://www.googleapis.com/auth/calendar.events');

let isSigningIn = false;
let cachedAccessToken: string | null = null;

export const initAuth = (
  onAuthSuccess?: (user: User, token: string) => void,
  onAuthFailure?: () => void
) => {
  return onAuthStateChanged(auth, async (user: User | null) => {
    if (user) {
      if (cachedAccessToken) {
        if (onAuthSuccess) onAuthSuccess(user, cachedAccessToken);
      } else if (!isSigningIn) {
        cachedAccessToken = null;
        if (onAuthFailure) onAuthFailure();
      }
    } else {
      cachedAccessToken = null;
      if (onAuthFailure) onAuthFailure();
    }
  });
};

export interface SignInResult {
  user: User;
  accessToken: string;
}

export const googleSignIn = async (): Promise<SignInResult | null> => {
  try {
    isSigningIn = true;
    const result = await signInWithPopup(auth, provider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    if (!credential?.accessToken) {
      throw new Error('ไม่พบ Access Token จากการยืนยันตัวตน Google');
    }
    cachedAccessToken = credential.accessToken;
    return { user: result.user, accessToken: cachedAccessToken };
  } catch (error: any) {
    console.error('Sign in error:', error);
    // Parse common Firebase errors into actionable Thai descriptions
    const code = error?.code || '';
    if (code === 'auth/unauthorized-domain' || error?.message?.includes('unauthorized-domain')) {
      const currentHost = typeof window !== 'undefined' ? window.location.hostname : 'unknown';
      throw new Error(
        `โดเมน '${currentHost}' ยังไม่ได้รับอนุญาตใน Firebase Console (auth/unauthorized-domain)`
      );
    } else if (code === 'auth/popup-blocked' || error?.message?.includes('popup-blocked')) {
      throw new Error('เบราว์เซอร์บล็อกหน้าต่างป็อปอัป กรุณาอนุญาตป็อปอัปสำหรับเว็บไซต์นี้');
    } else if (code === 'auth/popup-closed-by-user' || error?.message?.includes('closed-by-user')) {
      throw new Error('หน้าต่างเข้าสู่ระบบถูกปิดก่อนเสร็จสิ้นกระบวนการ');
    } else if (code === 'auth/network-request-failed') {
      throw new Error('การเชื่อมต่ออินเทอร์เน็ตมีปัญหา กรุณาตรวจสอบการเชื่อมต่อแล้วลองใหม่');
    }
    throw error;
  } finally {
    isSigningIn = false;
  }
};

export const getAccessToken = async (): Promise<string | null> => {
  return cachedAccessToken;
};

export const googleLogout = async () => {
  await signOut(auth);
  cachedAccessToken = null;
};
