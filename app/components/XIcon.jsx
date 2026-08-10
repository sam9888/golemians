'use client';
export default function XIcon({ size = 20, className = 'x-icon' }) {
  return (
    <svg className={className} style={{ width: size, height: size }} viewBox="0 0 24 24">
      <path d="M18.9 2H22l-7.6 8.7L23.3 22H16.7l-5.2-6.8L5.6 22H2.4l8.1-9.3L1.7 2h6.8l4.7 6.2L18.9 2Zm-1.2 18h1.7L7.4 3.9H5.6L17.7 20Z" />
    </svg>
  );
}
