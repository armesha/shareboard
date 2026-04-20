import { SHARING_MODES } from '../constants';

export type SharingModeType = typeof SHARING_MODES[keyof typeof SHARING_MODES];

export interface SharingContextValue {
  sharingMode: SharingModeType;
  isOwner: boolean;
  currentUser: string | null;
  canWrite: () => boolean;
  changeMode: (newMode: SharingModeType) => void;
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


export interface WorkspaceExistsData {
  exists: boolean;
}
