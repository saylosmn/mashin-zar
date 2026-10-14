import { photoUrl } from "@/lib/format";

export function CarPhoto({
  path,
  alt,
  className = "",
  label,
}: {
  path?: string | null;
  alt: string;
  className?: string;
  label?: string;
}) {
  const url = photoUrl(path);
  if (!url)
    return (
      <div className={`ph-stripes mono flex items-center justify-center text-[12px] text-muted ${className}`}>
        {label ?? "Зураггүй"}
      </div>
    );
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={url} alt={alt} loading="lazy" className={`bg-soft object-cover ${className}`} />;
}
