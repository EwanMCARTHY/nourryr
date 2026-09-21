import type { Handler } from '@netlify/functions';

export const handler: Handler = async () => {
  const hasKey = Boolean(process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY);
  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ hasApiKey: hasKey }),
  };
};
