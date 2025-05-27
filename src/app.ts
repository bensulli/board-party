// src/app.ts

// --- Interfaces and Types ---
interface TriviaQuestionFormat {
    id: number;
    question: {
        text?: string;
        imageUrl?: string;
        audioUrl?: string;
        videoUrl?: string;
    };
    answer: {
        text?: string;
        imageUrl?: string;
        audioUrl?: string;
        videoUrl?: string;
    };
}

interface ConfigFormat {
    players: string[];
}

type Player = string; // Player type is now just string

// --- Constants & Dynamically Set Variables ---
let numBoardSpots: number = 0; 
let playersList: Player[] = ["Player 1", "Player 2"]; // Default fallback players
const INTRO_VIDEO_URL = "intro.mp4"; 
const CONGRATS_VIDEO_URL = "intro.mp4"; 
const QUESTIONS_FILE_PATH = 'questions.json'; 
const CONFIG_FILE_PATH = 'config.json'; 

// --- Game State Variables ---
let currentPlayer: Player; 
let tokenPosition: number = 0; 
let visitedSpots: boolean[]; 
let questions: TriviaQuestionFormat[] = []; 
let availableQuestions: TriviaQuestionFormat[] = []; 

// --- DOM Elements ---
const startScreen = document.getElementById('start-screen')!;
const videoPlayerContainer = document.getElementById('video-player-container')!;
const videoPlayer = document.getElementById('video-player') as HTMLVideoElement;
const videoPlaceholderText = document.getElementById('video-placeholder-text')!;
const gameArea = document.getElementById('game-area')!;
const startButton = document.getElementById('start-button')! as HTMLButtonElement; 
const playerTurnDisplay = document.getElementById('player-turn-display')!;
const diceControls = document.getElementById('dice-controls')!;
const diceButtons = document.querySelectorAll<HTMLButtonElement>('.dice-button');
const diceResultDisplay = document.getElementById('dice-result-display')!;
const boardContainer = document.getElementById('board-container')!;
const boardCircle = document.getElementById('board-circle')!;
const playerToken = document.getElementById('player-token')!;
const triviaModal = document.getElementById('trivia-modal')!;
const triviaQuestionArea = document.getElementById('trivia-question-area')!;
const showAnswerButton = document.getElementById('show-answer-button')! as HTMLButtonElement;
const triviaAnswerArea = document.getElementById('trivia-answer-area')!;
const closeTriviaButton = document.getElementById('close-trivia-button')! as HTMLButtonElement;
const diceAnimationOverlay = document.getElementById('dice-animation-overlay')!;
const diceVisual = document.getElementById('dice-visual')!;
const loadingIndicator = document.getElementById('loading-indicator')!; 


// --- Load Config and Questions ---
/**
 * Fetches player configuration from config.json.
 * @returns {Promise<boolean>} True if config was loaded successfully, false otherwise.
 */
async function loadConfig(): Promise<boolean> {
    try {
        const response = await fetch(CONFIG_FILE_PATH);
        if (!response.ok) {
            console.error(`Error fetching config: ${response.status} ${response.statusText}. Using default players.`);
            return false;
        }
        const configData = await response.json() as ConfigFormat;
        if (configData && Array.isArray(configData.players) && configData.players.length >= 2) {
            playersList = configData.players;
            console.log("Player config loaded successfully:", playersList);
            return true;
        } else {
            console.error("Invalid config.json format or insufficient players. Using default players.");
            return false;
        }
    } catch (error) {
        console.error("Failed to load or parse config.json:", error, ". Using default players.");
        return false;
    }
}


async function loadTriviaQuestions(): Promise<boolean> {
    try {
        const response = await fetch(QUESTIONS_FILE_PATH);
        if (!response.ok) {
            console.error(`Error fetching questions: ${response.status} ${response.statusText}`);
            setupDefaultQuestions();
            return false;
        }
        const jsonData = await response.json();
        if (!Array.isArray(jsonData) || jsonData.length === 0) {
            console.error("Questions JSON is not a valid array or is empty. Using defaults.");
            setupDefaultQuestions();
            return false;
        }
        questions = jsonData as TriviaQuestionFormat[];
        numBoardSpots = questions.length; 
        if (numBoardSpots < 3) { 
            console.warn(`Loaded ${numBoardSpots} questions. Too few for a good game. Using defaults.`);
            setupDefaultQuestions(); 
            return false; 
        }
        availableQuestions = [...questions]; 
        visitedSpots = new Array(numBoardSpots).fill(false); 
        console.log(`Trivia questions loaded: ${numBoardSpots} spots will be on the board.`);
        return true;
    } catch (error) {
        console.error("Failed to load or parse questions.json:", error);
        setupDefaultQuestions(); 
        return false;
    }
}

