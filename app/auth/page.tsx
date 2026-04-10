"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { browserSupabase } from "@/lib/supabase/client";

export default function AuthPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    browserSupabase.auth.getSession().then(({ data }) => {
      if (data.session) {
        router.replace("/dashboard");
      }
    });
  }, [router]);

  async function handleAuth(intent: "signup" | "signin") {
    setMessage("");
    setLoading(true);

    try {
      if (intent === "signup") {
        const { error } = await browserSupabase.auth.signUp({
          email,
          password,
        });

        if (error) {
          throw error;
        }

        setMessage("Account created. If required, confirm your email and sign in.");
      } else {
        const { error } = await browserSupabase.auth.signInWithPassword({
          email,
          password,
        });

        if (error) {
          throw error;
        }

        router.replace("/dashboard");
      }
    } catch (error) {
      const err = error as Error;
      setMessage(err.message);
    } finally {
      setLoading(false);
    }
  }

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void handleAuth("signin");
  }

  return (
    <main className="page-shell">
      <section className="panel narrow">
        <h1>Sign in or create account</h1>
        <p className="muted">Email/password auth via Supabase.</p>

        <form onSubmit={onSubmit} className="stack">
          <label className="field">
            <span>Email</span>
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              autoComplete="email"
              required
            />
          </label>

          <label className="field">
            <span>Password</span>
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete="current-password"
              minLength={8}
              required
            />
          </label>

          <div className="actions">
            <button
              type="submit"
              className="btn btn-primary"
              disabled={loading}
            >
              {loading ? "Working..." : "Sign in"}
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              disabled={loading}
              onClick={() => void handleAuth("signup")}
            >
              Create account
            </button>
          </div>
        </form>

        {message && <p className="message">{message}</p>}
      </section>
    </main>
  );
}
