import type { AgentToolResult } from "@mariozechner/pi-agent-core";
import {
  createActionGate,
  jsonResult,
  readNumberParam,
  readReactionParams,
  readStringParam,
} from "openclaw/plugin-sdk";
import type { CoreConfig } from "./types.js";
import {
  deleteMatrixMessage,
  editMatrixMessage,
  getMatrixMemberInfo,
  getMatrixRoomInfo,
  listMatrixPins,
  listMatrixReactions,
  pinMatrixMessage,
  readMatrixMessages,
  removeMatrixReactions,
  sendMatrixMessage,
  unpinMatrixMessage,
} from "./matrix/actions.js";
import { reactMatrixMessage } from "./matrix/send.js";

const messageActions = new Set(["sendMessage", "editMessage", "deleteMessage", "readMessages"]);
const reactionActions = new Set(["react", "reactions"]);
const pinActions = new Set(["pinMessage", "unpinMessage", "listPins"]);

function readRoomId(params: Record<string, unknown>, required = true): string {
  const direct = readStringParam(params, "roomId") ?? readStringParam(params, "channelId");
  if (direct) {
    return direct;
  }
  if (!required) {
    return readStringParam(params, "to") ?? "";
  }
  return readStringParam(params, "to", { required: true });
}

export async function handleMatrixAction(
  params: Record<string, unknown>,
  cfg: CoreConfig,
): Promise<AgentToolResult<unknown>> {
  const action = readStringParam(params, "action", { required: true });
  const isActionEnabled = createActionGate(cfg.channels?.matrix?.actions);

  if (reactionActions.has(action)) {
    if (!isActionEnabled("reactions")) {
      throw new Error("Matrix reactions are disabled.");
    }
    const roomId = readRoomId(params);
    const accountId = readStringParam(params, "accountId");
    let messageId = readStringParam(params, "target", { required: false }) 
      ?? readStringParam(params, "messageId", { required: false })
      ?? readStringParam(params, "message_id", { required: false });
    const emoji = readStringParam(params, "emoji", { required: false });
    const emojisParam = readStringParam(params, "emojis", { required: false });
    
    console.log("[REACT-DEBUG] === REACTION CALL ===");
    console.log("[REACT-DEBUG] action:", action, "roomId:", roomId, "target:", messageId, "accountId:", accountId);
    console.log("[REACT-DEBUG] emoji param:", emoji, "emojis param:", emojisParam);
    
    const isPlaceholderId = messageId && (
      messageId.startsWith("$INPUT") || 
      messageId.startsWith("$LATEST") ||
      messageId.startsWith("Queued") ||
      messageId.startsWith("$LA:") ||  // Eden/platform message IDs
      messageId.startsWith("$") && !messageId.includes(":nettsi") // Any $ prefix without valid Matrix room
    );
    if ((!messageId || messageId.trim() === "" || isPlaceholderId) && reactionActions.has(action)) {
      console.log("[REACT-DEBUG] target is placeholder or empty, fetching last message, roomId:", roomId, "accountId:", accountId);
      const result = await readMatrixMessages(roomId, { 
        limit: 5, 
        accountId: accountId ?? undefined,
      });
      const messages = result?.messages;
      console.log("[REACT-DEBUG] Got messages:", messages?.map(m => ({ eventId: m.eventId, body: m.body?.substring(0, 30) })));
      if (messages && messages.length > 0) {
        messageId = messages[0].eventId;
        console.log("[REACT-DEBUG] Set messageId to:", messageId);
      }
      if (!messageId) {
        throw new Error("Could not find a message to react to. Please provide a messageId.");
      }
    }
    
    if (action === "react") {
      const { emoji, remove, isEmpty } = readReactionParams(params, {
        removeErrorMessage: "Emoji is required to remove a Matrix reaction.",
      });
      
      const emojisParam = readStringParam(params, "emojis", { required: false });
      let emojis: string[] = [];
      
      if (emojisParam) {
        emojis = emojisParam.split(",").map(e => e.trim()).filter(e => e);
      } else if (emoji) {
        if (emoji.includes(",")) {
          emojis = emoji.split(",").map(e => e.trim()).filter(e => e);
        } else {
          emojis = [emoji];
        }
      }
      
      console.log("[REACT-DEBUG] Reacting with emojis:", emojis, "to messageId:", messageId, "accountId:", accountId);
      
      if (remove || isEmpty) {
        const result = await removeMatrixReactions(roomId, messageId!, {
          emoji: remove ? emoji : undefined,
        });
        return jsonResult({ ok: true, removed: result.removed });
      }
      
      if (emojis.length === 0) {
        throw new Error("Emoji is required to add a Matrix reaction.");
      }
      
      const added: string[] = [];
      for (const e of emojis) {
        await reactMatrixMessage(roomId, messageId!, e, accountId ?? undefined);
        added.push(e);
      }
      
      console.log("[REACT-DEBUG] Successfully added reactions:", added);
      return jsonResult({ ok: true, added });
    }
    const reactions = await listMatrixReactions(roomId, messageId!);
    return jsonResult({ ok: true, reactions });
  }

  if (messageActions.has(action)) {
    if (!isActionEnabled("messages")) {
      throw new Error("Matrix messages are disabled.");
    }
    switch (action) {
      case "sendMessage": {
        const to = readStringParam(params, "to", { required: true });
        const content = readStringParam(params, "content", {
          required: true,
          allowEmpty: true,
        });
        const mediaUrl = readStringParam(params, "mediaUrl");
        const mediaLocalRoots = readStringParam(params, "mediaLocalRoots")
          ? (JSON.parse(readStringParam(params, "mediaLocalRoots")!) as string[])
          : undefined;
        const replyToId =
          readStringParam(params, "replyToId") ?? readStringParam(params, "replyTo");
        const threadId = readStringParam(params, "threadId");
        const accountId = readStringParam(params, "accountId");
        const result = await sendMatrixMessage(to, content, {
          mediaUrl: mediaUrl ?? undefined,
          mediaLocalRoots: mediaLocalRoots ?? undefined,
          replyToId: replyToId ?? undefined,
          threadId: threadId ?? undefined,
          accountId: accountId ?? undefined,
        });
        return jsonResult({ ok: true, result });
      }
      case "editMessage": {
        const roomId = readRoomId(params);
        const messageId = readStringParam(params, "messageId", { required: true });
        const content = readStringParam(params, "content", { required: true });
        const result = await editMatrixMessage(roomId, messageId, content);
        return jsonResult({ ok: true, result });
      }
      case "deleteMessage": {
        const roomId = readRoomId(params);
        const messageId = readStringParam(params, "messageId", { required: true });
        const reason = readStringParam(params, "reason");
        await deleteMatrixMessage(roomId, messageId, { reason: reason ?? undefined });
        return jsonResult({ ok: true, deleted: true });
      }
      case "readMessages": {
        const roomId = readRoomId(params);
        const limit = readNumberParam(params, "limit", { integer: true });
        const before = readStringParam(params, "before");
        const after = readStringParam(params, "after");
        const result = await readMatrixMessages(roomId, {
          limit: limit ?? undefined,
          before: before ?? undefined,
          after: after ?? undefined,
        });
        return jsonResult({ ok: true, ...result });
      }
      default:
        break;
    }
  }

  if (pinActions.has(action)) {
    if (!isActionEnabled("pins")) {
      throw new Error("Matrix pins are disabled.");
    }
    const roomId = readRoomId(params);
    if (action === "pinMessage") {
      const messageId = readStringParam(params, "messageId", { required: true });
      const result = await pinMatrixMessage(roomId, messageId);
      return jsonResult({ ok: true, pinned: result.pinned });
    }
    if (action === "unpinMessage") {
      const messageId = readStringParam(params, "messageId", { required: true });
      const result = await unpinMatrixMessage(roomId, messageId);
      return jsonResult({ ok: true, pinned: result.pinned });
    }
    const result = await listMatrixPins(roomId);
    return jsonResult({ ok: true, pinned: result.pinned, events: result.events });
  }

  if (action === "memberInfo") {
    if (!isActionEnabled("memberInfo")) {
      throw new Error("Matrix member info is disabled.");
    }
    const userId = readStringParam(params, "userId", { required: true });
    const roomId = readStringParam(params, "roomId") ?? readStringParam(params, "channelId");
    const result = await getMatrixMemberInfo(userId, {
      roomId: roomId ?? undefined,
    });
    return jsonResult({ ok: true, member: result });
  }

  if (action === "channelInfo") {
    if (!isActionEnabled("channelInfo")) {
      throw new Error("Matrix room info is disabled.");
    }
    const roomId = readRoomId(params);
    const result = await getMatrixRoomInfo(roomId);
    return jsonResult({ ok: true, room: result });
  }

  throw new Error(`Unsupported Matrix action: ${action}`);
}
