export type BlockAction = {
  label: string;
  href: string;
  variant?: "primary" | "secondary";
};

export type BlockImage = {
  src: string;
  alt?: string;
  width?: number;
  height?: number;
};
