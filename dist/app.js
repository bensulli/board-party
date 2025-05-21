"use strict";
// src/app.ts
// --- Constants ---
const NUM_SPOTS = 10;
const PLAYERS = ["Maya", "Eli"];
// MODIFIED: Updated video URLs to local paths
const INTRO_VIDEO_URL = "intro.mp4";
const CONGRATS_VIDEO_URL = "end.mp4";
const QUESTIONS_FILE_PATH = 'questions.json'; // Path to your questions file
// --- Game State Variables ---
let currentPlayer = PLAYERS[0];
let tokenPosition = 0; // 0 to NUM_SPOTS - 1
let visitedSpots = new Array(NUM_SPOTS).fill(false);
let questions = []; // This will be populated from JSON
let availableQuestions = []; // To draw from
// --- DOM Elements ---
// Screens
const startScreen = document.getElementById('start-screen');
const videoPlayerContainer = document.getElementById('video-player-container');
const videoPlayer = document.getElementById('video-player');
const videoPlaceholderText = document.getElementById('video-placeholder-text');
const gameArea = document.getElementById('game-area');
const startButton = document.getElementById('start-button'); // Get start button
// Game Area Elements
const playerTurnDisplay = document.getElementById('player-turn-display');
const diceControls = document.getElementById('dice-controls');
const diceButtons = document.querySelectorAll('.dice-button');
const diceResultDisplay = document.getElementById('dice-result-display');
// Board Elements
const boardContainer = document.getElementById('board-container');
const boardCircle = document.getElementById('board-circle');
const playerToken = document.getElementById('player-token');
// Trivia Modal Elements
const triviaModal = document.getElementById('trivia-modal');
const triviaQuestionArea = document.getElementById('trivia-question-area');
const showAnswerButton = document.getElementById('show-answer-button');
const triviaAnswerArea = document.getElementById('trivia-answer-area');
const closeTriviaButton = document.getElementById('close-trivia-button');
// Dice Animation Elements
const diceAnimationOverlay = document.getElementById('dice-animation-overlay');
const diceVisual = document.getElementById('dice-visual');
// --- Load Trivia Questions from JSON ---
/**
 * Fetches trivia questions from an external JSON file.
 * @returns {Promise<boolean>} True if questions were loaded successfully, false otherwise.
 */
async function loadTriviaQuestions() {
    try {
        // Fetch the questions.json file.
        // The path is relative to the index.html file.
        const response = await fetch(QUESTIONS_FILE_PATH);
        if (!response.ok) {
            // If the server returns an error (e.g., 404 Not Found), log it.
            console.error(`Error fetching questions: ${response.status} ${response.statusText}`);
            // Fallback to default questions if JSON fails to load.
            setupDefaultQuestions();
            return false;
        }
        // Parse the JSON data from the response.
        const jsonData = await response.json();
        // Validate that the parsed data is an array and not empty.
        if (!Array.isArray(jsonData) || jsonData.length === 0) {
            console.error("Questions JSON is not a valid array or is empty.");
            setupDefaultQuestions();
            return false;
        }
        // Assign the loaded questions and create a copy for the available questions pool.
        questions = jsonData;
        availableQuestions = [...questions]; // Make a fresh copy for the game session
        console.log("Trivia questions loaded successfully from JSON.");
        return true;
    }
    catch (error) {
        // Catch any other errors during fetching or parsing (e.g., network error, invalid JSON format).
        console.error("Failed to load or parse questions.json:", error);
        setupDefaultQuestions(); // Use default questions as a fallback.
        return false;
    }
}
/**
 * Sets up a few default questions as a fallback if loading from JSON fails.
 * This ensures the game can still run with some content.
 */
function setupDefaultQuestions() {
    console.warn("Using default fallback questions.");
    questions = [
        {
            id: 101, // Using different IDs to distinguish from potential JSON questions
            question: { text: "Default Q: What is the result of 1 plus 1?" },
            answer: { text: "2" }
        },
        {
            id: 102,
            question: { text: "Default Q: What color is a ripe banana?" },
            answer: { text: "Yellow" }
        },
        {
            id: 103,
            question: { text: "Default Q: How many wheels does a bicycle have?" },
            answer: { text: "Two" }
        }
    ];
    availableQuestions = [...questions]; // Initialize available questions with these defaults
}
// --- Game Logic Functions ---
/**
 * Initializes the game board spots, positioning them in a circle.
 * This function calculates the positions based on the board size.
 */
