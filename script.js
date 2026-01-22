// Conway's Game of Life Background
const canvas = document.getElementById('gameOfLife');
const ctx = canvas.getContext('2d');

let width, height, cellSize, cols, rows;
let grid, nextGrid;

function initGameOfLife() {
    width = window.innerWidth;
    height = window.innerHeight;
    cellSize = 15;
    
    canvas.width = width;
    canvas.height = height;
    
    cols = Math.floor(width / cellSize);
    rows = Math.floor(height / cellSize);
    
    grid = createGrid();
    nextGrid = createGrid();
    
    randomize();
    addGliders();
}

function createGrid() {
    const arr = [];
    for (let i = 0; i < cols; i++) {
        arr[i] = [];
        for (let j = 0; j < rows; j++) {
            arr[i][j] = 0;
        }
    }
    return arr;
}

function randomize() {
    for (let i = 0; i < cols; i++) {
        for (let j = 0; j < rows; j++) {
            grid[i][j] = Math.random() > 0.85 ? 1 : 0;
        }
    }
}

function addGliders() {
    const gliderPattern = [
        [0, 1, 0],
        [0, 0, 1],
        [1, 1, 1]
    ];
    
    for (let g = 0; g < 5; g++) {
        const startX = Math.floor(Math.random() * (cols - 10)) + 5;
        const startY = Math.floor(Math.random() * (rows - 10)) + 5;
        
        for (let i = 0; i < 3; i++) {
            for (let j = 0; j < 3; j++) {
                if (startX + i >= 0 && startX + i < cols && startY + j >= 0 && startY + j < rows) {
                    grid[startX + i][startY + j] = gliderPattern[i][j];
                }
            }
        }
    }
}

function countNeighbors(x, y) {
    let count = 0;
    for (let i = -1; i <= 1; i++) {
        for (let j = -1; j <= 1; j++) {
            if (i === 0 && j === 0) continue;
            
            let col = x + i;
            let row = y + j;
            
            if (col < 0) col = cols - 1;
            if (col >= cols) col = 0;
            if (row < 0) row = rows - 1;
            if (row >= rows) row = 0;
            
            count += grid[col][row];
        }
    }
    return count;
}

function updateGrid() {
    for (let i = 0; i < cols; i++) {
        for (let j = 0; j < rows; j++) {
            const neighbors = countNeighbors(i, j);
            const current = grid[i][j];
            
            if (current === 1) {
                nextGrid[i][j] = (neighbors === 2 || neighbors === 3) ? 1 : 0;
            } else {
                nextGrid[i][j] = neighbors === 3 ? 1 : 0;
            }
        }
    }
    
    const temp = grid;
    grid = nextGrid;
    nextGrid = temp;
}

function drawGrid() {
    ctx.fillStyle = '#0a0a0a';
    ctx.fillRect(0, 0, width, height);
    
    ctx.strokeStyle = 'rgba(0, 255, 136, 0.05)';
    ctx.lineWidth = 0.5;
    
    for (let i = 0; i <= cols; i++) {
        ctx.beginPath();
        ctx.moveTo(i * cellSize, 0);
        ctx.lineTo(i * cellSize, height);
        ctx.stroke();
    }
    
    for (let j = 0; j <= rows; j++) {
        ctx.beginPath();
        ctx.moveTo(0, j * cellSize);
        ctx.lineTo(width, j * cellSize);
        ctx.stroke();
    }
    
    for (let i = 0; i < cols; i++) {
        for (let j = 0; j < rows; j++) {
            if (grid[i][j] === 1) {
                const x = i * cellSize;
                const y = j * cellSize;
                
                const gradient = ctx.createRadialGradient(
                    x + cellSize / 2, y + cellSize / 2, 0,
                    x + cellSize / 2, y + cellSize / 2, cellSize / 2
                );
                gradient.addColorStop(0, 'rgba(0, 255, 136, 0.8)');
                gradient.addColorStop(1, 'rgba(0, 255, 136, 0.3)');
                
                ctx.fillStyle = gradient;
                ctx.fillRect(x + 1, y + 1, cellSize - 2, cellSize - 2);
            }
        }
    }
}

