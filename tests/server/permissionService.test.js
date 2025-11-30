import { describe, it, expect, beforeEach } from 'vitest';
import {
  checkWritePermission,
  checkOwnership,
  calculateEditAccess,
  getSharingInfo,
  validateAndSetToken
} from '../../server/services/permissionService.js';
import { SHARING_MODES } from '../../server/config.js';

describe('permissionService', () => {
  describe('checkWritePermission', () => {
    let workspace;
    let ownerUser;
    let regularUser;

    beforeEach(() => {
      workspace = {
        owner: 'owner-123',
        sharingMode: SHARING_MODES.READ_WRITE_SELECTED,
        editToken: null
      };

      ownerUser = {
        userId: 'owner-123',
        hasEditAccess: false
      };

      regularUser = {
        userId: 'user-456',
        hasEditAccess: false
      };
    });

    it('should return true if user is the owner', () => {
      expect(checkWritePermission(workspace, ownerUser)).toBe(true);
    });

    it('should return true if user has edit access', () => {
      regularUser.hasEditAccess = true;
      expect(checkWritePermission(workspace, regularUser)).toBe(true);
    });

    it('should return false if user does not have edit access', () => {
      regularUser.hasEditAccess = false;
      expect(checkWritePermission(workspace, regularUser)).toBe(false);
    });

    it('should return true for owner regardless of hasEditAccess', () => {
      ownerUser.hasEditAccess = false;
      expect(checkWritePermission(workspace, ownerUser)).toBe(true);
    });

    it('should return false if workspace is null', () => {
      expect(checkWritePermission(null, regularUser)).toBe(false);
    });

    it('should return false if workspace is undefined', () => {
      expect(checkWritePermission(undefined, regularUser)).toBe(false);
    });

    it('should return false if user is null', () => {
      expect(checkWritePermission(workspace, null)).toBe(false);
    });

    it('should return false if user is undefined', () => {
      expect(checkWritePermission(workspace, undefined)).toBe(false);
    });

    it('should return false if both workspace and user are null', () => {
      expect(checkWritePermission(null, null)).toBe(false);
    });

    it('should handle user with hasEditAccess = undefined', () => {
      delete regularUser.hasEditAccess;
      expect(checkWritePermission(workspace, regularUser)).toBe(false);
    });
  });

  describe('checkOwnership', () => {
    let workspace;

    beforeEach(() => {
      workspace = {
        owner: 'owner-123'
      };
    });

    it('should return true if userId matches workspace owner', () => {
      expect(checkOwnership(workspace, 'owner-123')).toBe(true);
    });

    it('should return false if userId does not match workspace owner', () => {
      expect(checkOwnership(workspace, 'user-456')).toBe(false);
    });

    it('should return false if userId is null', () => {
      expect(checkOwnership(workspace, null)).toBe(false);
    });

    it('should return false if userId is undefined', () => {
      expect(checkOwnership(workspace, undefined)).toBe(false);
    });

    it('should return false if workspace is null', () => {
      expect(checkOwnership(null, 'owner-123')).toBe(false);
    });

    it('should return false if workspace is undefined', () => {
      expect(checkOwnership(undefined, 'owner-123')).toBe(false);
    });

    it('should return false if both workspace and userId are null', () => {
      expect(checkOwnership(null, null)).toBe(false);
    });

    it('should handle empty string userId', () => {
      expect(checkOwnership(workspace, '')).toBe(false);
    });

    it('should handle workspace with undefined owner', () => {
      workspace.owner = undefined;
      expect(checkOwnership(workspace, 'owner-123')).toBe(false);
    });
  });

  describe('calculateEditAccess', () => {
    let workspace;
    let ownerUser;
    let regularUser;

    beforeEach(() => {
      workspace = {
        owner: 'owner-123',
        sharingMode: SHARING_MODES.READ_WRITE_SELECTED,
        editToken: 'edit_secret123'
      };

      ownerUser = {
        userId: 'owner-123'
      };

      regularUser = {
        userId: 'user-456'
      };
    });

    it('should return full access for owner regardless of token', () => {
      const result = calculateEditAccess(workspace, ownerUser, null);
      expect(result).toEqual({
        hasEditAccess: true,
        isOwner: true
      });
    });

    it('should grant access with valid token', () => {
      const result = calculateEditAccess(workspace, regularUser, 'edit_secret123');
      expect(result).toEqual({
        hasEditAccess: true,
        isOwner: false
      });
    });

    it('should deny access with invalid token', () => {
      const result = calculateEditAccess(workspace, regularUser, 'edit_wrongtoken');
      expect(result).toEqual({
        hasEditAccess: false,
        isOwner: false
      });
    });

    it('should deny access without token', () => {
      const result = calculateEditAccess(workspace, regularUser, null);
      expect(result).toEqual({
        hasEditAccess: false,
        isOwner: false
      });
    });

    it('should return false for both flags if workspace is null', () => {
      const result = calculateEditAccess(null, regularUser, 'edit_token');
      expect(result).toEqual({
        hasEditAccess: false,
        isOwner: false
      });
    });

    it('should return false for both flags if user is null', () => {
      const result = calculateEditAccess(workspace, null, 'edit_token');
      expect(result).toEqual({
        hasEditAccess: false,
        isOwner: false
      });
    });

    it('should return false for both flags if workspace is undefined', () => {
      const result = calculateEditAccess(undefined, regularUser, 'edit_token');
      expect(result).toEqual({
        hasEditAccess: false,
        isOwner: false
      });
    });

    it('should return false for both flags if user is undefined', () => {
      const result = calculateEditAccess(workspace, undefined, 'edit_token');
      expect(result).toEqual({
        hasEditAccess: false,
        isOwner: false
      });
    });

    it('should handle workspace without editToken', () => {
      workspace.editToken = null;
      const result = calculateEditAccess(workspace, regularUser, 'edit_anytoken');
      expect(result).toEqual({
        hasEditAccess: false,
        isOwner: false
      });
    });

    it('should grant access to owner even without editToken set', () => {
      workspace.editToken = null;
      const result = calculateEditAccess(workspace, ownerUser, null);
      expect(result).toEqual({
        hasEditAccess: true,
        isOwner: true
      });
    });
  });

  describe('getSharingInfo', () => {
    let workspace;
    let ownerUser;
    let regularUser;

    beforeEach(() => {
      workspace = {
        owner: 'owner-123',
        sharingMode: SHARING_MODES.READ_WRITE_SELECTED,
        allowedUsers: ['user-456', 'user-789'],
        editToken: 'edit_token123'
      };

      ownerUser = {
        userId: 'owner-123',
        hasEditAccess: true
      };

      regularUser = {
        userId: 'user-456',
        hasEditAccess: false
      };
    });

    it('should return correct structure for owner', () => {
      const result = getSharingInfo(workspace, ownerUser);
      expect(result).toEqual({
        sharingMode: SHARING_MODES.READ_WRITE_SELECTED,
        allowedUsers: ['user-456', 'user-789'],
        isOwner: true,
        currentUser: 'owner-123',
        owner: 'owner-123',
        hasEditAccess: true,
        editToken: 'edit_token123'
      });
    });

    it('should return correct structure for regular user', () => {
      const result = getSharingInfo(workspace, regularUser);
      expect(result).toEqual({
        sharingMode: SHARING_MODES.READ_WRITE_SELECTED,
        allowedUsers: ['user-456', 'user-789'],
        isOwner: false,
        currentUser: 'user-456',
        owner: 'owner-123',
        hasEditAccess: false,
        editToken: 'edit_token123'
      });
    });

    it('should set isOwner flag correctly for owner', () => {
      const result = getSharingInfo(workspace, ownerUser);
      expect(result.isOwner).toBe(true);
    });

    it('should set isOwner flag correctly for non-owner', () => {
      const result = getSharingInfo(workspace, regularUser);
      expect(result.isOwner).toBe(false);
    });

    it('should determine hasEditAccess correctly for owner', () => {
      const result = getSharingInfo(workspace, ownerUser);
      expect(result.hasEditAccess).toBe(true);
    });

    it('should determine hasEditAccess correctly with access', () => {
      regularUser.hasEditAccess = true;
      const result = getSharingInfo(workspace, regularUser);
      expect(result.hasEditAccess).toBe(true);
    });

    it('should determine hasEditAccess correctly without access', () => {
      regularUser.hasEditAccess = false;
      const result = getSharingInfo(workspace, regularUser);
      expect(result.hasEditAccess).toBe(false);
    });

    it('should return null if workspace is null', () => {
      const result = getSharingInfo(null, regularUser);
      expect(result).toBe(null);
    });

    it('should return null if workspace is undefined', () => {
      const result = getSharingInfo(undefined, regularUser);
      expect(result).toBe(null);
    });

    it('should handle null user gracefully', () => {
      const result = getSharingInfo(workspace, null);
      expect(result).toEqual({
        sharingMode: SHARING_MODES.READ_WRITE_SELECTED,
        allowedUsers: ['user-456', 'user-789'],
        isOwner: false,
        currentUser: null,
        owner: 'owner-123',
        hasEditAccess: false,
        editToken: 'edit_token123'
      });
    });

    it('should handle undefined user gracefully', () => {
      const result = getSharingInfo(workspace, undefined);
      expect(result).toEqual({
        sharingMode: SHARING_MODES.READ_WRITE_SELECTED,
        allowedUsers: ['user-456', 'user-789'],
        isOwner: false,
        currentUser: null,
        owner: 'owner-123',
        hasEditAccess: false,
        editToken: 'edit_token123'
      });
    });

    it('should include all workspace properties in result', () => {
      const result = getSharingInfo(workspace, ownerUser);
      expect(result).toHaveProperty('sharingMode');
      expect(result).toHaveProperty('allowedUsers');
      expect(result).toHaveProperty('isOwner');
      expect(result).toHaveProperty('currentUser');
      expect(result).toHaveProperty('owner');
      expect(result).toHaveProperty('hasEditAccess');
      expect(result).toHaveProperty('editToken');
    });
  });

  describe('validateAndSetToken', () => {
    let workspace;
    let user;

    beforeEach(() => {
      workspace = {
        owner: 'owner-123',
        sharingMode: SHARING_MODES.READ_WRITE_SELECTED,
        editToken: null
      };

      user = {
        userId: 'user-456',
        hasEditAccess: false
      };
    });

    it('should set token if it starts with "edit_" and token is not set', () => {
      const result = validateAndSetToken(workspace, 'edit_newtoken', user);
      expect(result).toBe(true);
      expect(workspace.editToken).toBe('edit_newtoken');
    });

    it('should set hasEditAccess for user', () => {
      validateAndSetToken(workspace, 'edit_newtoken', user);
      expect(user.hasEditAccess).toBe(true);
    });

    it('should not override existing token', () => {
      workspace.editToken = 'edit_existingtoken';
      const result = validateAndSetToken(workspace, 'edit_newtoken', user);
      expect(result).toBe(false);
      expect(workspace.editToken).toBe('edit_existingtoken');
    });

    it('should reject token that does not start with "edit_"', () => {
      const result = validateAndSetToken(workspace, 'invalidtoken', user);
      expect(result).toBe(false);
      expect(workspace.editToken).toBe(null);
    });

    it('should reject empty token', () => {
      const result = validateAndSetToken(workspace, '', user);
      expect(result).toBe(false);
      expect(workspace.editToken).toBe(null);
    });

    it('should return false if workspace is null', () => {
      const result = validateAndSetToken(null, 'edit_token', user);
      expect(result).toBe(false);
    });

    it('should return false if workspace is undefined', () => {
      const result = validateAndSetToken(undefined, 'edit_token', user);
      expect(result).toBe(false);
    });

    it('should return false if accessToken is null', () => {
      const result = validateAndSetToken(workspace, null, user);
      expect(result).toBe(false);
    });

    it('should return false if accessToken is undefined', () => {
      const result = validateAndSetToken(workspace, undefined, user);
      expect(result).toBe(false);
    });

    it('should handle null user gracefully when setting token', () => {
      const result = validateAndSetToken(workspace, 'edit_token', null);
      expect(result).toBe(true);
      expect(workspace.editToken).toBe('edit_token');
    });

    it('should handle undefined user gracefully when setting token', () => {
      const result = validateAndSetToken(workspace, 'edit_token', undefined);
      expect(result).toBe(true);
      expect(workspace.editToken).toBe('edit_token');
    });

    it('should accept token exactly equal to "edit_"', () => {
      const result = validateAndSetToken(workspace, 'edit_', user);
      expect(result).toBe(true);
      expect(workspace.editToken).toBe('edit_');
    });

    it('should handle token with special characters after "edit_"', () => {
      const result = validateAndSetToken(workspace, 'edit_!@#$%^&*()', user);
      expect(result).toBe(true);
      expect(workspace.editToken).toBe('edit_!@#$%^&*()');
    });

    it('should not modify user hasEditAccess if user is null', () => {
      const result = validateAndSetToken(workspace, 'edit_token', null);
      expect(result).toBe(true);
    });

    it('should preserve other workspace properties when setting token', () => {
      workspace.otherProp = 'value';
      validateAndSetToken(workspace, 'edit_token', user);
      expect(workspace.otherProp).toBe('value');
      expect(workspace.owner).toBe('owner-123');
    });
  });
});
