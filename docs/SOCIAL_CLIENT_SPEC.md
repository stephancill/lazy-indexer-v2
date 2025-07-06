# Social Client Specification

## Overview

This specification outlines the addition of a social client interface to the admin web app, transforming it from a pure admin tool into a comprehensive Farcaster client with social features. The social client will provide a Twitter-like experience for browsing indexed Farcaster content.

## Architecture

### Page Structure

The social client will be implemented as a new page in the admin web app with the following routes:

```
/social                    # Main social feed page
/social/search             # Search page with results
/social/profile/:fid       # User profile page
/social/cast/:hash         # Individual cast page (optional)
```

### Component Hierarchy

```
SocialClient/
├── SocialLayout.tsx       # Layout wrapper with navigation
├── Feed/
│   ├── FeedPage.tsx       # Main feed page
│   ├── FeedList.tsx       # Infinite scroll feed list
│   ├── CastCard.tsx       # Individual cast display
│   └── FeedSkeleton.tsx   # Loading skeleton
├── Search/
│   ├── SearchPage.tsx     # Search page and results
│   ├── SearchBar.tsx      # Search input component
│   ├── SearchResults.tsx  # Results display
│   └── SearchFilters.tsx  # Search type filters
├── Profile/
│   ├── ProfilePage.tsx    # User profile page
│   ├── ProfileHeader.tsx  # Profile info header
│   ├── ProfileTabs.tsx    # Casts/Followers/Following tabs
│   └── ProfileStats.tsx   # Follower/cast counts
└── Common/
    ├── UserAvatar.tsx     # User avatar component
    ├── CastActions.tsx    # Like/recast/reply actions
    ├── RelativeTime.tsx   # Time display component
    └── InfiniteScroll.tsx # Infinite scroll wrapper
```

## Features

### 1. Social Feed Page (`/social`)

A reverse-chronological feed showing casts from followed users, similar to Twitter's home timeline.

#### Features:

- **Infinite Scroll**: Automatically loads more content as user scrolls
- **Real-time Updates**: Optional real-time updates for new casts
- **Cast Interactions**: Display likes, recasts, and replies
- **Rich Content**: Support for links, mentions, and embeds
- **Feed Filtering**: Options to filter by cast type or time period

#### API Requirements:

- `GET /api/v1/feed/:fid` - Get feed for a specific user (already exists)
- `GET /api/v1/me/feed` - Get feed for authenticated admin user (new)
- `GET /api/v1/casts/:hash/context` - Get cast with replies/context (new)

#### Implementation:

```typescript
// Feed page component
const FeedPage = () => {
  const { data, loading, error, loadMore, hasMore } = useFeed();

  return (
    <div className="max-w-2xl mx-auto">
      <div className="border-b border-gray-200 p-4">
        <h1 className="text-xl font-bold">Home</h1>
      </div>

      <InfiniteScroll
        data={data}
        loading={loading}
        hasMore={hasMore}
        loadMore={loadMore}
        renderItem={(cast) => <CastCard key={cast.hash} cast={cast} />}
        skeleton={<FeedSkeleton />}
      />
    </div>
  );
};
```

### 2. Search Functionality (`/social/search`)

Comprehensive search for users, casts, and content with filtering and sorting options.

#### Features:

- **Universal Search**: Search across users, casts, and content
- **Search Types**: Toggle between "All", "Users", "Casts"
- **Advanced Filters**: Date range, user filters, content type
- **Search History**: Recent searches stored locally
- **Trending Topics**: Display trending hashtags or topics

#### API Requirements:

- `GET /api/v1/search/users?q=:query` - Search users (new)
- `GET /api/v1/search/casts?q=:query` - Search casts (new)
- `GET /api/v1/search?q=:query&type=:type` - Universal search (new)
- `GET /api/v1/trending/topics` - Get trending topics (new)

#### Implementation:

```typescript
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";

const SearchPage = () => {
  const [query, setQuery] = useState("");
  const [searchType, setSearchType] = useState<"all" | "users" | "casts">(
    "all"
  );
  const { data, loading, search } = useSearch();

  return (
    <div className="max-w-4xl mx-auto p-4">
      <Card className="p-4 mb-4">
        <div className="flex space-x-2">
          <Input
            placeholder="Search users, casts, or content..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="flex-1"
          />
          <Select value={searchType} onValueChange={setSearchType}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="users">Users</SelectItem>
              <SelectItem value="casts">Casts</SelectItem>
            </SelectContent>
          </Select>
          <Button onClick={() => search(query, searchType)}>Search</Button>
        </div>
      </Card>

      <SearchResults results={data} loading={loading} type={searchType} />
    </div>
  );
};
```

### 3. User Profile Pages (`/social/profile/:fid`)

Comprehensive user profile pages with activity history and social graph.

#### Features:

- **Profile Information**: Avatar, bio, follower/following counts
- **Activity Tabs**: Casts, Replies, Likes, Media
- **Social Graph**: Followers and following lists
- **Profile Actions**: Follow/unfollow buttons (if authenticated)
- **Activity Stats**: Cast frequency, engagement metrics