function setupBoardSpots() {
    boardCircle.innerHTML = ''; // Clear any existing spots to prevent duplication on resize.
    // Calculate radius and center based on the current dimensions of the board circle.
    // Subtracting half spot size and padding from radius for better placement.
    const radius = boardCircle.offsetWidth / 2 - 30;
    const centerX = boardCircle.offsetWidth / 2;
    const centerY = boardCircle.offsetHeight / 2;
    // Determine spot size dynamically for responsiveness.
    const containerWidth = boardContainer.offsetWidth;
    let spotSize = 40; // Default small size
    if (containerWidth > 450) { // Larger size for medium screens
        spotSize = 60;
    }
    else if (containerWidth > 350) { // Intermediate size
        spotSize = 50;
    }
    // Create and position each spot.
    for (let i = 0; i < NUM_SPOTS; i++) {
        // Calculate angle for each spot, starting from the top (12 o'clock).
        const angle = (i / NUM_SPOTS) * 2 * Math.PI - (Math.PI / 2);
        // Calculate x and y coordinates for the spot's top-left corner.
        const x = centerX + radius * Math.cos(angle) - (spotSize / 2);
        const y = centerY + radius * Math.sin(angle) - (spotSize / 2);
        const spot = document.createElement('div');
        spot.classList.add('board-spot');
        spot.id = `spot-${i}`; // Assign an ID for later reference.
        spot.textContent = `${i + 1}`; // Display spot number.
        // Apply dynamic size.
        spot.style.width = `${spotSize}px`;
        spot.style.height = `${spotSize}px`;
        // Position the spot absolutely within the board circle.
        spot.style.left = `${x}px`;
        spot.style.top = `${y}px`;
        // If the spot has been visited (e.g., on game reset/reload), apply the 'visited' style.
        if (visitedSpots[i]) {
            spot.classList.add('visited');
        }
        boardCircle.appendChild(spot);
    }
    updateTokenPosition(); // Update the token's position after spots are drawn/redrawn.
}
/**
 * Updates the visual position of the player token on the board.
 * It aligns the token with the center of the current spot.
 * @param {boolean} isInitial - True if it's the initial placement (no animation), false otherwise.
 */
function updateTokenPosition(isInitial = false) {
    const spotEl = document.getElementById(`spot-${tokenPosition}`); // Get the current spot element.
    if (spotEl) {
        const spotRect = spotEl.getBoundingClientRect(); // Get dimensions and position of the spot.
        const boardCircleRect = boardCircle.getBoundingClientRect(); // Get dimensions of the board for relative positioning.
        // Calculate the token's top-left position to center it on the spot, relative to the boardCircle.
        const tokenX = spotRect.left - boardCircleRect.left + (spotRect.width / 2) - (playerToken.offsetWidth / 2);
        const tokenY = spotRect.top - boardCircleRect.top + (spotRect.height / 2) - (playerToken.offsetHeight / 2);
        playerToken.style.left = `${tokenX}px`;
        playerToken.style.top = `${tokenY}px`;
        // Add a small visual "bounce" effect if it's not the initial placement.
        if (!isInitial) {
            playerToken.style.transform = 'scale(1.2)';
            setTimeout(() => {
                playerToken.style.transform = 'scale(1)';
            }, 200); // Duration of the bounce.
        }
    }
}
/**
 * Animates the token moving step-by-step (hopping) from one spot to the next.
 * @param {number} steps - Number of spots to move forward.
 */
