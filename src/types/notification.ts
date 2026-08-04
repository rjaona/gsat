export type NotificationType =
  | 'evaluation_created'
  | 'evaluation_submitted'
  | 'evaluation_validated'
  | 'evaluation_rejected'
  | 'campagne_opened'
  | 'campagne_closed'
  | 'workflow_assigned'
  | 'workflow_approved'
  | 'workflow_renvoye'
  | 'action_overdue'
  | 'user_created'
  | 'comment_added'
  | 'system';

export interface Notification {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  recipientId: string;
  senderId?: string | undefined;
  senderName?: string | undefined;
  resourceType?: string | undefined; // 'evaluation' | 'campagne' | 'action' | 'user'
  resourceId?: string | undefined;
  read: boolean;
  createdAt: Date;
}
