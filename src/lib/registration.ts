import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  query,
  updateDoc,
  where,
  writeBatch,
  increment,
  Timestamp,
} from "firebase/firestore";
import { db } from "@/lib/firebase";

// Ported from giggre_app/lib/utils/user_utils.dart to keep the web
// registration flow's validation and Firestore schema in sync with the app.

export const COUNTRIES = [
  { name: "Philippines", flag: "🇵🇭", dialCode: "+63" },
  { name: "United States", flag: "🇺🇸", dialCode: "+1" },
  { name: "United Kingdom", flag: "🇬🇧", dialCode: "+44" },
  { name: "Australia", flag: "🇦🇺", dialCode: "+61" },
  { name: "Canada", flag: "🇨🇦", dialCode: "+1" },
  { name: "Singapore", flag: "🇸🇬", dialCode: "+65" },
  { name: "Japan", flag: "🇯🇵", dialCode: "+81" },
  { name: "South Korea", flag: "🇰🇷", dialCode: "+82" },
  { name: "China", flag: "🇨🇳", dialCode: "+86" },
  { name: "Hong Kong", flag: "🇭🇰", dialCode: "+852" },
  { name: "Taiwan", flag: "🇹🇼", dialCode: "+886" },
  { name: "India", flag: "🇮🇳", dialCode: "+91" },
  { name: "Indonesia", flag: "🇮🇩", dialCode: "+62" },
  { name: "Malaysia", flag: "🇲🇾", dialCode: "+60" },
  { name: "Thailand", flag: "🇹🇭", dialCode: "+66" },
  { name: "Vietnam", flag: "🇻🇳", dialCode: "+84" },
  { name: "Brunei", flag: "🇧🇳", dialCode: "+673" },
  { name: "Saudi Arabia", flag: "🇸🇦", dialCode: "+966" },
  { name: "United Arab Emirates", flag: "🇦🇪", dialCode: "+971" },
  { name: "Qatar", flag: "🇶🇦", dialCode: "+974" },
  { name: "Germany", flag: "🇩🇪", dialCode: "+49" },
  { name: "France", flag: "🇫🇷", dialCode: "+33" },
  { name: "Italy", flag: "🇮🇹", dialCode: "+39" },
  { name: "Spain", flag: "🇪🇸", dialCode: "+34" },
  { name: "Netherlands", flag: "🇳🇱", dialCode: "+31" },
  { name: "New Zealand", flag: "🇳🇿", dialCode: "+64" },
  { name: "Mexico", flag: "🇲🇽", dialCode: "+52" },
  { name: "Brazil", flag: "🇧🇷", dialCode: "+55" },
  { name: "South Africa", flag: "🇿🇦", dialCode: "+27" },
  { name: "Pakistan", flag: "🇵🇰", dialCode: "+92" },
  { name: "Bangladesh", flag: "🇧🇩", dialCode: "+880" },
] as const;

export const DEFAULT_COUNTRY = COUNTRIES[0];

// Matches Philippine (+63 / 09xx) and U.S. (+1 / 10-digit) numbers.
const PHONE_REGEX = /^(\+?63|0)9\d{9}$|^(\+?1)?[2-9]\d{2}[2-9]\d{6}$/;
const GENERIC_PHONE_REGEX = /^\+\d{6,15}$/;

export function isPhoneValid(fullPhone: string) {
  return PHONE_REGEX.test(fullPhone) || GENERIC_PHONE_REGEX.test(fullPhone);
}

export interface PasswordRequirement {
  label: string;
  isMet: (password: string) => boolean;
}

