/**
 * Tests RTL — ValidationSignature (P4).
 * Garde la règle d'auto-validation : en mode requierePv, tant que le PV n'est
 * pas déposé, le bouton de validation reste désactivé même si conclusion +
 * certification sont remplies.
 */

import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { ValidationSignature } from '@/components/evaluation/ValidationSignature';

vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (k: string) => k }) }));

function renderSig(over: Partial<React.ComponentProps<typeof ValidationSignature>> = {}) {
  const props = {
    validatorName: 'Rakoto', validatorEmail: 'r@tem.mg', hasEssentialKO: false,
    onValidate: vi.fn().mockResolvedValue(undefined), onRequestRevision: vi.fn(),
    loading: false, requierePv: true, pvUploaded: false, onUploadPv: vi.fn(),
    hideRevision: true, ...over,
  };
  const { container } = render(<ValidationSignature {...props} />);
  // Remplit conclusion + certifie (les deux autres conditions de validation).
  fireEvent.change(container.querySelector('textarea')!, { target: { value: 'Conforme' } });
  fireEvent.click(container.querySelector('#certify')!);
  return { validateBtn: screen.getByText('validation.approveEvaluation').closest('button')!, props };
}

afterEach(cleanup);

describe('ValidationSignature — PV obligatoire (auto-validation)', () => {
  it('bouton DÉSACTIVÉ tant que le PV n’est pas déposé', () => {
    const { validateBtn } = renderSig({ pvUploaded: false });
    expect(validateBtn.disabled).toBe(true);
  });

  it('bouton ACTIVÉ une fois le PV déposé (+ conclusion + certification)', () => {
    const { validateBtn } = renderSig({ pvUploaded: true });
    expect(validateBtn.disabled).toBe(false);
  });

  it('le bouton « révision » est masqué en mode hideRevision', () => {
    renderSig({ pvUploaded: true });
    expect(screen.queryByText('validation.requestRevision')).toBeNull();
  });

  it('onValidate reçoit (conclusion, confirmedKO)', () => {
    const { validateBtn, props } = renderSig({ pvUploaded: true });
    fireEvent.click(validateBtn);
    expect(props.onValidate).toHaveBeenCalledWith('Conforme', false);
  });
});
