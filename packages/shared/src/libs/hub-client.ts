import { config } from '../config.js';
import type {
  HubConfig,
  FarcasterMessage,
  FarcasterEvent,
  CastMessage,
  ReactionMessage,
  LinkMessage,
  VerificationMessage,
  UserDataMessage,
  UsernameProofMessage,
  OnChainEvent,
  HubInfoResponse,
  PaginatedResponse,
  PaginatedEventsResponse,
} from '../types.js';

// Rate limiting and retry configuration
const RATE_LIMIT_DELAY = 1000; // 1 second
const MAX_RETRIES = 3;
const RETRY_DELAY_BASE = 1000; // 1 second
const REQUEST_TIMEOUT = 30000; // 30 seconds

export class HubClient {
  private currentHubIndex = 0;
  private rateLimitUntil: number = 0;
  private requestCount = 0;
  private lastRequestTime = 0;

  constructor(private hubs: HubConfig[] = config.hubs) {
    if (this.hubs.length === 0) {
      throw new Error('At least one hub configuration is required');
    }
  }

  // Main request method with fallback logic
  async request<T>(
    endpoint: string,
    options: RequestInit = {},
    retryCount = 0
  ): Promise<T> {
    const hub = this.hubs[this.currentHubIndex];
    const url = `${hub.url}${endpoint}`;

    // Rate limiting
    await this.handleRateLimit();

    // Apply hub-specific request transformations
    const transformedOptions = hub.transformRequest
      ? hub.transformRequest(options)
      : options;

    // Add default headers
    const requestOptions: RequestInit = {
      ...transformedOptions,
      headers: {
        'Content-Type': 'application/json',
        ...transformedOptions.headers,
      },
    };

    // Add timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT);
    requestOptions.signal = controller.signal;

    try {
      console.log(`Making request to ${url} (hub ${this.currentHubIndex + 1}/${this.hubs.length})`);
      
      const response = await fetch(url, requestOptions);
      clearTimeout(timeoutId);

      // Update rate limiting info
      this.updateRateLimit(response);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      
      // Reset hub index on successful request
      this.currentHubIndex = 0;
      
      return data;
    } catch (error) {
      clearTimeout(timeoutId);
      
      console.warn(`Request failed for hub ${this.currentHubIndex + 1}:`, error);

      // Try next hub if available
      if (this.currentHubIndex < this.hubs.length - 1) {
        this.currentHubIndex++;
        return this.request<T>(endpoint, options, retryCount);
      }

      // If all hubs failed, retry with exponential backoff
      if (retryCount < MAX_RETRIES) {
        console.log(`Retrying request (attempt ${retryCount + 1}/${MAX_RETRIES})`);
        
        const delay = RETRY_DELAY_BASE * Math.pow(2, retryCount);
        await new Promise(resolve => setTimeout(resolve, delay));
        
        // Reset to first hub for retry
        this.currentHubIndex = 0;
        return this.request<T>(endpoint, options, retryCount + 1);
      }

      throw new Error(`All hubs failed after ${MAX_RETRIES} retries: ${error}`);
    }
  }

  // Rate limiting helpers
  private async handleRateLimit() {
    const now = Date.now();
    
    // Check if we need to wait due to rate limiting
    if (now < this.rateLimitUntil) {
      const waitTime = this.rateLimitUntil - now;
      console.log(`Rate limited, waiting ${waitTime}ms`);
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }

    // Basic rate limiting: don't make more than 1 request per second
    if (now - this.lastRequestTime < RATE_LIMIT_DELAY) {
      const waitTime = RATE_LIMIT_DELAY - (now - this.lastRequestTime);
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }

    this.lastRequestTime = Date.now();
    this.requestCount++;
  }

  private updateRateLimit(response: Response) {
    // Check for rate limit headers (handle case where headers might not be available in tests)
    if (!response.headers) return;
    
    const rateLimitRemaining = response.headers.get('x-ratelimit-remaining');
    const rateLimitReset = response.headers.get('x-ratelimit-reset');
    
    if (rateLimitRemaining === '0' && rateLimitReset) {
      this.rateLimitUntil = parseInt(rateLimitReset) * 1000;
    }

    // Handle 429 Too Many Requests
    if (response.status === 429) {
      const retryAfter = response.headers.get('retry-after');
      if (retryAfter) {
        this.rateLimitUntil = Date.now() + parseInt(retryAfter) * 1000;
      } else {
        this.rateLimitUntil = Date.now() + 60000; // Default 1 minute
      }
    }
  }

