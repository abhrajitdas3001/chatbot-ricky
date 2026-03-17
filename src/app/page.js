'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useChat } from '@ai-sdk/react'
import {
  db,
  createChat,
  getChatMessages,
  saveMessage,
  updateChatTitle,
  deleteChat,
  getChat,
} from '../lib/db'
import { useRouter, useSearchParams } from 'next/navigation'
import { useLiveQuery } from 'dexie-react-hooks'
import { SendHorizontal, MinusCircle, Mic, MicOff } from 'lucide-react'
import ChatThread from '@/components/ChatThread'
import { useSpeechRecognition } from '@/hooks/useSpeechRecognition'
import { useSpeechSynthesis } from '@/hooks/useSpeechSynthesis'
import '../styles/page.css'
import Sidebar from '@/components/Sidebar'

export default function Chat() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const chatThreadRef = useRef(null)
  const activeChatIdRef = useRef(null)
  const lastFetchedChatsRef = useRef(null)

  const chatIdFromUrl = searchParams.get('chatId')
  const currentChatId = chatIdFromUrl ? Number(chatIdFromUrl) : null
  const [input, setInput] = useState('')

  const {
    speak,
    stop: stopSpeaking,
    preload,
    isSpeaking,
    speakingMessageId,
    isSupported: ttsSupported,
    error: ttsError,
    voice,
    setVoice,
  } = useSpeechSynthesis()
  const {
    isListening,
    isSupported: sttSupported,
    toggleListening,
    error: speechError,
  } = useSpeechRecognition(
    (transcript) => setInput(transcript),
    () => setInput('')
  )

  const fetchedChats = useLiveQuery(() =>
    db.chats.orderBy('createdAt').reverse().toArray(),
  )

  const chatsToShow = fetchedChats ?? lastFetchedChatsRef.current ?? []
  if (fetchedChats) lastFetchedChatsRef.current = fetchedChats

  const currentChat = useLiveQuery(
    () => db.chats.get(Number(currentChatId)),
    [currentChatId],
  )

  const getMessageContent = (msg) => {
    if (msg.content) return msg.content
    if (msg.parts) {
      return msg.parts
        .filter((p) => p.type === 'text')
        .map((p) => p.text)
        .join('')
    }
    return ''
  }

  const {
    messages,
    sendMessage,
    setMessages,
    status,
  } = useChat({
    onFinish: async ({ message, isAbort, isError }) => {
      if (isAbort || isError) return
      const chatId = activeChatIdRef.current ?? currentChatId
      if (chatId && message?.role === 'assistant') {
        const content = getMessageContent(message)
        if (content) {
          await saveMessage(chatId, message.role, content)
        }
      }
    },
  })

  const navigateToChat = useCallback(
    (chatId) => {
      activeChatIdRef.current = chatId
      router.push(`/?chatId=${chatId}`)
    },
    [router],
  )

  const initializeNewChat = useCallback(async () => {
    const chatId = await createChat()
    navigateToChat(chatId)
  }, [navigateToChat])

  const setActiveChat = useCallback(
    async (requestedChatId = null) => {
      const chats = fetchedChats ?? lastFetchedChatsRef.current ?? []
      if (chats.length === 0) {
        return initializeNewChat()
      }

      if (requestedChatId) navigateToChat(Number(requestedChatId))
      else navigateToChat(chats[0]?.id)
    },
    [navigateToChat, initializeNewChat, fetchedChats],
  )

  const generateTitle = async (message, chatId) => {
    const targetChatId = chatId ?? activeChatIdRef.current ?? currentChatId
    if (!targetChatId) return

    try {
      const response = await fetch('/api/generate-title', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message }),
      })

      if (!response.ok) throw new Error('Failed to generate title')

      const { title } = await response.json()
      const cleanTitle = title?.trim()?.replace(/^["']|["']$/g, '') || ''
      if (cleanTitle) {
        await updateChatTitle(targetChatId, cleanTitle)
      }
    } catch (error) {
      console.error('Error generating title', error)
      const fallbackTitle = message.slice(0, 50) + (message.length > 50 ? '...' : '')
      if (fallbackTitle) {
        await updateChatTitle(targetChatId, fallbackTitle)
      }
    }
  }

  useEffect(() => {
    if (fetchedChats === undefined && lastFetchedChatsRef.current == null) return

    if (!currentChatId) {
      setActiveChat(chatIdFromUrl)
      return
    }

    if (status === 'streaming' || status === 'submitted') return

    const loadChatMessages = async () => {
      const chatIdToLoad = currentChatId
      try {
        const loadedMessages = await getChatMessages(chatIdToLoad)
        if (activeChatIdRef.current !== chatIdToLoad) return
        const formatted = loadedMessages.map((m) => ({
          id: m.id,
          role: m.role,
          content: m.content,
        }))
        setMessages(formatted)
      } catch (error) {
        console.error('Failed to load messages', error)
      }
    }

    loadChatMessages()
  }, [fetchedChats, currentChatId, chatIdFromUrl, status, setActiveChat, setMessages])

  useEffect(() => {
    activeChatIdRef.current = currentChatId
  }, [currentChatId])

  useEffect(() => {
    if (chatThreadRef.current && messages.length > 0) {
      chatThreadRef.current.scrollTop = chatThreadRef.current.scrollHeight
    }
  }, [messages, currentChatId])

  const handleChatSubmit = async (e) => {
    e.preventDefault()

    const text = input.trim()
    if (!text) return

    let chatId = currentChatId
    if (!chatId) {
      chatId = await createChat()
      navigateToChat(chatId)
    }
    activeChatIdRef.current = chatId

    const existingMessages = await getChatMessages(chatId)
    const isFirstMessage = existingMessages.length === 0

    await saveMessage(chatId, 'user', text)

    if (isFirstMessage) await generateTitle(text, chatId)

    setInput('')
    await sendMessage({ text })
  }

  const handleDeleteChat = useCallback(async () => {
    if (!currentChatId) return

    if (window.confirm('Are you sure you want to delete this chat?')) {
      await deleteChat(currentChatId)
      router.push('/')
    }
  }, [currentChatId, router])

  const isInitialLoad = fetchedChats === undefined && lastFetchedChatsRef.current == null
  if (isInitialLoad) {
    return <div className="loading-state">Loading...</div>
  }

  return (
    <div className="chat-container">
      <Sidebar
        fetchedChats={chatsToShow}
        currentChatId={currentChatId}
        initializeNewChat={initializeNewChat}
        ttsVoice={voice}
        onTtsVoiceChange={setVoice}
      />
      <div className="chat-main">
        <div className="chat-header">
          <div className="title-group">
            <h1 className="chat-title">{currentChat?.title || 'New Chat'}</h1>
            <button
              onClick={handleDeleteChat}
              className="delete-button"
              aria-label="Delete chat"
            >
              <MinusCircle className="delete-icon" strokeWidth={1.5} />
            </button>
          </div>
        </div>

        <ChatThread
          messages={messages}
          status={status}
          chatThreadRef={chatThreadRef}
          onSpeak={speak}
          onPreloadTts={preload}
          speakingMessageId={speakingMessageId}
          stopSpeaking={stopSpeaking}
          ttsSupported={ttsSupported}
        />

        <div className="input-area">
          {(speechError || ttsError) && (
            <div className="speech-error" role="alert">
              {[speechError, ttsError].filter(Boolean).join(' • ')}
            </div>
          )}
          <form onSubmit={handleChatSubmit} className="input-form">
            {sttSupported && (
              <button
                type="button"
                onClick={toggleListening}
                className={`voice-button ${isListening ? 'voice-button-active' : ''}`}
                aria-label={isListening ? 'Stop listening' : 'Start voice input'}
                title={isListening ? 'Stop listening' : 'Voice input'}
              >
                {isListening ? (
                  <MicOff className="voice-icon" strokeWidth={1.5} />
                ) : (
                  <Mic className="voice-icon" strokeWidth={1.5} />
                )}
              </button>
            )}
            <input
              value={input}
              placeholder="Message Ricky..."
              onChange={(e) => setInput(e.target.value)}
              disabled={status !== 'ready' && status !== undefined}
              className="input-field"
              aria-label="Chat input"
            />
            <button
              type="submit"
              disabled={
                !input.trim() ||
                status === 'submitted' ||
                status === 'streaming'
              }
              className="submit-button"
              aria-label="Send message"
            >
              <SendHorizontal className="submit-icon" strokeWidth={1.5} />
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
