export type NoticeItem = {
  id: string;
  type: "APPROVAL" | "MILESTONE" | "SYSTEM";
  titleKey: string;
  isRead: boolean;
  createdAt: string;
  readAt: string | null;
  project: null | { id: string; projectCode: string; title: string; status: string };
};

export type NoticePage = {
  notices: NoticeItem[];
  nextCursor: string | null;
  unreadCount: number;
};

export function noticeQueryKey(epoch: string, userId: string, roleKey: string, state: string, cursor: string) {
  return ["notifications", epoch, userId, roleKey, state, cursor] as const;
}

export function noticeScope(epoch: string, userId: string, roleKey: string): string {
  return [epoch, userId, roleKey].join(":");
}

export type NoticePageState = { scope: string; cursor?: string; pages: NoticeItem[] };

export function noticePageState(scope: string): NoticePageState {
  return { scope, pages: [] };
}

export function noticePagesForScope(state: NoticePageState, scope: string): NoticePageState {
  return state.scope === scope ? state : noticePageState(scope);
}

export function visibleNotices(state: NoticePageState, scope: string, signedIn: boolean, current: NoticeItem[]): NoticeItem[] {
  if (!signedIn || state.scope !== scope) return [];
  return state.cursor ? [...state.pages, ...current] : current;
}

export function rememberNoticePage(state: NoticePageState, scope: string, shown: NoticeItem[], nextCursor: string | null): NoticePageState {
  if (state.scope !== scope || !nextCursor) return state;
  return { scope, cursor: nextCursor, pages: shown };
}

export function noticeHref(item: NoticeItem): string | null {
  return item.project ? `/projects/${item.project.id}` : null;
}
