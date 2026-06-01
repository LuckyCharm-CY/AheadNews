export type Group = {
  id:        string;
  name:      string;
  createdBy: string;
  createdAt: string;
};

export type GroupMember = {
  groupId:  string;
  userId:   string;
  username: string;
  role:     'owner' | 'member';
  joinedAt: string;
};

export type GroupMessage = {
  id:             string;
  groupId:        string;
  authorId:       string;
  author:         string;
  parentId?:      string; // set when this is a reply to a story message
  messageType:    'text' | 'story';
  content:        string | null;
  storyHeadline?: string;
  storySource?:   string;
  storyUrl?:      string;
  storySummary?:  string;
  createdAt:      string;
};