#### API Requirements:

- `GET /api/v1/users/:fid` - Get user profile (already exists)
- `GET /api/v1/users/:fid/casts` - Get user casts (already exists)
- `GET /api/v1/users/:fid/followers` - Get followers (already exists)
- `GET /api/v1/users/:fid/following` - Get following (already exists)
- `GET /api/v1/users/:fid/replies` - Get user replies (new)
- `GET /api/v1/users/:fid/likes` - Get user likes (new)

#### Implementation:

```typescript
const ProfilePage = () => {
  const { fid } = useParams();
  const { user, loading } = useUser(fid);
  const [activeTab, setActiveTab] = useState("casts");

  return (
    <div className="max-w-4xl mx-auto">
      <ProfileHeader user={user} />

      <ProfileTabs
        activeTab={activeTab}
        onTabChange={setActiveTab}
        tabs={["casts", "replies", "likes", "followers", "following"]}
      />

      <ProfileContent fid={fid} tab={activeTab} />
    </div>
  );
};
```

## UI Components

**Note**: The social client should use shadcn/ui components for consistency with the existing admin interface. The admin-web app already has shadcn/ui configured and includes components like Button, Card, Dialog, Input, Select, etc. New social components should leverage these existing UI primitives and follow the same design system.

### Core Components

#### CastCard Component

```typescript
import { Card } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";

interface CastCardProps {
  cast: Cast;
  showThread?: boolean;
  onReply?: (cast: Cast) => void;
  onLike?: (cast: Cast) => void;
  onRecast?: (cast: Cast) => void;
}

const CastCard: React.FC<CastCardProps> = ({
  cast,
  showThread = false,
  onReply,
  onLike,
  onRecast,
}) => {
  return (
    <Card className="border-b border-gray-200 p-4 hover:bg-gray-50">
      <div className="flex space-x-3">
        <Avatar className="h-10 w-10">
          <AvatarImage src={cast.user.pfpUrl} alt={cast.user.displayName} />
          <AvatarFallback>{cast.user.displayName[0]}</AvatarFallback>
        </Avatar>

        <div className="flex-1">
          <div className="flex items-center space-x-2">
            <span className="font-semibold">{cast.user.displayName}</span>
            <span className="text-muted-foreground">@{cast.user.username}</span>
            <span className="text-muted-foreground">·</span>
            <RelativeTime timestamp={cast.timestamp} />
          </div>

          <div className="mt-2 text-foreground">{cast.text}</div>

          {cast.embeds && (
            <div className="mt-3">
              <CastEmbeds embeds={cast.embeds} />
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
```

#### InfiniteScroll Component

```typescript
interface InfiniteScrollProps<T> {
  data: T[];
  loading: boolean;
  hasMore: boolean;
  loadMore: () => void;
  renderItem: (item: T) => React.ReactNode;
  skeleton?: React.ReactNode;
}

const InfiniteScroll = <T>({
  data,
  loading,
  hasMore,
  loadMore,
  renderItem,
  skeleton,
}: InfiniteScrollProps<T>) => {
  const { ref, inView } = useInView({
    threshold: 0.1,
    triggerOnce: false,
  });

  useEffect(() => {
    if (inView && hasMore && !loading) {
      loadMore();
    }
  }, [inView, hasMore, loading, loadMore]);

  return (
    <div className="space-y-0">
      {data.map(renderItem)}

      {loading && skeleton}

      {hasMore && (
        <div ref={ref} className="h-10 flex items-center justify-center">
          {loading && <Spinner />}
        </div>
      )}
    </div>
  );
};
```

### Layout and Navigation

#### SocialLayout Component

```typescript
const SocialLayout = ({ children }: { children: React.ReactNode }) => {
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="flex max-w-6xl mx-auto">
        {/* Sidebar Navigation */}
        <div className="w-64 bg-white border-r border-gray-200 h-screen sticky top-0">
          <div className="p-4">
            <h1 className="text-xl font-bold text-blue-600">Farcaster</h1>
          </div>

          <nav className="mt-8">
            <SocialNavLink to="/social" icon={HomeIcon}>
              Home
            </SocialNavLink>
            <SocialNavLink to="/social/search" icon={SearchIcon}>
              Search
            </SocialNavLink>
            <SocialNavLink to="/admin" icon={CogIcon}>
              Admin
            </SocialNavLink>
          </nav>
        </div>

        {/* Main Content */}
        <div className="flex-1 min-h-screen">{children}</div>

        {/* Right Sidebar (optional) */}
        <div className="w-80 bg-white border-l border-gray-200 h-screen sticky top-0">
          <TrendingSidebar />
        </div>
      </div>
    </div>
  );
};
```

## State Management

### Custom Hooks

#### useFeed Hook

