import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { ethers } from 'ethers';
import Web3Modal from 'web3modal';
import WalletConnectProvider from '@walletconnect/web3-provider';
import { db, auth } from './firebase';
import { collection, onSnapshot, addDoc, deleteDoc, doc, setDoc, getDoc, Timestamp, updateDoc, query, orderBy } from 'firebase/firestore'; // Added 'query', 'orderBy'
import {
    createUserWithEmailAndPassword,
    signInWithEmailAndPassword,
    signOut,
    onAuthStateChanged
} from 'firebase/auth';

// --- NEW IMPORTS FOR FRAUD DETECTION ---
import { getIpAddress } from './utils/network';
import { getDeviceFingerprint } from './utils/device';
import { recordVoteAttempt, calculateFraudScore } from './services/fraudDetection';
import { formatFirestoreTimestamp } from './time'; // NEW: Import timestamp formatter

// --- NEW IMPORTS FOR ADMIN DASHBOARD COMPONENTS ---
import FraudDetectionPage from './components/FraudDetectionPage'; // NEW: Import the new component

// --- CONFIGURATION ---
const CONTRACT_ADDRESS = "0xB84d92BA24b829B110B61e8A097e0Eb8170a83e0";
const WALLETCONNECT_PROJECT_ID = "e970c254bfc9c4e8ef83457e8d19e579";
const CONTRACT_ABI = [{"inputs":[{"internalType":"uint256","name":"_electionId","type":"uint256"}],"name":"announceResults","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"string","name":"_title","type":"string"},{"internalType":"string[]","name":"_candidateNames","type":"string[]"},{"internalType":"uint256","name":"_startTime","type":"uint256"},{"internalType":"uint256","name":"_endTime","type":"uint256"}],"name":"createElection","outputs":[],"stateMutability":"nonpayable","type":"function"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"uint256","name":"electionId","type":"uint256"},{"indexed":false,"internalType":"string","name":"title","type":"string"}],"name":"ElectionCreated","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"uint256","name":"electionId","type":"uint256"}],"name":"ResultsAnnounced","type":"event"},{"inputs":[{"internalType":"uint256","name":"_electionId","type":"uint256"},{"internalType":"uint256","name":"_candidateId","type":"uint256"}],"name":"vote","outputs":[],"stateMutability":"nonpayable","type":"function"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"uint256","name":"electionId","type":"uint256"},{"indexed":true,"internalType":"address","name":"voter","type":"address"},{"indexed":false,"internalType":"uint256","name":"candidateId","type":"uint256"}],"name":"VoteCast","type":"event"},{"inputs":[{"internalType":"uint256","name":"","type":"uint256"}],"name":"elections","outputs":[{"internalType":"uint256","name":"id","type":"uint256"},{"internalType":"string","name":"title","type":"string"},{"internalType":"uint256","name":"startTime","type":"uint256"},{"internalType":"uint256","name":"endTime","type":"uint256"},{"internalType":"address","name":"owner","type":"address"},{"internalType":"bool","name":"resultsAnnounced","type":"bool"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"uint256","name":"_electionId","type":"uint256"}],"name":"getElectionDetails","outputs":[{"internalType":"string","name":"","type":"string"},{"internalType":"string[]","name":"","type":"string[]"},{"internalType":"uint256","name":"","type":"uint256"},{"internalType":"uint256","name":"","type":"uint256"},{"internalType":"bool","name":"","type":"bool"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"uint256","name":"_electionId","type":"uint256"}],"name":"getVoteCounts","outputs":[{"internalType":"uint256[]","name":"","type":"uint256[]"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"nextElectionId","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"uint256","name":"","type":"uint256"},{"internalType":"address","name":"","type":"address"}],"name":"voters","outputs":[{"internalType":"bool","name":"","type":"bool"}],"stateMutability":"view","type":"function"}];

// --- ICONS ---
export const LockIcon = () => <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 0 0 1 10 0v4"></path></svg>;
export const UserIcon = () => <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 0 0 0-4-4H8a4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>;
export const PowerIcon = () => <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18.36 6.64a9 0 1 1-12.73 0"></path><line x1="12" y1="2" x2="12" y2="12"></line></svg>;
export const LoaderIcon = () => <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>;
export const ShieldCheckIcon = () => <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path><path d="m9 12 2 2 4-4"></path></svg>;
export const PlusCircleIcon = () => <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="16"></line><line x1="8" y1="12" x2="16" y2="12"></line></svg>;
export const UsersIcon = () => <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 0 0 0-4-4H5a4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 0 0 0-3-3.87"></path><path d="M16 3.13a4 0 0 1 0 7.75"></path></svg>;
export const TrashIcon = () => <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 0 0 1-2 2H7a2 0 0 1-2-2V6m3 0V4a2 0 0 1 2-2h4a2 0 0 1 2 2v2"></path></svg>;
export const ArrowLeftIcon = () => <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="19" y1="12" x2="5" y2="12"></line><polyline points="12 19 5 12 12 5"></polyline></svg>;
export const AnnounceIcon = () => <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2 15h2c2 0 3-1 3-3V7c0-2-1-3-3-3H2v11z"/><path d="M15 15h2c2 0 3-1 3-3V7c0-2-1-3-3-3h-2v11z"/><path d="M9 15v-4.5"/><path d="M6 15v-2c0-1 1-2 2-2h1"/></svg>;
export const AlertTriangleIcon = () => <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-alert-triangle"><path d="m21.73 18-8-14a2 0 0 0-3.48 0l-8 14A2 0 0 0 4 21h16a2 0 0 0 1.73-3Z"/><path d="M12 9v4"/><path d="M12 17h.01"/></svg>;

// --- Web3Modal Configuration ---
const providerOptions = { walletconnect: { package: WalletConnectProvider, options: { infuraId: WALLETCONNECT_PROJECT_ID } } };
let web3Modal;
if (typeof window !== 'undefined') { web3Modal = new Web3Modal({ network: 'sepolia', cacheProvider: true, providerOptions }); }


// --- PAGE COMPONENTS ---
// LoginPage, ElectionSelectionPage, VoterDashboardPage, AdminElectionManagePage, CreateElectionPage, ManageVotersPage, CastVotePage, ReceiptPage, VoterResultsPage
// (No changes to these components for now, as requested)
function LoginPage({ onLogin, onSignUp, loading }) {
    const [isLogin, setIsLogin] = useState(true);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [role, setRole] = useState('voter');
    const handleSubmit = (e) => { e.preventDefault(); if (isLogin) onLogin(email, password); else onSignUp(email, password, role); };
    return ( <div className="w-full max-w-md p-8 space-y-6 bg-gray-800 rounded-xl"> <h2 className="text-3xl font-bold text-center text-white">{isLogin ? 'Login' : 'Sign Up'}</h2> <form onSubmit={handleSubmit} className="space-y-4"> <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="Email" required className="w-full p-3 bg-gray-700 rounded-md text-white" /> <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Password" required className="w-full p-3 bg-gray-700 rounded-md text-white" /> {!isLogin && ( <select value={role} onChange={e => setRole(e.target.value)} className="w-full p-3 bg-gray-700 rounded-md text-white"> <option value="voter">Voter</option> <option value="admin">Election Commission</option> </select> )} <button type="submit" disabled={loading} className="w-full py-3 bg-indigo-600 rounded-md text-white font-bold disabled:bg-indigo-400"> {loading ? <LoaderIcon className="mx-auto" /> : (isLogin ? 'Login' : 'Sign Up')} </button> </form> <p className="text-center text-gray-400"> {isLogin ? "Don't have an account?" : "Already have an account?"} <button onClick={() => setIsLogin(!isLogin)} className="font-bold text-indigo-400 ml-2"> {isLogin ? 'Sign Up' : 'Login'} </button> </p> </div> );
}

function ElectionSelectionPage({ elections, onSelectElection, onLogout, userEmail }) {
    const now = new Date();
    const activeElections = elections.filter(election => election.endTime?.toDate() >= now);
    const completedElections = elections.filter(election => election.endTime?.toDate() < now);

    const ElectionCard = ({ election }) => {
        const isCompleted = election.endTime?.toDate() < now;
        const statusLabel = isCompleted ? 'Ended:' : 'Ends:';
        const endDate = election.endTime?.toDate().toLocaleString();

        return (
            <div
                key={election.id}
                onClick={() => onSelectElection(election.id)}
                className="bg-gray-700 p-4 rounded-lg hover:bg-indigo-900 cursor-pointer"
            >
                <h3 className="text-xl font-semibold">{election.title}</h3>
                <p className="text-sm text-gray-400">{statusLabel} {endDate}</p>
            </div>
        );
    };

    return (
        <div className="w-full max-w-2xl p-8 space-y-6 bg-gray-800 rounded-xl">
            <div className="flex justify-between items-center">
                <div>
                    <h2 className="text-3xl font-bold text-white">Voter Dashboard</h2>
                    <p className="text-gray-400">Welcome, {userEmail}</p>
                </div>
                <button onClick={onLogout} className="flex items-center bg-gray-700 p-2 rounded-md"><PowerIcon /></button>
            </div>

            {/* Active Elections Section */}
            <div className="border-t border-gray-700 pt-4">
                <h3 className="text-xl font-semibold mb-2 text-white">Active Elections</h3>
                <p className="text-sm text-gray-400 mb-4">Currently open for voting or pending start.</p>
                <div className="space-y-4 max-h-60 overflow-y-auto"> {/* Adjusted max-h */}
                    {activeElections.length > 0 ? activeElections.map(election => (
                        <ElectionCard key={election.id} election={election} />
                    )) : (
                        <p className="text-center text-gray-400">No active elections at the moment.</p>
                    )}
                </div>
            </div>

            {/* Completed Elections Section */}
            <div className="border-t border-gray-700 pt-4">
                <h3 className="text-xl font-semibold mb-2 text-white">Completed Elections</h3>
                <p className="text-sm text-gray-400 mb-4">Elections that have concluded.</p>
                <div className="space-y-4 max-h-60 overflow-y-auto"> {/* Adjusted max-h */}
                    {completedElections.length > 0 ? completedElections.map(election => (
                        <ElectionCard key={election.id} election={election} />
                    )) : (
                        <p className="text-center text-gray-400">No completed elections to display.</p>
                    )}
                </div>
            </div>
        </div>
    );
}

function VoterDashboardPage({ user, setPage, hasVoted, onLogout, election, onBack }) {
    if (!election) return (<div className="w-full max-w-md p-8 space-y-6 bg-gray-800 rounded-xl text-center"><p className="mt-2 text-white">Something went wrong. Please select an election.</p><button onClick={onBack} className="mt-4 bg-indigo-600 text-white font-bold py-2 px-4 rounded-lg">Go Back</button></div>);
    const startTime = election.startTime?.toDate().toLocaleString() || 'N/A';
    const endTime = election.endTime?.toDate().toLocaleString() || 'N/A';
    return (<div className="w-full max-w-4xl p-8 space-y-8 bg-gray-800 rounded-xl"><div className="flex justify-between items-start"><div><h2 className="text-3xl font-bold">Election Details</h2><button onClick={onBack} className="flex items-center text-sm text-indigo-400 mt-2"><ArrowLeftIcon /> <span className="ml-2">Back to Dashboard</span></button></div><button onClick={onLogout} className="flex items-center bg-gray-700 p-2 rounded-md"><PowerIcon /></button></div><div className="grid grid-cols-1 md:grid-cols-2 gap-6"><div className="bg-gray-700 p-6 rounded-lg"><h3 className="text-xl font-semibold mb-2">{election.title}</h3><p>Start: {startTime}</p><p>End: {endTime}</p></div><div className="bg-gray-700 p-6 rounded-lg flex flex-col justify-center"><h3 className="text-xl font-semibold mb-2">Your Status</h3><p className={`font-bold ${hasVoted ? 'text-green-400' : 'text-yellow-400'}`}>{hasVoted ? 'You have voted.' : 'You have not voted.'}</p></div></div><div className="flex justify-center pt-4 gap-4"><button onClick={() => setPage('vote')} disabled={hasVoted || new Date() < election.startTime?.toDate() || new Date() > election.endTime?.toDate()} className="bg-indigo-600 font-bold py-3 px-8 rounded-lg disabled:bg-gray-600">{hasVoted ? 'Vote Cast' : 'Cast Vote'}</button><button onClick={() => setPage('voter-results')} disabled={!election.resultsAnnounced} className="bg-green-600 font-bold py-3 px-8 rounded-lg disabled:bg-gray-600">{election.resultsAnnounced ? 'View Results' : 'Results Not Ready'}</button></div></div>);
}

function AdminDashboardPage({ onLogout, setPage, elections, onSelectElection }) {
    const AdminCard = ({ icon, title, description, page, action }) => (<div onClick={action || (() => setPage(page))} className="bg-gray-700 p-6 rounded-lg hover:bg-indigo-900 cursor-pointer"><div className="flex items-center space-x-4"><div className="bg-indigo-600 p-3 rounded-full">{icon}</div><div><h3 className="text-xl font-bold">{title}</h3><p className="text-gray-400 text-sm">{description}</p></div></div></div>);
    return (
        <div className="w-full max-w-4xl p-8 space-y-8 bg-gray-800 rounded-xl">
            <div className="flex justify-between items-start">
                <div><h2 className="text-3xl font-bold">Admin Dashboard</h2></div>
                <button onClick={onLogout} className="flex items-center bg-gray-700 p-2 rounded-md"><PowerIcon /></button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                <AdminCard icon={<PlusCircleIcon />} title="Create New Election" description="Deploy a new election to the blockchain." page="create-election" />
                <AdminCard icon={<UsersIcon />} title="Manage Voters" description="Add or remove eligible voters." page="manage-voters" />
                {/* NEW: Admin Card for Fraud Detection Logs */}
                <AdminCard icon={<AlertTriangleIcon />} title="Fraud Detection Logs" description="Review suspicious vote attempts." page="fraud-logs" />
            </div>
            <div>
                <h3 className="text-xl font-semibold mb-4">Manage Existing Elections ({elections.length})</h3>
                <div className="max-h-96 overflow-y-auto bg-gray-900 p-2 rounded-md space-y-2">
                    {elections.map(e => (
                        <div key={e.id} onClick={() => onSelectElection(e.id)} className="bg-gray-700 p-4 rounded-lg hover:bg-indigo-900 cursor-pointer flex justify-between items-center">
                            <div>
                                <p className="font-bold">{e.title}</p>
                                <p className={`text-xs font-bold ${e.resultsAnnounced ? 'text-green-400' : 'text-yellow-400'}`}>{e.resultsAnnounced ? 'Results Announced' : 'Results Pending'}</p>
                            </div>
                            <button className="text-sm bg-indigo-600 px-3 py-1 rounded">Manage</button>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}

function AdminElectionManagePage({ election, onAnnounce, onDelete, loading, onBack }) {
    if (!election) return <div className="text-center"><p>Select an election to manage.</p><button onClick={onBack} className="mt-4 bg-indigo-600 text-white font-bold py-2 px-4 rounded-lg">Go Back</button></div>;
    const isElectionOver = new Date() > election.endTime?.toDate();
    return (
        <div className="w-full max-w-2xl p-8 bg-gray-800 rounded-xl">
            <button onClick={onBack} className="flex items-center text-sm text-indigo-400 mb-6"><ArrowLeftIcon /> <span className="ml-2">Back to Dashboard</span></button>
            <div className="text-center">
                <AnnounceIcon className="mx-auto w-16 h-16 text-indigo-400"/>
                <h2 className="text-3xl font-bold my-4">Manage Election</h2>
            </div>
            <div className="bg-gray-700 p-4 rounded-lg mb-6 text-left">
                <p className="font-bold text-xl">{election.title}</p>
                <p className="text-sm">Ends: {election.endTime?.toDate().toLocaleString()}</p>
                <p className={`font-bold mt-2 ${election.resultsAnnounced ? 'text-green-400' : 'text-yellow-400'}`}>{election.resultsAnnounced ? 'Results have been announced' : 'Results are not yet public'}</p>
            </div>
            <div className="space-y-4">
                <div>
                    <p className="text-gray-400 mb-2 text-sm">Make results public for all voters. This action is irreversible.</p>
                    <button onClick={() => onAnnounce(election)} disabled={loading || !isElectionOver || election.resultsAnnounced} className="w-full bg-green-600 text-white font-bold py-3 px-4 rounded-lg disabled:bg-gray-600">
                        {loading ? <LoaderIcon className="mx-auto"/> : 'Announce Results Now'}
                    </button>
                    {!isElectionOver && <p className="text-xs text-yellow-400 mt-2 text-center">You can only announce results after the election has ended.</p>}
                </div>
                {/* --- NEW FEATURE: Delete Election Button --- */}
                <div className="border-t border-gray-700 pt-4">
                    <p className="text-gray-400 mb-2 text-sm">Permanently delete this election from the application. This cannot be undone.</p>
                    <button onClick={() => onDelete(election)} disabled={loading} className="w-full bg-red-600 text-white font-bold py-3 px-4 rounded-lg disabled:bg-red-400">
                        {loading ? <LoaderIcon className="mx-auto"/> : 'Delete Election'}
                    </button>
                </div>
            </div>
        </div>
    );
}

function CreateElectionPage({ onCreateElection, setPage, loading }) {
    const [title, setTitle] = useState(''); const [startTime, setStartTime] = useState(''); const [endTime, setEndTime] = useState(''); const [candidates, setCandidates] = useState([{ name: '', party: '' }]);
    const handleCandidateChange = (i, e) => { const v = [...candidates]; v[i][e.target.name] = e.target.value; setCandidates(v); };
    const addCandidate = () => setCandidates([...candidates, { name: '', party: '' }]); const removeCandidate = (i) => { const v = [...candidates]; v.splice(i, 1); setCandidates(v); };
    const handleSubmit = (e) => { e.preventDefault(); onCreateElection({ title, startTime, endTime, candidates }); };
    return (<div className="w-full max-w-2xl p-8 bg-gray-800 rounded-xl"><button onClick={() => !loading && setPage('admin-dashboard')} className="flex items-center text-sm text-indigo-400 mb-6"><ArrowLeftIcon /> <span className="ml-2">Back</span></button><h2 className="text-3xl font-bold mb-6">Create New Election</h2><form onSubmit={handleSubmit} className="space-y-4"><div><label>Title</label><input type="text" value={title} onChange={(e) => setTitle(e.target.value)} className="mt-1 w-full p-2 bg-gray-700 rounded-md" required /></div><div className="grid grid-cols-1 md:grid-cols-2 gap-4"><div><label>Start Time</label><input type="datetime-local" value={startTime} onChange={(e) => setStartTime(e.target.value)} className="mt-1 w-full p-2 bg-gray-700 rounded-md" required /></div><div><label>End Time</label><input type="datetime-local" value={endTime} onChange={(e) => setEndTime(e.target.value)} className="mt-1 w-full p-2 bg-gray-700 rounded-md" required /></div></div><div><h3 className="text-xl font-semibold mt-4 mb-2">Candidates</h3>{candidates.map((c, i) => (<div key={i} className="flex items-center space-x-2 mb-2"><input name="name" placeholder="Name" value={c.name} onChange={e => handleCandidateChange(i, e)} className="w-full p-2 bg-gray-700 rounded-md" required /><input name="party" placeholder="Party" value={c.party} onChange={e => handleCandidateChange(i, e)} className="w-full p-2 bg-gray-700 rounded-md" required /><button type="button" onClick={() => removeCandidate(i)} className="p-2 bg-red-600 rounded-md"><TrashIcon /></button></div>))}<button type="button" onClick={addCandidate} className="text-sm text-indigo-400">Add Candidate</button></div><div className="pt-4"><button type="submit" disabled={loading} className="w-full bg-indigo-600 disabled:bg-gray-600 font-bold py-3 px-4 rounded-lg flex justify-center">{loading ? <LoaderIcon/> : "Launch Election"}</button></div></form></div>);
}

function ManageVotersPage({ voters, onRemoveUser, setPage }) {
    return (<div className="w-full max-w-4xl p-8 bg-gray-800 rounded-xl"><button onClick={() => setPage('admin-dashboard')} className="flex items-center text-sm text-indigo-400 mb-6"><ArrowLeftIcon /> <span className="ml-2">Back</span></button><h2 className="text-3xl font-bold mb-6">Manage Voters</h2><div><h3 className="text-xl font-semibold mb-4">Registered Users ({voters.length})</h3><div className="max-h-96 overflow-y-auto bg-gray-900 p-2 rounded-md"><table className="w-full text-sm text-left"><thead className="text-xs text-gray-400"><tr><th className="px-4 py-2">Email</th><th className="px-4 py-2">Role</th><th className="px-4 py-2"></th></tr></thead><tbody>{voters.map(v => (<tr key={v.id} className="border-b border-gray-700"><td className="px-4 py-2">{v.email}</td><td className="px-4 py-2">{v.role}</td><td className="px-4 py-2 text-right"><button onClick={() => onRemoveUser(v.id)} className="text-red-500"><TrashIcon /></button></td></tr>))}</tbody></table></div></div></div>);
}

function CastVotePage({ candidates, onVote, loading, election, onBack }) {
    const [selectedCandidate, setSelectedCandidate] = useState(null);
    const isElectionActive = election && (new Date() >= election.startTime?.toDate() && new Date() <= election.endTime?.toDate());
    return (
        <div className="w-full max-w-2xl animate-fade-in">
            <button onClick={onBack} className="flex items-center text-sm text-indigo-400 mb-6">
                <ArrowLeftIcon /> <span className="ml-2">Back to Details</span>
            </button>
            <h2 className="text-3xl font-bold text-center mb-8">Select Your Candidate</h2>
            {/* Conditional rendering for election status */}
            {!isElectionActive && (
                <p className="text-center text-red-400 mb-4">Voting is currently closed for this election.</p>
            )}
            <div className="space-y-4">
                {candidates.map((c, index) => (
                    <div
                        key={index}
                        onClick={() => !loading && isElectionActive && setSelectedCandidate(index)}
                        className={`p-5 rounded-lg border-2 cursor-pointer ${selectedCandidate === index ? 'bg-indigo-900 border-indigo-500' : 'bg-gray-800 border-gray-700'} ${!isElectionActive ? 'opacity-50 cursor-not-allowed' : ''}`}
                    >
                        <div className="flex items-center justify-between">
                            <div>
                                <h3 className="text-xl font-bold">{c.name}</h3>
                                <p className="text-indigo-300">{c.party}</p>
                            </div>
                            <div className={`w-8 h-8 rounded-full border-2 flex items-center justify-center ${selectedCandidate === index ? 'bg-indigo-500' : 'border-gray-500'}`}>
                                {selectedCandidate === index && <span className="text-white">✓</span>}
                            </div>
                        </div>
                    </div>
                ))}
            </div>
            <div className="text-center mt-8">
                <button
                    onClick={() => onVote(selectedCandidate)}
                    disabled={selectedCandidate === null || loading || !isElectionActive}
                    className="bg-green-600 disabled:bg-gray-600 font-bold py-3 px-8 rounded-lg flex justify-center min-w-[150px]"
                >
                    {loading ? <LoaderIcon /> : "Submit Vote"}
                </button>
            </div>
        </div>
    );
}

function ReceiptPage({ transactionHash, setPage }) { return ( <div className="w-full max-w-2xl p-8 space-y-6 bg-gray-800 rounded-xl text-center animate-fade-in"><ShieldCheckIcon className="mx-auto text-green-400 w-16 h-16" /><h2 className="text-3xl font-bold">Vote Confirmed</h2><p className="text-gray-300">Your vote is immutable and stored securely.</p><div className="bg-gray-900 p-4 rounded-lg"><p className="text-sm text-gray-400 mb-2">Transaction ID</p><p className="text-green-400 font-mono break-all text-sm">{transactionHash || 'Processing...'}</p></div><button onClick={() => setPage('voter-dashboard')} className="w-full bg-indigo-600 py-3 px-4 rounded-lg">Return to Election Details</button></div>); }

function VoterResultsPage({ setPage, fetchResults, election, voteCounts, loading, onBack }) {
    useEffect(() => {
        if (election && election.resultsAnnounced) { fetchResults(election); }
    }, [election, fetchResults]);
    return (<div className="w-full max-w-2xl p-8 bg-gray-800 rounded-xl animate-fade-in"><button onClick={onBack} className="flex items-center text-sm text-indigo-400 mb-6"><ArrowLeftIcon /> <span className="ml-2">Back to Election Details</span></button><h2 className="text-3xl font-bold mb-6 text-center">Official Election Results</h2>{loading && <LoaderIcon className="mx-auto" />}{!loading && election && (<div className="space-y-4"><h3 className="text-xl font-semibold text-center">{election.title}</h3>{!election.resultsAnnounced ? (<p className="text-center text-yellow-400">Results have not been announced yet.</p>) : (election.candidates.map((candidate, index) => (<div key={index} className="bg-gray-700 p-4 rounded-lg flex justify-between items-center"><p className="font-bold text-lg">{candidate.name}</p><p className="text-3xl font-bold text-indigo-400">{voteCounts[index] || 0}</p></div>)))}</div>)}</div>
    );
}

// --- MAIN APP COMPONENT ---
export default function App() {
    const [provider, setProvider] = useState();
    const [signer, setSigner] = useState();
    const [address, setAddress] = useState();
    const [user, setUser] = useState(null);
    const [authLoading, setAuthLoading] = useState(true);
    const [dataLoading, setDataLoading] = useState(true);
    const [page, setPage] = useState(null);
    const [hasVoted, setHasVoted] = useState(false);
    const [transactionHash, setTransactionHash] = useState(null);
    const [elections, setElections] = useState([]);
    const [allUsers, setAllUsers] = useState([]);
    const [voteCounts, setVoteCounts] = useState([]);
    const [selectedElectionId, setSelectedElectionId] = useState(null);
    // NEW: State for vote attempts
    const [voteAttempts, setVoteAttempts] = useState([]);
    const [fetchingVoteAttempts, setFetchingVoteAttempts] = useState(false);

    const selectedElection = useMemo(() => 
        elections.find(e => e.id === selectedElectionId), 
    [elections, selectedElectionId]);

    useEffect(() => {
        const unsubscribeAuth = onAuthStateChanged(auth, async (currentUser) => {
            if (currentUser) {
                const userDoc = await getDoc(doc(db, 'users', currentUser.uid));
                setUser(userDoc.exists() ? { uid: currentUser.uid, email: currentUser.email, ...userDoc.data() } : null);
            } else {
                setUser(null);
            }
            setAuthLoading(false);
        });
        const unsubscribeElections = onSnapshot(collection(db, 'elections'), (snapshot) => {
            const sortedElections = snapshot.docs
                .map(doc => ({ ...doc.data(), id: doc.id }))
                .sort((a, b) => b.startTime.toMillis() - a.startTime.toMillis());
            setElections(sortedElections);
            setDataLoading(false);
        });
        const unsubscribeUsers = onSnapshot(collection(db, 'users'), (snapshot) => {
            setAllUsers(snapshot.docs.map(doc => ({...doc.data(), id: doc.id })));
        });

        // NEW: Subscribe to voteAttempts in Firestore
        // This query orders by timestamp descending so the newest attempts are first
        const unsubscribeVoteAttempts = onSnapshot(query(collection(db, 'voteAttempts'), orderBy('timestamp', 'desc')), (snapshot) => {
            setVoteAttempts(snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id })));
        });

        return () => {
            unsubscribeAuth();
            unsubscribeElections();
            unsubscribeUsers();
            unsubscribeVoteAttempts(); // NEW: Unsubscribe from vote attempts
        };
    }, []);

    useEffect(() => {
        const checkVoterStatus = async () => {
            if (user && user.role === 'voter' && address && selectedElection) {
                try {
                    const tempProvider = provider || new ethers.providers.Web3Provider(window.ethereum);
                    const contract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, tempProvider);
                    const voted = await contract.voters(selectedElection.contractElectionId, address);
                    setHasVoted(voted);
                } catch (error) {
                    console.error("Error checking voter status:", error);
                    setHasVoted(false);
                }
            }
        };
        if (user?.role === 'voter' && address && selectedElection) {
            checkVoterStatus();
        } else {
            setHasVoted(false);
        }
    }, [user, address, selectedElection, provider]);

    const handleSignUp = async (email, password, role) => {
        setAuthLoading(true);
        try {
            const userCredential = await createUserWithEmailAndPassword(auth, email, password);
            await setDoc(doc(db, 'users', userCredential.user.uid), { email, role });
        } catch (error) { alert(error.message); } 
        finally { setAuthLoading(false); }
    };
    
    const handleLogin = async (email, password) => {
        setAuthLoading(true);
        try { await signInWithEmailAndPassword(auth, email, password); } 
        catch (error) { alert(error.message); } 
        finally { setAuthLoading(false); }
    };

    const handleLogout = async () => {
        await signOut(auth);
        setPage(null);
        setHasVoted(false);
        setSelectedElectionId(null);
        if (address) disconnectWallet();
    };

    const connectWallet = useCallback(async () => {
        try {
            const instance = await web3Modal.connect();
            const provider = new ethers.providers.Web3Provider(instance);
            const signer = provider.getSigner();
            const address = await signer.getAddress();
            setProvider(provider);
            setSigner(signer);
            setAddress(address);
        } catch (error) { console.error("Could not connect to wallet", error); }
    }, []);

    const disconnectWallet = useCallback(async () => {
        await web3Modal.clearCachedProvider();
        setProvider(undefined);
        setSigner(undefined);
        setAddress(undefined);
        setHasVoted(false);
    }, []);

    const handleCreateElection = async (electionData) => {
        if (!signer) return alert("Please connect your wallet to create an election.");
        setAuthLoading(true);
        try {
            const contract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, signer);
            const candidateNames = electionData.candidates.map(c => c.name);
            const startTime = Math.floor(new Date(electionData.startTime).getTime() / 1000);
            const endTime = Math.floor(new Date(electionData.endTime).getTime() / 1000);
    
            const tx = await contract.createElection(electionData.title, candidateNames, startTime, endTime);
            const receipt = await tx.wait();
    
            const event = receipt.events?.find(e => e.event === 'ElectionCreated');
            if (!event) {
                throw new Error("ElectionCreated event not found. Could not create election.");
            }
            
            const newContractId = event.args.electionId;
    
            const electionsCollection = collection(db, 'elections');
            await addDoc(electionsCollection, {
                title: electionData.title,
                candidates: electionData.candidates,
                startTime: Timestamp.fromDate(new Date(electionData.startTime)),
                endTime: Timestamp.fromDate(new Date(electionData.endTime)),
                contractElectionId: parseInt(newContractId.toString()),
                resultsAnnounced: false
            });
            
            alert("Election created successfully!");
            setPage('admin-dashboard');
        } catch (error) {
            console.error("Failed to create election:", error);
            alert("Failed to create election. See console for details.");
        } finally {
            setAuthLoading(false);
        }
    };

    const handleVote = async (candidateId) => {
        if (!signer) {
            alert("Please connect your wallet first.");
            return;
        }
        if (!selectedElection) {
            alert("No election selected.");
            return;
        }
        
        setAuthLoading(true); // Indicate loading

        try {
            // --- FRAUD DETECTION LOGIC ---
            const ipAddress = await getIpAddress();
            const deviceFingerprint = getDeviceFingerprint();

            const voteData = {
                userAddress: address, // Metamask wallet address
                electionId: selectedElection.contractElectionId, // Blockchain election ID
                ipAddress: ipAddress,
                deviceFingerprint: deviceFingerprint,
                firebaseUserId: user.uid // Firebase user ID
            };

            // Calculate fraud score BEFORE recording, so decision can be made
            const { isSuspicious, score, reasons } = await calculateFraudScore(voteData);

            // Record the attempt regardless of the outcome for future analysis
            // Pass the calculated score and reasons to be stored
            await recordVoteAttempt({ ...voteData, score, isSuspicious, reasons });

            if (isSuspicious) {
                console.warn("Fraud detected! Score:", score, "Reasons:", reasons);
                alert(`Your vote attempt has been flagged as suspicious (Score: ${score.toFixed(1)}). Reason(s): ${reasons.join(', ')}. Your vote may not be processed.`);
                setPage('voter-dashboard'); // Go back to dashboard or show an error page
                return; // Stop the function here, do not send transaction
            }
            // --- END FRAUD DETECTION LOGIC ---

            // If not suspicious, proceed with the blockchain transaction
            const contract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, signer);
            const tx = await contract.vote(selectedElection.contractElectionId, candidateId);
            
            alert("Transaction sent to blockchain... please wait for confirmation.");
            await tx.wait(); // Wait for the transaction to be mined

            setTransactionHash(tx.hash);
            setHasVoted(true);
            setPage('receipt'); // Show success receipt
        } catch (error) {
            console.error("Voting failed:", error);
            if (error.reason) {
                alert(`Voting failed: ${error.reason}`);
            } else if (error.message.includes("user rejected transaction")) {
                alert("Transaction was rejected in your wallet.");
            } else {
                alert("An unknown error occurred during voting. See console for details.");
            }
        } finally {
            setAuthLoading(false); // Stop loading regardless of success or failure
        }
    };
    
    const handleRemoveUser = async (userId) => {
        alert("This will only remove the user's data from the Firestore database, not from Firebase Authentication. A secure implementation requires a backend Cloud Function to properly delete users.");
        const userDoc = doc(db, 'users', userId);
        await deleteDoc(userDoc);
    };

    const handleDeleteElection = async (electionToDelete) => {
        if (!electionToDelete) return;
        
        const isConfirmed = window.confirm(`Are you sure you want to delete the election "${electionToDelete.title}"? This action cannot be undone.`);
        
        if (isConfirmed) {
            setAuthLoading(true);
            try {
                const electionDoc = doc(db, 'elections', electionToDelete.id);
                await deleteDoc(electionDoc);
                alert('Election deleted successfully from the application.');
                setSelectedElectionId(null);
                setPage('admin-dashboard');
            } catch (error) {
                console.error("Failed to delete election:", error);
                alert("Failed to delete election. See console for details.");
            } finally {
                setAuthLoading(false);
            }
        }
    };

    const fetchResults = useCallback(async (election) => {
        if (!provider && !signer) { return; }
        const readProvider = signer || provider;
        if (!election?.resultsAnnounced) return;
        
        setAuthLoading(true);
        try {
            const contract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, readProvider);
            const counts = await contract.getVoteCounts(election.contractElectionId);
            setVoteCounts(counts.map(c => parseInt(c.toString())));
        } catch(error) {
            console.error("Failed to fetch results:", error);
        } finally {
            setAuthLoading(false);
        }
    }, [provider, signer]);

    const handleAnnounceResults = async (election) => {
        if (!signer) return alert("Please connect your wallet.");
        setAuthLoading(true);
        try {
            const contract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, signer);
            const tx = await contract.announceResults(election.contractElectionId);
            await tx.wait();
            
            const electionDoc = doc(db, 'elections', election.id);
            await updateDoc(electionDoc, { resultsAnnounced: true });

            alert("Results announced successfully!");
        } catch (error) {
            console.error("Failed to announce results:", error);
            alert("Failed to announce results. See console.");
        } finally {
            setAuthLoading(false);
        }
    };

    const WalletButton = () => ( <div className="absolute top-4 right-4 z-20"><button onClick={!address ? connectWallet : disconnectWallet} className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 px-4 rounded-lg shadow-lg">{address ? `Disconnect ${address.substring(0,6)}...` : "Connect Wallet"}</button></div> );

    if (authLoading || (user && dataLoading)) {
        return <div className="min-h-screen bg-gray-900 flex items-center justify-center"><LoaderIcon className="h-12 w-12" /></div>;
    }

    const renderContent = () => {
        if (!user) {
            return <LoginPage onLogin={handleLogin} onSignUp={handleSignUp} loading={authLoading} />;
        }

        if (user.role === 'admin') {
            if (selectedElectionId) {
                return <AdminElectionManagePage 
                            election={selectedElection} 
                            onAnnounce={handleAnnounceResults} 
                            onDelete={handleDeleteElection}
                            loading={authLoading} 
                            onBack={() => { setSelectedElectionId(null); setPage('admin-dashboard'); }} 
                        />;
            }
            
            const currentAdminPage = page || 'admin-dashboard';
            switch (currentAdminPage) {
                case 'create-election': return <CreateElectionPage onCreateElection={handleCreateElection} setPage={setPage} loading={authLoading} />;
                case 'manage-voters': return <ManageVotersPage voters={allUsers} onRemoveUser={handleRemoveUser} setPage={setPage} />;
                // NEW: Case for Fraud Detection Logs page
                case 'fraud-logs': return (
                    <FraudDetectionPage
                        voteAttempts={voteAttempts}
                        loading={fetchingVoteAttempts}
                        onBack={() => setPage('admin-dashboard')}
                        // election mapping for display purposes
                        elections={elections.reduce((acc, election) => {
                            acc[election.contractElectionId] = election.title;
                            return acc;
                        }, {})}
                    />
                );
                default: return <AdminDashboardPage onLogout={handleLogout} setPage={setPage} elections={elections} onSelectElection={(id) => setSelectedElectionId(id)} />;
            }
        }

        if (user.role === 'voter') {
            if (!selectedElection) {
                return <ElectionSelectionPage elections={elections} onSelectElection={setSelectedElectionId} onLogout={handleLogout} userEmail={user.email}/>;
            }

            const currentVoterPage = page || 'voter-dashboard';
            const backToDashboard = () => setPage('voter-dashboard');
            
            switch (currentVoterPage) {
                case 'vote': return <CastVotePage candidates={selectedElection?.candidates || []} onVote={handleVote} loading={authLoading} election={selectedElection} onBack={backToDashboard} />;
                case 'receipt': return <ReceiptPage transactionHash={transactionHash} setPage={setPage} />;
                case 'voter-results': return <VoterResultsPage setPage={setPage} fetchResults={fetchResults} election={selectedElection} voteCounts={voteCounts} loading={authLoading} onBack={backToDashboard} />;
                default: return <VoterDashboardPage user={user} setPage={setPage} hasVoted={hasVoted} onLogout={handleLogout} election={selectedElection} onBack={() => setSelectedElectionId(null)} />;
            }
        }
    };

    return (
        <div className="min-h-screen bg-gray-900 text-gray-100 font-sans flex items-center justify-center p-4 relative">
            {user && <WalletButton />}
            {renderContent()}
        </div>
    );
}