// Game Configuration
const CONFIG = {
    SPEED: 0.4,
    SPEED_INCREMENT: 0.003,
    JUMP_FORCE: 0.35,
    GRAVITY: 0.015,
    LANE_WIDTH: 4,
    OBSTACLE_SPAWN_DISTANCE: 50,
    MIN_OBSTACLE_DISTANCE: 20
};

// Game State
let scene, camera, renderer, player, ground;
let obstacles = [];
let score = 0;
let gameSpeed = CONFIG.SPEED;
let isGameOver = false;
let playerVelocityY = 0;
let isJumping = false;
let currentLane = 0; // -1 (left), 0 (center), 1 (right)
let targetLane = 0;
let lastObstacleZ = 0;
let gamesPlayed = 0;

// AI State
let aiEnabled = false;
let aiModel = null;
let trainingData = [];
const MAX_TRAINING_DATA = 1000;

// Input State
let keys = {
    left: false,
    right: false,
    space: false
};

// Initialize Game
function init() {
    // Scene setup
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x4a5568);
    scene.fog = new THREE.Fog(0x4a5568, 30, 100);

    // Camera setup - Third person view with 20 degree angle
    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.set(0, 12, 20);
    camera.rotation.x = -Math.PI / 9; // ~20 degrees downward angle
    
    // Renderer setup
    const canvas = document.getElementById('gameCanvas');
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.shadowMap.enabled = true;

    // Lighting - Atmospheric like the image
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.4);
    scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffeedd, 0.6);
    directionalLight.position.set(5, 15, 10);
    directionalLight.castShadow = true;
    directionalLight.shadow.camera.left = -50;
    directionalLight.shadow.camera.right = 50;
    directionalLight.shadow.camera.top = 50;
    directionalLight.shadow.camera.bottom = -50;
    scene.add(directionalLight);

    // Add fog effect for depth
    const frontLight = new THREE.PointLight(0xffffff, 0.5, 50);
    frontLight.position.set(0, 8, 0);
    scene.add(frontLight);

    // Create ground
    createGround();

    // Create player
    createPlayer();

    // Event listeners
    setupEventListeners();

    // Load AI model or create new
    loadOrCreateAIModel();

    // Start animation
    animate();
}

function createGround() {
    // Wider ground to fill screen
    const groundGeometry = new THREE.PlaneGeometry(40, 300);
    const groundMaterial = new THREE.MeshLambertMaterial({ color: 0x556b2f });
    ground = new THREE.Mesh(groundGeometry, groundMaterial);
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    scene.add(ground);

    // Add lane markings
    for (let i = -1; i <= 1; i++) {
        if (i === 0) continue;
        const lineGeometry = new THREE.PlaneGeometry(0.2, 300);
        const lineMaterial = new THREE.MeshBasicMaterial({ color: 0x888888, transparent: true, opacity: 0.5 });
        const line = new THREE.Mesh(lineGeometry, lineMaterial);
        line.rotation.x = -Math.PI / 2;
        line.position.set(i * CONFIG.LANE_WIDTH, 0.01, 0);
        scene.add(line);
    }
}

