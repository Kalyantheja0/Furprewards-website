import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm';

const supabase = createClient(
    window.__env.SUPABASE_URL,
    window.__env.SUPABASE_ANON_KEY
);

// --- GLOBAL STATE ---
let isAdmin = false;
let activeTournament = null;

// --- DOM ELEMENTS ---
const adminControls = document.getElementById('admin-controls');
const adminModeToggle = document.getElementById('admin-mode-toggle');
const tournamentNameEl = document.getElementById('tournament-name');
const bracketContainer = document.getElementById('bracket-container');
const activeTournamentSection = document.getElementById('active-tournament-section');
const noActiveTournamentMessage = document.getElementById('no-active-tournament');
const pastWinnersList = document.getElementById('past-winners-list');

document.addEventListener('DOMContentLoaded', async () => {
    await checkUserRole();
    await loadPageData();

    // --- EVENT LISTENERS ---
    if (isAdmin) {
        adminModeToggle.addEventListener('change', toggleAdminMode);
        document.getElementById('save-button').addEventListener('click', saveTournamentData);
        document.getElementById('archive-button').addEventListener('click', archiveActiveTournament);
        document.getElementById('submit-new-tournament').addEventListener('click', createNewTournament);
    }
});


async function checkUserRole() {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', session.user.id)
        .single();

    if (profile && profile.role === 'admin') {
        isAdmin = true;
        adminControls.classList.remove('d-none');
    }
}

async function loadPageData() {
    const { data: active, error: activeError } = await supabase
        .from('tournaments')
        .select('*')
        .eq('status', 'active')
        .limit(1)
        .single();
    
    if (activeError && activeError.code !== 'PGRST116') {
        console.error("Error fetching active tournament:", activeError);
    }

    if (active) {
        activeTournament = active;
        activeTournamentSection.classList.remove('d-none');
        noActiveTournamentMessage.classList.add('d-none');
        renderActiveTournament();
    } else {
        activeTournamentSection.classList.add('d-none');
        noActiveTournamentMessage.classList.remove('d-none');
    }

    const { data: past, error: pastError } = await supabase
        .from('tournaments')
        .select('name, data')
        .eq('status', 'archived')
        .order('created_at', { ascending: false });

    if (past) {
        renderPastTournaments(past);
    }
}

function renderActiveTournament() {
    if (!activeTournament) return;
    tournamentNameEl.textContent = activeTournament.name;
    renderBracket();
}

function renderPastTournaments(pastTournaments) {
    pastWinnersList.innerHTML = '';
    if (pastTournaments.length === 0) {
        pastWinnersList.innerHTML = '<p class="text-center text-muted">No past tournaments found.</p>';
        return;
    }

    pastTournaments.forEach(tourney => {
        const winner = tourney.data.champion || 'N/A';
        const item = document.createElement('div');
        item.className = 'list-group-item';
        item.innerHTML = `
            <span>${tourney.name}</span>
            <span class="champion-name">🏆 ${winner}</span>
        `;
        pastWinnersList.appendChild(item);
    });
}

function generateEmptyBracket(size) {
    const data = { rounds: [], champion: 'TBD' };
    let numMatches = size / 2;
    
    while (numMatches >= 1) {
        const round = { matches: [] };
        for (let i = 0; i < numMatches; i++) {
            round.matches.push({
                p1: `Player ${i * 2 + 1}`,
                p2: `Player ${i * 2 + 2}`,
                winner: null
            });
        }
        data.rounds.push(round);
        numMatches /= 2;
    }

    for (let i = 1; i < data.rounds.length; i++) {
        for (const match of data.rounds[i].matches) {
            match.p1 = 'TBD';
            match.p2 = 'TBD';
        }
    }
    return data;
}

async function createNewTournament() {
    const name = document.getElementById('new-tournament-name').value;
    const size = parseInt(document.getElementById('new-tournament-size').value);

    if (!name) {
        alert('Please enter a tournament name.');
        return;
    }

    const { data: existingActive } = await supabase.from('tournaments').select('id').eq('status', 'active');
    if (existingActive && existingActive.length > 0) {
        alert('An active tournament is already running. Please archive it first.');
        return;
    }

    const newBracketData = generateEmptyBracket(size);
    
    const { error } = await supabase.from('tournaments').insert({
        name: name,
        size: size,
        status: 'active',
        data: newBracketData
    });

    if (error) {
        alert('Error creating tournament: ' + error.message);
    } else {
        const modalEl = document.getElementById('createTournamentModal');
        const modal = bootstrap.Modal.getInstance(modalEl);
        if (modal) modal.hide();
        document.getElementById('create-tournament-form').reset();
        await loadPageData();
    }
}


