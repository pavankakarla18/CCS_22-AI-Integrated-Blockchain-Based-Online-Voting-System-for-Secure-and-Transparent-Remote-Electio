// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

contract Voting {
    struct Election {
        uint256 id;
        string title;
        string[] candidateNames;
        mapping(uint256 => uint256) votesReceived;
        uint256 startTime;
        uint256 endTime;
        address owner;
        bool resultsAnnounced; // NEW: Flag to check if results are public
    }

    mapping(uint256 => Election) public elections;
    uint256 public nextElectionId;
    mapping(uint256 => mapping(address => bool)) public voters;

    event ElectionCreated(uint256 indexed electionId, string title);
    event VoteCast(uint256 indexed electionId, address indexed voter, uint256 candidateId);
    event ResultsAnnounced(uint256 indexed electionId); // NEW: Event for announcing results

    function createElection(
        string memory _title,
        string[] memory _candidateNames,
        uint256 _startTime,
        uint256 _endTime
    ) public {
        Election storage newElection = elections[nextElectionId];
        newElection.id = nextElectionId;
        newElection.title = _title;
        newElection.startTime = _startTime;
        newElection.endTime = _endTime;
        newElection.owner = msg.sender;
        newElection.resultsAnnounced = false; // Initialize as not announced
        
        for(uint i = 0; i < _candidateNames.length; i++){
            newElection.candidateNames.push(_candidateNames[i]);
        }

        emit ElectionCreated(nextElectionId, _title);
        nextElectionId++;
    }

    function vote(uint256 _electionId, uint256 _candidateId) public {
        Election storage currentElection = elections[_electionId];
        require(block.timestamp >= currentElection.startTime, "Election has not started");
        require(block.timestamp < currentElection.endTime, "Election has ended");
        require(!voters[_electionId][msg.sender], "You have already voted");
        require(_candidateId < currentElection.candidateNames.length, "Invalid candidate");

        voters[_electionId][msg.sender] = true;
        currentElection.votesReceived[_candidateId]++;
        emit VoteCast(_electionId, msg.sender, _candidateId);
    }

    // NEW FUNCTION: Allows the owner to announce the results
    function announceResults(uint256 _electionId) public {
        Election storage currentElection = elections[_electionId];
        require(msg.sender == currentElection.owner, "Only the owner can announce results");
        require(block.timestamp >= currentElection.endTime, "Election has not ended yet");
        
        currentElection.resultsAnnounced = true;
        emit ResultsAnnounced(_electionId);
    }

    // MODIFIED: Now also returns the resultsAnnounced status
    function getElectionDetails(uint256 _electionId) public view returns (string memory, string[] memory, uint256, uint256, bool) {
        Election storage e = elections[_electionId];
        return (e.title, e.candidateNames, e.startTime, e.endTime, e.resultsAnnounced);
    }
    
    // MODIFIED: Now requires results to be announced before viewing
    function getVoteCounts(uint256 _electionId) public view returns (uint256[] memory) {
        Election storage currentElection = elections[_electionId];
        require(currentElection.resultsAnnounced == true, "Results have not been announced yet");

        uint256[] memory counts = new uint256[](currentElection.candidateNames.length);
        for (uint256 i = 0; i < currentElection.candidateNames.length; i++) {
            counts[i] = currentElection.votesReceived[i];
        }
        return counts;
    }
}