async function animateTokenMove(steps) {
    enableDiceButtons(false); // Disable dice buttons during animation to prevent multiple rolls.
    for (let i = 0; i < steps; i++) {
        tokenPosition = (tokenPosition + 1) % NUM_SPOTS; // Move to the next spot, wrapping around if necessary.
        updateTokenPosition(); // Update visual position (jumps to spot center).
        // Hopping animation: lift and scale, then return to normal.
        playerToken.style.transition = 'transform 0.15s ease-out'; // Short transition for the hop.
        // Hop height relative to token size for better visual consistency.
        playerToken.style.transform = `translateY(-${playerToken.offsetHeight * 0.3}px) scale(1.1)`;
        await new Promise(resolve => setTimeout(resolve, 150)); // Duration of hop up.
        playerToken.style.transform = 'translateY(0px) scale(1)'; // Return to normal position.
        await new Promise(resolve => setTimeout(resolve, 150)); // Duration of hop down.
    }
    // Reset transition to the default smooth transition for other potential movements.
    playerToken.style.transition = 'all 0.5s ease-in-out';
    // After movement animation completes, check the current spot for trivia.
    checkCurrentSpot();
}
/**
 * Shows the specified screen (e.g., start, game, video) and hides others.
 * Manages the 'hidden' class and display styles for flex containers.
 * @param {'start' | 'video' | 'game' | 'trivia' | 'diceAnimation'} screenName - The screen to show.
 */
function showScreen(screenName) {
    // Hide all screens first.
    startScreen.classList.add('hidden');
    videoPlayerContainer.classList.add('hidden');
    gameArea.classList.add('hidden');
    triviaModal.classList.add('hidden');
    diceAnimationOverlay.classList.add('hidden');
    // Reset display style for flex containers that might have been set to 'none' by 'hidden' class.
    if (videoPlayerContainer.style.display === 'flex')
        videoPlayerContainer.style.display = 'none';
    if (gameArea.style.display === 'flex')
        gameArea.style.display = 'none';
    if (triviaModal.style.display === 'flex')
        triviaModal.style.display = 'none';
    if (diceAnimationOverlay.style.display === 'flex')
        diceAnimationOverlay.style.display = 'none';
    videoPlayer.pause(); // Pause video if switching away from the video player.
    videoPlayer.currentTime = 0; // Reset video to the beginning.
    // Show the target screen.
    switch (screenName) {
        case 'start':
            startScreen.classList.remove('hidden');
            break;
        case 'video':
            videoPlayerContainer.classList.remove('hidden');
            videoPlayerContainer.style.display = 'flex'; // Ensure flex for centering video.
            break;
        case 'game':
            gameArea.classList.remove('hidden');
            gameArea.style.display = 'flex'; // Ensure flex for game area layout.
            break;
        case 'trivia':
            triviaModal.classList.remove('hidden');
            triviaModal.style.display = 'flex'; // Ensure flex for modal centering.
            break;
        case 'diceAnimation':
            diceAnimationOverlay.classList.remove('hidden');
            diceAnimationOverlay.style.display = 'flex'; // Ensure flex for dice animation centering.
            break;
    }
}
/**
 * Plays the introductory video.
 * Handles video loading, errors, and transitions to the game board.
 */
function playIntroVideo() {
    showScreen('video');
    videoPlayer.onended = null; // Clear any previous onended handlers.
    videoPlayer.onerror = () => {
        console.error("Error loading intro video.");
        videoPlaceholderText.textContent = `Error loading video: ${INTRO_VIDEO_URL}. Starting game...`;
        videoPlayer.classList.add('hidden');
        videoPlaceholderText.classList.remove('hidden');
        // Proceed to game after a short delay so user can see the message.
        setTimeout(initializeGameBoard, 2000);
    };
    // Check if a valid video URL is provided (not a placeholder string like "PLACEHOLDER_...").
    // For local files, the browser handles it directly if the file exists at the specified path.
    if (INTRO_VIDEO_URL && (INTRO_VIDEO_URL.endsWith('.mp4') || INTRO_VIDEO_URL.endsWith('.webm') || INTRO_VIDEO_URL.endsWith('.ogv'))) { // Basic check for video file extensions
        videoPlayer.src = INTRO_VIDEO_URL;
        videoPlayer.classList.remove('hidden');
        videoPlaceholderText.classList.add('hidden');
        videoPlayer.play().catch(e => {
            console.warn("Intro video play failed (perhaps autoplay was blocked):", e);
            videoPlaceholderText.textContent = `Video could not autoplay. Click screen to start game.`;
            videoPlayer.classList.add('hidden');
            videoPlaceholderText.classList.remove('hidden');
            // Add a click listener to the container to proceed if autoplay fails.
            videoPlayerContainer.onclick = () => {
                videoPlayerContainer.onclick = null; // Remove listener after first click.
                initializeGameBoard();
            };
            // Fallback: if user doesn't click, proceed after a longer delay.
            setTimeout(initializeGameBoard, 5000);
        });
        videoPlayer.onended = initializeGameBoard; // Transition to game board when video finishes.
    }
    else {
        // If using a placeholder string or an unrecognized format, simulate video playback.
        videoPlayer.classList.add('hidden');
        videoPlaceholderText.classList.remove('hidden');
        videoPlaceholderText.textContent = `Simulating Intro Video... (File: '${INTRO_VIDEO_URL}')`;
        setTimeout(initializeGameBoard, 3000); // Simulate a 3-second video.
    }
}
/**
 * Initializes the main game board view after the intro video or on game start.
 * Sets up spots, player turn, token, and resets game state variables.
 */
