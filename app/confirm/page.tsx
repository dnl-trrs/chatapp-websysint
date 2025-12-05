"use client";

import { useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";

export default function ConfirmPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const email = searchParams.get("email") || "";
  
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const handleConfirm = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/auth/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, code })
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Confirmation failed");
      }

      setSuccess(true);
      setTimeout(() => {
        router.push("/login");
      }, 2000);
    } catch (err) {
      console.error(err);
      const error = err as { message?: string };
      setError(error.message || "Failed to confirm. Please try again.");
      setLoading(false);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-[#0a0a0b] relative overflow-hidden p-4">
      {/* Background gradient effect */}
      <div className="absolute inset-0 bg-gradient-to-br from-[#818cf8]/10 via-transparent to-[#c084fc]/10 pointer-events-none" />
      
      {/* Animated background blobs */}
      <div className="absolute top-0 -left-4 w-96 h-96 bg-purple-500 rounded-full mix-blend-multiply filter blur-3xl opacity-10 animate-pulse" />
      <div className="absolute top-0 -right-4 w-96 h-96 bg-indigo-500 rounded-full mix-blend-multiply filter blur-3xl opacity-10 animate-pulse animation-delay-2000" />
      <div className="absolute -bottom-8 left-20 w-96 h-96 bg-pink-500 rounded-full mix-blend-multiply filter blur-3xl opacity-10 animate-pulse animation-delay-4000" />
      
      <div className="glass-dark rounded-2xl p-6 w-full max-w-md relative z-10 animate-fade-in-up">
        <form onSubmit={handleConfirm} className="space-y-4">
          <div className="text-center mb-4">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-gradient-to-br from-[#818cf8] to-[#c084fc] mb-2 animate-glow">
              <span className="text-xl">✉️</span>
            </div>
            <h2 className="text-2xl font-bold text-[#e4e4e7] mb-1">
              Confirm Your Email
            </h2>
            <p className="text-[#a1a1aa] text-sm">
              Enter the code sent to {email}
            </p>
          </div>
          
          {success && (
            <div className="bg-green-500/10 border border-green-500/30 text-green-400 px-3 py-2 rounded-lg text-xs animate-fade-in">
              ✓ Email confirmed! Redirecting to login...
            </div>
          )}
          
          {error && (
            <div className="bg-red-500/10 border border-red-500/30 text-red-400 px-3 py-2 rounded-lg text-xs animate-fade-in">
              {error}
            </div>
          )}
          
          <div>
            <label className="block text-[#a1a1aa] text-xs font-semibold uppercase mb-2 tracking-wider">
              Confirmation Code
            </label>
            <input
              className="w-full bg-[#18181b] text-[#e4e4e7] placeholder-[#71717a] px-3 py-2 rounded-lg border border-[rgba(255,255,255,0.1)] outline-none focus:border-[#818cf8] focus:bg-[#1f1f23] transition-all text-sm text-center text-lg font-mono tracking-widest"
              type="text"
              placeholder="000000"
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
              required
              disabled={loading || success}
              maxLength={6}
            />
            <p className="text-[#71717a] text-xs mt-1">
              Check your email for a 6-digit code
            </p>
          </div>
          
          <button 
            className="w-full btn btn-primary py-2.5 text-sm font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
            type="submit"
            disabled={loading || success || code.length !== 6}
          >
            {loading ? (
              <span className="flex items-center justify-center">
                <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Confirming...
              </span>
            ) : (
              "Confirm Email"
            )}
          </button>
          
          <div className="text-center pt-2 border-t border-[rgba(255,255,255,0.1)]">
            <p className="text-[#71717a] text-sm">
              Didn't receive a code?{" "}
              <Link href="/register" className="text-[#818cf8] hover:text-[#a78bfa] font-semibold transition-colors">
                Try again
              </Link>
            </p>
          </div>
        </form>
      </div>
    </div>
  );
}
