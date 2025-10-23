"use client";

import { useState } from "react";
import { UnifiedAuthService } from "@/lib/aws/unified-auth";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    
    try {
      await UnifiedAuthService.signIn(email, password);
      router.push("/chat");
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Failed to log in. Please check your credentials.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-[#0a0a0b] relative overflow-hidden">
      {/* Background gradient effect */}
      <div className="absolute inset-0 bg-gradient-to-br from-[#818cf8]/10 via-transparent to-[#c084fc]/10 pointer-events-none" />
      
      {/* Animated background blobs */}
      <div className="absolute top-0 -left-4 w-96 h-96 bg-purple-500 rounded-full mix-blend-multiply filter blur-3xl opacity-10 animate-pulse" />
      <div className="absolute top-0 -right-4 w-96 h-96 bg-indigo-500 rounded-full mix-blend-multiply filter blur-3xl opacity-10 animate-pulse animation-delay-2000" />
      <div className="absolute -bottom-8 left-20 w-96 h-96 bg-pink-500 rounded-full mix-blend-multiply filter blur-3xl opacity-10 animate-pulse animation-delay-4000" />
      
      <div className="glass-dark rounded-2xl p-10 w-full max-w-md relative z-10 animate-fade-in-up">
        <form onSubmit={handleLogin} className="space-y-6">
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gradient-to-br from-[#818cf8] to-[#c084fc] mb-4 animate-glow">
              <span className="text-2xl">💬</span>
            </div>
            <h2 className="text-3xl font-bold text-[#e4e4e7] mb-2">
              Welcome back to <span className="gradient-text">chatapp</span>
            </h2>
            <p className="text-[#a1a1aa]">We're excited to see you again!</p>
          </div>
          
          {error && (
            <div className="bg-red-500/10 border border-red-500/30 text-red-400 px-4 py-3 rounded-lg text-sm animate-fade-in">
              {error}
            </div>
          )}
          
          <div className="space-y-4">
            <div>
              <label className="block text-[#a1a1aa] text-xs font-semibold uppercase mb-2 tracking-wider">
                Email Address
              </label>
              <input
                className="w-full bg-[#18181b] text-[#e4e4e7] placeholder-[#71717a] px-4 py-3 rounded-lg border border-[rgba(255,255,255,0.1)] outline-none focus:border-[#818cf8] focus:bg-[#1f1f23] transition-all"
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={loading}
              />
            </div>
            
            <div>
              <label className="block text-[#a1a1aa] text-xs font-semibold uppercase mb-2 tracking-wider">
                Password
              </label>
              <div className="relative">
                <input
                  className="w-full bg-[#18181b] text-[#e4e4e7] placeholder-[#71717a] px-4 py-3 pr-12 rounded-lg border border-[rgba(255,255,255,0.1)] outline-none focus:border-[#818cf8] focus:bg-[#1f1f23] transition-all"
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  disabled={loading}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[#71717a] hover:text-[#a1a1aa] transition-colors"
                  tabIndex={-1}
                >
                  {showPassword ? (
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z"/>
                    </svg>
                  ) : (
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M12 7c2.76 0 5 2.24 5 5 0 .65-.13 1.26-.36 1.83l2.92 2.92c1.51-1.26 2.7-2.89 3.43-4.75-1.73-4.39-6-7.5-11-7.5-1.4 0-2.74.25-3.98.7l2.16 2.16C10.74 7.13 11.35 7 12 7zM2 4.27l2.28 2.28.46.46C3.08 8.3 1.78 10.02 1 12c1.73 4.39 6 7.5 11 7.5 1.55 0 3.03-.3 4.38-.84l.42.42L19.73 22 21 20.73 3.27 3 2 4.27zM7.53 9.8l1.55 1.55c-.05.21-.08.43-.08.65 0 1.66 1.34 3 3 3 .22 0 .44-.03.65-.08l1.55 1.55c-.67.33-1.41.53-2.2.53-2.76 0-5-2.24-5-5 0-.79.2-1.53.53-2.2zm4.31-.78l3.15 3.15.02-.16c0-1.66-1.34-3-3-3l-.17.01z"/>
                    </svg>
                  )}
                </button>
              </div>
              <div className="flex items-center justify-between mt-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={showPassword}
                    onChange={(e) => setShowPassword(e.target.checked)}
                    className="w-4 h-4 rounded border-[#3f3f46] bg-[#18181b] text-[#818cf8] focus:ring-[#818cf8] focus:ring-offset-0"
                  />
                  <span className="text-xs text-[#71717a]">Show password</span>
                </label>
                <a href="#" className="text-[#818cf8] text-sm hover:text-[#a78bfa] transition-colors">
                  Forgot password?
                </a>
              </div>
            </div>
          </div>
          
          <button 
            className="w-full btn btn-primary py-3 text-base font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
            type="submit"
            disabled={loading}
          >
            {loading ? (
              <span className="flex items-center justify-center">
                <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Signing in...
              </span>
            ) : (
              "Sign In"
            )}
          </button>
          
          <div className="text-center">
            <p className="text-[#71717a] text-sm">
              Don't have an account?{" "}
              <Link href="/register" className="text-[#818cf8] hover:text-[#a78bfa] font-semibold transition-colors">
                Create one
              </Link>
            </p>
          </div>
        </form>
      </div>
    </div>
  );
}