function setupDefaultQuestions() {
    console.warn("Using default fallback questions.");
    questions = [
        { id: 101, question: { text: "Default Q: What is 1+1?" }, answer: { text: "2" } },
        { id: 102, question: { text: "Default Q: Color of a banana?" }, answer: { text: "Yellow" } },
        { id: 103, question: { text: "Default Q: Wheels on a bicycle?" }, answer: { text: "Two" } },
        { id: 104, question: { text: "Default Q: Sound a dog makes?" }, answer: { text: "Woof" } }
    ];
    numBoardSpots = questions.length; 
    availableQuestions = [...questions]; 
    visitedSpots = new Array(numBoardSpots).fill(false); 
}


// --- Game Logic Functions ---
function setupBoardSpots() {
    boardCircle.innerHTML = ''; 
    if (numBoardSpots === 0) { 
        console.error("Cannot setup board: numBoardSpots is 0. Forcing default setup.");
        setupDefaultQuestions(); 
        if (numBoardSpots === 0) return; 
    }

    const radius = boardCircle.offsetWidth / 2 - 30; 
    const centerX = boardCircle.offsetWidth / 2;
    const centerY = boardCircle.offsetHeight / 2;
    const containerWidth = boardContainer.offsetWidth;
    let spotSize = 40; 
    if (containerWidth > 450) { spotSize = 60; } 
    else if (containerWidth > 350) { spotSize = 50; }

    for (let i = 0; i < numBoardSpots; i++) { 
        const angle = (i / numBoardSpots) * 2 * Math.PI - (Math.PI / 2); 
        const x = centerX + radius * Math.cos(angle) - (spotSize / 2);
        const y = centerY + radius * Math.sin(angle) - (spotSize / 2);

        const spot = document.createElement('div');
        spot.classList.add('board-spot');
        spot.id = `spot-${i}`;
        spot.textContent = `${i + 1}`; 
        spot.style.width = `${spotSize}px`;
        spot.style.height = `${spotSize}px`;
        spot.style.left = `${x}px`;
        spot.style.top = `${y}px`;
        if (visitedSpots[i]) {
            spot.classList.add('visited');
        }
        boardCircle.appendChild(spot);
    }
    updateTokenPosition(); 
}

function updateTokenPosition(isInitial: boolean = false) {
    const spotEl = document.getElementById(`spot-${tokenPosition}`); 
    if (spotEl) {
        const spotRect = spotEl.getBoundingClientRect(); 
        const boardCircleRect = boardCircle.getBoundingClientRect(); 

        const tokenX = spotRect.left - boardCircleRect.left + (spotRect.width / 2) - (playerToken.offsetWidth / 2);
        const tokenY = spotRect.top - boardCircleRect.top + (spotRect.height / 2) - (playerToken.offsetHeight / 2);

        playerToken.style.left = `${tokenX}px`;
        playerToken.style.top = `${tokenY}px`;

        if (!isInitial) {
            playerToken.style.transform = 'scale(1.2)';
            setTimeout(() => {
                playerToken.style.transform = 'scale(1)';
            }, 200); 
        }
    }
}

async function animateTokenMove(steps: number) {
    enableDiceButtons(false); 

    for (let i = 0; i < steps; i++) {
        tokenPosition = (tokenPosition + 1) % numBoardSpots; 
        updateTokenPosition(); 
        
        playerToken.style.transition = 'transform 0.15s ease-out';
        playerToken.style.transform = `translateY(-${playerToken.offsetHeight * 0.3}px) scale(1.1)`; 

        await new Promise(resolve => setTimeout(resolve, 150)); 

        playerToken.style.transform = 'translateY(0px) scale(1)'; 
        await new Promise(resolve => setTimeout(resolve, 150)); 
    }
    playerToken.style.transition = 'all 0.5s ease-in-out'; 
    await checkCurrentSpot(); 
}