function animate() {
    drawGrid();
    updateGrid();
    setTimeout(() => requestAnimationFrame(animate), 150);
}

window.addEventListener('resize', () => {
    initGameOfLife();
});

initGameOfLife();
animate();

setInterval(() => {
    if (grid && cols > 0 && rows > 0) {
        const x = Math.floor(Math.random() * cols);
        const y = Math.floor(Math.random() * rows);
        if (grid[x] && grid[x][y] !== undefined) {
            grid[x][y] = 1;
        }
    }
}, 5000);

// Chat Assistant Implementation
class ChatAssistant {
    constructor() {
        this.recognition = null;
        this.synthesis = window.speechSynthesis;
        this.isListening = false;
        this.isProcessing = false;
        this.useSimpleFallback = true;
        this.knowledgeBase = this.initKnowledgeBase();
        this.init();
    }

    initKnowledgeBase() {
        return [
            {
                question: "What is your name? Who are you?",
                keywords: ["name", "who", "introduce", "yourself"],
                answer: "I'm Gourav Tailor, a Software Engineer from IIT Bombay specializing in AI-native applications and backend development."
            },
            {
                question: "What is your experience? How many years of experience do you have?",
                keywords: ["experience", "years", "work", "worked", "professional"],
                answer: "I have over 2 years of professional experience building scalable systems, processing 55,000+ resumes, and serving 60+ clients."
            },
            {
                question: "What technologies do you know? What are your skills?",
                keywords: ["technologies", "skills", "tech", "stack", "tools", "programming", "languages"],
                answer: "I specialize in Python, JavaScript, FastAPI, Node.js, React, Next.js, AWS, Docker, PostgreSQL, and MongoDB. I also work with AI and machine learning technologies."
            },
            {
                question: "Where did you study? What is your education?",
                keywords: ["study", "education", "college", "university", "degree", "iit"],
                answer: "I graduated from IIT Bombay with a Bachelor of Technology degree between 2018 and 2022."
            },
            {
                question: "What projects have you worked on? Tell me about your work",
                keywords: ["projects", "work", "built", "developed", "created", "portfolio"],
                answer: "I've built an AI medical report processing system reducing processing time by 60%, a RAG-powered resume search system processing 55K resumes, and trained over 300 students in full-stack development."
            },
            {
                question: "What is your current role? Where do you work?",
                keywords: ["current", "role", "job", "work", "company", "employer"],
                answer: "I currently work at SFDE Technologies as a Software Developer, building AI-powered medical report processing systems using FastAPI, Docker, and AWS."
            },
            {
                question: "How can I contact you? What is your email?",
                keywords: ["contact", "email", "reach", "connect", "touch"],
                answer: "You can reach me at gourav.tailor.ai@gmail.com, or connect with me on <a href='https://www.linkedin.com/in/gourav-tailor-2461b117a/' target='_blank'>LinkedIn</a> and <a href='https://github.com/Gourav-Tailor' target='_blank'>GitHub</a>."
            },
            {
                question: "Are you looking for opportunities? Are you open to work?",
                keywords: ["opportunities", "hiring", "job", "open", "available", "looking"],
                answer: "Yes! I'm open to new opportunities in Backend Engineering, AI/ML Engineering, Full-Stack Development, and Cloud Architecture roles."
            },
            {
                question: "What databases do you work with?",
                keywords: ["database", "databases", "sql", "nosql", "data"],
                answer: "I work with PostgreSQL, MongoDB, DynamoDB, and Redis for various use cases from relational data to caching and real-time applications."
            },
            {
                question: "Tell me about your AI projects",
                keywords: ["ai", "artificial intelligence", "machine learning", "ml", "rag"],
                answer: "I've built a RAG-powered AskHR system that processes 55,000 resumes (improving search accuracy by 35%), and a Bio Age Calculator using OCR and machine learning to extract biomarkers from medical reports."
            },
            {
                question: "Can I see your resume? Do you have a resume?",
                keywords: ["resume", "cv", "curriculum", "download", "pdf"],
                answer: "Yes! You can <a href='assets/Resume-Gourav-Tailor-1.pdf' target='_blank' download>download my resume here</a> or <a href='assets/Resume-Gourav-Tailor-1.pdf' target='_blank'>view it online</a>."
            },
            {
                question: "What is your github? Do you have code samples?",
                keywords: ["github", "code", "repository", "samples", "portfolio"],
                answer: "Check out my GitHub at <a href='https://github.com/Gourav-Tailor' target='_blank'>github.com/Gourav-Tailor</a> where I share my projects and contributions."
            }
        ];
    }

