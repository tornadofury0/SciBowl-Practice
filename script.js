let questions = [];
let currentQuestion = null;
let buzzed = false;
let waitingForNext = false;
let typingJob = null;
let answerTimerJob = null;
let fiveSecTimerJob = null;

let scores = {}; // {category: {correct:0, wrong:0}}

async function loadQuestions() {
  const res = await fetch("https://raw.githubusercontent.com/tornadofury0/National-Science-Bowl-Questions/refs/heads/main/all_questions.json");
  const data = await res.json();
  // filter out bonus questions
  questions = (data.questions || []).filter(q => q.bonus === false);
}

function updateScoreboard() {
  const board = document.getElementById("scoreboard");
  board.innerHTML = "";
  for (const cat of Object.keys(scores)) {
    const s = scores[cat];
    const div = document.createElement("div");
    div.textContent = `${cat} → ✅ ${s.correct} | ❌ ${s.wrong}`;
    board.appendChild(div);
  }
}

function startQuestion() {
  waitingForNext = false;
  buzzed = false;
  document.getElementById("answerInput").disabled = true;
  document.getElementById("answerInput").value = "";
  document.getElementById("resultBox").innerText = "";
  document.getElementById("timerBox").innerText = "";

  if (answerTimerJob) clearInterval(answerTimerJob);
  if (fiveSecTimerJob) clearInterval(fiveSecTimerJob);

  currentQuestion = questions[Math.floor(Math.random() * questions.length)];
  if (!scores[currentQuestion.category]) {
    scores[currentQuestion.category] = { correct: 0, wrong: 0 };
  }

  // slowly display question
  const text = `CATEGORY: ${currentQuestion.category}\n\n${currentQuestion.parsed_question}`;
  const box = document.getElementById("questionBox");
  box.innerText = "";
  let i = 0;
  const speed = parseInt(document.getElementById("speedInput").value, 10);

  typingJob = setInterval(() => {
    if (i < text.length) {
      box.innerText += text[i];
      i++;
    } else {
      clearInterval(typingJob);
      startFiveSecondTimer();
    }
  }, speed);
}

function startFiveSecondTimer() {
  let timeLeft = 5;
  const timerBox = document.getElementById("timerBox");
  timerBox.innerText = `Buzz time: ${timeLeft}`;
  fiveSecTimerJob = setInterval(() => {
    timeLeft--;
    if (timeLeft > 0) {
      timerBox.innerText = `Buzz time: ${timeLeft}`;
    } else {
      clearInterval(fiveSecTimerJob);
      timerBox.innerText = "Time’s up! No buzz.";
      waitingForNext = true;
    }
  }, 1000);
}

function buzz() {
  if (waitingForNext || buzzed) return;
  buzzed = true;
  clearInterval(fiveSecTimerJob);
  document.getElementById("answerInput").disabled = false;
  document.getElementById("answerInput").focus();
  startAnswerTimer();
}

function startAnswerTimer() {
  let timeLeft = 8;
  const timerBox = document.getElementById("timerBox");
  timerBox.innerText = `Answer time: ${timeLeft}`;
  answerTimerJob = setInterval(() => {
    timeLeft--;
    if (timeLeft > 0) {
      timerBox.innerText = `Answer time: ${timeLeft}`;
    } else {
      clearInterval(answerTimerJob);
      checkAnswer(); // auto-submit
    }
  }, 1000);
}

function checkAnswer() {
  if (!currentQuestion) return;
  clearInterval(answerTimerJob);

  const userAns = document.getElementById("answerInput").value.trim();
  const correctAns = currentQuestion.parsed_answer;
  let isCorrect = false;

  if (currentQuestion.type.toLowerCase().startsWith("multiple")) {
    const correctLetter = correctAns.trim().toUpperCase()[0];
    const correctText = correctAns.slice(correctAns.indexOf(")") + 1).trim().toUpperCase();
    isCorrect = userAns.toUpperCase().startsWith(correctLetter) || userAns.toUpperCase() === correctText;
  } else {
    isCorrect = userAns.toLowerCase() === correctAns.toLowerCase();
  }

  const resBox = document.getElementById("resultBox");
  if (isCorrect) {
    scores[currentQuestion.category].correct++;
    resBox.innerText = `✅ Correct!\nYour Answer: ${userAns}\nCorrect Answer: ${correctAns}`;
  } else {
    scores[currentQuestion.category].wrong++;
    resBox.innerText = `❌ Wrong!\nYour Answer: ${userAns}\nCorrect Answer: ${correctAns}`;
  }

  updateScoreboard();
  waitingForNext = true;
}

document.getElementById("submitBtn").addEventListener("click", checkAnswer);

document.addEventListener("keydown", (e) => {
  if (e.code === "Space") {
    e.preventDefault();
    if (waitingForNext) {
      startQuestion();
    } else {
      buzz();
    }
  }
});

loadQuestions().then(() => {
  startQuestion();
});
