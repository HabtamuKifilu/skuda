import type { ReactNode } from "react";

type PlatformPageLayoutProps = {
  children: ReactNode;
};

export function PlatformPageLayout({ children }: PlatformPageLayoutProps) {
  return (
    <div className="w-full px-5 py-5 font-sans text-[13px] sm:px-6 lg:px-7 xl:px-8">
      <div className="flex flex-col gap-5">
        {children}
      </div>
    </div>
  );
}
