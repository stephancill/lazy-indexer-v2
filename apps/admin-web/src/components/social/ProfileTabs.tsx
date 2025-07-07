import { MessageCircle, Reply, Heart } from "lucide-react";

export type TabType = "casts" | "replies" | "likes" | "followers" | "following";

interface ProfileTabsProps {
  activeTab: TabType;
  onTabChange: (tab: TabType) => void;
  userStats?: {
    casts: number;
    followers: number;
    following: number;
  };
}

const ProfileTabs = ({
  activeTab,
  onTabChange,
  userStats,
}: ProfileTabsProps) => {
  const tabs = [
    {
      key: "casts" as TabType,
      label: "Casts",
      icon: MessageCircle,
      count: userStats?.casts,
    },
    {
      key: "replies" as TabType,
      label: "Replies",
      icon: Reply,
      count: undefined, // We don't have reply count in user stats
    },
    {
      key: "likes" as TabType,
      label: "Likes",
      icon: Heart,
      count: undefined, // We don't have likes count in user stats
    },
  ];

  const formatCount = (count: number | undefined) => {
    if (count === undefined) return "";
    if (count >= 1000000) {
      return `${(count / 1000000).toFixed(1)}M`;
    }
    if (count >= 1000) {
      return `${(count / 1000).toFixed(1)}K`;
    }
    return count.toString();
  };

  return (
    <div className="bg-white border-l border-r border-gray-200">
      <div className="flex border-b border-gray-200">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.key;

          return (
            <button
              key={tab.key}
              type="button"
              onClick={() => onTabChange(tab.key)}
              className={`
                flex-1 flex items-center justify-center space-x-2 px-4 py-4 text-sm font-medium transition-colors
                relative hover:bg-gray-50
                ${
                  isActive
                    ? "text-black border-b-2 border-black"
                    : "text-gray-500 hover:text-gray-700"
                }
              `}
            >
              <Icon className="h-4 w-4" />
              <span>{tab.label}</span>
              {tab.count !== undefined && (
                <span className="text-xs opacity-75">
                  ({formatCount(tab.count)})
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default ProfileTabs;