  // Hub info and health check
  async getHubInfo(): Promise<HubInfoResponse> {
    return this.request<HubInfoResponse>('/v1/info');
  }

  async getHubHealth(): Promise<{ healthy: boolean; version: string }> {
    try {
      const info = await this.getHubInfo();
      return {
        healthy: true,
        version: info.version,
      };
    } catch (error) {
      return {
        healthy: false,
        version: 'unknown',
      };
    }
  }

  // Message retrieval methods
  async getCastsByFid(
    fid: number,
    options: { pageSize?: number; pageToken?: string; reverse?: boolean } = {}
  ): Promise<PaginatedResponse<CastMessage>> {
    const params = new URLSearchParams();
    params.append('fid', fid.toString());
    
    if (options.pageSize) params.append('pageSize', options.pageSize.toString());
    if (options.pageToken) params.append('pageToken', options.pageToken);
    if (options.reverse) params.append('reverse', 'true');

    return this.request<PaginatedResponse<CastMessage>>(`/v1/castsByFid?${params}`);
  }

  async getAllCastsByFid(fid: number): Promise<CastMessage[]> {
    const messages: CastMessage[] = [];
    let pageToken: string | undefined;

    do {
      const response = await this.getCastsByFid(fid, {
        pageSize: 1000,
        pageToken,
      });

      messages.push(...response.messages);
      pageToken = response.nextPageToken;
    } while (pageToken);

    return messages;
  }

  async getReactionsByFid(
    fid: number,
    options: { pageSize?: number; pageToken?: string; reverse?: boolean; reactionType?: string } = {}
  ): Promise<PaginatedResponse<ReactionMessage>> {
    const params = new URLSearchParams();
    params.append('fid', fid.toString());
    
    if (options.pageSize) params.append('pageSize', options.pageSize.toString());
    if (options.pageToken) params.append('pageToken', options.pageToken);
    if (options.reverse) params.append('reverse', 'true');
    if (options.reactionType) params.append('reaction_type', options.reactionType);

    return this.request<PaginatedResponse<ReactionMessage>>(`/v1/reactionsByFid?${params}`);
  }

  async getAllReactionsByFid(fid: number): Promise<ReactionMessage[]> {
    const messages: ReactionMessage[] = [];
    let pageToken: string | undefined;

    do {
      const response = await this.getReactionsByFid(fid, {
        pageSize: 1000,
        pageToken,
      });

      messages.push(...response.messages);
      pageToken = response.nextPageToken;
    } while (pageToken);

    return messages;
  }

  async getLinksByFid(
    fid: number,
    options: { pageSize?: number; pageToken?: string; reverse?: boolean; linkType?: string } = {}
  ): Promise<PaginatedResponse<LinkMessage>> {
    const params = new URLSearchParams();
    params.append('fid', fid.toString());
    
    if (options.pageSize) params.append('pageSize', options.pageSize.toString());
    if (options.pageToken) params.append('pageToken', options.pageToken);
    if (options.reverse) params.append('reverse', 'true');
    if (options.linkType) params.append('link_type', options.linkType);

    return this.request<PaginatedResponse<LinkMessage>>(`/v1/linksByFid?${params}`);
  }

  async getAllLinksByFid(fid: number): Promise<LinkMessage[]> {
    const messages: LinkMessage[] = [];
    let pageToken: string | undefined;

    do {
      const response = await this.getLinksByFid(fid, {
        pageSize: 1000,
        pageToken,
      });

      messages.push(...response.messages);
      pageToken = response.nextPageToken;
    } while (pageToken);

    return messages;
  }

  async getVerificationsByFid(
    fid: number,
    options: { pageSize?: number; pageToken?: string; reverse?: boolean } = {}
  ): Promise<PaginatedResponse<VerificationMessage>> {
    const params = new URLSearchParams();
    params.append('fid', fid.toString());
    
    if (options.pageSize) params.append('pageSize', options.pageSize.toString());
    if (options.pageToken) params.append('pageToken', options.pageToken);
    if (options.reverse) params.append('reverse', 'true');

    return this.request<PaginatedResponse<VerificationMessage>>(`/v1/verificationsByFid?${params}`);
  }