function initializeGameBoard() {
    videoPlayerContainer.onclick = null; // Clear any fallback click listener from video player.
    showScreen('game');
    setupBoardSpots(); // Draw spots on the board.
    updatePlayerTurnDisplay();
    enableDiceButtons(true); // Ensure dice buttons are enabled for the first player.
    tokenPosition = 0; // Reset token position to the start.
    visitedSpots.fill(false); // Reset all spots to unvisited.
    // Ensure availableQuestions is populated from the master 'questions' list.
    if (questions.length > 0) {
        availableQuestions = [...questions];
    }
    else {
        // This case indicates an issue with question loading, should ideally be handled earlier.
        console.error("Cannot initialize game board: No questions loaded.");
        setupDefaultQuestions(); // Attempt to load defaults again if 'questions' is empty.
        availableQuestions = [...questions];
    }
    renderBoardState(); // Update visual state of spots (e.g., remove 'visited' class).
    updateTokenPosition(true); // Place token at the starting spot without animation.
    diceResultDisplay.textContent = ''; // Clear any previous dice roll text.
}
/**
 * Updates the display showing whose turn it is (Maya or Eli).
 */
function updatePlayerTurnDisplay() {
    playerTurnDisplay.textContent = `${currentPlayer}'s Turn`;
}
/**
 * Switches to the next player.
 */
function switchPlayer() {
    currentPlayer = currentPlayer === PLAYERS[0] ? PLAYERS[1] : PLAYERS[0];
    updatePlayerTurnDisplay();
    enableDiceButtons(true); // Re-enable dice buttons for the new player's turn.
}
/**
 * Handles a dice roll, including animation and subsequent actions.
 * @param {number} maxFaces - The maximum number on the dice (e.g., 3, 6, 10).
 */
async function handleDiceRoll(maxFaces) {
    enableDiceButtons(false); // Disable buttons during roll and token movement.
    diceResultDisplay.textContent = "Rolling...";
    showScreen('diceAnimation'); // Show the dice animation overlay.
    let roll = 0;
    const animationDuration = 1500; // Total duration for the dice "spinning" animation.
    const intervalTime = 100; // How often to change the displayed number during spinning.
    let elapsedTime = 0;
    const rollInterval = setInterval(() => {
        diceVisual.textContent = `${Math.floor(Math.random() * maxFaces) + 1}`; // Show a random number.
        elapsedTime += intervalTime;
        if (elapsedTime >= animationDuration) {
            clearInterval(rollInterval); // Stop the spinning.
            roll = Math.floor(Math.random() * maxFaces) + 1; // Determine the actual roll.
            diceVisual.textContent = `${roll}`; // Display the final roll.
            // Keep final number visible for a moment before returning to game screen.
            setTimeout(async () => {
                showScreen('game'); // Return to the game screen.
                diceResultDisplay.textContent = `${currentPlayer} rolled a ${roll}!`;
                await animateTokenMove(roll); // Animate token movement.
                // checkCurrentSpot() is now called at the end of animateTokenMove.
            }, 800); // Delay before hiding animation and moving token.
        }
    }, intervalTime);
}
/**
 * Checks the spot the token landed on. If unvisited, triggers trivia.
 * Then, determines if the game ends or switches player.
 */
