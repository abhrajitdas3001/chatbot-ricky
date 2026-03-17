'use client'

import { useState, useCallback, useRef } from 'react'

const VOICE_STORAGE_KEY = 'ai-chat-tts-voice'
const DEFAULT_VOICE = 'alloy'
const CACHE_MAX_SIZE = 10

export const TTS_VOICES = [
  { id: 'alloy', label: 'Alloy' },
  { id: 'ash', label: 'Ash' },
  { id: 'ballad', label: 'Ballad' },
  { id: 'cedar', label: 'Cedar' },
  { id: 'coral', label: 'Coral' },
  { id: 'echo', label: 'Echo' },
  { id: 'fable', label: 'Fable' },
  { id: 'marin', label: 'Marin' },
  { id: 'nova', label: 'Nova' },
  { id: 'onyx', label: 'Onyx' },
  { id: 'sage', label: 'Sage' },
  { id: 'shimmer', label: 'Shimmer' },
  { id: 'verse', label: 'Verse' },
]

function cleanTextForSpeech(text) {
  return text
    .replace(/\[.*?\]\(.*?\)/g, '')
    .replace(/```[\s\S]*?```/g, '')
    .replace(/`[^`]+`/g, '')
    .replace(/\*\*[^*]+\*\*/g, (m) => m.replace(/\*\*/g, ''))
    .replace(/\*[^*]+\*/g, (m) => m.replace(/\*/g, ''))
    .replace(/^#+\s/gm, '')
    .trim()
}

function speakWithWebSpeech(text, onStart, onEnd, onError) {
  if (typeof window === 'undefined' || !window.speechSynthesis) return null
  const utterance = new SpeechSynthesisUtterance(text)
  utterance.rate = 0.95
  utterance.pitch = 1
  utterance.volume = 1
  utterance.onstart = onStart
  utterance.onend = onEnd
  utterance.onerror = onError
  window.speechSynthesis.speak(utterance)
  return utterance
}

function getStoredVoice() {
  if (typeof window === 'undefined') return DEFAULT_VOICE
  try {
    const stored = localStorage.getItem(VOICE_STORAGE_KEY)
    if (stored && TTS_VOICES.some((v) => v.id === stored)) return stored
  } catch (_) {}
  return DEFAULT_VOICE
}

export function useSpeechSynthesis() {
  const [voice, setVoiceState] = useState(() =>
    typeof window !== 'undefined' ? getStoredVoice() : DEFAULT_VOICE
  )
  const [isSpeaking, setIsSpeaking] = useState(false)
  const [speakingMessageId, setSpeakingMessageId] = useState(null)
  const [isSupported] = useState(
    typeof window !== 'undefined' &&
      ('speechSynthesis' in window || typeof fetch !== 'undefined')
  )
  const [error, setError] = useState(null)
  const abortControllerRef = useRef(null)
  const audioRef = useRef(null)
  const utteranceRef = useRef(null)
  const cacheRef = useRef(new Map())

  const setVoice = useCallback((newVoice) => {
    const id = typeof newVoice === 'string' ? newVoice : newVoice?.id
    if (id && TTS_VOICES.some((v) => v.id === id)) {
      setVoiceState(id)
      try {
        localStorage.setItem(VOICE_STORAGE_KEY, id)
      } catch (_) {}
    }
  }, [])

  const stop = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
      abortControllerRef.current = null
    }
    if (audioRef.current) {
      audioRef.current.pause()
      audioRef.current.currentTime = 0
      audioRef.current = null
    }
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      window.speechSynthesis.cancel()
    }
    utteranceRef.current = null
    setIsSpeaking(false)
    setSpeakingMessageId(null)
  }, [])

  const fetchAndCache = useCallback(
    async (cleanText, messageId) => {
      const cacheKey = messageId ?? cleanText.slice(0, 100)
      const res = await fetch('/api/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: cleanText, voice }),
      })
      if (!res.ok) return null
      const blob = await res.blob()
      const cache = cacheRef.current
      if (cache.size >= CACHE_MAX_SIZE) {
        const firstKey = cache.keys().next().value
        if (firstKey !== undefined) cache.delete(firstKey)
      }
      cache.set(cacheKey, blob)
      return blob
    },
    [voice]
  )

  const preload = useCallback(
    (text, messageId = null) => {
      if (!text || typeof window === 'undefined') return
      const cleanText = cleanTextForSpeech(text)
      if (!cleanText) return
      const cacheKey = messageId ?? cleanText.slice(0, 100)
      if (cacheRef.current.has(cacheKey)) return
      fetchAndCache(cleanText, messageId)
    },
    [fetchAndCache]
  )

  const speak = useCallback(
    async (text, messageId = null) => {
      if (!text || typeof window === 'undefined') return

      stop()
      setError(null)
      setSpeakingMessageId(messageId)

      const cleanText = cleanTextForSpeech(text)
      if (!cleanText) return

      const onEnd = () => {
        setIsSpeaking(false)
        setSpeakingMessageId(null)
      }

      const onError = () => {
        setIsSpeaking(false)
        setSpeakingMessageId(null)
      }

      const cacheKey = messageId ?? cleanText.slice(0, 100)
      let blob = cacheRef.current.get(cacheKey)

      try {
        if (!blob) {
          const controller = new AbortController()
          abortControllerRef.current = controller

          const res = await fetch('/api/tts', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              text: cleanText,
              voice,
            }),
            signal: controller.signal,
          })

          abortControllerRef.current = null

          if (!res.ok) {
            const data = await res.json().catch(() => ({}))
            throw new Error(data.error || `TTS failed: ${res.status}`)
          }

          blob = await res.blob()
          const cache = cacheRef.current
          if (cache.size >= CACHE_MAX_SIZE) {
            const firstKey = cache.keys().next().value
            if (firstKey !== undefined) cache.delete(firstKey)
          }
          cache.set(cacheKey, blob)
        }

        const url = URL.createObjectURL(blob)
        const audio = new Audio(url)

        audioRef.current = audio

        audio.onplay = () => setIsSpeaking(true)
        audio.onended = () => {
          URL.revokeObjectURL(url)
          audioRef.current = null
          onEnd()
        }
        audio.onerror = () => {
          URL.revokeObjectURL(url)
          audioRef.current = null
          setError('Failed to play audio')
          onError()
        }

        await audio.play()
      } catch (err) {
        if (err.name === 'AbortError') return
        setError(err.message || 'TTS failed')
        setIsSpeaking(false)
        setSpeakingMessageId(null)

        const fallback =
          typeof window !== 'undefined' && 'speechSynthesis' in window
        if (fallback) {
          utteranceRef.current = speakWithWebSpeech(
            cleanText,
            () => setIsSpeaking(true),
            onEnd,
            onError
          )
        }
      }
    },
    [stop, voice]
  )

  return {
    speak,
    stop,
    preload,
    isSpeaking,
    speakingMessageId,
    isSupported,
    error,
    voice,
    setVoice,
  }
}
