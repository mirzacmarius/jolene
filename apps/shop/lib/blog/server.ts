import { blog, type Post } from "@jolene/products/blog";

export function getPost(slug: string): Post | undefined {
  return blog.find((post) => post.slug === slug);
}

export function getPosts(): Post[] {
  return blog;
}
