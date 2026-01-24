// ================== CONFIG ==================
const CONFIG = {
    SPEED: 0.4,
    JUMP_FORCE: 0.55,
    GRAVITY: 0.018,
    LANE_WIDTH: 8,
    OBSTACLE_SPAWN_DISTANCE: 50,
    MIN_OBSTACLE_DISTANCE: 35
};

const PLAYER_GROUND_Y = 2.2;

// ================== GAME STATE ==================
let scene, camera, renderer, player, ground;
let obstacles = [];
let score = 0;
let isGameOver = false;
let currentLane = 0;
let targetLane = 0;
let playerVelocityY = 0;
let isJumping = false;

// ================== AI (DQN) ==================
let aiEnabled = false;
let aiModel;

// RL Hyperparameters
let epsilon = 1.0;
const EPSILON_MIN = 0.05;
const EPSILON_DECAY = 0.995;
const GAMMA = 0.95;

let replayBuffer = [];
const MAX_BUFFER_SIZE = 5000;
const BATCH_SIZE = 32;

// ================== INPUT ==================
const keys = { left: false, right: false, space: false };

// ================== INIT ==================
async function init() {
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x4a5568);
    scene.fog = new THREE.Fog(0x4a5568, 30, 100);

    camera = new THREE.PerspectiveCamera(
        75, window.innerWidth / window.innerHeight, 0.1, 1000
    );
    camera.position.set(0, 12, 20);
    camera.rotation.x = -Math.PI / 9;

    renderer = new THREE.WebGLRenderer({
        canvas: document.getElementById("gameCanvas"),
        antialias: true
    });
    renderer.setSize(window.innerWidth, window.innerHeight);

    scene.add(new THREE.AmbientLight(0xffffff, 0.4));
    const sun = new THREE.DirectionalLight(0xffffff, 0.6);
    sun.position.set(5, 15, 10);
    scene.add(sun);

    createGround();
    createPlayer();

    aiModel = createQNetwork();

    setupEventListeners();
    animate();
}

// ================== WORLD ==================
function createGround() {
    const geo = new THREE.PlaneGeometry(60, 300);
    const mat = new THREE.MeshLambertMaterial({ color: 0x556b2f });
    ground = new THREE.Mesh(geo, mat);
    ground.rotation.x = -Math.PI / 2;
    scene.add(ground);

    for (let i = -1; i <= 1; i++) {
        if (i === 0) continue;
        const line = new THREE.Mesh(
            new THREE.PlaneGeometry(0.2, 300),
            new THREE.MeshBasicMaterial({ color: 0x888888, opacity: 0.5, transparent: true })
        );
        line.rotation.x = -Math.PI / 2;
        line.position.x = i * CONFIG.LANE_WIDTH;
        scene.add(line);
    }
}

function createPlayer() {
    player = new THREE.Group();
    player.position.set(0, PLAYER_GROUND_Y, 10);

    const mat = new THREE.MeshLambertMaterial({ color: 0xe8e8e8 });

    const body = new THREE.Mesh(
        new THREE.CylinderGeometry(0.8, 0.8, 3),
        mat
    );
    body.position.y = 1.5;
    player.add(body);

    const head = new THREE.Mesh(
        new THREE.SphereGeometry(0.9, 12, 12),
        mat
    );
    head.position.y = 3.5;
    player.add(head);

    scene.add(player);
}

// ================== OBSTACLES ==================
function createObstacle(z) {
    const lane = Math.floor(Math.random() * 3) - 1;
    const type = Math.random() > 0.5 ? "tall" : "short";

    const width = CONFIG.LANE_WIDTH * 0.55;
    const height = type === "tall" ? width * 2.2 : width * 0.7;

    const obstacle = new THREE.Mesh(
        new THREE.BoxGeometry(width, height, width * 0.8),
        new THREE.MeshLambertMaterial({ color: 0x8b4513 })
    );

    obstacle.position.set(lane * CONFIG.LANE_WIDTH, height / 2, z);
    obstacle.userData = { lane, type };
    obstacles.push(obstacle);
    scene.add(obstacle);
}

function updateObstacles() {
    obstacles.forEach(o => o.position.z += CONFIG.SPEED);

    obstacles = obstacles.filter(o => {
        if (o.position.z > player.position.z + 5) {
            scene.remove(o);
            return false;
        }
        return true;
    });

    if (
        obstacles.length === 0 ||
        obstacles[obstacles.length - 1].position.z >
        player.position.z - CONFIG.OBSTACLE_SPAWN_DISTANCE
    ) {
        createObstacle(player.position.z - CONFIG.OBSTACLE_SPAWN_DISTANCE);
    }
}

