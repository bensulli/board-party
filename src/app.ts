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

type Player = "Maya" | "Eli";

interface GeminiResponsePart {
    text: string;
}

interface GeminiCandidate {
    content: {
        parts: GeminiResponsePart[];
        role: string;
    };
    finishReason: string;
    index: number;
    safetyRatings: any[]; 
}

interface GeminiApiResponse {
    candidates?: GeminiCandidate[];
    promptFeedback?: any; 
    error?: { message: string; code: number; details: any[] }; 
}


// --- Constants & Dynamically Set Variables ---
// const NUM_SPOTS = 10; // REMOVED: This will now be dynamic
let numBoardSpots: number = 0; // Dynamically set based on loaded questions
const PLAYERS: [Player, Player] = ["Maya", "Eli"];
const INTRO_VIDEO_URL = "intro.mp4"; 
const CONGRATS_VIDEO_URL = "end.mp4"; 
const QUESTIONS_FILE_PATH = 'questions.json'; 
const GEMINI_API_KEY = ""; 
const GEMINI_MODEL_TEXT = "gemini-2.0-flash";

// --- Game State Variables ---
let currentPlayer: Player = PLAYERS[0];
let tokenPosition: number = 0; 
let visitedSpots: boolean[]; // MODIFIED: Initialized after numBoardSpots is set
let questions: TriviaQuestionFormat[] = []; 
let availableQuestions: TriviaQuestionFormat[] = []; 
let currentTriviaQuestionForGemini: TriviaQuestionFormat | null = null; 
let currentBonusQuestion: { question: string; answer: string } | null = null;


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
const hintButton = document.getElementById('hint-button')! as HTMLButtonElement;
const explainAnswerButton = document.getElementById('explain-answer-button')! as HTMLButtonElement;
const geminiOutputArea = document.getElementById('gemini-output-area')!;
const bonusQuestionButton = document.getElementById('bonus-question-button')! as HTMLButtonElement;
const bonusQuestionDisplayArea = document.getElementById('bonus-question-display-area')!;
const bonusQuestionTextElement = document.getElementById('bonus-question-text')!; // Renamed for clarity
const bonusAnswerTextElement = document.getElementById('bonus-answer-text')!; // Renamed for clarity
const showBonusAnswerButton = document.getElementById('show-bonus-answer-button')! as HTMLButtonElement;
const loadingIndicator = document.getElementById('loading-indicator')!;


// --- Helper Functions ---
function showLoading(show: boolean) {
    if (show) {
        loadingIndicator.classList.remove('hidden');
        loadingIndicator.style.display = 'flex'; // Ensure flex is applied
    } else {
        loadingIndicator.classList.add('hidden');
        loadingIndicator.style.display = 'none';
    }
}

