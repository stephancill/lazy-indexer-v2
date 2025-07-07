import { Card } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { User, MessageCircle, Heart, Repeat } from "lucide-react";
import { Link } from "react-router-dom";
import EmbedRenderer from "./EmbedRenderer";

interface SearchUser {
  fid: number;
  username: string;
  displayName: string;
  pfpUrl: string;
  bio: string;
  custodyAddress: string;
  syncedAt: string;
}

interface SearchCast {
  hash: string;
  fid: number;
  text: string;
  parentHash: string | null;
  parentFid: number | null;
  parentUrl: string | null;
  timestamp: string;
  embeds: string;
  mentions: number[] | null;
  mentionsPositions: number[] | null;
  createdAt: string;
  user: SearchUser;
}

interface SearchResultsData {
  results: {
    users: SearchUser[];
    casts: SearchCast[];
  };
  counts: {
    users: number;
    casts: number;
    total: number;
  };
}

interface SearchResultsProps {
  data: SearchResultsData | null;
  filter: "all" | "users" | "casts";
}

const SearchResults = ({ data, filter }: SearchResultsProps) => {
  if (!data) return null;

  const formatRelativeTime = (timestamp: string) => {
    const now = new Date();
    const time = new Date(timestamp);
    const diff = now.getTime() - time.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return "now";
    if (minutes < 60) return `${minutes}m`;
    if (hours < 24) return `${hours}h`;
    return `${days}d`;
  };

  const parseEmbeds = (embedsString: string) => {
    try {
      return JSON.parse(embedsString || "[]");
    } catch {
      return [];
    }
  };

  const filteredResults = {
    users: filter === "all" || filter === "users" ? data.results.users : [],
    casts: filter === "all" || filter === "casts" ? data.results.casts : [],
  };

  return (
    <div className="space-y-0">
      {/* Users Results */}
      {filteredResults.users.length > 0 && (
        <div className="space-y-0">
          {filter === "all" && (
            <h3 className="text-lg font-semibold flex items-center p-3 md:p-4 text-gray-700">
              <User className="h-5 w-5 mr-2" />
              Users
            </h3>
          )}
          {filteredResults.users.map((user) => (
            <Link key={user.fid} to={`/social/profile/${user.fid}`}>
              <Card className="border-b border-gray-200 p-3 md:p-4 hover:bg-gray-50 rounded-none border-x-0 md:border-x">
                <div className="flex space-x-3">
                  <Avatar className="h-8 w-8 sm:h-10 sm:w-10 flex-shrink-0">
                    <AvatarImage src={user.pfpUrl} alt={user.displayName} />
                    <AvatarFallback>
                      {user.displayName?.[0] || user.username?.[0] || "U"}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center space-x-1 sm:space-x-2 flex-wrap">
                      <h4 className="font-semibold text-sm sm:text-base truncate">
                        {user.displayName}
                      </h4>
                      <span className="text-gray-500 text-sm truncate hidden xs:inline">
                        @{user.username}
                      </span>
                    </div>
                    {user.bio && (
                      <p className="text-gray-600 text-sm sm:text-base mt-1 sm:mt-2 leading-relaxed break-words line-clamp-2">
                        {user.bio}
                      </p>
                    )}
                  </div>
                </div>
              </Card>
            </Link>
          ))}
        </div>
      )}

      {/* Casts Results */}
      {filteredResults.casts.length > 0 && (
        <div className="space-y-0">
          {filter === "all" && (
            <h3 className="text-lg font-semibold flex items-center p-3 md:p-4 text-gray-700">
              <MessageCircle className="h-5 w-5 mr-2" />
              Casts
            </h3>
          )}
          {filteredResults.casts.map((cast) => (
            <Card
              key={cast.hash}
              className="border-b border-gray-200 p-3 md:p-4 hover:bg-gray-50 rounded-none border-x-0 md:border-x"
            >
              <div className="flex space-x-3">
                <Link to={`/social/profile/${cast.user.fid}`}>
                  <Avatar className="h-8 w-8 sm:h-10 sm:w-10 flex-shrink-0">
                    <AvatarImage
                      src={cast.user.pfpUrl}
                      alt={cast.user.displayName}
                    />
                    <AvatarFallback>
                      {cast.user.displayName?.[0] ||
                        cast.user.username?.[0] ||
                        "U"}
                    </AvatarFallback>
                  </Avatar>
                </Link>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center space-x-1 sm:space-x-2 flex-wrap">
                    <Link to={`/social/profile/${cast.user.fid}`}>
                      <span className="font-semibold text-sm sm:text-base truncate hover:underline">
                        {cast.user.displayName}
                      </span>
                    </Link>
                    <span className="text-gray-500 text-sm truncate hidden xs:inline">
                      @{cast.user.username}
                    </span>
                    <span className="text-gray-500 hidden xs:inline">·</span>
                    <span className="text-gray-500 text-sm flex-shrink-0">
                      {formatRelativeTime(cast.timestamp)}
                    </span>
                  </div>
                  <div className="mt-1 sm:mt-2 text-gray-900 text-sm sm:text-base leading-relaxed break-words">
                    {cast.text}
                  </div>
                  {cast.embeds && parseEmbeds(cast.embeds).length > 0 && (
                    <div className="mt-2 sm:mt-3">
                      <EmbedRenderer embeds={parseEmbeds(cast.embeds)} />
                    </div>
                  )}
                  <div className="flex items-center justify-between sm:justify-start sm:space-x-6 mt-2 sm:mt-3 max-w-xs sm:max-w-none">
                    <button
                      type="button"
                      className="text-gray-500 hover:text-blue-600 p-1 sm:p-2 h-8 sm:h-auto flex items-center space-x-1"
                    >
                      <MessageCircle className="h-4 w-4" />
                      <span className="text-xs sm:text-sm">Reply</span>
                    </button>
                    <button
                      type="button"
                      className="text-gray-500 hover:text-green-600 p-1 sm:p-2 h-8 sm:h-auto flex items-center space-x-1"
                    >
                      <Repeat className="h-4 w-4" />
                      <span className="text-xs sm:text-sm">Recast</span>
                    </button>
                    <button
                      type="button"
                      className="text-gray-500 hover:text-red-600 p-1 sm:p-2 h-8 sm:h-auto flex items-center space-x-1"
                    >
                      <Heart className="h-4 w-4" />
                      <span className="text-xs sm:text-sm">Like</span>
                    </button>
                  </div>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* No Results */}
      {data.counts.total === 0 && (
        <Card className="p-8 text-center">
          <MessageCircle className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-semibold mb-2">No results found</h3>
          <p className="text-gray-500">
            Try adjusting your search terms or search for something else.
          </p>
        </Card>
      )}
    </div>
  );
};

export default SearchResults;
