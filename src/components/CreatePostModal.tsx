import { useState } from 'react'
import { motion } from 'framer-motion'
import { X, ChevronLeft, ChevronRight, Sparkles, RefreshCw, Hash, Clock, Loader2 } from 'lucide-react'
import { supabase } from '../lib/supabase'

interface CreatePostModalProps {
  isOpen: boolean
  onClose: () => void
  onSubmit: (postData: { content: string; hashtags: string; platform: string }) => void
  selectedAccountId: string | null
}

interface PostData {
  topic: string
  answers: string[]
  content: string
  hashtags: string[]
}

interface ContentVersion {
  content: string
  timestamp: number
  action: string
}

export const CreatePostModal = ({ isOpen, onClose, onSubmit, selectedAccountId }: CreatePostModalProps) => {
  const [step, setStep] = useState(0)
  const [postData, setPostData] = useState<PostData>({
    topic: '',
    answers: ['', '', ''],
    content: '',
    hashtags: []
  })
  const [contentVersions, setContentVersions] = useState<ContentVersion[]>([])
  const [versionIndex, setVersionIndex] = useState(0)
  const [showVersions, setShowVersions] = useState(false)
  
  // Loading states
  const [isGeneratingQuestions, setIsGeneratingQuestions] = useState(false)
  const [isGeneratingContent, setIsGeneratingContent] = useState(false)
  const [isAdjustingTone, setIsAdjustingTone] = useState(false)
  const [isImprovingClarity, setIsImprovingClarity] = useState(false)
  const [isSuggestingHashtags, setIsSuggestingHashtags] = useState(false)
  
  // Dynamic questions and hashtags from AI
  const [clarifyingQuestions, setClarifyingQuestions] = useState<string[]>([])
  const [suggestedHashtags, setSuggestedHashtags] = useState<string[]>([])
  
  // Error state
  const [error, setError] = useState<string | null>(null)

  if (!isOpen) return null

  const steps = [
    {
      title: 'What do you want to write about?',
      description: 'Share your topic, idea, or question. Be as specific or broad as you like.'
    },
    {
      title: 'Tell us more',
      description: 'Help us understand your perspective with these clarifying questions.'
    },
    {
      title: 'Review & publish',
      description: 'Fine-tune your post and add hashtags to reach the right audience.'
    }
  ]

  // API call functions
  const generateClarifyingQuestions = async () => {
    if (!postData.topic.trim()) return
    
    setIsGeneratingQuestions(true)
    setError(null)
    
    try {
      const { data, error: functionError } = await supabase.functions.invoke('generate-social-post', {
        body: {
          type: 'clarifying-questions',
          topic: postData.topic,
          platform: 'linkedin' // Default to LinkedIn for now
        }
      })

      if (functionError) {
        throw functionError
      }

      if (data.error) {
        throw new Error(data.error)
      }

      if (data.questions && Array.isArray(data.questions)) {
        setClarifyingQuestions(data.questions)
      }
    } catch (err) {
      console.error('Error generating clarifying questions:', err)
      setError(err instanceof Error ? err.message : 'Failed to generate questions')
    } finally {
      setIsGeneratingQuestions(false)
    }
  }

  const generatePostContent = async () => {
    if (!postData.topic.trim() || postData.answers.every(answer => !answer.trim())) return
    
    setIsGeneratingContent(true)
    setError(null)
    
    try {
      const { data, error: functionError } = await supabase.functions.invoke('generate-social-post', {
        body: {
          type: 'generate-post',
          topic: postData.topic,
          answers: postData.answers.filter(answer => answer.trim()),
          platform: 'linkedin' // Default to LinkedIn for now
        }
      })

      if (functionError) {
        throw functionError
      }

      if (data.error) {
        throw new Error(data.error)
      }

      if (data.content) {
        // Save current content as version if it exists
        if (postData.content) {
          const newVersion: ContentVersion = {
            content: postData.content,
            timestamp: Date.now(),
            action: 'Previous version'
          }
          setContentVersions(prev => [newVersion, ...prev])
        }
        
        setPostData(prev => ({ ...prev, content: data.content }))
        setVersionIndex(0)
      }
    } catch (err) {
      console.error('Error generating post content:', err)
      setError(err instanceof Error ? err.message : 'Failed to generate content')
    } finally {
      setIsGeneratingContent(false)
    }
  }

  const adjustTone = async () => {
    if (!postData.content.trim()) return
    
    setIsAdjustingTone(true)
    setError(null)
    
    try {
      const { data, error: functionError } = await supabase.functions.invoke('generate-social-post', {
        body: {
          type: 'adjust-tone',
          topic: postData.topic,
          content: postData.content,
          platform: 'linkedin' // Default to LinkedIn for now
        }
      })

      if (functionError) {
        throw functionError
      }

      if (data.error) {
        throw new Error(data.error)
      }

      if (data.content) {
        // Save current content as version
        const newVersion: ContentVersion = {
          content: postData.content,
          timestamp: Date.now(),
          action: 'Before tone adjustment'
        }
        setContentVersions(prev => [newVersion, ...prev])
        
        setPostData(prev => ({ ...prev, content: data.content }))
        setVersionIndex(0)
      }
    } catch (err) {
      console.error('Error adjusting tone:', err)
      setError(err instanceof Error ? err.message : 'Failed to adjust tone')
    } finally {
      setIsAdjustingTone(false)
    }
  }

  const improveClarity = async () => {
    if (!postData.content.trim()) return
    
    setIsImprovingClarity(true)
    setError(null)
    
    try {
      const { data, error: functionError } = await supabase.functions.invoke('generate-social-post', {
        body: {
          type: 'improve-clarity',
          topic: postData.topic,
          content: postData.content,
          platform: 'linkedin' // Default to LinkedIn for now
        }
      })

      if (functionError) {
        throw functionError
      }

      if (data.error) {
        throw new Error(data.error)
      }

      if (data.content) {
        // Save current content as version
        const newVersion: ContentVersion = {
          content: postData.content,
          timestamp: Date.now(),
          action: 'Before clarity improvement'
        }
        setContentVersions(prev => [newVersion, ...prev])
        
        setPostData(prev => ({ ...prev, content: data.content }))
        setVersionIndex(0)
      }
    } catch (err) {
      console.error('Error improving clarity:', err)
      setError(err instanceof Error ? err.message : 'Failed to improve clarity')
    } finally {
      setIsImprovingClarity(false)
    }
  }

  const suggestHashtags = async () => {
    setIsSuggestingHashtags(true)
    setError(null)
    
    try {
      const { data, error: functionError } = await supabase.functions.invoke('generate-social-post', {
        body: {
          type: 'suggest-hashtags',
          topic: postData.topic,
          content: postData.content || undefined,
          platform: 'linkedin' // Default to LinkedIn for now
        }
      })

      if (functionError) {
        throw functionError
      }

      if (data.error) {
        throw new Error(data.error)
      }

      if (data.hashtags && Array.isArray(data.hashtags)) {
        setSuggestedHashtags(data.hashtags)
      }
    } catch (err) {
      console.error('Error suggesting hashtags:', err)
      setError(err instanceof Error ? err.message : 'Failed to suggest hashtags')
    } finally {
      setIsSuggestingHashtags(false)
    }
  }

  const handleNext = async () => {
    if (step === 0 && !postData.topic.trim()) {
      return // Don't proceed without topic
    }
    
    if (step === 0) {
      // Generate clarifying questions when moving from step 1 to step 2
      await generateClarifyingQuestions()
    } else if (step === 1) {
      // Generate content when moving from step 2 to step 3
      await generatePostContent()
    }
    
    if (step < steps.length - 1) {
      setStep(step + 1)
    }
  }

  const handleBack = () => {
    if (step > 0) {
      setStep(step - 1)
    }
  }

  const handleSubmit = () => {
    onSubmit({
      ...postData,
      accountId: selectedAccountId
    })
    onClose()
  }

  const handleAIAssist = async (action: string) => {
    switch (action) {
      case 'tone':
        await adjustTone()
        break
      case 'clarity':
        await improveClarity()
        break
      case 'hashtags':
        await suggestHashtags()
        break
    }
  }

  const toggleHashtag = (hashtag: string) => {
    setPostData(prev => ({
      ...prev,
      hashtags: prev.hashtags.includes(hashtag)
        ? prev.hashtags.filter(h => h !== hashtag)
        : [...prev.hashtags, hashtag]
    }))
  }

  const renderStep = () => {
    switch (step) {
      case 0:
        return (
          <div className="space-y-4">
            <textarea
              value={postData.topic}
              onChange={(e) => setPostData(prev => ({ ...prev, topic: e.target.value }))}
              placeholder="I want to share my experience with morning routines and how they've transformed my productivity..."
              className="w-full h-32 p-4 border border-neutral-200 rounded-lg resize-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              autoFocus
            />
            <p className="text-sm text-neutral-500">
              Pro tip: The more specific you are, the better we can help you craft your post.
            </p>
          </div>
        )

      case 1:
        return (
          <div className="space-y-6">
            {isGeneratingQuestions ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin text-blue-600 mr-2" />
                <span className="text-neutral-600">Generating clarifying questions...</span>
              </div>
            ) : clarifyingQuestions.length > 0 ? (
              <>
                {clarifyingQuestions.map((question, index) => (
                  <div key={index} className="space-y-2">
                    <label className="block text-sm font-medium text-neutral-700">
                      {index + 1}. {question}
                    </label>
                    <textarea
                      value={postData.answers[index] || ''}
                      onChange={(e) => {
                        const newAnswers = [...postData.answers]
                        newAnswers[index] = e.target.value
                        setPostData(prev => ({ ...prev, answers: newAnswers }))
                      }}
                      placeholder="Your answer..."
                      className="w-full h-20 p-3 border border-neutral-200 rounded-lg resize-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                ))}
                <p className="text-sm text-neutral-500">
                  These answers help us create a more personalized and engaging post for you.
                </p>
              </>
            ) : (
              <div className="text-center py-8">
                <p className="text-neutral-600 mb-4">Questions will be generated based on your topic.</p>
                <button
                  onClick={generateClarifyingQuestions}
                  className="btn btn-outline"
                  disabled={!postData.topic.trim()}
                >
                  Generate Questions
                </button>
              </div>
            )}
          </div>
        )

      case 2:
        return (
          <div className="space-y-6">
            {isGeneratingContent ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin text-blue-600 mr-2" />
                <span className="text-neutral-600">Generating your post content...</span>
              </div>
            ) : (
              <>
                {/* AI Assistance Buttons */}
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => handleAIAssist('tone')}
                    className="btn btn-outline btn-sm"
                    disabled={isAdjustingTone || !postData.content.trim()}
                  >
                    {isAdjustingTone ? (
                      <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                    ) : (
                      <Sparkles className="w-4 h-4 mr-1" />
                    )}
                    Adjust tone
                  </button>
                  <button
                    onClick={() => handleAIAssist('clarity')}
                    className="btn btn-outline btn-sm"
                    disabled={isImprovingClarity || !postData.content.trim()}
                  >
                    {isImprovingClarity ? (
                      <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                    ) : (
                      <RefreshCw className="w-4 h-4 mr-1" />
                    )}
                    Improve clarity
                  </button>
                  <button
                    onClick={() => handleAIAssist('hashtags')}
                    className="btn btn-outline btn-sm"
                    disabled={isSuggestingHashtags}
                  >
                    {isSuggestingHashtags ? (
                      <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                    ) : (
                      <Hash className="w-4 h-4 mr-1" />
                    )}
                    Suggest hashtags
                  </button>
                </div>

                {/* Version History Toggle */}
                {contentVersions.length > 0 && (
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setShowVersions(!showVersions)}
                      className="btn btn-ghost btn-sm"
                    >
                      <Clock className="w-4 h-4 mr-1" />
                      {showVersions ? 'Hide versions' : `Show versions (${contentVersions.length})`}
                    </button>
                  </div>
                )}

                {/* Version Selection */}
                {showVersions && contentVersions.length > 0 && (
                  <div className="space-y-2">
                    <label className="block text-sm font-medium text-neutral-700">
                      Content versions
                    </label>
                    <div className="space-y-1 max-h-32 overflow-y-auto">
                      <button
                        onClick={() => {
                          setVersionIndex(0)
                          setShowVersions(false)
                        }}
                        className={`w-full text-left p-2 text-xs rounded border transition-colors ${
                          versionIndex === 0
                            ? 'bg-blue-100 border-blue-300 text-blue-700'
                            : 'bg-neutral-50 border-neutral-200 text-neutral-600 hover:bg-neutral-100'
                        }`}
                      >
                        Current version
                      </button>
                      {contentVersions.map((version, index) => (
                        <button
                          key={version.timestamp}
                          onClick={() => {
                            setVersionIndex(index + 1)
                            setShowVersions(false)
                          }}
                          className={`w-full text-left p-2 text-xs rounded border transition-colors ${
                            versionIndex === index + 1
                              ? 'bg-blue-100 border-blue-300 text-blue-700'
                              : 'bg-neutral-50 border-neutral-200 text-neutral-600 hover:bg-neutral-100'
                          }`}
                        >
                          {version.action} - {new Date(version.timestamp).toLocaleTimeString()}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Post Content */}
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-neutral-700">
                    Your post
                  </label>
                  <textarea
                    value={
                      versionIndex === 0 
                        ? postData.content 
                        : contentVersions[versionIndex - 1]?.content || ''
                    }
                    onChange={(e) => {
                      if (versionIndex === 0) {
                        setPostData(prev => ({ ...prev, content: e.target.value }))
                      }
                    }}
                    placeholder="Your generated post will appear here..."
                    className="w-full h-40 p-4 border border-neutral-200 rounded-lg resize-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    readOnly={versionIndex !== 0}
                  />
                  {versionIndex !== 0 && (
                    <div className="flex gap-2">
                      <button
                        onClick={() => {
                          const selectedVersion = contentVersions[versionIndex - 1]
                          if (selectedVersion) {
                            setPostData(prev => ({ ...prev, content: selectedVersion.content }))
                            setVersionIndex(0)
                          }
                        }}
                        className="btn btn-outline btn-sm"
                      >
                        Use this version
                      </button>
                      <button
                        onClick={() => setVersionIndex(0)}
                        className="btn btn-ghost btn-sm"
                      >
                        Back to current
                      </button>
                    </div>
                  )}
                </div>

                {/* Hashtag Suggestions */}
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-neutral-700">
                    Hashtag suggestions
                  </label>
                  {suggestedHashtags.length > 0 ? (
                    <div className="flex flex-wrap gap-2">
                      {suggestedHashtags.map((hashtag) => (
                        <button
                          key={hashtag}
                          onClick={() => toggleHashtag(hashtag)}
                          className={`px-3 py-1 text-sm rounded-full border transition-colors ${
                            postData.hashtags.includes(hashtag)
                              ? 'bg-blue-100 border-blue-300 text-blue-700'
                              : 'bg-neutral-100 border-neutral-200 text-neutral-600 hover:bg-neutral-200'
                          }`}
                        >
                          {hashtag}
                        </button>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-neutral-500">
                      Click "Suggest hashtags" to get AI-generated hashtag recommendations.
                    </p>
                  )}
                  {postData.hashtags.length > 0 && (
                    <div className="mt-2">
                      <p className="text-sm text-neutral-600">Selected hashtags:</p>
                      <p className="text-sm font-medium text-blue-600">
                        {postData.hashtags.join(' ')}
                      </p>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        )

      default:
        return null
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <motion.div
        className="relative bg-white rounded-xl shadow-xl overflow-hidden max-w-2xl w-full mx-4 max-h-[90vh] flex flex-col"
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.3 }}
      >
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-neutral-500 hover:text-neutral-800 z-10"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Progress indicators */}
        <div className="pt-4 left-0 right-0 flex justify-center space-x-2 z-10">
          {steps.map((_, index) => (
            <div
              key={index}
              className={`w-4 h-4 rounded-full flex items-center justify-center text-sm font-medium transition-colors ${
                index === step 
                  ? 'bg-blue-600 text-white' 
                  : index < step
                  ? 'bg-green-500 text-white'
                  : 'bg-neutral-200 text-neutral-500'
              }`}
            >
              {index + 1}
            </div>
          ))}
        </div>

        {/* Content */}
        <div className="p-6 pt-2 flex-1 overflow-y-auto">
          <motion.div
            key={step}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.3 }}
          >
            <div className="text-center mb-6">
              <h2 className="text-2xl font-semibold text-neutral-900 mb-2">
                {steps[step].title}
              </h2>
              <p className="text-neutral-600">
                {steps[step].description}
              </p>
              {error && (
                <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg">
                  <p className="text-sm text-red-700">{error}</p>
                  <button
                    onClick={() => setError(null)}
                    className="text-xs text-red-600 hover:text-red-800 mt-1"
                  >
                    Dismiss
                  </button>
                </div>
              )}
            </div>

            {renderStep()}
          </motion.div>
        </div>

        {/* Navigation */}
        <div className="p-6 pt-0 flex justify-between">
          <button
            onClick={handleBack}
            disabled={step === 0 || isGeneratingQuestions || isGeneratingContent}
            className="btn btn-outline !px-4 disabled:opacity-0"
          >
            <ChevronLeft className="mr-1 w-4 h-4" />
            Back
          </button>

          {step < steps.length - 1 ? (
            <button 
              onClick={handleNext} 
              className="btn btn-primary"
              disabled={
                (step === 0 && !postData.topic.trim()) ||
                (step === 1 && clarifyingQuestions.length === 0 && !isGeneratingQuestions) ||
                isGeneratingQuestions ||
                isGeneratingContent
              }
            >
              {isGeneratingQuestions || isGeneratingContent ? (
                <>
                  <Loader2 className="mr-1 w-4 h-4 animate-spin" />
                  {isGeneratingQuestions ? 'Generating...' : 'Creating...'}
                </>
              ) : (
                <>
                  Next
                  <ChevronRight className="ml-1 w-4 h-4" />
                </>
              )}
            </button>
          ) : (
            <button 
              onClick={handleSubmit} 
              className="btn btn-primary"
              disabled={!postData.content.trim() || isGeneratingContent}
            >
              Publish Post
            </button>
          )}
        </div>
      </motion.div>
    </div>
  )
}