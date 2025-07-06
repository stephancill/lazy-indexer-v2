import { Card } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Heart, MessageCircle, Repeat2 } from "lucide-react";

interface Cast {
  hash: string;
  text: string;
  timestamp: string;
  user: {
    fid: number;
    displayName: string;
    username: string;
    pfpUrl?: string;
  };
  embeds?: any[];
  replyCount?: number;
  likeCount?: number;
  recastCount?: number;
}

interface CastCardProps {
  cast: Cast;
  showThread?: boolean;
  onReply?: (cast: Cast) => void;
  onLike?: (cast: Cast) => void;
  onRecast?: (cast: Cast) => void;
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
  cast: Cast;
  onReply?: (cast: Cast) => void;
  onLike?: (cast: Cast) => void;
  onRecast?: (cast: Cast) => void;
}) => {
  return (
    <div className="flex items-center space-x-6 mt-3">
      <Button
        variant="ghost"
        size="sm"
        className="text-gray-500 hover:text-blue-600 p-0"
        onClick={() => onReply?.(cast)}
      >
        <MessageCircle className="h-4 w-4 mr-1" />
        <span className="text-sm">{cast.replyCount || 0}</span>
      </Button>

      <Button
        variant="ghost"
        size="sm"
        className="text-gray-500 hover:text-green-600 p-0"
        onClick={() => onRecast?.(cast)}
      >
        <Repeat2 className="h-4 w-4 mr-1" />
        <span className="text-sm">{cast.recastCount || 0}</span>
      </Button>

      <Button
        variant="ghost"
        size="sm"
        className="text-gray-500 hover:text-red-600 p-0"
        onClick={() => onLike?.(cast)}
      >
        <Heart className="h-4 w-4 mr-1" />
        <span className="text-sm">{cast.likeCount || 0}</span>
      </Button>
    </div>
  );
};

const CastCard = ({ cast, onReply, onLike, onRecast }: CastCardProps) => {
  return (
    <Card className="border-b border-gray-200 p-4 hover:bg-gray-50 rounded-none">
      <div className="flex space-x-3">
        <Avatar className="h-10 w-10">
          <AvatarImage src={cast.user.pfpUrl} alt={cast.user.displayName} />
          <AvatarFallback>{cast.user.displayName[0]}</AvatarFallback>
        </Avatar>

        <div className="flex-1">
          <div className="flex items-center space-x-2">
            <span className="font-semibold">{cast.user.displayName}</span>
            <span className="text-gray-500">@{cast.user.username}</span>
            <span className="text-gray-500">·</span>
            <RelativeTime timestamp={cast.timestamp} />
          </div>

          <div className="mt-2 text-gray-900">{cast.text}</div>

          {cast.embeds && cast.embeds.length > 0 && (
            <div className="mt-3 text-gray-500 text-sm">
              {cast.embeds.length} embed(s) - Will be rendered in Phase 2
            </div>
          )}

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