```typescript
const useFeed = (fid?: number) => {
  const [data, setData] = useState<Cast[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [offset, setOffset] = useState(0);

  const loadMore = useCallback(async () => {
    if (loading || !hasMore) return;

    setLoading(true);
    try {
      const response = await api.get(
        fid ? `/api/v1/feed/${fid}` : "/api/v1/me/feed",
        { params: { offset, limit: 20 } }
      );

      const newCasts = response.data.casts;
      setData((prev) => [...prev, ...newCasts]);
      setOffset((prev) => prev + newCasts.length);
      setHasMore(newCasts.length === 20);
    } catch (error) {
      console.error("Failed to load feed:", error);
    } finally {
      setLoading(false);
    }
  }, [fid, offset, loading, hasMore]);

  return { data, loading, hasMore, loadMore };
};
```

#### useSearch Hook

```typescript
const useSearch = () => {
  const [data, setData] = useState<SearchResults>();
  const [loading, setLoading] = useState(false);

  const search = useCallback(
    async (query: string, type: "all" | "users" | "casts" = "all") => {
      if (!query.trim()) return;

      setLoading(true);
      try {
        const response = await api.get("/api/v1/search", {
          params: { q: query, type },
        });
        setData(response.data);
      } catch (error) {
        console.error("Search failed:", error);
      } finally {
        setLoading(false);
      }
    },
    []
  );

  return { data, loading, search };
};
```

## Navigation Integration

### Router Updates

Update the main router to include social client routes:

```typescript
// In main.tsx or router configuration
const router = createBrowserRouter([
  {
    path: "/login",
    element: <Login />,
  },
  {
    path: "/admin",
    element: <ProtectedRoute />,
    children: [
      { path: "", element: <Dashboard /> },
      { path: "analytics", element: <Analytics /> },
      { path: "jobs", element: <Jobs /> },
      { path: "targets", element: <Targets /> },
      { path: "client-targets", element: <ClientTargets /> },
    ],
  },
  {
    path: "/social",
    element: <ProtectedRoute />,
    children: [
      { path: "", element: <FeedPage /> },
      { path: "search", element: <SearchPage /> },
      { path: "profile/:fid", element: <ProfilePage /> },
    ],
  },
]);
```

### Layout Updates

Update the main layout to include social navigation:

```typescript
const Layout = ({ children }: { children: React.ReactNode }) => {
  const location = useLocation();
  const isSocial = location.pathname.startsWith("/social");

  if (isSocial) {
    return <SocialLayout>{children}</SocialLayout>;
  }

  return <AdminLayout>{children}</AdminLayout>;
};
```

## API Extensions

### New Endpoints Required

#### User Feed for Admin

```typescript
// GET /api/v1/me/feed
// Returns feed for the authenticated admin user
// Uses a default FID or aggregated feed from all targets
```

#### Enhanced Search

```typescript
// GET /api/v1/search/users?q=:query&limit=:limit&offset=:offset
// GET /api/v1/search/casts?q=:query&limit=:limit&offset=:offset
// GET /api/v1/search?q=:query&type=:type&limit=:limit&offset=:offset
```

#### User Activity

```typescript
// GET /api/v1/users/:fid/replies
// GET /api/v1/users/:fid/likes
// GET /api/v1/users/:fid/activity
```

#### Trending Data

```typescript
// GET /api/v1/trending/topics
// GET /api/v1/trending/users
// GET /api/v1/trending/casts
```

## Performance Considerations

### Caching Strategy

- Cache user profiles for 5 minutes
- Cache search results for 2 minutes
- Cache trending data for 15 minutes
- Use React Query for client-side caching

### Optimization

- Implement virtual scrolling for large lists
- Lazy load images and avatars
- Debounce search queries
- Prefetch next page of results

### Database Optimization

- Add full-text search indexes for cast content
- Optimize queries for user feeds
- Consider materialized views for trending data

## Implementation Timeline

### Phase 1: Core Infrastructure (Week 1)

- Set up routing and layout
- Implement basic navigation
- Create core components (CastCard, InfiniteScroll)
- Add required API endpoints

### Phase 2: Feed Implementation (Week 2)

- Implement feed page with infinite scroll
- Add cast interactions
- Implement real-time updates
- Add loading states and error handling

### Phase 3: Search Functionality (Week 3)

- Implement search page
- Add search filters and sorting
- Implement search history
- Add trending topics

### Phase 4: Profile Pages (Week 4)

- Implement user profile pages
- Add activity tabs
- Implement social graph views
- Add profile actions

### Phase 5: Polish and Testing (Week 5)

- Add comprehensive tests
- Optimize performance
- Add accessibility features
- Final UI polish

## Conclusion

This social client addition will transform the admin web app into a comprehensive Farcaster client while maintaining its admin capabilities. The implementation leverages existing API infrastructure and follows React best practices for a scalable, maintainable solution.

The social client will provide users with a familiar Twitter-like experience for browsing their indexed Farcaster content, making the tool more valuable for both administration and daily social media consumption.
