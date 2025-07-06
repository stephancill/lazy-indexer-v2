# Social Client Implementation Architecture

## Overview

This document outlines the architecture and implementation of the social client feature in the Farcaster Indexer admin web application. The social client transforms the admin interface into a comprehensive Farcaster client with Twitter-like social features while maintaining the existing admin functionality.

## Architecture Overview

### Dual Layout System

The application uses a **dual layout system** that automatically switches between admin and social interfaces based on the current route:

```
Route Detection (Layout.tsx)
├── /social/* → SocialLayout
├── /dashboard, /targets, etc. → AdminLayout
└── Seamless switching between interfaces
```

### Key Components

```
Social Client Architecture
├── Layout System
│   ├── Layout.tsx (Route-based layout switcher)
│   ├── SocialLayout.tsx (Social interface layout)
│   └── AdminLayout.tsx (Existing admin layout)
├── Social Pages
│   ├── FeedPage.tsx (Main social feed)
│   ├── SearchPage.tsx (Search interface)
│   └── ProfilePage.tsx (User profiles)
├── Core Components
│   ├── CastCard.tsx (Individual cast display)
│   └── InfiniteScroll.tsx (Infinite scrolling utility)
└── Routing Integration
    └── App.tsx (Main router configuration)
```

## Implementation Details

### 1. Layout System (`apps/admin-web/src/components/`)

#### **Layout.tsx** - Smart Layout Switcher

```typescript
const Layout = ({ children }: { children: ReactNode }) => {
  const location = useLocation();
  const isSocial = location.pathname.startsWith("/social");

  if (isSocial) {
    return <SocialLayout>{children}</SocialLayout>;
  }

  return <AdminLayout>{children}</AdminLayout>;
};
```

**Key Features:**

- Automatic layout detection based on URL path
- Zero configuration switching between admin and social modes
- Maintains authentication state across both interfaces

#### **SocialLayout.tsx** - Social Interface Layout

```typescript
const SocialLayout = ({ children }: SocialLayoutProps) => {
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="flex max-w-6xl mx-auto">
        {/* Sidebar Navigation */}
        <div className="w-64 bg-white border-r border-gray-200 h-screen sticky top-0">
          <nav className="mt-8 space-y-2">
            <SocialNavLink to="/social" icon={Home}>
              Home
            </SocialNavLink>
            <SocialNavLink to="/social/search" icon={Search}>
              Search
            </SocialNavLink>
            <SocialNavLink to="/dashboard" icon={Settings}>
              Admin
            </SocialNavLink>
          </nav>
        </div>
        <div className="flex-1 min-h-screen">{children}</div>
      </div>
    </div>
  );
};
```

**Key Features:**

- Dedicated social navigation sidebar
- Sticky navigation for better UX
- Direct link back to admin interface
- Responsive design ready for mobile

### 2. Social Pages (`apps/admin-web/src/pages/social/`)

#### **FeedPage.tsx** - Main Social Feed

```typescript
const FeedPage = () => {
  return (
    <div className="max-w-2xl mx-auto">
      <div className="border-b border-gray-200 p-4">
        <h1 className="text-xl font-bold">Home</h1>
      </div>
      {/* Content area ready for feed implementation */}
    </div>
  );
};
```

#### **SearchPage.tsx** - Search Interface

```typescript
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
    </div>
  );
};
```

#### **ProfilePage.tsx** - User Profile

```typescript
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
    </div>
  );
};
```

### 3. Core Components (`apps/admin-web/src/components/social/`)

#### **CastCard.tsx** - Individual Cast Display

