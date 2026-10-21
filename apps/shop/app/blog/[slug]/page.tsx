import { photoUrl } from "@jolene/products/photos";
import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { PostBody } from "@/components/blog/post-body";
import { PostCard } from "@/components/blog/post-card";
import { BreadcrumbSchema } from "@/components/schema/breadcrumb-schema";
import { PostSchema } from "@/components/schema/post-schema";
import { Container } from "@/components/ui/container";
import { Link } from "@/components/ui/link";
import { Page } from "@/components/ui/page";
import { Sections } from "@/components/ui/sections";
import { BLOG_PATH, formatPostDate, getPostCover, getPostPath } from "@/lib/blog";
import { getPost, getPosts } from "@/lib/blog/server";
import { shopConfig } from "@/lib/config";
import { buildAlternates } from "@/lib/seo";

export function generateStaticParams() {
  return getPosts().map(({ slug }) => ({ slug }));
}

export async function generateMetadata({ params }: PageProps<"/blog/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const post = getPost(slug);
  if (!post) notFound();
  const path = getPostPath(slug);
  const cover = getPostCover(post);
  const images = cover
    ? [{ alt: cover.alt, height: cover.height, url: photoUrl(cover.url), width: cover.width }]
    : undefined;
  return {
    alternates: buildAlternates({ pathname: path }),
    description: post.description,
    openGraph: {
      description: post.description,
      images,
      modifiedTime: post.updatedOn,
      publishedTime: post.publishedOn,
      siteName: shopConfig.site.name,
      title: post.title,
      type: "article",
      url: path,
    },
    title: post.title,
  };
}

export default async function PostPage({ params }: PageProps<"/blog/[slug]">) {
  const { slug } = await params;
  const post = getPost(slug);
  if (!post) notFound();
  const others = getPosts()
    .filter((other) => other.slug !== slug)
    .slice(0, 3);
  return (
    <Page>
      <Container>
        <Sections>
          <BreadcrumbSchema
            items={[
              { name: shopConfig.site.name, path: "/" },
              { name: "Blog", path: BLOG_PATH },
              { name: post.title, path: getPostPath(post.slug) },
            ]}
          />
          <PostSchema post={post} />
          <article className="grid max-w-3xl gap-10" lang="ro">
            <header className="grid gap-4">
              <p className="flex flex-wrap gap-x-5 gap-y-2.5 text-sm text-muted-foreground">
                <Link className="text-foreground underline underline-offset-4" href={BLOG_PATH}>
                  Blog
                </Link>
                <time dateTime={post.publishedOn}>{formatPostDate(post.publishedOn)}</time>
              </p>
              <h1 className="text-3xl sm:text-4xl md:text-5xl">{post.title}</h1>
            </header>
            <PostBody blocks={post.blocks} />
          </article>
          <nav aria-labelledby="post-others" className="grid gap-5 border-t pt-10">
            <h2
              className="text-xxs leading-[1.6] font-medium tracking-[0.15em] text-muted-foreground uppercase"
              id="post-others"
            >
              Alte articole
            </h2>
            <ul className="grid gap-x-5 gap-y-10 sm:grid-cols-2 lg:grid-cols-3">
              {others.map((other) => (
                <li key={other.slug}>
                  <PostCard post={other} />
                </li>
              ))}
            </ul>
          </nav>
        </Sections>
      </Container>
    </Page>
  );
}
