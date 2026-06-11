/**
 * Tests for server/src/services/aiAssistant.ts — specifically the offline
 * fallback path that is activated when no AI API key is configured.
 *
 * We mock the aiClient module so that `hasAI` is always false and `aiClient`
 * is always null, regardless of what keys may be present in .env.  This makes
 * every test deterministic and fully offline.
 */

// ─── Mock the AI client BEFORE importing chatWithAssistant ───────────────────
// jest.mock hoisting puts this before any imports, so the aiAssistant module
// receives a null client and hasAI=false when it first loads.
jest.mock('../services/aiClient', () => ({
  aiClient: null,
  hasAI: false,
  AI_MODEL: 'mock-model',
  aiProvider: 'fallback',
  aiStatus: () => ({ enabled: false, provider: 'fallback', model: null }),
}));

import { chatWithAssistant, type ChatMessage, type AssistantResponse } from '../services/aiAssistant';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function msg(content: string): ChatMessage[] {
  return [{ role: 'user', content }];
}

function assertGoodResponse(res: AssistantResponse) {
  expect(res.content).toBeDefined();
  expect(res.content.trim().length).toBeGreaterThan(30);
  expect(Array.isArray(res.sources)).toBe(true);
  expect(typeof res.flaggedForEscalation).toBe('boolean');
}

// ─── Keyword-matched fallback responses ───────────────────────────────────────

describe('chatWithAssistant: fallback (no AI key)', () => {
  it('returns a non-empty answer for an OPT unemployment days question', async () => {
    const res = await chatWithAssistant(msg('How many unemployment days am I allowed on OPT?'));
    assertGoodResponse(res);
    expect(res.content).toMatch(/90/);
  });

  it('returns an answer for H1B lottery process questions', async () => {
    const res = await chatWithAssistant(msg('How does the H1B lottery process work? When should I apply?'));
    assertGoodResponse(res);
    expect(res.content.toLowerCase()).toMatch(/lottery|h1b/i);
  });

  it('returns CPT guidance for internship questions', async () => {
    const res = await chatWithAssistant(msg('Can I do a CPT internship in my first semester?'));
    assertGoodResponse(res);
    expect(res.content.toLowerCase()).toMatch(/cpt/i);
  });

  it('handles getting laid off on OPT question', async () => {
    const res = await chatWithAssistant(msg('I got laid off from my OPT job — what do I do?'));
    assertGoodResponse(res);
    expect(res.content.toLowerCase()).toMatch(/dso|opt|unemployment/i);
  });

  it('handles STEM OPT extension eligibility question', async () => {
    const res = await chatWithAssistant(msg('Am I eligible for the 24 month STEM OPT extension?'));
    assertGoodResponse(res);
    expect(res.content).toMatch(/24/);
  });

  it('returns grace period information', async () => {
    const res = await chatWithAssistant(msg('What is the 60 day grace period after OPT ends?'));
    assertGoodResponse(res);
    expect(res.content).toMatch(/60/);
  });

  it('returns salary negotiation tips', async () => {
    const res = await chatWithAssistant(msg('How do I negotiate my salary at a job offer?'));
    assertGoodResponse(res);
    expect(res.content.toLowerCase()).toMatch(/salary|negotiat/i);
  });

  it('returns cap-exempt employer guidance', async () => {
    const res = await chatWithAssistant(msg('Can I work at a university cap exempt without winning the H1B lottery?'));
    assertGoodResponse(res);
    expect(res.content.toLowerCase()).toMatch(/cap.exempt|university|nonprofit/i);
  });

  it('returns a generic fallback for unrecognised questions', async () => {
    const res = await chatWithAssistant(msg('What is the best pizza topping?'));
    assertGoodResponse(res);
    // Generic fallback contains onboarding guidance for F1/OPT topics
    expect(res.content.toLowerCase()).toMatch(/opt|h1b|f1forge|visa|f1/i);
  });

  it('does not flag generic fallback answers for escalation', async () => {
    const res = await chatWithAssistant(msg('What is the best pizza topping?'));
    expect(res.flaggedForEscalation).toBe(false);
  });

  it('returns sources for keyword-matched OPT answers', async () => {
    const res = await chatWithAssistant(msg('How many OPT unemployment days are allowed?'));
    expect(res.sources.length).toBeGreaterThan(0);
  });

  it('handles empty conversation array gracefully', async () => {
    const res = await chatWithAssistant([]);
    assertGoodResponse(res);
  });

  it('uses only the last message for keyword matching', async () => {
    const messages: ChatMessage[] = [
      { role: 'user', content: 'Tell me about TN visa' },
      { role: 'assistant', content: 'Sure, what specifically?' },
      { role: 'user', content: 'What OPT unemployment days limit applies?' },
    ];
    const res = await chatWithAssistant(messages);
    expect(res.content).toMatch(/90/);
  });

  it('returns sources array (possibly empty) for every response', async () => {
    const res = await chatWithAssistant(msg('Tell me about SEVIS reporting requirements'));
    expect(Array.isArray(res.sources)).toBe(true);
  });
});
