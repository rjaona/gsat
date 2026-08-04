import { useTranslation } from 'react-i18next';
import type { Organisation, OrgType } from '@/types';

const TYPE_STYLES: Record<OrgType, React.CSSProperties> = {
  OMMS:   { background: 'var(--primary-light)', color: 'var(--primary)' },
  REGION: { background: 'var(--info-light)', color: 'var(--info)' },
  OSN:    { background: '#EEF2FF', color: '#4338CA' },
  ASN:    { background: 'var(--success-light)', color: 'var(--success)' },
};

const INDENT: Record<OrgType, number> = {
  OMMS:   0,
  REGION: 1,
  OSN:    2,
  ASN:    3,
};

interface OrgTreeProps {
  organisations: Organisation[];
  scores?: Record<string, number> | undefined;
  onEdit: (org: Organisation) => void;
  onDelete: (org: Organisation) => void;
}

interface OrgNode extends Organisation {
  children: OrgNode[];
}

function buildTree(orgs: Organisation[]): OrgNode[] {
  const map = new Map<string, OrgNode>();
  orgs.forEach(o => map.set(o.id, { ...o, children: [] }));

  const roots: OrgNode[] = [];
  map.forEach(node => {
    if (node.parentId && map.has(node.parentId)) {
      map.get(node.parentId)!.children.push(node);
    } else {
      roots.push(node);
    }
  });

  // Trier chaque niveau par nom
  function sortNodes(nodes: OrgNode[]): void {
    nodes.sort((a, b) => a.nom.localeCompare(b.nom));
    nodes.forEach(n => sortNodes(n.children));
  }
  sortNodes(roots);

  return roots;
}

function OrgRow({
  node,
  depth,
  scores,
  onEdit,
  onDelete,
}: {
  node: OrgNode;
  depth: number;
  scores?: Record<string, number> | undefined;
  onEdit: (org: Organisation) => void;
  onDelete: (org: Organisation) => void;
}) {
  const { t } = useTranslation();
  const score = scores?.[node.id];

  return (
    <>
      <tr
        onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg)')}
        onMouseLeave={e => (e.currentTarget.style.background = '')}
      >
        <td className="px-4 py-2.5">
          <div className="flex items-center gap-2" style={{ paddingLeft: `${depth * 20}px` }}>
            {depth > 0 && (
              <span className="select-none" style={{ color: 'var(--border)' }}>{'└'}</span>
            )}
            <span className="text-sm font-medium" style={{ color: 'var(--text)' }}>{node.nom}</span>
            {node.code && (
              <span className="text-xs" style={{ color: 'var(--text-muted)' }}>({node.code})</span>
            )}
            {!node.actif && (
              <span
                className="rounded-full px-2 py-0.5 text-xs"
                style={{ background: 'var(--bg)', color: 'var(--text-muted)' }}
              >
                {t('admin.utilisateurs.inactif')}
              </span>
            )}
          </div>
        </td>
        <td className="px-4 py-2.5">
          <span
            className="inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium"
            style={TYPE_STYLES[node.type]}
          >
            {node.type}
          </span>
        </td>
        <td className="px-4 py-2.5 text-sm" style={{ color: 'var(--text-muted)' }}>
          {node.regionCode ?? '—'}
        </td>
        <td className="px-4 py-2.5 text-sm" style={{ color: 'var(--text-muted)' }}>
          {score !== undefined ? (
            <span
              className="font-medium"
              style={{
                color: score >= 75 ? 'var(--success)' : score >= 50 ? 'var(--warning)' : 'var(--danger)',
              }}
            >
              {score}%
            </span>
          ) : '—'}
        </td>
        <td className="px-4 py-2.5">
          <div className="flex items-center gap-2 justify-end">
            <button
              type="button"
              onClick={() => onEdit(node)}
              className="rounded-md px-2.5 py-1 text-xs font-medium"
              style={{ color: 'var(--info)' }}
              onMouseEnter={e => (e.currentTarget.style.background = 'var(--info-light)')}
              onMouseLeave={e => (e.currentTarget.style.background = '')}
            >
              {t('common.modifier')}
            </button>
            <button
              type="button"
              onClick={() => onDelete(node)}
              className="rounded-md px-2.5 py-1 text-xs font-medium"
              style={{ color: 'var(--danger)' }}
              onMouseEnter={e => (e.currentTarget.style.background = 'var(--danger-light)')}
              onMouseLeave={e => (e.currentTarget.style.background = '')}
            >
              {t('common.supprimer')}
            </button>
          </div>
        </td>
      </tr>
      {node.children.map(child => (
        <OrgRow
          key={child.id}
          node={child}
          depth={depth + 1}
          scores={scores}
          onEdit={onEdit}
          onDelete={onDelete}
        />
      ))}
    </>
  );
}

export function OrgTree({ organisations, scores, onEdit, onDelete }: OrgTreeProps) {
  const { t } = useTranslation();
  const tree = buildTree(organisations);

  if (organisations.length === 0) {
    return (
      <div
        className="rounded-xl border-2 border-dashed py-12 text-center text-sm"
        style={{ borderColor: 'var(--border)', color: 'var(--text-muted)' }}
      >
        {t('admin.organisations.aucune')}
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-xl" style={{ border: '1px solid var(--border)' }}>
      <table className="min-w-full text-sm">
        <thead style={{ background: 'var(--bg)', borderBottom: '1px solid var(--border)' }}>
          <tr>
            <th className="px-4 py-3 text-left font-medium" style={{ color: 'var(--text-muted)' }}>
              {t('admin.organisations.colonne.nom')}
            </th>
            <th className="px-4 py-3 text-left font-medium" style={{ color: 'var(--text-muted)' }}>
              {t('admin.organisations.colonne.type')}
            </th>
            <th className="px-4 py-3 text-left font-medium" style={{ color: 'var(--text-muted)' }}>
              {t('admin.organisations.colonne.region')}
            </th>
            <th className="px-4 py-3 text-left font-medium" style={{ color: 'var(--text-muted)' }}>
              {t('admin.organisations.colonne.scoreGSAT')}
            </th>
            <th className="px-4 py-3" />
          </tr>
        </thead>
        <tbody style={{ background: 'var(--surface)' }}>
          {tree.map(node => (
            <OrgRow
              key={node.id}
              node={node}
              depth={0}
              scores={scores}
              onEdit={onEdit}
              onDelete={onDelete}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}
