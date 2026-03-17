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
import { useRouter } from 'next/navigation'
import { useLiveQuery } from 'dexie-react-hooks'
import { SendHorizontal, MinusCircle, Mic, MicOff } from 'lucide-react'
import ChatThread from '@/components/ChatThread'
import { useSpeechRecognition } from '@/hooks/useSpeechRecognition'
import { useSpeechSynthesis } from '@/hooks/useSpeechSynthesis'
import '../styles/page.css'
import Sidebar from '@/components/Sidebar'

export default function Chat() {
  const router = useRouter()
  const chatThreadRef = useRef(null)
  const activeChatIdRef = useRef(null)

  const [currentChatId, setCurrentChatId] = useState(null)
  const [input, setInput] = useState('')

  const {
    speak,
    stop: stopSpeaking,
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
      setCurrentChatId(chatId)
    },
    [router],
  )

  const initializeNewChat = useCallback(async () => {
    const chatId = await createChat()
    navigateToChat(chatId)
  }, [navigateToChat])

  const setActiveChat = useCallback(
    async (requestedChatId = null) => {
      if (fetchedChats && fetchedChats?.length === 0) {
        return initializeNewChat()
      }

      if (requestedChatId) navigateToChat(Number(requestedChatId))
      else navigateToChat(fetchedChats?.[0].id)
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
      if (title) {
        await updateChatTitle(targetChatId, title)
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
    if (!fetchedChats) return

    if (!currentChatId) {
      const chatId = new URLSearchParams(window.location.search).get('chatId')
      setActiveChat(chatId)
    }

    const loadChatMessages = async () => {
      try {
        const loadedMessages = await getChatMessages(currentChatId)
        setMessages(loadedMessages)
      } catch (error) {
        console.error('Failed to load messages', error)
      }
    }

    loadChatMessages()
  }, [fetchedChats, currentChatId, setActiveChat, setMessages])

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

    if (isFirstMessage) generateTitle(text, chatId)

    setInput('')
    await sendMessage({ text })
  }

  const handleDeleteChat = useCallback(async () => {
    if (!currentChatId) return

    if (window.confirm('Are you sure you want to delete this chat?')) {
      await deleteChat(currentChatId)
      router.push('/')
      setCurrentChatId(null)
    }
  }, [currentChatId, router])

  if (!fetchedChats) {
    return <div className="loading-state">Loading...</div>
  }

  return (
    <div className="chat-container">
      <Sidebar
        fetchedChats={fetchedChats}
        currentChatId={currentChatId}
        setCurrentChatId={setCurrentChatId}
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
