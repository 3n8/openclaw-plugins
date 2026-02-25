# Matrix Plugin - Patched Version

This is a patched version of the OpenClaw Matrix channel plugin, maintained locally to add features and fixes that haven't been merged upstream yet.

## Patches Applied

### 1. Multi-Agent Support (Commit: 140dc15)

**Purpose:** Allow multiple Matrix accounts to be used by different agents simultaneously.

**Changes:**
- Added support for multiple accounts in `channel.ts` - Each agent can have its own Matrix account
- Modified `src/matrix/accounts.ts` - Added account resolution based on agent name
- Modified `src/matrix/client/` - Added shared client management for multiple accounts
- Added `matrix/active-client.ts` - Track active Matrix clients per account
- Modified `config-schema.ts` - Support for per-account configuration

**Key Functions Added/Modified:**
- `resolveMatrixAccount()` - Resolve account config by agent name
- `listMatrixAccountIds()` - List all configured Matrix accounts
- `getActiveMatrixClient()` / `getAnyActiveMatrixClient()` - Get Matrix client for specific account

### 2. Matrix Scoped Sessions (Commit: abecc4c)

**Purpose:** Disconnect Matrix sessions from the main agent session lifecycle.

**Changes:**
- Modified `runtime.ts` - Matrix provider now manages its own session lifecycle
- Added separate startup/shutdown handling for Matrix clients
- Sessions now persist independently of agent session state

### 3. Media/Image Upload Support (v2026.2.14)

**Purpose:** Enable agents to upload images and media files to Matrix conversations.

**Changes:**

#### Configuration

Added `mediaLocalRoots` config option to allow specifying additional directories for media uploads:

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

**Default Allowed Directories:**
If not configured, the following directories are allowed by default:
- `/home/en/.openclaw/workspace`
- `/home/en/.openclaw/agents/{agentId}/workspace`
- `/home/en/.openclaw/media`
- `/home/en/.openclaw/sandboxes`
- System temp directory

#### Implementation Details

**1. `src/config-schema.ts`**
- Added `mediaLocalRoots: z.array(z.string()).optional()` to `MatrixConfigSchema`

**2. `src/matrix/send/types.ts`**
- Added `mediaLocalRoots?: readonly string[]` to `MatrixSendOpts` type

**3. `src/matrix/send/client.ts`**
- Added `resolveMediaLocalRoots(accountId?: string)` function
  - Reads `mediaLocalRoots` from account config first
  - Falls back to top-level Matrix config
  - Returns `undefined` if not configured (uses OpenClaw defaults)

**4. `src/matrix/send.ts`**
- Modified to pass `localRoots` to `loadWebMedia()`:
```typescript
const localRoots = opts.mediaLocalRoots ?? resolveMediaLocalRoots(opts.accountId);
const media = await getCore().media.loadWebMedia(opts.mediaUrl, {
  maxBytes,
  localRoots,
});
```

**5. `src/actions.ts` - Account Resolution**
- Updated `extractToolSend` to extract `accountId` from tool args
- Added `effectiveAccountId()` function that:
  1. Uses explicit `accountId` from request if provided
  2. Falls back to matching `gateway.clientName` (agent name) to configured accounts
  3. This ensures each agent uses their own Matrix account

**6. `src/tool-actions.ts`**
- Updated to pass `accountId` through the action chain

**7. `src/matrix/actions/messages.ts`**
- Updated to pass `accountId` to `sendMessageMatrix()`

## How Account Resolution Works

When an agent (e.g., "eisheth") sends a message:

1. The tool call includes `action: "sendMessage"` and potentially `accountId`
2. `extractToolSend()` extracts the `accountId` from tool args
3. If no `accountId` is provided, `handleAction()` matches the `gateway.clientName` to configured accounts
4. The resolved `accountId` is passed through to `sendMatrixMessage()`
5. The correct Matrix client for that account is used to send the message

This ensures that when eisheth sends a message, it goes through `@eisheth:nettsi.de`, not some other account.

## Divergence from Upstream

This plugin diverges from the official OpenClaw Matrix plugin in the following ways:

1. **Multi-account support**: The official plugin may use a single account; this version supports multiple accounts per agent
2. **Session management**: Matrix sessions are scoped independently from agent sessions
3. **Media upload**: Full media/local file upload support with configurable directory allowlists
4. **Account resolution**: Automatic account resolution based on gateway clientName

## Installation

This plugin is installed as a local extension in OpenClaw:

```bash
# The plugin is located at:
# ~/git/openclaw-plugins/matrix-plugin/
# or copied to: ~/opencode/matrix-plugin/
```

## Configuration Example

```json
{
  "channels": {
    "matrix": {
      "enabled": true,
      "mediaLocalRoots": ["/home/en/Downloads"],
      "accounts": {
        "eisheth": {
          "name": "Eisheth",
          "homeserver": "https://matrix.nettsi.de",
          "accessToken": "syt_...",
          "mediaLocalRoots": ["/home/en/.openclaw/agents/eisheth/workspace"]
        },
        "raven": {
          "name": "Raven", 
          "homeserver": "https://matrix.nettsi.de",
          "accessToken": "syt_..."
        }
      }
    }
  }
}
```

## Testing Media Upload

To test that media upload works:

1. Ensure the agent has access to files in allowed directories
2. The agent should reference files using full paths, e.g.:
   - `/home/en/.openclaw/agents/eisheth/workspace/image.png`
   - Or files in any configured `mediaLocalRoots` directory

3. If you see errors like:
   - "Local media path is not under an allowed directory" - The path is not in an allowed directory
   - "Local media file not found" - The file doesn't exist at that path
   - "M_FORBIDDEN: User @X not in room" - The account being used isn't in the room
