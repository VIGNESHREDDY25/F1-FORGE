import { Router, Response } from 'express';
import { z } from 'zod';
import { findAll, findOne, insert, update, remove } from '../db/store';
import { authenticate, AuthRequest } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { chatWithAssistant, ChatMessage } from '../services/aiAssistant';
import { aiStatus } from '../services/aiClient';

const router = Router();
router.use(authenticate);

const messageSchema = z.object({
  conversationId: z.string().uuid().optional(),
  message: z.string().min(1).max(2000),
});

router.get('/status', (_req: AuthRequest, res: Response) => {
  const status = aiStatus();
  // `hasOpenAI`/`mode` kept for backward-compat with the existing client.
  res.json({ hasOpenAI: status.enabled, mode: status.provider, ...status });
});

router.get('/conversations', (req: AuthRequest, res: Response) => {
  const convs = findAll<any>('ai_conversations', c => c.user_id === req.user!.id)
    .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())
    .slice(0, 50)
    .map(c => {
      const msgs = findAll<any>('ai_messages', m => m.conversation_id === c.id)
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      return { ...c, last_message: msgs[0]?.content?.slice(0, 80) };
    });
  res.json(convs);
});

router.get('/conversations/:id', (req: AuthRequest, res: Response) => {
  const conv = findOne<any>('ai_conversations', c => c.id === req.params.id && c.user_id === req.user!.id);
  if (!conv) return res.status(404).json({ error: 'Not found' });
  const messages = findAll<any>('ai_messages', m => m.conversation_id === req.params.id)
    .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
  res.json({ ...conv, messages });
});

router.post('/chat', validate(messageSchema), async (req: AuthRequest, res: Response) => {
  const { conversationId, message } = req.body;
  const user = findOne<any>('users', u => u.id === req.user!.id);

  let convId = conversationId;
  if (!convId) {
    const conv = insert('ai_conversations', {
      user_id: req.user!.id,
      title: message.slice(0, 60) + (message.length > 60 ? '...' : ''),
    });
    convId = conv.id;
  } else {
    const conv = findOne<any>('ai_conversations', c => c.id === convId && c.user_id === req.user!.id);
    if (!conv) return res.status(404).json({ error: 'Conversation not found' });
  }

  insert('ai_messages', { conversation_id: convId, role: 'user', content: message });

  const history = findAll<any>('ai_messages', m => m.conversation_id === convId)
    .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
    .map(m => ({ role: m.role, content: m.content }));

  const response = await chatWithAssistant(history as ChatMessage[], { visaType: user?.visa_type, university: user?.university });

  const aiMsg = insert('ai_messages', {
    conversation_id: convId,
    role: 'assistant',
    content: response.content,
    sources: response.sources,
    flagged_for_escalation: response.flaggedForEscalation,
  });

  update('ai_conversations', convId, {});

  res.json({ conversationId: convId, message: aiMsg, flaggedForEscalation: response.flaggedForEscalation });
});

router.delete('/conversations/:id', (req: AuthRequest, res: Response) => {
  const conv = findOne<any>('ai_conversations', c => c.id === req.params.id && c.user_id === req.user!.id);
  if (!conv) return res.status(404).json({ error: 'Not found' });
  remove('ai_conversations', req.params.id);
  findAll<any>('ai_messages', m => m.conversation_id === req.params.id).forEach(m => remove('ai_messages', m.id));
  res.status(204).send();
});

export default router;
