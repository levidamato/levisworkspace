const quizDataUrl = "../data/quizzes/presidents.json";
const root = document.querySelector("#quiz-root");

let quiz;
let currentQuestionIndex = 0;
let score = 0;
let answeredCurrentQuestion = false;

async function loadQuiz() {
  try {
    const response = await fetch(quizDataUrl);

    if (!response.ok) {
      throw new Error(`Quiz request failed with status ${response.status}`);
    }

    quiz = await response.json();
    renderIntro();
  } catch (error) {
    root.innerHTML = `
      <p class="error">The quiz could not be loaded.</p>
      <p>${error.message}</p>
    `;
  }
}

function renderIntro() {
  root.innerHTML = `
    <h1 class="quiz-title">${escapeHtml(quiz.title)}</h1>
    <p class="quiz-dek">${escapeHtml(quiz.dek)}</p>
    <div class="meta-row">
      <span>${escapeHtml(quiz.series)}</span>
      <span>${quiz.questionCount} questions</span>
      <span>${escapeHtml(quiz.category)}</span>
    </div>
    <p>
      This demo reads the quiz from JSON, the same format that could be served
      from a CMS or internal endpoint on a production website.
    </p>
    <div class="actions">
      <button class="primary-button" type="button" data-start>Start quiz</button>
    </div>
  `;

  root.querySelector("[data-start]").addEventListener("click", renderQuestion);
}

function renderQuestion() {
  answeredCurrentQuestion = false;
  const question = quiz.questions[currentQuestionIndex];
  const choicesMarkup = question.choices
    .map((choice) => {
      return `
        <button class="choice" type="button" data-choice-id="${choice.id}">
          <strong>${choice.id.toUpperCase()}.</strong> ${escapeHtml(choice.text)}
        </button>
      `;
    })
    .join("");

  root.innerHTML = `
    <div class="meta-row">
      <span class="progress">
        Question ${currentQuestionIndex + 1} of ${quiz.questions.length}
      </span>
      <span>Score: ${score}/${quiz.questions.length}</span>
    </div>
    <h2 class="question-text">${escapeHtml(question.prompt)}</h2>
    <div class="choices">${choicesMarkup}</div>
    <div data-feedback></div>
  `;

  root.querySelectorAll("[data-choice-id]").forEach((button) => {
    button.addEventListener("click", () => handleAnswer(button, question));
  });
}

function handleAnswer(button, question) {
  if (answeredCurrentQuestion) {
    return;
  }

  answeredCurrentQuestion = true;
  const selectedChoiceId = button.dataset.choiceId;
  const isCorrect = selectedChoiceId === question.correctChoiceId;

  if (isCorrect) {
    score += 1;
  }

  root.querySelectorAll("[data-choice-id]").forEach((choiceButton) => {
    const choiceId = choiceButton.dataset.choiceId;
    choiceButton.disabled = true;

    if (choiceId === question.correctChoiceId) {
      choiceButton.classList.add("correct");
    } else if (choiceId === selectedChoiceId) {
      choiceButton.classList.add("incorrect");
    }
  });

  renderFeedback(question, isCorrect);
}

function renderFeedback(question, isCorrect) {
  const feedback = root.querySelector("[data-feedback]");
  const nextButtonLabel =
    currentQuestionIndex === quiz.questions.length - 1 ? "See score" : "Next question";

  feedback.innerHTML = `
    <div class="feedback ${isCorrect ? "correct" : "incorrect"}">
      <strong>${isCorrect ? "Correct!" : "Not quite."}</strong>
      <p>${escapeHtml(question.explanation)}</p>
    </div>
    <div class="actions">
      <button class="primary-button" type="button" data-next>${nextButtonLabel}</button>
    </div>
  `;

  feedback.querySelector("[data-next]").addEventListener("click", () => {
    currentQuestionIndex += 1;

    if (currentQuestionIndex >= quiz.questions.length) {
      renderResults();
      return;
    }

    renderQuestion();
  });
}

function renderResults() {
  const percentage = Math.round((score / quiz.questions.length) * 100);

  root.innerHTML = `
    <p class="eyebrow">${escapeHtml(quiz.series)}</p>
    <h1 class="quiz-title">Your score</h1>
    <p class="score">${score}/${quiz.questions.length}</p>
    <p>You answered ${percentage}% of the questions correctly.</p>
    <div class="actions">
      <button class="primary-button" type="button" data-restart>Retake quiz</button>
      <button class="secondary-button" type="button" data-review>Review questions</button>
    </div>
  `;

  root.querySelector("[data-restart]").addEventListener("click", () => {
    currentQuestionIndex = 0;
    score = 0;
    renderQuestion();
  });

  root.querySelector("[data-review]").addEventListener("click", renderReview);
}

function renderReview() {
  const reviewMarkup = quiz.questions
    .map((question, index) => {
      const answer = question.choices.find((choice) => choice.id === question.correctChoiceId);

      return `
        <section class="feedback">
          <strong>${index + 1}. ${escapeHtml(question.prompt)}</strong>
          <p>Correct answer: ${answer.id.toUpperCase()}. ${escapeHtml(answer.text)}</p>
          <p>${escapeHtml(question.explanation)}</p>
        </section>
      `;
    })
    .join("");

  root.innerHTML = `
    <h1 class="quiz-title">Answer key</h1>
    ${reviewMarkup}
    <div class="actions">
      <button class="primary-button" type="button" data-restart>Retake quiz</button>
    </div>
  `;

  root.querySelector("[data-restart]").addEventListener("click", () => {
    currentQuestionIndex = 0;
    score = 0;
    renderQuestion();
  });
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

loadQuiz();