function checkCurrentSpot() {
    const spotElement = document.getElementById(`spot-${tokenPosition}`);
    if (!spotElement) {
        console.error(`Spot element spot-${tokenPosition} not found!`);
        checkGameEndOrSwitchPlayer(); // Proceed to avoid game stalling.
        return;
    }
    if (!visitedSpots[tokenPosition]) { // If the spot hasn't been visited yet.
        visitedSpots[tokenPosition] = true; // Mark as visited.
        spotElement.classList.add('visited'); // Update visual style.
        // If using PNGs for spots, you might change the image source here:
        // spotElement.style.backgroundImage = `url('path/to/visited_spot_image.png')`;
        const question = getNextTriviaQuestion(); // Get a trivia question.
        if (question) {
            showTriviaModal(question); // Show the trivia modal.
            // Player switching will happen after the trivia modal is closed.
        }
        else {
            // This case means NUM_SPOTS might be > number of unique questions available.
            console.warn("Landed on unvisited spot, but no more unique questions available. Ensure questions.json has enough unique questions for all spots or handle question reuse.");
            checkGameEndOrSwitchPlayer(); // No question, so check game end or switch player.
        }
    }
    else { // If the spot has already been visited.
        diceResultDisplay.textContent += " (Already visited!)";
        checkGameEndOrSwitchPlayer(); // Spot already visited, check game end or switch player.
    }
}
/**
 * Determines if the game should end (all spots visited) or switch to the next player.
 * This is typically called after a turn is fully resolved.
 */
function checkGameEndOrSwitchPlayer() {
    if (visitedSpots.every(visited => visited)) { // Check if all spots have been visited.
        playCongratsVideo(); // All spots visited, play congratulations video.
    }
    else {
        switchPlayer(); // Not all spots visited, switch to the next player.
    }
}
/**
 * Gets the next available trivia question from the `availableQuestions` pool.
 * Removes the question from the pool to prevent repetition for unvisited spots.
 * @returns {TriviaQuestionFormat | null} A question object or null if no unique questions are left.
 */
function getNextTriviaQuestion() {
    if (availableQuestions.length === 0) {
        // If you want questions to repeat after all unique ones are used for new spots,
        // you could refill availableQuestions here: availableQuestions = [...questions];
        // For now, it means no more unique questions for new spots.
        console.warn("No more unique trivia questions available in the current pool!");
        return null;
    }
    // Select and remove a random question from the available pool.
    const randomIndex = Math.floor(Math.random() * availableQuestions.length);
    const question = availableQuestions.splice(randomIndex, 1)[0];
    return question;
}
/**
 * Displays the trivia question modal with the given question data.
 * Handles text, images, audio, and video for questions and answers.
 * @param {TriviaQuestionFormat} questionData - The question object to display.
 */
