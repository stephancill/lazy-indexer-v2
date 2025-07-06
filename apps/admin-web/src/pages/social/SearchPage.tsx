import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search } from "lucide-react";

const SearchPage = () => {
  return (
    <div className="max-w-4xl mx-auto p-4">
      <Card className="p-4 mb-4">
        <div className="flex space-x-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              placeholder="Search users, casts, or content..."
              className="pl-10"
            />
          </div>
          <Button>Search</Button>
        </div>
      </Card>

      <div className="text-gray-500 text-center py-8">
        <p>Search functionality will be implemented here</p>
        <p className="text-sm">Phase 1: Basic routing and layout complete</p>
      </div>
    </div>
  );
};

export default SearchPage;
