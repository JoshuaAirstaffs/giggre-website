"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  createUserWithEmailAndPassword,
  signInWithPopup,
  updateProfile,
  type User,
} from "firebase/auth";
import { toast } from "sonner";
import { auth, googleProvider } from "@/lib/firebase";
import PasswordInput from "@/components/PasswordInput";
import {
  COUNTRIES,
  DEFAULT_COUNTRY,
  PASSWORD_REQUIREMENTS,
  createUserProfile,
  generateUserId,
  getUserProfile,
  isPasswordStrong,
  isPhoneValid,
  validateReferralCode,
  type ReferralLookup,
} from "@/lib/registration";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Check, Circle } from "lucide-react";

async function establishSession(idToken: string) {
  const res = await fetch("/api/auth/session", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ idToken }),
  });
  if (!res.ok) throw new Error("Could not establish session.");
}

function authErrorMessage(err: unknown): string | null {
  const code = (err as { code?: string })?.code ?? "";
  switch (code) {
    case "auth/popup-closed-by-user":
    case "auth/cancelled-popup-request":
      return null;
    case "auth/email-already-in-use":
      return "This email is already registered. Try logging in instead.";
    case "auth/account-exists-with-different-credential":
      return "This email is linked to a Google account. Log in with Google instead.";
    case "auth/invalid-email":
      return "Please enter a valid email address.";
    case "auth/weak-password":
      return "Password is too weak. Please choose a stronger one.";
    case "auth/too-many-requests":
      return "Too many attempts. Please try again later.";
    case "auth/network-request-failed":
      return "No internet connection. Check your connection and try again.";
    case "auth/user-disabled":
      return "This account has been disabled. Contact support for help.";
    default:
      return "Something went wrong. Please try again.";
  }
}

async function resolveReferrer(referralCode: string): Promise<ReferralLookup | null | "invalid"> {
  const code = referralCode.trim().toUpperCase();
  if (!code) return null;
  if (code.length !== 8) return "invalid";
  const referrer = await validateReferralCode(code);
  return referrer ?? "invalid";
}

const inputClass =
  "mt-2 w-full rounded-xl border border-hairline bg-paper px-4 py-3 text-sm text-ink outline-none placeholder:text-muted focus:border-ink";

function GoogleIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 48 48" aria-hidden>
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.9 29.3 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.1 8 3l6-6C34.5 5.5 29.6 3.5 24 3.5 12.7 3.5 3.5 12.7 3.5 24S12.7 44.5 24 44.5 44.5 35.3 44.5 24c0-1.2-.1-2.4-.3-3.5Z" />
      <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.6 15.9 18.9 13 24 13c3.1 0 5.8 1.1 8 3l6-6C34.5 6.5 29.6 4.5 24 4.5c-8 0-14.9 4.6-18.3 11.3Z" transform="translate(0 -1)" />
      <path fill="#4CAF50" d="M24 44.5c5.5 0 10.4-1.9 13.9-5.1l-6.4-5.4c-1.9 1.3-4.5 2-7.5 2-5.2 0-9.6-3.1-11.3-7.5l-6.6 5.1c3.4 6.7 10.3 10.9 17.9 10.9Z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.4-2.4 4.4-4.4 5.8l6.4 5.4c3.7-3.4 6.2-8.5 6.2-14.7 0-1.2-.1-2.4-.3-3.5Z" />
    </svg>
  );
}

function AppleIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M12.152 6.896c-.948 0-2.415-1.078-3.96-1.04-2.04.027-3.91 1.183-4.961 3.014-2.117 3.673-.546 9.632 1.539 12.786 1.023 1.542 2.238 3.271 3.834 3.211 1.529-.065 2.126-.989 3.997-.989 1.864 0 2.396.989 4.024.955 1.653-.024 2.7-1.52 3.717-3.07 1.17-1.77 1.653-3.485 1.68-3.573-.037-.014-3.222-1.24-3.255-4.914-.027-3.077 2.514-4.549 2.628-4.615-1.436-2.101-3.66-2.336-4.442-2.372-1.936-.153-3.564 1.107-4.797 1.107zm3.9-3.895c.837-.973 1.4-2.327 1.247-3.677-1.206.049-2.657.804-3.522 1.772-.776.848-1.437 2.222-1.256 3.535 1.315.101 2.673-.657 3.531-1.63z" />
    </svg>
  );
}

