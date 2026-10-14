export function NumField({
  name,
  label,
  value,
  step,
  placeholder,
  wide,
}: {
  name: string;
  label: string;
  value: number | string;
  step?: string;
  placeholder?: string;
  wide?: boolean;
}) {
  return (
    <label className={`label text-[13px] ${wide ? "flex-[2_1_300px]" : "flex-[1_1_150px]"}`}>
      {label}
      <input
        name={name}
        type="number"
        step={step ?? "1"}
        min={0}
        defaultValue={value}
        placeholder={placeholder}
        className="input mono h-11"
      />
    </label>
  );
}
