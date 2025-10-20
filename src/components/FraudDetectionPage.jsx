import React from 'react';
import { ArrowLeftIcon, LoaderIcon } from '../App.jsx'; // Correctly import named exports from App.jsx
import { formatFirestoreTimestamp } from '../time'; // Import the formatter

const FraudDetectionPage = ({ voteAttempts, loading, onBack, elections }) => {
    return (
        <div className="w-full max-w-6xl p-8 bg-gray-800 rounded-xl animate-fade-in">
            <button onClick={onBack} className="flex items-center text-sm text-indigo-400 mb-6">
                <ArrowLeftIcon /> <span className="ml-2">Back to Admin Dashboard</span>
            </button>
            <h2 className="text-3xl font-bold mb-6">Fraud Detection Logs</h2>

            {loading ? (
                <div className="flex justify-center items-center h-48">
                    <LoaderIcon className="h-10 w-10 text-indigo-400" />
                    <p className="ml-4 text-lg">Loading vote attempts...</p>
                </div>
            ) : (
                <div className="max-h-[70vh] overflow-y-auto bg-gray-900 p-2 rounded-md">
                    {voteAttempts.length === 0 ? (
                        <p className="text-center text-gray-400 py-8">No vote attempts recorded yet.</p>
                    ) : (
                        <table className="min-w-full text-sm text-left text-gray-300">
                            <thead className="text-xs text-gray-400 uppercase bg-gray-700 sticky top-0">
                                <tr>
                                    <th scope="col" className="px-4 py-3">Timestamp</th>
                                    <th scope="col" className="px-4 py-3">Election</th>
                                    <th scope="col" className="px-4 py-3">Voter Wallet</th>
                                    <th scope="col" className="px-4 py-3">Firebase User</th>
                                    <th scope="col" className="px-4 py-3">IP Address</th>
                                    <th scope="col" className="px-4 py-3">Device Fingerprint</th>
                                    <th scope="col" className="px-4 py-3">Score</th>
                                    <th scope="col" className="px-4 py-3 text-center">Suspicious</th>
                                    <th scope="col" className="px-4 py-3">Reasons</th>
                                </tr>
                            </thead>
                            <tbody>
                                {voteAttempts.map((attempt) => (
                                    <tr key={attempt.id} className="border-b border-gray-700 hover:bg-gray-700">
                                        <td className="px-4 py-3">{formatFirestoreTimestamp(attempt.timestamp)}</td>
                                        <td className="px-4 py-3">{elections[attempt.electionId] || `ID: ${attempt.electionId}`}</td>
                                        <td className="px-4 py-3 font-mono text-xs">{attempt.userAddress ? `${attempt.userAddress.substring(0, 6)}...${attempt.userAddress.substring(attempt.userAddress.length - 4)}` : 'N/A'}</td>
                                        <td className="px-4 py-3 text-xs">{attempt.firebaseUserId || 'N/A'}</td>
                                        <td className="px-4 py-3 text-xs">{attempt.ipAddress || 'N/A'}</td>
                                        <td className="px-4 py-3 font-mono text-xs">{attempt.deviceFingerprint ? `${attempt.deviceFingerprint.substring(0, 8)}...` : 'N/A'}</td>
                                        <td className="px-4 py-3">{attempt.score ? attempt.score.toFixed(2) : '0.00'}</td>
                                        <td className="px-4 py-3 text-center">
                                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                                                attempt.isSuspicious
                                                    ? 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300'
                                                    : 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300'
                                            }`}>
                                                {attempt.isSuspicious ? '🚩 Suspicious' : '✅ Clean'}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3 text-xs">{attempt.reasons?.join(', ') || 'N/A'}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>
            )}
        </div>
    );
};

export default FraudDetectionPage;