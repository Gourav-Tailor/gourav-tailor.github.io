// Configuration
const CONFIG = {
    GRID_SIZE: 20,
    CELL_SIZE: 20,
    LEARNING_RATE: 0.001,
    GAMMA: 0.95,
    EPSILON_START: 1.0,
    EPSILON_MIN: 0.1,
    EPSILON_DECAY: 0.995,
    MAX_STEPS: 50,
    BATCH_SIZE: 32,
    MEMORY_SIZE: 10000
};

// Target Patterns
const PATTERNS = {
    block: [
        [0, 0, 0, 0, 0],
        [0, 1, 1, 0, 0],
        [0, 1, 1, 0, 0],
        [0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0]
    ],
    blinker: [
        [0, 0, 0, 0, 0],
        [0, 0, 1, 0, 0],
        [0, 0, 1, 0, 0],
        [0, 0, 1, 0, 0],
        [0, 0, 0, 0, 0]
    ],
    glider: [
        [0, 1, 0, 0, 0],
        [0, 0, 1, 0, 0],
        [1, 1, 1, 0, 0],
        [0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0]
    ],
    toad: [
        [0, 0, 0, 0, 0, 0],
        [0, 0, 1, 1, 1, 0],
        [0, 1, 1, 1, 0, 0],
        [0, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 0]
    ]
};

// Game State
let grid = [];
let targetPattern = 'block';
let targetGrid = [];
let gridSize = CONFIG.GRID_SIZE;
let isTraining = false;
let episode = 0;
let steps = 0;
let totalReward = 0;
let epsilon = CONFIG.EPSILON_START;
let rewardHistory = [];

// Canvases
let gameCanvas, targetCanvas, chartCanvas;
let gameCtx, targetCtx, chartCtx;

// DQN Model
let model = null;
let targetModel = null;
let replayMemory = [];

// Initialize
window.addEventListener('load', init);

function init() {
    // Setup canvases
    gameCanvas = document.getElementById('gameCanvas');
    targetCanvas = document.getElementById('targetCanvas');
    chartCanvas = document.getElementById('rewardChart');
    
    gameCtx = gameCanvas.getContext('2d');
    targetCtx = targetCanvas.getContext('2d');
    chartCtx = chartCanvas.getContext('2d');
    
    // Initialize grid
    initializeGrid();
    
    // Create DQN model
    createModel();
    
    // Setup event listeners
    setupEventListeners();
    
    // Initial render
    renderGrid();
    renderTargetPattern();
    updateStats();
}

function initializeGrid() {
    grid = [];
    for (let i = 0; i < gridSize; i++) {
        grid[i] = [];
        for (let j = 0; j < gridSize; j++) {
            grid[i][j] = Math.random() > 0.7 ? 1 : 0;
        }
    }
    
    // Set canvas size
    gameCanvas.width = gridSize * CONFIG.CELL_SIZE;
    gameCanvas.height = gridSize * CONFIG.CELL_SIZE;
    
    // Load target pattern
    loadTargetPattern();
}

function loadTargetPattern() {
    const pattern = PATTERNS[targetPattern];
    targetGrid = [];
    
    for (let i = 0; i < gridSize; i++) {
        targetGrid[i] = [];
        for (let j = 0; j < gridSize; j++) {
            targetGrid[i][j] = 0;
        }
    }
    
    // Center the pattern
    const offsetX = Math.floor((gridSize - pattern.length) / 2);
    const offsetY = Math.floor((gridSize - pattern[0].length) / 2);
    
    for (let i = 0; i < pattern.length; i++) {
        for (let j = 0; j < pattern[i].length; j++) {
            if (offsetX + i < gridSize && offsetY + j < gridSize) {
                targetGrid[offsetX + i][offsetY + j] = pattern[i][j];
            }
        }
    }
}

