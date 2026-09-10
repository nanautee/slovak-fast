const files = import.meta.glob("../assets/*.{png,webp,jpg,jpeg}", {
  eager: true,
  import: "default",
});

export default function Mascot({ size = 64, className = "", bounce = false, src }) {
  const resolved = src || Object.values(files)[0] || "/hero.png";
  return (
    <img
      src={resolved}
      alt="Mačka"
      width={size}
      height={size}
      draggable={false}
      className={`object-contain select-none ${bounce ? "animate-pop" : ""} ${className}`}
    />
  );
}