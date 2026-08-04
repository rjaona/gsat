import { forwardRef, type InputHTMLAttributes } from 'react';
import { colors, radius, transition } from '@/design/tokens';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  error?: boolean;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(({ error, style, ...props }, ref) => (
  <input
    ref={ref}
    style={{
      width: '100%',
      height: '40px',
      padding: '0 12px',
      fontSize: '14px',
      fontFamily: "'Inter', sans-serif",
      color: colors.text,
      background: colors.surfaceHighest,
      border: `2px solid ${error ? colors.error : 'transparent'}`,
      borderRadius: radius.lg,
      outline: 'none',
      transition: `border-color ${transition.fast}, background ${transition.fast}`,
      ...style,
    }}
    onFocus={e => {
      e.currentTarget.style.borderColor = error ? colors.error : colors.primary;
      e.currentTarget.style.background = colors.surface;
    }}
    onBlur={e => {
      e.currentTarget.style.borderColor = error ? colors.error : 'transparent';
      e.currentTarget.style.background = colors.surfaceHighest;
    }}
    {...props}
  />
));
Input.displayName = 'Input';