function createPlayer() {
    player = new THREE.Group();
    player.position.set(0, 0, 10);

    // Body proportions - BIGGER for better visibility
    const scale = 2.5; // Scale up the entire player
    const headSize = 0.6 * scale;
    const bodyWidth = 0.35 * scale;
    const bodyHeight = 1.4 * scale;
    const limbWidth = 0.18 * scale;
    const limbLength = 0.9 * scale;

    const material = new THREE.MeshLambertMaterial({ color: 0xe8e8e8 });

    // Head
    const headGeo = new THREE.SphereGeometry(headSize, 12, 12);
    const head = new THREE.Mesh(headGeo, material);
    head.position.y = bodyHeight + headSize;
    head.castShadow = true;
    player.add(head);

    // Neck
    const neckGeo = new THREE.CylinderGeometry(0.12 * scale, 0.12 * scale, 0.35 * scale, 8);
    const neck = new THREE.Mesh(neckGeo, material);
    neck.position.y = bodyHeight + 0.18 * scale;
    neck.castShadow = true;
    player.add(neck);

    // Spine/Body
    const spineGeo = new THREE.CylinderGeometry(bodyWidth, bodyWidth * 0.8, bodyHeight, 10);
    const spine = new THREE.Mesh(spineGeo, material);
    spine.position.y = bodyHeight / 2;
    spine.castShadow = true;
    player.add(spine);

    // Arms (with joints)
    [-1, 1].forEach(side => {
        const shoulder = new THREE.Group();
        shoulder.position.set(side * (bodyWidth + 0.15 * scale), bodyHeight * 0.8, 0);
        
        const upperArmGeo = new THREE.CylinderGeometry(limbWidth, limbWidth * 0.8, limbLength, 8);
        const upperArm = new THREE.Mesh(upperArmGeo, material);
        upperArm.position.y = -limbLength / 2;
        upperArm.rotation.z = side * 0.1;
        upperArm.castShadow = true;
        shoulder.add(upperArm);

        const elbowGeo = new THREE.SphereGeometry(limbWidth * 0.9, 8, 8);
        const elbow = new THREE.Mesh(elbowGeo, material);
        elbow.position.y = -limbLength;
        elbow.castShadow = true;
        shoulder.add(elbow);

        const foreArmGeo = new THREE.CylinderGeometry(limbWidth * 0.8, limbWidth * 0.6, limbLength * 0.8, 8);
        const foreArm = new THREE.Mesh(foreArmGeo, material);
        foreArm.position.y = -limbLength - limbLength * 0.4;
        foreArm.rotation.z = -side * 0.2;
        foreArm.castShadow = true;
        shoulder.add(foreArm);

        shoulder.userData = { type: 'arm', side, angle: 0, speed: 0.06 };
        player.add(shoulder);
    });

    // Legs (with joints)
    [-1, 1].forEach(side => {
        const hip = new THREE.Group();
        hip.position.set(side * bodyWidth * 0.5, 0, 0);
        
        const thighGeo = new THREE.CylinderGeometry(limbWidth * 1.2, limbWidth, limbLength, 8);
        const thigh = new THREE.Mesh(thighGeo, material);
        thigh.position.y = -limbLength / 2;
        thigh.castShadow = true;
        hip.add(thigh);

        const kneeGeo = new THREE.SphereGeometry(limbWidth, 8, 8);
        const knee = new THREE.Mesh(kneeGeo, material);
        knee.position.y = -limbLength;
        knee.castShadow = true;
        hip.add(knee);

        const shinGeo = new THREE.CylinderGeometry(limbWidth, limbWidth * 0.8, limbLength, 8);
        const shin = new THREE.Mesh(shinGeo, material);
        shin.position.y = -limbLength - limbLength / 2;
        shin.castShadow = true;
        hip.add(shin);

        hip.userData = { type: 'leg', side, angle: 0, speed: 0.1 };
        player.add(hip);
    });

    scene.add(player);
}

function animatePlayer() {
    // Wobbly baby-like movement
    const time = Date.now() * 0.001;
    
    player.children.forEach(part => {
        if (part.userData.type === 'arm') {
            part.userData.angle += part.userData.speed;
            part.rotation.x = Math.sin(part.userData.angle) * 0.5;
            part.rotation.z = part.userData.side * (0.1 + Math.cos(part.userData.angle) * 0.2);
        } else if (part.userData.type === 'leg') {
            part.userData.angle += part.userData.speed;
            part.rotation.x = Math.sin(part.userData.angle + Math.PI) * 0.4;
        }
    });

    // Body wobble
    player.rotation.z = Math.sin(time * 2) * 0.05;
    player.rotation.x = Math.sin(time * 3) * 0.03;
}

function createObstacle(z) {
    const type = Math.random() > 0.5 ? 'tall' : 'short';
    const lane = Math.floor(Math.random() * 3) - 1; // -1, 0, or 1
    
    const obstacle = new THREE.Group();
    obstacle.position.set(lane * CONFIG.LANE_WIDTH, 0, z);
    
    let geometry, height, width, depth;
    if (type === 'tall') {
        // Large imposing blocks like in the image
        height = 6;
        width = 3.5;
        depth = 3;
        geometry = new THREE.BoxGeometry(width, height, depth);
    } else {
        // Low walls to jump over
        height = 2;
        width = 3.5;
        depth = 2;
        geometry = new THREE.BoxGeometry(width, height, depth);
    }
    
    const material = new THREE.MeshLambertMaterial({ 
        color: type === 'tall' ? 0x8b4513 : 0xa0522d,
        emissive: 0x331100,
        emissiveIntensity: 0.2
    });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.y = height / 2;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    obstacle.add(mesh);
    
    // Add some detail/texture
    const edgeGeo = new THREE.EdgesGeometry(geometry);
    const edgeMat = new THREE.LineBasicMaterial({ color: 0x000000, linewidth: 2 });
    const edges = new THREE.LineSegments(edgeGeo, edgeMat);
    edges.position.y = height / 2;
    obstacle.add(edges);
    
    obstacle.userData = { type, lane, height };
    obstacles.push(obstacle);
    scene.add(obstacle);
}

