import { Skeleton } from "@/components/ui/skeleton";
import { Card } from "@/components/ui/card";

interface LoadingStateProps {
  count?: number;
}

export const LoadingState = ({ count = 3 }: LoadingStateProps) => {
  return (
    <div className="space-y-0">
      {Array.from(
        { length: count },
        (_, index) => `loading-skeleton-${index}-${Date.now()}`
      ).map((key) => (
        <Card
          key={key}
          className="border-b border-gray-200 p-3 md:p-4 rounded-none border-x-0 md:border-x"
        >
          <div className="flex space-x-3">
            <Skeleton className="h-8 w-8 sm:h-10 sm:w-10 rounded-full flex-shrink-0" />
            <div className="flex-1 space-y-2">
              <div className="flex items-center space-x-2">
                <Skeleton className="h-3 sm:h-4 w-20 sm:w-24" />
                <Skeleton className="h-3 sm:h-4 w-12 sm:w-16" />
                <Skeleton className="h-3 sm:h-4 w-6 sm:w-8" />
              </div>
              <div className="space-y-1">
                <Skeleton className="h-3 sm:h-4 w-full" />
                <Skeleton className="h-3 sm:h-4 w-3/4" />
                <Skeleton className="h-3 sm:h-4 w-1/2" />
              </div>
              <div className="flex items-center justify-between sm:justify-start sm:space-x-6 pt-1 sm:pt-2 max-w-xs sm:max-w-none">
                <Skeleton className="h-3 sm:h-4 w-8 sm:w-12" />
                <Skeleton className="h-3 sm:h-4 w-8 sm:w-12" />
                <Skeleton className="h-3 sm:h-4 w-8 sm:w-12" />
              </div>
            </div>
          </div>
        </Card>
      ))}
    </div>
  );
};

export const EmptyState = ({
  title = "No casts to display",
  description = "Your feed will appear here when you follow users",
}: {
  title?: string;
  description?: string;
}) => {
  return (
    <div className="p-6 sm:p-8 text-center text-gray-500">
      <div className="mx-auto w-12 h-12 sm:w-16 sm:h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
        <svg
          className="w-6 h-6 sm:w-8 sm:h-8 text-gray-400"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          aria-label="Empty feed"
        >
          <title>Empty feed</title>
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
          />
        </svg>
      </div>
      <h3 className="text-base sm:text-lg font-medium text-gray-900 mb-2">
        {title}
      </h3>
      <p className="text-sm">{description}</p>
    </div>
  );
};

export const ErrorState = ({
  error,
  onRetry,
}: {
  error: string;
  onRetry?: () => void;
}) => {
  return (
    <div className="p-6 sm:p-8 text-center">
      <div className="mx-auto w-12 h-12 sm:w-16 sm:h-16 bg-red-100 rounded-full flex items-center justify-center mb-4">
        <svg
          className="w-6 h-6 sm:w-8 sm:h-8 text-red-500"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          aria-label="Error"
        >
          <title>Error</title>
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
      </div>
      <h3 className="text-base sm:text-lg font-medium text-red-900 mb-2">
        Something went wrong
      </h3>
      <p className="text-sm text-red-600 mb-4 px-4">{error}</p>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors text-sm sm:text-base"
        >
          Try Again
        </button>
      )}
    </div>
  );
};
