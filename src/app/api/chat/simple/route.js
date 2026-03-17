import { createOpenAI } from '@ai-sdk/openai'
import { generateText } from 'ai'
import { tavilySearch } from '@tavily/ai-sdk'
import { NextResponse } from 'next/server'
import { RICKY_SYSTEM_PROMPT } from '@/lib/ricky-prompt'

export const maxDuration = 60

function corsHeaders(response) {
  response.headers.set('Access-Control-Allow-Origin', '*')
  response.headers.set('Access-Control-Allow-Methods', 'POST, OPTIONS')
  response.headers.set('Access-Control-Allow-Headers', 'Content-Type')
}

export async function OPTIONS() {
  const res = new NextResponse(null, { status: 204 })
  corsHeaders(res)
  return res
}

export async function POST(req) {
  try {
    const body = await req.json()
    let messages = []

    if (body?.message) {
      messages = [{ role: 'user', content: body.message }]
    } else if (Array.isArray(body?.messages)) {
      messages = body.messages
    } else {
      const res = NextResponse.json(
        { error: 'Provide "message" (string) or "messages" (array of {role, content})' },
        { status: 400 }
      )
      corsHeaders(res)
      return res
    }

    const openai = createOpenAI({
      apiKey: process.env.openai_api_key,
    })

    const { text } = await generateText({
      model: openai('gpt-4.1'),
      system: RICKY_SYSTEM_PROMPT,
      messages,
      tools: {
        webSearch: tavilySearch({
          maxResults: 5,
          searchDepth: 'basic',
        }),
      },
      maxSteps: 5,
    })

    const response = NextResponse.json({ reply: text })
    corsHeaders(response)
    return response
  } catch (error) {
    console.error('Chat simple error:', error)
    const res = NextResponse.json(
      { error: error?.message || 'Failed to get reply' },
      { status: 500 }
    )
    corsHeaders(res)
    return res
  }
}