function showScreen(screenName: 'start' | 'video' | 'game' | 'trivia' | 'diceAnimation') {
    startScreen.classList.add('hidden');
    videoPlayerContainer.classList.add('hidden');
    gameArea.classList.add('hidden');
    triviaModal.classList.add('hidden'); 
    diceAnimationOverlay.classList.add('hidden');

    if (videoPlayerContainer.style.display === 'flex') videoPlayerContainer.style.display = 'none';
    if (gameArea.style.display === 'flex') gameArea.style.display = 'none';
    if (triviaModal.style.display === 'flex') triviaModal.style.display = 'none';
    if (diceAnimationOverlay.style.display === 'flex') diceAnimationOverlay.style.display = 'none';

    videoPlayer.pause(); 
    videoPlayer.currentTime = 0; 

    switch (screenName) {
        case 'start': startScreen.classList.remove('hidden'); break;
        case 'video': videoPlayerContainer.classList.remove('hidden'); videoPlayerContainer.style.display = 'flex'; break;
        case 'game': gameArea.classList.remove('hidden'); gameArea.style.display = 'flex'; break;
        case 'trivia': triviaModal.classList.remove('hidden'); triviaModal.style.display = 'flex'; break;
        case 'diceAnimation': diceAnimationOverlay.classList.remove('hidden'); diceAnimationOverlay.style.display = 'flex'; break;
    }
}

function playIntroVideo() {
    showScreen('video');
    videoPlayer.onended = null; 
    videoPlayer.onerror = () => { 
        console.error("Error loading intro video.");
        videoPlaceholderText.textContent = `Error loading video: ${INTRO_VIDEO_URL}. Starting game...`;
        videoPlayer.classList.add('hidden');
        videoPlaceholderText.classList.remove('hidden');
        setTimeout(initializeGameBoard, 2000); 
    };

    if (INTRO_VIDEO_URL && (INTRO_VIDEO_URL.endsWith('.mp4') || INTRO_VIDEO_URL.endsWith('.webm') || INTRO_VIDEO_URL.endsWith('.ogv'))) {
        videoPlayer.src = INTRO_VIDEO_URL;
        videoPlayer.classList.remove('hidden');
        videoPlaceholderText.classList.add('hidden');
        videoPlayer.play().catch(e => { 
            console.warn("Intro video play failed (perhaps autoplay was blocked):", e);
            videoPlaceholderText.textContent = `Video could not autoplay. Click screen to start game.`;
            videoPlayer.classList.add('hidden');
            videoPlaceholderText.classList.remove('hidden');
            videoPlayerContainer.onclick = () => {
                videoPlayerContainer.onclick = null; 
                initializeGameBoard();
            };
            setTimeout(initializeGameBoard, 5000);
        });
        videoPlayer.onended = initializeGameBoard; 
    } else {
        videoPlayer.classList.add('hidden');
        videoPlaceholderText.classList.remove('hidden');
        videoPlaceholderText.textContent = `Simulating Intro Video... (File: '${INTRO_VIDEO_URL}')`;
        setTimeout(initializeGameBoard, 3000); 
    }
}

function initializeGameBoard() {
    videoPlayerContainer.onclick = null; 
    showScreen('game');

    currentPlayer = playersList[Math.floor(Math.random() * playersList.length)];
    if (playersList.length < 2) {
        console.warn("Less than 2 players configured. Player switching might not work as expected.");
    }

    setupBoardSpots(); 
    updatePlayerTurnDisplay();
    enableDiceButtons(true); 
    tokenPosition = 0; 
    if (!visitedSpots || visitedSpots.length !== numBoardSpots) {
        visitedSpots = new Array(numBoardSpots).fill(false);
    } else {
        visitedSpots.fill(false); 
    }
    
    if (questions.length > 0) {
        availableQuestions = [...questions];
    } else {
        console.error("Cannot initialize game board: No questions loaded (master list).");
        setupDefaultQuestions(); 
        availableQuestions = [...questions];
    }

    renderBoardState(); 
    updateTokenPosition(true); 
    diceResultDisplay.textContent = ''; 
}

function updatePlayerTurnDisplay() {
    playerTurnDisplay.textContent = `${currentPlayer}'s Turn`;
}