function createModel() {
    // Input: flattened grid state
    const inputSize = gridSize * gridSize;
    const outputSize = gridSize * gridSize; // One action per cell
    
    model = tf.sequential({
        layers: [
            tf.layers.dense({ inputShape: [inputSize], units: 128, activation: 'relu' }),
            tf.layers.dropout({ rate: 0.2 }),
            tf.layers.dense({ units: 64, activation: 'relu' }),
            tf.layers.dense({ units: outputSize, activation: 'linear' })
        ]
    });
    
    model.compile({
        optimizer: tf.train.adam(CONFIG.LEARNING_RATE),
        loss: 'meanSquaredError'
    });
    
    // Create target model (copy of main model)
    targetModel = tf.sequential({
        layers: [
            tf.layers.dense({ inputShape: [inputSize], units: 128, activation: 'relu' }),
            tf.layers.dropout({ rate: 0.2 }),
            tf.layers.dense({ units: 64, activation: 'relu' }),
            tf.layers.dense({ units: outputSize, activation: 'linear' })
        ]
    });
    
    targetModel.compile({
        optimizer: tf.train.adam(CONFIG.LEARNING_RATE),
        loss: 'meanSquaredError'
    });
}

function getState() {
    // Flatten grid to 1D array
    const state = [];
    for (let i = 0; i < gridSize; i++) {
        for (let j = 0; j < gridSize; j++) {
            state.push(grid[i][j]);
        }
    }
    return state;
}

function selectAction(state) {
    // Epsilon-greedy policy
    if (Math.random() < epsilon) {
        // Random action
        return Math.floor(Math.random() * gridSize * gridSize);
    } else {
        // Best action from model
        const stateTensor = tf.tensor2d([state]);
        const qValues = model.predict(stateTensor);
        const action = qValues.argMax(-1).dataSync()[0];
        
        stateTensor.dispose();
        qValues.dispose();
        
        return action;
    }
}

function takeAction(action) {
    // Convert action to grid coordinates
    const x = Math.floor(action / gridSize);
    const y = action % gridSize;
    
    // Toggle cell
    if (x >= 0 && x < gridSize && y >= 0 && y < gridSize) {
        grid[x][y] = grid[x][y] === 1 ? 0 : 1;
    }
}

function evolveGrid() {
    const newGrid = [];
    
    for (let i = 0; i < gridSize; i++) {
        newGrid[i] = [];
        for (let j = 0; j < gridSize; j++) {
            const neighbors = countNeighbors(i, j);
            
            if (grid[i][j] === 1) {
                // Cell is alive
                newGrid[i][j] = (neighbors === 2 || neighbors === 3) ? 1 : 0;
            } else {
                // Cell is dead
                newGrid[i][j] = neighbors === 3 ? 1 : 0;
            }
        }
    }
    
    grid = newGrid;
}

function countNeighbors(x, y) {
    let count = 0;
    
    for (let i = -1; i <= 1; i++) {
        for (let j = -1; j <= 1; j++) {
            if (i === 0 && j === 0) continue;
            
            const nx = x + i;
            const ny = y + j;
            
            if (nx >= 0 && nx < gridSize && ny >= 0 && ny < gridSize) {
                count += grid[nx][ny];
            }
        }
    }
    
    return count;
}

function calculateSimilarity() {
    let matches = 0;
    let total = gridSize * gridSize;
    
    for (let i = 0; i < gridSize; i++) {
        for (let j = 0; j < gridSize; j++) {
            if (grid[i][j] === targetGrid[i][j]) {
                matches++;
            }
        }
    }
    
    return matches / total;
}

function calculateReward(prevSimilarity, currentSimilarity) {
    const improvement = currentSimilarity - prevSimilarity;
    
    if (improvement > 0) {
        return 10 * improvement; // Reward for improvement
    } else if (improvement < 0) {
        return 5 * improvement; // Penalty for getting worse
    } else {
        return -0.1; // Small penalty for no change
    }
}

function storeExperience(state, action, reward, nextState, done) {
    replayMemory.push({ state, action, reward, nextState, done });
    
    if (replayMemory.length > CONFIG.MEMORY_SIZE) {
        replayMemory.shift();
    }
}

