import { useNavigate } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'

const NotFound = () => {
  const navigate = useNavigate()

  return (
    <div className="min-h-[80vh] flex flex-col items-center justify-center">
      <h1 className="text-6xl font-semibold text-neutral-900">404</h1>
      <p className="text-xl text-neutral-600 mt-4">Page not found</p>
      <p className="text-neutral-500 mt-2 text-center max-w-md">
        The page you're looking for doesn't exist or has been moved.
      </p>

      <button className="btn btn-primary mt-8" onClick={() => navigate('/')}>
        <ArrowLeft className="mr-2 h-4 w-4" />
        Back to Dashboard
      </button>
    </div>
  )
}

export default NotFound