function switchPlayer() {
    const currentPlayerIndex = playersList.indexOf(currentPlayer);
    const nextPlayerIndex = (currentPlayerIndex + 1) % playersList.length;
    currentPlayer = playersList[nextPlayerIndex];
    
    updatePlayerTurnDisplay();
    enableDiceButtons(true); 
}

async function handleDiceRoll(maxFaces: number) {
    enableDiceButtons(false); 
    diceResultDisplay.textContent = "Rolling...";

    showScreen('diceAnimation'); 
    let roll = 0;
    const animationDuration = 1500; 
    const intervalTime = 100; 
    let elapsedTime = 0;

    const rollInterval = setInterval(() => {
        diceVisual.textContent = `${Math.floor(Math.random() * maxFaces) + 1}`; 
        elapsedTime += intervalTime;
        if (elapsedTime >= animationDuration) {
            clearInterval(rollInterval); 
            roll = Math.floor(Math.random() * maxFaces) + 1; 
            diceVisual.textContent = `${roll}`; 
            setTimeout(async () => {
                showScreen('game'); 
                diceResultDisplay.textContent = `${currentPlayer} rolled a ${roll}!`;
                await animateTokenMove(roll); 
            }, 800); 
        }
    }, intervalTime);
}

async function checkCurrentSpot() {
    const spotElement = document.getElementById(`spot-${tokenPosition}`);
    if (!spotElement) {
        console.error(`Spot element spot-${tokenPosition} not found!`);
        checkGameEndOrSwitchPlayer(); 
        return;
    }

    if (!visitedSpots[tokenPosition]) { 
        spotElement.classList.add('glowing'); 

        await new Promise(resolve => setTimeout(resolve, 1000)); 

        spotElement.classList.remove('glowing'); 
        
        visitedSpots[tokenPosition] = true; 
        spotElement.classList.add('visited'); 
        
        const questionForSpot = getNextTriviaQuestion(); 
        if (questionForSpot) {
            showTriviaModal(questionForSpot); 
        } else {
            console.warn("Landed on unvisited spot, but no more unique questions available.");
            checkGameEndOrSwitchPlayer(); 
        }
    } else { 
        diceResultDisplay.textContent += " (Already visited!)";
        checkGameEndOrSwitchPlayer(); 
    }
}

function checkGameEndOrSwitchPlayer() {
    if (visitedSpots.every(visited => visited)) { 
        playCongratsVideo(); 
    } else {
        switchPlayer(); 
    }
}

function getNextTriviaQuestion(): TriviaQuestionFormat | null {
    if (availableQuestions.length === 0) {
        console.warn("No more unique trivia questions available in the current pool!");
        return null;
    }
    const randomIndex = Math.floor(Math.random() * availableQuestions.length);
    const question = availableQuestions.splice(randomIndex, 1)[0]; 
    return question;
}

