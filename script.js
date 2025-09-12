const QUESTION_URL =
  "https://raw.githubusercontent.com/tornadofury0/National-Science-Bowl-Questions/refs/heads/main/all_questions.json";

let questions = [];
let currentQuestion = null;
let typingInterval = null;
let geminiApiKey = "";
let timeLeft = 0;
let timerId = null;
let buzzed = false;
let waitingForNext = false;

// Per-category score tracking
let scores = {};

async function initGemini() {
  geminiApiKey = prompt("Enter your Gemini API key:");
}

async function loadQuestions() {
  const res = await fetch(QUESTION_URL);
  const data = await res.json();
  // only use non-bonus questions
  questions = data.questions.filter((q) => q.bonus === false);
}

function updateScores() {
  const scoresDiv = document.getElementById("scores");
  let html = "<h3>Scores by Category</h3>";
  for (const [cat, s] of Object.entries(scores)) {
    html += `<div>${cat}: ✅ ${s.correct} | ❌ ${s.wrong}</div>`;
  }
  scoresDiv.innerHTML = html;
}

function showQuestion(q) {
  const qDiv = document.getElementById("question");
  qDiv.textContent = "";
  const speed = parseInt(document.getElementById("speed").value) || 50;
  let i = 0;
  typingInterval = setInterval(() => {
    if (i < q.length) {
      qDiv.textContent += q[i];
      i++;
    } else {
      clearInterval(typingInterval);
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
  timerId = setInterval(() => {
    timeLeft--;
    updateTimer();
    if (timeLeft <= 0) {
      clearInterval(timerId);
      onEnd();
    }
  }, 1000);
}

function updateTimer() {
  const tDiv = document.getElementById("timer");
  tDiv.textContent = "⏱ " + timeLeft;
}

function buzz() {
  if (waitingForNext) {
    nextQuestion();
    return;
  }
  if (buzzed || !currentQuestion) return;
  buzzed = true;
  clearInterval(timerId);
  document.getElementById("answer-section").style.display = "block";
  document.getElementById("answer").disabled = false;
  document.getElementById("answer").focus();
  startTimer(8, () => {
    submitAnswer();
  });
}

async function checkWithGemini(userAns, correctAns) {
  if (!geminiApiKey) return false;
  const prompt = `
  The user was asked a question.
  The correct answer is: "${correctAns}"
  The user answered: "${userAns}"
  Is the user's answer correct? Respond only with "Yes" or "No".
  `;
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
  clearInterval(timerId);
  const userAns = document.getElementById("answer").value.trim();
  const correctAns = currentQuestion.parsed_answer || "";
  const category = currentQuestion.category || "Unknown";
  if (!scores[category]) scores[category] = { correct: 0, wrong: 0 };

  let isCorrect = false;
  if (currentQuestion.type.toLowerCase().startsWith("multiple")) {
    const correctLetter = correctAns.trim().toUpperCase()[0];
    const correctText = correctAns
      .slice(correctAns.indexOf(")") + 1)
      .trim()
      .toUpperCase();
    isCorrect =
      userAns.toUpperCase().startsWith(correctLetter) ||
      userAns.toUpperCase() === correctText;
  } else {
    isCorrect = await checkWithGemini(userAns, correctAns);
  }

  if (isCorrect) {
    scores[category].correct++;
  } else {
    scores[category].wrong++;
  }
  updateScores();

  document.getElementById("results").textContent = `Q: ${
    currentQuestion.parsed_question
  }\nCorrect: ${correctAns}\nYour Answer: ${userAns || "(none)"}\n${
    isCorrect ? "✅ Correct!" : "❌ Wrong!"
  }`;

  document.getElementById("answer").disabled = true;
  waitingForNext = true;
}

function nextQuestion() {
  document.getElementById("results").textContent = "";
  document.getElementById("answer").value = "";
  document.getElementById("answer").disabled = true;
  document.getElementById("answer-section").style.display = "none";
  buzzed = false;
  waitingForNext = false;
  if (questions.length === 0) {
    document.getElementById("question").textContent = "No more questions!";
    return;
  }
  currentQuestion =
    questions[Math.floor(Math.random() * questions.length)];
  showQuestion(
    "CATEGORY: " +
      currentQuestion.category +
      "\n\n" +
      currentQuestion.parsed_question
  );
}

document.getElementById("start").addEventListener("click", async () => {
  await initGemini();
  await loadQuestions();
  updateScores();
  nextQuestion();
});

document.getElementById("submit").addEventListener("click", submitAnswer);
document
  .getElementById("answer")
  .addEventListener("keydown", (e) => {
    if (e.key === "Enter") submitAnswer();
  });

document.addEventListener("keydown", (e) => {
  if (e.code === "Space") {
    e.preventDefault();
    buzz();
  }
});
