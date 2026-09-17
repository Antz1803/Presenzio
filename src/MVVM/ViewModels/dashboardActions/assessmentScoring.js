export function buildAnswerRows(questions, answers, answerSimilarity) {
  return questions.map((question) => {
    const answer = String(answers?.[question.id] ?? "");
    const multipleChoice = question.question_type === "multiple_choice";
    const expected = Boolean(question.expected_output?.trim());
    const similarity = expected ? answerSimilarity(answer, question.expected_output) : 0;
    const correct = multipleChoice ? answer === question.correct_answer : expected && similarity === 1;
    const partial = !multipleChoice && expected && similarity >= 0.75 && similarity < 1;
    const near = Number(question.near_match_score_percent);
    const incorrect = Number(question.incorrect_score_percent);
    const multiplier = multipleChoice ? (correct ? 1 : 0) : correct ? 1 : partial
      ? (Number.isFinite(near) ? Math.max(0, Math.min(100, near)) : 50) / 100
      : (Number.isFinite(incorrect) ? Math.max(0, Math.min(100, incorrect)) : 0) / 100;
    return { question_id: question.id, answer, is_correct: multipleChoice || expected ? correct : null, points_earned: Number(question.points || 0) * multiplier };
  });
}
