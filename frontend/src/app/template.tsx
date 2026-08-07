export default function Template({ children }: { children: React.ReactNode }) {
  return (
    <div className="animate-slide-up w-full h-full">
      {children}
    </div>
  );
}
