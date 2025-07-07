import { Link } from "react-router-dom";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { UserPlus } from "lucide-react";

interface UserCardProps {
  user: {
    fid: number;
    username: string;
    displayName: string;
    pfpUrl?: string;
    bio?: string;
    custodyAddress?: string;
    syncedAt?: string;
  };
}

const UserCard = ({ user }: UserCardProps) => {
  return (
    <Card className="border-l border-r border-b border-gray-200 p-4 hover:bg-gray-50 rounded-none">
      <div className="flex items-center space-x-3">
        <Link to={`/social/profile/${user.fid}`}>
          <Avatar className="h-12 w-12">
            <AvatarImage src={user.pfpUrl} alt={user.displayName} />
            <AvatarFallback>
              {user.displayName?.[0] || user.username?.[0] || "U"}
            </AvatarFallback>
          </Avatar>
        </Link>

        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between">
            <div>
              <Link to={`/social/profile/${user.fid}`}>
                <h4 className="font-semibold hover:underline truncate">
                  {user.displayName}
                </h4>
              </Link>
              <p className="text-gray-500 text-sm">@{user.username}</p>
            </div>

            <Button variant="outline" size="sm">
              <UserPlus className="h-4 w-4 mr-2" />
              Follow
            </Button>
          </div>

          {user.bio && (
            <p className="text-sm text-gray-600 mt-2 line-clamp-2">
              {user.bio}
            </p>
          )}
        </div>
      </div>
    </Card>
  );
};

export default UserCard;