    async init() {
        if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
            const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
            this.recognition = new SpeechRecognition();
            this.recognition.continuous = false;
            this.recognition.interimResults = false;
            this.recognition.lang = 'en-US';

            this.recognition.onresult = (event) => this.handleSpeechResult(event);
            this.recognition.onerror = (event) => this.handleVoiceError(event);
            this.recognition.onend = () => this.handleRecognitionEnd();
        }

        document.getElementById('chatButton').addEventListener('click', () => this.toggleChat());
        document.getElementById('chatClose').addEventListener('click', () => this.closeChat());
        document.getElementById('sendBtn').addEventListener('click', () => this.sendMessage());
        document.getElementById('chatInput').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.sendMessage();
        });
        document.getElementById('voiceBtn').addEventListener('click', () => this.toggleVoice());
    }

    toggleChat() {
        const container = document.getElementById('chatContainer');
        container.classList.toggle('active');
    }

    closeChat() {
        document.getElementById('chatContainer').classList.remove('active');
    }

    toggleVoice() {
        if (!this.recognition) {
            this.addMessage('Voice input not supported in this browser', 'bot');
            return;
        }

        if (this.isListening) {
            this.stopListening();
        } else {
            this.startListening();
        }
    }

    startListening() {
        try {
            this.isListening = true;
            const voiceBtn = document.getElementById('voiceBtn');
            voiceBtn.classList.add('listening');
            voiceBtn.textContent = '🎤';
            this.recognition.start();
        } catch (error) {
            console.error('Error starting voice:', error);
            this.isListening = false;
        }
    }

    stopListening() {
        this.isListening = false;
        const voiceBtn = document.getElementById('voiceBtn');
        voiceBtn.classList.remove('listening');
        voiceBtn.textContent = '📞';
        if (this.recognition) {
            this.recognition.stop();
        }
    }

    handleSpeechResult(event) {
        const transcript = event.results[0][0].transcript;
        document.getElementById('chatInput').value = transcript;
        this.sendMessage();
        this.stopListening();
    }

    handleVoiceError(event) {
        console.error('Voice error:', event.error);
        this.stopListening();
        if (event.error === 'not-allowed') {
            this.addMessage('Microphone access denied. Please enable it in browser settings.', 'bot');
        }
    }

    handleRecognitionEnd() {
        if (this.isListening) {
            this.stopListening();
        }
    }

    async sendMessage() {
        const input = document.getElementById('chatInput');
        const message = input.value.trim();
        
        if (!message) return;

        this.addMessage(message, 'user');
        input.value = '';

        this.showTyping();

        setTimeout(async () => {
            const answer = await this.findBestAnswer(message);
            this.hideTyping();
            this.addMessage(answer, 'bot');
        }, 500);
    }

    findAnswerByKeywords(question) {
        const lowerQuestion = question.toLowerCase();
        let bestMatch = null;
        let bestScore = 0;

        for (let item of this.knowledgeBase) {
            let score = 0;
            for (let keyword of item.keywords) {
                if (lowerQuestion.includes(keyword.toLowerCase())) {
                    score++;
                }
            }
            if (score > bestScore) {
                bestScore = score;
                bestMatch = item;
            }
        }

        return bestScore > 0 ? bestMatch.answer : "I'm not sure about that. You can ask me about Gourav's experience, skills, projects, education, or contact information. You can also request his resume!";
    }

    async findBestAnswer(question) {
        return this.findAnswerByKeywords(question);
    }

    addMessage(text, type) {
        const messagesContainer = document.getElementById('chatMessages');
        const messageDiv = document.createElement('div');
        messageDiv.className = `chat-message ${type}`;
        
        const avatar = document.createElement('div');
        avatar.className = `message-avatar ${type}`;
        avatar.textContent = type === 'user' ? '👤' : '🤖';
        
        const content = document.createElement('div');
        content.className = `message-content ${type}`;
        content.innerHTML = text;
        
        messageDiv.appendChild(avatar);
        messageDiv.appendChild(content);
        messagesContainer.appendChild(messageDiv);
        
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }

    showTyping() {
        const messagesContainer = document.getElementById('chatMessages');
        const typingDiv = document.createElement('div');
        typingDiv.className = 'chat-message';
        typingDiv.id = 'typingIndicator';
        
        const avatar = document.createElement('div');
        avatar.className = 'message-avatar';
        avatar.textContent = '🤖';
        
        const indicator = document.createElement('div');
        indicator.className = 'typing-indicator';
        indicator.innerHTML = '<div class="typing-dot"></div><div class="typing-dot"></div><div class="typing-dot"></div>';
        
        typingDiv.appendChild(avatar);
        typingDiv.appendChild(indicator);
        messagesContainer.appendChild(typingDiv);
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }

    hideTyping() {
        const typing = document.getElementById('typingIndicator');
        if (typing) typing.remove();
    }
}

