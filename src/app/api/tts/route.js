import { NextResponse } from 'next/server'

const OPENAI_SPEECH_URL = 'https://api.openai.com/v1/audio/speech'
const MAX_CHARS = 4096

const VALID_VOICES = [
  'alloy',
  'ash',
  'ballad',
  'cedar',
  'coral',
  'echo',
  'fable',
  'marin',
  'nova',
  'onyx',
  'sage',
  'shimmer',
  'verse',
]

export async function POST(req) {
  try {
    const apiKey = process.env.openai_api_key

    if (!apiKey) {
      return NextResponse.json(
        { error: 'openai_api_key is not configured in .env.local' },
        { status: 500 }
      )
    }

    const { text, voice = 'alloy' } = await req.json()

    if (!text || typeof text !== 'string') {
      return NextResponse.json(
        { error: 'Text is required' },
        { status: 400 }
      )
    }

    const cleanText = text.trim()
    if (!cleanText) {
      return NextResponse.json(
        { error: 'Text cannot be empty' },
        { status: 400 }
      )
    }

    const voiceId = VALID_VOICES.includes(voice) ? voice : 'alloy'
    const textToSend =
      cleanText.length > MAX_CHARS
        ? cleanText.slice(0, MAX_CHARS)
        : cleanText

    const res = await fetch(OPENAI_SPEECH_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini-tts',
        input: textToSend,
        voice: voiceId,
      }),
    })

    if (!res.ok) {
      const errBody = await res.text()
      console.error('OpenAI TTS error:', res.status, errBody)
      return NextResponse.json(
        { error: `OpenAI TTS error: ${res.status}` },
        { status: 502 }
      )
    }

    const audioBuffer = await res.arrayBuffer()
    return new NextResponse(audioBuffer, {
      headers: {
        'Content-Type': 'audio/mpeg',
        'Cache-Control': 'no-store',
      },
    })
  } catch (error) {
    console.error('TTS route error:', error)
    return NextResponse.json(
      { error: 'Failed to generate speech' },
      { status: 500 }
    )
  }
}
