import {
  doc,
  setDoc,
  getDoc,
  deleteDoc,
  collection,
  query,
  where,
  getDocs,
  serverTimestamp,
  Timestamp,
  onSnapshot,
  Unsubscribe,
  orderBy,
  limit
} from "firebase/firestore";
import { db } from "./firebase";

export interface FriendRequest {
  id?: string;
  fromUid: string;
  toUid: string;
  fromDisplayName: string;
  toDisplayName: string;
  status: "pending" | "accepted" | "rejected";
  createdAt: Timestamp;
  updatedAt?: Timestamp;
}

export interface Friend {
  uid: string;
  displayName: string;
  photoURL?: string;
  username?: string;
  status?: "online" | "idle" | "dnd" | "offline";
  addedAt: Timestamp;
}

/**
 * Send a friend request to another user
 */
export const sendFriendRequest = async (
  fromUid: string,
  toUid: string,
  fromDisplayName?: string,
  toDisplayName?: string
): Promise<void> => {
  try {
    // Check if already friends first
    const alreadyFriends = await checkIfFriends(fromUid, toUid);
    if (alreadyFriends) {
      throw new Error("You are already friends with this user");
    }
    
    // Check if a pending request already exists
    const existingRequest = await checkExistingRequest(fromUid, toUid);
    if (existingRequest) {
      throw new Error("A friend request is already pending with this user");
    }
    
    // Clean up any old accepted/rejected requests before creating new one
    await cleanupOldRequests(fromUid, toUid);

    // Get display names if not provided
    let finalFromDisplayName: string = fromDisplayName || "";
    let finalToDisplayName: string = toDisplayName || "";
    
    if (!finalFromDisplayName) {
      const fromUserDoc = await getDoc(doc(db, "users", fromUid));
      finalFromDisplayName = fromUserDoc.data()?.displayName || "Unknown";
    }
    
    if (!finalToDisplayName) {
      const toUserDoc = await getDoc(doc(db, "users", toUid));
      finalToDisplayName = toUserDoc.data()?.displayName || "Unknown";
    }

    // Create friend request document
    const requestId = `${fromUid}_${toUid}`;
    const requestRef = doc(db, "friendRequests", requestId);
    
    const requestData: FriendRequest = {
      fromUid,
      toUid,
      fromDisplayName: finalFromDisplayName,
      toDisplayName: finalToDisplayName,
      status: "pending",
      createdAt: serverTimestamp() as Timestamp,
    };

    await setDoc(requestRef, requestData);
  } catch (error) {
    console.error("Error sending friend request:", error);
    throw error;
  }
};

/**
 * Accept a friend request
 */
export const acceptFriendRequest = async (fromUid: string, toUid: string): Promise<void> => {
  try {
    // Try both possible request IDs
    const requestId1 = `${fromUid}_${toUid}`;
    const requestId2 = `${toUid}_${fromUid}`;
    
    const requestRef1 = doc(db, "friendRequests", requestId1);
    const requestRef2 = doc(db, "friendRequests", requestId2);
    
    const [requestSnap1, requestSnap2] = await Promise.all([
      getDoc(requestRef1),
      getDoc(requestRef2)
    ]);

    let requestRef: any;
    let request: FriendRequest;
    
    if (requestSnap1.exists()) {
      requestRef = requestRef1;
      request = requestSnap1.data() as FriendRequest;
    } else if (requestSnap2.exists()) {
      requestRef = requestRef2;
      request = requestSnap2.data() as FriendRequest;
    } else {
      throw new Error("Friend request not found");
    }

    // Update request status
    await setDoc(requestRef, {
      ...request,
      status: "accepted",
      updatedAt: serverTimestamp(),
    });

    // Add to friends collections for both users
    await addToFriendsList(request.fromUid, request.toUid);
    await addToFriendsList(request.toUid, request.fromUid);
  } catch (error) {
    console.error("Error accepting friend request:", error);
    throw error;
  }
};

/**
 * Reject a friend request
 */
export const rejectFriendRequest = async (requestId: string): Promise<void> => {
  try {
    const requestRef = doc(db, "friendRequests", requestId);
    await deleteDoc(requestRef);
  } catch (error) {
    console.error("Error rejecting friend request:", error);
    throw error;
  }
};

/**
 * Remove a friend
 */