async function callGeminiAPI(prompt: string, buttonToDisable?: HTMLButtonElement): Promise<string | null> {
    if (!GEMINI_API_KEY) { // Check if the API key is available from Canvas
        console.warn("Gemini API Key not available. Feature disabled.");
        return "Gemini API is not configured for this environment.";
    }
    if (buttonToDisable) buttonToDisable.disabled = true;
    showLoading(true);

    try {
        const response = await fetch(`https://generativelanguage.googleapis.com/v2/models/${GEMINI_MODEL_TEXT}:generateContent?key=${GEMINI_API_KEY}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                contents: [{ parts: [{ text: prompt }] }],
                generation_config: { // Optional: configure generation parameters
                    temperature: 0.7,
                    top_k: 40,
                    max_output_tokens: 150
                }
            }),
        });

        if (!response.ok) {
            const errorData: GeminiApiResponse = await response.json();
            console.error('Gemini API Error:', response.status, errorData);
            return `Error from AI: ${errorData.error?.message || 'Failed to get a response.'}`;
        }

        const data: GeminiApiResponse = await response.json();
        
        if (data.candidates && data.candidates.length > 0 && data.candidates[0].content && data.candidates[0].content.parts.length > 0) {
            return data.candidates[0].content.parts[0].text;
        } else {
            console.warn('No content found in Gemini response:', data);
            return 'The AI gave an empty response. Try again?';
        }
    } catch (error) {
        console.error('Error calling Gemini API:', error);
        return 'Sorry, I could not connect to the AI right now.';
    } finally {
        if (buttonToDisable) buttonToDisable.disabled = false;
        showLoading(false);
    }
}


// --- Load Trivia Questions from JSON ---
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
        numBoardSpots = questions.length; // MODIFIED: Set dynamic number of spots
        if (numBoardSpots < 3) { // Ensure a minimum number of spots for playability
            console.warn(`Loaded ${numBoardSpots} questions. Too few for a good game. Using defaults.`);
            setupDefaultQuestions(); // This will set numBoardSpots based on defaults
            return false; // Indicate that we used defaults due to insufficient questions
        }
        availableQuestions = [...questions]; 
        visitedSpots = new Array(numBoardSpots).fill(false); // MODIFIED: Initialize visitedSpots
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
    numBoardSpots = questions.length; // MODIFIED: Set based on default questions
    availableQuestions = [...questions]; 
    visitedSpots = new Array(numBoardSpots).fill(false); // MODIFIED: Initialize visitedSpots
}


// --- Game Logic Functions ---
function setupBoardSpots() {
    boardCircle.innerHTML = ''; 
    if (numBoardSpots === 0) { // Safeguard if numBoardSpots wasn't set
        console.error("Cannot setup board: numBoardSpots is 0. Forcing default setup.");
        setupDefaultQuestions(); // Try to recover
        if (numBoardSpots === 0) return; // Still 0, critical error
    }

    const radius = boardCircle.offsetWidth / 2 - 30; 
    const centerX = boardCircle.offsetWidth / 2;
    const centerY = boardCircle.offsetHeight / 2;
    const containerWidth = boardContainer.offsetWidth;
    let spotSize = 40; 
    if (containerWidth > 450) { spotSize = 60; } 
    else if (containerWidth > 350) { spotSize = 50; }

    for (let i = 0; i < numBoardSpots; i++) { // MODIFIED: Use numBoardSpots
        const angle = (i / numBoardSpots) * 2 * Math.PI - (Math.PI / 2); // MODIFIED: Use numBoardSpots
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
        tokenPosition = (tokenPosition + 1) % numBoardSpots; // MODIFIED: Use numBoardSpots
        updateTokenPosition(); 
        
        playerToken.style.transition = 'transform 0.15s ease-out';
        playerToken.style.transform = `translateY(-${playerToken.offsetHeight * 0.3}px) scale(1.1)`; 

        await new Promise(resolve => setTimeout(resolve, 150)); 

        playerToken.style.transform = 'translateY(0px) scale(1)'; 
        await new Promise(resolve => setTimeout(resolve, 150)); 
    }
    playerToken.style.transition = 'all 0.5s ease-in-out'; 
    checkCurrentSpot();
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
    setupBoardSpots(); 
    updatePlayerTurnDisplay();
    enableDiceButtons(true); 
    tokenPosition = 0; 
    // Ensure visitedSpots is correctly sized, especially if re-initializing
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
    bonusQuestionButton.classList.remove('hidden'); // Show bonus question button
    bonusQuestionDisplayArea.classList.add('hidden'); // Hide bonus display area initially
}

function updatePlayerTurnDisplay() {
    playerTurnDisplay.textContent = `${currentPlayer}'s Turn`;
}

function switchPlayer() {
    currentPlayer = currentPlayer === PLAYERS[0] ? PLAYERS[1] : PLAYERS[0];
    updatePlayerTurnDisplay();
    enableDiceButtons(true); 
    bonusQuestionButton.classList.remove('hidden'); // Re-show bonus question button for next turn
}

async function handleDiceRoll(maxFaces: number) {
    enableDiceButtons(false); 
    bonusQuestionButton.classList.add('hidden'); // Hide bonus question button during roll
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

function checkCurrentSpot() {
    const spotElement = document.getElementById(`spot-${tokenPosition}`);
    if (!spotElement) {
        console.error(`Spot element spot-${tokenPosition} not found!`);
        checkGameEndOrSwitchPlayer(); 
        return;
    }

    if (!visitedSpots[tokenPosition]) { 
        visitedSpots[tokenPosition] = true; 
        spotElement.classList.add('visited'); 
        currentTriviaQuestionForGemini = getNextTriviaQuestion(); // Get a question for this new spot
        if (currentTriviaQuestionForGemini) {
            showTriviaModal(currentTriviaQuestionForGemini); 
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
        // If all questions from JSON are used, and we need one for a new spot,
        // we might want to indicate this or use a generic fallback.
        // For now, return null, and showTriviaModal will handle if question is null.
        return null;
    }
    const randomIndex = Math.floor(Math.random() * availableQuestions.length);
    const question = availableQuestions.splice(randomIndex, 1)[0]; 
    return question;
}

function showTriviaModal(questionData: TriviaQuestionFormat) {
    currentTriviaQuestionForGemini = questionData; // Store for Gemini features
    triviaQuestionArea.innerHTML = ''; 
    triviaAnswerArea.innerHTML = '';   
    triviaAnswerArea.classList.add('hidden'); 
    geminiOutputArea.classList.add('hidden');
    geminiOutputArea.innerHTML = '';
    
    showAnswerButton.classList.remove('hidden'); 
    showAnswerButton.disabled = false;
    hintButton.classList.remove('hidden');
    hintButton.disabled = false;
    explainAnswerButton.classList.add('hidden'); // Hide explain button initially

    if (questionData.question.text) {
        const p = document.createElement('p');
        p.textContent = questionData.question.text;
        p.className = 'text-lg mb-2';
        triviaQuestionArea.appendChild(p);
    }
    // ... (rest of media handling for question)
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
        // ... (rest of media handling for answer)
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
        hintButton.classList.add('hidden'); // Hide hint button after answer is shown
        explainAnswerButton.classList.remove('hidden'); // Show explain button
        explainAnswerButton.disabled = false;
    };

    showScreen('trivia'); 
}

function closeTrivia() {
    const mediaElements = triviaModal.querySelectorAll('video, audio');
    mediaElements.forEach(media => (media as HTMLMediaElement).pause());
    currentTriviaQuestionForGemini = null; // Clear context
    geminiOutputArea.classList.add('hidden');
    geminiOutputArea.innerHTML = '';


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
    currentPlayer = PLAYERS[0];
    tokenPosition = 0;
    // visitedSpots will be re-initialized based on numBoardSpots when game starts
    // numBoardSpots itself is determined by loading questions
    if (questions.length > 0) { // Should always be true if game ran
        availableQuestions = [...questions];
        if (visitedSpots && numBoardSpots > 0) { // Check if numBoardSpots has a valid value
             visitedSpots = new Array(numBoardSpots).fill(false);
        } else {
            // This scenario means numBoardSpots wasn't set, likely initial question load issue.
            // initializeGame will handle this on next "Start Game" click.
            console.warn("Resetting game, but numBoardSpots seems invalid. Will be set on next game start.");
        }
    } else {
        console.warn("Resetting game state, but master 'questions' array is empty. Questions will be re-attempted on next game start.");
    }
    bonusQuestionButton.classList.add('hidden'); // Hide bonus question button on reset
    bonusQuestionDisplayArea.classList.add('hidden');
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
    if (numBoardSpots === 0) return; // Don't try to render if no spots defined
    for (let i = 0; i < numBoardSpots; i++) {
        const spotEl = document.getElementById(`spot-${i}`);
        if (spotEl) {
            if (visitedSpots[i]) { spotEl.classList.add('visited'); } 
            else { spotEl.classList.remove('visited'); }
        }
    }
}

// --- Gemini API Feature Functions ---
async function handleGetHint() {
    if (!currentTriviaQuestionForGemini) return;
    geminiOutputArea.innerHTML = '✨ Thinking of a hint...';
    geminiOutputArea.classList.remove('hidden');
    hintButton.disabled = true;

    const questionText = currentTriviaQuestionForGemini.question.text || "this image/audio/video";
    const answerText = currentTriviaQuestionForGemini.answer.text || "the provided answer";

    const prompt = `For the trivia question "${questionText}" where the answer is "${answerText}", provide a short, easy-to-understand hint for kids. The hint should not give away the answer directly. Make it fun and encouraging.`;
    
    const hint = await callGeminiAPI(prompt, hintButton);
    geminiOutputArea.innerHTML = hint ? `✨ **Hint:** ${hint}` : '✨ Oops, couldn\'t get a hint right now!';
}

async function handleExplainAnswer() {
    if (!currentTriviaQuestionForGemini) return;
    geminiOutputArea.innerHTML = '✨ Explaining the answer...';
    geminiOutputArea.classList.remove('hidden');
    explainAnswerButton.disabled = true;

    const questionText = currentTriviaQuestionForGemini.question.text || "the question shown";
    const answerText = currentTriviaQuestionForGemini.answer.text || "the answer provided";

    const prompt = `The trivia question was: "${questionText}". The answer is: "${answerText}". Briefly explain why this answer is correct, in simple terms for a child (around 6-10 years old). Keep it short and engaging.`;
    
    const explanation = await callGeminiAPI(prompt, explainAnswerButton);
    geminiOutputArea.innerHTML = explanation ? `✨ **Explanation:** ${explanation}` : '✨ Oops, couldn\'t get an explanation!';
}

async function handleGenerateBonusQuestion() {
    bonusQuestionButton.disabled = true;
    bonusQuestionDisplayArea.classList.remove('hidden');
    bonusQuestionTextElement.textContent = '✨ Generating a super fun bonus question...';
    bonusAnswerTextElement.classList.add('hidden');
    showBonusAnswerButton.classList.add('hidden');
    showBonusAnswerButton.disabled = true;


    const prompt = `Generate a fun and simple general knowledge trivia question suitable for kids (ages 6-10). The question should have a clear, short answer. Format the output as:
Question: [Your Question Here]
Answer: [Your Answer Here]`;

    const result = await callGeminiAPI(prompt, bonusQuestionButton);

    if (result && result.includes("Question:") && result.includes("Answer:")) {
        const questionMatch = result.match(/Question: (.*)/);
        const answerMatch = result.match(/Answer: (.*)/);

        if (questionMatch && questionMatch[1] && answerMatch && answerMatch[1]) {
            currentBonusQuestion = { question: questionMatch[1].trim(), answer: answerMatch[1].trim() };
            bonusQuestionTextElement.textContent = `✨ Bonus Question: ${currentBonusQuestion.question}`;
            bonusAnswerTextElement.textContent = `Answer: ${currentBonusQuestion.answer}`;
            showBonusAnswerButton.classList.remove('hidden');
            showBonusAnswerButton.disabled = false;
        } else {
            bonusQuestionTextElement.textContent = 'Could not parse the bonus question. Try again?';
            currentBonusQuestion = null;
        }
    } else {
        bonusQuestionTextElement.textContent = result || 'Failed to generate bonus question. Try again?';
        currentBonusQuestion = null;
    }
    // Re-enable the main bonus question button if the host wants to try generating another one *instead* of answering this one
    // Or, keep it disabled until this bonus question flow is complete. For now, let's re-enable.
    bonusQuestionButton.disabled = false;
}


// --- Event Listeners & Initial Setup ---
async function initializeGame() {
    showScreen('start'); 
    startButton.disabled = true; 
    startButton.textContent = "Loading Questions..."; 

    const questionsLoaded = await loadTriviaQuestions(); 

    if (questionsLoaded) {
        startButton.disabled = false;
        startButton.textContent = "Start Game";
    } else {
        startButton.disabled = false; 
        startButton.textContent = "Start Game (Defaults)";
        const existingErrorMsg = startScreen.querySelector('p.text-red-500.text-sm.mt-2');
        if (!existingErrorMsg) { 
            const errorMsg = document.createElement('p');
            errorMsg.textContent = "Could not load custom questions. Using defaults.";
            errorMsg.className = "text-red-500 text-sm mt-2";
            startScreen.appendChild(errorMsg); 
        }
    }
}

startButton.addEventListener('click', () => {
    const startScreenH1 = startScreen.querySelector('h1');
    if(startScreenH1) startScreenH1.textContent = "Maya & Eli!";
    const errorMsg = startScreen.querySelector('p.text-red-500.text-sm.mt-2'); 
    if (errorMsg) errorMsg.remove();
    
    if (numBoardSpots === 0 || questions.length === 0) {  // numBoardSpots should be set if questions are loaded
        console.error("CRITICAL: No questions available or numBoardSpots is 0. Cannot start game.");
        alert("Error: No questions available to start the game. Please check questions.json or default setup."); 
        startButton.disabled = true;
        startButton.textContent = "Error: No Questions";
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
hintButton.addEventListener('click', handleGetHint);
explainAnswerButton.addEventListener('click', handleExplainAnswer);
bonusQuestionButton.addEventListener('click', handleGenerateBonusQuestion);
showBonusAnswerButton.addEventListener('click', () => {
    bonusAnswerTextElement.classList.remove('hidden');
    showBonusAnswerButton.disabled = true; // Can only show it once per bonus question
});


window.addEventListener('DOMContentLoaded', () => {
    initializeGame(); 
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
