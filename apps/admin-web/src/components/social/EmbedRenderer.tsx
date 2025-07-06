import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ExternalLink, Play, Link as LinkIcon } from "lucide-react";

interface Embed {
  url: string;
  type?: string;
  title?: string;
  description?: string;
  image?: string;
}

interface EmbedRendererProps {
  embeds: string | Embed[];
}

const EmbedRenderer = ({ embeds }: EmbedRendererProps) => {
  // Parse embeds if it's a JSON string
  let parsedEmbeds: Embed[] = [];

  try {
    if (typeof embeds === "string") {
      if (embeds.trim() === "" || embeds === "[]") {
        return null;
      }
      const parsed = JSON.parse(embeds);
      parsedEmbeds = Array.isArray(parsed) ? parsed : [];
    } else if (Array.isArray(embeds)) {
      parsedEmbeds = embeds;
    } else {
      // Handle unexpected types
      console.warn("Unexpected embeds type:", typeof embeds, embeds);
      return null;
    }
  } catch (error) {
    console.error("Failed to parse embeds:", error, "Raw embeds:", embeds);
    return null;
  }

  if (!parsedEmbeds || parsedEmbeds.length === 0) {
    return null;
  }

  return (
    <div className="mt-2 sm:mt-3 space-y-2">
      {parsedEmbeds
        .filter((embed) => embed?.url && typeof embed.url === "string")
        .map((embed, index) => (
          <EmbedItem key={`${embed.url}-${index}`} embed={embed} />
        ))}
    </div>
  );
};

const EmbedItem = ({ embed }: { embed: Embed }) => {
  const { url } = embed;

  // Skip if no URL is provided
  if (!url || typeof url !== "string") {
    return null;
  }

  // Determine embed type based on URL
  const getEmbedType = (url: string) => {
    if (url.includes("stream.farcaster.xyz") || url.includes(".m3u8")) {
      return "video";
    }
    if (
      url.includes("imagedelivery.net") ||
      url.match(/\.(jpg|jpeg|png|gif|webp)$/i)
    ) {
      return "image";
    }
    if (url.includes("youtube.com") || url.includes("youtu.be")) {
      return "youtube";
    }
    return "link";
  };

  const embedType = getEmbedType(url);

  switch (embedType) {
    case "image": {
      return (
        <Card className="overflow-hidden border border-gray-200 rounded-lg">
          <img
            src={url}
            alt="Embedded content"
            className="w-full max-h-64 sm:max-h-96 object-cover"
            onError={(e) => {
              // Fallback if image fails to load
              const target = e.target as HTMLImageElement;
              target.style.display = "none";
            }}
          />
        </Card>
      );
    }

    case "video": {
      return (
        <Card className="p-3 sm:p-4 border border-gray-200 rounded-lg">
          <div className="flex items-center space-x-3">
            <div className="flex-shrink-0">
              <div className="w-10 h-10 sm:w-12 sm:h-12 bg-blue-100 rounded-full flex items-center justify-center">
                <Play className="w-5 h-5 sm:w-6 sm:h-6 text-blue-600" />
              </div>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-900">Video Content</p>
              <p className="text-xs sm:text-sm text-gray-500 truncate">
                {url.includes("stream.farcaster.xyz")
                  ? "Farcaster Video"
                  : "Video"}
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => window.open(url, "_blank")}
              className="flex-shrink-0"
            >
              <ExternalLink className="w-4 h-4" />
            </Button>
          </div>
        </Card>
      );
    }

    case "youtube": {
      const getYouTubeId = (url: string) => {
        const match = url.match(
          /(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&\n?#]+)/
        );
        return match ? match[1] : null;
      };

      const youtubeId = getYouTubeId(url);

      if (youtubeId) {
        return (
          <Card className="overflow-hidden border border-gray-200 rounded-lg">
            <iframe
              src={`https://www.youtube.com/embed/${youtubeId}`}
              title="YouTube video"
              className="w-full h-36 sm:h-48 md:h-56"
              frameBorder="0"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
          </Card>
        );
      }
      break;
    }

    default: {
      // Generic link preview
      const getDomain = (url: string) => {
        try {
          return new URL(url).hostname;
        } catch {
          return url;
        }
      };

      return (
        <Button
          variant="ghost"
          className="w-full p-3 sm:p-4 h-auto border border-gray-200 hover:bg-gray-50 transition-colors rounded-lg"
          onClick={() => window.open(url, "_blank")}
        >
          <div className="flex items-center space-x-3 w-full">
            <div className="flex-shrink-0">
              <div className="w-10 h-10 sm:w-12 sm:h-12 bg-gray-100 rounded-full flex items-center justify-center">
                <LinkIcon className="w-5 h-5 sm:w-6 sm:h-6 text-gray-600" />
              </div>
            </div>
            <div className="flex-1 min-w-0 text-left">
              <p className="text-sm font-medium text-gray-900 truncate">
                {embed.title || getDomain(url)}
              </p>
              <p className="text-xs sm:text-sm text-gray-500 truncate">
                {embed.description || getDomain(url)}
              </p>
            </div>
            <ExternalLink className="w-4 h-4 text-gray-400 flex-shrink-0" />
          </div>
        </Button>
      );
    }
  }

  return null;
};

export default EmbedRenderer;