function renderBracket() {
    if (!activeTournament) {
        bracketContainer.innerHTML = '';
        return;
    }
    
    const data = activeTournament.data;
    const bracketSize = activeTournament.size;
    bracketContainer.innerHTML = '';

    data.rounds.forEach((round, roundIndex) => {
        const roundEl = document.createElement('div');
        roundEl.className = 'round';
        roundEl.dataset.roundIndex = roundIndex;

        const header = document.createElement('h3');
        header.className = 'round-header';
        header.textContent = getRoundName(roundIndex, data.rounds.length, bracketSize);
        roundEl.appendChild(header);

        round.matches.forEach((match) => {
            const matchEl = document.createElement('div');
            matchEl.className = 'match';
            matchEl.dataset.round = roundIndex;
            matchEl.dataset.match = round.matches.indexOf(match);
            
            if (match.winner) {
                matchEl.classList.add('has-winner');
                const resetButton = document.createElement('button');
                resetButton.className = 'reset-match-button';
                resetButton.innerHTML = '&times;';
                resetButton.addEventListener('click', handleResetMatchClick);
                matchEl.appendChild(resetButton);
            }

            const createPlayerEl = (playerKey) => {
                const playerEl = document.createElement('div');
                playerEl.className = 'player';
                playerEl.dataset.player = playerKey;
                
                const playerName = document.createElement('span');
                playerName.className = 'player-name';
                playerName.textContent = match[playerKey];

                const winButton = document.createElement('button');
                winButton.className = 'win-button';
                winButton.textContent = '▶';
                winButton.addEventListener('click', handleWinButtonClick);
                
                playerEl.append(playerName, winButton);
                
                if (match.winner === playerKey) playerEl.classList.add('winner');
                if (match.winner && match.winner !== playerKey) playerEl.classList.add('loser');

                return playerEl;
            };
            matchEl.append(createPlayerEl('p1'), createPlayerEl('p2'));
            roundEl.appendChild(matchEl);
        });
        bracketContainer.appendChild(roundEl);
    });

    const championRoundEl = document.createElement('div');
    championRoundEl.className = 'round champion-round';
    
    const header = document.createElement('h3');
    header.className = 'round-header';
    header.textContent = '🏆 Champion 🏆';
    championRoundEl.appendChild(header);

    const championMatchEl = document.createElement('div');
    championMatchEl.className = 'match champion-box';
    const championPlayerEl = document.createElement('div');
    championPlayerEl.className = 'player';
    const championNameEl = document.createElement('span');
    championNameEl.className = 'player-name';
    championNameEl.textContent = data.champion || 'TBD';
    
    championPlayerEl.append(championNameEl);
    championMatchEl.append(championPlayerEl);
    championRoundEl.append(championMatchEl);
    bracketContainer.append(championRoundEl);
    
    // The call to drawConnectors has been removed.

    if (adminModeToggle.checked) {
        document.body.classList.add('admin-mode-on');
        document.querySelectorAll('.player-name').forEach(p => p.setAttribute('contenteditable', true));
    }
}

// The entire drawConnectors function has been removed.

function getRoundName(roundIndex, totalRounds, bracketSize) {
    if (bracketSize === 16) {
        const roundsLeft = totalRounds - roundIndex;
        if (roundsLeft === 1) return 'Final';
        if (roundsLeft === 2) return 'Semi-Finals';
        if (roundsLeft === 3) return 'Quarter-Finals';
        return `Round ${roundIndex + 1}`;
    } else {
        const roundsLeft = totalRounds - roundIndex;
        if (roundsLeft === 1) return 'Final';
        if (roundsLeft === 2) return 'Semi-Finals';
        return 'Quarter-Finals';
    }
}


function toggleAdminMode(event) {
    const isAdminMode = event.target.checked;
    document.body.classList.toggle('admin-mode-on', isAdminMode);
    document.querySelectorAll('.player-name').forEach(p => {
        p.setAttribute('contenteditable', isAdminMode);
    });
}

