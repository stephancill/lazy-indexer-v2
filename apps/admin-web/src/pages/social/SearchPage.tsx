import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search } from "lucide-react";

const SearchPage = () => {
  return (
    <div className="w-full">
      <div className="border-b border-gray-200 p-3 md:p-4 bg-white sticky top-0 z-10 border-x-0 md:border-x">
        <h1 className="text-lg sm:text-xl font-bold mb-3">Search</h1>
        <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              placeholder="Search users, casts, or content..."
              className="pl-10"
            />
          </div>
          <Button className="sm:w-auto">Search</Button>
        </div>
      </div>

      <div className="text-gray-500 text-center py-8 px-4">
        <div className="max-w-md mx-auto">
          <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Search className="w-8 h-8 text-gray-400" />
          </div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            Search Farcaster
          </h3>
          <p className="text-sm">Find users, casts, and conversations</p>
        </div>
      </div>
    </div>
  );
};

export default SearchPage;