function showTriviaModal(questionData) {
    triviaQuestionArea.innerHTML = ''; // Clear previous question content.
    triviaAnswerArea.innerHTML = ''; // Clear previous answer content.
    triviaAnswerArea.classList.add('hidden'); // Hide answer area initially.
    showAnswerButton.classList.remove('hidden'); // Ensure "Show Answer" button is visible.
    showAnswerButton.disabled = false; // Ensure button is enabled.
    showAnswerButton.textContent = 'Show Answer';
    closeTriviaButton.textContent = 'Continue'; // Reset "Continue" button text.
    // Populate question content (text, image, audio, video).
    if (questionData.question.text) {
        const p = document.createElement('p');
        p.textContent = questionData.question.text;
        p.className = 'text-lg mb-2';
        triviaQuestionArea.appendChild(p);
    }
    if (questionData.question.imageUrl) {
        const img = document.createElement('img');
        img.src = questionData.question.imageUrl;
        img.alt = "Question Image";
        img.className = "mx-auto my-2 rounded-md max-h-48 object-contain"; // Use object-contain for better image display.
        triviaQuestionArea.appendChild(img);
    }
    // Helper function to create placeholder text for media if actual URL is a placeholder.
    const createMediaPlaceholder = (url, type) => {
        const p = document.createElement('p');
        // Show filename if possible from the placeholder URL.
        p.textContent = `[${type} Placeholder: ${url.split('/').pop()}]`;
        p.className = "text-sm italic my-2 p-2 bg-gray-100 rounded";
        return p;
    };
    if (questionData.question.audioUrl) {
        if (questionData.question.audioUrl.toUpperCase().startsWith("PLACEHOLDER")) {
            triviaQuestionArea.appendChild(createMediaPlaceholder(questionData.question.audioUrl, "Audio"));
        }
        else {
            const audio = document.createElement('audio');
            audio.src = questionData.question.audioUrl;
            audio.controls = true;
            audio.className = "w-full my-2";
            triviaQuestionArea.appendChild(audio);
        }
    }
    if (questionData.question.videoUrl) {
        if (questionData.question.videoUrl.toUpperCase().startsWith("PLACEHOLDER")) {
            triviaQuestionArea.appendChild(createMediaPlaceholder(questionData.question.videoUrl, "Video"));
        }
        else {
            const video = document.createElement('video');
            video.src = questionData.question.videoUrl;
            video.controls = true;
            video.className = "w-full my-2 rounded-md";
            video.autoplay = false; // Do not autoplay trivia videos.
            triviaQuestionArea.appendChild(video);
        }
    }
    // Logic for the "Show Answer" button.
    showAnswerButton.onclick = () => {
        triviaAnswerArea.innerHTML = ''; // Clear previous answer content just in case.
        // Populate answer content.
        if (questionData.answer.text) {
            const p = document.createElement('p');
            p.textContent = questionData.answer.text;
            p.className = 'text-md';
            triviaAnswerArea.appendChild(p);
        }
        if (questionData.answer.imageUrl) {
            const img = document.createElement('img');
            img.src = questionData.answer.imageUrl;
            img.alt = "Answer Image";
            img.className = "mx-auto my-1 rounded-md max-h-40 object-contain";
            triviaAnswerArea.appendChild(img);
        }
        if (questionData.answer.audioUrl) {
            if (questionData.answer.audioUrl.toUpperCase().startsWith("PLACEHOLDER")) {
                triviaAnswerArea.appendChild(createMediaPlaceholder(questionData.answer.audioUrl, "Audio Answer"));
            }
            else {
                const audio = document.createElement('audio');
                audio.src = questionData.answer.audioUrl;
                audio.controls = true;
                audio.className = "w-full my-1";
                triviaAnswerArea.appendChild(audio);
            }
        }
        if (questionData.answer.videoUrl) {
            if (questionData.answer.videoUrl.toUpperCase().startsWith("PLACEHOLDER")) {
                triviaAnswerArea.appendChild(createMediaPlaceholder(questionData.answer.videoUrl, "Video Answer"));
            }
            else {
                const video = document.createElement('video');
                video.src = questionData.answer.videoUrl;
                video.controls = true;
                video.className = "w-full my-1 rounded-md";
                triviaAnswerArea.appendChild(video);
            }
        }
        triviaAnswerArea.classList.remove('hidden'); // Show the answer area.
        showAnswerButton.classList.add('hidden'); // Hide the "Show Answer" button.
        showAnswerButton.disabled = true; // Disable it as well.
    };
    showScreen('trivia'); // Display the trivia modal.
}
/**
 * Closes the trivia modal and proceeds with the game flow (checks for game end or switches player).
 */
function closeTrivia() {
    // Stop any media (audio/video) that might be playing in the trivia modal to prevent background sound.
    const mediaElements = triviaModal.querySelectorAll('video, audio');
    mediaElements.forEach(media => media.pause());
    showScreen('game'); // Return to the game screen.
    checkGameEndOrSwitchPlayer(); // Decide if game ends or next player's turn.
}
/**
 * Plays the congratulations video when all spots are visited.
 * Handles video loading, errors, and transitions to the game over sequence.
 */
