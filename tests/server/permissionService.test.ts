import { describe, it, expect } from 'vitest';
import {
  checkWritePermission,
  checkOwnership,
  calculateEditAccess,
  getSharingInfo,
  validateAndSetToken
} from '../../server/services/permissionService';
import { SHARING_MODES } from '../../server/config';
import type { Workspace, User } from '../../server/types';
import type { SharingMode } from '../../shared/constants';

describe('permissionService', () => {
  describe('checkWritePermission', () => {
    it('checks ownership, tokens, and handles invalid inputs', () => {
      const workspace: Partial<Workspace> = { owner: 'owner-123', sharingMode: SHARING_MODES.READ_WRITE_SELECTED as SharingMode, editToken: 'edit_token123', allowedUsers: [] };
      const ownerUser: User = { userId: 'owner-123', accessToken: null };
      const regularUser: User = { userId: 'user-456', accessToken: null };

      expect(checkWritePermission(workspace as Workspace, ownerUser)).toBe(true);
      regularUser.accessToken = 'edit_token123';
      expect(checkWritePermission(workspace as Workspace, regularUser)).toBe(true);
      regularUser.accessToken = null;
      expect(checkWritePermission(workspace as Workspace, regularUser)).toBe(false);

      expect(checkWritePermission(null, regularUser)).toBe(false);
      expect(checkWritePermission(workspace as Workspace, null)).toBe(false);
    });
  });

  describe('checkWritePermission with sharing modes', () => {
    it('validates different sharing modes', () => {
      const workspace: Partial<Workspace> = { owner: 'owner-123', sharingMode: SHARING_MODES.READ_ONLY as SharingMode, editToken: 'edit_token123', allowedUsers: [] };
      const ownerUser: User = { userId: 'owner-123', accessToken: null };
      const regularUser: User = { userId: 'user-456', accessToken: null };
      const userWithToken: User = { userId: 'user-789', accessToken: 'edit_token123' };

      expect(checkWritePermission(workspace as Workspace, ownerUser)).toBe(true);
      expect(checkWritePermission(workspace as Workspace, regularUser)).toBe(false);
      expect(checkWritePermission(workspace as Workspace, userWithToken)).toBe(false);

      workspace.sharingMode = SHARING_MODES.READ_WRITE_ALL as SharingMode;
      expect(checkWritePermission(workspace as Workspace, regularUser)).toBe(true);

      workspace.sharingMode = SHARING_MODES.READ_WRITE_SELECTED as SharingMode;
      expect(checkWritePermission(workspace as Workspace, userWithToken)).toBe(true);
      expect(checkWritePermission(workspace as Workspace, regularUser)).toBe(false);

      workspace.sharingMode = 'invalid' as SharingMode;
      expect(checkWritePermission(workspace as Workspace, regularUser)).toBe(false);
    });
  });

  describe('checkOwnership', () => {
    it('verifies ownership and handles invalid inputs', () => {
      const workspace: Partial<Workspace> = { owner: 'owner-123' };

      expect(checkOwnership(workspace as Workspace, 'owner-123')).toBe(true);
      expect(checkOwnership(workspace as Workspace, 'user-456')).toBe(false);
      expect(checkOwnership(null, 'owner-123')).toBe(false);
      expect(checkOwnership(workspace as Workspace, null as unknown as string)).toBe(false);
      expect(checkOwnership(workspace as Workspace, '')).toBe(false);
    });
  });

  describe('calculateEditAccess', () => {
    it('calculates access based on ownership and token', () => {
      const workspace: Partial<Workspace> = { owner: 'owner-123', sharingMode: SHARING_MODES.READ_WRITE_SELECTED as SharingMode, editToken: 'edit_secret123' };
      const ownerUser: User = { userId: 'owner-123' };
      const regularUser: User = { userId: 'user-456' };

      expect(calculateEditAccess(workspace as Workspace, ownerUser, null)).toEqual({ hasEditAccess: true, isOwner: true });
      expect(calculateEditAccess(workspace as Workspace, regularUser, 'edit_secret123')).toEqual({ hasEditAccess: true, isOwner: false });
      expect(calculateEditAccess(workspace as Workspace, regularUser, 'invalid')).toEqual({ hasEditAccess: false, isOwner: false });
      expect(calculateEditAccess(workspace as Workspace, regularUser, null)).toEqual({ hasEditAccess: false, isOwner: false });
      expect(calculateEditAccess(null, regularUser, 'edit_token')).toEqual({ hasEditAccess: false, isOwner: false });

      workspace.editToken = '';
      expect(calculateEditAccess(workspace as Workspace, ownerUser, null)).toEqual({ hasEditAccess: true, isOwner: true });
    });
  });

  describe('getSharingInfo', () => {
    it('returns sharing info with proper permissions', () => {
      const workspace: Partial<Workspace> = { owner: 'owner-123', sharingMode: SHARING_MODES.READ_WRITE_SELECTED as SharingMode, allowedUsers: ['user-456'], editToken: 'edit_token123' };
      const ownerUser: User = { userId: 'owner-123', accessToken: null };
      const regularUser: User = { userId: 'user-999', accessToken: null };

      const ownerResult = getSharingInfo(workspace as Workspace, ownerUser);
      expect(ownerResult).toEqual({ sharingMode: SHARING_MODES.READ_WRITE_SELECTED, allowedUsers: ['user-456'], isOwner: true, currentUser: 'owner-123', owner: 'owner-123', hasEditAccess: true, editToken: 'edit_token123' });

      const regularResult = getSharingInfo(workspace as Workspace, regularUser);
      expect(regularResult?.isOwner).toBe(false);
      expect(regularResult?.hasEditAccess).toBe(false);
      expect(regularResult?.editToken).toBeUndefined();

      expect(getSharingInfo(null, regularUser)).toBe(null);
      expect(getSharingInfo(workspace as Workspace, null)?.currentUser).toBe(null);
    });
  });

  describe('validateAndSetToken', () => {
    it('validates tokens and grants access', () => {
      const workspace: Partial<Workspace> = { owner: 'owner-123', sharingMode: SHARING_MODES.READ_WRITE_SELECTED as SharingMode, editToken: 'edit_existingtoken' };
      const user: User = { userId: 'user-456', hasEditAccess: false };

      expect(validateAndSetToken(workspace as Workspace, 'edit_existingtoken', user)).toBe(true);
      expect(user.hasEditAccess).toBe(true);

      expect(validateAndSetToken(workspace as Workspace, 'edit_wrongtoken', user)).toBe(false);
      expect(validateAndSetToken(workspace as Workspace, 'invalidtoken', user)).toBe(false);
      expect(validateAndSetToken(null, 'edit_token', user)).toBe(false);
      expect(validateAndSetToken(workspace as Workspace, null, user)).toBe(false);

      expect(validateAndSetToken(workspace as Workspace, 'edit_existingtoken', null)).toBe(true);
    });
  });

  describe('calculateEditAccess with sharing modes', () => {
    it('respects different sharing modes', () => {
      const workspace: Partial<Workspace> = { owner: 'owner-123', sharingMode: SHARING_MODES.READ_ONLY as SharingMode, editToken: 'edit_secret123' };
      const ownerUser: User = { userId: 'owner-123' };
      const regularUser: User = { userId: 'user-456' };

      expect(calculateEditAccess(workspace as Workspace, ownerUser, null).hasEditAccess).toBe(true);
      expect(calculateEditAccess(workspace as Workspace, regularUser, 'edit_secret123').hasEditAccess).toBe(false);

      workspace.sharingMode = SHARING_MODES.READ_WRITE_ALL as SharingMode;
      expect(calculateEditAccess(workspace as Workspace, regularUser, null).hasEditAccess).toBe(true);

      workspace.sharingMode = SHARING_MODES.READ_WRITE_SELECTED as SharingMode;
      expect(calculateEditAccess(workspace as Workspace, regularUser, 'edit_secret123').hasEditAccess).toBe(true);
      expect(calculateEditAccess(workspace as Workspace, regularUser, null).hasEditAccess).toBe(false);

      workspace.sharingMode = undefined as unknown as SharingMode;
      expect(calculateEditAccess(workspace as Workspace, regularUser, 'edit_secret123').hasEditAccess).toBe(true);
    });
  });
});
