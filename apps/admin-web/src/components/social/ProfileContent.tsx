import { useUserActivity } from "@/hooks/useUserActivity";
import { useCastInteractions } from "@/hooks/useCastInteractions";
import CastCard from "./CastCard";
import InfiniteScroll from "./InfiniteScroll";
import { LoadingState, EmptyState, ErrorState } from "./LoadingState";
import UserCard from "./UserCard";
import LikeCard from "./LikeCard";
import type { TabType } from "./ProfileTabs";

interface ProfileContentProps {
  fid: number;
  tab: TabType;
}

const ProfileContent = ({ fid, tab }: ProfileContentProps) => {
  const { data, loading, error, hasMore, loadMore, refresh } = useUserActivity({
    fid,
    type: tab,
  });
  const { handleReply, handleLike, handleRecast } = useCastInteractions();

  if (error) {
    return <ErrorState error={error} onRetry={refresh} />;
  }

  if (data.length === 0 && !loading) {
    const emptyMessages = {
      casts: "No casts yet",
      replies: "No replies yet",
      likes: "No likes yet",
      followers: "No followers yet",
      following: "Not following anyone yet",
    };

    return (
      <EmptyState
        title={emptyMessages[tab]}
        description={`This user hasn't ${
          tab === "following" ? "followed anyone" : `posted any ${tab}`
        } yet.`}
      />
    );
  }

  const renderItem = (item: any) => {
    switch (tab) {
      case "casts":
      case "replies":
        return (
          <CastCard
            key={item.hash}
            cast={{
              ...item,
              replyCount: item.stats?.replies || 0,
              likeCount:
                item.stats?.likes || Number.parseInt(item.reactionCount || "0"),
              recastCount: item.stats?.recasts || 0,
            }}
            onReply={handleReply}
            onLike={handleLike}
            onRecast={handleRecast}
          />
        );
      case "likes":
        return <LikeCard key={item.reaction?.hash} like={item} />;
      case "followers":
      case "following":
        return <UserCard key={item.fid} user={item} />;
      default:
        return null;
    }
  };

  return (
    <div className="space-y-0">
      <InfiniteScroll
        data={data}
        loading={loading}
        hasMore={hasMore}
        loadMore={loadMore}
        renderItem={renderItem}
        skeleton={<LoadingState count={5} />}
      />
    </div>
  );
};

export default ProfileContent;
