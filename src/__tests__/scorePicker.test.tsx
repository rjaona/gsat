import { describe, it, expect, vi } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { ScorePicker } from '@/components/evaluation/ScorePicker';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k: string) => k }),
}));

describe('ScorePicker — trois états distincts (garde-fou C4)', () => {
  it('émet la note au clic sur 0..3', () => {
    const onChange = vi.fn();
    render(<ScorePicker value={undefined} onChange={onChange} />);
    screen.getByTestId('note-2').click();
    expect(onChange).toHaveBeenCalledWith(2);
    cleanup();
  });

  it('émet null au clic sur N/A — et JAMAIS undefined', () => {
    const onChange = vi.fn();
    render(<ScorePicker value={undefined} onChange={onChange} />);
    screen.getByTestId('note-na').click();
    expect(onChange).toHaveBeenCalledWith(null);
    cleanup();
  });

  it('émet undefined au clic sur Effacer — et JAMAIS null', () => {
    const onChange = vi.fn();
    render(<ScorePicker value={3} onChange={onChange} />);
    screen.getByTestId('note-effacer').click();
    expect(onChange).toHaveBeenCalledWith(undefined);
    cleanup();
  });

  it('re-cliquer la note sélectionnée efface, ne bascule pas en N/A', () => {
    const onChange = vi.fn();
    render(<ScorePicker value={3} onChange={onChange} />);
    screen.getByTestId('note-3').click();
    expect(onChange).toHaveBeenCalledWith(undefined);
    expect(onChange).not.toHaveBeenCalledWith(null);
    cleanup();
  });

  it('re-cliquer N/A revient à « pas répondu »', () => {
    const onChange = vi.fn();
    render(<ScorePicker value={null} onChange={onChange} />);
    screen.getByTestId('note-na').click();
    expect(onChange).toHaveBeenCalledWith(undefined);
    cleanup();
  });

  it('N/A et « pas répondu » ne se ressemblent pas à l\'écran', () => {
    const { unmount } = render(<ScorePicker value={null} onChange={() => {}} />);
    expect(screen.getByTestId('note-na').getAttribute('aria-checked')).toBe('true');
    expect(screen.queryByTestId('note-effacer')).not.toBeNull();
    unmount();
    render(<ScorePicker value={undefined} onChange={() => {}} />);
    expect(screen.getByTestId('note-na').getAttribute('aria-checked')).toBe('false');
    expect(screen.queryByTestId('note-effacer')).toBeNull();
    cleanup();
  });

  it('signale un essentiel resté sans réponse', () => {
    render(<ScorePicker value={undefined} onChange={() => {}} essentiel />);
    expect(screen.queryByText('evaluation.notes.essentielSansReponse')).not.toBeNull();
    cleanup();
  });

  it('ne signale rien si l\'essentiel est en N/A', () => {
    render(<ScorePicker value={null} onChange={() => {}} essentiel />);
    expect(screen.queryByText('evaluation.notes.essentielSansReponse')).toBeNull();
    cleanup();
  });
});
