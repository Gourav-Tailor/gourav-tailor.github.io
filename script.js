(() => {
  const year = document.getElementById("year");
  if (year) year.textContent = new Date().getFullYear();

  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (reduced) return;

  // Subtle mouse depth on the two product screens.
  document.querySelectorAll(".demo-stage").forEach(stage => {
    stage.addEventListener("pointermove", e => {
      const r = stage.getBoundingClientRect();
      const x = (e.clientX - r.left) / r.width - .5;
      const y = (e.clientY - r.top) / r.height - .5;

      const cards = stage.querySelectorAll(".voice-card,.agent-card,.phone");
      cards.forEach((card, i) => {
        const strength = i === 0 ? 5 : 3;
        card.style.transform =
          `translate3d(${x * strength}px, ${y * strength}px, 0)`;
      });
    });

    stage.addEventListener("pointerleave", () => {
      stage.querySelectorAll(".voice-card,.agent-card,.phone").forEach(card => {
        card.style.transform = "";
      });
    });
  });

  // Animate the conversion label between voice and agent.
  const label = document.querySelector(".conversion-label");
  const messages = ["UNDERSTANDING INTENT", "BUILDING AGENT", "CONNECTING ACTIONS"];
  let index = 0;

  if (label) {
    setInterval(() => {
      label.animate(
        [
          { opacity: 1, transform: "translateY(0)" },
          { opacity: 0, transform: "translateY(-5px)" },
          { opacity: 1, transform: "translateY(0)" }
        ],
        { duration: 650, easing: "ease-in-out" }
      );
      index = (index + 1) % messages.length;
      setTimeout(() => { label.textContent = messages[index]; }, 300);
    }, 2400);
  }
})();
