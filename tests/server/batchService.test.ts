import { describe, it, expect, beforeEach, vi } from 'vitest';
import { queueUpdate, cleanupWorkspaceQueues } from '../../server/services/batchService';
import * as workspaceService from '../../server/services/workspaceService';
import type { WhiteboardElement } from '../../server/types';

vi.mock('../../server/services/workspaceService', () => ({
  workspaceExists: vi.fn(),
}));

const mockWorkspaceExists = workspaceService.workspaceExists as ReturnType<typeof vi.fn>;

function makeElement(id: string, type = 'rect'): WhiteboardElement {
  return { id, type, data: { left: 0, top: 0 } } as WhiteboardElement;
}

describe('batchService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    cleanupWorkspaceQueues(['ws-1', 'ws-2']);
  });

  describe('queueUpdate', () => {
    it('queues elements for an existing workspace', () => {
      mockWorkspaceExists.mockReturnValue(true);

      queueUpdate('ws-1', [makeElement('el-1'), makeElement('el-2')], 'socket-1');
      queueUpdate('ws-1', [makeElement('el-3')], 'socket-2');
      queueUpdate('ws-1', [makeElement('el-1', 'circle')], 'socket-1');

      expect(mockWorkspaceExists).toHaveBeenCalledWith('ws-1');
    });

    it('ignores updates for non-existent workspaces', () => {
      mockWorkspaceExists.mockReturnValue(false);

      queueUpdate('non-existent', [makeElement('el-1')], 'socket-1');

      expect(mockWorkspaceExists).toHaveBeenCalledWith('non-existent');
    });

    it('handles elements without id gracefully', () => {
      mockWorkspaceExists.mockReturnValue(true);

      const noIdElement = { type: 'rect', data: {} } as WhiteboardElement;
      queueUpdate('ws-1', [noIdElement], 'socket-1');
    });

    it('deduplicates elements by id (last write wins)', () => {
      mockWorkspaceExists.mockReturnValue(true);

      const el1v1 = makeElement('el-1', 'rect');
      const el1v2 = makeElement('el-1', 'circle');

      queueUpdate('ws-1', [el1v1], 'socket-1');
      queueUpdate('ws-1', [el1v2], 'socket-2');
    });

    it('tracks multiple senders', () => {
      mockWorkspaceExists.mockReturnValue(true);

      queueUpdate('ws-1', [makeElement('el-1')], 'socket-1');
      queueUpdate('ws-1', [makeElement('el-2')], 'socket-2');
      queueUpdate('ws-1', [makeElement('el-3')], 'socket-1');
    });
  });

  describe('cleanupWorkspaceQueues', () => {
    it('removes queues for specified workspace ids', () => {
      mockWorkspaceExists.mockReturnValue(true);

      queueUpdate('ws-1', [makeElement('el-1')], 'socket-1');
      queueUpdate('ws-2', [makeElement('el-2')], 'socket-2');

      cleanupWorkspaceQueues(['ws-1']);

      queueUpdate('ws-2', [makeElement('el-3')], 'socket-2');
    });

    it('handles empty array', () => {
      cleanupWorkspaceQueues([]);
    });

    it('handles non-existent workspace ids', () => {
      cleanupWorkspaceQueues(['non-existent-1', 'non-existent-2']);
    });
  });
});
