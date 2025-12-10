import { SHARING_MODES } from '../constants';

export type SharingModeType = typeof SHARING_MODES[keyof typeof SHARING_MODES];

export interface SharingContextValue {
  sharingMode: SharingModeType;
  allowedUsers: string[];
  isOwner: boolean;
  currentUser: string | null;
  hasEditAccess: boolean;
  canWrite: () => boolean;
  changeMode: (newMode: SharingModeType) => void;
  workspaceOwner: string | null;
  sharingInfoReceived: boolean;
  workspaceNotFound: boolean;
  isCheckingWorkspace: boolean;
  accessToken: string | null;
}

export interface SharingProviderProps {
  children: React.ReactNode;
  workspaceId: string;
}

export interface SharingInfoData {
  sharingMode?: SharingModeType;
  allowedUsers?: string[];
  hasEditAccess?: boolean;
  isOwner?: boolean;
  owner?: string;
  currentUser?: string;
  editToken?: string;
}

export interface SharingModeChangedData {
  sharingMode?: SharingModeType;
  allowedUsers?: string[];
  editToken?: string;
  hasEditAccess?: boolean;
}

export interface EditTokenUpdateData {
  editToken?: string;
}

export interface WorkspaceExistsData {
  exists: boolean;
}