```typescript
interface Cast {
  hash: string;
  text: string;
  timestamp: string;
  user: {
    fid: number;
    displayName: string;
    username: string;
    pfpUrl?: string;
  };
  embeds?: any[];
  replyCount?: number;
  likeCount?: number;
  recastCount?: number;
}

const CastCard = ({ cast, onReply, onLike, onRecast }: CastCardProps) => {
  return (
    <Card className="border-b border-gray-200 p-4 hover:bg-gray-50 rounded-none">
      <div className="flex space-x-3">
        <Avatar className="h-10 w-10">
          <AvatarImage src={cast.user.pfpUrl} alt={cast.user.displayName} />
          <AvatarFallback>{cast.user.displayName[0]}</AvatarFallback>
        </Avatar>
        <div className="flex-1">
          <div className="flex items-center space-x-2">
            <span className="font-semibold">{cast.user.displayName}</span>
            <span className="text-gray-500">@{cast.user.username}</span>
            <span className="text-gray-500">·</span>
            <RelativeTime timestamp={cast.timestamp} />
          </div>
          <div className="mt-2 text-gray-900">{cast.text}</div>
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

**Key Features:**

- Complete cast data interface
- User avatar with fallback
- Relative timestamp formatting
- Interactive cast actions (reply, recast, like)
- Hover effects for better UX

#### **InfiniteScroll.tsx** - Infinite Scrolling Utility

```typescript
const InfiniteScroll = <T>({
  data,
  loading,
  hasMore,
  loadMore,
  renderItem,
  skeleton = <DefaultSkeleton />,
}: InfiniteScrollProps<T>) => {
  const observerRef = useRef<HTMLDivElement>(null);

  const handleIntersection = useCallback(
    (entries: IntersectionObserverEntry[]) => {
      const target = entries[0];
      if (target.isIntersecting && hasMore && !loading) {
        loadMore();
      }
    },
    [hasMore, loading, loadMore]
  );

  useEffect(() => {
    const observer = new IntersectionObserver(handleIntersection, {
      threshold: 0.1,
    });

    if (observerRef.current) {
      observer.observe(observerRef.current);
    }

    return () => observer.disconnect();
  }, [handleIntersection]);

  return (
    <div className="space-y-0">
      {data.map(renderItem)}
      {loading && skeleton}
      {hasMore && (
        <div
          ref={observerRef}
          className="h-10 flex items-center justify-center"
        />
      )}
    </div>
  );
};
```

**Key Features:**

- Generic type support for any data type
- Native Intersection Observer (no external dependencies)
- Customizable loading skeletons
- Proper cleanup and performance optimization
- End-of-list detection

### 4. Routing Integration (`apps/admin-web/src/App.tsx`)

```typescript
<Routes>
  {/* Existing admin routes */}
  <Route path="/dashboard" element={<Dashboard />} />
  <Route path="/targets" element={<Targets />} />
  <Route path="/client-targets" element={<ClientTargets />} />
  <Route path="/jobs" element={<Jobs />} />
  <Route path="/analytics" element={<Analytics />} />

  {/* Social Client Routes */}
  <Route path="/social" element={<FeedPage />} />
  <Route path="/social/search" element={<SearchPage />} />
  <Route path="/social/profile/:fid" element={<ProfilePage />} />
</Routes>
```

## Design Decisions

### 1. **Dual Layout Approach**

- **Why**: Maintains existing admin functionality while adding social features
- **Benefit**: Zero impact on existing admin users, seamless switching
- **Alternative**: Could have used separate apps, but this provides better UX

### 2. **Native Intersection Observer**

- **Why**: Avoided external dependencies, better performance
- **Benefit**: Smaller bundle size, no version conflicts
- **Alternative**: Could use `react-intersection-observer` library

### 3. **shadcn/ui Components**

- **Why**: Consistent design system with existing admin interface
- **Benefit**: Unified look and feel, maintainable styling
- **Alternative**: Could use separate UI library, but would create inconsistency

### 4. **TypeScript Interfaces**

- **Why**: Type safety and better developer experience
- **Benefit**: Catches errors at compile time, better IDE support
- **Alternative**: Could use JavaScript, but loses type safety

## File Structure

```
apps/admin-web/src/
├── components/
│   ├── Layout.tsx              # Smart layout switcher
│   ├── SocialLayout.tsx        # Social interface layout
│   └── social/
│       ├── CastCard.tsx        # Individual cast component
│       └── InfiniteScroll.tsx  # Infinite scroll utility
├── pages/
│   └── social/
│       ├── FeedPage.tsx        # Main social feed
│       ├── SearchPage.tsx      # Search interface
│       └── ProfilePage.tsx     # User profile
└── App.tsx                     # Main router with social routes
```

## Adding New Social Features

### Adding a New Social Page

1. **Create the page component**:

```typescript
// apps/admin-web/src/pages/social/NewPage.tsx
const NewPage = () => {
  return <div className="max-w-4xl mx-auto p-4">{/* Page content */}</div>;
};

