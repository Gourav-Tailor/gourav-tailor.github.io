// Typing effect
const roles = ["Python Developer", "Backend Engineer", "Django & FastAPI Specialist", "AI Agent Builder"];
const typedEl = document.getElementById("typed");
let r = 0, c = 0, deleting = false;
function type() {
  const word = roles[r];
  typedEl.textContent = word.slice(0, c);
  if (!deleting && c < word.length) c++;
  else if (deleting && c > 0) c--;
  else if (!deleting) { deleting = true; return setTimeout(type, 1500); }
  else { deleting = false; r = (r + 1) % roles.length; }
  setTimeout(type, deleting ? 40 : 80);
}
type();

// Nav background on scroll
const nav = document.getElementById("nav");
window.addEventListener("scroll", () => nav.classList.toggle("scrolled", window.scrollY > 40));

// Mobile menu
const menu = document.getElementById("menu");
document.getElementById("menuBtn").addEventListener("click", () => menu.classList.toggle("open"));
menu.querySelectorAll("a").forEach(a => a.addEventListener("click", () => menu.classList.remove("open")));

// Reveal on scroll
const io = new IntersectionObserver(entries => {
  entries.forEach(e => { if (e.isIntersecting) { e.target.classList.add("visible"); io.unobserve(e.target); } });
}, { threshold: 0.15 });
document.querySelectorAll(".reveal").forEach(el => io.observe(el));

// Count-up stats
document.querySelectorAll("[data-count]").forEach(el => {
  const target = +el.dataset.count;
  let n = 0;
  const step = Math.max(1, Math.ceil(target / 60));
  const tick = () => { n = Math.min(target, n + step); el.textContent = n; if (n < target) requestAnimationFrame(tick); };
  setTimeout(tick, 400);
});

// Cursor glow
const glow = document.getElementById("glow");
window.addEventListener("mousemove", e => { glow.style.left = e.clientX + "px"; glow.style.top = e.clientY + "px"; });

// Year
document.getElementById("year").textContent = new Date().getFullYear();
