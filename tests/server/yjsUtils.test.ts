import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { WSSharedDoc, cleanupYjsDoc } from '../../server/yjs-utils';

vi.mock('../../server/services/workspaceService', () => ({
  getWorkspace: vi.fn()
}));

vi.mock('../../server/services/permissionService', () => ({
  checkWritePermission: vi.fn()
}));

describe('yjs-utils', () => {
  describe('WSSharedDoc', () => {
    let doc: WSSharedDoc;

    beforeEach(() => {
      doc = new WSSharedDoc('test-workspace');
    });

    afterEach(() => {
      doc.destroy();
    });

    it('should create a document with the given name', () => {
      expect(doc.name).toBe('test-workspace');
    });

    it('should initialize with empty connections map', () => {
      expect(doc.conns.size).toBe(0);
    });

    it('should have awareness instance', () => {
      expect(doc.awareness).toBeDefined();
      expect(doc.awareness.doc).toBe(doc);
    });

    it('should allow setting and getting data', () => {
      const ymap = doc.getMap('test');
      ymap.set('key', 'value');
      expect(ymap.get('key')).toBe('value');
    });

    it('should support text type for code editing', () => {
      const ytext = doc.getText('code');
      ytext.insert(0, 'console.log("hello");');
      expect(ytext.toString()).toBe('console.log("hello");');
    });

    it('should emit update events when document changes', () => {
      const updateHandler = vi.fn();
      doc.on('update', updateHandler);

      const ymap = doc.getMap('test');
      ymap.set('key', 'value');

      expect(updateHandler).toHaveBeenCalled();
    });

    it('should support garbage collection', () => {
      expect(doc.gc).toBe(true);
    });
  });

  describe('cleanupYjsDoc', () => {
    it('should not throw when cleaning up non-existent workspace', () => {
      expect(() => cleanupYjsDoc('non-existent-workspace')).not.toThrow();
    });
  });
});
