export default function PhoneFrame({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative mx-auto w-full max-w-[300px]">
      <div className="rounded-[36px] border border-hairline bg-ink/95 p-2.5 shadow-xl">
        <div className="overflow-hidden rounded-[28px] bg-mist">
          <div className="flex items-center justify-center py-2">
            <span className="h-1 w-10 rounded-full bg-hairline" />
          </div>
          <div className="relative h-[500px] overflow-y-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}
