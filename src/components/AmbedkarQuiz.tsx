'use client';

import { useState } from 'react';
import { ArrowRight, BookOpen, Check, RotateCcw, X } from 'lucide-react';
import './ambedkar-quiz.css';

type Question = {
  prompt: string;
  options: string[];
  answer: number;
  explanation: string;
  documentId: string;
  page: number;
  sourceTitle: string;
};

type Quiz = { id: string; title: string; description: string; questions: Question[] };

const quizzes: Quiz[] = [
  {
    id: 'early-life', title: 'Early life', description: 'A brief look at Ambedkar’s own account of his childhood.',
    questions: [
      { prompt: 'Where does Ambedkar say he was born?', options: ['Mhow, Indore', 'Satara', 'Bombay', 'Nagpur'], answer: 0, explanation: 'In his autobiographical account, Ambedkar writes that he was born at Mhow, Indore.', documentId: 'VOL-17-III', page: 137, sourceTitle: 'Dr. Babasaheb Ambedkar: Writings and Speeches, Vol. 17, Part III' },
      { prompt: 'What rank did his father hold in the army?', options: ['Captain', 'Subedar', 'Major', 'Havildar'], answer: 1, explanation: 'The same passage states that his father held the rank of Subedar.', documentId: 'VOL-17-III', page: 137, sourceTitle: 'Dr. Babasaheb Ambedkar: Writings and Speeches, Vol. 17, Part III' },
    ],
  },
  {
    id: 'writings', title: 'Writings', description: 'Find publication details in the collected writings.',
    questions: [
      { prompt: 'The title page of Annihilation of Caste says it includes a reply to whom?', options: ['Mahatma Gandhi', 'M. K. Gandhi’s editor', 'S. K. Bole', 'Madan Mohan Malaviya'], answer: 0, explanation: 'The title page reads “With a Reply to Mahatma Gandhi.”', documentId: 'VOL-01', page: 38, sourceTitle: 'Dr. Babasaheb Ambedkar: Writings and Speeches, Vol. 1' },
      { prompt: 'Which publication year is listed for Annihilation of Castes in the Vol. 3 bibliography?', options: ['1927', '1932', '1936', '1944'], answer: 2, explanation: 'The bibliography lists Annihilation of Castes as published by New Book Co., Bombay, in 1936.', documentId: 'VOL-03', page: 490, sourceTitle: 'Dr. Babasaheb Ambedkar: Writings and Speeches, Vol. 3' },
    ],
  },
  {
    id: 'public-life', title: 'Public life', description: 'Explore source passages on equality and political representation.',
    questions: [
      { prompt: 'According to the source heading, what did the Mahad Satyagraha seek to establish?', options: ['A new municipality', 'Human rights', 'A separate electorate', 'A public library'], answer: 1, explanation: 'The heading describes the Mahad Satyagraha as “not for water but to establish human rights.”', documentId: 'VOL-17-I', page: 24, sourceTitle: 'Dr. Babasaheb Ambedkar: Writings and Speeches, Vol. 17, Part I' },
      { prompt: 'How many reserved seats in Provincial Legislatures are listed in the Poona Pact text?', options: ['78', '125', '148', '175'], answer: 2, explanation: 'The reproduced text of the Poona Pact gives a total of 148 seats.', documentId: 'VOL-01', page: 444, sourceTitle: 'Dr. Babasaheb Ambedkar: Writings and Speeches, Vol. 1' },
    ],
  },
];

export default function AmbedkarQuiz({ onOpenSource }: { onOpenSource: (documentId: string, page: number) => void }) {
  const [quizId, setQuizId] = useState(quizzes[0].id);
  const [questionIndex, setQuestionIndex] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const [checked, setChecked] = useState(false);
  const [score, setScore] = useState(0);
  const quiz = quizzes.find((item) => item.id === quizId) ?? quizzes[0];
  const question = quiz.questions[questionIndex];
  const completed = questionIndex === quiz.questions.length - 1 && checked;

  function chooseQuiz(id: string) {
    setQuizId(id); setQuestionIndex(0); setSelected(null); setChecked(false); setScore(0);
  }
  function checkAnswer() {
    if (selected === null || checked) return;
    if (selected === question.answer) setScore((current) => current + 1);
    setChecked(true);
  }
  function nextQuestion() {
    if (completed) { setQuestionIndex(0); setSelected(null); setChecked(false); setScore(0); return; }
    setQuestionIndex((current) => current + 1); setSelected(null); setChecked(false);
  }

  return <div className="ambedkar-quiz">
    <div className="quiz-intro">
      <p className="eyebrow">SOURCE-BASED KNOWLEDGE CHECK</p>
      <h3>Read history <em>at the source.</em></h3>
      <p>Choose a short quiz. Each answer is checked against a page in the archive, with a direct link to the original PDF page.</p>
      <div className="quiz-source-note"><BookOpen size={16}/><span>Questions are drawn from the indexed Ambedkar collection.</span></div>
    </div>
    <div className="quiz-panel">
      <div className="quiz-tabs" role="tablist" aria-label="Choose an Ambedkar quiz">
        {quizzes.map((item) => <button key={item.id} role="tab" aria-selected={quizId === item.id} className={quizId === item.id ? 'active' : ''} onClick={() => chooseQuiz(item.id)}>{item.title}</button>)}
      </div>
      <div className="quiz-question">
        <div className="quiz-progress"><span>{quiz.description}</span><strong>{String(questionIndex + 1).padStart(2, '0')} / {String(quiz.questions.length).padStart(2, '0')}</strong></div>
        <h4>{question.prompt}</h4>
        <div className="quiz-options" role="group" aria-label="Answer options">
          {question.options.map((option, index) => {
            const isCorrect = checked && index === question.answer;
            const isWrong = checked && selected === index && index !== question.answer;
            return <button key={option} className={`${selected === index ? 'selected' : ''} ${isCorrect ? 'correct' : ''} ${isWrong ? 'wrong' : ''}`} aria-pressed={selected === index} disabled={checked} onClick={() => setSelected(index)}>
              <span>{String.fromCharCode(65 + index)}</span>{option}{isCorrect ? <Check size={17}/> : isWrong ? <X size={17}/> : null}
            </button>;
          })}
        </div>
        {checked && <div className={`quiz-feedback ${selected === question.answer ? 'is-correct' : 'is-wrong'}`} aria-live="polite">
          <strong>{selected === question.answer ? 'Correct' : 'Not quite'}</strong>
          <p>{question.explanation}</p>
          <div className="quiz-citation"><span>{question.sourceTitle} · PDF page {question.page}</span><button className="text-link" onClick={() => onOpenSource(question.documentId, question.page)}>View source <ArrowRight size={15}/></button></div>
        </div>}
        <div className="quiz-actions">
          {!checked ? <button className="primary-button" disabled={selected === null} onClick={checkAnswer}>Check answer <ArrowRight size={16}/></button> : <button className="primary-button" onClick={nextQuestion}>{completed ? 'Try again' : 'Next question'} {completed ? <RotateCcw size={16}/> : <ArrowRight size={16}/>}</button>}
          {checked && <span className="quiz-score">Score {score} / {questionIndex + 1}</span>}
        </div>
      </div>
    </div>
  </div>;
}