function PasswordChecklist({ password }: { password: string }) {
  if (!password) return null;
  return (
    <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1">
      {PASSWORD_REQUIREMENTS.map((req) => {
        const met = req.isMet(password);
        return (
          <span
            key={req.label}
            className={`flex items-center gap-1 text-xs ${met ? "text-(--success-text)" : "text-muted"}`}
          >
            {met ? <Check className="size-3" /> : <Circle className="size-3" />}
            {req.label}
          </span>
        );
      })}
    </div>
  );
}

function PhoneField({
  country,
  onCountryChange,
  phone,
  onPhoneChange,
}: {
  country: (typeof COUNTRIES)[number];
  onCountryChange: (c: (typeof COUNTRIES)[number]) => void;
  phone: string;
  onPhoneChange: (v: string) => void;
}) {
  return (
    <div className="mt-2 flex">
      <Select
        value={country.dialCode + country.name}
        onValueChange={(value) => {
          const found = COUNTRIES.find((c) => c.dialCode + c.name === value);
          if (found) onCountryChange(found);
        }}
      >
        <SelectTrigger className="shrink-0 rounded-xl rounded-r-none border-r-0 bg-mist py-3 data-[size=default]:h-auto">
          <SelectValue>
            <span>{country.flag}</span>
            <span className="text-ink">{country.dialCode}</span>
          </SelectValue>
        </SelectTrigger>
        <SelectContent className="w-64 min-w-64">
          {COUNTRIES.map((c) => (
            <SelectItem key={c.dialCode + c.name} value={c.dialCode + c.name}>
              <span>{c.flag}</span> {c.name} <span className="text-muted">{c.dialCode}</span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <input
        type="tel"
        required
        value={phone}
        onChange={(e) => onPhoneChange(e.target.value)}
        placeholder="Phone number"
        className="w-full rounded-xl rounded-l-none border border-hairline bg-paper px-4 py-3 text-sm text-ink outline-none placeholder:text-muted focus:border-ink"
      />
    </div>
  );
}

export default function RegisterForm() {
  const router = useRouter();

  const [name, setName] = useState("");
  const [country, setCountry] = useState<(typeof COUNTRIES)[number]>(DEFAULT_COUNTRY);
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [referralCode, setReferralCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Once a brand-new Google sign-in has no profile yet, we drop into this
  // mode: collect name/phone/referral before letting them into the app —
  // mirrors the app's CompleteProfileScreen so no one ends up half-registered.
  const [pendingGoogleUser, setPendingGoogleUser] = useState<User | null>(null);

  async function finishAndRedirect(user: User, successMessage: string) {
    const idToken = await user.getIdToken();
    await establishSession(idToken);
    toast.success(successMessage);
    router.push("/select-role");
    router.refresh();
  }

  async function handleGoogle() {
    if (loading) return;
    setLoading(true);
    setError(null);
    try {
      const credential = await signInWithPopup(auth, googleProvider);
      const existing = await getUserProfile(credential.user.uid);
      if (existing?.phone) {
        // Already fully registered — just continue in.
        await finishAndRedirect(credential.user, "Logged in successfully");
        return;
      }
      setName(credential.user.displayName ?? "");
      setPendingGoogleUser(credential.user);
    } catch (err) {
      const message = authErrorMessage(err);
      if (message) {
        setError(message);
        toast.error(message);
      }
    } finally {
      setLoading(false);
    }
  }

  async function handleEmailSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (loading) return;
    setError(null);

    if (!name.trim() || !email.trim() || !password || !confirmPassword || !phone.trim()) {
      setError("All fields are required.");
      return;
    }
    if (!isPasswordStrong(password)) {
      setError(
        "Password must be at least 8 characters and include an uppercase letter, a lowercase letter, a number, and a special character."
      );
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    const fullPhone = `${country.dialCode}${phone.trim()}`;
    if (!isPhoneValid(fullPhone)) {
      setError("Enter a valid phone number.");
      return;
    }
    const referrer = await resolveReferrer(referralCode);
    if (referrer === "invalid") {
      setError("Invalid referral code. Please check and try again.");
      return;
    }

    setLoading(true);
    let createdUid: string | null = null;
    try {
      const credential = await createUserWithEmailAndPassword(auth, email, password);
      createdUid = credential.user.uid;
      await updateProfile(credential.user, { displayName: name.trim() });

      const userId = await generateUserId();
      await createUserProfile({
        uid: credential.user.uid,
        userId,
        email,
        name: name.trim(),
        phone: fullPhone,
        signInMethod: "email",
        referrer,
        referralCodeUsed: referralCode.trim().toUpperCase() || undefined,
      });

      await finishAndRedirect(credential.user, "Account created");
    } catch (err) {
      const message = authErrorMessage(err);
      if (message) {
        setError(message);
        toast.error(message);
      } else if (createdUid) {
        // Auth succeeded but the Firestore write failed — delete the auth
        // account so the email isn't permanently locked out.
        try {
          await auth.currentUser?.delete();
        } catch {}
        setError("Something went wrong. Please try again.");
        toast.error("Something went wrong. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  }

  async function handleCompleteGoogleProfile(e: React.FormEvent) {
    e.preventDefault();
    if (loading || !pendingGoogleUser) return;
    setError(null);

    if (!name.trim() || !phone.trim()) {
      setError("Name and phone number are required.");
      return;
    }
    const fullPhone = `${country.dialCode}${phone.trim()}`;
    if (!isPhoneValid(fullPhone)) {
      setError("Enter a valid phone number.");
      return;
    }
    const referrer = await resolveReferrer(referralCode);
    if (referrer === "invalid") {
      setError("Invalid referral code. Please check and try again.");
      return;
    }

    setLoading(true);
    try {
      await updateProfile(pendingGoogleUser, { displayName: name.trim() });
      const userId = await generateUserId();
      await createUserProfile({
        uid: pendingGoogleUser.uid,
        userId,
        email: pendingGoogleUser.email ?? "",
        name: name.trim(),
        phone: fullPhone,
        photoUrl: pendingGoogleUser.photoURL ?? undefined,
        signInMethod: "google",
        referrer,
        referralCodeUsed: referralCode.trim().toUpperCase() || undefined,
      });
      await finishAndRedirect(pendingGoogleUser, "Account created");
    } catch {
      // Firestore write failed — sign out so no one is left authenticated
      // without a profile record, matching the app's cleanup behavior.
      await auth.signOut();
      setPendingGoogleUser(null);
      const message = "Account setup failed. Please sign in again.";
      setError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }

  if (pendingGoogleUser) {
    return (
      <form className="mt-8 space-y-5" onSubmit={handleCompleteGoogleProfile}>
        <p className="text-sm text-muted">
          Just a few more details to finish setting up {pendingGoogleUser.email}.
        </p>

        <div>
          <label htmlFor="name" className="text-sm font-medium text-ink">Full name</label>
          <input id="name" type="text" required value={name} onChange={(e) => setName(e.target.value)} placeholder="Juan Dela Cruz" className={inputClass} />
        </div>

        <div>
          <label className="text-sm font-medium text-ink">Phone number</label>
          <PhoneField country={country} onCountryChange={setCountry} phone={phone} onPhoneChange={setPhone} />
        </div>

        <div>
          <label htmlFor="referralCode" className="text-sm font-medium text-ink">Referral code (optional)</label>
          <input
            id="referralCode"
            type="text"
            value={referralCode}
            onChange={(e) => setReferralCode(e.target.value.toUpperCase())}
            placeholder="e.g. GX82KL19"
            className={inputClass}
          />
        </div>

        {error && (
          <p className="text-sm" style={{ color: "var(--danger-text)" }}>{error}</p>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-full bg-ink px-6 py-3 text-sm font-medium text-paper transition-opacity disabled:cursor-not-allowed disabled:opacity-40"
        >
          {loading ? "Saving…" : "Save & continue"}
        </button>
      </form>
    );
  }

  return (
    <form className="mt-8 space-y-5" onSubmit={handleEmailSubmit}>
      <button
        type="button"
        onClick={handleGoogle}
        disabled={loading}
        className="flex w-full items-center justify-center gap-2 rounded-full border border-hairline px-6 py-3 text-sm font-medium text-ink transition-colors hover:bg-mist disabled:cursor-not-allowed disabled:opacity-40"
      >
        <GoogleIcon />
        {loading ? "Signing up…" : "Continue with Google"}
      </button>

      <button
        type="button"
        disabled
        title="Coming soon"
        className="flex w-full items-center justify-center gap-2 rounded-full border border-hairline px-6 py-3 text-sm font-medium text-ink disabled:cursor-not-allowed disabled:opacity-40"
      >
        <AppleIcon />
        Continue with Apple
      </button>

      <div className="flex items-center gap-3">
        <span className="h-px flex-1 bg-[var(--hairline)]" aria-hidden />
        <span className="text-xs text-muted">or</span>
        <span className="h-px flex-1 bg-[var(--hairline)]" aria-hidden />
      </div>

      <div>
        <label htmlFor="name" className="text-sm font-medium text-ink">Full name</label>
        <input id="name" type="text" required value={name} onChange={(e) => setName(e.target.value)} placeholder="Juan Dela Cruz" className={inputClass} />
      </div>

      <div>
        <label className="text-sm font-medium text-ink">Phone number</label>
        <PhoneField country={country} onCountryChange={setCountry} phone={phone} onPhoneChange={setPhone} />
      </div>

      <div>
        <label htmlFor="email" className="text-sm font-medium text-ink">Email</label>
        <input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" className={inputClass} />
      </div>

      <div>
        <label htmlFor="password" className="text-sm font-medium text-ink">Password</label>
        <PasswordInput id="password" value={password} onChange={setPassword} placeholder="At least 8 characters" className={inputClass} />
        <PasswordChecklist password={password} />
      </div>

      <div>
        <label htmlFor="confirmPassword" className="text-sm font-medium text-ink">Confirm password</label>
        <PasswordInput id="confirmPassword" value={confirmPassword} onChange={setConfirmPassword} placeholder="Re-enter your password" className={inputClass} />
      </div>

      <div>
        <label htmlFor="referralCode" className="text-sm font-medium text-ink">Referral code (optional)</label>
        <input
          id="referralCode"
          type="text"
          value={referralCode}
          onChange={(e) => setReferralCode(e.target.value.toUpperCase())}
          placeholder="e.g. GX82KL19"
          className={inputClass}
        />
      </div>

      {error && (
        <p className="text-sm" style={{ color: "var(--danger-text)" }}>{error}</p>
      )}

      <button
        type="submit"
        disabled={loading}
        className="w-full rounded-full bg-ink px-6 py-3 text-sm font-medium text-paper transition-opacity disabled:cursor-not-allowed disabled:opacity-40"
      >
        {loading ? "Creating account…" : "Create account"}
      </button>

      <p className="text-center text-sm text-muted">
        Already have an account?{" "}
        <Link href="/login" className="font-medium text-ink hover:underline">
          Log in
        </Link>
      </p>
    </form>
  );
}