export const PASSWORD_REQUIREMENTS: PasswordRequirement[] = [
  { label: "At least 8 characters", isMet: (p) => p.length >= 8 },
  { label: "1 uppercase letter", isMet: (p) => /[A-Z]/.test(p) },
  { label: "1 lowercase letter", isMet: (p) => /[a-z]/.test(p) },
  { label: "1 number", isMet: (p) => /[0-9]/.test(p) },
  { label: "1 special character", isMet: (p) => /[!@#$%^&*(),.?":{}|<>_\-+=[\]\\/~`]/.test(p) },
];

export function isPasswordStrong(password: string) {
  return PASSWORD_REQUIREMENTS.every((r) => r.isMet(password));
}

const LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
const DIGITS = "0123456789";

function randomFrom(alphabet: string) {
  return alphabet[Math.floor(Math.random() * alphabet.length)];
}

/** 3 random uppercase letters + 6 random digits (e.g. "XKP482931"), unique in `users`. */
export async function generateUserId(): Promise<string> {
  const usersRef = collection(db, "users");
  while (true) {
    const candidate =
      Array.from({ length: 3 }, () => randomFrom(LETTERS)).join("") +
      Array.from({ length: 6 }, () => randomFrom(DIGITS)).join("");
    const existing = await getDocs(query(usersRef, where("userId", "==", candidate), limit(1)));
    if (existing.empty) return candidate;
  }
}

/** 8-char referral code (e.g. "GX82KL19"), unique in `users`. */
export async function generateReferralCode(): Promise<string> {
  const usersRef = collection(db, "users");
  while (true) {
    const code =
      randomFrom(LETTERS) + randomFrom(LETTERS) + randomFrom(DIGITS) + randomFrom(DIGITS) +
      randomFrom(LETTERS) + randomFrom(LETTERS) + randomFrom(DIGITS) + randomFrom(DIGITS);
    const existing = await getDocs(query(usersRef, where("referrals.referral_code", "==", code), limit(1)));
    if (existing.empty) return code;
  }
}

export interface ReferralLookup {
  userId: string;
  name: string;
  email: string;
}

export async function validateReferralCode(code: string): Promise<ReferralLookup | null> {
  const usersRef = collection(db, "users");
  const found = await getDocs(query(usersRef, where("referrals.referral_code", "==", code), limit(1)));
  if (found.empty) return null;
  const userDoc = found.docs[0];
  const data = userDoc.data();
  return { userId: userDoc.id, name: data.name ?? "User", email: data.email ?? "" };
}

// Mirrors giggre_app/lib/screens/referrals/my_referral_screen.dart's
// `referralMap` — level is purely count-based gamification, no functional
// reward tied to it, just a badge shown on the referrals card. Exported so
// src/lib/referrals.ts (the My Referrals page's own data helpers) can reuse
// this same table instead of duplicating it.
export const REFERRAL_MILESTONES = [
  { referrals: 1, level: 1, label: "🐣 First Steps" },
  { referrals: 3, level: 2, label: "🎉 Party of Three" },
  { referrals: 5, level: 3, label: "🖐️ High Five!" },
  { referrals: 10, level: 4, label: "🔥 Double Digits" },
  { referrals: 20, level: 5, label: "🌱 Squad's Growing" },
  { referrals: 30, level: 6, label: "🚀 Trailblazer" },
  { referrals: 50, level: 7, label: "💪 Fifty & Thriving" },
  { referrals: 75, level: 8, label: "🎯 Three-Quarter Beast" },
  { referrals: 100, level: 9, label: "💯 Century Club" },
  { referrals: 125, level: 10, label: "⭐ Rising Star" },
  { referrals: 150, level: 11, label: "🏗️ Community Builder" },
  { referrals: 175, level: 12, label: "🕸️ Web Weaver" },
  { referrals: 200, level: 13, label: "👑 Double Century King" },
  { referrals: 300, level: 14, label: "🔗 The Connector" },
  { referrals: 350, level: 15, label: "⚡ Powerhouse" },
  { referrals: 400, level: 16, label: "📣 Loud & Proud" },
  { referrals: 450, level: 17, label: "🧲 Human Magnet" },
  { referrals: 500, level: 18, label: "🏆 Half-Thousand Hero" },
  { referrals: 550, level: 19, label: "🌊 Unstoppable Wave" },
  { referrals: 600, level: 20, label: "🦸 Super Connector" },
  { referrals: 700, level: 21, label: "🌍 Seven Hundred Strong" },
  { referrals: 800, level: 22, label: "💎 Elite Recruiter" },
  { referrals: 900, level: 23, label: "🏁 Final Stretch" },
  { referrals: 1000, level: 24, label: "🐐 Legendary GOAT" },
] as const;

function referralLevelFor(count: number) {
  let level = 0;
  for (const milestone of REFERRAL_MILESTONES) {
    if (count >= milestone.referrals) level = milestone.level;
  }
  return level;
}

/** The milestone nickname for a given `referrals.referral_level` (e.g. 1 -> "🐣 First Steps"), or null below level 1. */
export function referralLevelLabel(level: number): string | null {
  return REFERRAL_MILESTONES.find((m) => m.level === level)?.label ?? null;
}

export interface NewUserProfile {
  uid: string;
  userId: string;
  email: string;
  name: string;
  phone: string;
  photoUrl?: string;
  signInMethod: "email" | "google" | "apple";
  referrer: ReferralLookup | null;
  referralCodeUsed?: string;
}

/**
 * Writes the new user's `users/{uid}` document (matching the mobile app's
 * schema exactly) plus referrer bookkeeping, in one batch.
 */
export async function createUserProfile(profile: NewUserProfile) {
  const referralCode = await generateReferralCode();
  const batch = writeBatch(db);
  const userRef = doc(db, "users", profile.uid);

  batch.set(userRef, {
    userId: profile.userId,
    email: profile.email,
    name: profile.name,
    phone: profile.phone,
    photoUrl: profile.photoUrl ?? "",
    balance: 0,
    createdAt: Timestamp.now(),
    skills: [],
    openGigsUnlocked: false,
    signInMethod: profile.signInMethod,
    ratingAsWorker: 5.0,
    ratingAsHost: 5.0,
    ratingCount: 0,
    slot: "AVAILABLE",
    acceptanceRate: 1.0,
    isVerified: "unverified",
    referredBy: profile.referrer?.userId ?? null,
    referrals: {
      referral_code: referralCode,
      referral_level: 0,
      referrals_count: 0,
      verified_referrals: 0,
      not_verified_referrals: 0,
      pending_referrals: 0,
      cancelled_referrals: 0,
      rejected_referrals: 0,
      referredByUID: profile.referrer?.userId ?? null,
      referredByName: profile.referrer?.name ?? null,
    },
  });

  if (profile.referrer) {
    const referralListRef = doc(db, "users", profile.referrer.userId, "referrals_list", profile.uid);
    batch.set(referralListRef, {
      name: profile.name,
      email: profile.email,
      joined_at: Timestamp.now(),
      referral_code_used: profile.referralCodeUsed ?? "",
      isVerified: "unverified",
    });
    const referrerRef = doc(db, "users", profile.referrer.userId);
    batch.update(referrerRef, {
      "referrals.referrals_count": increment(1),
      "referrals.not_verified_referrals": increment(1),
    });
  }

  await batch.commit();

  if (profile.referrer) {
    await updateReferralLevel(profile.referrer.userId);
  }
}

async function updateReferralLevel(referrerId: string) {
  try {
    const referrerRef = doc(db, "users", referrerId);
    const snap = await getDoc(referrerRef);
    if (!snap.exists()) return;
    const count = snap.data()?.referrals?.referrals_count ?? 0;
    await updateDoc(referrerRef, { "referrals.referral_level": referralLevelFor(count) });
  } catch (err) {
    console.error("Failed to update referral level:", err);
  }
}

export async function getUserProfile(uid: string) {
  const snap = await getDoc(doc(db, "users", uid));
  return snap.exists() ? snap.data() : null;
}

/** Partially updates `users/{uid}` — pass only the fields that changed. */
export async function updateUserProfile(uid: string, updates: Record<string, unknown>) {
  await updateDoc(doc(db, "users", uid), updates);
}
