const skyCanvas = document.getElementById("sky");
const ctx = skyCanvas.getContext("2d");
let stars = [];
const mouse = { x: -9999, y: -9999 };
window.addEventListener("mousemove", (e) => {
  mouse.x = e.clientX;
  mouse.y = e.clientY;
});
window.addEventListener("mouseleave", () => {
  mouse.x = -9999;
  mouse.y = -9999;
});

function resizeSky() {
  skyCanvas.width = window.innerWidth;
  skyCanvas.height = window.innerHeight;
  const starCount = Math.floor((skyCanvas.width * skyCanvas.height) / 9000);
  stars = [];
  for (let i = 0; i < starCount; i++) {
    stars.push({
      x: Math.random() * skyCanvas.width,
      y: Math.random() * skyCanvas.height,
      radius: Math.random() * 1.3 + 0.3,
      alpha: Math.random() * 0.5 + 0.3,
      speed: Math.random() * 0.02,
    });
  }
}

function drawSky() {
  ctx.clearRect(0, 0, skyCanvas.width, skyCanvas.height);
  for (const star of stars) {
    star.y += star.speed;
    if (star.y > skyCanvas.height) star.y = 0;

    const dx = star.x - mouse.x;
    const dy = star.y - mouse.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    const isNear = distance < 140;

    ctx.beginPath();
    ctx.arc(star.x, star.y, isNear ? star.radius * 1.8 : star.radius, 0, Math.PI * 2);
    ctx.fillStyle = isNear
      ? `rgba(232, 199, 130, ${Math.min(1, star.alpha + 0.5)})`
      : `rgba(240, 238, 250, ${star.alpha})`;
    ctx.fill();

    if (isNear) {
      ctx.beginPath();
      ctx.moveTo(star.x, star.y);
      ctx.lineTo(mouse.x, mouse.y);
      ctx.strokeStyle = `rgba(111, 231, 221, ${(1 - distance / 140) * 0.25})`;
      ctx.lineWidth = 1;
      ctx.stroke();
    }
  }
  requestAnimationFrame(drawSky);
}
window.addEventListener("resize", resizeSky);
resizeSky();
drawSky();
const form = document.getElementById("search-form");
const queryInput = document.getElementById("query");
const resultsSection = document.getElementById("results");
const prevBtn = document.getElementById("prev-btn");
const nextBtn = document.getElementById("next-btn");
let currentBooks = [];
let centerIndex = 0;

form.addEventListener("submit", async (event) => {
  event.preventDefault();

  const query = queryInput.value.trim();
  if (!query) return;

  resultsSection.innerHTML = "<p style='text-align:center; color:#9c9bb5;'>Searching...</p>";

  try {
    const response = await fetch("/api/recommend", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query: query, top_k: 10 }),
    });

    if (!response.ok) {
      throw new Error("Search failed");
    }

    const books = await response.json();
    renderResults(books);

  } catch (error) {
    resultsSection.innerHTML = `<p style="text-align:center; color:#e88f8f;">Something went wrong: ${error.message}</p>`;
  }
});
function renderResults(books) {
  currentBooks = books;
  centerIndex = Math.floor((books.length - 1) / 2);
  resultsSection.innerHTML = "";

  if (books.length === 0) {
    resultsSection.innerHTML = "<p style='text-align:center; color:#9c9bb5;'>No matches found.</p>";
    return;
  }

  books.forEach((book, index) => {
    const card = document.createElement("div");
    card.className = "book-card";
    card.dataset.index = index;

    card.innerHTML = `
      <div class="card-inner">
        <div class="card-face card-front">
          <img src="${book.thumbnail || "https://placehold.co/200x300?text=No+Cover"}" alt="${book.title}" />
          ${index === 0 ? '<p class="best-badge">★ Best match</p>' : ""}
          <h3>${book.title}</h3>
          <p>${book.authors || "Unknown author"}</p>
          <p>${book.match_score}% match</p>
          <p class="flip-hint">⟲ click to read description</p>
        </div>
        <div class="card-face card-back">
          <h4>${book.title}</h4>
          <div class="back-desc">${book.description || "No description available."}</div>
        </div>
      </div>
    `;

    card.addEventListener("click", () => {
      const clickedIndex = parseInt(card.dataset.index, 10);
      if (clickedIndex === centerIndex) {
        card.classList.toggle("flipped");
      } else {
        centerIndex = clickedIndex;
        layoutCarousel();
      }
    });

    resultsSection.appendChild(card);
  });

  layoutCarousel();
}