function playCongratsVideo() {
    showScreen('video'); // Show the video player screen.
    diceResultDisplay.textContent = "All spots visited! 🎉"; // Update game message.
    videoPlayer.onended = null; // Clear previous onended handler.
    videoPlayer.onerror = () => {
        console.error("Error loading congrats video.");
        videoPlaceholderText.textContent = `Error loading video: ${CONGRATS_VIDEO_URL}. Game Over! Congratulations!`;
        videoPlayer.classList.add('hidden');
        videoPlaceholderText.classList.remove('hidden');
        setTimeout(gameOverSequence, 2000); // Proceed to game over sequence.
    };
    // Check if a valid video URL is provided.
    if (CONGRATS_VIDEO_URL && (CONGRATS_VIDEO_URL.endsWith('.mp4') || CONGRATS_VIDEO_URL.endsWith('.webm') || CONGRATS_VIDEO_URL.endsWith('.ogv'))) { // Basic check for video file extensions
        videoPlayer.src = CONGRATS_VIDEO_URL;
        videoPlayer.classList.remove('hidden');
        videoPlaceholderText.classList.add('hidden');
        videoPlayer.play().catch(e => {
            console.warn("Congrats video play failed:", e);
            videoPlaceholderText.textContent = `Video could not play. Congratulations! Game Over.`;
            videoPlayer.classList.add('hidden');
            videoPlaceholderText.classList.remove('hidden');
            setTimeout(gameOverSequence, 5000); // Proceed after showing message.
        });
        videoPlayer.onended = gameOverSequence; // Call game over sequence when video finishes.
    }
    else {
        // Simulate video if using a placeholder string or an unrecognized format.
        videoPlayer.classList.add('hidden');
        videoPlaceholderText.classList.remove('hidden');
        videoPlaceholderText.textContent = `Simulating Congrats Video... (File: '${CONGRATS_VIDEO_URL}')`;
        setTimeout(gameOverSequence, 5000); // Simulate a 5-second video.
    }
}
/**
 * Sequence to run after the congratulations video ends or if it fails to play.
 * Resets the game state and returns to the start screen, allowing for a new game.
 */
function gameOverSequence() {
    const startScreenH1 = startScreen.querySelector('h1');
    if (startScreenH1)
        startScreenH1.textContent = "Congratulations! Play Again?"; // Update start screen title.
    showScreen('start'); // Show the start screen.
    resetFullGameState(); // Reset game variables for a potential new game.
}
/**
 * Resets all game state variables to their initial values for a new game.
 */
function resetFullGameState() {
    currentPlayer = PLAYERS[0];
    tokenPosition = 0;
    visitedSpots = new Array(NUM_SPOTS).fill(false);
    // Repopulate availableQuestions from the master 'questions' list if it was loaded.
    if (questions.length > 0) {
        availableQuestions = [...questions];
    }
    else {
        // This state implies questions weren't loaded initially, or an error occurred.
        // `initializeGame` should handle loading questions again when the user starts a new game.
        console.warn("Resetting game state, but master 'questions' array is empty. Questions will be re-attempted on next game start.");
        // `availableQuestions` will be repopulated by `initializeGameBoard` which calls `loadTriviaQuestions` via `initializeGame`.
    }
}
/**
 * Enables or disables dice roll buttons.
 * Toggles opacity and cursor style for visual feedback.
 * @param {boolean} enable - True to enable, false to disable.
 */
function enableDiceButtons(enable) {
    diceButtons.forEach(button => {
        button.disabled = !enable;
        button.classList.toggle('opacity-50', !enable);
        button.classList.toggle('cursor-not-allowed', !enable);
        // Re-apply hover styles if enabled, remove if disabled for Tailwind.
        const diceType = button.dataset.diceType;
        if (enable) {
            if (diceType === "3")
                button.classList.add('hover:bg-yellow-500');
            else if (diceType === "6")
                button.classList.add('hover:bg-orange-500');
            else if (diceType === "10")
                button.classList.add('hover:bg-red-500');
        }
        else {
            if (diceType === "3")
                button.classList.remove('hover:bg-yellow-500');
            else if (diceType === "6")
                button.classList.remove('hover:bg-orange-500');
            else if (diceType === "10")
                button.classList.remove('hover:bg-red-500');
        }
    });
}
/**
 * Renders the current state of the board, updating the visual style of visited/unvisited spots.
 * This is useful for initially drawing the board and after a game reset.
 */