function updateDataFromDOM() {
    if (!activeTournament) return;
    const data = activeTournament.data;
    
    bracketContainer.querySelectorAll('.round:not(.champion-round) .match').forEach(matchEl => {
        const round = matchEl.dataset.round;
        const match = matchEl.dataset.match;
        data.rounds[round].matches[match].p1 = matchEl.querySelector('[data-player="p1"] .player-name').textContent;
        data.rounds[round].matches[match].p2 = matchEl.querySelector('[data-player="p2"] .player-name').textContent;
    });

    const championName = bracketContainer.querySelector('.champion-box .player-name');
    if (championName) {
        data.champion = championName.textContent;
    }
}

async function saveTournamentData() {
    if (!activeTournament) return;
    updateDataFromDOM();
    
    const { error } = await supabase
        .from('tournaments')
        .update({ data: activeTournament.data })
        .eq('id', activeTournament.id);

    if (error) {
        alert('Error saving bracket: ' + error.message);
    } else {
        alert('Bracket saved successfully!');
    }
}

async function archiveActiveTournament() {
    if (!activeTournament) {
        alert('There is no active tournament to archive.');
        return;
    }

    if (activeTournament.data.champion === 'TBD' || activeTournament.data.champion === '') {
        if (!confirm('This tournament does not have a champion yet. Are you sure you want to archive it?')) {
            return;
        }
    }

    const { error } = await supabase
        .from('tournaments')
        .update({ status: 'archived' })
        .eq('id', activeTournament.id);

    if (error) {
        alert('Error archiving tournament: ' + error.message);
    } else {
        alert('Tournament archived successfully!');
        await loadPageData();
    }
}

function handleWinButtonClick(event) {
    if (!adminModeToggle.checked) return;
    
    updateDataFromDOM();

    const winButton = event.target;
    const playerEl = winButton.closest('.player');
    const matchEl = playerEl.closest('.match');
    const roundIndex = parseInt(matchEl.dataset.round);
    const matchIndex = parseInt(matchEl.dataset.match);
    const playerKey = playerEl.dataset.player;

    const data = activeTournament.data;
    const match = data.rounds[roundIndex].matches[matchIndex];
    
    if (match.p1 === 'TBD' || match.p2 === 'TBD') return;

    match.winner = playerKey;
    const winnerName = match[playerKey];

    const nextRoundIndex = roundIndex + 1;
    if (nextRoundIndex >= data.rounds.length) {
        data.champion = winnerName;
    } else {
        const nextMatchIndex = Math.floor(matchIndex / 2);
        const nextPlayerSlot = matchIndex % 2 === 0 ? 'p1' : 'p2';
        data.rounds[nextRoundIndex].matches[nextMatchIndex][nextPlayerSlot] = winnerName;
    }
    renderBracket();
}

function handleResetMatchClick(event) {
    if (!adminModeToggle.checked) return;
    
    const resetButton = event.target;
    const matchEl = resetButton.closest('.match');
    const roundIndex = parseInt(matchEl.dataset.round);
    const matchIndex = parseInt(matchEl.dataset.match);
    
    const data = activeTournament.data;

    const clearFutureRounds = (roundIdx, matchIdx) => {
        const match = data.rounds[roundIdx].matches[matchIdx];
        const winnerName = match.winner ? match[match.winner] : null;

        if (!winnerName) return;

        const nextRoundIdx = roundIdx + 1;
        if (nextRoundIdx >= data.rounds.length) {
            if (data.champion === winnerName) {
                data.champion = 'TBD';
            }
        } else {
            const nextMatchIdx = Math.floor(matchIdx / 2);
            const nextSlot = matchIdx % 2 === 0 ? 'p1' : 'p2';
            const nextMatch = data.rounds[nextRoundIdx].matches[nextMatchIdx];

            if (nextMatch[nextSlot] === winnerName) {
                nextMatch[nextSlot] = 'TBD';
                if (nextMatch.winner) {
                    clearFutureRounds(nextRoundIdx, nextMatchIdx);
                }
            }
        }
    };
    
    clearFutureRounds(roundIndex, matchIndex);
    data.rounds[roundIndex].matches[matchIndex].winner = null;
    renderBracket();
}