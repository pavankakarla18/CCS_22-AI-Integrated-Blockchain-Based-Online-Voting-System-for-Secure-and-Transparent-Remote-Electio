import { Timestamp } from 'firebase/firestore';

/**
 * Formats a Firestore Timestamp object into a human-readable string.
 * @param {Timestamp} firestoreTimestamp - The Firestore Timestamp object.
 * @returns {string} Formatted date and time string.
 */
export const formatFirestoreTimestamp = (firestoreTimestamp) => {
    if (!firestoreTimestamp instanceof Timestamp) {
        return 'Invalid Timestamp';
    }
    const date = firestoreTimestamp.toDate();
    return date.toLocaleString(); // e.g., "1/15/2024, 10:30:00 AM"
};