function layoutCarousel() {
  const cards = resultsSection.querySelectorAll(".book-card");

  cards.forEach((card, index) => {
    const offset = index - centerIndex;
    const angle = offset * 16;
    const radians = (angle * Math.PI) / 180;
    const radius = 260;

    const x = Math.sin(radians) * radius;
    const z = Math.cos(radians) * radius - radius;
    const scale = Math.max(0.55, 1 - Math.abs(offset) * 0.18);
    const opacity = Math.max(0, 1 - Math.abs(offset) * 0.3);

    card.style.transform = `translateX(${x}px) translateZ(${z}px) rotateY(${-angle}deg) scale(${scale})`;
    card.style.opacity = opacity;
    card.style.zIndex = 100 - Math.abs(offset);
    card.style.pointerEvents = opacity <= 0.05 ? "none" : "auto";

    card.classList.toggle("center", offset === 0);
    if (offset !== 0) card.classList.remove("flipped");
  });
}

prevBtn.addEventListener("click", () => {
  if (centerIndex > 0) {
    centerIndex--;
    layoutCarousel();
  }
});

nextBtn.addEventListener("click", () => {
  if (centerIndex < currentBooks.length - 1) {
    centerIndex++;
    layoutCarousel();
  }
});

const PROMPTS = [
  "a book to teach children about nature...",
  "a slow-burn romance set in a small town...",
  "a memoir about starting over in a new country...",
  "a mystery where the detective is the culprit...",
  "a cozy fantasy with found family...",
];

let promptIndex = 0;
let charIndex = 0;
let isDeleting = false;

function typePlaceholder() {
  if (document.activeElement === queryInput || queryInput.value) {
    setTimeout(typePlaceholder, 500);
    return;
  }

  const currentPrompt = PROMPTS[promptIndex];

  if (!isDeleting) {
    charIndex++;
    queryInput.placeholder = currentPrompt.slice(0, charIndex);
    if (charIndex === currentPrompt.length) {
      isDeleting = true;
      setTimeout(typePlaceholder, 1800);
      return;
    }
  } else {
    charIndex--;
    queryInput.placeholder = currentPrompt.slice(0, charIndex);
    if (charIndex === 0) {
      isDeleting = false;
      promptIndex = (promptIndex + 1) % PROMPTS.length;
    }
  }

  setTimeout(typePlaceholder, isDeleting ? 30 : 60);
}

typePlaceholder();

const statsLine = document.getElementById("stats-line");
const floatingBooksContainer = document.getElementById("floating-books");

document.querySelectorAll(".chip").forEach((chip) => {
  chip.addEventListener("click", () => {
    queryInput.value = chip.textContent;
    form.requestSubmit();
  });
});

async function loadStats() {
  try {
    const response = await fetch("/api/categories");
    const data = await response.json();
    statsLine.textContent = `Searching ${data.total_books} books by meaning, not keywords`;
  } catch (error) {
    console.log("Could not load stats:", error);
  }
}

async function loadFeatured() {
  try {
    const response = await fetch("/api/featured?count=10");
    const books = await response.json();
    renderResults(books);
    createFloatingCovers(books);
  } catch (error) {
    console.log("Could not load featured books:", error);
  }
}

function createFloatingCovers(books) {
  floatingBooksContainer.innerHTML = "";
  const usable = books.filter((b) => b.thumbnail).slice(0, 8);

  usable.forEach((book) => {
    const img = document.createElement("img");
    img.src = book.thumbnail;
    img.className = "floating-book";
    img.style.left = `${Math.random() * 90}vw`;
    img.style.top = `${Math.random() * 90}vh`;
    img.style.animationDuration = `${14 + Math.random() * 10}s`;
    img.style.animationDelay =`-${Math.random() * 10}s`;
    floatingBooksContainer.appendChild(img);
  });
}

loadStats();
loadFeatured();