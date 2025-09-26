import Image from 'next/image';
import Link from 'next/link';

interface LogoProps {
  variant?: 'default' | 'dark' | 'light';
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export function Logo({ variant = 'default', size = 'md', className = '' }: LogoProps) {
  const sizeMap = {
    sm: { width: 100, height: 28 },
    md: { width: 120, height: 34 },
    lg: { width: 160, height: 45 },
  };

  const { width, height } = sizeMap[size];
  
  return (
    <Link href="/" className={`inline-block ${className}`}>
      <div className="flex items-center space-x-2">
        <Image
          src="/images/boundly-logo.png"
          alt="Boundly Logo"
          width={width}
          height={height}
          className="h-auto object-contain"
          priority
        />
      </div>
    </Link>
  );
}

export default Logo;
