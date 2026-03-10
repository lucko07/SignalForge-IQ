import { useState } from "react";
import type { CSSProperties, FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { getAuthErrorMessage, login } from "../lib/auth";

function LoginPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");

    if (!email.trim()) {
      setError("Enter your email address.");
      return;
    }

    if (!password) {
      setError("Enter your password.");
      return;
    }

    setIsSubmitting(true);

    try {
      await login(email.trim(), password);
      navigate("/dashboard");
    } catch (loginError) {
      setError(getAuthErrorMessage(loginError));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <section style={{ maxWidth: "520px", margin: "0 auto" }}>
      <h1>Login</h1>
      <p>Sign in with your email and password to access your dashboard.</p>

      <form
        onSubmit={handleSubmit}
        style={{
          display: "grid",
          gap: "1rem",
          padding: "1.5rem",
          border: "1px solid #d0d5dd",
          borderRadius: "16px",
          backgroundColor: "#f8fafc",
        }}
      >
        <label style={{ display: "grid", gap: "0.4rem" }}>
          <span style={{ color: "#344054", fontWeight: 600 }}>Email</span>
          <input
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="you@example.com"
            autoComplete="email"
            style={inputStyle}
          />
        </label>

        <label style={{ display: "grid", gap: "0.4rem" }}>
          <span style={{ color: "#344054", fontWeight: 600 }}>Password</span>
          <input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="Enter your password"
            autoComplete="current-password"
            style={inputStyle}
          />
        </label>

        {error ? (
          <p
            style={{
              margin: 0,
              padding: "0.85rem 1rem",
              borderRadius: "12px",
              backgroundColor: "#fef3f2",
              color: "#b42318",
            }}
          >
            {error}
          </p>
        ) : null}

        <button
          type="submit"
          disabled={isSubmitting}
          style={{
            border: 0,
            borderRadius: "12px",
            padding: "0.95rem 1rem",
            backgroundColor: isSubmitting ? "#98a2b3" : "#101828",
            color: "#ffffff",
            fontWeight: 700,
            cursor: isSubmitting ? "not-allowed" : "pointer",
          }}
        >
          {isSubmitting ? "Signing in..." : "Log in"}
        </button>

        <p style={{ margin: 0 }}>
          Need an account?{" "}
          <Link to="/signup" style={{ color: "#101828", fontWeight: 700 }}>
            Sign up
          </Link>
        </p>
      </form>
    </section>
  );
}

const inputStyle = {
  width: "100%",
  padding: "0.85rem 0.9rem",
  borderRadius: "12px",
  border: "1px solid #d0d5dd",
  backgroundColor: "#ffffff",
  fontSize: "1rem",
} satisfies CSSProperties;

export default LoginPage;
