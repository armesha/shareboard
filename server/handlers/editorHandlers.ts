import { config, SOCKET_EVENTS } from '../config';
import { withWorkspaceAuth } from '../middleware/socketAuth';
import type { Handler, CodeUpdateData, HandlerResult } from '../types';

export const MAX_CODE_LENGTH = config.validation.workspace.maxCodeLength;
const MAX_LANGUAGE_LENGTH = config.validation.workspace.maxLanguageLength;

const handleCodeUpdateCore: Handler<CodeUpdateData> = (
  { workspaceId, language, content },
  { socket, workspace }
): HandlerResult => {
  try {
    if (content !== undefined && (typeof content !== 'string' || content.length > MAX_CODE_LENGTH)) {
      socket.emit(SOCKET_EVENTS.ERROR, { message: 'Invalid code content' });
      return { success: false, reason: 'invalid_content' };
    }

    if (typeof language !== 'string' || language.length > MAX_LANGUAGE_LENGTH) {
      socket.emit(SOCKET_EVENTS.ERROR, { message: 'Invalid language' });
      return { success: false, reason: 'invalid_language' };
    }

    if (!workspace) {
      return { success: false, reason: 'workspace_not_found' };
    }

    if (!workspace.codeSnippets) {
      workspace.codeSnippets = { language: 'javascript', content: '' };
    }
    workspace.codeSnippets.language = language;
    if (content !== undefined) {
      workspace.codeSnippets.content = content;
    }
    socket.broadcast.to(workspaceId).emit(SOCKET_EVENTS.CODE_UPDATE, { language, content });

    return { success: true };
  } catch (error) {
    socket.emit(SOCKET_EVENTS.ERROR, { message: 'Failed to update code' });
    return { success: false, error };
  }
};

export const handleCodeUpdate = withWorkspaceAuth(handleCodeUpdateCore, {
  permissionErrorMessage: 'You do not have permission to edit code'
});