function updateObstacles() {
    // Move obstacles
    obstacles.forEach(obstacle => {
        obstacle.position.z += gameSpeed;
    });

    // Remove passed obstacles
    obstacles = obstacles.filter(obstacle => {
        if (obstacle.position.z > player.position.z + 5) {
            scene.remove(obstacle);
            return false;
        }
        return true;
    });

    // Spawn new obstacles
    if (obstacles.length === 0 || 
        obstacles[obstacles.length - 1].position.z > player.position.z - CONFIG.OBSTACLE_SPAWN_DISTANCE) {
        const newZ = obstacles.length > 0 
            ? obstacles[obstacles.length - 1].position.z - CONFIG.MIN_OBSTACLE_DISTANCE
            : player.position.z - CONFIG.OBSTACLE_SPAWN_DISTANCE;
        createObstacle(newZ);
    }
}

function checkCollision() {
    const playerBox = new THREE.Box3().setFromObject(player);
    
    for (let obstacle of obstacles) {
        if (Math.abs(obstacle.position.z - player.position.z) < 2) {
            const obstacleBox = new THREE.Box3().setFromObject(obstacle);
            
            if (playerBox.intersectsBox(obstacleBox)) {
                gameOver();
                return true;
            }
        }
    }
    return false;
}

function updatePlayer() {
    // Lane switching (smooth transition)
    const targetX = targetLane * CONFIG.LANE_WIDTH;
    player.position.x += (targetX - player.position.x) * 0.1;

    // Jumping physics
    if (isJumping) {
        playerVelocityY -= CONFIG.GRAVITY;
        player.position.y += playerVelocityY;

        if (player.position.y <= 0) {
            player.position.y = 0;
            playerVelocityY = 0;
            isJumping = false;
        }
    }

    // Animate limbs
    animatePlayer();

    // Dynamic camera follow with smooth tracking
    // Camera follows player horizontally for better obstacle visibility
    camera.position.x += (player.position.x * 0.8 - camera.position.x) * 0.08;
    
    // Slight camera tilt based on lane
    camera.rotation.y += (player.position.x * 0.02 - camera.rotation.y) * 0.05;
    
    // Camera position relative to player
    const cameraOffset = new THREE.Vector3(0, 12, 20);
    const targetCameraPos = player.position.clone().add(cameraOffset);
    camera.position.z += (targetCameraPos.z - camera.position.z) * 0.05;
}

function handleInput() {
    if (aiEnabled) return; // AI controls the player

    if (keys.left && currentLane > -1) {
        targetLane = --currentLane;
    }
    if (keys.right && currentLane < 1) {
        targetLane = ++currentLane;
    }
    if (keys.space && !isJumping) {
        jump();
    }

    // Reset key states
    keys.left = keys.right = keys.space = false;
}

function jump() {
    if (!isJumping) {
        isJumping = true;
        playerVelocityY = CONFIG.JUMP_FORCE;
    }
}

function collectTrainingData() {
    if (obstacles.length === 0 || aiEnabled) return;

    const nearestObstacle = obstacles.find(obs => obs.position.z < player.position.z && 
                                                   obs.position.z > player.position.z - 20);
    
    if (!nearestObstacle) return;

    const state = [
        currentLane / 1, // Normalize to -1, 0, 1
        nearestObstacle.userData.lane / 1,
        (nearestObstacle.position.z - player.position.z) / 20, // Normalize distance
        nearestObstacle.userData.type === 'tall' ? 1 : 0,
        isJumping ? 1 : 0
    ];

    // Determine action (0: nothing, 1: left, 2: right, 3: jump)
    let action = 0;
    if (keys.left) action = 1;
    else if (keys.right) action = 2;
    else if (keys.space) action = 3;

    trainingData.push({ state, action });

    // Limit training data size
    if (trainingData.length > MAX_TRAINING_DATA) {
        trainingData.shift();
    }

    updateTrainingUI();
}

async function loadOrCreateAIModel() {
    try {
        aiModel = await tf.loadLayersModel('indexeddb://runner-ai-model');
        document.getElementById('modelStatus').textContent = 'Loaded';
    } catch (e) {
        aiModel = createNeuralNetwork();
        document.getElementById('modelStatus').textContent = 'Not Trained';
    }
}

function createNeuralNetwork() {
    const model = tf.sequential({
        layers: [
            tf.layers.dense({ inputShape: [5], units: 24, activation: 'relu' }),
            tf.layers.dense({ units: 16, activation: 'relu' }),
            tf.layers.dense({ units: 4, activation: 'softmax' }) // 4 actions
        ]
    });

    model.compile({
        optimizer: tf.train.adam(0.001),
        loss: 'sparseCategoricalCrossentropy',
        metrics: ['accuracy']
    });

    return model;
}

