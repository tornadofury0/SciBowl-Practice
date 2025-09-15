const QUESTION_URL =
  "https://raw.githubusercontent.com/tornadofury0/National-Science-Bowl-Questions/refs/heads/main/all_questions.json";

let allQuestions = [];
let currentQuestion = null;
let typingInterval = null;
let geminiApiKey = "";
let timeLeft = 0;
let timerId = null;
let buzzed = false;
let waitingForNext = false;
let scores = {};

async function initGemini() {
  const keyInput = document.getElementById("gemini-key");
  geminiApiKey = keyInput ? keyInput.value.trim() : "";
  if (!geminiApiKey) {
    alert("Please enter your Gemini API key!");
    return false;
  }
  return true;
}

async function loadQuestions() {
  try {
    const res = await fetch(QUESTION_URL);
    if (!res.ok) throw new Error("Network response was not ok: " + res.status);
    const data = await res.json();
    if (!data || !Array.isArray(data.questions)) {
      throw new Error("Invalid question file format");
    }
    allQuestions = data.questions.filter((q) => q.bonus === false);
    showCategorySelection();
    console.log("Questions loaded:", allQuestions.length);
  } catch (err) {
    console.error("Error loading questions:", err);
    const container = document.getElementById("category-select");
    if (container) {
      container.innerHTML =
        '<div style="color:darkred">Failed to load categories — check console for details</div>';
    }
  }
}

function showCategorySelection() {
  const container = document.getElementById("category-select");
  if (!container) {
    console.error('No element with id "category-select" found');
    return;
  }
  const categories = [
    ...new Set(allQuestions.map((q) => (q.category ? q.category : "Unknown"))),
  ].sort();
  container.innerHTML = "<h3>Choose categories:</h3>";
  categories.forEach((cat) => {
    const id = "cat_" + cat.replace(/\s+/g, "_").replace(/[^\w\-]/g, "");
    container.innerHTML += `
      <label>
        <input type="checkbox" id="${id}" value="${cat}" checked /> ${cat}
      </label><br>
    `;
  });
}

function getSelectedCategories() {
  const checkboxes = document.querySelectorAll(
    "#category-select input[type=checkbox]"
  );
  return [...checkboxes].filter((cb) => cb.checked).map((cb) => cb.value);
}

function updateScores() {
  const scoresDiv = document.getElementById("scores");
  if (!scoresDiv) return;
  let html = "<h3>Scores by Category</h3>";
  for (const [cat, s] of Object.entries(scores)) {
    html += `<div>${cat}: ✅ ${s.correct} | ❌ ${s.wrong}</div>`;
  }
  scoresDiv.innerHTML = html;
}

function showQuestion(q) {
  const qDiv = document.getElementById("question");
  if (!qDiv) return;
  qDiv.textContent = "";
  const speed = parseInt(document.getElementById("speed")?.value) || 50;
  let i = 0;
  if (typingInterval) clearInterval(typingInterval);
  typingInterval = setInterval(() => {
    if (i < q.length) {
      qDiv.textContent += q[i++];
    } else {
      clearInterval(typingInterval);
      typingInterval = null;
      startTimer(5, () => {
        if (!buzzed) {
          document.getElementById("results").textContent =
            "Time up! You did not buzz.";
          waitingForNext = true;
        }
      });
    }
  }, speed);
}

function startTimer(seconds, onEnd) {
  timeLeft = seconds;
  updateTimer();
  if (timerId) clearInterval(timerId);
  timerId = setInterval(() => {
    timeLeft--;
    updateTimer();
    if (timeLeft <= 0) {
      clearInterval(timerId);
      timerId = null;
      onEnd();
    }
  }, 1000);
}

function updateTimer() {
  const tDiv = document.getElementById("timer");
  if (tDiv) tDiv.textContent = "⏱ " + timeLeft;
}

function buzz() {
  if (waitingForNext) {
    nextQuestion();
    return;
  }
  if (buzzed || !currentQuestion) return;
  buzzed = true;

  if (typingInterval) {
    clearInterval(typingInterval);
    typingInterval = null;
  }
  if (timerId) {
    clearInterval(timerId);
    timerId = null;
  }

  const answerInput = document.getElementById("answer");
  document.getElementById("answer-section").style.display = "block";
  if (answerInput) {
    answerInput.disabled = false;
    answerInput.focus();
  }
  startTimer(8, submitAnswer);
}

