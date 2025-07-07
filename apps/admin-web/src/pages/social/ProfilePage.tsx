import { useState } from "react";
import { useParams } from "react-router-dom";
import { useUser } from "@/hooks/useUser";
import ProfileHeader from "@/components/social/ProfileHeader";
import ProfileTabs, { type TabType } from "@/components/social/ProfileTabs";
import ProfileContent from "@/components/social/ProfileContent";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, AlertCircle } from "lucide-react";
import { Link } from "react-router-dom";

const ProfilePage = () => {
  const { fid } = useParams<{ fid: string }>();
  const [activeTab, setActiveTab] = useState<TabType>("casts");

  const { data: user, isLoading, error } = useUser(Number(fid));

  if (!fid || Number.isNaN(Number(fid))) {
    return (
      <div className="w-full">
        <Card className="p-8 text-center">
          <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-semibold mb-2">Invalid Profile</h2>
          <p className="text-gray-600 mb-4">
            The profile ID is invalid or missing.
          </p>
          <Link to="/social">
            <Button>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Feed
            </Button>
          </Link>
        </Card>
      </div>
    );
  }

  if (error) {
    return (
      <div className="w-full">
        <Card className="p-8 text-center">
          <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-semibold mb-2">Profile Not Found</h2>
          <p className="text-gray-600 mb-4">
            This user profile could not be found or may have been deleted.
          </p>
          <Link to="/social">
            <Button>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Feed
            </Button>
          </Link>
        </Card>
      </div>
    );
  }

  return (
    <div className="w-full">
      {/* Header with back button */}
      <div className="border-b border-gray-200 bg-white sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 py-3 md:py-4">
          <div className="flex items-center space-x-4">
            <Link to="/social">
              <Button variant="ghost" size="sm">
                <ArrowLeft className="h-4 w-4" />
              </Button>
            </Link>
            <div>
              <h1 className="text-lg sm:text-xl font-bold">
                {isLoading ? "Profile" : user?.displayName || `User ${fid}`}
              </h1>
              {user && (
                <p className="text-sm text-gray-600">
                  {user.stats.casts} {user.stats.casts === 1 ? "cast" : "casts"}
                </p>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 pb-6">
        {/* Profile Header */}
        <ProfileHeader
          user={user}
          isLoading={isLoading}
          onFollowersClick={() => setActiveTab("followers")}
          onFollowingClick={() => setActiveTab("following")}
        />

        {/* Profile Tabs */}
        {user && (
          <>
            {/* Show tabs only for main content types */}
            {(activeTab === "casts" ||
              activeTab === "replies" ||
              activeTab === "likes") && (
              <ProfileTabs
                activeTab={activeTab}
                onTabChange={setActiveTab}
                userStats={user.stats}
              />
            )}

            {/* Show back to profile button for followers/following */}
            {(activeTab === "followers" || activeTab === "following") && (
              <div className="bg-white border-l border-r border-b border-gray-200 p-6">
                <Button
                  variant="ghost"
                  onClick={() => setActiveTab("casts")}
                  className="mb-4"
                >
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Back to Profile
                </Button>
                <h2 className="text-xl font-bold">
                  {activeTab === "followers" ? "Followers" : "Following"}
                </h2>
              </div>
            )}

            {/* Profile Content */}
            <ProfileContent fid={Number(fid)} tab={activeTab} />
          </>
        )}
      </div>
    </div>
  );
};

export default ProfilePage;
