"use client";

import { useState } from "react";
import { auth, storage, db } from "@/lib/firebase";
import { ref, uploadBytes, getDownloadURL, listAll, deleteObject, getStorage } from "firebase/storage";
import { onAuthStateChanged } from "firebase/auth";
import { useEffect } from "react";
import Image from "next/image";
import { doc, getDoc } from "firebase/firestore";

export default function TestStoragePage() {
  const [user, setUser] = useState<any>(null);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string>("");
  const [uploading, setUploading] = useState(false);
  const [uploadedUrl, setUploadedUrl] = useState<string>("");
  const [existingImages, setExistingImages] = useState<string[]>([]);
  const [error, setError] = useState<string>("");
  const [success, setSuccess] = useState<string>("");
  const [storageInfo, setStorageInfo] = useState<any>(null);
  const [debugInfo, setDebugInfo] = useState<string[]>([]);

  const addDebug = (info: string) => {
    setDebugInfo(prev => [...prev, `${new Date().toISOString()}: ${info}`]);
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        addDebug(`User authenticated: ${currentUser.uid}`);
        loadExistingImages(currentUser.uid);
        try {
          setStorageInfo({
            bucket: storage.app.options.storageBucket,
            projectId: storage.app.options.projectId,
          });
          addDebug(`Storage initialized with bucket: ${storage.app.options.storageBucket}`);
        } catch (e: any) {
          addDebug(`Error getting storage info: ${e.message}`);
          setError(`Error getting storage info: ${e.message}`);
        }
      } else {
        addDebug('User not authenticated.');
      }
    });
    return () => unsubscribe();
  }, []);

  const loadExistingImages = async (userId: string) => {
    try {
      addDebug(`Skipping image list fetch due to CORS - will implement after upload test`);
      // Temporarily disabled listAll due to CORS
      // const listRef = ref(storage, `profilePictures/${userId}`);
      // const res = await listAll(listRef);
      // addDebug(`Found ${res.items.length} existing images`);
      // const urls = await Promise.all(
      //   res.items.map(async (itemRef) => {
      //     return await getDownloadURL(itemRef);
      //   })
      // );
      // setExistingImages(urls);
      // addDebug(`Successfully fetched ${urls.length} image URLs`);
    } catch (error: any) {
      console.log("No existing images or error loading:", error);
      addDebug(`Error loading images: ${error.message}`);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      if (selectedFile.size > 5 * 1024 * 1024) {
        setError("File must be less than 5MB");
        return;
      }
      
      if (!selectedFile.type.startsWith("image/")) {
        setError("File must be an image");
        return;
      }
      
      setError("");
      setFile(selectedFile);
      
      const reader = new FileReader();
      reader.onloadend = () => {
        setPreview(reader.result as string);
      };
      reader.readAsDataURL(selectedFile);
    }
  };

  const handleUpload = async () => {
    if (!file || !user) {
      setError("Please select a file and make sure you're logged in");
      addDebug("Upload failed: No file or user");
      return;
    }

    setUploading(true);
    setError("");
    setSuccess("");

    try {
      addDebug(`Starting upload for file: ${file.name} (${file.size} bytes)`);
      addDebug(`User UID: ${user.uid}`);
      addDebug(`Storage bucket: ${storage.app.options.storageBucket}`);
      
      const timestamp = Date.now();
      const fileExtension = file.name.split('.').pop() || 'jpg';
      const fileName = `profilePictures/${user.uid}/test_${timestamp}.${fileExtension}`;
      
      addDebug(`Full path: ${fileName}`);
      console.log("Uploading to:", fileName);
      
      const storageRef = ref(storage, fileName);
      addDebug("Storage reference created");
      
      const snapshot = await uploadBytes(storageRef, file);
      addDebug(`Upload complete. Snapshot metadata: ${JSON.stringify(snapshot.metadata)}`);
      
      const downloadUrl = await getDownloadURL(snapshot.ref);
      addDebug(`Download URL obtained: ${downloadUrl.substring(0, 100)}...`);
      
      setUploadedUrl(downloadUrl);
      setSuccess("File uploaded successfully!");
      console.log("Upload successful! URL:", downloadUrl);
      
      // Reload existing images
      loadExistingImages(user.uid);
      
      // Reset file selection
      setFile(null);
      setPreview("");
    } catch (error: any) {
      console.error("Upload error:", error);
      addDebug(`Upload error: ${error.message}`);
      addDebug(`Error stack: ${error.stack}`);
      setError(`Upload failed: ${error.message}`);
    } finally {
      setUploading(false);
    }
  };

  const deleteImage = async (url: string) => {
    try {
      // Extract the path from the URL
      const decodedUrl = decodeURIComponent(url);
      const pathMatch = decodedUrl.match(/\/o\/(.*?)\?/);
      if (pathMatch && pathMatch[1]) {
        const path = pathMatch[1].replace(/%2F/g, '/');
        const imageRef = ref(storage, path);
        await deleteObject(imageRef);
        setSuccess("Image deleted successfully!");
        loadExistingImages(user.uid);
      }
    } catch (error: any) {
      console.error("Delete error:", error);
      setError(`Delete failed: ${error.message}`);
    }
  };

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-[#0a0a0b]">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-white mb-4">Storage Test</h1>
          <p className="text-gray-400">Please log in first to test storage</p>
          <a href="/login" className="text-blue-500 underline mt-4 inline-block">
            Go to Login
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0a0b] p-8">
      <div className="max-w-4xl mx-auto">
        <div className="bg-[#18181b] rounded-lg p-6 border border-[#27272a]">
          <h1 className="text-2xl font-bold text-white mb-6">Firebase Storage Test</h1>
          
          <div className="mb-4">
            <p className="text-sm text-gray-400">Logged in as: {user.email}</p>
            <p className="text-sm text-gray-400">User ID: {user.uid}</p>
            {storageInfo && (
              <>
                <p className="text-sm text-gray-400">Storage Bucket: {storageInfo.bucket}</p>
                <p className="text-sm text-gray-400">Project ID: {storageInfo.projectId}</p>
              </>
            )}
          </div>

          {error && (
            <div className="bg-red-500/10 border border-red-500/30 text-red-400 px-4 py-2 rounded-lg mb-4">
              {error}
            </div>
          )}

          {success && (
            <div className="bg-green-500/10 border border-green-500/30 text-green-400 px-4 py-2 rounded-lg mb-4">
              {success}
            </div>
          )}

          {/* Upload Section */}
          <div className="mb-8">
            <h2 className="text-lg font-semibold text-white mb-4">Upload Test</h2>
            
            <div className="space-y-4">
              <input
                type="file"
                accept="image/*"
                onChange={handleFileChange}
                className="block w-full text-sm text-gray-400
                  file:mr-4 file:py-2 file:px-4
                  file:rounded-full file:border-0
                  file:text-sm file:font-semibold
                  file:bg-violet-600 file:text-white
                  hover:file:bg-violet-700"
              />

              {preview && (
                <div className="mt-4">
                  <p className="text-sm text-gray-400 mb-2">Preview:</p>
                  <img 
                    src={preview} 
                    alt="Preview" 
                    className="w-32 h-32 object-cover rounded-lg"
                  />
                </div>
              )}

              <button
                onClick={handleUpload}
                disabled={!file || uploading}
                className="px-4 py-2 bg-violet-600 text-white rounded-lg hover:bg-violet-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {uploading ? "Uploading..." : "Upload Image"}
              </button>
              
              {/* Simple test upload without file input */}
              <button
                onClick={async () => {
                  addDebug('Starting simple test upload...');
                  try {
                    const testBlob = new Blob(['test'], { type: 'text/plain' });
                    const testFile = new File([testBlob], 'test.txt', { type: 'text/plain' });
                    const testRef = ref(storage, `test/${user.uid}/test_${Date.now()}.txt`);
                    addDebug('Uploading test file...');
                    const snapshot = await uploadBytes(testRef, testFile);
                    addDebug(`Test upload successful: ${JSON.stringify(snapshot.metadata)}`);
                    const url = await getDownloadURL(snapshot.ref);
                    addDebug(`Test download URL: ${url}`);
                    setSuccess('Simple test upload successful!');
                  } catch (error: any) {
                    addDebug(`Simple test upload error: ${error.message}`);
                    setError(`Simple test failed: ${error.message}`);
                  }
                }}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                Run Simple Test Upload
              </button>
            </div>
          </div>

          {/* Uploaded Image Display */}
          {uploadedUrl && (
            <div className="mb-8">
              <h2 className="text-lg font-semibold text-white mb-4">Last Upload</h2>
              <div className="bg-[#0a0a0b] p-4 rounded-lg">
                <p className="text-xs text-gray-400 mb-2 break-all">URL: {uploadedUrl}</p>
                <img 
                  src={uploadedUrl} 
                  alt="Uploaded" 
                  className="w-32 h-32 object-cover rounded-lg"
                />
              </div>
            </div>
          )}

          {/* Existing Images */}
          {existingImages.length > 0 && (
            <div>
              <h2 className="text-lg font-semibold text-white mb-4">
                Your Uploaded Images ({existingImages.length})
              </h2>
              <div className="grid grid-cols-3 gap-4">
                {existingImages.map((url, index) => (
                  <div key={index} className="bg-[#0a0a0b] p-2 rounded-lg">
                    <img 
                      src={url} 
                      alt={`Upload ${index + 1}`} 
                      className="w-full h-32 object-cover rounded-lg mb-2"
                    />
                    <button
                      onClick={() => deleteImage(url)}
                      className="text-xs text-red-400 hover:text-red-300"
                    >
                      Delete
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Debug Console */}
        {debugInfo.length > 0 && (
          <div className="bg-[#18181b] rounded-lg p-6 border border-[#27272a] mt-4">
            <h2 className="text-lg font-semibold text-white mb-4">Debug Console</h2>
            <div className="bg-[#0a0a0b] p-4 rounded-lg max-h-60 overflow-y-auto">
              <pre className="text-xs text-gray-400 font-mono">
                {debugInfo.map((line, i) => (
                  <div key={i} className="mb-1">{line}</div>
                ))}
              </pre>
            </div>
            <button
              onClick={() => setDebugInfo([])}
              className="mt-2 text-sm text-gray-500 hover:text-gray-400"
            >
              Clear Debug Log
            </button>
          </div>
        )}

        <div className="mt-4 text-center">
          <a href="/chat" className="text-blue-500 underline">
            Back to Chat
          </a>
        </div>
      </div>
    </div>
  );
}
