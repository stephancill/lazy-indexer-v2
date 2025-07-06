import { Card } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Heart, MessageCircle, Repeat2 } from "lucide-react";
import type { Cast } from "@/types";
import EmbedRenderer from "./EmbedRenderer";

interface ExtendedCast extends Cast {
  replyCount?: number;
  likeCount?: number;
  recastCount?: number;
}

interface CastCardProps {
  cast: ExtendedCast;
  showThread?: boolean;
  onReply?: (cast: ExtendedCast) => void;
  onLike?: (cast: ExtendedCast) => void;
  onRecast?: (cast: ExtendedCast) => void;
}

const RelativeTime = ({ timestamp }: { timestamp: string }) => {
  const date = new Date(timestamp);
  const now = new Date();
  const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (diffInSeconds < 60) return <span>{diffInSeconds}s</span>;
  if (diffInSeconds < 3600)
    return <span>{Math.floor(diffInSeconds / 60)}m</span>;
  if (diffInSeconds < 86400)
    return <span>{Math.floor(diffInSeconds / 3600)}h</span>;
  return <span>{Math.floor(diffInSeconds / 86400)}d</span>;
};

const CastActions = ({
  cast,
  onReply,
  onLike,
  onRecast,
}: {
  cast: ExtendedCast;
  onReply?: (cast: ExtendedCast) => void;
  onLike?: (cast: ExtendedCast) => void;
  onRecast?: (cast: ExtendedCast) => void;
}) => {
  return (
    <div className="flex items-center justify-between sm:justify-start sm:space-x-6 mt-2 sm:mt-3 max-w-xs sm:max-w-none">
      <Button
        variant="ghost"
        size="sm"
        className="text-gray-500 hover:text-blue-600 p-1 sm:p-2 h-8 sm:h-auto"
        onClick={() => onReply?.(cast)}
      >
        <MessageCircle className="h-4 w-4 mr-1" />
        <span className="text-xs sm:text-sm">{cast.replyCount || 0}</span>
      </Button>

      <Button
        variant="ghost"
        size="sm"
        className="text-gray-500 hover:text-green-600 p-1 sm:p-2 h-8 sm:h-auto"
        onClick={() => onRecast?.(cast)}
      >
        <Repeat2 className="h-4 w-4 mr-1" />
        <span className="text-xs sm:text-sm">{cast.recastCount || 0}</span>
      </Button>

      <Button
        variant="ghost"
        size="sm"
        className="text-gray-500 hover:text-red-600 p-1 sm:p-2 h-8 sm:h-auto"
        onClick={() => onLike?.(cast)}
      >
        <Heart className="h-4 w-4 mr-1" />
        <span className="text-xs sm:text-sm">{cast.likeCount || 0}</span>
      </Button>
    </div>
  );
};

const CastCard = ({ cast, onReply, onLike, onRecast }: CastCardProps) => {
  return (
    <Card className="border-b border-gray-200 p-3 md:p-4 hover:bg-gray-50 rounded-none border-x-0 md:border-x">
      <div className="flex space-x-3">
        <Avatar className="h-8 w-8 sm:h-10 sm:w-10 flex-shrink-0">
          <AvatarImage src={cast.user?.pfpUrl} alt={cast.user?.displayName} />
          <AvatarFallback>{cast.user?.displayName?.[0] || "U"}</AvatarFallback>
        </Avatar>

        <div className="flex-1 min-w-0">
          <div className="flex items-center space-x-1 sm:space-x-2 flex-wrap">
            <span className="font-semibold text-sm sm:text-base truncate">
              {cast.user?.displayName || "Unknown"}
            </span>
            <span className="text-gray-500 text-sm truncate hidden xs:inline">
              @{cast.user?.username || "unknown"}
            </span>
            <span className="text-gray-500 hidden xs:inline">·</span>
            <span className="text-gray-500 text-sm flex-shrink-0">
              <RelativeTime timestamp={cast.timestamp} />
            </span>
          </div>

          <div className="mt-1 sm:mt-2 text-gray-900 text-sm sm:text-base leading-relaxed break-words">
            {cast.text}
          </div>

          <EmbedRenderer embeds={cast.embeds || ""} />

          <CastActions
            cast={cast}
            onReply={onReply}
            onLike={onLike}
            onRecast={onRecast}
          />
        </div>
      </div>
    </Card>
  );
};

export default CastCard;
