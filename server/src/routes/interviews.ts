import { Router, Response } from 'express';
import { z } from 'zod';
import { findAll, findOne, insert, update } from '../db/store';
import { authenticate, AuthRequest } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { conductMockInterview, getInterviewQuestion } from '../services/aiAssistant';

const router = Router();
router.use(authenticate);

const createSessionSchema = z.object({
  roleType: z.enum(['SWE','Data','PM','General']),
  difficulty: z.enum(['easy','medium','hard']),
  interviewType: z.enum(['behavioral','technical','system_design']),
});

const submitAnswerSchema = z.object({
  question: z.string(),
  answer: z.string().min(1),
});

router.post('/sessions', validate(createSessionSchema), (req: AuthRequest, res: Response) => {
  const { roleType, difficulty, interviewType } = req.body;
  const session = insert('interview_sessions', {
    user_id: req.user!.id, role_type: roleType, difficulty, interview_type: interviewType, completed: false,
  });
  const question = getInterviewQuestion(roleType, interviewType, []);
  res.status(201).json({ session, question });
});

router.get('/sessions', (req: AuthRequest, res: Response) => {
  const sessions = findAll<any>('interview_sessions', s => s.user_id === req.user!.id)
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .map(s => {
      const answers = findAll<any>('interview_answers', a => a.session_id === s.id);
      const scores = answers.map(a => a.score).filter(Boolean);
      return {
        ...s,
        answer_count: answers.length,
        avg_score: scores.length ? scores.reduce((a: number, b: number) => a + b, 0) / scores.length : null,
      };
    });
  res.json(sessions);
});

router.get('/sessions/:id', (req: AuthRequest, res: Response) => {
  const session = findOne<any>('interview_sessions', s => s.id === req.params.id && s.user_id === req.user!.id);
  if (!session) return res.status(404).json({ error: 'Not found' });
  const answers = findAll<any>('interview_answers', a => a.session_id === req.params.id)
    .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
  res.json({ session, answers });
});

router.post('/sessions/:id/answer', validate(submitAnswerSchema), async (req: AuthRequest, res: Response) => {
  const session = findOne<any>('interview_sessions', s => s.id === req.params.id && s.user_id === req.user!.id);
  if (!session) return res.status(404).json({ error: 'Session not found' });
  if (session.completed) return res.status(400).json({ error: 'Session already completed' });

  const { question, answer } = req.body;
  const evaluation = await conductMockInterview({ question, answer, interviewType: session.interview_type, roleType: session.role_type });

  const answerRecord = insert('interview_answers', {
    session_id: req.params.id, question, answer,
    score: evaluation.score,
    feedback: evaluation.feedback,
  });

  const allAnswers = findAll<any>('interview_answers', a => a.session_id === req.params.id);
  const isComplete = allAnswers.length >= 5;
  let nextQuestion: string | null = null;

  if (!isComplete) {
    const used = allAnswers.map(a => a.question);
    nextQuestion = getInterviewQuestion(session.role_type, session.interview_type, used);
  } else {
    const scores = allAnswers.map(a => a.score).filter(Boolean);
    const avg = scores.length ? Math.round(scores.reduce((a: number, b: number) => a + b, 0) / scores.length) : 5;
    update('interview_sessions', req.params.id, { completed: true, overall_score: avg });
  }

  res.json({ answer: answerRecord, nextQuestion, sessionComplete: isComplete });
});

router.get('/progress', (req: AuthRequest, res: Response) => {
  const sessions = findAll<any>('interview_sessions', s => s.user_id === req.user!.id && s.completed);
  res.json(sessions.slice(-12).map(s => ({ week: s.created_at, avg_score: s.overall_score, sessions: 1 })));
});

export default router;
