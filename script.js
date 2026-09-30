(() => {
  "use strict";

  const WAITLIST_URL =
    "https://docs.google.com/forms/d/e/1FAIpQLSd1d9hAi1KjTpt-MQ4KEjZPblUH9iHW4iEU3v-8dQCD-aS9Tw/viewform?usp=publish-editor";

  const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  // Footer year
  const year = document.getElementById("year");
  if (year) year.textContent = new Date().getFullYear();

  // Scroll reveal
  const revealItems = document.querySelectorAll(".reveal");
  if ("IntersectionObserver" in window && !prefersReducedMotion) {
    const observer = new IntersectionObserver(
      entries => {
        entries.forEach(entry => {
          if (!entry.isIntersecting) return;
          entry.target.classList.add("is-visible");
          observer.unobserve(entry.target);
        });
      },
      { threshold: 0.12, rootMargin: "0px 0px -50px 0px" }
    );

    revealItems.forEach(item => observer.observe(item));
  } else {
    revealItems.forEach(item => item.classList.add("is-visible"));
  }

  if (prefersReducedMotion) return;

  // Cursor ambient light
  const cursorGlow = document.querySelector(".cursor-glow");
  let mouseX = window.innerWidth / 2;
  let mouseY = window.innerHeight / 2;
  let glowX = mouseX;
  let glowY = mouseY;

  window.addEventListener("pointermove", event => {
    mouseX = event.clientX;
    mouseY = event.clientY;
  }, { passive: true });

  const animateGlow = () => {
    glowX += (mouseX - glowX) * 0.09;
    glowY += (mouseY - glowY) * 0.09;

    if (cursorGlow) {
      cursorGlow.style.transform =
        `translate3d(${glowX}px, ${glowY}px, 0) translate(-50%, -50%)`;
    }

    requestAnimationFrame(animateGlow);
  };

  animateGlow();

  // Magnetic buttons
  document.querySelectorAll(".magnetic").forEach(element => {
    element.addEventListener("pointermove", event => {
      const rect = element.getBoundingClientRect();
      const x = (event.clientX - rect.left - rect.width / 2) * 0.12;
      const y = (event.clientY - rect.top - rect.height / 2) * 0.12;
      element.style.transform = `translate3d(${x}px, ${y}px, 0)`;
    });

    element.addEventListener("pointerleave", () => {
      element.style.transform = "";
    });
  });

  // 3D card tilt
  document.querySelectorAll(".tilt").forEach(card => {
    card.addEventListener("pointermove", event => {
      const rect = card.getBoundingClientRect();
      const x = (event.clientX - rect.left) / rect.width - 0.5;
      const y = (event.clientY - rect.top) / rect.height - 0.5;

      card.style.transform =
        `perspective(900px) translateY(-7px) rotateX(${(-y * 3).toFixed(2)}deg) rotateY(${(x * 3).toFixed(2)}deg)`;
    });

    card.addEventListener("pointerleave", () => {
      card.style.transform = "";
    });
  });

  // Hero depth movement
  const heroVisual = document.querySelector(".hero-visual");
  if (heroVisual) {
    heroVisual.addEventListener("pointermove", event => {
      const rect = heroVisual.getBoundingClientRect();
      const x = (event.clientX - rect.left) / rect.width - 0.5;
      const y = (event.clientY - rect.top) / rect.height - 0.5;

      heroVisual.style.transform =
        `perspective(1000px) rotateX(${(-y * 2).toFixed(2)}deg) rotateY(${(x * 2).toFixed(2)}deg)`;
    });

    heroVisual.addEventListener("pointerleave", () => {
      heroVisual.style.transform = "";
    });
  }

  // Waitlist form: Google Forms is the source of truth.
  const form = document.getElementById("waitlistForm");
  const status = document.getElementById("formStatus");
  const email = document.getElementById("email");

  if (form) {
    form.addEventListener("submit", event => {
      event.preventDefault();

      const value = email.value.trim();

      if (!value || !email.checkValidity()) {
        status.textContent = "Enter a valid email address.";
        return;
      }

      // Store locally so the email is not lost while moving to the form.
      try {
        localStorage.setItem("audoack_waitlist_email", value);
      } catch (_) {}

      status.textContent = "Opening the AudoAck waitlist…";
      window.open(WAITLIST_URL, "_blank", "noopener,noreferrer");
    });
  }
})();