// Initialize chat assistant
let chatAssistant;
window.addEventListener('load', () => {
    setTimeout(() => {
        chatAssistant = new ChatAssistant();
    }, 1000);
});

// Custom cursor
const cursorDot = document.getElementById('cursorDot');
const cursorOutline = document.getElementById('cursorOutline');

document.addEventListener('mousemove', (e) => {
    cursorDot.style.left = e.clientX + 'px';
    cursorDot.style.top = e.clientY + 'px';
    
    cursorOutline.style.left = e.clientX - 16 + 'px';
    cursorOutline.style.top = e.clientY - 16 + 'px';
});

document.querySelectorAll('a, .btn, .project-card').forEach(el => {
    el.addEventListener('mouseenter', () => {
        cursorDot.style.transform = 'scale(2)';
        cursorOutline.style.transform = 'scale(1.5)';
    });
    el.addEventListener('mouseleave', () => {
        cursorDot.style.transform = 'scale(1)';
        cursorOutline.style.transform = 'scale(1)';
    });
});

// Smooth scroll
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
        e.preventDefault();
        const target = document.querySelector(this.getAttribute('href'));
        if (target) {
            target.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
    });
});

// Reveal on scroll
const revealElements = document.querySelectorAll('.reveal');

const revealOnScroll = () => {
    revealElements.forEach(el => {
        const rect = el.getBoundingClientRect();
        const windowHeight = window.innerHeight;
        
        if (rect.top < windowHeight - 100) {
            el.classList.add('active');
        }
    });
};

window.addEventListener('scroll', revealOnScroll);
revealOnScroll();

// Parallax effect for hero
window.addEventListener('scroll', () => {
    const scrolled = window.pageYOffset;
    const hero = document.querySelector('.hero-content');
    if (hero) {
        hero.style.transform = `translateY(${scrolled * 0.3}px)`;
        hero.style.opacity = 1 - (scrolled / 500);
    }
});
