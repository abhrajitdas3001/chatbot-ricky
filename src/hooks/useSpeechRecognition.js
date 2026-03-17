'use client'

import { useState, useEffect, useCallback, useRef } from 'react'

const SpeechRecognition =
  typeof window !== 'undefined' && (window.SpeechRecognition || window.webkitSpeechRecognition)

export function useSpeechRecognition(onResult, onStart) {
  const [isListening, setIsListening] = useState(false)
  const [isSupported, setIsSupported] = useState(false)
  const [error, setError] = useState(null)
  const recognitionRef = useRef(null)

  useEffect(() => {
    setIsSupported(!!SpeechRecognition)
  }, [])

  const startListening = useCallback(() => {
    if (!SpeechRecognition) {
      setError('Speech recognition is not supported in this browser.')
      return
    }

    setError(null)
    onStart?.()
    const recognition = new SpeechRecognition()
    recognition.continuous = true
    recognition.interimResults = true
    recognition.lang = 'en-US'

    recognition.onresult = (event) => {
      const transcript = Array.from(event.results)
        .map((result) => result[0].transcript)
        .join('')
      if (transcript && onResult) {
        onResult(transcript)
      }
    }

    recognition.onerror = (event) => {
      if (event.error === 'no-speech') return
      setError(event.error)
      setIsListening(false)
    }

    recognition.onend = () => {
      setIsListening(false)
    }

    recognition.start()
    recognitionRef.current = recognition
    setIsListening(true)
  }, [onResult, onStart])

  const stopListening = useCallback(() => {
    if (recognitionRef.current) {
      recognitionRef.current.stop()
      recognitionRef.current = null
    }
    setIsListening(false)
  }, [])

  const toggleListening = useCallback(() => {
    if (isListening) {
      stopListening()
    } else {
      startListening()
    }
  }, [isListening, startListening, stopListening])

  return { isListening, isSupported, error, startListening, stopListening, toggleListening }
}
