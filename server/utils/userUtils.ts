import type { CurrentUser, User } from '../types';

export function toUser(currentUser: CurrentUser): User {
  return {
    userId: currentUser.userId || currentUser.id,
    accessToken: currentUser.accessToken,
    hasEditAccess: currentUser.hasEditAccess,
    isOwner: currentUser.isOwner,
  };
}
