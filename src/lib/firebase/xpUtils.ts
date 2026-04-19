import { db } from './config';
import { doc, updateDoc, increment } from 'firebase/firestore';

/**
 * Adds XP to a user's profile securely using firestore increment.
 */
export async function awardXP(uid: string, amount: number): Promise<void> {
  if (!uid || amount <= 0) return;
  try {
    const userRef = doc(db, 'users', uid);
    await updateDoc(userRef, {
      xp: increment(amount)
    });
  } catch (error) {
    console.error("Failed to add XP to user:", error);
  }
}
