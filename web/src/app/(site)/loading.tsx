import { IconSpinner } from "@/components/icons";

export default function Loading() {
  return (
    <div className="mx-auto flex w-full max-w-[1280px] flex-col gap-6 px-6 py-8">
      <div role="status" aria-live="polite" className="flex items-center gap-3 text-[16px] text-body">
        <IconSpinner size={22} className="text-ink" />
        Уншиж байна, түр хүлээнэ үү
      </div>
      <div aria-hidden className="grid grid-cols-[repeat(auto-fill,minmax(260px,1fr))] gap-[18px]">
        {[55, 48, 62, 50, 58, 45].map((w, i) => (
          <div key={i} className="card overflow-hidden">
            <div className="sk h-[190px]" />
            <div className="flex flex-col gap-2.5 px-4 pt-3.5 pb-4">
              <div className="flex justify-between">
                <div className="sk h-4 rounded-md" style={{ width: `${w}%` }} />
                <div className="sk h-5 w-16 rounded" />
              </div>
              <div className="sk h-3 w-[78%] rounded-md" />
              <div className="sk h-5 w-[42%] rounded-md" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