async function trainAIModel() {
    if (trainingData.length < 50) {
        alert('Need at least 50 training samples. Play more games!');
        return;
    }

    document.getElementById('modelStatus').textContent = 'Training...';

    const states = trainingData.map(d => d.state);
    const actions = trainingData.map(d => d.action);

    const xs = tf.tensor2d(states);
    const ys = tf.tensor1d(actions, 'int32');

    await aiModel.fit(xs, ys, {
        epochs: 20,
        batchSize: 32,
        shuffle: true,
        callbacks: {
            onEpochEnd: (epoch, logs) => {
                console.log(`Epoch ${epoch}: loss = ${logs.loss.toFixed(4)}`);
            }
        }
    });

    xs.dispose();
    ys.dispose();

    // Save model
    await aiModel.save('indexeddb://runner-ai-model');
    document.getElementById('modelStatus').textContent = 'Trained';
}

async function getAIAction() {
    if (!aiModel || obstacles.length === 0) return 0;

    const nearestObstacle = obstacles.find(obs => obs.position.z < player.position.z && 
                                                   obs.position.z > player.position.z - 20);
    
    if (!nearestObstacle) return 0;

    const state = tf.tensor2d([[
        currentLane / 1,
        nearestObstacle.userData.lane / 1,
        (nearestObstacle.position.z - player.position.z) / 20,
        nearestObstacle.userData.type === 'tall' ? 1 : 0,
        isJumping ? 1 : 0
    ]]);

    const prediction = aiModel.predict(state);
    const action = (await prediction.argMax(-1).data())[0];

    state.dispose();
    prediction.dispose();

    return action;
}

async function updateAI() {
    if (!aiEnabled) return;

    const action = await getAIAction();

    switch (action) {
        case 1: // Left
            if (currentLane > -1) targetLane = --currentLane;
            break;
        case 2: // Right
            if (currentLane < 1) targetLane = ++currentLane;
            break;
        case 3: // Jump
            if (!isJumping) jump();
            break;
    }
}

function gameOver() {
    if (isGameOver) return;
    
    isGameOver = true;
    gamesPlayed++;
    
    document.getElementById('finalScore').textContent = Math.floor(score);
    document.getElementById('gameOverScreen').classList.add('show');
    document.getElementById('controlsInfo').style.display = 'none';
    document.getElementById('gamesPlayed').textContent = gamesPlayed;

    // Train model if we have enough data
    if (trainingData.length >= 50 && !aiEnabled) {
        setTimeout(() => trainAIModel(), 1000);
    }
}

function resetGame() {
    isGameOver = false;
    score = 0;
    gameSpeed = CONFIG.SPEED;
    currentLane = 0;
    targetLane = 0;
    playerVelocityY = 0;
    isJumping = false;
    
    player.position.set(0, 0, 10);
    
    obstacles.forEach(obstacle => scene.remove(obstacle));
    obstacles = [];
    
    document.getElementById('score').textContent = '0';
    document.getElementById('gameOverScreen').classList.remove('show');
    document.getElementById('controlsInfo').style.display = 'flex';
}

function updateScore() {
    if (!isGameOver) {
        score += gameSpeed * 10;
        gameSpeed += CONFIG.SPEED_INCREMENT;
        document.getElementById('score').textContent = Math.floor(score);
        document.getElementById('speed').textContent = (gameSpeed / CONFIG.SPEED).toFixed(1) + 'x';
    }
}

function updateTrainingUI() {
    document.getElementById('trainingSize').textContent = trainingData.length;
}

function setupEventListeners() {
    // Keyboard
    window.addEventListener('keydown', (e) => {
        if (e.code === 'ArrowLeft') keys.left = true;
        if (e.code === 'ArrowRight') keys.right = true;
        if (e.code === 'Space') {
            e.preventDefault();
            keys.space = true;
        }
    });

    // UI Buttons
    document.getElementById('restartBtn').addEventListener('click', resetGame);
    document.getElementById('backBtn').addEventListener('click', () => {
        window.location.href = 'index.html';
    });

    document.getElementById('aiToggle').addEventListener('click', async () => {
        aiEnabled = !aiEnabled;
        const btn = document.getElementById('aiToggle');
        const text = btn.querySelector('.ai-text');
        
        if (aiEnabled) {
            if (trainingData.length < 50) {
                alert('AI needs training data! Play some games first.');
                aiEnabled = false;
                return;
            }
            btn.classList.add('active');
            text.textContent = 'AI: ON';
        } else {
            btn.classList.remove('active');
            text.textContent = 'AI: OFF';
        }
    });

    // Window resize
    window.addEventListener('resize', () => {
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
    });
}

function animate() {
    requestAnimationFrame(animate);

    if (!isGameOver) {
        handleInput();
        updateAI();
        updatePlayer();
        updateObstacles();
        checkCollision();
        updateScore();
        collectTrainingData();
    }

    renderer.render(scene, camera);
}

// Start game
init();