function showTriviaModal(questionData: TriviaQuestionFormat) {
    triviaQuestionArea.innerHTML = ''; 
    triviaAnswerArea.innerHTML = '';   
    triviaAnswerArea.classList.add('hidden'); 
    
    showAnswerButton.classList.remove('hidden'); 
    showAnswerButton.disabled = false;
    closeTriviaButton.disabled = true;
    closeTriviaButton.hidden = true;

    if (questionData.question.text) {
        const p = document.createElement('p');
        p.textContent = questionData.question.text;
        p.className = 'text-lg mb-2';
        triviaQuestionArea.appendChild(p);
    }
    const createMediaPlaceholder = (url: string, type: string) => {
        const p = document.createElement('p');
        p.textContent = `[${type} Placeholder: ${url.split('/').pop()}]`; 
        p.className = "text-sm italic my-2 p-2 bg-gray-100 rounded";
        return p;
    };

    if (questionData.question.imageUrl) {
        const img = document.createElement('img'); img.src = questionData.question.imageUrl; img.alt = "Question Image";
        img.className = "mx-auto my-2 rounded-md max-h-48 object-contain"; triviaQuestionArea.appendChild(img);
    }
    if (questionData.question.audioUrl) {
        if (questionData.question.audioUrl.toUpperCase().startsWith("PLACEHOLDER")) { triviaQuestionArea.appendChild(createMediaPlaceholder(questionData.question.audioUrl, "Audio")); }
        else { const audio = document.createElement('audio'); audio.src = questionData.question.audioUrl; audio.controls = true; audio.className = "w-full my-2"; triviaQuestionArea.appendChild(audio); }
    }
    if (questionData.question.videoUrl) {
         if (questionData.question.videoUrl.toUpperCase().startsWith("PLACEHOLDER")) { triviaQuestionArea.appendChild(createMediaPlaceholder(questionData.question.videoUrl, "Video")); }
        else { const video = document.createElement('video'); video.src = questionData.question.videoUrl; video.controls = true; video.className = "w-full my-2 rounded-md"; video.autoplay = false; triviaQuestionArea.appendChild(video); }
    }


    showAnswerButton.onclick = () => {
        triviaAnswerArea.innerHTML = ''; 
        if (questionData.answer.text) {
            const p = document.createElement('p'); p.textContent = questionData.answer.text;
            p.className = 'text-md'; triviaAnswerArea.appendChild(p);
        }
        if (questionData.answer.imageUrl) {
            const img = document.createElement('img'); img.src = questionData.answer.imageUrl; img.alt = "Answer Image";
            img.className = "mx-auto my-1 rounded-md max-h-40 object-contain"; triviaAnswerArea.appendChild(img);
        }
        if (questionData.answer.audioUrl) {
             if (questionData.answer.audioUrl.toUpperCase().startsWith("PLACEHOLDER")) { triviaAnswerArea.appendChild(createMediaPlaceholder(questionData.answer.audioUrl, "Audio Answer")); }
            else { const audio = document.createElement('audio'); audio.src = questionData.answer.audioUrl; audio.controls = true; audio.className = "w-full my-1"; triviaAnswerArea.appendChild(audio); }
        }
        if (questionData.answer.videoUrl) {
            if (questionData.answer.videoUrl.toUpperCase().startsWith("PLACEHOLDER")) { triviaAnswerArea.appendChild(createMediaPlaceholder(questionData.answer.videoUrl, "Video Answer")); }
            else { const video = document.createElement('video'); video.src = questionData.answer.videoUrl; video.controls = true; video.className = "w-full my-1 rounded-md"; triviaAnswerArea.appendChild(video); }
        }

        triviaAnswerArea.classList.remove('hidden'); 
        showAnswerButton.classList.add('hidden');    
        showAnswerButton.disabled = true;     
        closeTriviaButton.disabled = false;   
        closeTriviaButton.hidden = false;
    };

    showScreen('trivia'); 
}

function closeTrivia() {
    const mediaElements = triviaModal.querySelectorAll('video, audio');
    mediaElements.forEach(media => (media as HTMLMediaElement).pause());
    showScreen('game'); 
    checkGameEndOrSwitchPlayer(); 
}

function playCongratsVideo() {
    showScreen('video'); 
    diceResultDisplay.textContent = "All spots visited! 🎉"; 
    videoPlayer.onended = null; 
    videoPlayer.onerror = () => { 
        console.error("Error loading congrats video.");
        videoPlaceholderText.textContent = `Error loading video: ${CONGRATS_VIDEO_URL}. Game Over! Congratulations!`;
        videoPlayer.classList.add('hidden');
        videoPlaceholderText.classList.remove('hidden');
        setTimeout(gameOverSequence, 2000); 
    };

    if (CONGRATS_VIDEO_URL && (CONGRATS_VIDEO_URL.endsWith('.mp4') || CONGRATS_VIDEO_URL.endsWith('.webm') || CONGRATS_VIDEO_URL.endsWith('.ogv'))) {
        videoPlayer.src = CONGRATS_VIDEO_URL;
        videoPlayer.classList.remove('hidden');
        videoPlaceholderText.classList.add('hidden');
        videoPlayer.play().catch(e => { 
             console.warn("Congrats video play failed:", e);
             videoPlaceholderText.textContent = `Video could not play. Congratulations! Game Over.`;
             videoPlayer.classList.add('hidden');
             videoPlaceholderText.classList.remove('hidden');
             setTimeout(gameOverSequence, 5000); 
        });
        videoPlayer.onended = gameOverSequence; 
    } else {
        videoPlayer.classList.add('hidden');
        videoPlaceholderText.classList.remove('hidden');
        videoPlaceholderText.textContent = `Simulating Congrats Video... (File: '${CONGRATS_VIDEO_URL}')`;
        setTimeout(gameOverSequence, 5000); 
    }
}

