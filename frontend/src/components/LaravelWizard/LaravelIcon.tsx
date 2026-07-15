import { forwardRef } from 'react';
import type { LucideProps } from 'lucide-react';

const LaravelIcon = forwardRef<SVGSVGElement, LucideProps>((props, ref) => {
  const { size = 16, ...rest } = props;
  return (
    <svg viewBox="0 0 80 80" width={size} height={size} fill="none" ref={ref} {...rest}>
      <rect width="80" height="80" rx="16" fill="#FF2D20" />
      <path d="M32 22l8 5.5-8 5.5v-3.6l4.4-1.9L32 25.6V22zM38 22l8 5.5-8 5.5v-3.6l4.4-1.9L38 25.6V22z" fill="#fff" opacity="0.9" />
      <path d="M26 28l8 5.5-8 5.5v-3.6l4.4-1.9L26 31.6V28zM32 28l8 5.5-8 5.5v-3.6l4.4-1.9L32 31.6V28zM38 28l8 5.5-8 5.5v-3.6l4.4-1.9L38 31.6V28z" fill="#fff" opacity="0.7" />
      <path d="M26 34l8 5.5-8 5.5v-3.6l4.4-1.9L26 37.6V34zM32 34l8 5.5-8 5.5v-3.6l4.4-1.9L32 37.6V34z" fill="#fff" opacity="0.5" />
      <path d="M26 40l8 5.5-8 5.5V47.4l4.4-1.9L26 43.6V40z" fill="#fff" opacity="0.3" />
    </svg>
  );
});

LaravelIcon.displayName = 'LaravelIcon';
export default LaravelIcon;