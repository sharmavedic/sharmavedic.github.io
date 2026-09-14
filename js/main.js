// Theme toggle with persistence
(function () {
  const root = document.documentElement;
  const stored = localStorage.getItem("theme");
  if (stored) root.setAttribute("data-theme", stored);

  function currentTheme() {
    if (root.getAttribute("data-theme")) return root.getAttribute("data-theme");
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  }

  function updateToggleIcon() {
    const btn = document.querySelector(".theme-toggle");
    if (!btn) return;
    btn.textContent = currentTheme() === "dark" ? "☀️" : "🌙";
  }

  document.addEventListener("DOMContentLoaded", () => {
    updateToggleIcon();
    const btn = document.querySelector(".theme-toggle");
    if (btn) {
      btn.addEventListener("click", () => {
        const next = currentTheme() === "dark" ? "light" : "dark";
        root.setAttribute("data-theme", next);
        localStorage.setItem("theme", next);
        updateToggleIcon();
      });
    }

    const navToggle = document.querySelector(".nav-toggle");
    const navLinks = document.querySelector(".nav-links");
    if (navToggle && navLinks) {
      navToggle.addEventListener("click", () => navLinks.classList.toggle("open"));
      navLinks.querySelectorAll("a").forEach((a) =>
        a.addEventListener("click", () => navLinks.classList.remove("open"))
      );
    }

    const revealEls = document.querySelectorAll(".reveal");
    if ("IntersectionObserver" in window && revealEls.length) {
      const io = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (entry.isIntersecting) {
              entry.target.classList.add("in");
              io.unobserve(entry.target);
            }
          });
        },
        { threshold: 0.12 }
      );
      revealEls.forEach((el) => io.observe(el));
    } else {
      revealEls.forEach((el) => el.classList.add("in"));
    }

    // "?" buttons that sit in the prose rather than on a card. The card popups
    // are wired in their own sim files, because those fill CONFIG numbers in
    // before opening; these carry static text, so one generic pass does it.
    // Convention: a button with id "fooBtn" opens the dialog with id "foo".
    document.querySelectorAll(".prose-help-btn").forEach((btn) => {
      const dialog = document.getElementById(btn.id.replace(/Btn$/, ""));
      if (!dialog) return;
      btn.addEventListener("click", () => dialog.showModal());
      const close = document.getElementById(btn.id.replace(/Btn$/, "") + "Close");
      if (close) close.addEventListener("click", () => dialog.close());
      // The dialog fills its own box, so a click landing on the element itself
      // came from the backdrop — same rule the card popups use.
      dialog.addEventListener("click", (event) => {
        if (event.target === dialog) dialog.close();
      });
    });
  });
})();
