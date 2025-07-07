import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Calendar, Link as LinkIcon, User as UserIcon } from "lucide-react";
import type { User } from "@/hooks/useUser";

interface ProfileHeaderProps {
  user?: User;
  isLoading?: boolean;
  onFollowersClick?: () => void;
  onFollowingClick?: () => void;
}

const ProfileHeader = ({
  user,
  isLoading = false,
  onFollowersClick,
  onFollowingClick,
}: ProfileHeaderProps) => {
  if (isLoading || !user) {
    return (
      <div className="bg-white border-l border-r border-t border-gray-200 p-6 mb-0">
        <div className="flex items-start space-x-4">
          <div className="h-20 w-20 bg-gray-200 rounded-full animate-pulse" />
          <div className="flex-1 space-y-2">
            <div className="h-6 bg-gray-200 rounded animate-pulse w-48" />
            <div className="h-4 bg-gray-200 rounded animate-pulse w-32" />
            <div className="h-4 bg-gray-200 rounded animate-pulse w-full" />
            <div className="h-4 bg-gray-200 rounded animate-pulse w-2/3" />
          </div>
        </div>
      </div>
    );
  }

  const formatJoinDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      month: "long",
      year: "numeric",
    });
  };

  const formatNumber = (num: number) => {
    if (num >= 1000000) {
      return `${(num / 1000000).toFixed(1)}M`;
    }
    if (num >= 1000) {
      return `${(num / 1000).toFixed(1)}K`;
    }
    return num.toString();
  };

  return (
    <div className="bg-white border-l border-r border-t border-gray-200 p-6 mb-0">
      <div className="flex items-start space-x-4 mb-4">
        <Avatar className="h-20 w-20">
          <AvatarImage src={user.pfpUrl} alt={user.displayName} />
          <AvatarFallback className="text-lg">
            {user.displayName?.[0] || user.username?.[0] || "U"}
          </AvatarFallback>
        </Avatar>

        <div className="flex-1">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold">{user.displayName}</h1>
              <p className="text-gray-600">@{user.username}</p>
            </div>
            <Button variant="outline" size="sm">
              <UserIcon className="h-4 w-4 mr-2" />
              Follow
            </Button>
          </div>

          {user.bio && <p className="mt-3 text-gray-900">{user.bio}</p>}

          <div className="flex items-center space-x-4 mt-3 text-gray-600">
            <div className="flex items-center space-x-1">
              <Calendar className="h-4 w-4" />
              <span className="text-sm">
                Joined {formatJoinDate(user.syncedAt)}
              </span>
            </div>
            {user.custodyAddress && (
              <div className="flex items-center space-x-1">
                <LinkIcon className="h-4 w-4" />
                <span className="text-sm font-mono">
                  {user.custodyAddress.slice(0, 6)}...
                  {user.custodyAddress.slice(-4)}
                </span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="flex items-center space-x-6 pt-4 border-t">
        <div className="text-center">
          <div className="font-bold text-lg">
            {formatNumber(user.stats.casts)}
          </div>
          <div className="text-sm text-gray-600">Casts</div>
        </div>
        <button
          type="button"
          className="text-center hover:bg-gray-100 rounded-lg p-2 transition-colors"
          onClick={onFollowingClick}
        >
          <div className="font-bold text-lg">
            {formatNumber(user.stats.following)}
          </div>
          <div className="text-sm text-gray-600">Following</div>
        </button>
        <button
          type="button"
          className="text-center hover:bg-gray-100 rounded-lg p-2 transition-colors"
          onClick={onFollowersClick}
        >
          <div className="font-bold text-lg">
            {formatNumber(user.stats.followers)}
          </div>
          <div className="text-sm text-gray-600">Followers</div>
        </button>
      </div>
    </div>
  );
};

export default ProfileHeader;
