
import { useEffect, useState } from "react";
import {
  GoogleAuthProvider,
  browserLocalPersistence,
  onAuthStateChanged,
  setPersistence,
  signInWithPopup,
  signOut,
} from "firebase/auth";
import { auth } from "./firebase";

export default function App() {
  const [user, setUser] = useState(null);
  const [initializing, setInitializing] = useState(true);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState("");

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setInitializing(false);
    });

    return unsubscribe;
  }, []);

  async function handleGoogleSignIn() {
    setBusy(true);
    setResult("");

    try {
      await setPersistence(auth, browserLocalPersistence);

      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);

      setResult("Google Sign-In successful.");
    } catch (error) {
      setResult(`Sign-in failed: ${error.code || error.message}`);
    } finally {
      setBusy(false);
    }
  }

  async function handleSignOut() {
    setBusy(true);

    try {
      await signOut(auth);
      setResult("Signed out.");
    } catch (error) {
      setResult(`Sign-out failed: ${error.message}`);
    } finally {
      setBusy(false);
    }
  }

  async function testBackend(mode) {
    setBusy(true);
    setResult("Sending request to Apps Script...");

    try {
      let idToken = null;

      if (mode === "valid") {
        if (!user) {
          throw new Error("Please sign in first.");
        }

        idToken = await user.getIdToken();
      }

      if (mode === "invalid") {
        idToken = "not-a-valid-firebase-id-token";
      }

      const response = await fetch(
        import.meta.env.VITE_APPS_SCRIPT_URL,
        {
          method: "POST",
          headers: {
            "Content-Type": "text/plain;charset=utf-8",
          },
          body: JSON.stringify({
            action: "verifySession",
            idToken,
          }),
        }
      );

      const data = await response.json();
      setResult(JSON.stringify(data, null, 2));
    } catch (error) {
      setResult(`Request failed: ${error.message}`);
    } finally {
      setBusy(false);
    }
  }

  if (initializing) {
    return <main>Restoring authentication session...</main>;
  }

  return (
    <main style={{ padding: 32, maxWidth: 640 }}>
      <h1>QuizKada — Authentication Test</h1>

      {user ? (
        <>
          <p>Signed in as: {user.displayName || "Student"}</p>
          <button disabled={busy} onClick={handleSignOut}>
            Sign Out
          </button>
        </>
      ) : (
        <button disabled={busy} onClick={handleGoogleSignIn}>
          Continue with Google
        </button>
      )}

      <hr />

      <h2>Backend Verification</h2>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <button disabled={busy || !user}
                onClick={() => testBackend("valid")}>
          Test Valid Token
        </button>

        <button disabled={busy}
                onClick={() => testBackend("missing")}>
          Test Missing Token
        </button>

        <button disabled={busy}
                onClick={() => testBackend("invalid")}>
          Test Invalid Token
        </button>
      </div>

      <pre style={{ whiteSpace: "pre-wrap" }}>
        {result}
      </pre>
    </main>
  );
}