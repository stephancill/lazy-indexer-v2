import { useState, useCallback } from "react";

interface CastInteraction {
  castHash: string;
  type: "reply" | "like" | "recast";
  timestamp: string;
}

export const useCastInteractions = () => {
  const [interactions, setInteractions] = useState<CastInteraction[]>([]);

  const trackInteraction = useCallback(
    (castHash: string, type: "reply" | "like" | "recast") => {
      const interaction: CastInteraction = {
        castHash,
        type,
        timestamp: new Date().toISOString(),
      };

      setInteractions((prev) => [...prev, interaction]);

      // In a real implementation, this would send the interaction to the backend
      console.log("Cast interaction tracked:", interaction);
    },
    []
  );

  const handleReply = useCallback(
    (cast: any) => {
      trackInteraction(cast.hash, "reply");
      // TODO: Open reply composer
    },
    [trackInteraction]
  );

  const handleLike = useCallback(
    (cast: any) => {
      trackInteraction(cast.hash, "like");
      // TODO: Send like to backend
    },
    [trackInteraction]
  );

  const handleRecast = useCallback(
    (cast: any) => {
      trackInteraction(cast.hash, "recast");
      // TODO: Send recast to backend
    },
    [trackInteraction]
  );

  return {
    interactions,
    handleReply,
    handleLike,
    handleRecast,
    trackInteraction,
  };
};