  async getAllVerificationsByFid(fid: number): Promise<VerificationMessage[]> {
    const messages: VerificationMessage[] = [];
    let pageToken: string | undefined;

    do {
      const response = await this.getVerificationsByFid(fid, {
        pageSize: 1000,
        pageToken,
      });

      messages.push(...response.messages);
      pageToken = response.nextPageToken;
    } while (pageToken);

    return messages;
  }

  async getUserDataByFid(
    fid: number,
    options: { pageSize?: number; pageToken?: string; reverse?: boolean } = {}
  ): Promise<PaginatedResponse<UserDataMessage>> {
    const params = new URLSearchParams();
    params.append('fid', fid.toString());
    
    if (options.pageSize) params.append('pageSize', options.pageSize.toString());
    if (options.pageToken) params.append('pageToken', options.pageToken);
    if (options.reverse) params.append('reverse', 'true');

    return this.request<PaginatedResponse<UserDataMessage>>(`/v1/userDataByFid?${params}`);
  }

  async getAllUserDataByFid(fid: number): Promise<UserDataMessage[]> {
    const messages: UserDataMessage[] = [];
    let pageToken: string | undefined;

    do {
      const response = await this.getUserDataByFid(fid, {
        pageSize: 1000,
        pageToken,
      });

      messages.push(...response.messages);
      pageToken = response.nextPageToken;
    } while (pageToken);

    return messages;
  }

  async getOnChainSignersByFid(
    fid: number,
    options: { pageSize?: number; pageToken?: string; reverse?: boolean } = {}
  ): Promise<PaginatedEventsResponse<OnChainEvent>> {
    const params = new URLSearchParams();
    params.append('fid', fid.toString());
    
    if (options.pageSize) params.append('pageSize', options.pageSize.toString());
    if (options.pageToken) params.append('pageToken', options.pageToken);
    if (options.reverse) params.append('reverse', 'true');

    return this.request<PaginatedEventsResponse<OnChainEvent>>(`/v1/onChainSignersByFid?${params}`);
  }

  async getAllOnChainSignersByFid(fid: number): Promise<OnChainEvent[]> {
    const events: OnChainEvent[] = [];
    let pageToken: string | undefined;

    do {
      const response = await this.getOnChainSignersByFid(fid, {
        pageSize: 1000,
        pageToken,
      });

      events.push(...response.events);
      pageToken = response.nextPageToken;
    } while (pageToken);

    return events;
  }

  // Event streaming for real-time updates
  async getEvents(
    options: { fromEventId?: number; pageSize?: number; pageToken?: string } = {}
  ): Promise<PaginatedEventsResponse<FarcasterEvent>> {
    const params = new URLSearchParams();
    
    if (options.fromEventId) params.append('from_event_id', options.fromEventId.toString());
    if (options.pageSize) params.append('pageSize', options.pageSize.toString());
    if (options.pageToken) params.append('pageToken', options.pageToken);

    return this.request<PaginatedEventsResponse<FarcasterEvent>>(`/v1/events?${params}`);
  }

  // Bulk data retrieval for a target FID
  async getAllDataByFid(fid: number) {
    console.log(`Fetching all data for FID ${fid}`);
    
    const [casts, reactions, links, verifications, userData, onChainSigners] = await Promise.all([
      this.getAllCastsByFid(fid),
      this.getAllReactionsByFid(fid),
      this.getAllLinksByFid(fid),
      this.getAllVerificationsByFid(fid),
      this.getAllUserDataByFid(fid),
      this.getAllOnChainSignersByFid(fid),
    ]);

    return {
      casts,
      reactions,
      links,
      verifications,
      userData,
      onChainSigners,
    };
  }

  // Utility methods
  getCurrentHub(): HubConfig {
    return this.hubs[this.currentHubIndex];
  }

  getStats() {
    return {
      currentHubIndex: this.currentHubIndex,
      requestCount: this.requestCount,
      rateLimitUntil: this.rateLimitUntil,
      isRateLimited: Date.now() < this.rateLimitUntil,
    };
  }

  // Reset client state
  reset() {
    this.currentHubIndex = 0;
    this.rateLimitUntil = 0;
    this.requestCount = 0;
    this.lastRequestTime = 0;
  }
}

// Export a singleton instance
export const hubClient = new HubClient();

// Export utilities for testing
export { RATE_LIMIT_DELAY, MAX_RETRIES, REQUEST_TIMEOUT };