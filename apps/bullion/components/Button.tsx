import React from 'react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  icon?: React.ReactNode;
}

export const Button: React.FC<ButtonProps> = ({
  children,
  variant = 'primary',
  size = 'md',
  icon,
  className = '',
  ...props
}) => {
  const baseStyles =
    'inline-flex items-center justify-center gap-2 rounded-full border font-medium uppercase tracking-[0.16em] transition-colors focus:outline-none focus:ring-2 focus:ring-stone-300 disabled:opacity-50 disabled:cursor-not-allowed';

  const variants = {
    primary: 'border-stone-900 bg-stone-900 text-stone-50 hover:bg-stone-700 hover:border-stone-700',
    secondary: 'border-stone-300 bg-stone-50 text-stone-900 hover:bg-stone-100',
    danger: 'border-red-200 bg-red-50 text-red-700 hover:bg-red-100',
    ghost: 'border-transparent bg-transparent text-stone-500 hover:bg-stone-100 hover:text-stone-900',
  };

  const sizes = {
    sm: 'px-3 py-2 text-[10px]',
    md: 'px-4 py-2.5 text-[11px]',
    lg: 'px-5 py-3 text-xs',
  };

  return (
    <button className={`${baseStyles} ${variants[variant]} ${sizes[size]} ${className}`} {...props}>
      {icon}
      {children}
    </button>
  );
};
