import { createOpenAI } from '@ai-sdk/openai'
import { generateText } from 'ai'
import { NextResponse } from 'next/server'

const openai = createOpenAI({
  apiKey: process.env.openai_api_key,
})

export async function POST(req) {
  try {
    const { message } = await req.json()
    const { text } = await generateText({
      model: openai('gpt-4.1'),
      system:
        'You are a helpful assistant that generates concise titles for conversations.',
      prompt: `Use this first message from a conversation to generate concise title
        without any quotes (max 5 words): "${message}"`,
    })

    const title = (text || '').trim().replace(/^["']|["']$/g, '')
    return NextResponse.json({ title: title || 'New Chat' })
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to generate title' },
      { status: 500 },
    )
  }
}
