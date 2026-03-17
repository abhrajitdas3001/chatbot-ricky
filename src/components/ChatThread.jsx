import { useEffect } from 'react'
import Image from 'next/image'
import { User, Volume2, Square } from 'lucide-react'
import ReactMarkdown from 'react-markdown'

const getMessageContent = (message) => {
  if (message.content) return message.content
  if (message.parts) {
    return message.parts
      .filter((p) => p.type === 'text')
      .map((p) => p.text)
      .join('')
  }
  return ''
}

const Message = ({
  role,
  content,
  messageId,
  onSpeak,
  onPreloadTts,
  speakingMessageId,
  stopSpeaking,
  ttsSupported,
  isLastMessage,
  isStreaming,
}) => {
  const isThisMessageSpeaking = speakingMessageId === messageId

  useEffect(() => {
    const canPreload = role === 'assistant' && content && onPreloadTts
    const isComplete = !isLastMessage || !isStreaming
    if (canPreload && isComplete) {
      onPreloadTts(content, messageId)
    }
  }, [role, content, messageId, onPreloadTts, isLastMessage, isStreaming])

  const handleSpeak = () => {
    if (isThisMessageSpeaking) {
      stopSpeaking()
    } else {
      onSpeak?.(content, messageId)
    }
  }
  const canSpeak = content && !(isLastMessage && isStreaming)

  return (
    <div className="message-wrapper">
      {role === 'user' ? (
        <div className="user-avatar">
          <User className="user-avatar-icon" strokeWidth={1.5} />
        </div>
      ) : (
        <div className="ai-avatar">
          <Image
            src="/ricky-avatar.jpg"
            alt="Ricky"
            width={48}
            height={48}
            className="ai-avatar-img"
            unoptimized
          />
        </div>
      )}
      <div className="message-content-wrapper">
        <span className="message-sender">
          {role === 'user' ? 'You' : 'Ricky'}
        </span>
        <div
          className={`message-content ${
            role === 'user' ? 'user-message-bg' : 'ai-message-bg'
          }`}
        >
          <div className="markdown-content">
            <ReactMarkdown>{content || ''}</ReactMarkdown>
          </div>
          {role === 'assistant' && ttsSupported && canSpeak && (
            <button
              type="button"
              onClick={handleSpeak}
              className={`speak-button ${isThisMessageSpeaking ? 'speak-button-active' : ''}`}
              aria-label={isThisMessageSpeaking ? 'Stop speaking' : 'Read aloud'}
              title={isThisMessageSpeaking ? 'Stop' : 'Read aloud'}
            >
              {isThisMessageSpeaking ? (
                <Square className="speak-icon" strokeWidth={2} />
              ) : (
                <Volume2 className="speak-icon" strokeWidth={1.5} />
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

const ChatThread = ({
  messages,
  status,
  chatThreadRef,
  onSpeak,
  onPreloadTts,
  speakingMessageId,
  stopSpeaking,
  ttsSupported,
}) => {
  const isStreaming = status === 'streaming' || status === 'submitted'
  const welcomeMessage = {
    role: 'assistant',
    content:
      "👋 Hey! I'm Ricky—software engineer, food lover, and sports nut. Whether it's code, cricket, or a good Biryani recipe, I'm here to help. What's on your mind?",
  }

  return (
    <div ref={chatThreadRef} className="message-container">
      {messages.length === 0 ? (
        <Message
          {...welcomeMessage}
          onSpeak={onSpeak}
          onPreloadTts={onPreloadTts}
          speakingMessageId={speakingMessageId}
          stopSpeaking={stopSpeaking}
          ttsSupported={ttsSupported}
          messageId="welcome"
          isLastMessage
          isStreaming={false}
        />
      ) : (
        messages.map((message, index) => (
          <Message
            key={message.id ?? index}
            role={message.role}
            content={message.content ?? getMessageContent(message)}
            messageId={message.id ?? index}
            onSpeak={onSpeak}
            onPreloadTts={onPreloadTts}
            speakingMessageId={speakingMessageId}
            stopSpeaking={stopSpeaking}
            ttsSupported={ttsSupported}
            isLastMessage={index === messages.length - 1}
            isStreaming={isStreaming}
          />
        ))
      )}

      {status === 'submitted' && (
        <div className="thinking-row">
          <div className="ai-avatar">
            <Image
              src="/ricky-avatar.jpg"
              alt="Ricky"
              width={48}
              height={48}
              className="ai-avatar-img"
              unoptimized
            />
          </div>
          <div className="typing-indicator">
            <span></span>
            <span></span>
            <span></span>
          </div>
        </div>
      )}
    </div>
  )
}

export default ChatThread
