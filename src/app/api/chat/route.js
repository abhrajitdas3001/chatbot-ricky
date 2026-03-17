import { createOpenAI } from '@ai-sdk/openai'
import { streamText, convertToModelMessages, stepCountIs } from 'ai'
import { tavilySearch } from '@tavily/ai-sdk'
import { RICKY_SYSTEM_PROMPT } from '@/lib/ricky-prompt'

export const maxDuration = 60

export async function POST(req) {
  const body = await req.json()
  let messages = body?.messages ?? []

  // Convert legacy { role, content } format to UIMessage { role, parts } format
  messages = messages.map((m) =>
    m.parts
      ? m
      : { ...m, parts: [{ type: 'text', text: m.content ?? '' }] }
  )

  const openai = createOpenAI({
    apiKey: process.env.openai_api_key,
  })

  const result = streamText({
    model: openai('gpt-4.1'),
    system: RICKY_SYSTEM_PROMPT,
    messages: await convertToModelMessages(messages),
    tools: {
      webSearch: tavilySearch({
        maxResults: 5,
        searchDepth: 'basic',
      }),
    },
    stopWhen: stepCountIs(5),
  })

  return result.toUIMessageStreamResponse()
}