async function trainModel() {
    if (replayMemory.length < CONFIG.BATCH_SIZE) return;
    
    // Sample random batch
    const batch = [];
    for (let i = 0; i < CONFIG.BATCH_SIZE; i++) {
        const idx = Math.floor(Math.random() * replayMemory.length);
        batch.push(replayMemory[idx]);
    }
    
    // Prepare training data
    const states = batch.map(exp => exp.state);
    const nextStates = batch.map(exp => exp.nextState);
    
    const statesTensor = tf.tensor2d(states);
    const nextStatesTensor = tf.tensor2d(nextStates);
    
    // Get Q-values
    const qValues = model.predict(statesTensor);
    const nextQValues = targetModel.predict(nextStatesTensor);
    
    const qValuesData = await qValues.array();
    const nextQValuesData = await nextQValues.array();
    
    // Update Q-values
    for (let i = 0; i < CONFIG.BATCH_SIZE; i++) {
        const { action, reward, done } = batch[i];
        
        if (done) {
            qValuesData[i][action] = reward;
        } else {
            const maxNextQ = Math.max(...nextQValuesData[i]);
            qValuesData[i][action] = reward + CONFIG.GAMMA * maxNextQ;
        }
    }
    
    const targetQValues = tf.tensor2d(qValuesData);
    
    // Train
    await model.fit(statesTensor, targetQValues, {
        epochs: 1,
        verbose: 0
    });
    
    // Cleanup
    statesTensor.dispose();
    nextStatesTensor.dispose();
    qValues.dispose();
    nextQValues.dispose();
    targetQValues.dispose();
}

function updateTargetModel() {
    const weights = model.getWeights();
    targetModel.setWeights(weights);
}

async function runEpisode() {
    if (!isTraining) return;
    
    initializeGrid();
    steps = 0;
    totalReward = 0;
    
    let prevSimilarity = calculateSimilarity();
    
    for (let step = 0; step < CONFIG.MAX_STEPS; step++) {
        if (!isTraining) break;
        
        steps = step + 1;
        
        const state = getState();
        const action = selectAction(state);
        
        takeAction(action);
        
        if (document.getElementById('autoEvolve').checked) {
            evolveGrid();
        }
        
        const currentSimilarity = calculateSimilarity();
        const reward = calculateReward(prevSimilarity, currentSimilarity);
        totalReward += reward;
        
        const nextState = getState();
        const done = currentSimilarity > 0.95 || step === CONFIG.MAX_STEPS - 1;
        
        storeExperience(state, action, reward, nextState, done);
        
        await trainModel();
        
        prevSimilarity = currentSimilarity;
        
        renderGrid();
        updateStats();
        
        await new Promise(resolve => setTimeout(resolve, 50));
        
        if (done) break;
    }
    
    // Update epsilon
    epsilon = Math.max(CONFIG.EPSILON_MIN, epsilon * CONFIG.EPSILON_DECAY);
    
    // Update target model every 10 episodes
    if (episode % 10 === 0) {
        updateTargetModel();
    }
    
    // Store reward history
    rewardHistory.push(totalReward);
    if (rewardHistory.length > 100) {
        rewardHistory.shift();
    }
    
    renderChart();
    
    episode++;
    
    if (isTraining) {
        setTimeout(() => runEpisode(), 100);
    }
}

function renderGrid() {
    gameCtx.clearRect(0, 0, gameCanvas.width, gameCanvas.height);
    
    for (let i = 0; i < gridSize; i++) {
        for (let j = 0; j < gridSize; j++) {
            if (grid[i][j] === 1) {
                gameCtx.fillStyle = '#10b981';
            } else {
                gameCtx.fillStyle = '#1f2937';
            }
            
            gameCtx.fillRect(
                j * CONFIG.CELL_SIZE,
                i * CONFIG.CELL_SIZE,
                CONFIG.CELL_SIZE - 1,
                CONFIG.CELL_SIZE - 1
            );
        }
    }
}

