import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Grille2x2 } from '@/components/dashboard/pilotage/Grille2x2';

vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (_k: string, d?: string) => d ?? _k }) }));

describe('Grille2x2', () => {
  const buckets = { appuiUrgent: 7, conformite: 2, execution: 3, sain: 18, nonEvalue: 3 };
  it('affiche le compteur d’appui urgent', () => {
    render(<Grille2x2 buckets={buckets} />);
    expect(screen.getByText('7')).toBeInTheDocument();
  });
  it('déclenche onSelectCase au clic sur la case appui urgent', () => {
    const onSelect = vi.fn();
    render(<Grille2x2 buckets={buckets} onSelectCase={onSelect} />);
    fireEvent.click(screen.getByTestId('case-appuiUrgent'));
    expect(onSelect).toHaveBeenCalledWith('appuiUrgent');
  });
});
