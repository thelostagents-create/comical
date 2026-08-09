import { useState, type FormEvent, type ReactNode } from "react";
import { useAuth, isSupabaseConfigured } from "../auth";

function SetupNotice() {
  return (
    <div className="auth-screen">
      <div className="auth-card">
        <h1>Comical</h1>
        <p>
          Supabase isn't configured yet. Copy <code>.env.example</code> to{" "}
          <code>.env.local</code>, fill in your project's URL and anon key, run the
          migration in <code>supabase/migrations/0001_init.sql</code>, then restart the
          dev server.
        </p>
      </div>
    </div>
  );
}

function AuthForm() {
  const { signIn, signUp } = useAuth();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [username, setUsername] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    const err =
      mode === "signin"
        ? await signIn(email, password)
        : await signUp(email, password, username);
    setBusy(false);
    if (err) setError(err);
  }

  return (
    <div className="auth-screen">
      <form className="auth-card" onSubmit={handleSubmit}>
        <h1>Comical</h1>
        <p className="auth-tagline">Track what you read. See what your friends read.</p>

        {mode === "signup" && (
          <label className="field">
            <span>Username</span>
            <input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="wolverine_fan"
              autoComplete="username"
              required
            />
          </label>
        )}
        <label className="field">
          <span>Email</span>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            required
          />
        </label>
        <label className="field">
          <span>Password</span>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete={mode === "signin" ? "current-password" : "new-password"}
            minLength={6}
            required
          />
        </label>

        {error && <div className="auth-error">{error}</div>}

        <button type="submit" className="btn-primary" disabled={busy}>
          {busy ? "Please wait…" : mode === "signin" ? "Log in" : "Sign up"}
        </button>

        <button
          type="button"
          className="btn-link"
          onClick={() => {
            setError(null);
            setMode(mode === "signin" ? "signup" : "signin");
          }}
        >
          {mode === "signin" ? "Need an account? Sign up" : "Already have an account? Log in"}
        </button>
      </form>
    </div>
  );
}

export default function AuthGate({ children }: { children: ReactNode }) {
  const { session, loading, profile } = useAuth();

  if (!isSupabaseConfigured) return <SetupNotice />;
  if (loading) return <div className="auth-screen">Loading…</div>;
  if (!session) return <AuthForm />;
  if (!profile) return <div className="auth-screen">Setting up your profile…</div>;

  return <>{children}</>;
}
