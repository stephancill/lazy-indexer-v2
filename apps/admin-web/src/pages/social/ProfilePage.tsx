import { useParams } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { User } from "lucide-react";

const ProfilePage = () => {
  const { fid } = useParams<{ fid: string }>();

  return (
    <div className="w-full">
      <div className="border-b border-gray-200 p-3 md:p-4 bg-white border-x-0 md:border-x">
        <div className="flex items-center space-x-3 sm:space-x-4">
          <Avatar className="h-16 w-16 sm:h-20 sm:w-20">
            <AvatarFallback>U</AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <h1 className="text-xl sm:text-2xl font-bold truncate">
              User Profile
            </h1>
            <p className="text-gray-600 text-sm sm:text-base">FID: {fid}</p>
          </div>
        </div>
      </div>

      <div className="text-gray-500 text-center py-8 px-4">
        <div className="max-w-md mx-auto">
          <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <User className="w-8 h-8 text-gray-400" />
          </div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            User Profile
          </h3>
          <p className="text-sm">
            Profile details and activity will appear here
          </p>
        </div>
      </div>
    </div>
  );
};

export default ProfilePage;
