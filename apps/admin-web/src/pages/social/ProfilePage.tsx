import { useParams } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

const ProfilePage = () => {
  const { fid } = useParams<{ fid: string }>();

  return (
    <div className="max-w-4xl mx-auto p-4">
      <Card className="p-6 mb-6">
        <div className="flex items-center space-x-4">
          <Avatar className="h-20 w-20">
            <AvatarFallback>U</AvatarFallback>
          </Avatar>
          <div>
            <h1 className="text-2xl font-bold">User Profile</h1>
            <p className="text-gray-600">FID: {fid}</p>
          </div>
        </div>
      </Card>

      <div className="text-gray-500 text-center py-8">
        <p>Profile page will be implemented here</p>
        <p className="text-sm">Phase 1: Basic routing and layout complete</p>
      </div>
    </div>
  );
};

export default ProfilePage;
