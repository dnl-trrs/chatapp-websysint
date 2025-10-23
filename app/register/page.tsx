"use client";

import { useState } from "react";
import { UnifiedAuthService } from "@/lib/aws/unified-auth";
import { db, storage } from "@/lib/firebase";
import { doc, setDoc, getDoc, query, collection, where, getDocs, serverTimestamp } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";

export default function RegisterPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [displayName, setDisplayName] = useState("");
  const [username, setUsername] = useState("");
  const [profilePicture, setProfilePicture] = useState<File | null>(null);
  const [profilePicturePreview, setProfilePicturePreview] = useState<string>("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [checkingUsername, setCheckingUsername] = useState(false);
  const [usernameAvailable, setUsernameAvailable] = useState<boolean | null>(null);
  const router = useRouter();

  const checkUsernameAvailability = async (usernameToCheck: string) => {
    if (!usernameToCheck || usernameToCheck.length < 3) {
      setUsernameAvailable(null);
      return;
    }
    
    setCheckingUsername(true);
    try {
      const q = query(collection(db, "users"), where("username", "==", usernameToCheck.toLowerCase()));
      const querySnapshot = await getDocs(q);
      setUsernameAvailable(querySnapshot.empty);
    } catch (error) {
      console.error("Error checking username:", error);
    } finally {
      setCheckingUsername(false);
    }
  };

  const handleUsernameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '');
    setUsername(value);
    if (value.length >= 3) {
      checkUsernameAvailability(value);
    } else {
      setUsernameAvailable(null);
    }
  };

  const handleProfilePictureChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        setError("Profile picture must be less than 5MB");
        return;
      }
      setProfilePicture(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setProfilePicturePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    
    if (!usernameAvailable) {
      setError("Username is not available");
      setLoading(false);
      return;
    }

    try {
      // Create user with unified auth service
      const user = await UnifiedAuthService.signUp(email, password, displayName);
      
      let photoURL = "";
      
      // Upload profile picture if provided
      if (profilePicture) {
        const timestamp = Date.now();
        const fileExtension = profilePicture.name.split('.').pop() || 'jpg';
        const fileName = `profilePictures/${user.uid}/avatar_${timestamp}.${fileExtension}`;
        const storageRef = ref(storage, fileName);
        const snapshot = await uploadBytes(storageRef, profilePicture);
        photoURL = await getDownloadURL(snapshot.ref);
        
        // Update profile with photo URL
        await UnifiedAuthService.updateProfile({ photoURL });
      }

      // Save user in Firestore with all fields
      await setDoc(doc(db, "users", user.uid), {
        uid: user.uid,
        email,
        displayName,
        username: username.toLowerCase(),
        photoURL,
        bio: "",
        status: "online",
        servers: [],
        conversations: [],
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });

      router.push("/chat");
    } catch (err) {
      console.error(err);
      const error = err as { message?: string };
      setError(error.message || "Failed to register. Please try again.");
    } finally {
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
      
      <div className="glass-dark rounded-2xl p-6 w-full max-w-md relative z-10 animate-fade-in-up max-h-[90vh] overflow-y-auto">
        <form onSubmit={handleRegister} className="space-y-4">
          <div className="text-center mb-4">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-gradient-to-br from-[#818cf8] to-[#c084fc] mb-2 animate-glow">
              <span className="text-xl">✨</span>
            </div>
            <h2 className="text-2xl font-bold text-[#e4e4e7] mb-1">
              Join <span className="gradient-text">chatapp</span>
            </h2>
            <p className="text-[#a1a1aa] text-sm">Start connecting with your friends today</p>
          </div>
          
          {error && (
            <div className="bg-red-500/10 border border-red-500/30 text-red-400 px-3 py-2 rounded-lg text-xs animate-fade-in">
              {error}
            </div>
          )}
          
          <div className="space-y-3">
            {/* Profile Picture Upload */}
            <div className="flex justify-center">
              <div className="relative">
                <label htmlFor="profile-upload" className="cursor-pointer">
                  <div className="w-16 h-16 rounded-full overflow-hidden bg-gradient-to-br from-[#818cf8] to-[#c084fc] flex items-center justify-center">
                    {profilePicturePreview ? (
                      <Image
                        src={profilePicturePreview}
                        alt="Profile preview"
                        width={64}
                        height={64}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <svg width="28" height="28" viewBox="0 0 24 24" fill="white">
                        <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/>
                      </svg>
                    )}
                  </div>
                  <div className="absolute bottom-0 right-0 w-6 h-6 bg-[#818cf8] rounded-full flex items-center justify-center border-2 border-[#0a0a0b]">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="white">
                      <path d="M20 4h-3.17L15 2H9L7.17 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm-8 11c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5z"/>
                    </svg>
                  </div>
                </label>
                <input
                  id="profile-upload"
                  type="file"
                  accept="image/*"
                  onChange={handleProfilePictureChange}
                  className="hidden"
                />
              </div>
            </div>
            
            <div>
              <label className="block text-[#a1a1aa] text-xs font-semibold uppercase mb-2 tracking-wider">
                Display Name
              </label>
              <input
                className="w-full bg-[#18181b] text-[#e4e4e7] placeholder-[#71717a] px-3 py-2 rounded-lg border border-[rgba(255,255,255,0.1)] outline-none focus:border-[#818cf8] focus:bg-[#1f1f23] transition-all text-sm"
                type="text"
                placeholder="How others will see you"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                required
                disabled={loading}
                minLength={2}
                maxLength={32}
              />
            </div>
            
            <div>
              <label className="block text-[#a1a1aa] text-xs font-semibold uppercase mb-2 tracking-wider">
                Username
              </label>
              <div className="relative">
                <input
                  className="w-full bg-[#18181b] text-[#e4e4e7] placeholder-[#71717a] px-3 py-2 pr-10 rounded-lg border border-[rgba(255,255,255,0.1)] outline-none focus:border-[#818cf8] focus:bg-[#1f1f23] transition-all text-sm"
                  type="text"
                  placeholder="unique_username"
                  value={username}
                  onChange={handleUsernameChange}
                  required
                  disabled={loading}
                  minLength={3}
                  maxLength={20}
                  pattern="[a-z0-9_]+"
                />
                <div className="absolute right-2 top-1/2 -translate-y-1/2">
                  {checkingUsername && (
                    <svg className="animate-spin h-4 w-4 text-[#818cf8]" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                  )}
                  {!checkingUsername && usernameAvailable === true && username.length >= 3 && (
                    <svg className="h-4 w-4 text-green-500" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                  )}
                  {!checkingUsername && usernameAvailable === false && (
                    <svg className="h-4 w-4 text-red-500" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                    </svg>
                  )}
                </div>
              </div>
              <p className="text-[#71717a] text-xs mt-1">
                {usernameAvailable === false && "Username is already taken"}
                {usernameAvailable === true && "Username is available!"}
                {usernameAvailable === null && "Lowercase letters, numbers, and underscores only"}
              </p>
            </div>
            
            <div>
              <label className="block text-[#a1a1aa] text-xs font-semibold uppercase mb-2 tracking-wider">
                Email Address
              </label>
              <input
                className="w-full bg-[#18181b] text-[#e4e4e7] placeholder-[#71717a] px-3 py-2 rounded-lg border border-[rgba(255,255,255,0.1)] outline-none focus:border-[#818cf8] focus:bg-[#1f1f23] transition-all text-sm"
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
                  className="w-full bg-[#18181b] text-[#e4e4e7] placeholder-[#71717a] px-3 py-2 pr-10 rounded-lg border border-[rgba(255,255,255,0.1)] outline-none focus:border-[#818cf8] focus:bg-[#1f1f23] transition-all text-sm"
                  type={showPassword ? "text" : "password"}
                  placeholder="Create a strong password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  disabled={loading}
                  minLength={6}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-[#71717a] hover:text-[#a1a1aa] transition-colors"
                  tabIndex={-1}
                >
                  {showPassword ? (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z"/>
                    </svg>
                  ) : (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M12 7c2.76 0 5 2.24 5 5 0 .65-.13 1.26-.36 1.83l2.92 2.92c1.51-1.26 2.7-2.89 3.43-4.75-1.73-4.39-6-7.5-11-7.5-1.4 0-2.74.25-3.98.7l2.16 2.16C10.74 7.13 11.35 7 12 7zM2 4.27l2.28 2.28.46.46C3.08 8.3 1.78 10.02 1 12c1.73 4.39 6 7.5 11 7.5 1.55 0 3.03-.3 4.38-.84l.42.42L19.73 22 21 20.73 3.27 3 2 4.27zM7.53 9.8l1.55 1.55c-.05.21-.08.43-.08.65 0 1.66 1.34 3 3 3 .22 0 .44-.03.65-.08l1.55 1.55c-.67.33-1.41.53-2.2.53-2.76 0-5-2.24-5-5 0-.79.2-1.53.53-2.2zm4.31-.78l3.15 3.15.02-.16c0-1.66-1.34-3-3-3l-.17.01z"/>
                    </svg>
                  )}
                </button>
              </div>
              <div className="flex items-center justify-between mt-1">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={showPassword}
                    onChange={(e) => setShowPassword(e.target.checked)}
                    className="w-3.5 h-3.5 rounded border-[#3f3f46] bg-[#18181b] text-[#818cf8] focus:ring-[#818cf8] focus:ring-offset-0"
                  />
                  <span className="text-xs text-[#71717a]">Show password</span>
                </label>
                <p className="text-[#71717a] text-xs">
                  Min. 6 characters
                </p>
              </div>
            </div>
          </div>
          
          <div className="space-y-3">
            <button 
              className="w-full btn btn-primary py-2.5 text-sm font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
              type="submit"
              disabled={loading}
            >
              {loading ? (
                <span className="flex items-center justify-center">
                  <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Creating account...
                </span>
              ) : (
                "Create Account"
              )}
            </button>
            
            <p className="text-[#71717a] text-xs text-center">
              By registering, you agree to our Terms of Service and Privacy Policy
            </p>
          </div>
          
          <div className="text-center pt-2 border-t border-[rgba(255,255,255,0.1)]">
            <p className="text-[#71717a] text-sm">
              Already have an account?{" "}
              <Link href="/login" className="text-[#818cf8] hover:text-[#a78bfa] font-semibold transition-colors">
                Sign in
              </Link>
            </p>
          </div>
        </form>
      </div>
    </div>
  );
}
