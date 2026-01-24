// ========================== CONFIG ==========================
const CONFIG = {
    SPEED: 0.4,
    JUMP_FORCE: 0.55,
    GRAVITY: 0.018,
    LANE_WIDTH: 8,
    OBSTACLE_SPAWN_DISTANCE: 45,
    MIN_OBSTACLE_DISTANCE: 35
};

const GROUND_Y = 0;
const PLAYER_FOOT_OFFSET = 1.95;

// ========================== RL ==========================
let policyModel;
let episode = [];
const GAMMA = 0.99;
const EPSILON = 0.1;

// ========================== STATE ==========================
let scene, camera, renderer;
let player, ground;
let obstacles = [];

let playerVelocityY = 0;
let isJumping = false;
let currentLane = 0;

const PLAYER_STATE = {
    RUNNING: 'running',
    FALLING: 'falling',
    RECOVERING: 'recovering'
};
let playerState = PLAYER_STATE.RUNNING;
let fallTimer = 0;

// ========================== INIT ==========================
init();
function init() {
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x4a5568);
    scene.fog = new THREE.Fog(0x4a5568, 30, 120);

    camera = new THREE.PerspectiveCamera(75, innerWidth / innerHeight, 0.1, 500);
    camera.position.set(0, 12, 20);
    camera.rotation.x = -Math.PI / 9;

    renderer = new THREE.WebGLRenderer({ canvas: gameCanvas, antialias: true });
    renderer.setSize(innerWidth, innerHeight);
    renderer.shadowMap.enabled = true;

    scene.add(new THREE.AmbientLight(0xffffff, 0.4));
    const dir = new THREE.DirectionalLight(0xffeedd, 0.6);
    dir.position.set(5, 15, 10);
    dir.castShadow = true;
    scene.add(dir);

    createGround();
    createPlayer();

    policyModel = createPolicyNetwork();
    animate();
}

// ========================== ENV ==========================
function createGround() {
    ground = new THREE.Mesh(
        new THREE.PlaneGeometry(60, 400),
        new THREE.MeshLambertMaterial({ color: 0x556b2f })
    );
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    scene.add(ground);
}

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

    scene.add(player);
}

// ========================== OBSTACLES ==========================
function createObstacle(z) {
    const lane = Math.floor(Math.random() * 3) - 1;
    const tall = Math.random() > 0.5;

    const obs = new THREE.Mesh(
        new THREE.BoxGeometry(5, tall ? 8 : 4, 4),
        new THREE.MeshLambertMaterial({ color: tall ? 0x8b4513 : 0xa0522d })
    );

    obs.position.set(lane * CONFIG.LANE_WIDTH, tall ? 4 : 2, z);
    obs.userData = { lane, tall };
    obs.castShadow = true;

    obstacles.push(obs);
    scene.add(obs);
}

function updateObstacles() {
    obstacles.forEach(o => o.position.z += CONFIG.SPEED);

    if (
        obstacles.length === 0 ||
        obstacles[obstacles.length - 1].position.z >
            player.position.z - CONFIG.OBSTACLE_SPAWN_DISTANCE
    ) {
        createObstacle(player.position.z - CONFIG.MIN_OBSTACLE_DISTANCE);
    }

    obstacles = obstacles.filter(o => {
        if (o.position.z > player.position.z + 5) {
            scene.remove(o);
            return false;
        }
        return true;
    });
}

// ========================== RL CORE ==========================
function createPolicyNetwork() {
    const model = tf.sequential();
    model.add(tf.layers.dense({ inputShape: [5], units: 32, activation: 'relu' }));
    model.add(tf.layers.dense({ units: 32, activation: 'relu' }));
    model.add(tf.layers.dense({ units: 4, activation: 'softmax' }));

    model.compile({
        optimizer: tf.train.adam(0.0005),
        loss: policyLoss
    });

    return model;
}

function policyLoss(yTrue, yPred) {
    const logProb = tf.sum(tf.mul(yTrue, tf.log(yPred + 1e-10)), 1);
    return tf.neg(tf.mean(logProb));
}

function selectAction(state) {
    if (Math.random() < EPSILON) {
        return Math.floor(Math.random() * 4);
    }

    const probs = policyModel.predict(tf.tensor2d([state])).dataSync();
    let r = Math.random(), sum = 0;
    for (let i = 0; i < probs.length; i++) {
        sum += probs[i];
        if (r < sum) return i;
    }
    return 0;
}

function storeStep(state, action, reward) {
    episode.push({ state, action, reward });
}

async function trainPolicy() {
    let G = 0;
    const returns = episode.map(step => {
        G = step.reward + GAMMA * G;
        return G;
    }).reverse();

    const states = episode.map(e => e.state);
    const actions = episode.map(e => {
        const a = [0, 0, 0, 0];
        a[e.action] = 1;
        return a;
    });

    const xs = tf.tensor2d(states);
    const ys = tf.tensor2d(actions);

    await policyModel.fit(xs, ys, {
        sampleWeight: returns,
        epochs: 1
    });

    xs.dispose();
    ys.dispose();
    episode = [];
}

// ========================== GAME LOOP ==========================
function animate() {
    requestAnimationFrame(animate);

    updateObstacles();

    const obs = obstacles[0];

    // ---------- STATE ----------
    const state = [
        currentLane,
        obs ? obs.userData.lane : 0,
        obs ? (obs.position.z - player.position.z) / CONFIG.MIN_OBSTACLE_DISTANCE : -1,
        obs ? (obs.userData.tall ? 1 : 0) : 0,
        isJumping ? 1 : 0
    ];

    // ---------- ACTION ----------
    const action = selectAction(state);

    if (playerState === PLAYER_STATE.RUNNING) {
        if (action === 1 && currentLane > -1) currentLane--;
        if (action === 2 && currentLane < 1) currentLane++;
        if (action === 3 && !isJumping) {
            isJumping = true;
            playerVelocityY = CONFIG.JUMP_FORCE;
        }
    }

    // ---------- MOVEMENT ----------
    player.position.x += (currentLane * CONFIG.LANE_WIDTH - player.position.x) * 0.12;

    if (isJumping) {
        playerVelocityY -= CONFIG.GRAVITY;
        player.position.y += playerVelocityY;

        if (player.position.y <= GROUND_Y + PLAYER_FOOT_OFFSET) {
            player.position.y = GROUND_Y + PLAYER_FOOT_OFFSET;
            isJumping = false;
        }
    }

    // ---------- COLLISION ----------
    let reward = -0.01;

    if (obs) {
        const hit =
            Math.abs(obs.position.z - player.position.z) < 1.5 &&
            Math.abs(obs.position.x - player.position.x) < 2 &&
            player.position.y < 3;

        if (hit) {
            reward = -2;
            trainPolicy();
            obstacles.forEach(o => scene.remove(o));
            obstacles = [];
        }

        if (obs.position.z > player.position.z + 2) {
            reward = 1;
            scene.remove(obs);
            obstacles.shift();
        }
    }

    storeStep(state, action, reward);

    camera.position.x += (player.position.x * 0.8 - camera.position.x) * 0.08;
    camera.position.z += ((player.position.z + 20) - camera.position.z) * 0.05;

    renderer.render(scene, camera);
}