function renderBoardState() {
    for (let i = 0; i < NUM_SPOTS; i++) {
        const spotEl = document.getElementById(`spot-${i}`);
        if (spotEl) {
            if (visitedSpots[i]) {
                spotEl.classList.add('visited');
                // If using PNGs for spots: spotEl.style.backgroundImage = `url('path/to/visited_image.png')`;
            }
            else {
                spotEl.classList.remove('visited');
                // If using PNGs for spots: spotEl.style.backgroundImage = `url('path/to/unvisited_image.png')`;
            }
        }
    }
}
// --- Event Listeners & Initial Setup ---
/**
 * Main game initialization function.
 * Loads questions asynchronously and then enables the start button.
 * Handles potential errors during question loading.
 */
async function initializeGame() {
    showScreen('start'); // Show the start screen first.
    startButton.disabled = true; // Disable start button while questions are loading.
    startButton.textContent = "Loading Questions..."; // Provide feedback to the user.
    const questionsLoaded = await loadTriviaQuestions(); // Attempt to load questions from JSON.
    if (questionsLoaded) {
        startButton.disabled = false;
        startButton.textContent = "Start Game";
    }
    else {
        // If questions.json failed, defaults were loaded.
        startButton.disabled = false;
        startButton.textContent = "Start Game (Defaults)";
        // Optionally, display a persistent message on the start screen.
        const existingErrorMsg = startScreen.querySelector('p.text-red-500.text-sm.mt-2');
        if (!existingErrorMsg) { // Add message only if not already present
            const errorMsg = document.createElement('p');
            errorMsg.textContent = "Could not load custom questions. Using defaults.";
            errorMsg.className = "text-red-500 text-sm mt-2";
            startScreen.appendChild(errorMsg); // Append message to start screen.
        }
    }
}
// Start button click listener.
startButton.addEventListener('click', () => {
    // Reset H1 text on start screen if it was changed by a previous game over sequence.
    const startScreenH1 = startScreen.querySelector('h1');
    if (startScreenH1)
        startScreenH1.textContent = "Maya & Eli's Adventure!";
    // Remove error message if it exists from a previous failed load.
    const errorMsg = startScreen.querySelector('p.text-red-500.text-sm.mt-2');
    if (errorMsg)
        errorMsg.remove();
    // Critical check: Ensure questions (master list) are populated before starting.
    // `availableQuestions` will be populated from `questions` in `initializeGameBoard`.
    if (questions.length === 0) {
        console.error("CRITICAL: No questions available (master list empty). Cannot start game. Check JSON loading and default setup.");
        alert("Error: No questions available to start the game. Please check the setup."); // User-facing alert.
        // Potentially re-disable start button or guide user.
        startButton.disabled = true;
        startButton.textContent = "Error: No Questions";
        return; // Prevent game from starting.
    }
    playIntroVideo(); // Proceed to play intro video and then initialize game board.
});
// Dice button click listeners.
diceButtons.forEach(button => {
    button.addEventListener('click', () => {
        if (button.disabled)
            return; // Prevent action if button is disabled.
        const diceType = parseInt(button.dataset.diceType || "6"); // Default to 6 if attribute is missing.
        handleDiceRoll(diceType);
    });
});
// Close trivia modal button listener.
closeTriviaButton.addEventListener('click', closeTrivia);
// When the DOM is fully loaded, start the game initialization process (load questions, etc.).
window.addEventListener('DOMContentLoaded', () => {
    initializeGame();
});
// Responsive board setup: Re-draw spots and token on window resize.
let resizeTimeout;
window.addEventListener('resize', () => {
    clearTimeout(resizeTimeout); // Debounce resize event to avoid excessive calls.
    resizeTimeout = window.setTimeout(() => {
        // Only re-setup if the game area is visible.
        if (!gameArea.classList.contains('hidden')) {
            setupBoardSpots(); // Re-calculate positions of spots.
            updateTokenPosition(true); // Reposition token without animation.
        }
    }, 250); // Wait 250ms after last resize event before executing.
});
