import { useState } from "react";
import { useSearch } from "@/hooks/useSearch";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Search as SearchIcon, User, MessageCircle } from "lucide-react";
import SearchResults from "@/components/social/SearchResults";

const SearchPage = () => {
  const [query, setQuery] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [activeFilter, setActiveFilter] = useState<"all" | "users" | "casts">(
    "all"
  );
  const [searchHistory, setSearchHistory] = useState<string[]>([]);

  const { data, isLoading, error, isError } = useSearch(searchQuery);

  const handleSearch = (searchTerm: string) => {
    if (!searchTerm.trim()) return;

    setSearchQuery(searchTerm);

    // Add to search history
    setSearchHistory((prev) => {
      const newHistory = [
        searchTerm,
        ...prev.filter((item) => item !== searchTerm),
      ];
      return newHistory.slice(0, 10); // Keep last 10 searches
    });
  };

  const handleClearSearch = () => {
    setQuery("");
    setSearchQuery("");
    setActiveFilter("all");
  };

  return (
    <div className="max-w-4xl mx-auto p-4">
      {/* Search Input */}
      <div className="flex space-x-2 mb-4">
        <div className="relative flex-1">
          <SearchIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
          <Input
            placeholder="Search users, casts, or content..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="pl-10"
            onKeyPress={(e) => e.key === "Enter" && handleSearch(query)}
          />
        </div>
        <Button onClick={() => handleSearch(query)} disabled={!query.trim()}>
          Search
        </Button>
        {searchQuery && (
          <Button variant="outline" onClick={handleClearSearch}>
            Clear
          </Button>
        )}
      </div>

      {/* Search History */}
      {!searchQuery && searchHistory.length > 0 && (
        <Card className="p-4 mb-4">
          <h3 className="text-sm font-medium mb-2">Recent searches</h3>
          <div className="flex flex-wrap gap-2">
            {searchHistory.map((term) => (
              <Badge
                key={term}
                variant="secondary"
                className="cursor-pointer hover:bg-gray-200"
                onClick={() => {
                  setQuery(term);
                  handleSearch(term);
                }}
              >
                {term}
              </Badge>
            ))}
          </div>
        </Card>
      )}

      {/* Results */}
      {searchQuery && (
        <>
          {/* Filter Tabs */}
          {data && (
            <div className="mb-4">
              <div className="flex space-x-1 border-b">
                <Button
                  variant={activeFilter === "all" ? "default" : "ghost"}
                  onClick={() => setActiveFilter("all")}
                  className="rounded-b-none"
                >
                  All ({data.counts.total})
                </Button>
                <Button
                  variant={activeFilter === "users" ? "default" : "ghost"}
                  onClick={() => setActiveFilter("users")}
                  className="rounded-b-none"
                >
                  <User className="h-4 w-4 mr-2" />
                  Users ({data.counts.users})
                </Button>
                <Button
                  variant={activeFilter === "casts" ? "default" : "ghost"}
                  onClick={() => setActiveFilter("casts")}
                  className="rounded-b-none"
                >
                  <MessageCircle className="h-4 w-4 mr-2" />
                  Casts ({data.counts.casts})
                </Button>
              </div>
            </div>
          )}

          {/* Loading State */}
          {isLoading && (
            <div className="space-y-0">
              {Array.from({ length: 3 }, () => (
                <Card
                  key={`search-loading-skeleton-${Math.random()
                    .toString(36)
                    .substr(2, 9)}`}
                  className="border-b border-gray-200 p-3 md:p-4 hover:bg-gray-50 rounded-none border-x-0 md:border-x"
                >
                  <div className="flex space-x-3">
                    <Skeleton className="h-8 w-8 sm:h-10 sm:w-10 rounded-full flex-shrink-0" />
                    <div className="flex-1 min-w-0 space-y-2">
                      <div className="flex items-center space-x-1 sm:space-x-2">
                        <Skeleton className="h-4 w-20 sm:w-24" />
                        <Skeleton className="h-4 w-16 sm:w-20 hidden xs:block" />
                        <Skeleton className="h-4 w-8 sm:w-10" />
                      </div>
                      <Skeleton className="h-4 w-full" />
                      <Skeleton className="h-4 w-3/4" />
                      <div className="flex items-center space-x-4 sm:space-x-6 mt-2 sm:mt-3">
                        <Skeleton className="h-6 w-12" />
                        <Skeleton className="h-6 w-14" />
                        <Skeleton className="h-6 w-10" />
                      </div>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}

          {/* Error State */}
          {isError && (
            <Card className="p-4 text-center">
              <p className="text-red-500">
                {error?.message || "Search failed. Please try again."}
              </p>
            </Card>
          )}

          {/* Results */}
          {data && !isLoading && (
            <SearchResults data={data} filter={activeFilter} />
          )}
        </>
      )}
    </div>
  );
};

export default SearchPage;
