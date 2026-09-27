const assert = require('assert');

// Simulate the game view logic
function createGameSimulator() {
  let questions = [];
  let currentQ = 0;
  let levelInfo = null;
  let modeInfo = null;
  let showedQuestions = [];

  function showQuestion(index) {
    if (!questions[index]) return;
    currentQ = index;
    showedQuestions.push({ level: levelInfo, questionIndex: index, qId: questions[index].id });
  }

  function handleLoadedData(data) {
    const isNewLevel = levelInfo !== data.level || modeInfo !== data.mode;
    if (isNewLevel) {
      currentQ = 0;
    }

    questions = data.questions || [];
    levelInfo = data.level;
    modeInfo = data.mode;

    showQuestion(Math.min(currentQ, Math.max(questions.length - 1, 0)));
  }

  function userNavigate(index) {
    showQuestion(index);
  }

  function prevQuestion() {
    if (currentQ > 0) {
      showQuestion(currentQ - 1);
    }
  }

  function nextQuestion() {
    if (currentQ < questions.length - 1) {
      showQuestion(currentQ + 1);
    }
  }

  function isPrevDisabled() {
    return currentQ <= 0 || questions.length === 0;
  }

  function isNextDisabled() {
    return currentQ >= questions.length - 1 || questions.length === 0;
  }

  return {
    handleLoadedData,
    userNavigate,
    prevQuestion,
    nextQuestion,
    isPrevDisabled,
    isNextDisabled,
    getCurrentQ: () => currentQ,
    getLevelInfo: () => levelInfo,
    getShowedQuestions: () => showedQuestions,
  };
}

// TEST CASES
const sim = createGameSimulator();

// 1. Level 1 starts with 5 questions
sim.handleLoadedData({
  level: 1,
  mode: 'simulation',
  questions: [{ id: 1 }, { id: 2 }, { id: 3 }, { id: 4 }, { id: 5 }],
});
assert.strictEqual(sim.getCurrentQ(), 0, 'Level 1 must start at question 0 (Soal 1)');
assert.strictEqual(sim.isPrevDisabled(), true, 'Previous button must be disabled at question 0');
assert.strictEqual(sim.isNextDisabled(), false, 'Next button must be enabled at question 0');

// 2. Next question navigation
sim.nextQuestion();
assert.strictEqual(sim.getCurrentQ(), 1, 'Next button navigates to question index 1');
assert.strictEqual(sim.isPrevDisabled(), false, 'Previous button must now be enabled');
assert.strictEqual(sim.isNextDisabled(), false, 'Next button must remain enabled');

// 3. Navigate back to previous question
sim.prevQuestion();
assert.strictEqual(sim.getCurrentQ(), 0, 'Previous button navigates back to question index 0');
assert.strictEqual(sim.isPrevDisabled(), true, 'Previous button must be disabled again at index 0');

// 4. Boundary test: Calling prev at index 0 does not go below 0
sim.prevQuestion();
assert.strictEqual(sim.getCurrentQ(), 0, 'Previous at index 0 must not change index');

// 5. User moves to question 5 (index 4)
sim.userNavigate(4);
assert.strictEqual(sim.getCurrentQ(), 4, 'User navigated to question 5 (index 4)');
assert.strictEqual(sim.isPrevDisabled(), false, 'Previous button enabled at index 4');
assert.strictEqual(sim.isNextDisabled(), true, 'Next button must be disabled at last question (index 4)');

// 6. Boundary test: Calling next at last question stays at last question
sim.nextQuestion();
assert.strictEqual(sim.getCurrentQ(), 4, 'Next at index 4 must not change index');

// 7. User reconnects or polls within the SAME level (Level 1)
sim.handleLoadedData({
  level: 1,
  mode: 'simulation',
  questions: [{ id: 1 }, { id: 2 }, { id: 3 }, { id: 4 }, { id: 5 }],
});
assert.strictEqual(sim.getCurrentQ(), 4, 'Within same level, current question must be preserved at index 4');

// 8. Level transitions to Level 2
sim.handleLoadedData({
  level: 2,
  mode: 'simulation',
  questions: [{ id: 6 }, { id: 7 }, { id: 8 }, { id: 9 }, { id: 10 }],
});
assert.strictEqual(sim.getCurrentQ(), 0, 'Level 2 must reset to question 0 (Soal 1), NOT stay at index 4!');
assert.strictEqual(sim.isPrevDisabled(), true, 'Previous button disabled on reset to question 0');
assert.strictEqual(sim.isNextDisabled(), false, 'Next button enabled on reset to question 0');

// 9. User moves to question 3 (index 2) in Level 2
sim.userNavigate(2);
assert.strictEqual(sim.getCurrentQ(), 2, 'User navigated to question 3 (index 2) in Level 2');

// 10. Level transitions to Level 3
sim.handleLoadedData({
  level: 3,
  mode: 'simulation',
  questions: [{ id: 11 }, { id: 12 }, { id: 13 }, { id: 14 }, { id: 15 }],
});
assert.strictEqual(sim.getCurrentQ(), 0, 'Level 3 must reset to question 0 (Soal 1), NOT stay at index 2!');

// 11. Mode changes from simulation to official
sim.userNavigate(3);
sim.handleLoadedData({
  level: 3,
  mode: 'official',
  questions: [{ id: 26 }, { id: 27 }, { id: 28 }, { id: 29 }, { id: 30 }],
});
assert.strictEqual(sim.getCurrentQ(), 0, 'Mode change must also reset to question 0 (Soal 1)!');

console.log('ALL GAME NAVIGATION CROSS-CHECK TESTS PASSED SUCCESSFULLY!');
