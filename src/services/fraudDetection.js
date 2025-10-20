import { db } from '../firebase';
import { collection, query, where, getDocs, addDoc, Timestamp } from 'firebase/firestore';

const VOTE_ATTEMPTS_COLLECTION = 'voteAttempts';
const TIME_WINDOW_SECONDS = 600; // Check activity within the last 10 minutes
const MAX_ATTEMPTS_PER_IP = 5;   // Allow up to 5 attempts from the same IP in the time window
const MAX_ATTEMPTS_PER_DEVICE = 5; // Allow up to 5 attempts from the same device

// This function logs every vote attempt to our Firestore database for analysis.
export async function recordVoteAttempt(attemptData) {
    try {
        await addDoc(collection(db, VOTE_ATTEMPTS_COLLECTION), {
            ...attemptData,
            timestamp: Timestamp.now()
        });
    } catch (error) {
        console.error("Error recording vote attempt:", error);
    }
}

// This is the main fraud detection function.
export async function calculateFraudScore(voteData) {
    let score = 0;
    let reasons = [];
    
    const now = Timestamp.now();
    const timeWindowStart = new Timestamp(now.seconds - TIME_WINDOW_SECONDS, now.nanoseconds);

    // Query for all vote attempts in the last 10 minutes
    const q = query(collection(db, VOTE_ATTEMPTS_COLLECTION), where('timestamp', '>=', timeWindowStart));
    const querySnapshot = await getDocs(q);
    const recentAttempts = querySnapshot.docs.map(doc => doc.data());

    // --- RULE 1: Rapid voting from the same IP address ---
    const ipCount = recentAttempts.filter(attempt => attempt.ipAddress === voteData.ipAddress).length;
    if (ipCount >= MAX_ATTEMPTS_PER_IP) {
        score += 0.4;
        reasons.push(`High frequency of votes from IP (${ipCount} attempts)`);
    }

    // --- RULE 2: Rapid voting from the same device ---
    const deviceCount = recentAttempts.filter(attempt => attempt.deviceFingerprint === voteData.deviceFingerprint).length;
    if (deviceCount >= MAX_ATTEMPTS_PER_DEVICE) {
        score += 0.4;
        reasons.push(`High frequency of votes from device (${deviceCount} attempts)`);
    }

    // --- RULE 3: User already voted in this election (Checked against our logs) ---
    const userAlreadyVoted = recentAttempts.some(
        attempt => attempt.userAddress === voteData.userAddress && attempt.electionId === voteData.electionId
    );
    if (userAlreadyVoted) {
        score += 0.9; // This is a strong indicator of a malicious attempt
        reasons.push("User has already submitted a vote for this election");
    }

    console.log(`Fraud Score: ${score}`, reasons);
    return { score, isSuspicious: score >= 0.8 }; // A score of 0.8 or higher is flagged as fraud
}