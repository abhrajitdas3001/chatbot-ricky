# Ricky – AI Chat

A personalised AI chat app built with Next.js and OpenAI. Ricky is a conversational assistant with a distinct persona—a 39-year-old software engineer from Kolkata, now in London—who loves sports, cooking, and tech.

## Features

- **Chat with Ricky** – AI assistant with a custom persona (see [RICKY_PERSONA.md](./RICKY_PERSONA.md))
- **Web search** – Uses Tavily for real-time answers on general knowledge and current events
- **Chat persistence** – Conversations stored locally in IndexedDB (Dexie)
- **Voice input** – Speech-to-text via the Web Speech API
- **Text-to-speech** – Read aloud responses using OpenAI TTS with 13 voice options
- **Multiple chats** – Separate threads with auto-generated titles

## Tech Stack

- **Framework**: Next.js 15 (App Router)
- **AI**: Vercel AI SDK, OpenAI GPT-4.1, Tavily (web search)
- **Database**: Dexie (IndexedDB) for local storage
- **Speech**: Web Speech API (input), OpenAI TTS (output)

## Setup

### 1. Install dependencies

```bash
npm install
```

### 2. Environment variables

Create `.env.local` in the project root:

| Variable | Required | Description |
|----------|----------|-------------|
| `openai_api_key` | Yes | OpenAI API key for chat and TTS |
| `TAVILY_API_KEY` | No | Tavily key for web search |

Get keys:
- **OpenAI**: [platform.openai.com](https://platform.openai.com/api-keys)
- **Tavily**: [app.tavily.com](https://app.tavily.com/) (free tier)

### 3. Run the app

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Project Structure

```
src/
├── app/
│   ├── api/
│   │   ├── chat/
│   │   │   ├── route.js       # Chat + web search (streaming)
│   │   │   └── simple/route.js # Simple JSON API (non-streaming)
│   │   ├── generate-title/route.js
│   │   └── tts/route.js       # OpenAI TTS
│   ├── page.js                # Main chat page
│   └── layout.js
├── components/
│   ├── ChatThread.jsx          # Message list + TTS
│   └── Sidebar.jsx            # Chat list + voice picker
├── hooks/
│   ├── useSpeechRecognition.js  # Voice input
│   └── useSpeechSynthesis.js    # Voice output
└── lib/
    ├── db.js                  # Dexie persistence
    └── ricky-prompt.js         # Ricky system prompt (shared)
```

## API for External Products

A simple JSON endpoint is available for non-streaming use:

**`POST /api/chat/simple`**

| Request | Description |
|---------|-------------|
| `{ "message": "Hello" }` | Single message, get one reply |
| `{ "messages": [{ "role": "user", "content": "..." }, { "role": "assistant", "content": "..." }] }` | Full conversation history |

**Response:** `{ "reply": "..." }`

CORS is enabled (`Access-Control-Allow-Origin: *`) for cross-origin requests.

```bash
curl -X POST http://localhost:3000/api/chat/simple \
  -H "Content-Type: application/json" \
  -d '{"message": "What is your favourite curry?"}'
```

## How It Works

- **Chat**: Messages are sent to `/api/chat`, which uses the AI SDK with streaming and Tavily web search.
- **Persistence**: Chats and messages are saved in IndexedDB. Titles are generated from the first message.
- **Voice input**: Microphone button uses the Web Speech API for speech-to-text.
- **TTS**: Speak button uses the OpenAI TTS API. Voice selection is in the sidebar.

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start dev server (Turbopack) |
| `npm run build` | Production build |
| `npm run start` | Run production server |
| `npm run lint` | Run ESLint |

## Customising Ricky

- **Persona**: Edit the system prompt in `src/lib/ricky-prompt.js`
- **Persona reference**: See [RICKY_PERSONA.md](./RICKY_PERSONA.md) for details and expansion ideas