export const removeFriend = async (userId: string, friendId: string): Promise<void> => {
  try {
    // Remove from both users' friend lists
    const userFriendRef = doc(db, "users", userId, "friends", friendId);
    const friendUserRef = doc(db, "users", friendId, "friends", userId);

    await deleteDoc(userFriendRef);
    await deleteDoc(friendUserRef);

    // Also delete any existing friend requests between them
    const requestId1 = `${userId}_${friendId}`;
    const requestId2 = `${friendId}_${userId}`;
    
    try {
      await deleteDoc(doc(db, "friendRequests", requestId1));
    } catch {
      // Ignore if doesn't exist
    }
    
    try {
      await deleteDoc(doc(db, "friendRequests", requestId2));
    } catch {
      // Ignore if doesn't exist
    }
  } catch (error) {
    console.error("Error removing friend:", error);
    throw error;
  }
};

/**
 * Get all friends for a user
 */
export const getFriends = async (userId: string): Promise<Friend[]> => {
  try {
    const friendsRef = collection(db, "users", userId, "friends");
    const friendsSnap = await getDocs(friendsRef);

    const friends: Friend[] = [];
    
    for (const docSnap of friendsSnap.docs) {
      const friendData = docSnap.data();
      // Get additional user data from the users collection
      const userDocRef = doc(db, "users", docSnap.id);
      const userDoc = await getDoc(userDocRef);
      
      if (userDoc.exists()) {
        const userData = userDoc.data();
        friends.push({
          uid: docSnap.id,
          displayName: userData.displayName,
          photoURL: userData.photoURL,
          username: userData.username,
          status: userData.status,
          addedAt: friendData.addedAt,
        });
      }
    }

    return friends;
  } catch (error) {
    console.error("Error getting friends:", error);
    throw error;
  }
};

/**
 * Get pending friend requests for a user
 */
export const getPendingRequests = async (userId: string): Promise<FriendRequest[]> => {
  try {
    const requestsRef = collection(db, "friendRequests");
    
    // Get requests sent to this user
    const receivedQuery = query(
      requestsRef,
      where("toUid", "==", userId),
      where("status", "==", "pending")
    );
    
    // Get requests sent by this user
    const sentQuery = query(
      requestsRef,
      where("fromUid", "==", userId),
      where("status", "==", "pending")
    );

    const [receivedSnap, sentSnap] = await Promise.all([
      getDocs(receivedQuery),
      getDocs(sentQuery),
    ]);

    const requests: FriendRequest[] = [];
    
    receivedSnap.forEach((doc) => {
      requests.push({ id: doc.id, ...doc.data() } as FriendRequest);
    });
    
    sentSnap.forEach((doc) => {
      requests.push({ id: doc.id, ...doc.data() } as FriendRequest);
    });

    return requests;
  } catch (error) {
    console.error("Error getting pending requests:", error);
    throw error;
  }
};

/**
 * Check if two users are friends
 */
export const checkIfFriends = async (userId: string, friendId: string): Promise<boolean> => {
  try {
    const friendRef = doc(db, "users", userId, "friends", friendId);
    const friendSnap = await getDoc(friendRef);
    return friendSnap.exists();
  } catch (error) {
    console.error("Error checking friendship:", error);
    return false;
  }
};

/**
 * Get the friend status between two users
 */
export const getFriendStatus = async (userId: string, targetUserId: string): Promise<'none' | 'friends' | 'pending_sent' | 'pending_received'> => {
  try {
    // Check if they're already friends
    const areFriends = await checkIfFriends(userId, targetUserId);
    if (areFriends) {
      return 'friends';
    }

    // Check for pending requests
    const requestId1 = `${userId}_${targetUserId}`;
    const requestId2 = `${targetUserId}_${userId}`;
    
    const [request1, request2] = await Promise.all([
      getDoc(doc(db, "friendRequests", requestId1)),
      getDoc(doc(db, "friendRequests", requestId2)),
    ]);

    if (request1.exists()) {
      const data = request1.data();
      if (data.status === 'pending') {
        return 'pending_sent';
      }
    }

    if (request2.exists()) {
      const data = request2.data();
      if (data.status === 'pending') {
        return 'pending_received';
      }
    }

    return 'none';
  } catch (error) {
    console.error("Error getting friend status:", error);
    return 'none';
  }
};

/**
 * Listen to friend requests in real-time
 */