async function checkWithGemini(userAns, correctAns) {
  if (!geminiApiKey) return false;
  const prompt = `The user was asked a question. Correct answer: "${correctAns}" User answer: "${userAns}" Is the user's answer correct? Only reply "Yes" or "No".`;
  try {
    const response = await fetch(
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=" +
        geminiApiKey,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ role: "user", parts: [{ text: prompt }] }],
        }),
      }
    );
    const data = await response.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
    return text && text.toLowerCase().startsWith("yes");
  } catch (e) {
    console.error("Gemini error", e);
    return false;
  }
}

async function submitAnswer() {
  if (timerId) {
    clearInterval(timerId);
    timerId = null;
  }
  const userAns = document.getElementById("answer")?.value.trim() || "";
  const correctAns = currentQuestion?.parsed_answer || "";
  const category = currentQuestion?.category || "Unknown";
  if (!scores[category]) scores[category] = { correct: 0, wrong: 0 };

  let isCorrect = false;
  if (currentQuestion?.type?.toLowerCase()?.includes("multiple")) {
    const match = correctAns.match(/^[A-Z]\)/);
    const correctLetter = match ? match[0][0].toUpperCase() : "";
    const correctText = correctAns.replace(/^[A-Z]\)/, "").trim().toUpperCase();
    const userUp = userAns.toUpperCase();
    isCorrect = userUp.startsWith(correctLetter) || userUp === correctText;
  } else {
    isCorrect = await checkWithGemini(userAns, correctAns);
  }

  if (isCorrect) scores[category].correct++;
  else scores[category].wrong++;
  updateScores();

  document.getElementById("results").textContent = `Q: ${
    currentQuestion?.parsed_question || ""
  }\nCorrect: ${correctAns}\nYour Answer: ${userAns || "(none)"}\n${
    isCorrect ? "✅ Correct!" : "❌ Wrong!"
  }`;

  const answerInput = document.getElementById("answer");
  if (answerInput) answerInput.disabled = true;
  waitingForNext = true;
}

function nextQuestion() {
  document.getElementById("results").textContent = "";
  const answerInput = document.getElementById("answer");
  if (answerInput) {
    answerInput.value = "";
    answerInput.disabled = true;
  }
  const answerSection = document.getElementById("answer-section");
  if (answerSection) answerSection.style.display = "none";
  buzzed = false;
  waitingForNext = false;

  const selectedCats = getSelectedCategories();
  const pool = allQuestions.filter((q) => selectedCats.includes(q.category));
  if (!pool.length) {
    document.getElementById("question").textContent =
      "No questions in selected categories!";
    return;
  }
  currentQuestion = pool[Math.floor(Math.random() * pool.length)];
  const questionType = currentQuestion.type || "Unknown";
  const fullText = `TYPE: ${questionType}\nCATEGORY: ${currentQuestion.category}\n\n${currentQuestion.parsed_question}`;
  showQuestion(fullText);
}

// Robust page-init: works whether or not DOMContentLoaded already fired
async function initPage() {
  console.log("initPage() called. document.readyState:", document.readyState);
  await loadQuestions();
  updateScores();
}

if (document.readyState === "loading") {
  window.addEventListener("DOMContentLoaded", initPage);
} else {
  // DOMContentLoaded already fired -> call immediately
  initPage();
}

// Start button only checks API key and begins the game
document.getElementById("start").addEventListener("click", async () => {
  const ok = await initGemini();
  if (!ok) return;
  nextQuestion();
});

document.getElementById("submit").addEventListener("click", submitAnswer);
document.getElementById("answer").addEventListener("keydown", (e) => {
  if (e.key === "Enter") {
    e.preventDefault();
    submitAnswer();
  }
});

document.addEventListener("keydown", (e) => {
  if (e.code === "Space") {
    if (document.activeElement?.id === "answer") return;
    e.preventDefault();
    buzz();
  }
});
