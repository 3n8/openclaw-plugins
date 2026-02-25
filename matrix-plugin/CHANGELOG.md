# Changelog

## 2026.2.14

### Features

- **Media/Image Upload Support**: Added support for uploading images and media files to Matrix conversations (DMs and rooms).

#### Implementation Details

1. **mediaLocalRoots Configuration**: Added `mediaLocalRoots` config option to allow specifying additional directories from which media files can be uploaded.

   ```json
   {
     "channels": {
       "matrix": {
         "mediaLocalRoots": ["/home/en/Downloads", "/tmp"]
       }
     }
   }
   ```

   Or per-account:
   ```json
   {
     "channels": {
       "matrix": {
         "accounts": {
           "eisheth": {
             "mediaLocalRoots": ["/home/en/Downloads"]
           }
         }
       }
     }
   }
   ```

2. **Default Allowed Directories**: If not configured, the following directories are allowed by default:
   - `/home/en/.openclaw/workspace`
   - `/home/en/.openclaw/agents/{agentId}/workspace`
   - `/home/en/.openclaw/media`
   - `/home/en/.openclaw/sandboxes`
   - System temp directory

3. **Account-based Media Resolution**: The plugin now correctly resolves the correct Matrix account for each agent. It first checks for explicit accountId in the request, then falls back to matching the gateway clientName (agent name) to the configured accounts.

#### Technical Changes

- Added `mediaLocalRoots` to `MatrixConfigSchema` in `config-schema.ts`
- Added `resolveMediaLocalRoots()` function in `send/client.ts` to read config
- Updated `send.ts` to pass `localRoots` to `loadWebMedia()`
- Updated `extractToolSend` in `actions.ts` to extract `accountId` from tool args
- Updated `handleAction` in `actions.ts` to resolve accountId from gateway clientName when not provided
- Updated `tool-actions.ts` and `actions/messages.ts` to pass `accountId` through the chain

## 2026.2.13

### Changes

- Version alignment with core OpenClaw release numbers.

## 2026.2.6-3

### Changes

- Version alignment with core OpenClaw release numbers.

## 2026.2.6-2

### Changes

- Version alignment with core OpenClaw release numbers.

## 2026.2.6

### Changes

- Version alignment with core OpenClaw release numbers.

## 2026.2.4

### Changes

- Version alignment with core OpenClaw release numbers.

## 2026.2.2

### Changes

- Version alignment with core OpenClaw release numbers.

## 2026.1.31

### Changes

- Version alignment with core OpenClaw release numbers.

## 2026.1.30

### Changes

- Version alignment with core OpenClaw release numbers.

## 2026.1.29

### Changes

- Version alignment with core OpenClaw release numbers.

## 2026.1.23

### Changes

- Version alignment with core OpenClaw release numbers.

## 2026.1.22

### Changes

- Version alignment with core OpenClaw release numbers.

## 2026.1.21

### Changes

- Version alignment with core OpenClaw release numbers.

## 2026.1.20

### Changes

- Version alignment with core OpenClaw release numbers.

## 2026.1.17-1

### Changes

- Version alignment with core OpenClaw release numbers.

## 2026.1.17

### Changes

- Version alignment with core OpenClaw release numbers.

## 2026.1.16

### Changes

- Version alignment with core OpenClaw release numbers.

## 2026.1.15

### Changes

- Version alignment with core OpenClaw release numbers.

## 2026.1.14

### Features

- Version alignment with core OpenClaw release numbers.
- Matrix channel plugin with homeserver + user ID auth (access token or password login with device name).
- Direct messages with pairing/allowlist/open/disabled policies and allowFrom support.
- Group/room controls: allowlist policy, per-room config, mention gating, auto-reply, per-room skills/system prompts.
- Threads: replyToMode controls and thread replies (off/inbound/always).
- Messaging: text chunking, media uploads with size caps, reactions, polls, typing, and message edits/deletes.
- Actions: read messages, list/remove reactions, pin/unpin/list pins, member info, room info.
- Auto-join invites with allowlist support.
- Status + probe reporting for health checks.