function renderTargetPattern() {
    const patternSize = 5;
    const cellSize = targetCanvas.width / patternSize;
    
    targetCtx.clearRect(0, 0, targetCanvas.width, targetCanvas.height);
    
    const pattern = PATTERNS[targetPattern];
    
    for (let i = 0; i < pattern.length; i++) {
        for (let j = 0; j < pattern[i].length; j++) {
            if (pattern[i][j] === 1) {
                targetCtx.fillStyle = '#10b981';
            } else {
                targetCtx.fillStyle = '#1f2937';
            }
            
            targetCtx.fillRect(
                j * cellSize,
                i * cellSize,
                cellSize - 2,
                cellSize - 2
            );
        }
    }
}

function renderChart() {
    chartCtx.clearRect(0, 0, chartCanvas.width, chartCanvas.height);
    
    if (rewardHistory.length < 2) return;
    
    const maxReward = Math.max(...rewardHistory);
    const minReward = Math.min(...rewardHistory);
    const range = maxReward - minReward || 1;
    
    chartCtx.strokeStyle = '#10b981';
    chartCtx.lineWidth = 2;
    chartCtx.beginPath();
    
    for (let i = 0; i < rewardHistory.length; i++) {
        const x = (i / rewardHistory.length) * chartCanvas.width;
        const y = chartCanvas.height - ((rewardHistory[i] - minReward) / range) * chartCanvas.height;
        
        if (i === 0) {
            chartCtx.moveTo(x, y);
        } else {
            chartCtx.lineTo(x, y);
        }
    }
    
    chartCtx.stroke();
}

function updateStats() {
    document.getElementById('episode').textContent = episode;
    document.getElementById('steps').textContent = steps;
    document.getElementById('reward').textContent = totalReward.toFixed(2);
    document.getElementById('similarity').textContent = (calculateSimilarity() * 100).toFixed(1) + '%';
    document.getElementById('epsilon').textContent = epsilon.toFixed(3);
}

function setupEventListeners() {
    // Back button
    document.getElementById('backBtn').addEventListener('click', () => {
        window.location.href = 'index.html';
    });
    
    // Pattern selection
    document.querySelectorAll('.pattern-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.pattern-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            targetPattern = btn.dataset.pattern;
            loadTargetPattern();
            renderTargetPattern();
        });
    });
    
    // Training controls
    document.getElementById('trainBtn').addEventListener('click', () => {
        isTraining = true;
        document.getElementById('trainBtn').disabled = true;
        document.getElementById('stopBtn').disabled = false;
        runEpisode();
    });
    
    document.getElementById('stopBtn').addEventListener('click', () => {
        isTraining = false;
        document.getElementById('trainBtn').disabled = false;
        document.getElementById('stopBtn').disabled = true;
    });
    
    document.getElementById('resetBtn').addEventListener('click', () => {
        initializeGrid();
        episode = 0;
        steps = 0;
        totalReward = 0;
        epsilon = CONFIG.EPSILON_START;
        rewardHistory = [];
        replayMemory = [];
        renderGrid();
        updateStats();
        renderChart();
    });
    
    // Settings
    document.getElementById('gridSize').addEventListener('input', (e) => {
        gridSize = parseInt(e.target.value);
        document.getElementById('gridSizeValue').textContent = gridSize;
        initializeGrid();
        renderGrid();
    });
    
    document.getElementById('learningRate').addEventListener('input', (e) => {
        CONFIG.LEARNING_RATE = parseFloat(e.target.value);
        document.getElementById('learningRateValue').textContent = CONFIG.LEARNING_RATE.toFixed(4);
    });
    
    document.getElementById('maxSteps').addEventListener('input', (e) => {
        CONFIG.MAX_STEPS = parseInt(e.target.value);
        document.getElementById('maxStepsValue').textContent = CONFIG.MAX_STEPS;
    });
    
    // Manual cell toggling
    gameCanvas.addEventListener('click', (e) => {
        if (isTraining) return;
        
        const rect = gameCanvas.getBoundingClientRect();
        const x = Math.floor((e.clientY - rect.top) / CONFIG.CELL_SIZE);
        const y = Math.floor((e.clientX - rect.left) / CONFIG.CELL_SIZE);
        
        if (x >= 0 && x < gridSize && y >= 0 && y < gridSize) {
            grid[x][y] = grid[x][y] === 1 ? 0 : 1;
            renderGrid();
        }
    });
}

// Start
init();
