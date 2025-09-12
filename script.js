let questions = [];
let categories = [];
let currentQuestion = null;
let score = { correct: 0, wrong: 0 };
let timeLeft = 0;
let timerInterval = null;
let apiKey = "";

const URL = "https://raw.githubusercontent.com/tornadofury0/National-Science-Bowl-Questions/refs/heads/main/all_questions.json";

async function loadQuestions() {
  const res = await fetch(URL);
  const data = await res.json();
  questions = data.questions || [];
  categories = [...new Set(questions.map(q => q.category || "Unknown"))].sort();
  const select = document.getElementById("categorySelect");
  categories.forEach(cat => {
    const opt = document.createElement("option");
    opt.value = cat;
    opt.textContent = cat;
    select.appendChild(opt);
  });
}

function startQuestion() {
  stopTimer();
  const selected = [...document.getElementById("categorySelect").selectedOptions].map(o => o.value);
  if (selected.length === 0) {
    document.getElementById("result").textContent = "⚠ Please select at least one category";
    return;
  }
  const filtered = questions.filter(q => selected.includes(q.category));
  if (filtered.length === 0) {
    document.getElementById("result").textContent = "⚠ No questions in selected categories";
    return;
  }
  currentQuestion = filtered[Math.floor(Math.random() * filtered.length)];
  document.getElementById("questionBox").textContent =
    `CATEGORY: ${currentQuestion.category}\n\n${currentQuestion.parsed_question}`;
  document.getElementById("answerInput").value = "";
  document.getElementById("result").textContent = "";
  startTimer(5);
}

function submitAnswer() {
  if (!currentQuestion) return;
  stopTimer();
  const userAns = document.getElementById("answerInput").value.trim();
  const correctAns = currentQuestion.parsed_answer;
  let isCorrect = false;

  if (!userAns) {
    isCorrect = false;
    document.getElementById("result").textContent = "❌ No answer given";
  } else if (currentQuestion.type.toLowerCase().startsWith("multiple")) {
    const correctLetter = correctAns.trim().toUpperCase()[0];
    const correctText = correctAns.slice(correctAns.indexOf(")") + 1).trim().toUpperCase();
    isCorrect = userAns.toUpperCase().startsWith(correctLetter) || userAns.toUpperCase() === correctText;
  } else if (apiKey) {
    checkWithGemini(userAns, correctAns).then(ok => {
      finishAnswer(ok, correctAns, userAns, true);
    });
    return;
  } else {
    // fallback: simple case-insensitive match
    isCorrect = userAns.toLowerCase() === correctAns.toLowerCase();
  }

  finishAnswer(isCorrect, correctAns, userAns, false);
}

function finishAnswer(isCorrect, correctAns, userAns, usedAI) {
  if (isCorrect) {
    score.correct++;
    document.getElementById("result").textContent =
      `✅ Correct! (${usedAI ? "Checked by AI" : "Direct"})\nAnswer: ${correctAns}`;
  } else {
    score.wrong++;
    document.getElementById("result").textContent =
      `❌ Wrong!\nCorrect Answer: ${correctAns}\nYour Answer: ${userAns || "(none)"}`;
  }
  document.getElementById("score").textContent =
    `✅ Correct: ${score.correct} | ❌ Wrong: ${score.wrong}`;
}

function startTimer(seconds) {
  timeLeft = seconds;
  updateTimer();
  timerInterval = setInterval(() => {
    timeLeft--;
    updateTimer();
    if (timeLeft <= 0) {
      clearInterval(timerInterval);
      submitAnswer();
    }
  }, 1000);
}

function stopTimer() {
  if (timerInterval) clearInterval(timerInterval);
}

function updateTimer() {
  const timer = document.getElementById("timer");
  timer.textContent = `⏱ ${timeLeft}`;
  timer.style.color = timeLeft > 2 ? "#ffcc00" : "red";
}

async function checkWithGemini(userAns, correctAns) {
  const prompt = `
The correct answer is: "${correctAns}"
The user answered: "${userAns}"
Is the user's answer correct? Respond only "Yes" or "No".`;
  try {
    const res = await fetch("https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=" + apiKey, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
    });
    const data = await res.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || "";
    return text.toLowerCase().startsWith("yes");
  } catch (e) {
    console.error("Gemini API error", e);
    return false;
  }
}

// save API key
document.getElementById("saveKeyBtn").addEventListener("click", () => {
  apiKey = document.getElementById("apiKeyInput").value.trim();
  if (apiKey) {
    alert("API Key saved locally. It won't be uploaded.");
  }
});

document.getElementById("startBtn").addEventListener("click", startQuestion);
document.getElementById("submitBtn").addEventListener("click", submitAnswer);
loadQuestions();
