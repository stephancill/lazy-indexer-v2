# farcaster indexing service

## what is farcaster

farcaster is a decentralized social network. it has nodes called hubs that store user state globally. this user data network is also often referred to as "snapchain" because it behaves similarly to a blockchain but the state changes are called snaps.

you can interact with snapchain via gRPC or http. http tends to be more reliable but gRPC tends to have higher rate limits

there are different message types on farcaster.

- user data (pfp, bio, display name, username)
- links (follows)
- reactions (like, recast)
- casts (posts)
- verifications (associated ethereum addresses)

farcaster uses a blockchain for identity management. each farcaster ID (fid) is controlled by a custody address on a smart contract deployed on an ethereum L2 called Optimism. the fid can be transferred to another custody address or recovered by the fid's recovery address by interacting with the IdRegistry smart contract

every message on the farcaster network is cryptographically signed by an eddsa keypair called a signer (aka app key). new signers can be registered for a given FID on the KeyRegistry contract using the FID's custody address

onchain events (signer add/revoke, fid transfer/recovery) are indexed by snapchain and are also exposed via the snapchain interface

hubs also provide an interface to subscribe to messages as they arrive - this uses gRPC and can be very unreliable

## problem

the interfaces for snapchain are not directly useful for most applications. for example, it only exposes methods for looking up messages by user ID e.g.

- castsByFid
- reactionsByFid
- linksByFid
- linksByTargetFid
- userDataByFid
- userNameProofByFid
- verificationsByFid
- onChainSignersByFid

if you want to build a feed for an fid, you need to combine recent casts from all the users a given fid follows. this cannot be done efficiently with these APIs.

## solution

the solution is to index the data into a database and query the database instead.

## requirements

we want to build a farcaster indexer that meets the following requirements

- only indexes the data that the application is interested in
- keeps the data up to date
- backfill can be interrupted and resumed
- can specify multiple hubs to use and when the first is not available (rate limiting/offline), it falls back to the next in one in the list

## stack

the stack that we will use is

- typescript
- bun
- postgres (drizzle)
- bullmq (bullboard for monitoring)
- redis (ioredis)
- docker compose for local dev (redis, postgres)
- hono (for external APIs)

use fetch for http requests. DO NOT USE EXTERNAL LIBRARIES FOR HTTP REQUESTS

## code style

- all source code goes in the src directory. helper libraries go in the src/libs directory
- write clean, maintainable, well organized code
- avoid overcomplicating things

## resources

- https://docs.farcaster.xyz/reference/hubble/httpapi/httpapi
- https://docs.farcaster.xyz/reference/hubble/grpcapi/grpcapi
- https://github.com/taskforcesh/bullmq
- hub 1: hub.merv.fun (GRPC port: 3383, HTTP port: 443)
  grpc: hub.merv.fun:3383
  http: https://hub.merv.fun
- hub 2:
  grpc: snapchain-grpc-api.neynar.com:443
  http: https://snapchain-api.neynar.com

neynar needs an API key. here is example usage
http:
curl -X GET "https://snapchain-api.neynar.com/v1/info" \
 -H "Content-Type: application/json" \
 -H "x-api-key: EF1AC393-F7F1-4A1D-8CEC-9D2192DDD347"

grpc:
import {
createDefaultMetadataKeyInterceptor,
getSSLHubRpcClient,
} from '@farcaster/hub-nodejs';

const client = getSSLHubRpcClient('snapchain-grpc-api.neynar.com:443', {
interceptors: [
createDefaultMetadataKeyInterceptor('x-api-key', 'EF1AC393-F7F1-4A1D-8CEC-9D2192DDD347'),
],
'grpc.max*receive_message_length': 20 * 1024 \_ 1024,
});
