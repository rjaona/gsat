/**
 * RoleAssignmentGrid — 3-column grid of role assignment cards.
 *
 * Displays evaluator, reviewer and approver cards side by side.
 */
import type { RoleAssignment } from '@/types/workflow';
import { RoleCard } from './RoleCard';

export interface RoleAssignmentGridProps {
  assignments: RoleAssignment[];
  onAssign?: ((role: RoleAssignment['role']) => void) | undefined;
}

export function RoleAssignmentGrid({ assignments, onAssign }: RoleAssignmentGridProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      {assignments.map(a => (
        <RoleCard
          key={a.role}
          assignment={a}
          onAssign={onAssign ? () => onAssign(a.role) : undefined}
        />
      ))}
    </div>
  );
}