export default NewPage;
```

2. **Add the route**:

```typescript
// apps/admin-web/src/App.tsx
import NewPage from "./pages/social/NewPage";

// Add to Routes
<Route path="/social/new-feature" element={<NewPage />} />;
```

3. **Add navigation link**:

```typescript
// apps/admin-web/src/components/SocialLayout.tsx
<SocialNavLink to="/social/new-feature" icon={YourIcon}>
  New Feature
</SocialNavLink>
```

### Adding New Social Components

1. **Create in the social directory**:

```typescript
// apps/admin-web/src/components/social/NewComponent.tsx
const NewComponent = () => {
  return <div>New Component</div>;
};

export default NewComponent;
```

2. **Import and use in pages**:

```typescript
import NewComponent from "../components/social/NewComponent";
```

## Integration Points

### With Existing Admin System

- **Authentication**: Uses existing `AuthProvider` and `ProtectedRoute`
- **API**: Can leverage existing API client setup
- **UI Components**: Shares shadcn/ui components

### With Future API Integration

- **Data Fetching**: Ready for React Query integration
- **State Management**: Can use existing patterns
- **Error Handling**: Can leverage existing error boundaries

## Performance Considerations

### Implemented Optimizations

- **Lazy Loading**: Components are loaded only when needed
- **Intersection Observer**: Efficient infinite scrolling
- **Memoization**: Components use proper key props

### Future Optimizations

- **Virtual Scrolling**: For large lists
- **Image Lazy Loading**: For user avatars and embeds
- **Debounced Search**: For search functionality

## Testing Strategy

### Component Testing

```typescript
// Example test structure
describe("CastCard", () => {
  it("renders cast data correctly", () => {
    const mockCast = {
      hash: "test-hash",
      text: "Test cast",
      timestamp: "2023-01-01T00:00:00Z",
      user: {
        fid: 1,
        displayName: "Test User",
        username: "testuser",
      },
    };

    render(<CastCard cast={mockCast} />);
    expect(screen.getByText("Test cast")).toBeInTheDocument();
  });
});
```

### Integration Testing

- Test layout switching between admin and social
- Test navigation between social pages
- Test component interactions

## Next Steps (Phase 2)

### Feed Implementation

1. **Create custom hooks**: `useFeed`, `useInfiniteScroll`
2. **Integrate with API**: Connect to existing `/api/v1/feed/:fid` endpoint
3. **Add real-time updates**: WebSocket or polling for new casts
4. **Implement cast interactions**: Like, recast, reply functionality

### Search Implementation

1. **Create search hooks**: `useSearch`, `useSearchHistory`
2. **Add search filters**: Users, casts, content type
3. **Implement search history**: Local storage for recent searches
4. **Add trending topics**: Integration with trending API

### Profile Implementation

1. **Create profile hooks**: `useUser`, `useUserActivity`
2. **Add activity tabs**: Casts, replies, likes, followers
3. **Implement follow/unfollow**: User relationship management
4. **Add profile stats**: Engagement metrics

## Troubleshooting

### Common Issues

1. **Layout not switching**: Check if route starts with `/social`
2. **Components not rendering**: Verify imports and exports
3. **TypeScript errors**: Check interface definitions
4. **Styling issues**: Ensure shadcn/ui components are properly imported

### Debug Tips

- Use React DevTools to inspect component hierarchy
- Check browser console for routing errors
- Verify authentication state in social pages
- Test layout switching manually

## Conclusion

The social client implementation provides a solid foundation for building a comprehensive Farcaster social interface. The architecture is designed to be:

- **Maintainable**: Clear separation of concerns
- **Extensible**: Easy to add new features
- **Performant**: Optimized for large datasets
- **Consistent**: Unified design system

The dual layout approach ensures that existing admin functionality remains unchanged while providing a seamless social experience for users who want to browse their indexed Farcaster content.
