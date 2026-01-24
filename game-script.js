// ======================= CONFIG =======================
const CONFIG = {
    SPEED: 0.4,
    MAX_SPEED_MULTIPLIER: 1.2,
    SPEED_ACCELERATION: 0.05,
    JUMP_FORCE: 0.55,
    GRAVITY: 0.018,
    LANE_WIDTH: 8,
    OBSTACLE_SPAWN_DISTANCE: 50,
    MIN_OBSTACLE_DISTANCE: 35
};

const GROUND_Y = 0;
const PLAYER_FOOT_OFFSET = 1.95;

// ======================= STATE =======================
let scene, camera, renderer, player, ground;
let obstacles = [];

let gameSpeed = CONFIG.SPEED;
let speedMultiplier = 1;
let targetSpeedMultiplier = 1;

let playerVelocityY = 0;
let isJumping = false;

let currentLane = 0;
let targetLane = 0;

let accelerating = false;

const PLAYER_STATE = {
    RUNNING: 'running',
    FALLING: 'falling',
    RECOVERING: 'recovering'
};
let playerState = PLAYER_STATE.RUNNING;
let fallTimer = 0;

// ======================= INPUT =======================
let keys = { left: false, right: false, space: false };

// ======================= AI =======================
let aiEnabled = false;
let aiModel = null;
let trainingData = [];
const MAX_TRAINING_DATA = 1000;