function gameOverSequence() {
    const startScreenH1 = startScreen.querySelector('h1');
    if(startScreenH1) startScreenH1.textContent = "Congratulations! Play Again?"; 
    showScreen('start'); 
    resetFullGameState(); 
}

function resetFullGameState() {
    tokenPosition = 0;
    if (questions.length > 0) { 
        availableQuestions = [...questions];
        if (visitedSpots && numBoardSpots > 0) { 
             visitedSpots = new Array(numBoardSpots).fill(false);
        } else {
            console.warn("Resetting game, but numBoardSpots seems invalid. Will be set on next game start.");
        }
    } else {
        console.warn("Resetting game state, but master 'questions' array is empty. Questions will be re-attempted on next game start.");
    }
}

function enableDiceButtons(enable: boolean) {
    diceButtons.forEach(button => { 
        button.disabled = !enable;
        button.classList.toggle('opacity-50', !enable);
        button.classList.toggle('cursor-not-allowed', !enable);
        const diceType = button.dataset.diceType;
        if (enable) {
            if (diceType === "3") button.classList.add('hover:bg-yellow-500');
            else if (diceType === "6") button.classList.add('hover:bg-orange-500');
            else if (diceType === "10") button.classList.add('hover:bg-red-500');
        } else {
            if (diceType === "3") button.classList.remove('hover:bg-yellow-500');
            else if (diceType === "6") button.classList.remove('hover:bg-orange-500');
            else if (diceType === "10") button.classList.remove('hover:bg-red-500');
        }
    });
}

function renderBoardState() {
    if (numBoardSpots === 0) return; 
    for (let i = 0; i < numBoardSpots; i++) {
        const spotEl = document.getElementById(`spot-${i}`);
        if (spotEl) {
            if (visitedSpots[i]) { spotEl.classList.add('visited'); } 
            else { spotEl.classList.remove('visited'); }
        }
    }
}

// --- Event Listeners & Initial Setup ---
async function initializeApp() { 
    showScreen('start'); 
    startButton.disabled = true; 
    startButton.textContent = "Loading Game Data..."; 

    await loadConfig(); 
    const questionsLoaded = await loadTriviaQuestions(); 

    if (questionsLoaded && playersList.length >=2) { 
        startButton.disabled = false;
        startButton.textContent = "Start Game";
    } else {
        startButton.disabled = false; 
        startButton.textContent = "Start Game (Defaults)";
        const existingErrorMsg = startScreen.querySelector('p.text-red-500.text-sm.mt-2');
        if (!existingErrorMsg) { 
            let errorText = "";
            if (!questionsLoaded) errorText += "Could not load custom questions. ";
            if (playersList.length < 2) errorText += "Player config error. ";
            errorText += "Using defaults.";

            const errorMsg = document.createElement('p');
            errorMsg.textContent = errorText.trim();
            errorMsg.className = "text-red-500 text-sm mt-2";
            startScreen.appendChild(errorMsg); 
        }
    }
}

startButton.addEventListener('click', () => {
    const startScreenH1 = startScreen.querySelector('h1');
    if(startScreenH1) startScreenH1.textContent = "Maya & Eli's Adventure!";
    const errorMsg = startScreen.querySelector('p.text-red-500.text-sm.mt-2'); 
    if (errorMsg) errorMsg.remove();
    
    if (numBoardSpots === 0 || questions.length === 0 || playersList.length < 2) {  
        console.error("CRITICAL: Game data not properly loaded. Cannot start game.");
        alert("Error: Game data (questions or players) not loaded. Please check setup."); 
        startButton.disabled = true;
        startButton.textContent = "Error: Load Failed";
        return; 
    }
    playIntroVideo(); 
});

diceButtons.forEach(button => {
    button.addEventListener('click', () => {
        if (button.disabled) return; 
        const diceType = parseInt(button.dataset.diceType || "6"); 
        handleDiceRoll(diceType);
    });
});

closeTriviaButton.addEventListener('click', closeTrivia);

window.addEventListener('DOMContentLoaded', () => {
    initializeApp(); 
});

let resizeTimeout: number;
window.addEventListener('resize', () => {
    clearTimeout(resizeTimeout); 
    resizeTimeout = window.setTimeout(() => {
        if (!gameArea.classList.contains('hidden')) {
            setupBoardSpots(); 
            updateTokenPosition(true); 
        }
    }, 250); 
});
