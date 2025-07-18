interface LoadingSpinnerProps {
  message?: string
  fullScreen?: boolean
}

const LoadingSpinner = ({ message = 'Loading...', fullScreen = true }: LoadingSpinnerProps) => {
  const containerClasses = fullScreen 
    ? 'h-screen flex items-center justify-center bg-white'
    : 'flex items-center justify-center py-8'

  return (
    <div className={containerClasses}>
      <div className="flex flex-col items-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 mb-4"></div>
        <span className="text-neutral-600">{message}</span>
      </div>
    </div>
  )
}

export default LoadingSpinner