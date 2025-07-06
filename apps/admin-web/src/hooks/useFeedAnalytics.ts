import { useState, useEffect, useCallback } from "react";

interface FeedAnalytics {
  totalCastsViewed: number;
  totalInteractions: number;
  averageEngagementRate: number;
  topAuthors: { fid: number; username: string; views: number }[];
  sessionDuration: number;
  scrollDepth: number;
}

export const useFeedAnalytics = () => {
  const [analytics, setAnalytics] = useState<FeedAnalytics>({
    totalCastsViewed: 0,
    totalInteractions: 0,
    averageEngagementRate: 0,
    topAuthors: [],
    sessionDuration: 0,
    scrollDepth: 0,
  });

  const [sessionStart] = useState(Date.now());

  const trackCastView = useCallback(
    (_castHash: string, authorFid: number, authorUsername?: string) => {
      setAnalytics((prev) => ({
        ...prev,
        totalCastsViewed: prev.totalCastsViewed + 1,
        topAuthors: updateTopAuthors(
          prev.topAuthors,
          authorFid,
          authorUsername
        ),
      }));
    },
    []
  );

  const trackInteraction = useCallback(() => {
    setAnalytics((prev) => ({
      ...prev,
      totalInteractions: prev.totalInteractions + 1,
      averageEngagementRate:
        prev.totalCastsViewed > 0
          ? ((prev.totalInteractions + 1) / prev.totalCastsViewed) * 100
          : 0,
    }));
  }, []);

  const updateScrollDepth = useCallback((depth: number) => {
    setAnalytics((prev) => ({
      ...prev,
      scrollDepth: Math.max(prev.scrollDepth, depth),
    }));
  }, []);

  useEffect(() => {
    const updateSessionDuration = () => {
      setAnalytics((prev) => ({
        ...prev,
        sessionDuration: Date.now() - sessionStart,
      }));
    };

    const interval = setInterval(updateSessionDuration, 1000);
    return () => clearInterval(interval);
  }, [sessionStart]);

  return {
    analytics,
    trackCastView,
    trackInteraction,
    updateScrollDepth,
  };
};

const updateTopAuthors = (
  currentAuthors: { fid: number; username: string; views: number }[],
  fid: number,
  username?: string
): { fid: number; username: string; views: number }[] => {
  const existing = currentAuthors.find((author) => author.fid === fid);

  if (existing) {
    return currentAuthors.map((author) =>
      author.fid === fid ? { ...author, views: author.views + 1 } : author
    );
  }

  const newAuthor = {
    fid,
    username: username || `user-${fid}`,
    views: 1,
  };

  return [...currentAuthors, newAuthor]
    .sort((a, b) => b.views - a.views)
    .slice(0, 10); // Keep top 10 authors
};
