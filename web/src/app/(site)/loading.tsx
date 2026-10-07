import { IconSpinner } from "@/components/icons";

export default function Loading() {
  return (
    <div className="max-w-[1280px] w-full mx-auto px-6 py-8 flex flex-col gap-6">
      <div role="status" aria-live="polite" className="flex items-center gap-3 text-[16px] text-body">
        <IconSpinner size={22} className="text-ink" />
        Уншиж байна, түр хүлээнэ үү
      </div>
      <div aria-hidden className="grid gap-[18px] grid-cols-[repeat(auto-fill,minmax(260px,1fr))]">
        {[55, 48, 62, 50, 58, 45].map((w, i) => (
          <div key={i} className="card overflow-hidden">
            <div className="sk h-[190px]" />
            <div className="px-4 pt-3.5 pb-4 flex flex-col gap-2.5">
              <div className="flex justify-between">
                <div className="sk h-4 rounded-md" style={{ width: `${w}%` }} />
                <div className="sk w-16 h-5 rounded" />
              </div>
              <div className="sk w-[78%] h-3 rounded-md" />
              <div className="sk w-[42%] h-5 rounded-md" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
