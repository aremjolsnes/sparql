/** Blå boble med et tall, for eksempel antall åpne avvik ved «Admin» i topplinja */
export default function Boble({ antall, title }: { antall: number; title?: string }) {
  return (
    <span
      title={title}
      className="ml-1.5 inline-block min-w-[1.25rem] rounded-full px-1.5 text-center text-xs font-semibold leading-5 align-middle"
      style={{ background: "var(--link)", color: "#0b1220" }}
    >
      {antall}
    </span>
  );
}
