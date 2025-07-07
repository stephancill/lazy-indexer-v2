import { Link } from "react-router-dom";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card } from "@/components/ui/card";
import { Heart, Clock, MessageCircle, Repeat } from "lucide-react";
import EmbedRenderer from "./EmbedRenderer";

interface LikeCardProps {
  like: {
    reaction: {
      hash: string;
      fid: number;
      type: string;
      targetHash: string;
      timestamp: string;
      createdAt: string;
    };
    cast: {
      hash: string;
      fid: number;
      text: string;
      parentHash?: string;
      parentFid?: number;
      parentUrl?: string;
      timestamp: string;
      embeds?: string;
      mentions?: number[];
      mentionsPositions?: number[];
      createdAt: string;
      user: {
        fid: number;
        username: string;
        displayName: string;
        pfpUrl?: string;
        bio?: string;
        custodyAddress?: string;
        syncedAt?: string;
      };
    } | null;
  };
}

const LikeCard = ({ like }: LikeCardProps) => {
  if (!like.cast) {
    return (
      <Card className="border-l border-r border-b border-gray-200 p-4 bg-gray-50 rounded-none">
        <div className="flex items-center space-x-2 text-gray-500">
          <Heart className="h-4 w-4 text-red-500" />
          <span className="text-sm">
            Liked a cast that's no longer available
          </span>
        </div>
      </Card>
    );
  }

  const formatRelativeTime = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffInMinutes = Math.floor(
      (now.getTime() - date.getTime()) / (1000 * 60)
    );

    if (diffInMinutes < 1) return "now";
    if (diffInMinutes < 60) return `${diffInMinutes}m`;
    if (diffInMinutes < 1440) return `${Math.floor(diffInMinutes / 60)}h`;
    return `${Math.floor(diffInMinutes / 1440)}d`;
  };

  const parseEmbeds = (embeds: string) => {
    try {
      return JSON.parse(embeds);
    } catch {
      return [];
    }
  };

  return (
    <Card className="border-l border-r border-b border-gray-200 p-4 hover:bg-gray-50 rounded-none">
      {/* Cast content */}
      <div className="flex space-x-3">
        <Link to={`/social/profile/${like.cast.user.fid}`}>
          <Avatar className="h-10 w-10">
            <AvatarImage
              src={like.cast.user.pfpUrl}
              alt={like.cast.user.displayName}
            />
            <AvatarFallback>
              {like.cast.user.displayName?.[0] ||
                like.cast.user.username?.[0] ||
                "U"}
            </AvatarFallback>
          </Avatar>
        </Link>

        <div className="flex-1 min-w-0">
          <div className="flex items-center space-x-2">
            <Link to={`/social/profile/${like.cast.user.fid}`}>
              <span className="font-semibold hover:underline">
                {like.cast.user.displayName}
              </span>
            </Link>
            <span className="text-gray-500">@{like.cast.user.username}</span>
            <span className="text-gray-500">·</span>
            <span className="text-gray-500 flex items-center">
              <Clock className="h-3 w-3 mr-1" />
              {formatRelativeTime(like.cast.timestamp)}
            </span>
          </div>

          <div className="mt-2 text-gray-900">{like.cast.text}</div>

          {like.cast.embeds && parseEmbeds(like.cast.embeds).length > 0 && (
            <div className="mt-3">
              <EmbedRenderer embeds={parseEmbeds(like.cast.embeds)} />
            </div>
          )}

          {/* Cast actions */}
          <div className="flex items-center space-x-4 mt-3 text-gray-500">
            <button
              type="button"
              className="flex items-center space-x-1 hover:text-blue-500"
            >
              <MessageCircle className="h-4 w-4" />
              <span className="text-sm">Reply</span>
            </button>
            <button
              type="button"
              className="flex items-center space-x-1 hover:text-green-500"
            >
              <Repeat className="h-4 w-4" />
              <span className="text-sm">Recast</span>
            </button>
            <button
              type="button"
              className="flex items-center space-x-1 text-red-500"
            >
              <Heart className="h-4 w-4 fill-current" />
              <span className="text-sm">Liked</span>
            </button>
          </div>
        </div>
      </div>
    </Card>
  );
};

export default LikeCard;