// ================== COLLISION ==================
function checkCollision() {
    for (const o of obstacles) {
        if (Math.abs(o.position.z - player.position.z) < 3) {
            const pb = new THREE.Box3().setFromObject(player);
            const ob = new THREE.Box3().setFromObject(o);
            if (pb.intersectsBox(ob)) {
                gameOver();
                return true;
            }
        }
    }
    return false;
}

// ================== PLAYER ==================
function updatePlayer() {
    player.position.x +=
        (targetLane * CONFIG.LANE_WIDTH - player.position.x) * 0.1;

    if (isJumping) {
        playerVelocityY -= CONFIG.GRAVITY;
        player.position.y += playerVelocityY;
        if (player.position.y <= PLAYER_GROUND_Y) {
            player.position.y = PLAYER_GROUND_Y;
            isJumping = false;
        }
    }
}

function jump() {
    if (!isJumping) {
        isJumping = true;
        playerVelocityY = CONFIG.JUMP_FORCE;
    }
}

// ================== RL CORE ==================
function getState() {
    const obs = obstacles.find(
        o => o.position.z < player.position.z &&
             o.position.z > player.position.z - 20
    );
    if (!obs) return null;

    return [
        currentLane,
        obs.userData.lane,
        (obs.position.z - player.position.z) / 20,
        obs.userData.type === "tall" ? 1 : 0,
        isJumping ? 1 : 0
    ];
}

function createQNetwork() {
    const model = tf.sequential();
    model.add(tf.layers.dense({ inputShape: [5], units: 32, activation: "relu" }));
    model.add(tf.layers.dense({ units: 32, activation: "relu" }));
    model.add(tf.layers.dense({ units: 4 }));
    model.compile({
        optimizer: tf.train.adam(0.001),
        loss: "meanSquaredError"
    });
    return model;
}

async function chooseAction(state) {
    if (Math.random() < epsilon) {
        return Math.floor(Math.random() * 4);
    }
    const q = aiModel.predict(tf.tensor2d([state]));
    const a = (await q.argMax(-1).data())[0];
    q.dispose();
    return a;
}

function remember(exp) {
    replayBuffer.push(exp);
    if (replayBuffer.length > MAX_BUFFER_SIZE) replayBuffer.shift();
}

async function train() {
    if (replayBuffer.length < BATCH_SIZE) return;

    const batch = replayBuffer
        .sort(() => Math.random() - 0.5)
        .slice(0, BATCH_SIZE);

    const states = [];
    const targets = [];

    for (const e of batch) {
        const q = aiModel.predict(tf.tensor2d([e.state]));
        const qVals = Array.from(await q.data());

        if (e.done) {
            qVals[e.action] = e.reward;
        } else {
            const qNext = aiModel.predict(tf.tensor2d([e.nextState]));
            const maxQ = Math.max(...await qNext.data());
            qVals[e.action] = e.reward + GAMMA * maxQ;
            qNext.dispose();
        }

        states.push(e.state);
        targets.push(qVals);
        q.dispose();
    }

    await aiModel.fit(
        tf.tensor2d(states),
        tf.tensor2d(targets),
        { epochs: 1, verbose: 0 }
    );

    epsilon = Math.max(EPSILON_MIN, epsilon * EPSILON_DECAY);
}

// ================== AI UPDATE ==================
async function updateAI() {
    if (!aiEnabled || isGameOver) return;

    const state = getState();
    if (!state) return;

    const action = await chooseAction(state);

    if (action === 1 && currentLane > -1) targetLane = --currentLane;
    if (action === 2 && currentLane < 1) targetLane = ++currentLane;
    if (action === 3) jump();

    const nextState = getState();
    remember({
        state,
        action,
        reward: 0.1,
        nextState,
        done: false
    });

    await train();
}

// ================== GAME LOOP ==================
function animate() {
    requestAnimationFrame(animate);

    if (!isGameOver) {
        updateAI();
        updatePlayer();
        updateObstacles();
        checkCollision();
        score += 0.1;
    }

    renderer.render(scene, camera);
}

// ================== GAME OVER ==================
function gameOver() {
    isGameOver = true;
    epsilon = Math.min(1.0, epsilon + 0.1);
}

// ================== INPUT ==================
function setupEventListeners() {
    window.addEventListener("keydown", e => {
        if (e.code === "ArrowLeft") keys.left = true;
        if (e.code === "ArrowRight") keys.right = true;
        if (e.code === "Space") jump();
    });

    document.getElementById("aiToggle").onclick = () => {
        aiEnabled = !aiEnabled;
    };
}

// ================== START ==================
init();
