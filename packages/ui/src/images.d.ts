/** An image file imports as its address and size, as Next.js bundles it. */
declare module "*.webp" {
  const image: { src: string; width: number; height: number };
  export default image;
}