// ======================= INIT =======================
init();
function init() {
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x4a5568);
    scene.fog = new THREE.Fog(0x4a5568, 30, 120);

    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 500);
    camera.position.set(0, 12, 20);
    camera.rotation.x = -Math.PI / 9;

    renderer = new THREE.WebGLRenderer({ canvas: gameCanvas, antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.shadowMap.enabled = true;

    scene.add(new THREE.AmbientLight(0xffffff, 0.4));
    const dir = new THREE.DirectionalLight(0xffeedd, 0.6);
    dir.position.set(5, 15, 10);
    dir.castShadow = true;
    scene.add(dir);

    createGround();
    createPlayer();
    setupEventListeners();
    loadOrCreateAIModel();
    animate();
}

// ======================= GROUND =======================
function createGround() {
    const geo = new THREE.PlaneGeometry(60, 400);
    const mat = new THREE.MeshLambertMaterial({ color: 0x556b2f });
    ground = new THREE.Mesh(geo, mat);
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    scene.add(ground);
}

// ======================= PLAYER =======================
function createPlayer() {
    player = new THREE.Group();
    player.position.set(0, GROUND_Y + PLAYER_FOOT_OFFSET, 10);

    const mat = new THREE.MeshLambertMaterial({ color: 0xe8e8e8 });

    const body = new THREE.Mesh(
        new THREE.CylinderGeometry(0.9, 0.7, 3.5, 8),
        mat
    );
    body.position.y = 1.75;
    player.add(body);

    const head = new THREE.Mesh(
        new THREE.SphereGeometry(0.8, 12, 12),
        mat
    );
    head.position.y = 4;
    player.add(head);

    [-1, 1].forEach(side => {
        const leg = new THREE.Group();
        leg.position.x = side * 0.6;

        const thigh = new THREE.Mesh(
            new THREE.CylinderGeometry(0.35, 0.3, 1.6, 8),
            mat
        );
        thigh.position.y = -0.8;
        leg.add(thigh);

        const shin = new THREE.Mesh(
            new THREE.CylinderGeometry(0.3, 0.25, 1.6, 8),
            mat
        );
        shin.position.y = -2.4;
        leg.add(shin);

        const foot = new THREE.Mesh(
            new THREE.BoxGeometry(0.5, 0.25, 1.1),
            mat
        );
        foot.position.set(0, -3.2, 0.3);
        leg.add(foot);

        leg.userData = { type: 'leg', side };
        player.add(leg);
    });

    scene.add(player);
}

// ======================= INPUT =======================
function setupEventListeners() {
    window.addEventListener('keydown', e => {
        if (e.code === 'ArrowLeft') keys.left = true;
        if (e.code === 'ArrowRight') keys.right = true;
        if (e.code === 'ArrowUp') accelerating = true;
        if (e.code === 'Space') {
            e.preventDefault();
            keys.space = true;
        }
    });

    window.addEventListener('keyup', e => {
        if (e.code === 'ArrowUp') accelerating = false;
    });
}

// ======================= PLAYER UPDATE =======================
function updatePlayer() {

    // Speed
    targetSpeedMultiplier = accelerating ? CONFIG.MAX_SPEED_MULTIPLIER : 1;
    speedMultiplier += (targetSpeedMultiplier - speedMultiplier) * CONFIG.SPEED_ACCELERATION;
    gameSpeed = CONFIG.SPEED * speedMultiplier;

    // Lane move
    if (!aiEnabled && playerState === PLAYER_STATE.RUNNING) {
        if (keys.left && currentLane > -1) currentLane--;
        if (keys.right && currentLane < 1) currentLane++;
    }
    keys.left = keys.right = false;

    player.position.x += (currentLane * CONFIG.LANE_WIDTH - player.position.x) * 0.12;

    // Jump
    if (keys.space && !isJumping && playerState === PLAYER_STATE.RUNNING) {
        isJumping = true;
        playerVelocityY = CONFIG.JUMP_FORCE;
    }
    keys.space = false;

    // Falling
    if (playerState === PLAYER_STATE.FALLING) {
        fallTimer++;
        playerVelocityY -= CONFIG.GRAVITY * 1.3;
        player.position.y += playerVelocityY;
        if (player.position.y <= GROUND_Y + 0.4) {
            player.position.y = GROUND_Y + 0.4;
            playerState = PLAYER_STATE.RECOVERING;
        }
        return;
    }

    // Recover
    if (playerState === PLAYER_STATE.RECOVERING) {
        fallTimer++;
        player.rotation.x *= 0.9;
        player.rotation.z *= 0.9;
        if (fallTimer > 50) {
            playerState = PLAYER_STATE.RUNNING;
            player.position.y = GROUND_Y + PLAYER_FOOT_OFFSET;
        }
        return;
    }

    // Jump physics
    if (isJumping) {
        playerVelocityY -= CONFIG.GRAVITY;
        player.position.y += playerVelocityY;
        if (player.position.y <= GROUND_Y + PLAYER_FOOT_OFFSET) {
            player.position.y = GROUND_Y + PLAYER_FOOT_OFFSET;
            isJumping = false;
            playerVelocityY = 0;
        }
    }

    animateRun();
}

// ======================= RUN ANIMATION =======================
function animateRun() {
    const t = Date.now() * 0.01;
    player.children.forEach(p => {
        if (p.userData.type === 'leg') {
            const phase = p.userData.side === 1 ? 0 : Math.PI;
            p.rotation.x = Math.sin(t + phase) * 0.9;
        }
    });
}

// ======================= OBSTACLES =======================
function createObstacle(z) {
    const lane = Math.floor(Math.random() * 3) - 1;
    const tall = Math.random() > 0.5;

    const obs = new THREE.Mesh(
        new THREE.BoxGeometry(5, tall ? 8 : 4, 4),
        new THREE.MeshLambertMaterial({ color: tall ? 0x8b4513 : 0xa0522d })
    );

    obs.position.set(lane * CONFIG.LANE_WIDTH, tall ? 4 : 2, z);
    obs.userData = { lane, tall };
    obstacles.push(obs);
    scene.add(obs);
}

function updateObstacles() {
    obstacles.forEach(o => o.position.z += gameSpeed);
    obstacles = obstacles.filter(o => o.position.z <= player.position.z + 5);
    if (!obstacles.length || obstacles.at(-1).position.z > player.position.z - CONFIG.OBSTACLE_SPAWN_DISTANCE) {
        createObstacle(player.position.z - CONFIG.MIN_OBSTACLE_DISTANCE);
    }
}

// ======================= COLLISION =======================
function checkCollision() {
    if (playerState !== PLAYER_STATE.RUNNING) return;
    const pBox = new THREE.Box3().setFromObject(player);
    obstacles.forEach(o => {
        if (pBox.intersectsBox(new THREE.Box3().setFromObject(o))) {
            triggerFall(o);
        }
    });
}

function triggerFall(obstacle) {
    playerState = PLAYER_STATE.FALLING;
    fallTimer = 0;
    playerVelocityY = obstacle.userData.tall ? 0.35 : 0.2;
    player.rotation.x = obstacle.userData.tall ? -1.6 : -1.2;
    player.rotation.z = (Math.random() - 0.5) * 0.6;
    if (obstacle.userData.lane === currentLane) currentLane = currentLane === 0 ? 1 : 0;
}

// ======================= AI =======================
function collectTrainingData() {
    if (aiEnabled || obstacles.length === 0) return;

    const obs = obstacles.find(o => o.position.z < player.position.z && o.position.z > player.position.z - 20);
    if (!obs) return;

    const state = [
        currentLane,
        obs.userData.lane,
        (obs.position.z - player.position.z) / 20,
        obs.userData.tall ? 1 : 0,
        isJumping ? 1 : 0
    ];

    let action = 0;
    if (keys.left) action = 1;
    else if (keys.right) action = 2;
    else if (keys.space) action = 3;

    trainingData.push({ state, action });
    if (trainingData.length > MAX_TRAINING_DATA) trainingData.shift();
}

async function loadOrCreateAIModel() {
    try {
        aiModel = await tf.loadLayersModel('indexeddb://runner-ai-model');
    } catch {
        aiModel = createNeuralNetwork();
    }
}

function createNeuralNetwork() {
    const model = tf.sequential();
    model.add(tf.layers.dense({ inputShape: [5], units: 24, activation: 'relu' }));
    model.add(tf.layers.dense({ units: 16, activation: 'relu' }));
    model.add(tf.layers.dense({ units: 4, activation: 'softmax' }));
    model.compile({
        optimizer: tf.train.adam(0.001),
        loss: 'sparseCategoricalCrossentropy'
    });
    return model;
}

async function updateAI() {
    if (!aiEnabled || !aiModel || obstacles.length === 0) return;

    const obs = obstacles.find(o => o.position.z < player.position.z && o.position.z > player.position.z - 20);
    if (!obs) return;

    const state = tf.tensor2d([[currentLane, obs.userData.lane, (obs.position.z - player.position.z) / 20, obs.userData.tall ? 1 : 0, isJumping ? 1 : 0]]);
    const action = (await aiModel.predict(state).argMax(-1).data())[0];
    state.dispose();

    if (action === 1 && currentLane > -1) currentLane--;
    if (action === 2 && currentLane < 1) currentLane++;
    if (action === 3 && !isJumping) {
        isJumping = true;
        playerVelocityY = CONFIG.JUMP_FORCE;
    }
}

// ======================= LOOP =======================
function animate() {
    requestAnimationFrame(animate);

    updateAI();
    updatePlayer();
    updateObstacles();
    checkCollision();
    collectTrainingData();

    renderer.render(scene, camera);
}