export const subscribeToPendingRequests = (
  userId: string,
  callback: (requests: FriendRequest[]) => void
): Unsubscribe => {
  const requestsRef = collection(db, "friendRequests");
  const q = query(
    requestsRef,
    where("toUid", "==", userId),
    where("status", "==", "pending")
  );

  return onSnapshot(q, (snapshot) => {
    const requests: FriendRequest[] = [];
    snapshot.forEach((doc) => {
      requests.push({ id: doc.id, ...doc.data() } as FriendRequest);
    });
    callback(requests);
  });
};

/**
 * Listen to friends list changes in real-time
 */
export const subscribeToFriends = (
  userId: string,
  callback: (friends: Friend[]) => void
): Unsubscribe => {
  const friendsRef = collection(db, "users", userId, "friends");
  
  return onSnapshot(friendsRef, async (snapshot) => {
    const friends: Friend[] = [];
    
    for (const change of snapshot.docChanges()) {
      if (change.type === "added" || change.type === "modified") {
        const friendId = change.doc.id;
        const userRef = doc(db, "users", friendId);
        const userSnap = await getDoc(userRef);
        
        if (userSnap.exists()) {
          const userData = userSnap.data();
          friends.push({
            uid: friendId,
            displayName: userData.displayName,
            photoURL: userData.photoURL,
            username: userData.username,
            status: userData.status,
            addedAt: change.doc.data().addedAt,
          });
        }
      }
    }
    
    callback(friends);
  });
};

/**
 * Search users by username/handle
 */
export const searchUsersByHandle = async (
  searchTerm: string,
  currentUserId: string
): Promise<any[]> => {
  try {
    if (!searchTerm || searchTerm.length < 2) {
      return [];
    }

    // Search for exact username match first
    const exactQuery = query(
      collection(db, "users"),
      where("username", "==", searchTerm.toLowerCase())
    );
    
    const exactSnapshot = await getDocs(exactQuery);
    const exactMatches = exactSnapshot.docs
      .filter(doc => doc.id !== currentUserId)
      .map(doc => ({
        id: doc.id,
        ...doc.data()
      }));

    // If we have exact matches, return them
    if (exactMatches.length > 0) {
      return exactMatches;
    }

    // Otherwise, search for usernames that start with the search term
    // Note: Firestore doesn't support full-text search, so we use a workaround
    const startQuery = query(
      collection(db, "users"),
      where("username", ">=", searchTerm.toLowerCase()),
      where("username", "<=", searchTerm.toLowerCase() + "\uf8ff"),
      limit(10)
    );
    
    const startSnapshot = await getDocs(startQuery);
    return startSnapshot.docs
      .filter(doc => doc.id !== currentUserId)
      .map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
  } catch (error) {
    console.error("Error searching users:", error);
    return [];
  }
};

// Helper functions

async function checkExistingRequest(fromUid: string, toUid: string): Promise<boolean> {
  const requestId1 = `${fromUid}_${toUid}`;
  const requestId2 = `${toUid}_${fromUid}`;
  
  const [request1, request2] = await Promise.all([
    getDoc(doc(db, "friendRequests", requestId1)),
    getDoc(doc(db, "friendRequests", requestId2)),
  ]);

  // Check if either request exists AND is still pending
  if (request1.exists()) {
    const data = request1.data();
    if (data.status === 'pending') {
      return true;
    }
  }
  
  if (request2.exists()) {
    const data = request2.data();
    if (data.status === 'pending') {
      return true;
    }
  }
  
  return false;
}

async function addToFriendsList(userId: string, friendId: string): Promise<void> {
  const friendRef = doc(db, "users", userId, "friends", friendId);
  await setDoc(friendRef, {
    addedAt: serverTimestamp(),
    userRef: doc(db, "users", friendId),
  });
}

async function cleanupOldRequests(fromUid: string, toUid: string): Promise<void> {
  const requestId1 = `${fromUid}_${toUid}`;
  const requestId2 = `${toUid}_${fromUid}`;
  
  try {
    // Check and delete old accepted/rejected requests
    const [request1, request2] = await Promise.all([
      getDoc(doc(db, "friendRequests", requestId1)),
      getDoc(doc(db, "friendRequests", requestId2)),
    ]);
    
    // Delete if exists and is not pending
    if (request1.exists()) {
      const data = request1.data();
      if (data.status !== 'pending') {
        await deleteDoc(doc(db, "friendRequests", requestId1));
      }
    }
    
    if (request2.exists()) {
      const data = request2.data();
      if (data.status !== 'pending') {
        await deleteDoc(doc(db, "friendRequests", requestId2));
      }
    }
  } catch (error) {
    // Ignore errors in cleanup
    console.log('Cleanup of old requests completed');
  }
}
